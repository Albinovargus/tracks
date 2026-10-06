-- Shared helpers for the room scripts in art/tools/room; not run on its own.
-- Each script loads it with: local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
-- Optional global ROOM_OUT: the folder the scripts save to and world-preview.lua reads from
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

-- The world (room world spec §2): every place sprite is WORLD_H tall and draws
-- these shared rows with M.shell, so adjacent places join without a seam. A v1
-- room y maps to y + 150 here: the floor sits at the bottom of the world.
M.WORLD_H = 270
M.BASEBOARD_Y = 234 -- trim rows 234..237, dark wood row 238
M.FLOOR_Y = 239 -- floor rows 239..269
M.STAND_Y = 261 -- floor items stand with their bottom row here
M.SAFE_W = 110 -- slots and hotspots stay within each place's central 110 px
M.RAIL_Y = 154 -- chair rail rows 154..156 (trim, trim, dark wood); wainscot 157..233

-- Crown molding, wall, chair rail, wainscot, baseboard and floor across a place
-- w px wide. Every wall row is one color across, so place edges always match.
-- The molding is decoration only: phones crop up to ~17 rows off the top.
-- Plank ends sit at x = 10 or 30 (mod 40) by band, so with w a multiple of 10
-- columns 0 and w - 1 are always plain floor: every place's edge columns match.
function M.shell(img, w)
  local C = M.C
  M.rect(img, 0, 0, w, M.BASEBOARD_Y, C("wall"))
  -- Crown molding along the top.
  M.rect(img, 0, 0, w, 2, C("dark wood"))
  M.rect(img, 0, 2, w, 3, C("trim"))
  M.hline(img, 0, w - 1, 5, C("dark wood"))
  M.hline(img, 0, w - 1, 6, C("wall shadow"))
  -- Chair rail, then the darker wainscot down to the baseboard.
  M.rect(img, 0, M.RAIL_Y, w, 2, C("trim"))
  M.hline(img, 0, w - 1, M.RAIL_Y + 2, C("dark wood"))
  M.rect(img, 0, M.RAIL_Y + 3, w, M.BASEBOARD_Y - M.RAIL_Y - 3, C("wall shadow"))
  M.rect(img, 0, M.BASEBOARD_Y, w, 4, C("trim"))
  M.hline(img, 0, w - 1, M.BASEBOARD_Y + 4, C("dark wood"))
  M.rect(img, 0, M.FLOOR_Y, w, M.WORLD_H - M.FLOOR_Y, C("floor"))
  for _, y in ipairs({ 239, 246, 254, 262 }) do M.hline(img, 0, w - 1, y, C("floor lines")) end
  for _, band in ipairs({ { 240, 245, 30 }, { 247, 253, 10 }, { 255, 261, 30 }, { 263, 269, 10 } }) do
    local x = band[3]
    while x < w - 1 do
      M.vline(img, x, band[1], band[2], C("floor lines"))
      x = x + 40
    end
  end
end

-- A new place: an RGB sprite w x WORLD_H with layer "place", and its shell image.
-- Draw on img, add slices to spr, then M.saveSingle(spr, img, "place-<id>").
function M.newPlace(w)
  if w % 10 ~= 0 then error("place width " .. w .. " is not a multiple of 10") end
  local spr = M.newSprite(w, M.WORLD_H, "place")
  local img = Image(w, M.WORLD_H, ColorMode.RGB)
  M.shell(img, w)
  return spr, img
end

return M
