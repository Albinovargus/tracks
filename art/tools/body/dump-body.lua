-- Rewrites art/tools/body/grids/fNN.txt from the "body" layer of the open sprite so the
-- grids mirror the source: every frame with pixels gets its grid, an empty frame gets
-- none, and grids numbered past the last frame are deleted. Read-only on the sprite.
-- Run it after every GUI edit and after every frame insert or delete:
--   run_lua_script(filename = art/avatar/body.aseprite,
--     script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/body/dump-body.lua")')
-- A clean `git status art/tools/body/grids` afterwards proves grids and source agree.
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local GRID_DIR = P.TOOLS .. "/body/grids/"
local PALETTE_FILE = P.PALETTE
local LAYER_NAME = "body"
local SIZE = 64

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
local layer = nil
for _, l in ipairs(spr.layers) do
  if l.name == LAYER_NAME then layer = l end
end
if not layer then print("ERROR:No layer named " .. LAYER_NAME) return end

local function key(r, g, b) return r * 65536 + g * 256 + b end
local PLACEHOLDERS = {
  [key(255, 128, 255)] = true, [key(255, 64, 255)] = true, [key(255, 0, 255)] = true,
  [key(128, 255, 255)] = true, [key(64, 255, 255)] = true, [key(0, 255, 255)] = true,
  [key(255, 255, 128)] = true, [key(255, 255, 64)] = true, [key(255, 255, 0)] = true,
}
local outline, outlineLuma = nil, math.huge
local pf = io.open(PALETTE_FILE, "r")
if not pf then print("ERROR:Cannot read " .. PALETTE_FILE) return end
for line in pf:lines() do
  local r, g, b = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)")
  if r then
    r, g, b = tonumber(r), tonumber(g), tonumber(b)
    local luma = 299 * r + 587 * g + 114 * b
    if not PLACEHOLDERS[key(r, g, b)] and luma < outlineLuma then
      outline, outlineLuma = key(r, g, b), luma
    end
  end
end
pf:close()
if not outline then print("ERROR:palette.gpl has no fixed colors") return end
local char = { [outline] = "o", [key(255, 128, 255)] = "L", [key(255, 64, 255)] = "B", [key(255, 0, 255)] = "S" }

local pc = app.pixelColor
local dumped, empty = 0, 0
for i, frame in ipairs(spr.frames) do
  local cel = layer:cel(frame)
  local rows, opaque = {}, 0
  for y = 0, SIZE - 1 do
    local row = {}
    for x = 0, SIZE - 1 do
      local ch = "."
      if cel then
        local lx, ly = x - cel.position.x, y - cel.position.y
        if lx >= 0 and ly >= 0 and lx < cel.image.width and ly < cel.image.height then
          local px = cel.image:getPixel(lx, ly)
          local a = pc.rgbaA(px)
          if a == 255 then
            ch = char[key(pc.rgbaR(px), pc.rgbaG(px), pc.rgbaB(px))]
            if not ch then
              print(string.format("ERROR:frame %d pixel (%d, %d) is not outline or PH skin", i, x, y)) return
            end
            opaque = opaque + 1
          elseif a ~= 0 then
            print(string.format("ERROR:frame %d pixel (%d, %d) has alpha %d", i, x, y, a)) return
          end
        end
      end
      row[#row + 1] = ch
    end
    rows[#rows + 1] = table.concat(row)
  end
  local path = GRID_DIR .. string.format("f%02d.txt", i)
  if opaque == 0 then
    os.remove(path)
    empty = empty + 1
  else
    local f = io.open(path, "wb")
    if not f then print("ERROR:Cannot write " .. path) return end
    f:write(table.concat(rows, "\n"), "\n")
    f:close()
    dumped = dumped + 1
  end
end
for i = #spr.frames + 1, 99 do
  os.remove(GRID_DIR .. string.format("f%02d.txt", i))
end
print(string.format("OK dumped=%d empty=%d", dumped, empty))
