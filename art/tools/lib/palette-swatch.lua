-- Renders art/palette.gpl as 32 px swatches, 8 per row, to .superpowers/art-previews/palette.png.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/lib/palette-swatch.lua")').
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local colors = {}
local pf = io.open(P.PALETTE, "r")
if not pf then print("ERROR:Cannot read palette.gpl") return end
for line in pf:lines() do
  local r, g, b = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)")
  if r then colors[#colors + 1] = app.pixelColor.rgba(tonumber(r), tonumber(g), tonumber(b), 255) end
end
pf:close()
local COLS, SW = 8, 32
local rowsN = math.ceil(#colors / COLS)
local img = Image(COLS * SW, rowsN * SW, ColorMode.RGB)
for i, px in ipairs(colors) do
  local cx, cy = ((i - 1) % COLS) * SW, ((i - 1) // COLS) * SW
  for y = cy, cy + SW - 1 do
    for x = cx, cx + SW - 1 do img:putPixel(x, y, px) end
  end
end
img:saveAs(P.previews() .. "/palette.png")
print("OK colors=" .. #colors)
