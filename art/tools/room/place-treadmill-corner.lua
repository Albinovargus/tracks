-- Draws place-treadmill-corner.aseprite (130x270): the home place, with a window and the treadmill slot.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-treadmill-corner.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  L.cloud(img, 78, 22, true)

  -- Window: v1's window at v1's height (y 12 + 120), dark wood frame x 23..58,
  -- y 132..167, four 14x14 panes, sill below (y 168..170).
  -- Lit from the upper left like every place: the frame's top and left edges are
  -- wood light, its bottom and right wood shadow, and it casts a wall shadow column
  -- on its right; the sill casts one on the wall below it.
  local wx, wy, ww, wh = 23, L.WALL_Y + 12, 36, 36
  vline(img, wx + ww, wy + 1, wy + wh - 1, C("wall shadow"))
  rect(img, wx, wy, ww, wh, C("dark wood"))
  hline(img, wx, wx + ww - 1, wy, C("wood light"))
  vline(img, wx, wy, wy + wh - 1, C("wood light"))
  hline(img, wx + 1, wx + ww - 1, wy + wh - 1, C("wood shadow"))
  vline(img, wx + ww - 1, wy + 1, wy + wh - 1, C("wood shadow"))
  for _, px0 in ipairs({ 3, 19 }) do
    for _, py0 in ipairs({ 3, 19 }) do
      local px, py = wx + px0, wy + py0
      rect(img, px, py, 14, 14, C("glass"))
      hline(img, px, px + 13, py, C("glass shadow"))
      vline(img, px, py, py + 13, C("glass shadow"))
      for i = 0, 5 do
        img:drawPixel(px + 4 + i, py + 10 - i, C("glass light"))
        img:drawPixel(px + 5 + i, py + 10 - i, C("glass light"))
      end
    end
  end
  hline(img, wx - 2, wx + ww + 1, wy + wh, C("trim"))
  hline(img, wx - 2, wx + ww + 1, wy + wh + 1, C("dark wood"))
  hline(img, wx - 2, wx + ww + 1, wy + wh + 2, C("wall shadow"))
  hline(img, wx - 1, wx + ww + 2, wy + wh + 3, C("wall shadow"))

  -- A rubber gym mat under the treadmill, x 18..111, y 225..234: lit back edge,
  -- a floor lines contact shadow along its front and right, and the treadmill's
  -- own contact shadow on it (outline, the row under the treadmill's bottom row).
  local MY1, MY2 = L.STAND_Y - 6, L.STAND_Y + 3
  hline(img, 19, 112, MY2 + 1, C("floor lines"))
  vline(img, 112, MY1 + 1, MY2 + 1, C("floor lines"))
  rect(img, 18, MY1, 94, MY2 - MY1 + 1, C("belt"))
  hline(img, 18, 111, MY1, C("belt stripe"))
  hline(img, 18, 111, MY2, C("outline"))
  hline(img, 26, 104, L.STAND_Y + 1, C("outline"))

  -- The treadmill stands bottom-centered in this slot, bottom row on L.STAND_Y.
  L.slice(spr, "equipment", 23, L.STAND_Y - 49, 84, 50)
  L.saveSingle(spr, img, "place-treadmill-corner")
end)
if not ok then print("ERROR: " .. tostring(err)) end
