-- Draws place-door-right.aseprite (120x270): a closed door at the world's right end. No slices.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-door-right.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local spr, img = L.newPlace(120)

  L.cloud(img, 26, 18, false)
  L.door(img, { knob = "left" })

  L.saveSingle(spr, img, "place-door-right")
end)
if not ok then print("ERROR: " .. tostring(err)) end
