-- Draws place-mirror-corner.aseprite (130x270): a full-length standing mirror and a decor slot.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-mirror-corner.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  -- Standing mirror 30x76 at x 50..79, bottom row on L.STAND_Y: a 30x74 frame
  -- (3 px dark wood, lit top/left, shaded bottom/right) with glass inside, on
  -- two 3x2 dark wood feet at the bottom corners.
  local mw, mh = 30, 76
  local mx, my = 50, L.STAND_Y - mh + 1
  local fh = mh - 2
  rect(img, mx, my, mw, fh, C("dark wood"))
  hline(img, mx, mx + mw - 1, my, C("wood light"))
  vline(img, mx, my, my + fh - 1, C("wood light"))
  hline(img, mx + 1, mx + mw - 1, my + fh - 1, C("wood shadow"))
  vline(img, mx + mw - 1, my + 1, my + fh - 1, C("wood shadow"))
  local gx, gy, gw, gh = mx + 3, my + 3, mw - 6, fh - 6
  rect(img, gx, gy, gw, gh, C("glass"))
  vline(img, gx, gy, gy + gh - 1, C("glass shadow"))
  -- Two diagonal streaks, like the window panes.
  for _, s in ipairs({ { 5, 20 }, { 9, 40 } }) do
    for i = 0, 9 do
      img:drawPixel(gx + s[1] + i, gy + s[2] - i, C("glass light"))
      img:drawPixel(gx + s[1] + 1 + i, gy + s[2] - i, C("glass light"))
    end
  end
  rect(img, mx, my + fh, 3, 2, C("dark wood"))
  rect(img, mx + mw - 3, my + fh, 3, 2, C("dark wood"))

  -- hotspot-mirror is exactly the mirror; decor is empty this iteration.
  L.slice(spr, "hotspot-mirror", mx, my, mw, mh)
  L.slice(spr, "decor", 14, 222, 24, 40)
  L.saveSingle(spr, img, "place-mirror-corner")
end)
if not ok then print("ERROR: " .. tostring(err)) end
