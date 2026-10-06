-- Creates each clothing source in G.ORDER as a copy of body.aseprite: same canvas,
-- palette, frames, durations and tags; the body flattened into one hidden
-- "body-ref" layer; one empty visible garment layer on top.
-- Existing files are never overwritten. With MODE = "refresh" set before
-- dofile(), existing files instead get body-ref, durations and tags re-synced
-- from body.aseprite and keep their garment pixels (run it after every body change).
-- Run: run_lua_script(script = 'ROOT = "<repo>"; MODE = "refresh"; dofile(ROOT .. "/art/tools/garments/make-sources.lua")')
-- Without MODE it only creates missing files; with "refresh" it SAVES the existing ones.
local G = dofile(ROOT .. "/art/tools/garments/lib.lua")

local body = app.open(G.BODY)
if not body then print("ERROR: cannot open " .. G.BODY) return end
if body.colorMode ~= ColorMode.RGB then print("ERROR: body.aseprite is not RGB") return end

local grids = {}
for f = 1, #body.frames do grids[f] = G.flatten(body, f) end

local function setRef(spr, ref)
  for f = 1, #spr.frames do
    local cel = ref:cel(spr.frames[f])
    if cel then spr:deleteCel(cel) end
    spr:newCel(ref, spr.frames[f], G.toImage(grids[f]), Point(0, 0))
  end
  ref.isVisible = false
end

for _, name in ipairs(G.ORDER) do
  local path = G.path(name)
  if not app.fs.isFile(path) then
    local spr = Sprite(body)
    local old = {}
    for _, layer in ipairs(spr.layers) do old[#old + 1] = layer end
    local ref = spr:newLayer()
    ref.name = G.REF
    for _, layer in ipairs(old) do spr:deleteLayer(layer) end
    for i = #spr.slices, 1, -1 do spr:deleteSlice(spr.slices[i]) end
    setRef(spr, ref)
    local garment = spr:newLayer()
    garment.name = G.LAYER[name]
    spr:saveAs(path)
    print("CREATED " .. path .. " (" .. #spr.frames .. " frames, layers " .. G.REF .. " hidden + " .. G.LAYER[name] .. ")")
    spr:close()
  elseif MODE == "refresh" then
    local spr = app.open(path)
    local ref = G.topLayer(spr, G.REF)
    if #spr.frames ~= #body.frames then
      print("ERROR: " .. name .. " has " .. #spr.frames .. " frames, body has " .. #body.frames .. "; its garment frames must be redrawn")
    elseif not ref then
      print("ERROR: " .. name .. " has no top-level " .. G.REF .. " layer")
    else
      for f = 1, #spr.frames do spr.frames[f].duration = body.frames[f].duration end
      for i = #spr.tags, 1, -1 do spr:deleteTag(spr.tags[i]) end
      for _, bt in ipairs(body.tags) do
        local tag = spr:newTag(bt.fromFrame.frameNumber, bt.toFrame.frameNumber)
        tag.name = bt.name
        tag.aniDir = bt.aniDir
        tag.color = bt.color
      end
      setRef(spr, ref)
      spr:saveAs(path)
      print("REFRESHED " .. path)
    end
    spr:close()
  else
    print("SKIP " .. path .. " exists (MODE = \"refresh\" re-syncs its body-ref)")
  end
end
