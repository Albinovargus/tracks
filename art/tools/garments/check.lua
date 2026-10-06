-- Checks every clothing source in G.ORDER against body.aseprite and the source
-- rules (spec section 4). Read-only. Prints one line per problem and ends
-- with "RESULT: PASS" or "RESULT: FAIL (<n> problems)".
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/garments/check.lua")')
local G = dofile(ROOT .. "/art/tools/garments/lib.lua")

local problems = 0
local function fail(name, msg)
  problems = problems + 1
  print("FAIL " .. name .. ": " .. msg)
end

local body = app.open(G.BODY)
if not body then
  print("FAIL body: cannot open " .. G.BODY)
  print("RESULT: FAIL (1 problems)")
  return
end
local outline = G.outlineColor(body)
local bodyTags = G.tags(body)
local bodyGrids = {}
for f = 1, #body.frames do bodyGrids[f] = G.flatten(body, f) end
print("body: " .. #body.frames .. " frames, outline " .. G.hex(outline))

local function checkLayers(name, layers, depth)
  for _, layer in ipairs(layers) do
    if layer.isVisible then
      if layer.isGroup then
        checkLayers(name, layer.layers, depth + 1)
      else
        if layer.opacity ~= 255 then fail(name, "layer '" .. layer.name .. "' opacity " .. layer.opacity) end
        if layer.blendMode ~= BlendMode.NORMAL then fail(name, "layer '" .. layer.name .. "' is not Normal blend") end
        for _, cel in ipairs(layer.cels) do
          if cel.opacity ~= 255 then
            fail(name, "layer '" .. layer.name .. "' frame " .. cel.frameNumber .. " cel opacity " .. cel.opacity)
          end
        end
      end
    end
  end
end

local function sameGrid(a, b)
  for i = 1, a.w * a.h do
    if a.a[i] ~= b.a[i] or (a.a[i] > 0 and a.c[i] ~= b.c[i]) then return false end
  end
  return true
end

for _, name in ipairs(G.ORDER) do
  local path = G.path(name)
  local before = problems
  local spr = app.fs.isFile(path) and app.open(path) or nil
  if not spr then
    fail(name, "missing " .. path)
  else
    if spr.colorMode ~= ColorMode.RGB then fail(name, "not RGB color mode") end
    if spr.width ~= 64 or spr.height ~= 64 then fail(name, "canvas is " .. spr.width .. "x" .. spr.height) end
    if #spr.frames ~= #body.frames then
      fail(name, #spr.frames .. " frames, body has " .. #body.frames)
    else
      for f = 1, #body.frames do
        if G.ms(spr.frames[f]) ~= G.ms(body.frames[f]) then
          fail(name, "frame " .. f .. " lasts " .. G.ms(spr.frames[f]) .. " ms, body " .. G.ms(body.frames[f]) .. " ms")
        end
      end
    end
    local tags = G.tags(spr)
    if #tags ~= #bodyTags then fail(name, #tags .. " tags, body has " .. #bodyTags) end
    for _, bt in ipairs(bodyTags) do
      local match = nil
      for _, t in ipairs(tags) do
        if t.name == bt.name then match = t end
      end
      if not match then
        fail(name, "tag '" .. bt.name .. "' missing")
      elseif match.from ~= bt.from or match.to ~= bt.to or not match.forward then
        fail(name, "tag '" .. bt.name .. "' is " .. match.from .. "-" .. match.to .. " (body " .. bt.from .. "-" .. bt.to .. "), forward " .. tostring(match.forward))
      end
    end

    local ref = G.topLayer(spr, G.REF)
    local garment = G.topLayer(spr, G.LAYER[name])
    if not ref then fail(name, "no top-level '" .. G.REF .. "' layer") end
    if ref and ref.isVisible then fail(name, "'" .. G.REF .. "' must be hidden") end
    if not garment then fail(name, "no top-level '" .. G.LAYER[name] .. "' layer") end
    if garment and not garment.isVisible then fail(name, "'" .. G.LAYER[name] .. "' must be visible") end
    checkLayers(name, spr.layers, 0)

    if ref and #spr.frames == #body.frames then
      for f = 1, #spr.frames do
        if not sameGrid(G.layerGrid(spr, ref, f), bodyGrids[f]) then
          fail(name, "frame " .. f .. " body-ref differs from body.aseprite (re-run make-garment-sources.lua with MODE = \"refresh\")")
        end
      end
    end

    local frames = math.min(#spr.frames, #body.frames)
    for f = 1, frames do
      local g = G.flatten(spr, f)
      local b = bodyGrids[f]
      local cloth, bad, partial, off, top, first = 0, 0, 0, 0, 0, nil
      for y = 0, g.h - 1 do
        for x = 0, g.w - 1 do
          local i = G.idx(g, x, y)
          local a = g.a[i]
          if a > 0 then
            if a ~= 255 then partial = partial + 1 end
            local c = g.c[i]
            if G.isCloth(c) then
              cloth = cloth + 1
            elseif c ~= outline then
              bad = bad + 1
              first = first or ("(" .. x .. "," .. y .. ") " .. G.hex(c))
            end
            if y == 0 then top = top + 1 end
            local near = b.a[i] > 0
            if not near then
              for _, d in ipairs(G.N8) do
                local j = G.idx(b, x + d[1], y + d[2])
                if j and b.a[j] > 0 then near = true end
              end
            end
            if not near then off = off + 1 end
          end
        end
      end
      if cloth == 0 then fail(name, "frame " .. f .. " (" .. G.tagOf(spr, f) .. ") has no PH cloth pixel") end
      if bad > 0 then fail(name, "frame " .. f .. " has " .. bad .. " pixels that are neither PH cloth nor outline, first " .. first) end
      if partial > 0 then fail(name, "frame " .. f .. " has " .. partial .. " pixels with alpha other than 0 or 255") end
      if top > 0 then fail(name, "frame " .. f .. " has opaque pixels on row 0") end
      if off > 0 then fail(name, "frame " .. f .. " has " .. off .. " pixels more than 1 px outside the body silhouette") end
    end
    if problems == before then print("PASS " .. name .. ": " .. #spr.frames .. " frames") end
  end
end

if problems == 0 then
  print("RESULT: PASS")
else
  print("RESULT: FAIL (" .. problems .. " problems)")
end
