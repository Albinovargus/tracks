-- Draws trophy-gold, trophy-silver and trophy-bronze.aseprite.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/trophies.lua")').
-- It OVERWRITES the source in art/room/. To check it instead, set ROOM_OUT to a scratch
-- folder and compare with art/tools/lib/compare-sprites.lua (see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")

  -- trophy-gold/-silver/-bronze.aseprite: 14 px wide, standing bottom-center on
  -- the shelf. L/M/S are the metal's light/base/shadow; taller stems rank higher.
  local CUP = {
    "..oooooooooo..",
    "..oLLMMMMMSo..",
    "oooLMMMMMMSooo",
    "o.oLMMMMMMSo.o",
    "o.oLMMMMMMSo.o",
    "oooLMMMMMMSooo",
    "..oLMMMMMMSo..",
    "...oLMMMMSo...",
    "....oLMMSo....",
  }
  local STEM = ".....oMSo....."
  local BASE = {
    "....oLMMSo....",
    "..oooooooooo..",
    "..ollllllllo..",
    "..oddMMMMddo..",
    "..oddddddddo..",
    "..oooooooooo..",
  }
  local METALS = {
    { id = "trophy-gold", L = "gold light", M = "gold", S = "gold shadow", stem = 3 },
    { id = "trophy-silver", L = "metal light", M = "metal", S = "metal shadow", stem = 2 },
    { id = "trophy-bronze", L = "bronze light", M = "bronze", S = "bronze shadow", stem = 1 },
  }
  for _, metal in ipairs(METALS) do
    local rows = {}
    for _, row in ipairs(CUP) do rows[#rows + 1] = row end
    for _ = 1, metal.stem do rows[#rows + 1] = STEM end
    for _, row in ipairs(BASE) do rows[#rows + 1] = row end
    local spr = L.newSprite(#rows[1], #rows, "trophy")
    local img = Image(spr.width, spr.height, ColorMode.RGB)
    L.grid(img, 0, 0, rows, {
      o = "outline", L = metal.L, M = metal.M, S = metal.S, l = "wood light", d = "dark wood",
    })
    L.saveSingle(spr, img, metal.id)
  end
end)
if not ok then print("ERROR: " .. tostring(err)) end
