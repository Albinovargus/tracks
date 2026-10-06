-- Draws medal-gold, medal-silver and medal-bronze.aseprite.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/medals.lua")').
-- It OVERWRITES the source in art/room/. To check it instead, set ROOM_OUT to a scratch
-- folder and compare with art/tools/lib/compare-sprites.lua (see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")

  -- medal-gold/-silver/-bronze.aseprite: 10x18, hung top-center from the rack.
  -- A red and blue ribbon, then a disc in the medal's metal (L/M/S).
  local MEDAL = {
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    ".oRRrBBbo.",
    "..oRrBbo..",
    "...oMMo...",
    "..oooooo..",
    ".oLLMMMSo.",
    "oLLMMMMMSo",
    "oLMMMMMMSo",
    "oLMMMMMMSo",
    "oMMMMMMSSo",
    ".oMMMMSSo.",
    "..oSSSSo..",
    "...oooo...",
  }
  local METALS = {
    { id = "medal-gold", L = "gold light", M = "gold", S = "gold shadow" },
    { id = "medal-silver", L = "metal light", M = "metal", S = "metal shadow" },
    { id = "medal-bronze", L = "bronze light", M = "bronze", S = "bronze shadow" },
  }
  for _, metal in ipairs(METALS) do
    local spr = L.newSprite(#MEDAL[1], #MEDAL, "medal")
    local img = Image(spr.width, spr.height, ColorMode.RGB)
    L.grid(img, 0, 0, MEDAL, {
      o = "outline", R = "red", r = "red shadow", B = "blue", b = "blue shadow",
      L = metal.L, M = metal.M, S = metal.S,
    })
    L.saveSingle(spr, img, metal.id)
  end
end)
if not ok then print("ERROR: " .. tostring(err)) end
