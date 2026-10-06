-- Onion-skin previews for the motion review, built from the open sprite's own tags.
-- Read-only. Run: run_lua_script(filename = art/avatar/body.aseprite,
--   script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/body/onion-review.lua")').
-- Writes to .superpowers/art-previews/:
--   body-onion-fNN.png       side-run frame NN over the previous and next frame of the
--                            side-run loop (wrapping at the seam, unlike render_onion_skin)
--   body-transition-in.png   the turn frame over the last front-idle and first side-run frames
--   body-transition-out.png  the turn frame over the last side-run and first front-idle frames
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local OUT_DIR = P.previews() .. "/"
local LAYER_NAME = "body"
local SCALE = 8
local GHOST_OPACITY = 100

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local layer = nil
for _, l in ipairs(spr.layers) do
  if l.name == LAYER_NAME then layer = l end
end
if not layer then print("ERROR:No layer named " .. LAYER_NAME) return end

local tags = {}
for _, t in ipairs(spr.tags) do
  tags[t.name] = { from = t.fromFrame.frameNumber, to = t.toFrame.frameNumber }
end
for _, name in ipairs({ "front-idle", "turn", "side-run" }) do
  if not tags[name] then print("ERROR:No tag named " .. name) return end
end

local function frameImage(i)
  local img = Image(spr.width, spr.height, ColorMode.RGB)
  local cel = layer:cel(spr.frames[i])
  if cel then img:drawImage(cel.image, cel.position) end
  return img
end

local white = app.pixelColor.rgba(255, 255, 255, 255)
local function render(main, ghosts, name)
  local comp = Image(spr.width, spr.height, ColorMode.RGB)
  for y = 0, comp.height - 1 do
    for x = 0, comp.width - 1 do comp:putPixel(x, y, white) end
  end
  for _, g in ipairs(ghosts) do
    comp:drawImage(frameImage(g), Point(0, 0), GHOST_OPACITY, BlendMode.NORMAL)
  end
  comp:drawImage(frameImage(main), Point(0, 0), 255, BlendMode.NORMAL)
  local big = Image(comp.width * SCALE, comp.height * SCALE, ColorMode.RGB)
  for y = 0, comp.height - 1 do
    for x = 0, comp.width - 1 do
      local v = comp:getPixel(x, y)
      for oy = 0, SCALE - 1 do
        for ox = 0, SCALE - 1 do big:putPixel(x * SCALE + ox, y * SCALE + oy, v) end
      end
    end
  end
  big:saveAs(OUT_DIR .. name)
  print(string.format("%s: frame %d over %d and %d", name, main, ghosts[1], ghosts[2]))
end

local run = tags["side-run"]
local n = run.to - run.from + 1
for k = 0, n - 1 do
  local prev = run.from + (k - 1) % n
  local nxt = run.from + (k + 1) % n
  render(run.from + k, { prev, nxt }, string.format("body-onion-f%02d.png", run.from + k))
end
local turn, idle = tags["turn"].from, tags["front-idle"]
render(turn, { idle.to, run.from }, "body-transition-in.png")
render(turn, { run.to, idle.from }, "body-transition-out.png")
print("OK onion=" .. (n + 2))
