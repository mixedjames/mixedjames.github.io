import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const outputDir = path.join(root, "output");
const template = path.join(root, "build", "template.html");

async function findPageConfigs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = entries.some((e) => e.isFile() && e.name === "index.json") ? [dir] : [];
  for (const entry of entries) {
    if (entry.isDirectory()) found.push(...(await findPageConfigs(path.join(dir, entry.name))));
  }
  return found;
}

async function readConfig(dir) {
  const file = path.join(dir, "index.json");
  const config = JSON.parse(await readFile(file, "utf8"));
  for (const key of ["type", "source", "output"]) {
    if (!config[key]) throw new Error(`${file}: missing "${key}"`);
  }
  if (config.type !== "page") throw new Error(`${file}: unknown type "${config.type}"`);
  if (path.basename(config.output) !== config.output) {
    throw new Error(`${file}: "output" must be a plain filename`);
  }
  return config;
}

async function buildPage(dir) {
  const config = await readConfig(dir);
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
      `--template=${template}`,
      "--mathml",
      "--section-divs",
      "--wrap=none",
      "--extract-media=.",
      `--output=${config.output}`,
    ];

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
      await writeFile(file, `<script>\n${js.replaceAll("</script", "<\\/script")}</script>\n`);
      args.push(`--include-after-body=${file}`);
    }

    // Pandoc runs from the page's output directory so that media links are relative.
    const { stderr } = await run("pandoc", args, { cwd: outDir });
    if (stderr) process.stderr.write(stderr);
  } finally {
    await rm(includes, { recursive: true, force: true });
  }

  console.log(`built ${path.relative(root, path.join(outDir, config.output))}`);
}

for (const dir of await findPageConfigs(contentDir)) {
  await buildPage(dir);
}
