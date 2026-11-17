import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const outputDir = path.join(root, "output");
// Pages use template.html; the home page uses home.html. Both include head.html.
const templates = {
  page: path.join(root, "build", "template.html"),
  home: path.join(root, "build", "home.html"),
};
const filter = path.join(root, "build", "word.lua");
// Shared files (the site stylesheet and fonts), copied as-is to output/site/.
const siteDir = path.join(root, "build", "site");
const siteOutDir = path.join(outputDir, "site");

// A mistake in the content, such as a bad index.json. Reported as one line, without a stack
// trace, because the fix is in the content rather than the build.
class ContentError extends Error {}

async function findPageConfigs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = entries.some((e) => e.isFile() && e.name === "index.json") ? [dir] : [];
  for (const entry of entries) {
    if (entry.isDirectory()) found.push(...(await findPageConfigs(path.join(dir, entry.name))));
  }
  return found;
}

// The fields that each type of index.json may have. Any other field is an error, because it is
// probably a typo.
const fields = {
  page: { required: ["type", "source", "output"], optional: ["style", "script", "date"] },
  home: { required: ["type", "source", "output"], optional: ["style", "script"] },
};

// Fields that name a file in the same directory as the index.json.
const fileFields = ["source", "style", "script"];

// The date given to undated pages, so that they sort after every dated one.
const undated = "0000-01-01";

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

// A real calendar date in the form YYYY-MM-DD.
function isDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

async function readConfig(dir) {
  const file = path.join(dir, "index.json");
  const name = path.relative(root, file);
  const fail = (message) => {
    throw new ContentError(`${name}: ${message}`);
  };

  let config;
  try {
    config = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(`not valid JSON (${error.message})`);
  }
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    fail("must be a JSON object");
  }

  const allowed = fields[config.type];
  if (!allowed) fail(`unknown type ${JSON.stringify(config.type)}`);
  for (const key of Object.keys(config)) {
    if (![...allowed.required, ...allowed.optional].includes(key)) fail(`unknown field "${key}"`);
  }
  for (const key of allowed.required) {
    if (!(key in config)) fail(`missing "${key}"`);
  }
  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== "string" || value === "") fail(`"${key}" must be a non-empty string`);
  }

  for (const key of fileFields) {
    if (key in config && !(await exists(path.join(dir, config[key])))) {
      fail(`"${key}" names ${config[key]}, which does not exist`);
    }
  }
  if (path.extname(config.source) !== ".docx") fail(`"source" must be a .docx file`);
  if (path.basename(config.output) !== config.output || path.extname(config.output) !== ".html") {
    fail(`"output" must be a plain filename ending in .html`);
  }

  // The home page is content/index.json, and only it.
  const atRoot = dir === contentDir;
  if (config.type === "home") {
    if (!atRoot) fail(`a "home" page must be content/index.json`);
    if (config.output !== "index.html") fail(`the home page's "output" must be "index.html"`);
  } else if (atRoot) {
    fail(`content/index.json must be the home page, of type "home"`);
  }

  if (config.type === "page") {
    if (!("date" in config)) {
      console.warn(`warning: ${name}: no "date", so it is listed last`);
      config.date = undated;
    } else if (!isDate(config.date)) {
      fail(`"date" must be a real date in the form YYYY-MM-DD`);
    }
  }

  return config;
}

// Builds a page or the home page. extraArgs are passed to Pandoc as they are.
async function buildPage(dir, config, extraArgs = []) {
  const outDir = path.join(outputDir, path.relative(contentDir, dir));
  const includes = await mkdtemp(path.join(tmpdir(), "mixedjames-"));

  try {
    await mkdir(outDir, { recursive: true });
    await rm(path.join(outDir, "media"), { recursive: true, force: true });

    const args = [
      path.join(dir, config.source),
      "--from=docx+styles",
      "--to=html5",
      "--standalone",
      `--template=${templates[config.type]}`,
      `--lua-filter=${filter}`,
      "--mathml",
      "--section-divs",
      "--shift-heading-level-by=1", // The docx Title is the page's only <h1>.
      "--wrap=none",
      "--extract-media=.",
      `--output=${config.output}`,
      ...extraArgs,
    ];

    // The path from this page back to the output root, such as "../", for linking to the
    // shared files. Always uses forward slashes, as URLs do.
    const toRoot = path.relative(outDir, outputDir).split(path.sep).join("/");
    args.push(`--variable=siteroot:${toRoot ? `${toRoot}/` : ""}`);

    // The template links the site stylesheet first, so page styles can override it.
    if (config.style) {
      const css = await readFile(path.join(dir, config.style), "utf8");
      const file = path.join(includes, "style.html");
      await writeFile(file, `<style>\n${css}</style>\n`);
      args.push(`--include-in-header=${file}`);
    }

    if (config.script) {
      const js = await readFile(path.join(dir, config.script), "utf8");
      const file = path.join(includes, "script.html");
      // A literal </script> inside the source would end the inline element early.
      await writeFile(file, `<script type="module">\n${js.replaceAll("</script", "<\\/script")}</script>\n`);
      args.push(`--include-after-body=${file}`);
      // The page's script is a module, so it runs in strict mode, after site/scroll.js, which
      // the template loads just before it and which defines Page.
      args.push("--variable=pagescript");
    }

    // Pandoc runs from the page's output directory so that media links are relative.
    const { stderr } = await run("pandoc", args, { cwd: outDir });
    if (stderr) process.stderr.write(stderr);
  } finally {
    await rm(includes, { recursive: true, force: true });
  }

  console.log(`built ${path.relative(root, path.join(outDir, config.output))}`);
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Summarises a page for the home page list and search. build/summary.lua supplies the title,
// subtitle and keywords; the date and the address come from index.json.
async function summarisePage(dir, config) {
  const writer = path.join(root, "build", "summary.lua");
  const { stdout } = await run("pandoc", [
    path.join(dir, config.source),
    "--from=docx+styles",
    `--to=${writer}`,
  ]);
  const summary = JSON.parse(stdout);

  // A page without a Title is listed by its filename. The filter has already warned.
  const titleText = summary.titleText.trim() || config.output;
  const title = summary.title || escapeHtml(config.output);

  // Keys in a fixed order, so that generated JSON is stable and easy to read.
  return {
    // Relative to the output root, with forward slashes, as URLs use.
    url: path.join(path.relative(contentDir, dir), config.output).split(path.sep).join("/"),
    date: config.date,
    title,
    titleText,
    subtitle: summary.subtitle,
    subtitleText: summary.subtitleText.trim(),
    keywords: summary.keywords,
  };
}

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-11-05" becomes "5 November 2026". Undated pages show no date.
function formatDate(date) {
  if (date === undated) return "";
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

// The home page's list of pages, for home.html. Titles and subtitles are already HTML.
function homeListArgs(pages) {
  const list = pages.map((page) => ({
    href: encodeURI(page.url).replaceAll("&", "&amp;"),
    date: page.date,
    dateText: formatDate(page.date),
    title: page.title,
    subtitle: page.subtitle,
  }));
  return [`--variable-json=pages:${JSON.stringify(list)}`];
}

// The search index, output/search.json, which the home page fetches when someone first types
// in the search box. Pages are newest first. Written with indentation, to stay readable.
async function writeSearchIndex(pages) {
  const index = pages.map((page) => ({
    url: page.url,
    date: page.date,
    dateText: formatDate(page.date),
    title: page.title,
    titleText: page.titleText,
    subtitle: page.subtitle,
    subtitleText: page.subtitleText,
    keywords: page.keywords,
  }));
  const file = path.join(outputDir, "search.json");
  await writeFile(file, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, file)}`);
}

// Newest first. Pages with the same date are ordered by title, then address, so that the order
// never depends on the order the files were found in.
function byNewest(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.titleText !== b.titleText) return a.titleText < b.titleText ? -1 : 1;
  return a.url < b.url ? -1 : 1;
}

process.on("uncaughtException", (error) => {
  if (!(error instanceof ContentError)) throw error;
  console.error(`error: ${error.message}`);
  process.exit(1);
});

const pageDirs = await findPageConfigs(contentDir);

// output/site/ belongs to the shared files, so no page may be written inside it.
for (const dir of pageDirs) {
  const rel = path.relative(contentDir, dir);
  if (rel.split(path.sep)[0] === "site") {
    throw new ContentError(`${path.join("content", rel, "index.json")}: content/site/ is reserved for shared files`);
  }
}

// Read and check every index.json before writing anything, so that a mistake in one leaves the
// output untouched.
const configs = [];
for (const dir of pageDirs) {
  configs.push({ dir, config: await readConfig(dir) });
}

// Replace rather than merge, so that files removed from build/site/ disappear from output.
await rm(siteOutDir, { recursive: true, force: true });
await cp(siteDir, siteOutDir, { recursive: true });
console.log(`copied ${path.relative(root, siteOutDir)}/`);

const summaries = [];
for (const { dir, config } of configs) {
  if (config.type !== "page") continue;
  await buildPage(dir, config);
  summaries.push(await summarisePage(dir, config));
}
const pages = summaries.sort(byNewest);

await writeSearchIndex(pages);

// The home page comes last, because it lists every other page.
for (const { dir, config } of configs) {
  if (config.type === "home") await buildPage(dir, config, homeListArgs(pages));
}
