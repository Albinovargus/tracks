-- Draws place-treadmill-corner.aseprite (130x270): the home place, with a window and the treadmill slot.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-treadmill-corner.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  -- Window: a taller v1 window raised up the wall, dark wood frame x 23..58,
  -- y 70..127, six 14x16 panes (two across, three down), sill below (y 128..130).
  local wx, wy, ww, wh = 23, 70, 36, 58
  rect(img, wx, wy, ww, wh, C("dark wood"))
  hline(img, wx, wx + ww - 1, wy, C("wood light"))
  hline(img, wx, wx + ww - 1, wy + wh - 1, C("wood shadow"))
  for _, px0 in ipairs({ 3, 19 }) do
    for _, py0 in ipairs({ 3, 21, 39 }) do
      local px, py = wx + px0, wy + py0
      rect(img, px, py, 14, 16, C("glass"))
      hline(img, px, px + 13, py, C("glass shadow"))
      vline(img, px, py, py + 15, C("glass shadow"))
      for i = 0, 5 do
        img:drawPixel(px + 4 + i, py + 11 - i, C("glass light"))
        img:drawPixel(px + 5 + i, py + 11 - i, C("glass light"))
      end
    end
  end
  hline(img, wx - 2, wx + ww + 1, wy + wh, C("trim"))
  hline(img, wx - 2, wx + ww + 1, wy + wh + 1, C("dark wood"))
  hline(img, wx - 2, wx + ww + 1, wy + wh + 2, C("wall shadow"))

  -- The treadmill stands bottom-centered in this slot, bottom row on L.STAND_Y.
  L.slice(spr, "equipment", 23, 212, 84, 50)
  L.saveSingle(spr, img, "place-treadmill-corner")
end)
if not ok then print("ERROR: " .. tostring(err)) end
