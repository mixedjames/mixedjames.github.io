-- Turns the Word-flavoured AST from Pandoc's docx+styles reader into the markup our
-- CSS expects: custom styles become classes and Word's page layout is thrown away.
--
-- Each styled element also keeps its exact Word style name in data-word-style. Page scripts
-- find elements by that name through the Page runtime, never through classes or structure.

local here = PANDOC_SCRIPT_FILE:match("^(.*[/\\])") or ""
local docx = dofile(here .. "docx.lua")

-- Styles Word applies by default, which carry no meaning for the page. Lower case.
local noise = {}
for _, name in ipairs {
  "normal", "body text", "first paragraph", "compact", "list paragraph",
  "caption", "image caption", "table caption", "captioned figure",
  "footnote text", "endnote text", "footnote reference", "endnote reference",
  "hyperlink", "table", "tablegrid", "table grid",
} do
  noise[name] = true
end

local function slug(name)
  return (name:lower():gsub("[^%w]+", "-"):gsub("^-", ""):gsub("-$", ""))
end

-- Replaces a custom-style attribute with a class and the exact style name.
local function apply_style(el)
  local style = el.attributes["custom-style"]
  el.attributes["custom-style"] = nil
  if not style or noise[style:lower()] then
    return
  end
  el.classes:insert(slug(style))
  el.attributes["data-word-style"] = style
end

-- Pandoc gives a custom heading style as a class, with spaces turned into hyphens, so
-- "Kidney Scene" arrives as "Kidney-Scene". The exact names come from the docx's style list.
-- Styles that differ only by spaces and hyphens, such as "Twin Scene" and "Twin-Scene", arrive
-- as the same class, so they can't be told apart and get no name.
local heading_styles

local function read_heading_styles()
  local names = {}
  local xml = docx.part(PANDOC_STATE.input_files[1], "word/styles.xml") or ""
  for style in xml:gmatch("<w:style%s.-</w:style>") do
    local name = style:match('<w:name w:val="([^"]*)"')
    if name and style:match('^<w:style%s[^>]*w:type="paragraph"') then
      name = docx.unescape_xml(name)
      local class = name:gsub("%s", "-")
      names[class] = names[class] or pandoc.List {}
      names[class]:insert(name)
    end
  end
  return names
end

local warned = {}

local function heading_style(class)
  heading_styles = heading_styles or read_heading_styles()
  local names = heading_styles[class]
  if not names then
    return nil
  elseif #names > 1 then
    if not warned[class] then
      warned[class] = true
      io.stderr:write("[WARNING] Heading styles can't be told apart, so scripts can't find them: \""
        .. table.concat(names, "\", \"") .. "\"\n")
    end
    return nil
  end
  return names[1]
end

local function has_attr(el)
  return el.identifier ~= "" or #el.classes > 0 or #el.attributes > 0
end

local Styles = {}

function Styles.Div(el)
  apply_style(el)
  return has_attr(el) and el or el.content
end

function Styles.Span(el)
  apply_style(el)
  return has_attr(el) and el or el.content
end

function Styles.Figure(el)
  apply_style(el)
  return el
end

function Styles.Table(el)
  apply_style(el)
  for _, spec in ipairs(el.colspecs) do
    spec[2] = nil
  end
  return el
end

function Styles.Header(el)
  for _, class in ipairs(el.classes) do
    el.attributes["data-word-style"] = heading_style(class)
  end
  el.classes = el.classes:map(slug)
  return el
end

function Styles.Image(el)
  el.attributes.width = nil
  el.attributes.height = nil
  if #el.caption == 0 then
    io.stderr:write("[WARNING] Image has no alt text: " .. el.src .. "\n")
  end
  return el
end

local function drop_leading_space(inlines)
  while inlines[1] and inlines[1].t == "Space" do
    inlines:remove(1)
  end
end

-- Footnotes and endnotes aren't supported yet: they are left as Pandoc's plain notes, listed at
-- the end of the page, and the build warns. Sidenotes were removed in November 2026, to be
-- redesigned later; the old version is in git history (commit 36eacb8).
local notes = 0

local Notes = {}

function Notes.Note(el)
  notes = notes + 1
  -- Removing Word's note marker leaves a stray space at the start of the note.
  local first = el.content[1]
  if first and first.content then
    drop_leading_space(first.content)
  end
  return el
end

function Notes.Pandoc(doc)
  if notes > 0 then
    io.stderr:write(string.format(
      "[WARNING] %d footnote(s) or endnote(s): not supported yet, so listed plainly at the end\n",
      notes
    ))
  end
end

-- Pandoc removes Word's "Figure 1" label, but keeps any separator typed after it.
local function drop_leading_separator(inlines)
  drop_leading_space(inlines)
  local first = inlines[1]
  if first and first.t == "Str" then
    first.text = first.text:gsub("^[%-%.:]+", ""):gsub("^\u{2013}", ""):gsub("^\u{2014}", "")
    if first.text == "" then
      inlines:remove(1)
    end
  end
  drop_leading_space(inlines)
end

-- Each kind of caption is numbered separately, in document order.
local function numbered_caption(name, number, caption)
  local first = caption.long[1]
  if not first or not first.content then
    return false
  end
  drop_leading_separator(first.content)
  first.content:insert(1, pandoc.Space())
  first.content:insert(1, pandoc.Span(
    { pandoc.Str(name), pandoc.Space(), pandoc.Str(number .. ".") },
    { class = "caption-label" }
  ))
  return true
end

local figures, tables = 0, 0

local Blocks = {}

function Blocks.Figure(el)
  if #el.caption.long > 0 then
    figures = figures + 1
    numbered_caption("Figure", figures, el.caption)
  end
  return el
end

-- Wide tables and equations scroll within their wrapper rather than widening the page.
function Blocks.Table(el)
  if #el.caption.long > 0 then
    tables = tables + 1
    numbered_caption("Table", tables, el.caption)
  end
  return pandoc.Div({ el }, { class = "table-scroll" })
end

function Blocks.Para(el)
  local has_math = false
  for _, inline in ipairs(el.content) do
    if inline.t == "Math" and inline.mathtype == "DisplayMath" then
      has_math = true
    elseif inline.t ~= "Space" and inline.t ~= "SoftBreak" then
      return nil
    end
  end
  if has_math then
    return pandoc.Div({ el }, { class = "equation-scroll" })
  end
end

local TitlePage = {}

-- Everything before the first top-level heading belongs on the title page. It moves into
-- the "titlepage" metadata field, which the template places alongside the title and
-- subtitle. "more" tells the template whether anything follows, for the scroll cue.
--
-- Word's Heading 1 is still level 1 here: --shift-heading-level-by is applied later,
-- when the HTML is written. This pass runs last, so captions are already numbered.
function TitlePage.Pandoc(doc)
  if not doc.meta.title then
    io.stderr:write("[WARNING] No Title: use Word's Title style for the page title\n")
  end

  local intro = pandoc.Blocks {}
  while doc.blocks[1] and not (doc.blocks[1].t == "Header" and doc.blocks[1].level == 1) do
    intro:insert(doc.blocks:remove(1))
  end

  if #intro > 0 then
    doc.meta.titlepage = pandoc.MetaBlocks(intro)
  end
  doc.meta.more = #doc.blocks > 0
  return doc
end

return { Styles, Notes, Blocks, TitlePage }
