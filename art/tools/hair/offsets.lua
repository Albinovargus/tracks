-- For frames FIRST..LAST, finds the (dx, dy) in -3..3 that best maps the head
-- of reference frame REF (12 rows from its crown) onto that frame's ref-body.
-- 0 mismatches means the head only moved, so REF's hair can be reused shifted. Read-only.
-- Run: run_lua_script(filename = art/avatar/hair-<style>.aseprite,
--   script = 'ROOT = "<repo>"; REF = 8; FIRST = 9; LAST = 15; dofile(ROOT .. "/art/tools/hair/offsets.lua")').

if type(REF) ~= "number" or type(FIRST) ~= "number" or type(LAST) ~= "number" then
  print("ERROR:set REF, FIRST and LAST before dofile") return
end
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if REF < 1 or REF > #spr.frames or FIRST < 1 or LAST > #spr.frames or FIRST > LAST then
  print("ERROR:frame numbers out of range") return
end
local ref = nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
end
if not ref then print("ERROR:no ref-body layer") return end
local pc = app.pixelColor

local function frameImage(i)
  local img = Image(64, 64, ColorMode.RGB)
  local cel = ref:cel(spr.frames[i])
  if cel then img:drawImage(cel.image, cel.position) end
  return img
end

local function px(img, x, y)
  if x < 0 or y < 0 or x > 63 or y > 63 then return 0 end
  local v = img:getPixel(x, y)
  if pc.rgbaA(v) == 0 then return 0 end
  return v
end

local function crownRow(img)
  for y = 0, 63 do
    for x = 0, 63 do
      if px(img, x, y) ~= 0 then return y end
    end
  end
  return nil
end

local HEAD_ROWS = 12
local base = frameImage(REF)
local crown = crownRow(base)
if not crown then print("ERROR:reference frame is empty") return end
print(string.format("reference frame %d: crown row %d, head rows %d..%d", REF, crown, crown, crown + HEAD_ROWS - 1))
for i = FIRST, LAST do
  local img = frameImage(i)
  local best = { dx = 0, dy = 0, miss = math.huge }
  for dy = -3, 3 do
    for dx = -3, 3 do
      local miss = 0
      for y = crown, crown + HEAD_ROWS - 1 do
        for x = 0, 63 do
          if px(base, x, y) ~= px(img, x + dx, y + dy) then miss = miss + 1 end
        end
      end
      if miss < best.miss or (miss == best.miss and math.abs(dx) + math.abs(dy) < math.abs(best.dx) + math.abs(best.dy)) then
        best = { dx = dx, dy = dy, miss = miss }
      end
    end
  end
  local where = {}
  if best.miss > 0 and best.miss <= 12 then
    for y = crown, crown + HEAD_ROWS - 1 do
      for x = 0, 63 do
        if px(base, x, y) ~= px(img, x + best.dx, y + best.dy) then
          where[#where + 1] = string.format("(%d,%d)", x + best.dx, y + best.dy)
        end
      end
    end
  end
  print(string.format("frame %d: crown row %s, head offset dx=%d dy=%d vs frame %d, mismatched head pixels %d%s",
    i, tostring(crownRow(img)), best.dx, best.dy, REF, best.miss,
    #where > 0 and (" at " .. table.concat(where, " ")) or ""))
end
