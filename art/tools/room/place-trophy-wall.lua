-- Draws place-trophy-wall.aseprite (130x270): the trophy shelf, the medal rack and the frame slot, at v1 heights.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-trophy-wall.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  L.cloud(img, 20, 22, false)
  L.cloud(img, 92, 19, true)

  -- Lit from the upper left like every place: shelf, brackets and rack cast wall
  -- shadow down and to the right.
  -- Trophy shelf plank x 11..68: trophies stand on its
  -- top row, y = SHELF_Y; brackets hang below it.
  -- v1's heights: shelf y 32 and rack y 50, + 120 (L.WALL_Y).
  local SHELF_Y, RACK_Y = L.WALL_Y + 32, L.WALL_Y + 50
  hline(img, 12, 69, SHELF_Y + 3, C("wall shadow"))
  vline(img, 69, SHELF_Y + 1, SHELF_Y + 2, C("wall shadow"))
  hline(img, 11, 68, SHELF_Y, C("wood light"))
  hline(img, 11, 68, SHELF_Y + 1, C("dark wood"))
  hline(img, 11, 68, SHELF_Y + 2, C("wood shadow"))
  -- Grain on the front edge, and darker end grain.
  for _, g in ipairs({ { 18, 22 }, { 33, 36 }, { 47, 52 }, { 60, 63 } }) do
    hline(img, g[1], g[2], SHELF_Y + 1, C("wood shadow"))
  end
  vline(img, 11, SHELF_Y + 1, SHELF_Y + 2, C("wood shadow"))
  vline(img, 68, SHELF_Y + 1, SHELF_Y + 2, C("wood shadow"))
  -- Brackets: right-angled triangles under the shelf, 5 px across and 5 down,
  -- lit along the wall edge, shaded along the slope, with a wall shadow beside it.
  for _, bx in ipairs({ 15, 62 }) do
    for r = 0, 4 do
      local y, last = SHELF_Y + 3 + r, bx + 4 - r
      hline(img, bx, last, y, C("dark wood"))
      img:drawPixel(bx, y, C("wood light"))
      if last > bx then img:drawPixel(last, y, C("wood shadow")) end
      img:drawPixel(last + 1, y, C("wall shadow"))
    end
    img:drawPixel(bx + 1, SHELF_Y + 8, C("wall shadow"))
  end

  -- Medal rack bar x 13..66, below the shelf: medals hang from y = RACK_Y + 2.
  -- Two dark wood mounting blocks hold it to the wall, with metal screws.
  local BLOCKS = { 11, 67 }
  for _, bx in ipairs(BLOCKS) do
    vline(img, bx + 2, RACK_Y - 1, RACK_Y + 3, C("wall shadow"))
    hline(img, bx + 1, bx + 2, RACK_Y + 4, C("wall shadow"))
  end
  hline(img, 14, 67, RACK_Y + 2, C("wall shadow"))
  hline(img, 13, 66, RACK_Y, C("wood light"))
  hline(img, 13, 66, RACK_Y + 1, C("dark wood"))
  for _, bx in ipairs(BLOCKS) do
    rect(img, bx, RACK_Y - 2, 2, 6, C("dark wood"))
    vline(img, bx, RACK_Y - 2, RACK_Y + 3, C("wood light"))
    hline(img, bx, bx + 1, RACK_Y + 3, C("wood shadow"))
    img:drawPixel(bx + 1, RACK_Y, C("metal light"))
  end

  -- The bib frame (32x24, hung top-center in the frame slot: x 85..116, y 134..157)
  -- casts a 1 px wall shadow down and to the right. Item art never draws over it.
  local FX, FY = 85, L.WALL_Y + 14
  vline(img, FX + 32, FY + 1, FY + 24, C("wall shadow"))
  hline(img, FX + 1, FX + 32, FY + 24, C("wall shadow"))

  -- Slot slices (x, y, w, h). Each medal hangs straight below its trophy: slot
  -- centers x 21, 40, 59 on both rows. Shelf items stand bottom-center, wall items
  -- hang top-center.
  local T, M = SHELF_Y - 20, RACK_Y + 2
  local SLOTS = {
    { "trophy-1", 13, T, 16, 20 },
    { "trophy-2", 32, T, 16, 20 },
    { "trophy-3", 51, T, 16, 20 },
    { "medal-1", 14, M, 14, 20 },
    { "medal-2", 33, M, 14, 20 },
    { "medal-3", 52, M, 14, 20 },
    { "frame", 83, L.WALL_Y + 14, 36, 28 },
  }
  for _, s in ipairs(SLOTS) do L.slice(spr, s[1], s[2], s[3], s[4], s[5]) end
  L.saveSingle(spr, img, "place-trophy-wall")
end)
if not ok then print("ERROR: " .. tostring(err)) end
