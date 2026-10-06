-- Replaces layer LAYER's cel in frame FRAME with the grid ROWS, whose first
-- character lands on (OX, OY). Characters: "." transparent, "O" the body's
-- outline color, "L" "B" "S" the PH hair light/base/shadow. Every pixel must
-- land inside x 1..62, y 1..63: row 0 and columns 0 and 63 stay empty. SAVES the file.
-- ROWS = {} clears the cel.
-- Run: run_lua_script(filename = art/avatar/hair-<style>.aseprite,
--   script = 'ROOT = "<repo>"; LAYER = "hair"; FRAME = 8; OX = 26; OY = 14; ROWS = { ... }; dofile(ROOT .. "/art/tools/hair/paint.lua")').

if type(LAYER) ~= "string" or type(FRAME) ~= "number" or type(OX) ~= "number"
  or type(OY) ~= "number" or type(ROWS) ~= "table" then
  print("ERROR:set LAYER, FRAME, OX, OY and ROWS before dofile") return
end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if FRAME < 1 or FRAME > #spr.frames then print("ERROR:FRAME out of range") return end
if LAYER == "ref-body" then print("ERROR:never paint on ref-body") return end
local target, ref = nil, nil
for _, layer in ipairs(spr.layers) do
  if layer.name == LAYER then target = layer end
  if layer.name == "ref-body" then ref = layer end
end
if not target then print("ERROR:layer " .. LAYER .. " not found") return end
if not ref then print("ERROR:no ref-body layer") return end
local pc = app.pixelColor

-- The outline is the body's: the topmost opaque pixel of column 32 in ref-body frame 1.
local refCel = ref:cel(spr.frames[1])
if not refCel then print("ERROR:ref-body frame 1 is empty") return end
local refImg = Image(64, 64, ColorMode.RGB)
refImg:drawImage(refCel.image, refCel.position)
local outline = nil
for y = 0, 63 do
  local v = refImg:getPixel(32, y)
  if pc.rgbaA(v) == 255 then outline = v break end
end
if not outline then print("ERROR:no opaque pixel in column 32 of ref-body frame 1") return end
local outlineHex = string.format("#%02x%02x%02x", pc.rgbaR(outline), pc.rgbaG(outline), pc.rgbaB(outline))
local PLACEHOLDERS = { "#ff80ff", "#ff40ff", "#ff00ff", "#80ffff", "#40ffff", "#00ffff", "#ffff80", "#ffff40", "#ffff00" }
for _, hex in ipairs(PLACEHOLDERS) do
  if hex == outlineHex then print("ERROR:detected outline " .. outlineHex .. " is a placeholder") return end
end

local COLORS = {
  O = pc.rgba(pc.rgbaR(outline), pc.rgbaG(outline), pc.rgbaB(outline), 255),
  L = pc.rgba(0x80, 0xff, 0xff, 255),
  B = pc.rgba(0x40, 0xff, 0xff, 255),
  S = pc.rgba(0x00, 0xff, 0xff, 255),
}

local img = Image(64, 64, ColorMode.RGB)
local count, minX, minY, maxX, maxY = 0, 64, 64, -1, -1
for r, row in ipairs(ROWS) do
  for c = 1, #row do
    local ch = row:sub(c, c)
    if ch ~= "." then
      local color = COLORS[ch]
      if not color then print("ERROR:unknown char '" .. ch .. "' in row " .. r) return end
      local x, y = OX + c - 1, OY + r - 1
      if x < 1 or x > 62 or y < 1 or y > 63 then
        print(string.format("ERROR:pixel (%d,%d) is outside x 1..62, y 1..63", x, y)) return
      end
      img:drawPixel(x, y, color)
      count = count + 1
      if x < minX then minX = x end
      if y < minY then minY = y end
      if x > maxX then maxX = x end
      if y > maxY then maxY = y end
    end
  end
end

app.transaction(function()
  local old = target:cel(spr.frames[FRAME])
  if old then spr:deleteCel(old) end
  spr:newCel(target, spr.frames[FRAME], img, Point(0, 0))
end)
spr:saveAs(spr.filename)
if count == 0 then
  print(string.format("OK %s frame %d cleared (0 pixels), outline %s", LAYER, FRAME, outlineHex))
else
  print(string.format("OK %s frame %d: %d pixels, bounds x %d..%d y %d..%d, outline %s",
    LAYER, FRAME, count, minX, maxX, minY, maxY, outlineHex))
end
