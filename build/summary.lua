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

local function html(inlines)
  local doc = pandoc.Pandoc { pandoc.Plain(inlines:walk(Styles)) }
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

local entities = { amp = "&", lt = "<", gt = ">", quot = '"', apos = "'" }

local function unescape_xml(text)
  return (text:gsub("&(#?x?)(%w+);", function(kind, name)
    if kind == "#" then
      return utf8.char(tonumber(name))
    elseif kind == "#x" then
      return utf8.char(tonumber(name, 16))
    end
    return entities[name]
  end))
end

-- Pandoc doesn't read the Tags property, so take it from docProps/core.xml in the docx.
-- Tags are separated by commas or semicolons.
local function keywords(file)
  local handle = assert(io.open(file, "rb"))
  local archive = pandoc.zip.Archive(handle:read("a"))
  handle:close()

  local list = pandoc.List {}
  for _, entry in ipairs(archive.entries) do
    if entry.path == "docProps/core.xml" then
      local tags = entry:contents():match("<cp:keywords>(.-)</cp:keywords>") or ""
      for tag in unescape_xml(tags):gmatch("[^,;]+") do
        tag = tag:match("^%s*(.-)%s*$")
        if tag ~= "" then
          list:insert(tag)
        end
      end
    end
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
