-- Draws place-trophy-wall.aseprite (130x270): the trophy shelf, the medal rack and the frame slot, raised up the wall.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-trophy-wall.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, hline, vline = L.C, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  -- Trophy shelf plank x 11..68, raised up the wall: trophies stand on its
  -- top row, y = SHELF_Y; brackets hang below it.
  local SHELF_Y, RACK_Y = 100, 118
  hline(img, 11, 68, SHELF_Y, C("wood light"))
  hline(img, 11, 68, SHELF_Y + 1, C("dark wood"))
  hline(img, 11, 68, SHELF_Y + 2, C("wood shadow"))
  hline(img, 11, 68, SHELF_Y + 3, C("wall shadow"))
  for _, bx in ipairs({ 15, 63 }) do
    vline(img, bx, SHELF_Y + 3, SHELF_Y + 7, C("dark wood"))
    vline(img, bx + 1, SHELF_Y + 3, SHELF_Y + 7, C("wood shadow"))
  end

  -- Medal rack bar x 13..66, below the shelf: medals hang from y = RACK_Y + 2.
  hline(img, 13, 66, RACK_Y, C("wood light"))
  hline(img, 13, 66, RACK_Y + 1, C("dark wood"))
  hline(img, 13, 66, RACK_Y + 2, C("wall shadow"))
  img:drawPixel(14, RACK_Y, C("metal light"))
  img:drawPixel(65, RACK_Y, C("metal light"))

  -- Slot slices (x, y, w, h): shelf items stand bottom-center, wall items hang top-center.
  local T, M = SHELF_Y - 20, RACK_Y + 2
  local SLOTS = {
    { "trophy-1", 13, T, 16, 20 },
    { "trophy-2", 32, T, 16, 20 },
    { "trophy-3", 51, T, 16, 20 },
    { "medal-1", 16, M, 14, 20 },
    { "medal-2", 33, M, 14, 20 },
    { "medal-3", 50, M, 14, 20 },
    { "frame", 83, 92, 36, 28 },
  }
  for _, s in ipairs(SLOTS) do L.slice(spr, s[1], s[2], s[3], s[4], s[5]) end
  L.saveSingle(spr, img, "place-trophy-wall")
end)
if not ok then print("ERROR: " .. tostring(err)) end
