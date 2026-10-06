-- Draws place-door-left.aseprite (120x270): a closed door at the world's left end. No slices.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/place-door-left.lua")').
-- It OVERWRITES the source in art/room/ (or saves to ROOM_OUT when set; see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local spr, img = L.newPlace(120)

  L.cloud(img, 70, 21, true)
  L.door(img, { knob = "right" })

  L.saveSingle(spr, img, "place-door-left")
end)
if not ok then print("ERROR: " .. tostring(err)) end
