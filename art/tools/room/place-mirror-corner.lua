-- Draws place-mirror-corner.aseprite (130x270): a dressing nook, a full-length mirror leaning on the back wall, and a decor slot.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-mirror-corner.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline
  local W = 130
  local spr, img = L.newPlace(W)

  L.cloud(img, 30, 24, true)

  -- A small dressing nook. Light comes from the window, upper left: things cast
  -- wall shadow down and to the right, and sit on a floor lines contact shadow.
  -- Wall-hugging things stand on the back-wall line (the floor's top rows, 209..212).
  local WALL_LINE = L.FLOOR_Y + 2 -- 211: the mirror's and the sneakers' bottom row

  -- Hook rail x 16..44, y 160..161, with two metal hooks; a blue towel hangs
  -- from one, a red jump rope (loop and two handles) from the other.
  hline(img, 17, 45, 162, C("wall shadow"))
  img:drawPixel(45, 161, C("wall shadow"))
  hline(img, 16, 44, 160, C("wood light"))
  hline(img, 16, 44, 161, C("dark wood"))
  for _, hx in ipairs({ 22, 38 }) do
    img:drawPixel(hx, 162, C("metal"))
    img:drawPixel(hx, 163, C("metal shadow"))
  end
  -- Towel x 18..26, y 164..178: folded over the hook, two white stripes.
  vline(img, 27, 165, 179, C("wall shadow"))
  hline(img, 19, 27, 179, C("wall shadow"))
  rect(img, 18, 164, 9, 15, C("blue"))
  hline(img, 18, 26, 164, C("blue shadow"))
  vline(img, 26, 165, 178, C("blue shadow"))
  hline(img, 18, 26, 178, C("blue shadow"))
  hline(img, 18, 25, 173, C("white"))
  hline(img, 18, 25, 175, C("white"))
  vline(img, 18, 165, 172, C("blue shadow"))
  -- Jump rope on hook x 38: a red loop with two dark handles hanging inside it.
  L.grid(img, 34, 164, {
    "...rr.r.",
    "..r.hh.r",
    ".r..hh..",
    ".r..HH..",
    ".r..HH..",
    ".r..hh..",
    ".r..hh..",
    ".r......",
    ".r.....r",
    ".r.....r",
    "..r...r.",
    "...rrr..",
  }, { r = "red", h = "belt", H = "belt stripe" })
  for y = 166, 175 do img:drawPixel(42, y, C("wall shadow")) end
  hline(img, 37, 41, 176, C("wall shadow"))
  for y = 165, 172 do img:drawPixel(41, y, C("red")) end

  -- Full-length mirror leaning on the back wall: a 24x58 frame face at x 53..76,
  -- y 154..211, its base on the wall line. Its right side edge shows as a depth
  -- strip (x 77..78) that widens toward the floor, because the base stands out
  -- from the wall. 3 px dark wood frame, lit top/left, shaded bottom/right, inner
  -- bevel and a white glint; glass inside.
  local mw, mh = 24, 58
  local mx, my = 53, WALL_LINE - mh + 1
  -- Shadows first: cast on the wall to the right (darker on the baseboard), and a
  -- contact shadow on the floor, a little wider than the base.
  rect(img, mx + mw + 1, my + 3, 3, L.BASEBOARD_Y - my - 3, C("wall shadow"))
  rect(img, mx + mw + 2, L.BASEBOARD_Y, 2, 4, C("wood light"))
  hline(img, mx - 1, mx + mw + 4, WALL_LINE + 1, C("floor lines"))
  hline(img, mx + 1, mx + mw + 3, WALL_LINE + 2, C("floor lines"))
  -- Depth strip: one column all the way down, a second from halfway.
  vline(img, mx + mw, my + 1, WALL_LINE, C("wood shadow"))
  vline(img, mx + mw + 1, my + mh // 2, WALL_LINE, C("wood shadow"))
  img:drawPixel(mx + mw, my + 1, C("dark wood"))
  -- Frame face.
  rect(img, mx, my, mw, mh, C("dark wood"))
  hline(img, mx, mx + mw - 1, my, C("wood light"))
  vline(img, mx, my, my + mh - 1, C("wood light"))
  hline(img, mx + 1, mx + mw - 1, my + mh - 1, C("wood shadow"))
  vline(img, mx + mw - 1, my + 1, my + mh - 1, C("wood shadow"))
  hline(img, mx + 2, mx + mw - 3, my + 2, C("wood shadow"))
  vline(img, mx + 2, my + 2, my + mh - 3, C("wood shadow"))
  hline(img, mx + 3, mx + mw - 3, my + mh - 3, C("wood light"))
  vline(img, mx + mw - 3, my + 3, my + mh - 3, C("wood light"))
  hline(img, mx + 1, mx + 3, my + 1, C("white"))
  vline(img, mx + 1, my + 2, my + 3, C("white"))

  -- Glass: plain glass, a faint reflection of the darker floor in its lower part
  -- (glass shadow, dithered into the glass), shaded on the left, and two diagonal
  -- streaks like the window panes. It never shows the avatar.
  local gx, gy, gw, gh = mx + 3, my + 3, mw - 6, mh - 6
  rect(img, gx, gy, gw, gh, C("glass"))
  local RY = gy + gh - 14 -- reflection band rows RY..bottom
  rect(img, gx, RY, gw, gy + gh - RY, C("glass shadow"))
  for x = gx, gx + gw - 1 do
    if (x - gx) % 2 == 0 then img:drawPixel(x, RY - 1, C("glass shadow")) end
    if (x - gx) % 4 == 1 then img:drawPixel(x, RY - 2, C("glass shadow")) end
  end
  vline(img, gx, gy, gy + gh - 1, C("glass shadow"))
  for _, st in ipairs({ { 4, 14 }, { 7, 28 } }) do
    for i = 0, 6 do
      img:drawPixel(gx + st[1] + i, gy + st[2] - i, C("glass light"))
      img:drawPixel(gx + st[1] + 1 + i, gy + st[2] - i, C("glass light"))
    end
  end

  -- A pair of red sneakers on the wall line right of the mirror, toes right, the
  -- second a pixel forward; each on a floor lines contact shadow.
  local SHOE = {
    "..rr...",
    ".rrwr..",
    "srrrrrr",
    "wwwwwww",
  }
  for _, sh in ipairs({ { 88, WALL_LINE - 3 }, { 97, WALL_LINE - 2 } }) do
    hline(img, sh[1] + 1, sh[1] + 7, sh[2] + 4, C("floor lines"))
    L.grid(img, sh[1], sh[2], SHOE, { r = "red", s = "red shadow", w = "white" })
  end

  -- A blue mat on the floor in front of the mirror, x 46..85, y 215..221: a
  -- blue shadow border, two white stripes, and a contact shadow along its front.
  hline(img, 47, 86, 222, C("floor lines"))
  vline(img, 86, 216, 221, C("floor lines"))
  rect(img, 46, 215, 40, 7, C("blue shadow"))
  rect(img, 47, 216, 38, 5, C("blue"))
  hline(img, 49, 82, 217, C("white"))
  hline(img, 49, 82, 219, C("white"))

  -- hotspot-mirror is exactly the mirror (frame face and depth strip); decor is empty this iteration.
  L.slice(spr, "hotspot-mirror", mx, my, mw + 2, mh)
  L.slice(spr, "decor", 14, L.STAND_Y - 39, 24, 40)
  L.saveSingle(spr, img, "place-mirror-corner")
end)
if not ok then print("ERROR: " .. tostring(err)) end
