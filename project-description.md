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
- An optional .js script which will be inlined into the generated page, as a module

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

- `type`, `source` and `output` are mandatory; `style`, `script` and `date` are optional.
- `date` is the date the page was written, as `YYYY-MM-DD`. Word's own created date isn't
  used, because Pandoc doesn't read it and Save As carries it over. An undated page is given
  the date `0000-01-01`, so it sorts last, and the build warns.
- Unknown fields, missing files and invalid values stop the build before it writes anything.
- `output` is a plain filename with no path separators. The page is written to the same relative
  path within `./output` as its directory has within `./content`.
- `content/index.json` defines the home page, so its `type` must be `"home"` and its `output`
  must be `index.html`. It takes `source`, `style` and `script` like a page, but no `date`.

## Home page

The home page is written in Word as `home.docx`. Its title, subtitle and description form a
title page, as on any other page, with a search box below them. Below the title page is a list
of every page, newest first, showing each one's title, subtitle and date.

Search runs in the browser using [Fuse.js](https://www.fusejs.io). It covers each page's
title, subtitle and keywords, but not its body text or headings. Keywords come from the docx's
Tags property (File > Info > Properties in Word). The build writes them, with the titles,
subtitles and dates, to a separate search index, `output/search.json`, which the home page
fetches the first time someone types. Each word of a query must match somewhere in a page, but
different words may match different fields. Fuse.js is vendored, at a pinned version, in
`build/site/vendor/`. The site must therefore be previewed through a web server, not by opening the files
directly.

Typing in the search box switches the home page to a search view; focusing it alone does not,
because focus is easy to trigger by accident. Clearing the box returns to the home page.

The query is kept in the address as `?q=`, so Back and Forward move between the home view and
searches, and a search can be reloaded or shared. Starting a search adds one history entry, and
further typing updates it.

Word's Tags are split on spaces, commas and semicolons, so each keyword is a single word.

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

Footnotes and endnotes are not supported yet. They are listed plainly at the end of the page,
and the build warns. The earlier sidenotes, in the margin on wide screens and tap-to-expand on
phones, were removed in November 2026 because reserving the margin pushed the text column off
centre. They will be redesigned later.

Files shared by every page live in `build/site/` and are copied as-is to `output/site/`. Each
page links to the site-wide stylesheet (`site/site.css`) by a relative path, ahead of its own
inline stylesheet. The fonts are EB Garamond (primary) and Open Sans (paired sans-serif),
hosted locally in `site/fonts/` rather than loaded from Google.

Custom Word styles become CSS classes so that page stylesheets can address them. Custom
heading styles must be based on a built-in heading style.

## Page scripts

Scroll-triggered behaviour is written in each page's own script, using a small interface,
`Page`, provided by the site. The README describes it for authors.

Authors can't control the HTML that Pandoc generates, so scripts never use CSS selectors or
the page's structure. They find parts of a lesson by the Word style names the author applied:
`Page.Element("Key Point")` for paragraph, character and table styles, and
`Page.Section("Kidney Scene")` for the section that begins with a heading in a custom heading
style. The build records each element's exact style name in the HTML for the runtime to read.

Lookups return collections, which may be empty but are never null, and actions on a collection
apply to each member.

Actions that follow scrolling use a trigger: a range with a start and an end, each written as an
anchor element and its edges, such as `{ anchor: Page.Element("Kidney Diagram"), edges: "etop
vbottom" }`, where `e` is an edge of the anchor and `v` a line across the viewport. The two ends
can be on different elements. `Page.Trigger({ start, end })` makes one. An anchor must be exactly
one element; anything else is reported as an error and gives a trigger that never fires, so the
rest of the script still runs. Actions on a collection take the same shape, with each member as
the default anchor.

The runtime uses GSAP and its ScrollTrigger plugin, vendored at a pinned version. GSAP stays
private to the runtime, so lessons depend only on `Page` and the library can be upgraded or
replaced. Page scripts run as ES modules, after the runtime.

The first action, `Log()`, writes progress through a trigger's range to the console. Pinning
comes next. Pinned elements will always be overlaid on the page and never push later content
down.

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

## Readable output

Code that we write, and everything the build generates, stays readable by people: no
minification, and JSON written with indentation and a fixed key order. Third-party libraries,
such as Fuse.js and GSAP, are the exception and are vendored as their authors ship them.