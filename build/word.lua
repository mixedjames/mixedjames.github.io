-- Turns the Word-flavoured AST from Pandoc's docx+styles reader into the markup our
-- CSS expects: custom styles become classes and Word's page layout is thrown away.

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

-- Replaces a custom-style attribute with a class. Returns true if a class was added.
local function apply_style(el)
  local style = el.attributes["custom-style"]
  el.attributes["custom-style"] = nil
  if not style or noise[style:lower()] then
    return false
  end
  el.classes:insert(slug(style))
  return true
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

local notes = 0

local Notes = {}

-- Word footnotes and endnotes both become sidenotes. The checkbox lets them expand
-- on narrow screens without any JavaScript.
function Notes.Note(el)
  notes = notes + 1
  local id = "sn-" .. notes
  local body = pandoc.utils.blocks_to_inlines(el.content, { pandoc.LineBreak() })
  -- Removing Word's note marker leaves a stray space at the start of the note.
  drop_leading_space(body)
  return {
    pandoc.RawInline("html", string.format(
      '<input type="checkbox" id="%s" class="sidenote-toggle">'
        .. '<label for="%s" class="sidenote-number">%d</label>',
      id, id, notes
    )),
    pandoc.Span(body, { class = "sidenote" }),
  }
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

return { Styles, Notes, Blocks }
