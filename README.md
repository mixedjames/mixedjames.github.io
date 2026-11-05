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
`./content` into `./output`. Open the generated HTML files directly in a browser to preview
them.

Don't edit anything in `./output` by hand: the next build overwrites it.

## Adding a page

Create a directory anywhere under `./content` and put an `index.json` in it:

```json
{
  "type": "page",
  "source": "article.docx",
  "style": "article.css",
  "script": "article.js",
  "output": "article.html"
}
```

| Field | Required | Meaning |
|---|---|---|
| `type` | Yes | Must be `"page"`. |
| `source` | Yes | The Word document, relative to this directory. |
| `output` | Yes | The output filename. A plain filename, with no directories. |
| `style` | No | A stylesheet, inlined into the page. It comes after the link to the site stylesheet, so it can override it. |
| `script` | No | A script, inlined at the end of the page. |

The page is written to the same path within `./output` as its directory has within
`./content`. For example, `content/renal/acid-base/` becomes `output/renal/acid-base/`.
`content/site/` is reserved, because `output/site/` holds the shared files.

[`content/test/`](content/test/) is a working example.

## Writing in Word

- **Title and subtitle:** use Word's Title and Subtitle styles. They become the page title.
- **Title page:** the title, the subtitle and everything before the first Heading 1 form the
  title page, which fills at least one screen. A chevron hints that there is more below.
- **Headings:** use Heading 1, Heading 2 and so on.
- **Formatting:** bold, italic, underline, strikethrough, subscript and superscript all work.
- **Colours:** applying a colour directly in Word has no effect, because Pandoc drops it. Create
  a named style instead and colour it in the page's stylesheet.
- **Custom styles:** paragraph and character styles become CSS classes, so `My Key Point`
  becomes `.my-key-point`. A custom heading style must be based on a built-in heading style.
- **Footnotes and endnotes:** both become sidenotes, shown in the margin on wide screens and
  tap-to-expand on phones.
- **Captions:** use Word's Insert Caption. Figures and tables are numbered automatically.
- **Images:** PNG, JPEG, GIF and SVG all work. Add alt text in Word, or the build warns.
- **Equations:** use Word's equation editor.

Word's temporary files (`~$*.docx`, `~WRL*.tmp`) are ignored by git.

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
| `build/site/` | Files shared by every page, copied to `output/site/`: `site.css` and the fonts |
| `build/template.html` | The HTML page template |
| `output/` | The generated site, committed and published |
| `.github/workflows/pages.yml` | The publishing workflow |

See [project-description.md](project-description.md) for the design and the plans for later
features.
