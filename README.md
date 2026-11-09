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
| `script` | No | A script, inlined at the end of the page. |
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
back. The build writes the search index to `output/search.json`, and the browser searches it
with [Fuse.js](https://www.fusejs.io). Without JavaScript, the search box is hidden and the list
still works.

## Writing in Word

- **Title and subtitle:** use Word's Title and Subtitle styles. They become the page title,
  and are shown in the list of pages on the home page.
- **Keywords:** add Tags in File > Info > Properties, separated by commas or semicolons. They
  are searched, but not shown.
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
| `build/summary.lua` | Pandoc writer that summarises a page (title, subtitle, keywords) for the home page and search |
| `build/site/` | Files shared by every page, copied to `output/site/`: `site.css`, `search.js`, the fonts and `vendor/` |
| `build/site/vendor/` | Third-party libraries, each in a folder named with its version, with its licence |
| `build/template.html` | The HTML template for pages |
| `build/home.html` | The HTML template for the home page |
| `build/head.html` | The `<head>` shared by both templates |
| `output/` | The generated site, committed and published |
| `.github/workflows/pages.yml` | The publishing workflow |

See [project-description.md](project-description.md) for the design and the plans for later
features.
