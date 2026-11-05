# Handoff

Status of the MixedJames build as of 5 November 2026, for the next working session. Read
[project-description.md](project-description.md) first for the spec and agreed decisions, and
[README.md](README.md) for how the build is used.

## How the user likes to work

- Plan first, then work one numbered step at a time, waiting for the go-ahead before each step.
- Don't commit unless asked. The user commits and pushes themselves.
- Test against real files and report findings with evidence, not assumptions.

## Where things stand

The repo is `mixedjames/mixedjames.github.io`, served at <https://mixedjames.github.io>. The old
2019 Jekyll site is preserved on the `master` branch, which must not be deleted. `main` is the
default branch and Pages deploys from GitHub Actions.

Steps 1 to 4 of the build order are done and committed (last commit `c98fb99`):

1. **Publishing:** `.gitignore`, a workflow that publishes the committed `output/` as-is, and a
   placeholder `output/index.html`. Verified live.
2. **Pipeline:** [build/build.mjs](build/build.mjs) finds each `index.json` under `content/`,
   runs Pandoc with [build/template.html](build/template.html), and inlines the page CSS and JS.
   No npm dependencies. Output is byte-identical across builds.
3. **Filter:** [build/word.lua](build/word.lua) turns styles into classes, removes Word's default
   styles, strips fixed image and table sizes, numbers captions, adds scroll wrappers and warns
   about missing alt text.
4. **Layout:** [build/site.css](build/site.css), inlined into every page before the page's CSS.
   Footnotes and endnotes become CSS-only sidenotes.

Uncommitted at handoff: the new README, this file, and the user's own edit to
`content/test/test.js` with its rebuilt `output/test/test.html`.

## Visual style needs revising

The user has said the visual choices in step 4 were made without them and need revisiting. Treat
all of these as provisional and ask before building on them:

- **Fonts:** system serif stack led by Charter, base size 112.5%.
- **Colour:** off-white paper (`#fffff8`), near-black ink, a muted grey for secondary text, and an
  automatic dark mode that follows the device setting.
- **Dark-mode images:** shown on a white panel so that dark artwork on a transparent background
  stays visible.
- **Measure and margin:** a 36rem text column, a 15rem sidenote margin and a 2rem gap. Margin
  notes start at 66em (1056px); below that it's a single column.
- **Headings:** regular weight; h3 and h4 italic. Word's Heading 1 is shifted to `<h2>` so the
  docx Title is the only `<h1>`.
- **Captions:** small and muted, as "Figure 1." and "Table 1.", in a `caption-label` span.
- **Tables:** top and bottom rules plus a rule under the header, with no vertical rules or
  shading, and a 5rem minimum cell width.
- **Sidenotes:** on phones, tapping the number expands the note in the middle of its sentence,
  with a left border. Notes inside tables are always tap-to-expand.
- **Other:** equations centred, images kept within the text column, links underlined in the text
  colour, and hyphenation on screens narrower than 30em.

## Next steps

5. **Validation and incremental builds:** validate `index.json` fully, rebuild only pages whose
   input hash changed, and delete output from renamed or removed pages. Cache state goes in
   `.build-cache/`, which is already git-ignored. The hash covers the docx, CSS, JS,
   `index.json`, the template, the filter, `site.css` and the Pandoc version. Add the home page
   via `content/index.json`, whose `output` must be `index.html`; until then the placeholder
   stays.
6. **Watch mode:** react only to `index.json` files and the files they name, so that Word's
   `~$*` and `~WRL*.tmp` files never trigger rebuilds. Debounce, because Word saves by
   replacing the file. Ideally add a local server that reloads the page.
7. **Later:** contents pages, then scroll-driven animation. Keep sections free of
   `overflow: hidden` on ancestors so `position: sticky` keeps working.

## Facts established by testing

These came from probing Pandoc 3.8.2.1 with real Word output (`content/test/test.docx`):

- Explicit run colours are dropped, even with `+styles`. This is why direct colours aren't
  supported.
- Word's SVG images are extracted as SVG and the PNG fallback is ignored.
- Title and Subtitle go to Pandoc metadata, not the body.
- A custom style based on Heading 1 becomes a class on the heading and its `<section>`.
- Pandoc drops Word's "Figure 1" and "Table 1" caption labels but keeps the separator typed
  after them, which is why the filter regenerates them.
- Footnotes and endnotes arrive as identical notes and can't be told apart without extra work.
- An absolutely positioned element inside an `overflow-x: auto` wrapper escapes it unless the
  wrapper is positioned. This widened the whole page on phones until fixed.
- Charter's non-breaking space is noticeably wider than a normal space.

## Not yet tested

- **Safari on iPhone,** the main reading target. Check MathML and the sidenote toggles.
- **Inline equations from real Word.** They worked in a Pandoc-generated docx, but `test.docx`
  has none.
- **Word cross-references** to figures and tables, and captions that don't use "Figure" or
  "Table".
- **Many sidenotes close together,** which will stack and drift from their references.

## Testing approach

Layout was checked with Playwright and headless Chromium at 360, 390, 768, 1100 and 1440px wide,
in light and dark mode. Checks: no sideways page scroll, sidenote positions, images within the
column, the page script running, and screenshots reviewed by eye. A 12-column table with notes
in its cells was injected into the page for the wide-table case.

The scripts lived in the previous session's scratchpad and are gone. Install Playwright in a
scratch directory, not in the repo.

## Outstanding for the user

- A GitHub token was in the remote URL and was printed during the session. The remote URL is now
  clean; confirm the token was revoked.
- `test.docx` has no alt text, so the build prints two warnings. This is expected.
- The old blog's post URLs now 404. Decide whether to migrate them, add redirects or let them go.
