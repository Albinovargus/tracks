-- Read-only source check of the open hair file against body.aseprite (or BODY, a path):
-- same frame count, durations and tags; ref-body hidden; every other layer
-- visible, Normal, 100% opacity; hair pixels only O/L/B/S at alpha 255; no
-- pixel on row 0 or in columns 0 and 63; every frame has at least one PH
-- hair pixel. Ends with "OK ..." or "FAILED <n> problem(s)".
-- Run: run_lua_script(filename = art/avatar/hair-<style>.aseprite,
--   script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/hair/check.lua")').
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local BODY = BODY or P.BODY
local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local pc = app.pixelColor
local problems = {}
local function problem(msg) problems[#problems + 1] = msg end

local body = app.open(BODY)
if not body then print("ERROR:could not open " .. BODY) return end
if #body.frames ~= #spr.frames then
  problem(string.format("frame count %d, body has %d", #spr.frames, #body.frames))
else
  for i = 1, #spr.frames do
    local a = math.floor(spr.frames[i].duration * 1000 + 0.5)
    local b = math.floor(body.frames[i].duration * 1000 + 0.5)
    if a ~= b then problem(string.format("frame %d duration %d ms, body has %d ms", i, a, b)) end
  end
end
local function tagList(s)
  local out = {}
  for _, t in ipairs(s.tags) do
    out[#out + 1] = string.format("%s:%d-%d:%s", t.name, t.fromFrame.frameNumber, t.toFrame.frameNumber, tostring(t.aniDir))
  end
  return table.concat(out, " ")
end
local hairTags, bodyTags = tagList(spr), tagList(body)
if hairTags ~= bodyTags then problem("tags [" .. hairTags .. "] differ from body [" .. bodyTags .. "]") end
body:close()
app.activeSprite = spr

local ref, outline = nil, nil
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" then ref = layer end
end
if not ref then
  problem("no ref-body layer")
else
  if ref.isVisible then problem("ref-body is visible") end
  local cel = ref:cel(spr.frames[1])
  if cel then
    local img = Image(64, 64, ColorMode.RGB)
    img:drawImage(cel.image, cel.position)
    for y = 0, 63 do
      local v = img:getPixel(32, y)
      if pc.rgbaA(v) == 255 then
        outline = string.format("#%02x%02x%02x", pc.rgbaR(v), pc.rgbaG(v), pc.rgbaB(v))
        break
      end
    end
  end
end
local allowed = { ["#80ffff"] = true, ["#40ffff"] = true, ["#00ffff"] = true }
if outline then allowed[outline] = true end

local hairFrames = {}
for _, layer in ipairs(spr.layers) do
  if layer.name ~= "ref-body" then
    if layer.isGroup then problem("layer " .. layer.name .. " is a group") end
    if not layer.isVisible then problem("layer " .. layer.name .. " is hidden") end
    if layer.opacity ~= 255 then problem("layer " .. layer.name .. " opacity " .. layer.opacity) end
    if layer.blendMode ~= BlendMode.NORMAL then problem("layer " .. layer.name .. " blend mode is not Normal") end
    for fi, frame in ipairs(spr.frames) do
      local cel = layer:cel(frame)
      if cel then
        if cel.opacity ~= 255 then problem(string.format("%s frame %d cel opacity %d", layer.name, fi, cel.opacity)) end
        local img, ox, oy = cel.image, cel.position.x, cel.position.y
        for py = 0, img.height - 1 do
          for px = 0, img.width - 1 do
            local v = img:getPixel(px, py)
            local a = pc.rgbaA(v)
            if a > 0 then
              local x, y = px + ox, py + oy
              local hex = string.format("#%02x%02x%02x", pc.rgbaR(v), pc.rgbaG(v), pc.rgbaB(v))
              if a ~= 255 then problem(string.format("%s frame %d (%d,%d) alpha %d", layer.name, fi, x, y, a)) end
              if not allowed[hex] then problem(string.format("%s frame %d (%d,%d) color %s", layer.name, fi, x, y, hex)) end
              if x < 1 or x > 62 or y < 1 or y > 63 then
                problem(string.format("%s frame %d pixel (%d,%d) is outside x 1..62, y 1..63", layer.name, fi, x, y))
              end
              if hex ~= outline then hairFrames[fi] = true end
            end
          end
        end
      end
    end
  end
end
for fi = 1, #spr.frames do
  if not hairFrames[fi] then problem(string.format("frame %d has no PH hair pixel", fi)) end
end

if #problems == 0 then
  print(string.format("OK %d frames, tags %s, outline %s", #spr.frames, hairTags, tostring(outline)))
else
  for _, p in ipairs(problems) do print("PROBLEM:" .. p) end
  print(string.format("FAILED %d problem(s)", #problems))
end
