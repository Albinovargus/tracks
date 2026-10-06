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

-- The world (room world spec section 2): every place sprite is WORLD_H tall and draws
-- these shared rows with M.shell, so adjacent places join without a seam. Each
-- place is a dollhouse cutaway. Rows from the top:
--   0..47    sky (phones crop up to ~17 rows, landscape phones ~36)
--   48..71   roof: ridge, five shingle courses, eave
--   72..107  attic, with rafters every 10 px
--   108..119 attic floor, joists and the room's ceiling cornice
--   120..269 the room, at v1's proportions: a v1 room y maps to y + 120
--            (wall 120..203, baseboard 204..208). The floor runs from 209 to the
--            bottom: v1's 31 rows, then 30 more in front of the items, where the
--            place dots overlay sits, so nothing important goes there
M.WORLD_H = 270
M.ROOF_Y = 48 -- roof rows 48..71
M.ATTIC_Y = 72 -- attic rows 72..107
M.CEILING_Y = 108 -- attic floor, joists and cornice rows 108..119
M.WALL_Y = 120 -- wall rows 120..203
M.BASEBOARD_Y = 204 -- trim rows 204..207, dark wood row 208
M.FLOOR_Y = 209 -- floor rows 209..269
M.STAND_Y = 231 -- floor items stand with their bottom row here (v1's y 111 + 120)
M.SAFE_W = 110 -- slots and hotspots stay within each place's central 110 px

-- Calls fn(x) for every x in 0..w - 1 with x % 10 in offsets. Offsets must be
-- 1..8: the period divides every place width and every place x, so the pattern
-- runs on across each join, and columns 0 and w - 1 never get a pattern pixel.
local function every10(w, offsets, fn)
  for x0 = 0, w - 1, 10 do
    for _, off in ipairs(offsets) do
      if off < 1 or off > 8 then error("pattern offset " .. off .. " would touch an edge column") end
      fn(x0 + off)
    end
  end
end

-- Sky, roof, attic, ceiling, wall, baseboard and floor across a place w px
-- wide. Every row is one color across except patterns that keep off x % 10 = 0
-- and 9 (every10, and plank ends at x = 10 or 30 mod 40), so with w a multiple
-- of 10, columns 0 and w - 1 always match every other place's edge columns.
function M.shell(img, w)
  local C, rect, hline, vline = M.C, M.rect, M.hline, M.vline
  local function row(y, name) hline(img, 0, w - 1, y, C(name)) end
  local function band(y1, y2, name) rect(img, 0, y1, w, y2 - y1 + 1, C(name)) end

  -- Sky, lighter toward the roof. Clouds are drawn per place (M.cloud).
  band(0, 35, "glass")
  band(36, M.ROOF_Y - 1, "glass light")

  -- Roof: a ridge row, five 4-row shingle courses with staggered joints, the eave.
  local R = M.ROOF_Y
  row(R, "bronze shadow")
  for i = 0, 4 do
    local y = R + 1 + i * 4
    band(y, y + 2, "terracotta")
    row(y, "bronze light")
    row(y + 3, "bronze shadow")
    every10(w, { i % 2 == 0 and 3 or 8 }, function(x) vline(img, x, y + 1, y + 2, C("bronze shadow")) end)
  end
  band(R + 21, R + 22, "dark wood") -- fascia
  row(R + 23, "wood shadow")

  -- Attic: roof boards in shade, a shadow under the eave, rafters every 10 px
  -- (lit left edge, shaded right edge), and a purlin across them.
  local A = M.ATTIC_Y
  band(A, M.CEILING_Y - 1, "dark wood")
  band(A, A + 1, "wood shadow")
  every10(w, { 4 }, function(x)
    vline(img, x, A + 2, M.CEILING_Y - 1, C("wood light"))
    vline(img, x + 1, A + 2, M.CEILING_Y - 1, C("wood shadow"))
  end)
  row(A + 13, "wood light")
  row(A + 14, "wood light")
  row(A + 15, "wood shadow")

  -- Attic floor, the joists in cross-section, and the room's ceiling cornice.
  local F = M.CEILING_Y
  row(F, "wood light")
  row(F + 1, "dark wood")
  band(F + 2, F + 6, "wood shadow")
  every10(w, { 3, 4, 5 }, function(x) vline(img, x, F + 2, F + 6, C("dark wood")) end)
  every10(w, { 3 }, function(x) vline(img, x, F + 2, F + 6, C("wood light")) end)
  row(F + 7, "dark wood")
  band(F + 8, F + 10, "trim")
  every10(w, { 2, 3, 7, 8 }, function(x) img:drawPixel(x, F + 10, C("dark wood")) end)
  row(F + 11, "dark wood")

  -- Wall (v1: a shadow band under the ceiling and above the baseboard).
  band(M.WALL_Y, M.BASEBOARD_Y - 1, "wall")
  band(M.WALL_Y, M.WALL_Y + 1, "wall shadow")
  row(M.BASEBOARD_Y - 1, "wall shadow")

  -- Baseboard, then the floor down to the bottom: v1's planks (+ 120), continued.
  -- Plank ends sit at x = 10 or 30 (mod 40), never on an edge column.
  band(M.BASEBOARD_Y, M.BASEBOARD_Y + 3, "trim")
  row(M.BASEBOARD_Y + 4, "dark wood")
  band(M.FLOOR_Y, M.WORLD_H - 1, "floor")
  for _, y in ipairs({ 209, 216, 224, 232, 240, 247, 255, 262 }) do row(y, "floor lines") end
  for _, b in ipairs({
    { 210, 215, 30 }, { 217, 223, 10 }, { 225, 231, 30 }, { 233, 239, 10 },
    { 241, 246, 30 }, { 248, 254, 10 }, { 256, 261, 30 }, { 263, 269, 10 },
  }) do
    local x = b[3]
    while x < w - 1 do
      vline(img, x, b[1], b[2], C("floor lines"))
      x = x + 40
    end
  end
end

-- A small cloud with its top-left at (x, y): 14x6 (big) or 9x4. Places draw one
-- or two clouds in the sky (rows 0..35), never within 10 px of an edge column.
function M.cloud(img, x, y, big)
  local rows = big and {
    "....wwww......",
    "..wwwwwwww.ww.",
    ".wwwwwwwwwwwww",
    "wwwwwwwwwwwwww",
    "lllwwwwwwwwlll",
    ".llllllllllll.",
  } or {
    "...www...",
    ".wwwwwww.",
    "wwwwwwwww",
    ".lllllll.",
  }
  M.grid(img, x, y, rows, { w = "white", l = "glass light" })
end

-- A closed door on a place's back wall, for the doors at the world's two ends.
-- opts.knob = "left" | "right": the side facing the world's middle, where the knob
-- and keyhole go (the hinges take the other stile). opts.x (default 45): the left
-- casing column.
function M.door(img, opts)
  local C, rect, hline, vline = M.C, M.rect, M.hline, M.vline
  -- Closed door 30x64 at y 145..208 (x 45..74 by default): a head taller than the athlete,
  -- cut through the baseboard down to the floor line, with a threshold.
  -- A 2 px dark wood casing around a wood light slab with two inset panels. The
  -- light comes from the upper left, as on every place: the casing shades the
  -- slab's top and left edge and casts a wall shadow on the wall to its right.
  local dw, dh = 30, 64
  local dx, dy = opts.x or 45, M.FLOOR_Y - dh
  rect(img, dx, dy, dw, dh, C("dark wood"))
  rect(img, dx + 2, dy + 2, dw - 4, dh - 2, C("wood light"))
  hline(img, dx + 2, dx + dw - 3, dy + 2, C("dark wood"))
  vline(img, dx + 2, dy + 2, dy + dh - 1, C("dark wood"))
  vline(img, dx + dw, dy + 1, M.BASEBOARD_Y - 1, C("wall shadow"))
  vline(img, dx + dw, M.BASEBOARD_Y, M.BASEBOARD_Y + 3, C("wood light"))
  -- Threshold: a trim sill on the floor line, 1 px wider than the casing each
  -- side, lit on top, with a floor lines contact shadow in front of it.
  hline(img, dx - 1, dx + dw, M.FLOOR_Y, C("trim"))
  hline(img, dx - 1, dx + dw, M.FLOOR_Y + 1, C("wood light"))
  hline(img, dx, dx + dw + 1, M.FLOOR_Y + 2, C("floor lines"))

  -- Wood grain: broken dark wood streaks, running down the stiles and panels and
  -- across the rails (door-local x1, x2, y1, y2). They leave the knob rows clear.
  for _, g in ipairs({
    { 4, 4, 4, 16 }, { 4, 4, 20, 27 }, { 4, 4, 38, 61 },
    { 26, 26, 5, 24 }, { 26, 26, 38, 52 }, { 26, 26, 56, 62 },
    { 8, 16, 29, 29 }, { 12, 21, 32, 32 }, { 7, 18, 60, 60 }, { 10, 22, 4, 4 },
  }) do
    rect(img, dx + g[1], dy + g[3], g[2] - g[1] + 1, g[4] - g[3] + 1, C("dark wood"))
  end
  -- Panels: a wood shadow outline, shaded inside along the top and left, grain inside.
  for _, p in ipairs({ { 6, 6, 18, 22 }, { 6, 34, 18, 24 } }) do
    local px, py, pw, ph = dx + p[1], dy + p[2], p[3], p[4]
    hline(img, px, px + pw - 1, py, C("wood shadow"))
    hline(img, px, px + pw - 1, py + ph - 1, C("wood shadow"))
    vline(img, px, py, py + ph - 1, C("wood shadow"))
    vline(img, px + pw - 1, py, py + ph - 1, C("wood shadow"))
    hline(img, px + 1, px + pw - 2, py + 1, C("dark wood"))
    vline(img, px + 1, py + 1, py + ph - 2, C("dark wood"))
    vline(img, px + 6, py + 3, py + 9, C("dark wood"))
    vline(img, px + 6, py + 13, py + ph - 4, C("dark wood"))
    vline(img, px + 11, py + 4, py + 14, C("dark wood"))
    vline(img, px + 11, py + 18, py + ph - 3, C("dark wood"))
  end
  -- The gap under the door.
  hline(img, dx + 2, dx + dw - 3, dy + dh - 1, C("wood shadow"))

  -- Knob and keyhole on the side facing the world's middle; hinges on the other stile.
  local kx, hx
  if opts.knob == "right" then
    kx, hx = dx + dw - 6, dx + 2
  elseif opts.knob == "left" then
    kx, hx = dx + 4, dx + dw - 3
  else
    error("door: opts.knob must be \"left\" or \"right\", got " .. tostring(opts.knob))
  end
  local ky = dy + 30
  img:drawPixel(kx, ky, C("metal light"))
  img:drawPixel(kx + 1, ky, C("metal"))
  img:drawPixel(kx, ky + 1, C("metal"))
  img:drawPixel(kx + 1, ky + 1, C("metal shadow"))
  vline(img, kx, ky + 4, ky + 5, C("outline"))
  for _, hy in ipairs({ dy + 6, dy + 52 }) do
    img:drawPixel(hx, hy, C("metal light"))
    vline(img, hx, hy + 1, hy + 2, C("metal"))
    img:drawPixel(hx, hy + 3, C("metal shadow"))
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
