-- Contact sheet of the body plus every garment in G.ORDER up to UPTO, cropped, 5-px grid.
-- Read-only. Run: run_lua_script(script = 'ROOT = "<repo>"; UPTO = "top-starter-tee";
--   dofile(ROOT .. "/art/tools/garments/montage.lua")'). Writes .superpowers/art-previews/montage-<UPTO>.png.
-- UPTO = "body" draws the body alone.
-- Optional globals: MFRAMES (list), MCOLS, MSCALE, MX0/MY0/MX1/MY1 (crop), MOUT (file name).
local G = dofile(ROOT .. "/art/tools/garments/lib.lua")
if type(UPTO) ~= "string" then print("ERROR: set UPTO to body or one of: " .. table.concat(G.ORDER, ", ")) return end
local pc = app.pixelColor
local body = app.open(G.BODY)
local stack = {}
for _, name in ipairs(UPTO == "body" and {} or G.ORDER) do
  if app.fs.isFile(G.path(name)) then stack[#stack + 1] = app.open(G.path(name)) end
  if name == UPTO then break end
end
local X0, Y0, X1, Y1 = MX0 or 15, MY0 or 13, MX1 or 46, MY1 or 63
local S = MSCALE or 7
local FR = MFRAMES or { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 }
local COLS = MCOLS or 8
local cw, ch = (X1 - X0 + 1) * S, (Y1 - Y0 + 1) * S
local rows = math.ceil(#FR / COLS)
local img = Image(COLS * (cw + 6) + 6, rows * (ch + 6) + 6, ColorMode.RGB)
img:clear(pc.rgba(60, 60, 70, 255))
for n, f in ipairs(FR) do
  local g = G.flatten(body, f)
  for _, s in ipairs(stack) do
    local gg = G.flatten(s, f)
    for i = 1, gg.w * gg.h do if gg.a[i] > 0 then g.a[i] = 255; g.c[i] = gg.c[i] end end
  end
  local ox = 6 + ((n - 1) % COLS) * (cw + 6)
  local oy = 6 + ((n - 1) // COLS) * (ch + 6)
  for y = Y0, Y1 do for x = X0, X1 do
    local i = G.idx(g, x, y)
    local c = g.a[i] > 0 and g.c[i] or 0xD8C8A8
    for sy = 0, S - 1 do for sx = 0, S - 1 do
      local k = 1
      if (sx == 0 and x % 5 == 0) or (sy == 0 and y % 5 == 0) then k = 0.75 end
      img:drawPixel(ox + (x - X0) * S + sx, oy + (y - Y0) * S + sy,
        pc.rgba(math.floor(((c >> 16) & 255) * k), math.floor(((c >> 8) & 255) * k), math.floor((c & 255) * k), 255))
    end end
  end end
end
img:saveAs(G.PREVIEWS .. "/" .. (MOUT or ("montage-" .. UPTO)) .. ".png")
print("montage ok")
