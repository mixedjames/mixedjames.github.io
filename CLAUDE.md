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
| `build/site/scroll.js` | The `Page` runtime for lesson scripts: `Page.Element(name)` and `Page.Section(name)` find parts of a lesson by exact Word style name and return collections (never null) with chainable actions. `Page.Trigger({ start, end })` makes a trigger whose ends are anchored on single elements. An ES module, loaded only on pages with a `script` (`pagescript` template variable), just before the page script, which is also a module. Everything but `Page` and collection methods is private, GSAP included |
| `build/site/vendor/fuse-7.5.0/` | Fuse.js 7.5.0 (`fuse.min.mjs`, Apache 2.0 `LICENSE`), from the npm package. To upgrade, add a new versioned folder and change the import in `search.js` |
| `build/site/vendor/gsap-3.15.1/` | GSAP 3.15.1 with ScrollTrigger: the five ES modules ScrollTrigger needs, copied unchanged from the npm package, plus `LICENSE.md` (GSAP's no-charge licence, terms at gsap.com). Imported only by `scroll.js`; never exposed to lesson scripts, because any public GSAP call becomes a compatibility burden. Use the ES modules, not `dist/`, whose builds put `gsap` and about 30 more names on `window`. To upgrade, add a new versioned folder and change the imports in `scroll.js` |
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
- **Scrollytelling:** driven by each page's own script, through the `Page` runtime.
  - **No structure in the public API:** scripts find things only by exact Word style name,
    never by CSS selector, class or Pandoc's markup. Collection members are the runtime's own
    objects, not DOM nodes.
  - **Lookups:** `Page.Element(name)` and `Page.Section(name)`, also chained from a collection.
    They return collections, jQuery-style: possibly empty, never null. Only empty lookups from
    `Page` warn.
  - **Methods are capitalised** (`Element`, `Section`, `Log`, `Pin`), as the user sketched them.
  - **Triggers:** scrolling behaviour hangs on a trigger, a range with a start and an end, each
    anchored on its own element: `Page.Trigger({ start: { anchor, edges }, end: { anchor,
    edges } })`. The name is `Trigger`, not `ScrollTrigger`, which is GSAP's.
    - **Edges:** `"etop vbottom"`. `e` is an anchor edge and `v` a viewport line, in either
      order: `top`, `center`, `bottom` or a percentage. The default is `etop vcenter` to
      `ebottom vcenter`. Bad edges are an error, and the default is used.
    - **Anchors** must be a lookup that found exactly one element. Anything else, or a missing
      anchor, is a `console.error`, and the trigger is inert: it accepts every action and
      never fires, so the script runs on. Null-free, but loud.
    - **Collection actions** take the same `{ start, end }` shape, with the anchor optional
      and defaulting to each member, so each member gets its own trigger. A string end is
      short for `{ edges }`.
    - **Distances** (such as "500px after the start") are deferred until a lesson needs them.
  - **Engine:** GSAP with ScrollTrigger, private to `scroll.js`. Never expose GSAP, because
    every public GSAP call becomes a compatibility burden.
  - **Pinning:** GSAP's own pinning for now. The user finds `position: sticky` unreliable. If
    GSAP's pinning ever jitters, the user's proven technique is: wrap the original in a
    wrapper that always keeps its place in the flow; move the element out at the start and
    end of the pinned range and hide it in between; show a clone, positioned in an overlay
    layer, during the range. Other animations then have to allow for the clone.
  - **Pins are overlay only** and never affect the content after them: no general-purpose
    pushing content down. Spacers may be considered later.
  - Never put `overflow: hidden` on an ancestor of content, because it breaks sticky and
    pinning.

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
- **Scroll ranges:** `scroll.js` turns edges such as `"etop vbottom"` into ScrollTrigger's
  `"top bottom"`, with the start anchor as `trigger` and the end anchor as `endTrigger`. Each
  action watches its trigger with its own ScrollTrigger, so `?scrolldebug` shows a trigger's
  markers once per action; warnings are kept once per trigger. It works out enter, progress and leave itself from `onUpdate`, rather than
  from ScrollTrigger's own enter/leave callbacks, which fire after `onUpdate`. That's what
  keeps the order right when a jump skips a whole range. ScrollTrigger turns a backwards range
  into a single point by setting its end 0.01px past its start, so the test is
  `end - start < 1`. Ranges near the end of a page may never start or finish, because the
  page can't scroll far enough; the runtime warns. Test sequences on a page long enough for
  every range to finish. Ends on elements less than a screen apart can run backwards on a
  phone but not on a desktop, so check edges at both.
- **Address bar on phones:** ScrollTrigger measures the viewport from a hidden `100vh` element
  (the tall viewport, with the bar hidden). On touch devices it ignores resizes caused by the
  bar (`ignoreMobileResize`), unless the height changes by more than 25%. So `v` lines sit
  lower than the visible area while the bar shows: `vtop` exact, `vcenter` about half a bar
  low, `vbottom` about a bar low. In `?scrolldebug`, the fixed viewport markers move as the
  bar shows and hides, but the element markers don't. Triggers still fire where the markers
  meet. The user chose this default for stability (November 2026). Re-measuring on each bar
  change would make pinned content jump, and `normalizeScroll` changes how scrolling feels.
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
- For `Page` scripts, collect the console messages and check each member's sequence:
  scrolling down and up in small steps, and jumping from the top to the bottom and back.
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
5. **Scrollytelling (in progress):**
   - Done: style names in the filter, the `Page` runtime, private GSAP, `Page.Trigger` with
     anchored ends, and `Log()`.
   - Next: `Pin()`, overlay only, taking a trigger, using GSAP's pinning (`pinSpacing: false`).
     Start with a prototype and demo the user can view on a phone. Watch for: GSAP's
     `pin-spacer` wrapper breaking the `main > *` column CSS when a section is pinned; GSAP
     releasing an overlay pin offset by the pin distance, leaving a gap and possibly overlapping
     later content; jitter on phones.
   - Checked on Android: ranges stay put as the address bar shows and hides (see the gotcha).
     iPhone is unchecked, because the user has no iPhone. It is expected to behave the same.
   - Open: ranges near the end of a page may never finish. Extra space at the end of the page
     is a possible fix, and a design decision for the user.
6. **Later:** contents pages.
