-- Draws place-door-right.aseprite (120x270): a closed door at the world's right end. No slices.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-door-right.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 120
  local spr, img = L.newPlace(W)

  -- Closed door 32x82 at x 44..75, y 157..238: it fills the wainscot from just
  -- under the chair rail down to the floor line, replacing the baseboard there.
  -- A 2 px dark wood frame, a wood light panel with two inset wood shadow panel outlines.
  local dx, dy, dw, dh = 44, L.RAIL_Y + 3, 32, 82
  rect(img, dx, dy, dw, dh, C("dark wood"))
  rect(img, dx + 2, dy + 2, dw - 4, dh - 2, C("wood light"))
  for _, p in ipairs({ { 6, 6, 20, 30 }, { 6, 46, 20, 30 } }) do
    local px, py, pw, ph = dx + p[1], dy + p[2], p[3], p[4]
    hline(img, px, px + pw - 1, py, C("wood shadow"))
    hline(img, px, px + pw - 1, py + ph - 1, C("wood shadow"))
    vline(img, px, py, py + ph - 1, C("wood shadow"))
    vline(img, px + pw - 1, py, py + ph - 1, C("wood shadow"))
  end
  -- Knob on the side facing the world's middle (the left).
  rect(img, 49, dy + 40, 2, 2, C("metal light"))

  L.saveSingle(spr, img, "place-door-right")
end)
if not ok then print("ERROR: " .. tostring(err)) end
