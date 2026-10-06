-- Checks that art/palette.gpl has every room color by name and the spec's fixed room colors. Read-only.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/check-palette.lua")').
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  -- Every fixed color the room scripts use, by its art/palette.gpl name.
  local USED = {
    "outline", "white", "metal light", "metal", "metal shadow", "belt stripe", "belt",
    "wall", "wall shadow", "trim", "floor", "floor lines", "wood light", "dark wood",
    "wood shadow", "glass light", "glass", "glass shadow", "gold light", "gold",
    "gold shadow", "bronze light", "bronze", "bronze shadow", "red", "red shadow",
    "blue", "blue shadow", "leaf light", "leaf", "leaf shadow", "terracotta",
  }
  for _, name in ipairs(USED) do L.C(name) end
  -- The room colors fixed by the spec (section 1 Style).
  local SPEC = {
    wall = 0xd8c8a8, trim = 0xb59e7a, floor = 0x8c5e3c,
    ["floor lines"] = 0x7a5032, ["dark wood"] = 0x6e4b32, glass = 0x9fd0ef,
  }
  local pc = app.pixelColor
  for name, rgb in pairs(SPEC) do
    local c = L.C(name)
    local got = (pc.rgbaR(c) << 16) | (pc.rgbaG(c) << 8) | pc.rgbaB(c)
    if got ~= rgb then
      error(string.format("%s is #%06x, the spec says #%06x", name, got, rgb))
    end
  end
  print("OK palette: " .. #USED .. " room colors found, spec room colors match")
end)
if not ok then print("ERROR: " .. tostring(err)) end
