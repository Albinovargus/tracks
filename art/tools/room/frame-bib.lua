-- Draws frame-bib.aseprite: the framed race bib "42".
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/frame-bib.lua")').
-- It OVERWRITES the source in art/room/. To check it instead, set ROOM_OUT to a scratch
-- folder and compare with art/tools/lib/compare-sprites.lua (see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline

  -- frame-bib.aseprite: a framed race bib, 32x24, hung top-center from its slot.
  local W, H = 32, 24
  local spr = L.newSprite(W, H, "frame-bib")
  local img = Image(W, H, ColorMode.RGB)
  rect(img, 0, 0, W, H, C("wood shadow"))
  rect(img, 1, 1, W - 2, H - 2, C("dark wood"))
  hline(img, 1, W - 2, 1, C("wood light"))
  vline(img, 1, 1, H - 2, C("wood light"))
  rect(img, 3, 3, 26, 18, C("wall shadow"))
  rect(img, 6, 5, 20, 14, C("white"))
  rect(img, 6, 5, 20, 2, C("red"))
  hline(img, 6, 25, 7, C("red shadow"))
  rect(img, 6, 16, 20, 2, C("blue"))
  hline(img, 6, 25, 18, C("blue shadow"))
  for _, pin in ipairs({ { 7, 6 }, { 24, 6 }, { 7, 17 }, { 24, 17 } }) do
    img:drawPixel(pin[1], pin[2], C("metal light"))
  end
  -- Race number 42.
  L.grid(img, 12, 9, {
    "k.k.kkk",
    "k.k...k",
    "kkk.kkk",
    "..k.k..",
    "..k.kkk",
  }, { k = "outline" })
  L.saveSingle(spr, img, "frame-bib")
end)
if not ok then print("ERROR: " .. tostring(err)) end
