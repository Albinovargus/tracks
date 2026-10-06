-- Turns a fresh copy of body.aseprite into a hair source: one hidden, locked
-- "ref-body" layer holding the visible body composite of every frame, plus an
-- empty visible "hair" layer. Frames, durations and tags are left untouched. SAVES it.
-- Make the copy first (copy_sprite art/avatar/body.aseprite -> art/avatar/hair-<style>.aseprite).
-- Run: run_lua_script(filename = art/avatar/hair-<style>.aseprite,
--   script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/hair/convert.lua")').

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if spr.width ~= 64 or spr.height ~= 64 then print("ERROR:expected a 64x64 sprite") return end
if spr.colorMode ~= ColorMode.RGB then print("ERROR:sprite must be in RGB color mode") return end
for _, layer in ipairs(spr.layers) do
  if layer.name == "ref-body" or layer.name == "hair" then
    print("ERROR:already converted (found layer " .. layer.name .. ")") return
  end
end

local function drawVisible(layers, frame, img)
  for _, layer in ipairs(layers) do
    if layer.isVisible then
      if layer.isGroup then
        drawVisible(layer.layers, frame, img)
      else
        local cel = layer:cel(frame)
        if cel then img:drawImage(cel.image, cel.position) end
      end
    end
  end
end

local composites = {}
for i, frame in ipairs(spr.frames) do
  local img = Image(spr.width, spr.height, ColorMode.RGB)
  drawVisible(spr.layers, frame, img)
  composites[i] = img
end

local old = {}
for _, layer in ipairs(spr.layers) do old[#old + 1] = layer end

app.transaction(function()
  local ref = spr:newLayer()
  ref.name = "ref-body"
  for i, frame in ipairs(spr.frames) do
    spr:newCel(ref, frame, composites[i], Point(0, 0))
  end
  for _, layer in ipairs(old) do spr:deleteLayer(layer) end
  ref.isVisible = false
  ref.isEditable = false
  local hair = spr:newLayer()
  hair.name = "hair"
end)

spr:saveAs(spr.filename)
local names = {}
for _, layer in ipairs(spr.layers) do
  names[#names + 1] = layer.name .. (layer.isVisible and "(visible)" or "(hidden)")
end
print("OK layers=" .. table.concat(names, ",") .. " frames=" .. #spr.frames .. " tags=" .. #spr.tags)
