-- Read-only spec §4 rule 6 check of the "ponytail" layer, frames FIRST..LAST
-- (default: every frame).
--   front-idle and turn frames: no ponytail pixel may sit on an opaque
--   ref-body pixel, because the tail hangs behind the head, neck and shoulders.
--   side-run frames: no ponytail pixel may sit on, or touch (8 neighbours), a
--   near-arm rectangle listed in NEAR_ARM[frame] = { {x1, y1, x2, y2}, ... }.
--   Every side-run frame in range needs a NEAR_ARM entry, and every rectangle
--   must cover at least one ref-body pixel.
-- Run: run_lua_script(filename = art/avatar/hair-ponytail.aseprite, script = 'ROOT = "<repo>";
--   dofile(ROOT .. "/art/tools/hair/ponytail-near-arm.lua"); dofile(ROOT .. "/art/tools/hair/occlusion.lua")').
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local first, last = FIRST or 1, LAST or #spr.frames
if type(first) ~= "number" or type(last) ~= "number" or first < 1 or last > #spr.frames or first > last then
  print("ERROR:FIRST/LAST out of range") return
end
local arms = NEAR_ARM or {}
if type(arms) ~= "table" then print("ERROR:NEAR_ARM must be a table") return end
local ref, tail = nil, nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
  if layer.name == "ponytail" then tail = layer end
end
if not ref then print("ERROR:no ref-body layer") return end
if not tail then print("ERROR:no ponytail layer") return end
local pc = app.pixelColor

local function tagOf(fi)
  for _, t in ipairs(spr.tags) do
    if fi >= t.fromFrame.frameNumber and fi <= t.toFrame.frameNumber then return t.name end
  end
  return nil
end

local function layerImage(layer, frame)
  local img = Image(64, 64, ColorMode.RGB)
  local cel = layer:cel(frame)
  if cel then img:drawImage(cel.image, cel.position) end
  return img
end

local function opaque(img, x, y)
  return pc.rgbaA(img:getPixel(x, y)) > 0
end

local function listed(coords)
  local shown = {}
  for i = 1, math.min(#coords, 8) do shown[i] = coords[i] end
  local more = #coords > 8 and string.format(" and %d more", #coords - 8) or ""
  return table.concat(shown, " ") .. more
end

local problems = {}
local function problem(msg) problems[#problems + 1] = msg end
local runFrames = 0

for fi = first, last do
  local frame = spr.frames[fi]
  local tag = tagOf(fi)
  local body = layerImage(ref, frame)
  local pony = layerImage(tail, frame)
  if tag == "front-idle" or tag == "turn" then
    local hits = {}
    for y = 0, 63 do
      for x = 0, 63 do
        if opaque(pony, x, y) and opaque(body, x, y) then
          hits[#hits + 1] = string.format("(%d,%d)", x, y)
        end
      end
    end
    if #hits > 0 then
      problem(string.format("frame %d (%s): %d ponytail pixel(s) on the body at %s", fi, tag, #hits, listed(hits)))
    end
  elseif tag == "side-run" then
    runFrames = runFrames + 1
    local rects = arms[fi]
    if type(rects) ~= "table" or #rects == 0 then
      problem(string.format("frame %d (side-run): no NEAR_ARM entry", fi))
    else
      local valid = true
      for k, r in ipairs(rects) do
        if type(r) ~= "table" or #r ~= 4 then
          problem(string.format("frame %d NEAR_ARM rectangle %d is not {x1, y1, x2, y2}", fi, k))
          valid = false
        elseif r[1] > r[3] or r[2] > r[4] or r[1] < 0 or r[2] < 0 or r[3] > 63 or r[4] > 63 then
          problem(string.format("frame %d NEAR_ARM rectangle %d {%d, %d, %d, %d} is not inside 0..63 with x1 <= x2 and y1 <= y2",
            fi, k, r[1], r[2], r[3], r[4]))
          valid = false
        else
          local covers = false
          for y = r[2], r[4] do
            for x = r[1], r[3] do
              if opaque(body, x, y) then covers = true end
            end
          end
          if not covers then
            problem(string.format("frame %d NEAR_ARM rectangle %d {%d, %d, %d, %d} covers no body pixel",
              fi, k, r[1], r[2], r[3], r[4]))
            valid = false
          end
        end
      end
      if valid then
        local hits = {}
        for y = 0, 63 do
          for x = 0, 63 do
            if opaque(pony, x, y) then
              for _, r in ipairs(rects) do
                if x >= r[1] - 1 and x <= r[3] + 1 and y >= r[2] - 1 and y <= r[4] + 1 then
                  hits[#hits + 1] = string.format("(%d,%d)", x, y)
                  break
                end
              end
            end
          end
        end
        if #hits > 0 then
          problem(string.format("frame %d (side-run): %d ponytail pixel(s) on or within 1 px of the near arm at %s",
            fi, #hits, listed(hits)))
        end
      end
    end
  else
    problem(string.format("frame %d is in no front-idle, turn or side-run tag", fi))
  end
end

if #problems == 0 then
  print(string.format("OK ponytail occlusion frames %d..%d (%d side-run frame(s) checked against NEAR_ARM)",
    first, last, runFrames))
else
  for _, p in ipairs(problems) do print("PROBLEM:" .. p) end
  print(string.format("FAILED %d problem(s)", #problems))
end
