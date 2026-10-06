-- Draws place-door-right.aseprite (120x270): a closed door at the world's right end. No slices.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-door-right.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 120
  local spr, img = L.newPlace(W)

  L.cloud(img, 26, 18, false)

  -- Closed door 30x64 at x 45..74, y 145..208: a head taller than the athlete,
  -- cut through the baseboard down to the floor line, with a threshold.
  -- A 2 px dark wood casing around a wood light slab with two inset panels. The
  -- light comes from the upper left, as on every place: the casing shades the
  -- slab's top and left edge and casts a wall shadow on the wall to its right.
  local dw, dh = 30, 64
  local dx, dy = 45, L.FLOOR_Y - dh
  rect(img, dx, dy, dw, dh, C("dark wood"))
  rect(img, dx + 2, dy + 2, dw - 4, dh - 2, C("wood light"))
  hline(img, dx + 2, dx + dw - 3, dy + 2, C("dark wood"))
  vline(img, dx + 2, dy + 2, dy + dh - 1, C("dark wood"))
  vline(img, dx + dw, dy + 1, L.BASEBOARD_Y - 1, C("wall shadow"))
  vline(img, dx + dw, L.BASEBOARD_Y, L.BASEBOARD_Y + 3, C("wood light"))
  -- Threshold: a trim sill on the floor line, 1 px wider than the casing each
  -- side, lit on top, with a floor lines contact shadow in front of it.
  hline(img, dx - 1, dx + dw, L.FLOOR_Y, C("trim"))
  hline(img, dx - 1, dx + dw, L.FLOOR_Y + 1, C("wood light"))
  hline(img, dx, dx + dw + 1, L.FLOOR_Y + 2, C("floor lines"))

  -- Wood grain: broken dark wood streaks, running down the stiles and panels and
  -- across the rails (door-local x1, x2, y1, y2). They leave the knob rows clear.
  for _, g in ipairs({
    { 4, 4, 4, 16 }, { 4, 4, 20, 27 }, { 4, 4, 38, 61 },
    { 26, 26, 5, 24 }, { 26, 26, 38, 52 }, { 26, 26, 56, 62 },
    { 8, 16, 29, 29 }, { 12, 21, 32, 32 }, { 7, 18, 60, 60 }, { 10, 22, 4, 4 },
  }) do
    rect(img, dx + g[1], dy + g[3], g[2] - g[1] + 1, g[4] - g[3] + 1, C("dark wood"))
  end
  -- Panels: a wood shadow outline, shaded inside along the top and left, grain inside.
  for _, p in ipairs({ { 6, 6, 18, 22 }, { 6, 34, 18, 24 } }) do
    local px, py, pw, ph = dx + p[1], dy + p[2], p[3], p[4]
    hline(img, px, px + pw - 1, py, C("wood shadow"))
    hline(img, px, px + pw - 1, py + ph - 1, C("wood shadow"))
    vline(img, px, py, py + ph - 1, C("wood shadow"))
    vline(img, px + pw - 1, py, py + ph - 1, C("wood shadow"))
    hline(img, px + 1, px + pw - 2, py + 1, C("dark wood"))
    vline(img, px + 1, py + 1, py + ph - 2, C("dark wood"))
    vline(img, px + 6, py + 3, py + 9, C("dark wood"))
    vline(img, px + 6, py + 13, py + ph - 4, C("dark wood"))
    vline(img, px + 11, py + 4, py + 14, C("dark wood"))
    vline(img, px + 11, py + 18, py + ph - 3, C("dark wood"))
  end
  -- The gap under the door.
  hline(img, dx + 2, dx + dw - 3, dy + dh - 1, C("wood shadow"))

  -- Knob and keyhole on the side facing the world's middle (the left); hinges on the right.
  local kx, hx = dx + 4, dx + dw - 3
  local ky = dy + 30
  img:drawPixel(kx, ky, C("metal light"))
  img:drawPixel(kx + 1, ky, C("metal"))
  img:drawPixel(kx, ky + 1, C("metal"))
  img:drawPixel(kx + 1, ky + 1, C("metal shadow"))
  vline(img, kx, ky + 4, ky + 5, C("outline"))
  for _, hy in ipairs({ dy + 6, dy + 52 }) do
    img:drawPixel(hx, hy, C("metal light"))
    vline(img, hx, hy + 1, hy + 2, C("metal"))
    img:drawPixel(hx, hy + 3, C("metal shadow"))
  end

  L.saveSingle(spr, img, "place-door-right")
end)
if not ok then print("ERROR: " .. tostring(err)) end
