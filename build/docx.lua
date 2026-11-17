-- Reads parts of a .docx that Pandoc doesn't pass on. Shared by word.lua and summary.lua:
--
--   local docx = dofile(here .. "docx.lua")
--   local xml = docx.part(PANDOC_STATE.input_files[1], "word/styles.xml")

local docx = {}

-- Returns the contents of one file inside the docx, or nil if it isn't there.
function docx.part(file, path)
  local handle = assert(io.open(file, "rb"))
  local archive = pandoc.zip.Archive(handle:read("a"))
  handle:close()

  for _, entry in ipairs(archive.entries) do
    if entry.path == path then
      return entry:contents()
    end
  end
  return nil
end

local entities = { amp = "&", lt = "<", gt = ">", quot = '"', apos = "'" }

-- Turns XML entities, such as &amp; and &#233;, back into characters.
function docx.unescape_xml(text)
  return (text:gsub("&(#?x?)(%w+);", function(kind, name)
    if kind == "#" then
      return utf8.char(tonumber(name))
    elseif kind == "#x" then
      return utf8.char(tonumber(name, 16))
    end
    return entities[name]
  end))
end

return docx
