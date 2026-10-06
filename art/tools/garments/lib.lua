-- Shared helpers for the garment tools in art/tools/garments; not run on its own.
-- Loaded by the other scripts with: local G = dofile(ROOT .. "/art/tools/garments/lib.lua")
-- (the caller sets ROOT = "<repo root>" first; see art/README.md).
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local G = {}

G.ROOT = P.ROOT
G.BODY = P.BODY
G.TOOLS = P.TOOLS .. "/garments"
G.PREVIEWS = P.previews()
G.REF = "body-ref"

-- Clothing sources in draw order (body -> shoes -> bottom -> top), each with
-- the name of the one layer that holds the garment. A new garment is added here.
G.ORDER = { "shoes-starter", "bottom-starter-shorts", "top-starter-tee" }
G.LAYER = {
  ["shoes-starter"] = "shoes",
  ["bottom-starter-shorts"] = "shorts",
  ["top-starter-tee"] = "tee",
}

-- Placeholder ramps, packed 0xRRGGBB, equal to PLACEHOLDER_RAMPS in palette.ts.
G.SKIN = { light = 0xFF80FF, base = 0xFF40FF, shadow = 0xFF00FF }
G.CLOTH = { light = 0xFFFF80, base = 0xFFFF40, shadow = 0xFFFF00 }

G.N4 = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
G.N8 = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 }, { 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 } }

local pc = app.pixelColor

function G.path(name)
  return P.AVATAR .. "/" .. name .. ".aseprite"
end

function G.hex(rgb)
  return string.format("#%06X", rgb)
end

function G.ms(frame)
  return math.floor(frame.duration * 1000 + 0.5)
end

function G.skinShade(rgb)
  for shade, value in pairs(G.SKIN) do
    if value == rgb then return shade end
  end
  return nil
end

function G.isCloth(rgb)
  return rgb == G.CLOTH.light or rgb == G.CLOTH.base or rgb == G.CLOTH.shadow
end

-- A grid is { w, h, a = alpha[], c = packed rgb[] }, index y * w + x + 1.
function G.newGrid(w, h)
  local grid = { w = w, h = h, a = {}, c = {} }
  for i = 1, w * h do
    grid.a[i] = 0
    grid.c[i] = 0
  end
  return grid
end

function G.idx(grid, x, y)
  if x < 0 or y < 0 or x >= grid.w or y >= grid.h then return nil end
  return y * grid.w + x + 1
end

-- Opaque pixels overwrite; under the alpha 0/255 rule that equals Normal blend.
function G.addCel(grid, cel)
  if not cel then return end
  local pos = cel.position
  for it in cel.image:pixels() do
    local px = it()
    local a = pc.rgbaA(px)
    if a > 0 then
      local i = G.idx(grid, pos.x + it.x, pos.y + it.y)
      if i then
        grid.a[i] = a
        grid.c[i] = (pc.rgbaR(px) << 16) | (pc.rgbaG(px) << 8) | pc.rgbaB(px)
      end
    end
  end
end

local function addLayers(grid, layers, frame)
  for _, layer in ipairs(layers) do
    if layer.isVisible then
      if layer.isGroup then
        addLayers(grid, layer.layers, frame)
      else
        G.addCel(grid, layer:cel(frame))
      end
    end
  end
end

-- What a frame exports as: every visible layer, bottom to top.
function G.flatten(spr, frameNumber)
  local grid = G.newGrid(spr.width, spr.height)
  addLayers(grid, spr.layers, spr.frames[frameNumber])
  return grid
end

function G.layerGrid(spr, layer, frameNumber)
  local grid = G.newGrid(spr.width, spr.height)
  G.addCel(grid, layer:cel(spr.frames[frameNumber]))
  return grid
end

function G.toImage(grid)
  local img = Image(grid.w, grid.h, ColorMode.RGB)
  for y = 0, grid.h - 1 do
    for x = 0, grid.w - 1 do
      local i = y * grid.w + x + 1
      if grid.a[i] > 0 then
        local c = grid.c[i]
        img:drawPixel(x, y, pc.rgba((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF, grid.a[i]))
      end
    end
  end
  return img
end

function G.topLayer(spr, name)
  for _, layer in ipairs(spr.layers) do
    if layer.name == name then return layer end
  end
  return nil
end

-- The body outline color: the most common color on the silhouette edge
-- (opaque pixels with a transparent or off-canvas 4-neighbor), all frames.
function G.outlineColor(body)
  local counts = {}
  for f = 1, #body.frames do
    local g = G.flatten(body, f)
    for y = 0, g.h - 1 do
      for x = 0, g.w - 1 do
        local i = G.idx(g, x, y)
        if g.a[i] > 0 then
          for _, d in ipairs(G.N4) do
            local j = G.idx(g, x + d[1], y + d[2])
            if j == nil or g.a[j] == 0 then
              counts[g.c[i]] = (counts[g.c[i]] or 0) + 1
              break
            end
          end
        end
      end
    end
  end
  local best, n = nil, 0
  for c, k in pairs(counts) do
    if k > n then best, n = c, k end
  end
  return best
end

function G.tags(spr)
  local list = {}
  for _, tag in ipairs(spr.tags) do
    list[#list + 1] = {
      name = tag.name,
      from = tag.fromFrame.frameNumber,
      to = tag.toFrame.frameNumber,
      forward = tag.aniDir == AniDir.FORWARD,
    }
  end
  return list
end

function G.tagOf(spr, frameNumber)
  for _, tag in ipairs(spr.tags) do
    if frameNumber >= tag.fromFrame.frameNumber and frameNumber <= tag.toFrame.frameNumber then
      return tag.name
    end
  end
  return "-"
end

-- Nearest-neighbor upscale onto an opaque background, for previews.
function G.savePreview(grid, scale, bg, file)
  local img = Image(grid.w * scale, grid.h * scale, ColorMode.RGB)
  local bgPx = pc.rgba((bg >> 16) & 0xFF, (bg >> 8) & 0xFF, bg & 0xFF, 255)
  for y = 0, grid.h - 1 do
    for x = 0, grid.w - 1 do
      local i = y * grid.w + x + 1
      local px = bgPx
      if grid.a[i] > 0 then
        local c = grid.c[i]
        px = pc.rgba((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF, 255)
      end
      for sy = 0, scale - 1 do
        for sx = 0, scale - 1 do
          img:drawPixel(x * scale + sx, y * scale + sy, px)
        end
      end
    end
  end
  img:saveAs(file)
end

return G
