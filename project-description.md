# MixedJames project description for the benefit of Claude

This project is a personal blog with a strong focus on medical education that will allow content
authored as `.docx` files to converted to HTML, combined with custom JavaScript and stylesheets,
and displayed as a static site.

The look of the site will be optimised for reading on mobile but desktop display must also be
good.

We will use Tufte-adjacent principles accepting that Tufte originally designed for print.

Initially we will focus on display good static content. However, subsequently we will add
scroll-driven and scroll-triggered animations such as pinning.

This project will be hosted on GitHub pages.

The workflow will be as follows:

1. Content will be created by authors within the `./content` subdirectory
2. A local build step will transform the content into a static site within the `./output`  
   directory
3. Pushing content to the `main` branch on github inself will trigger published the actual
   pages site.

`./output` is committed to the repository. GitHub Pages can only serve a branch from `/` or
`/docs`, so a small GitHub Actions workflow publishes `./output` as-is. CI does not run the
build and needs neither Pandoc nor Node.

All generated links are relative so that the site works at any base path.

## Content

The directory structure within the `./content` is essentially arbitrary.

Content will be identified by an `index.json` within a subdirectory. This file will contain
configuration for the subdirectory and will identify it either as:
- The source for an output page (core v1 feature)
- A contents page which will display pages within subdirectories of that directory
  (later features)

Directories marked as source for an actual output page will contain:
- A mandatory .docx file which will provide the content of the page
- An optional .css stylesheet which will be inlined into the generated page
- An optional .js script which will be inlined into the generated page

The names are arbitrary as the local index.json will specify them. `index.json` is the glue
that ties the docx, css, js and output together:

```json
{
  "type": "page",
  "source": "article.docx",
  "style": "article.css",
  "script": "article.js",
  "output": "acid-base.html"
}
```

- `type`, `source` and `output` are mandatory; `style` and `script` are optional.
- `output` is a plain filename with no path separators. The page is written to the same relative
  path within `./output` as its directory has within `./content`.
- `content/index.json` defines the home page, so its `output` must be `index.html`.

The page title and subtitle come from the docx `Title` and `Subtitle` styles.

Pandoc will be used to convert `docx` to `html`. It will use the `docx+styles` option to
allow header styles to be used to address sections.

We will need to support:
- Standard Word formatting (bold, underline, italic, sub/superscript, strikethrough etc.)
- Styles
- Equations
- Tables
- Footnotes and endnotes
- Figure and table captions
- Embedded images in either SVG or PNG/JPEG/GIF format

Explicit colours are deliberately not supported, and Pandoc drops them silently. Authors should
use a named Word style instead and give it a colour in the page's stylesheet.

Footnotes and endnotes both render as sidenotes: in the margin on wide screens and
tap-to-expand on narrow ones.

Files shared by every page live in `build/site/` and are copied as-is to `output/site/`. Each
page links to the site-wide stylesheet (`site/site.css`) by a relative path, ahead of its own
inline stylesheet. The fonts are EB Garamond (primary) and Open Sans (paired sans-serif),
hosted locally in `site/fonts/` rather than loaded from Google.

Custom Word styles become CSS classes so that page stylesheets and scripts can address them.
Custom heading styles must be based on a built-in heading style.

Pandoc drops the "Figure 1" and "Table 1" labels from Word captions, so the build regenerates
them as real text, numbered in document order.

## Local build step

This process will take the user content in `./content` and generate the web page content in
`./output`.

It should use a `make`-like system - i.e. it should only build files that have changed.

The build system should operate in two modes:
1. Conventional mode - build in invoked manually
2. Watch mode - the tool observes the filesystem and rebuilds on changes

The build is a small Node script. A page is rebuilt when a hash of its inputs changes: its
docx, css, js and `index.json`, the shared template and filters, and the Pandoc version. Output
from pages that have been renamed or removed is deleted.

Word creates hidden temporary files while editing (`~$*`, `~WRL*.tmp`). These must not trigger
rebuilds and must not be committed. Watch mode therefore reacts only to `index.json` files and
the files they name, and `.gitignore` excludes the temporary files. `./output` must not be
ignored.

In the future it would be nice to support:
- Less or Sass
- Compiled scripts

Although these are not v1 features we should make passive provision where appropriate.