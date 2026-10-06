-- Draws background.aseprite (180x120 wall, floor, window, shelf, medal rack) and its slot slices.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/background.lua")').
-- It OVERWRITES the source in art/room/. To check it instead, set ROOM_OUT to a scratch
-- folder and compare with art/tools/lib/compare-sprites.lua (see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline

  -- background.aseprite: 180x120 wall, floor, window, shelf plank and medal-rack
  -- bar. No items are drawn into it; items go in the slot slices below.
  local W, H = 180, 120
  local spr = L.newSprite(W, H, "room")
  local img = Image(W, H, ColorMode.RGB)

  -- Wall, with a shadow band under the ceiling and above the baseboard.
  rect(img, 0, 0, W, 84, C("wall"))
  rect(img, 0, 0, W, 2, C("wall shadow"))
  hline(img, 0, W - 1, 83, C("wall shadow"))

  -- Baseboard, then the floor. Floor items stand with their bottom row on y = 111.
  rect(img, 0, 84, W, 4, C("trim"))
  hline(img, 0, W - 1, 88, C("dark wood"))
  rect(img, 0, 89, W, 31, C("floor"))
  for _, y in ipairs({ 89, 96, 104, 112 }) do hline(img, 0, W - 1, y, C("floor lines")) end
  for _, band in ipairs({ { 90, 95, 30 }, { 97, 103, 10 }, { 105, 111, 30 }, { 113, 119, 10 } }) do
    local x = band[3]
    while x < W do
      vline(img, x, band[1], band[2], C("floor lines"))
      x = x + 40
    end
  end

  -- Window: dark wood frame (x 12..47, y 12..47), four 14x14 panes, sill below.
  rect(img, 12, 12, 36, 36, C("dark wood"))
  hline(img, 12, 47, 12, C("wood light"))
  hline(img, 12, 47, 47, C("wood shadow"))
  for _, pane in ipairs({ { 15, 15 }, { 31, 15 }, { 15, 31 }, { 31, 31 } }) do
    local px, py = pane[1], pane[2]
    rect(img, px, py, 14, 14, C("glass"))
    hline(img, px, px + 13, py, C("glass shadow"))
    vline(img, px, py, py + 13, C("glass shadow"))
    for i = 0, 5 do
      img:drawPixel(px + 4 + i, py + 10 - i, C("glass light"))
      img:drawPixel(px + 5 + i, py + 10 - i, C("glass light"))
    end
  end
  hline(img, 10, 49, 48, C("trim"))
  hline(img, 10, 49, 49, C("dark wood"))
  hline(img, 10, 49, 50, C("wall shadow"))

  -- Trophy shelf plank (x 56..113): trophies stand on its top row, y = 32.
  hline(img, 56, 113, 32, C("wood light"))
  hline(img, 56, 113, 33, C("dark wood"))
  hline(img, 56, 113, 34, C("wood shadow"))
  hline(img, 56, 113, 35, C("wall shadow"))
  for _, bx in ipairs({ 60, 108 }) do
    vline(img, bx, 35, 39, C("dark wood"))
    vline(img, bx + 1, 35, 39, C("wood shadow"))
  end

  -- Medal rack bar (x 58..111): medals hang from y = 52, just below it.
  hline(img, 58, 111, 50, C("wood light"))
  hline(img, 58, 111, 51, C("dark wood"))
  hline(img, 58, 111, 52, C("wall shadow"))
  img:drawPixel(59, 50, C("metal light"))
  img:drawPixel(110, 50, C("metal light"))

  -- Slot slices (x, y, w, h). roomLayout.ts stands floor and shelf items bottom-center
  -- in their slot and hangs wall items top-center. Every name must be in sheetRules.ts
  -- ROOM_SLOT_SLICES; a new slot is added here and there.
  local SLOTS = {
    { "equipment", 94, 62, 84, 50 },
    { "medal-3", 95, 52, 14, 20 },
    { "medal-1", 61, 52, 14, 20 },
    { "trophy-2", 77, 12, 16, 20 },
    { "trophy-1", 58, 12, 16, 20 },
    { "trophy-3", 96, 12, 16, 20 },
    { "medal-2", 78, 52, 14, 20 },
    { "frame", 128, 14, 36, 28 },
    { "decor", 18, 72, 24, 40 },
  }
  for _, s in ipairs(SLOTS) do L.slice(spr, s[1], s[2], s[3], s[4], s[5]) end
  L.saveSingle(spr, img, "background")
end)
if not ok then print("ERROR: " .. tostring(err)) end
