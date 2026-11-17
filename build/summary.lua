-- A Pandoc custom writer that summarises a page for the home page and search, as JSON:
--
--   title, subtitle            HTML, with Word styles as classes, as on the page itself
--   titleText, subtitleText    plain text, for search and for the browser
--   keywords                   the docx Tags property (File > Info > Properties in Word)
--
-- Missing values are empty strings or an empty list. Run it as:
--   pandoc page.docx --from=docx+styles --to=build/summary.lua

-- Reuse the filter's Styles pass, so that styled text in a title matches the page.
local here = PANDOC_SCRIPT_FILE:match("^(.*[/\\])") or ""
local Styles = dofile(here .. "word.lua")[1]
local docx = dofile(here .. "docx.lua")

-- Styles also records each Word style's exact name for the page's scripts. The home page
-- list and search.json don't need it.
local Unname = {
  Span = function(el)
    el.attributes["data-word-style"] = nil
    return el
  end,
}

local function html(inlines)
  local doc = pandoc.Pandoc { pandoc.Plain(inlines:walk(Styles):walk(Unname)) }
  return (pandoc.write(doc, "html5", { wrap_text = "none" }):gsub("%s+$", ""))
end

-- Turns a metadata field into { html, text }. Absent fields become empty strings.
local function field(value)
  if not value then
    return "", ""
  end
  local inlines = pandoc.utils.type(value) == "Inlines" and value
    or pandoc.utils.blocks_to_inlines(value)
  return html(inlines), pandoc.utils.stringify(inlines)
end

-- Pandoc doesn't read the Tags property, so take it from docProps/core.xml in the docx.
-- Tags are separated by spaces, commas or semicolons, so each keyword is a single word.
local function keywords(file)
  local core = docx.part(file, "docProps/core.xml") or ""
  local tags = core:match("<cp:keywords>(.-)</cp:keywords>") or ""
  local list = pandoc.List {}
  for tag in docx.unescape_xml(tags):gmatch("[^,;%s]+") do
    list:insert(tag)
  end
  return list
end

function Writer(doc, opts)
  local title, titleText = field(doc.meta.title)
  local subtitle, subtitleText = field(doc.meta.subtitle)
  return pandoc.json.encode {
    title = title,
    titleText = titleText,
    subtitle = subtitle,
    subtitleText = subtitleText,
    keywords = keywords(PANDOC_STATE.input_files[1]),
  }
end
