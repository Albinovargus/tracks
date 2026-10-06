-- Prints frame FRAME as a 64x64 character grid: ref-body underneath, every
-- other layer on top (hidden or not). Digits and lowercase letters are body
-- pixels; uppercase letters are pixels on a hair layer. Read-only.
-- Run: run_lua_script(filename = art/avatar/hair-<style>.aseprite,
--   script = 'ROOT = "<repo>"; FRAME = 8; dofile(ROOT .. "/art/tools/hair/dump.lua")').

if type(FRAME) ~= "number" then print("ERROR:set FRAME before dofile") return end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if FRAME < 1 or FRAME > #spr.frames then print("ERROR:FRAME out of range") return end
local frame = spr.frames[FRAME]
local pc = app.pixelColor
local ref = nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
end
if not ref then print("ERROR:no ref-body layer") return end

local FIXED = {
  ["#ff80ff"] = "1", ["#ff40ff"] = "2", ["#ff00ff"] = "3",
  ["#ffff80"] = "4", ["#ffff40"] = "5", ["#ffff00"] = "6",
  ["#80ffff"] = "L", ["#40ffff"] = "B", ["#00ffff"] = "S",
}
local POOL = "acdefghijkmnopqrtuvwxyz"
local letters, order = {}, {}
local function letterFor(hex)
  if not letters[hex] then
    local n = #order + 1
    if n > #POOL then return "?" end
    letters[hex] = POOL:sub(n, n)
    order[n] = hex
  end
  return letters[hex]
end

local grid = {}
for y = 0, 63 do
  grid[y] = {}
  for x = 0, 63 do grid[y][x] = "." end
end

local function paintLayer(layer, isHair)
  local cel = layer:cel(frame)
  if not cel then return end
  local img, ox, oy = cel.image, cel.position.x, cel.position.y
  for py = 0, img.height - 1 do
    for px = 0, img.width - 1 do
      local v = img:getPixel(px, py)
      local x, y = px + ox, py + oy
      if pc.rgbaA(v) > 0 and x >= 0 and x < 64 and y >= 0 and y < 64 then
        local hex = string.format("#%02x%02x%02x", pc.rgbaR(v), pc.rgbaG(v), pc.rgbaB(v))
        local ch = FIXED[hex]
        if not ch then
          ch = letterFor(hex)
          if isHair then ch = ch:upper() end
        end
        if pc.rgbaA(v) < 255 then ch = "%" end
        grid[y][x] = ch
      end
    end
  end
end

paintLayer(ref, false)
for _, layer in ipairs(spr.layers) do
  if layer.name ~= "ref-body" and not layer.isGroup then paintLayer(layer, true) end
end

local tagNames = {}
for _, t in ipairs(spr.tags) do
  if FRAME >= t.fromFrame.frameNumber and FRAME <= t.toFrame.frameNumber then
    tagNames[#tagNames + 1] = t.name
  end
end
print(string.format("frame %d  duration %d ms  tag %s", FRAME,
  math.floor(frame.duration * 1000 + 0.5), table.concat(tagNames, ",")))
local tens, ones = {}, {}
for x = 0, 63 do
  tens[#tens + 1] = tostring(math.floor(x / 10))
  ones[#ones + 1] = tostring(x % 10)
end
print("    " .. table.concat(tens))
print("    " .. table.concat(ones))
for y = 0, 63 do
  local row = {}
  for x = 0, 63 do row[#row + 1] = grid[y][x] end
  print(string.format("%3d %s", y, table.concat(row)))
end
local legend = { ". transparent", "1 2 3 PH skin light/base/shadow", "L B S PH hair light/base/shadow",
  "4 5 6 PH cloth (must not appear)", "% partial alpha (must not appear)" }
for _, hex in ipairs(order) do
  legend[#legend + 1] = letters[hex] .. " = " .. hex .. " on ref-body, " .. letters[hex]:upper() .. " = same color on a hair layer"
end
print("legend: " .. table.concat(legend, " | "))
