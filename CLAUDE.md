# CLAUDE.md

MixedJames is a personal medical-education site of short-form lessons. Lessons are written in
Word, converted by Pandoc into static HTML in `output/`, and published by GitHub Pages from
`mixedjames/mixedjames.github.io` (<https://mixedjames.github.io>).

Read [project-description.md](project-description.md) for the spec and [README.md](README.md)
for how the build is used. Keep both up to date when behaviour changes.

## How the user works

- Plan first, as numbered steps. Do one step at a time and wait for the go-ahead before each.
- The user manages git and drives every commit and push. Never commit or push. Reminders
  are welcome, for example uncommitted output after a build.
- Test against real files and report with evidence (measurements, screenshots), not
  assumptions.
- The user owns the visual design. Propose and show options; don't decide them silently.
- Keep the build readable to humans. Prefer structure in the template and CSS over clever
  build code.
- Everything we write or generate stays human-readable: no minification, and JSON written with
  indentation and a fixed key order. Vendored third-party libraries (`build/site/vendor/`) may
  be minified black boxes.

## Commands

```sh
npm run build   # copies build/site/ to output/site/ and rebuilds every page
```

Requires Pandoc 3.x (tested with 3.8.2.1) and Node 20 or later. There are no npm
dependencies; keep it that way. Repeat builds must give byte-identical output.

## Map

| Path | Role |
|---|---|
| `build/build.mjs` | Finds each `content/**/index.json`, runs Pandoc per page, copies `build/site/` to `output/site/`, passes the `siteroot` variable (such as `../`) to the template |
| `build/word.lua` | Pandoc filter, in passes: `Styles` (Word styles become classes, plus the exact style name in `data-word-style` for page scripts), `Notes` (counts notes and warns; they stay Pandoc's plain end-of-page notes), `Blocks` (caption numbers, scroll wrappers), `TitlePage` (moves the intro into the `titlepage` metadata field) |
| `build/docx.lua` | Helpers shared by both Lua files for reading parts of the docx that Pandoc doesn't pass on (Tags, style names) |
| `build/summary.lua` | Pandoc custom writer, run once more per page: title and subtitle as HTML and plain text, plus keywords from the docx Tags property via `pandoc.zip` |
| `build/template.html` | Page structure, including the title page and scroll cue |
| `build/home.html` | Home page structure: the same title page, then the list of pages from the `pages` variable |
| `build/head.html` | Pandoc partial holding the whole `<head>`, included by both templates as `$head()$` |
| `content/index.json`, `content/home.docx` | The home page. `home.docx` is a placeholder until the user writes it |
| `build/site/` | Shared files: `site.css`, `search.js` and self-hosted `fonts/` |
| `build/site/search.js` | Home page search: fetches `search.json` on first keystroke, toggles `main.searching`, fills results from the `#search-result` template, keeps the query in `?q=` |
| `build/site/vendor/fuse-7.5.0/` | Fuse.js 7.5.0 (`fuse.min.mjs`, Apache 2.0 `LICENSE`), from the npm package. To upgrade, add a new versioned folder and change the import in `search.js` |
| `content/test/` | Feature test page: formatting, styles, tables, images, notes |
| `content/non-inferiority-trials/` | A real lesson |
| `output/` | Generated and committed. Never edit by hand |

- The `master` branch holds the old 2019 Jekyll site. Never delete it.
- `content/site/` is reserved because `output/site/` holds the shared files. The build rejects it.
- `content/index.json` is reserved for the home page (`type: "home"`, `output: "index.html"`).
- `index.json` is validated in full before anything is written. Content mistakes throw
  `ContentError`, printed as one line; anything else is a bug and keeps its stack trace.
- Preview needs a local server (the user uses VS Code's), because the home page fetches
  `search.json`.

## Design decisions

These are agreed with the user:

- **Purpose:** short lessons, read mostly on phones. The design is Tufte-adjacent, not Tufte. It
  favours vertical space and a sense of separate pages over long, dense prose.
- **Colour:** dark only. Every colour is a token on `:root`. A light set under
  `:root[data-theme="light"]` is passive provision; nothing switches it on yet.
- **Fonts:** EB Garamond is the primary font. Open Sans is the paired sans-serif, used only for
  the subtitle so far. Both are self-hosted WOFF2 files in Latin, extended Latin and Greek
  subsets.
- **Size:** the base size is 22px (`137.5%`), because Garamond's lower-case letters are small.
  The text column is 33rem.
- **Title page:** the title, the subtitle and everything before the first Heading 1.
  - It fills at least one screen (`min-height: 100svh`, with `100vh` as the fallback).
  - Its content block is centred vertically, and the title and subtitle text is centred.
  - A static chevron sits in the bottom-right corner, only when content follows.
  - Only the title page is a separate screen for now. A marker Heading 1 style for later page
    breaks is under consideration.
- **Width:** `<main>` is full width. Its children are limited to the text column, which leaves
  room for full-width scenes later.
- **Column:** centred at every width, on every page.
- **Footnotes and endnotes:** unsupported for now. Sidenotes were removed because reserving
  the margin pushed the column off centre. Pandoc's plain end-of-page notes remain, and the
  build warns. The old sidenote filter and CSS are in commit `36eacb8`.
- **Home page:**
  - The title page holds the title, subtitle, description and a rounded search box with
    centred text. The box has a fill slightly lighter than the paper (`--field`).
  - The lessons list: up to 48em, entries are centred with short centred rules between them.
    Above 48em, entries are left-aligned between full-width rules.
  - Each entry shows an upright title, a muted Open Sans subtitle, and the date in small caps.
  - Typing switches to the search view: the title shrinks, and the description, scroll cue
    and list are hidden.
- **Scrollytelling** comes later; make only passive provision for it now. Never put
  `overflow: hidden` on an ancestor of content, because it breaks `position: sticky`.

These are still provisional, carried over from an earlier session and not yet reviewed with the
user:

- heading sizes and italics;
- captions;
- table rules;
- the white panel behind images;
- hyphenation below 30em.

Open issues:

- At 360px, "Acid–base balance" breaks after the en dash.
- Hyphenation is frequent on phones.

## Gotchas

- **Heading levels:** in the Lua filter, Word's Heading 1 is still level 1.
  `--shift-heading-level-by=1` is applied only when the HTML is written, which makes it `<h2>`.
  The docx Title is the only `<h1>`.
- **No Open Sans italic:** only upright Open Sans is hosted. Italic Open Sans would be a slanted
  fake.
- **Pandoc and Word:**
  - Pandoc drops explicit run colours, so authors use named styles instead.
  - It drops Word's "Figure 1" and "Table 1" labels, which is why the filter regenerates them.
  - Footnotes and endnotes arrive identical.
  - Title and Subtitle go to metadata.
  - Word's SVG wins over its PNG fallback.
- **`summary.lua` loads `word.lua`** and uses the first filter it returns as the `Styles`
  pass, so styled titles match the page. Keep `Styles` first in `word.lua`'s return list. It
  strips `data-word-style`, which only page scripts need. It splits Word's Tags on spaces,
  commas and semicolons.
- **Style names:** `data-word-style` holds the exact Word style name and is private to the
  scroll runtime; lesson scripts never see it. Pandoc passes paragraph and character style
  names exactly, but gives a custom heading style as a class with spaces turned into hyphens,
  so `word.lua` reads the real name from `word/styles.xml`. Heading styles differing only by
  spaces and hyphens can't be told apart; they get no name and the build warns.
  `--section-divs` copies a heading's style name onto its `<section>`. Word bookmarks can't
  name things: Pandoc's docx reader drops any bookmark nothing links to.
- **Home page list:** `build.mjs` passes it with `--variable-json=pages:…`, not
  `--metadata-file`, which would run every title through the Markdown reader. Template
  variables are inserted unescaped, so the build escapes `href` itself.
- **Template whitespace:** `$endfor$` swallows its newline only when alone on a line, and a
  partial's final newline is kept. That is why `head.html` holds `<head>` and `</head>` and has
  no final newline. Comment templates with `$--`, which leaves nothing in the output.
- **Search matching:** Fuse can't match one query's words across different fields, so
  `search.js` searches each word separately, keeps pages every word matched, and ranks by the
  average score. The weights, `ignoreFieldNorm`, `threshold` 0.4 and `cutoff` 0.5 were tuned on
  sample titles; retune them against real lessons. Test with `fuse.min.mjs` imported in Node.
- **Search history:** the address, not the search box, holds the query, because
  `autocomplete="off"` stops browsers restoring the box after Back. Starting a search pushes
  one entry, marked `startedHere`, and typing replaces it. Clearing calls `history.back()` for
  such an entry, so Back doesn't show the home view twice. A search that arrived by link is
  cleared with `replaceState` instead, because going back would leave the site.
- **Positioned elements in scroll wrappers:** an absolutely positioned element inside an
  `overflow-x: auto` wrapper escapes it unless the wrapper is positioned.
- **Word temporary files:** `~$*` and `~WRL*.tmp` are git-ignored and must never trigger builds.

## Testing

- Install Playwright in the session scratchpad, never in the repo, and use headless Chromium.
- Check widths 360, 390, 768 (the home list's 48em breakpoint), 1100, 1152 and 1440px.
- On every page, check:
  - the page doesn't scroll sideways (`scrollWidth` equals the viewport width);
  - the fonts loaded (`document.fonts`) rather than the fallbacks;
  - the screenshots look right when reviewed by eye.
- For edge cases, write Markdown, convert it to docx with Pandoc, then run it through the real
  template and filter with the same options as `build.mjs`.
- Headless Chromium can't show how `100svh` behaves on an iPhone, or how text renders on a real
  screen. Ask the user to check on a device.

## Roadmap

1. **Home page (in progress):** `home.docx` title page with a search box, then every page
   newest first. Search is Fuse.js over title, subtitle and keywords (the docx Tags property),
   using a separate `output/search.json`. Typing, not focus, switches to the search view.
2. **Incremental builds:**
   - Rebuild a page only when the hash of its inputs changes: the docx, CSS, JS,
     `index.json`, the template, the filter and the Pandoc version. `build/site/` is copied, not
     hashed per page.
   - Delete output from pages that have been removed or renamed.
   - Keep the cache in `.build-cache/`.
3. **Footnotes and endnotes:** redesign sidenotes, or another treatment, without moving the
   column off centre.
4. **Watch mode:**
   - React only to `index.json` files and the files they name.
   - Debounce, because Word saves by replacing the file.
   - Ideally add a local server that reloads the page.
5. **Later:** contents pages, then scroll-driven animation.
