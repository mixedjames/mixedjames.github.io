# MixedJames

A personal blog focused on medical education, published at <https://mixedjames.github.io>.

Pages are written in Word. A local build converts each `.docx` to HTML with Pandoc and writes a
static site to `./output`, which is committed and published by GitHub Pages.

## Requirements

- [Pandoc](https://pandoc.org) 3.x
- [Node.js](https://nodejs.org) 20 or later

There are no npm dependencies, so there is nothing to install.

## Building

```sh
npm run build
```

This copies the shared files in `build/site/` to `output/site/` and rebuilds every page under
`./content` into `./output`. To preview the site, serve `./output` with a local web server,
such as VS Code's. Opening the HTML files directly doesn't work fully, because the home page
fetches its search index.

The build checks every `index.json` before it writes anything. A mistake, such as an unknown
field, a missing file or an invalid date, stops the build with a one-line error naming the file.

Don't edit anything in `./output` by hand: the next build overwrites it.

## Adding a page

Create a directory anywhere under `./content` and put an `index.json` in it:

```json
{
  "type": "page",
  "source": "article.docx",
  "style": "article.css",
  "script": "article.js",
  "output": "article.html",
  "date": "2026-11-05"
}
```

| Field | Required | Meaning |
|---|---|---|
| `type` | Yes | Must be `"page"`. |
| `source` | Yes | The Word document, relative to this directory. |
| `output` | Yes | The output filename. A plain filename, with no directories. |
| `style` | No | A stylesheet, inlined into the page. It comes after the link to the site stylesheet, so it can override it. |
| `script` | No | A script, inlined at the end of the page as a module, so it runs in strict mode. It runs after the `Page` runtime, which it can use. |
| `date` | No | The date the page was written, as `YYYY-MM-DD`. Pages are listed newest first. An undated page is listed last, and the build warns about it. |

The page is written to the same path within `./output` as its directory has within
`./content`. For example, `content/renal/acid-base/` becomes `output/renal/acid-base/`.
`content/site/` is reserved, because `output/site/` holds the shared files, and
`content/index.json` is reserved for the home page.

[`content/test/`](content/test/) is a working example.

## The home page

`content/index.json` defines the home page, which is written to `output/index.html`:

```json
{
  "type": "home",
  "source": "home.docx",
  "output": "index.html"
}
```

It takes `style` and `script` like a page, but not `date`. In `home.docx`, write the site's
title and subtitle in Word's Title and Subtitle styles, followed by a short description. These
form the title page. Below it, the build lists every page, newest first. Anything from the first
Heading 1 onwards in `home.docx` is not shown.

The home page has a search box, which searches every page's title, subtitle and keywords.
Typing in it switches the page to a search view; clearing it, or pressing Escape, switches
back. The query is kept in the address (`?q=acid`), so Back, Forward, reloading and shared
links all return to the same search. The build writes the search index to `output/search.json`, and the browser searches it
with [Fuse.js](https://www.fusejs.io). Without JavaScript, the search box is hidden and the list
still works.

## Writing in Word

- **Title and subtitle:** use Word's Title and Subtitle styles. They become the page title,
  and are shown in the list of pages on the home page.
- **Keywords:** add Tags in File > Info > Properties, separated by spaces, commas or
  semicolons. Each keyword is one word, so join words with a hyphen, as in `acid-base`.
  Keywords are searched, but not shown.
- **Title page:** the title, the subtitle and everything before the first Heading 1 form the
  title page, which fills at least one screen. A chevron hints that there is more below.
- **Headings:** use Heading 1, Heading 2 and so on.
- **Formatting:** bold, italic, underline, strikethrough, subscript and superscript all work.
- **Colours:** applying a colour directly in Word has no effect, because Pandoc drops it. Create
  a named style instead and colour it in the page's stylesheet.
- **Custom styles:** paragraph and character styles become CSS classes, so `My Key Point`
  becomes `.my-key-point`. A custom heading style must be based on a built-in heading style.
- **Footnotes and endnotes:** not supported yet. They are listed plainly at the end of the
  page, and the build warns. Sidenotes will be redesigned later.
- **Captions:** use Word's Insert Caption. Figures and tables are numbered automatically.
- **Images:** PNG, JPEG, GIF and SVG all work. Add alt text in Word, or the build warns.
- **Equations:** use Word's equation editor.

Word's temporary files (`~$*.docx`, `~WRL*.tmp`) are ignored by git.

## Page scripts

A page's script (the `script` field in `index.json`) can make parts of the lesson respond to
scrolling. It finds them by their Word style names, through the `Page` object. It never uses
CSS selectors or the page's HTML, which Pandoc generates and may change.

### Naming things in Word

- **Elements:** apply a custom paragraph, character or table style, such as `Key Point`.
  Everything in that style can be found by its name, so one style can mark several elements.
- **Sections:** apply a custom heading style, based on a built-in heading style, such as
  `Kidney Scene` based on Heading 1. The section is the heading and everything after it, up to
  the next heading of the same or a higher level.
- Names match exactly, including capitals and spaces. Two heading styles that differ only by
  spaces and hyphens, such as `Twin Scene` and `Twin-Scene`, can't be told apart, so neither
  can be found, and the build warns.
- Word's bookmarks don't work as names, because Pandoc drops them.

### Finding things

```js
Page.Element("Key Point")                          // every element in that style
Page.Section("Kidney Scene")                       // every section with that heading style
Page.Section("Kidney Scene").Element("Key Point")  // only those inside that section
Page.Element("Kidney Scene")                       // the heading itself
```

Each lookup returns a collection. A collection may be empty, but is never null, so a chain
always runs to the end. `length` gives the number of members. A lookup from `Page` that finds
nothing warns in the console and lists the style names on the page, since the name is probably
mistyped. A lookup inside a section that finds nothing stays quiet.

Actions apply to each member separately and return the same collection, so they can be
chained.

### Actions

| Action | What it does |
|---|---|
| `trigger.Log()` | Writes to the console as the reader enters and leaves the trigger's range, which way they were scrolling, and their progress in tenths. |
| `collection.Log({ start, end })` | The same, with a trigger for each member. |

`Pin()` is next. Pinned elements will always sit over the page, and never push later content
down.

### Triggers

A trigger is a stretch of scrolling, with a start and an end. Each end pairs an edge of an
anchor element (`e`) with a line across the viewport (`v`), in either order. The two ends can
be on different elements, however far apart:

```js
const scene = Page.Trigger({
  start: { anchor: Page.Element("Kidney Diagram"), edges: "etop vtop" },
  end: { anchor: Page.Section("Kidney Scene"), edges: "ebottom vbottom" },
});
scene.Log();
```

This trigger starts when the diagram's top reaches the top of the viewport, and ends when the
scene's bottom reaches the bottom. Edges and lines are `top`, `center`, `bottom` or a
percentage, such as `e25%` or `v80%`. Without `edges`, the start is `"etop vcenter"` and the end
`"ebottom vcenter"`: while the middle of the viewport is over the anchor.

An anchor must be a lookup that found exactly one element. If it found nothing or several, or
the anchor is missing, the console shows an error, and the trigger never fires, though the rest
of the script still runs. When a style marks several elements, narrow the lookup with
`Section()`, as in `Page.Section("Kidney Scene").Element("Key Point")`.

Actions on a collection take the same shape, but the anchor is optional and defaults to each
member, which gets a trigger of its own. A string is short for `{ edges: ... }`:

```js
// Each Key Point, from its top reaching the bottom of the viewport to its bottom passing the top.
Page.Element("Key Point").Log({ start: "etop vbottom", end: "ebottom vtop" });

// Each Key Point, from its own top until the summary reaches the middle of the viewport.
Page.Element("Key Point").Log({
  start: "etop vbottom",
  end: { anchor: Page.Element("Summary"), edges: "etop vcenter" },
});
```

Progress runs from 0 at the start to 1 at the end. Jumping straight past a range, by a link or
a fast flick, still reports enter, progress and leave, in that order. A trigger that ends where
it starts, or before, is a single point, and the console warns. Ends on elements less than a
screen apart can run backwards on a phone but not on a desktop.

On phones, viewport lines are measured against the full height of the screen, with the
address bar hidden, and aren't measured again when the bar shows or hides. That keeps triggers
from moving while the reader scrolls. While the bar is showing, `vtop` is still exact, but
`vcenter` is about half the bar's height below the visible centre, and `vbottom` is about one
bar height below the visible bottom, just off screen. Where an exact line matters, prefer
`vtop` or a percentage near the top.

Triggers near the end of a page may never start or finish, because the page can't scroll far
enough. The console says so. It depends on the screen size, so check at phone and desktop
widths.

### Checking

- Open the browser's console to see `Log()` and any warnings or errors, all marked `[Page]`.
- Add `?scrolldebug` to the address to mark the start and end of every trigger on the page.
  Messages and markers name a trigger made with `Page.Trigger` by number, as in `Trigger #1`,
  and a collection's triggers by member, as in `Key Point #2`.
- A mistake in edges or an option is reported, and the default is used. A trigger with a bad
  anchor is reported and never fires. Either way, the rest of the script still runs.

### Rules for scripts

- The script is an ES module, so it runs in strict mode and its variables stay local to it.
- Use only `Page` and the collections it returns. The runtime uses GSAP internally, but GSAP
  isn't available to page scripts, so it can change without breaking lessons.

## Writing code

Code that we write or generate stays readable by people: no minified scripts or stylesheets,
and JSON written with indentation and a fixed key order. Third-party libraries in
`build/site/vendor/` are the exception and are copied as their authors ship them.

## Publishing

Commit the changes to `./content` together with the regenerated `./output`, then push to `main`.
A GitHub Actions workflow publishes `./output` as it is. It does not run the build, so always
build before committing.

## Repository layout

| Path | Contents |
|---|---|
| `content/` | Page sources: Word documents, `index.json` files, page CSS and JS |
| `build/build.mjs` | The build script |
| `build/word.lua` | Pandoc filter that turns Word's output into clean HTML |
| `build/docx.lua` | Helpers for reading parts of the docx that Pandoc doesn't pass on |
| `build/summary.lua` | Pandoc writer that summarises a page (title, subtitle, keywords) for the home page and search |
| `build/site/` | Files shared by every page, copied to `output/site/`: `site.css`, `search.js`, `scroll.js` (the `Page` runtime for page scripts), the fonts and `vendor/` |
| `build/site/vendor/` | Third-party libraries, each in a folder named with its version, with its licence |
| `build/template.html` | The HTML template for pages |
| `build/home.html` | The HTML template for the home page |
| `build/head.html` | The `<head>` shared by both templates |
| `output/` | The generated site, committed and published |
| `.github/workflows/pages.yml` | The publishing workflow |

See [project-description.md](project-description.md) for the design and the plans for later
features.
