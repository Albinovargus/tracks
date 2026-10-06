-- Prints each body frame as an ASCII map, cropped to the union bounding box
-- of all frames, with row numbers and a column ruler (absolute coordinates).
--   .  transparent      o  outline      l b d  skin light / base / shadow
--   *  any other color (eyes, mouth)
-- Read-only. Run: run_lua_script(script = 'ROOT = "<repo>"; GARMENT = "shoes-starter";
--   FRAMES = { 8, 9 }; dofile(ROOT .. "/art/tools/garments/map.lua")'). Use it to measure ops.
-- Optional globals set before dofile():
--   GARMENT = "<source basename>"  overlay that source's visible pixels in
--                                 capitals: L B D = cloth light/base/shadow,
--                                 O = garment outline
--   FRAMES = { 6, 7 }              only these frames (1-based)
local G = dofile(ROOT .. "/art/tools/garments/lib.lua")

local body = app.open(G.BODY)
if not body then print("ERROR: cannot open " .. G.BODY) return end
local outline = G.outlineColor(body)

local garment = nil
if GARMENT then
  garment = app.open(G.path(GARMENT))
  if not garment then print("ERROR: cannot open " .. G.path(GARMENT)) return end
  if #garment.frames ~= #body.frames then
    print("ERROR: " .. GARMENT .. " has " .. #garment.frames .. " frames, body has " .. #body.frames)
    return
  end
end

local frames = FRAMES
if frames then
  if type(frames) ~= "table" or #frames == 0 then print("ERROR: FRAMES must be a list such as { 6, 7 }") return end
  for _, f in ipairs(frames) do
    if math.type(f) ~= "integer" or f < 1 or f > #body.frames then
      print("ERROR: FRAMES entry " .. tostring(f) .. " is not a frame number 1-" .. #body.frames)
      return
    end
  end
else
  frames = {}
  for f = 1, #body.frames do frames[#frames + 1] = f end
end

local grids = {}
local x0, y0, x1, y1 = body.width, body.height, -1, -1
for f = 1, #body.frames do
  grids[f] = G.flatten(body, f)
  for y = 0, body.height - 1 do
    for x = 0, body.width - 1 do
      if grids[f].a[G.idx(grids[f], x, y)] > 0 then
        x0, y0 = math.min(x0, x), math.min(y0, y)
        x1, y1 = math.max(x1, x), math.max(y1, y)
      end
    end
  end
end
x0, y0 = math.max(0, x0 - 1), math.max(0, y0 - 1)
x1, y1 = math.min(body.width - 1, x1 + 1), math.min(body.height - 1, y1 + 1)

local SKIN_CH = { light = "l", base = "b", shadow = "d" }
local function ch(c)
  if c == outline then return "o" end
  local shade = G.skinShade(c)
  if shade then return SKIN_CH[shade] end
  return "*"
end
local function gch(c)
  if c == G.CLOTH.light then return "L" end
  if c == G.CLOTH.base then return "B" end
  if c == G.CLOTH.shadow then return "D" end
  if c == outline then return "O" end
  return "?"
end

local tens, ones = "    ", "    "
for x = x0, x1 do
  tens = tens .. tostring(math.floor(x / 10) % 10)
  ones = ones .. tostring(x % 10)
end

print("outline " .. G.hex(outline) .. "; columns " .. x0 .. "-" .. x1 .. ", rows " .. y0 .. "-" .. y1)
for _, f in ipairs(frames) do
  local b = grids[f]
  local g = garment and G.flatten(garment, f) or nil
  print("")
  print("frame " .. f .. " (" .. G.tagOf(body, f) .. ", " .. G.ms(body.frames[f]) .. " ms)" .. (GARMENT and (" + " .. GARMENT) or ""))
  print(tens)
  print(ones)
  for y = y0, y1 do
    local row = string.format("%3d ", y)
    for x = x0, x1 do
      local i = G.idx(b, x, y)
      if g and g.a[i] > 0 then
        row = row .. gch(g.c[i])
      elseif b.a[i] > 0 then
        row = row .. ch(b.c[i])
      else
        row = row .. "."
      end
    end
    print(row)
  end
end
