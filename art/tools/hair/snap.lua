-- Preview (read-only on the source): composites ref-body + every other layer for
-- frames FRAMES (list), remaps PH skin -> tone-3 and PH hair -> dark-brown, and saves
-- a horizontal strip scaled by SCALE to OUT (default .superpowers/art-previews/hair-snap.png).
-- Optional CROP = { x, y, w, h }.
-- Run: run_lua_script(filename = art/avatar/hair-<style>.aseprite,
--   script = 'ROOT = "<repo>"; FRAMES = { 1, 7, 8 }; dofile(ROOT .. "/art/tools/hair/snap.lua")').

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local pc = app.pixelColor
local MAP = {
  [0xff80ff] = 0xe8b88e, [0xff40ff] = 0xd49a6a, [0xff00ff] = 0xb07a4e,
  [0x80ffff] = 0x7a5236, [0x40ffff] = 0x5a3a24, [0x00ffff] = 0x3e2716,
}
local frames = FRAMES or { 1 }
local scale = SCALE or 8
local ref
for _, l in ipairs(spr.layers) do if l.name == "ref-body" then ref = l end end
local order = { ref }
for _, l in ipairs(spr.layers) do if l.name ~= "ref-body" then order[#order + 1] = l end end
local CX, CY, CW, CH = 0, 0, 64, 64
if CROP then CX, CY, CW, CH = CROP[1], CROP[2], CROP[3], CROP[4] end
local out = Image(CW * #frames * scale, CH * scale, ColorMode.RGB)
out:clear(pc.rgba(0xd8, 0xe0, 0xe8, 255))
for i, fi in ipairs(frames) do
  local img = Image(64, 64, ColorMode.RGB)
  for _, l in ipairs(order) do
    local cel = l:cel(spr.frames[fi])
    if cel then img:drawImage(cel.image, cel.position) end
  end
  for y = CY, CY + CH - 1 do
    for x = CX, CX + CW - 1 do
      local v = img:getPixel(x, y)
      if pc.rgbaA(v) > 0 then
        local rgb = pc.rgbaR(v) * 65536 + pc.rgbaG(v) * 256 + pc.rgbaB(v)
        local m = MAP[rgb] or rgb
        local c = pc.rgba(m // 65536, (m // 256) % 256, m % 256, 255)
        local bx, by = (i - 1) * CW * scale + (x - CX) * scale, (y - CY) * scale
        for yy = 0, scale - 1 do
          for xx = 0, scale - 1 do out:drawPixel(bx + xx, by + yy, c) end
        end
      end
    end
  end
end
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local file = OUT or (P.previews() .. "/hair-snap.png")
out:saveAs(file)
print("OK " .. file)
