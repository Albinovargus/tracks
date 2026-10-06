-- Shared helpers for the room scripts in art/tools/room; not run on its own.
-- Each script loads it with: local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
-- Optional global ROOM_OUT: the folder the scripts save to and preview.lua reads from
-- (default art/room/). Point it at a scratch folder to draw without touching the sources.
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local M = {}
M.ROOT = P.ROOT
M.GPL = P.PALETTE
M.ROOM = P.ROOM .. "/"
M.BODY = P.BODY
M.PREVIEWS = P.previews()
M.OUT = M.ROOM
if ROOM_OUT then
  M.OUT = (ROOM_OUT:gsub("\\", "/"):gsub("/+$", "")) .. "/"
  app.fs.makeAllDirectories(M.OUT)
end

-- Fixed colors are looked up by their art/palette.gpl name, so every pixel is
-- an exact palette color at alpha 255 (art.test.ts checks the exports).
local named, rgba = {}, false
local file = io.open(M.GPL, "r")
if not file then error("cannot open " .. M.GPL) end
for line in file:lines() do
  line = line:gsub("\r$", "")
  if line:match("^Channels:%s*RGBA") then rgba = true end
  local r, g, b, name
  if rgba then
    r, g, b, name = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)%s+%d+%s+(.-)%s*$")
  else
    r, g, b, name = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)%s+(.-)%s*$")
  end
  if r and name ~= "" then
    named[name] = app.pixelColor.rgba(tonumber(r), tonumber(g), tonumber(b), 255)
  end
end
file:close()

function M.C(name)
  local color = named[name]
  if color == nil then error("art/palette.gpl has no color named '" .. name .. "'") end
  return color
end

function M.rect(img, x, y, w, h, c)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do img:drawPixel(xx, yy, c) end
  end
end

function M.hline(img, x1, x2, y, c)
  for xx = x1, x2 do img:drawPixel(xx, y, c) end
end

function M.vline(img, x, y1, y2, c)
  for yy = y1, y2 do img:drawPixel(x, yy, c) end
end

-- Draws ASCII rows at (x0, y0): "." is transparent, any other character is
-- looked up in key (character -> palette.gpl color name).
function M.grid(img, x0, y0, rows, key)
  for y, row in ipairs(rows) do
    if #row ~= #rows[1] then
      error("grid row " .. y .. " has " .. #row .. " pixels, expected " .. #rows[1])
    end
    for x = 1, #row do
      local ch = row:sub(x, x)
      if ch ~= "." then
        local name = key[ch]
        if name == nil then error("grid has no color for '" .. ch .. "'") end
        img:drawPixel(x0 + x - 1, y0 + y - 1, M.C(name))
      end
    end
  end
end

-- An RGB sprite (never indexed) carrying art/palette.gpl, with one named layer.
function M.newSprite(w, h, layerName)
  local spr = Sprite(w, h, ColorMode.RGB)
  spr:setPalette(Palette{ fromFile = M.GPL })
  spr.layers[1].name = layerName
  return spr
end

-- Adds a slice (x, y, w, h), with an optional pivot (px, py) relative to the slice.
function M.slice(spr, name, x, y, w, h, px, py)
  local s = spr:newSlice(Rectangle(x, y, w, h))
  s.name = name
  if px then s.pivot = Point(px, py) end
  return s
end

-- Puts a single-frame image on layer 1, saves <M.OUT><id>.aseprite, closes.
function M.saveSingle(spr, img, id)
  spr:newCel(spr.layers[1], 1, img, Point(0, 0))
  spr:saveAs(M.OUT .. id .. ".aseprite")
  print("OK " .. id .. " " .. spr.width .. "x" .. spr.height)
  spr:close()
end

return M
