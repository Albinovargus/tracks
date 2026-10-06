-- Paints the "body" layer of every frame of the open sprite from art/tools/body/grids/fNN.txt
-- and SAVES the sprite. Run: run_lua_script(filename = art/avatar/body.aseprite,
--   script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/body/paint-body.lua")').
-- Legend: . transparent, o outline (darkest fixed palette.gpl color),
-- L/B/S = PH skin light/base/shadow. Frames without a grid file are left as they are.
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
local GRID_DIR = P.TOOLS .. "/body/grids/"
local PALETTE_FILE = P.PALETTE
local LAYER_NAME = "body"
local SIZE = 64

local spr = app.activeSprite
if not spr then print("ERROR:No active sprite") return end
if spr.colorMode ~= ColorMode.RGB then print("ERROR:Sprite must be RGB") return end
if spr.width ~= SIZE or spr.height ~= SIZE then print("ERROR:Sprite must be 64x64") return end

local layer = nil
for _, l in ipairs(spr.layers) do
  if l.name == LAYER_NAME then layer = l end
end
if not layer then print("ERROR:No layer named " .. LAYER_NAME) return end
if layer.isBackground or not layer.isVisible or layer.opacity ~= 255 or layer.blendMode ~= BlendMode.NORMAL then
  print("ERROR:Layer must be visible, non-background, opacity 255, Normal blend") return
end

local function key(r, g, b) return r * 65536 + g * 256 + b end
local SKIN = { L = { 255, 128, 255 }, B = { 255, 64, 255 }, S = { 255, 0, 255 } }
local PLACEHOLDERS = {
  [key(255, 128, 255)] = true, [key(255, 64, 255)] = true, [key(255, 0, 255)] = true,
  [key(128, 255, 255)] = true, [key(64, 255, 255)] = true, [key(0, 255, 255)] = true,
  [key(255, 255, 128)] = true, [key(255, 255, 64)] = true, [key(255, 255, 0)] = true,
}

local inPalette = {}
local outline = nil
local outlineLuma = math.huge
local pf = io.open(PALETTE_FILE, "r")
if not pf then print("ERROR:Cannot read " .. PALETTE_FILE) return end
for line in pf:lines() do
  local r, g, b = line:match("^%s*(%d+)%s+(%d+)%s+(%d+)")
  if r then
    r, g, b = tonumber(r), tonumber(g), tonumber(b)
    inPalette[key(r, g, b)] = true
    local luma = 299 * r + 587 * g + 114 * b
    if not PLACEHOLDERS[key(r, g, b)] and luma < outlineLuma then
      outline = { r, g, b }
      outlineLuma = luma
    end
  end
end
pf:close()
if not outline then print("ERROR:palette.gpl has no fixed colors") return end
for ch, c in pairs(SKIN) do
  if not inPalette[key(c[1], c[2], c[3])] then print("ERROR:palette.gpl lacks PH skin " .. ch) return end
end

local legend = { o = outline, L = SKIN.L, B = SKIN.B, S = SKIN.S }
local pixel = {}
for ch, c in pairs(legend) do pixel[ch] = app.pixelColor.rgba(c[1], c[2], c[3], 255) end
print(string.format("outline=#%02x%02x%02x", outline[1], outline[2], outline[3]))

local function readGrid(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local rows = {}
  for line in f:lines() do
    line = line:gsub("\r$", "")
    if #line > 0 then rows[#rows + 1] = line end
  end
  f:close()
  return rows
end

local painted, missing = 0, 0
local failure = nil
app.transaction(function()
  for i, frame in ipairs(spr.frames) do
    local name = string.format("f%02d.txt", i)
    local rows = readGrid(GRID_DIR .. name)
    if not rows then
      missing = missing + 1
      print(name .. " missing (frame left unchanged)")
    else
      if #rows ~= SIZE then failure = name .. " has " .. #rows .. " rows, expected 64" return end
      local img = Image(SIZE, SIZE, ColorMode.RGB)
      local top, minX, maxX, opaque = SIZE, SIZE, -1, 0
      local soleFrom, soleTo = nil, nil
      for y = 0, SIZE - 1 do
        local row = rows[y + 1]
        if #row ~= SIZE then failure = name .. " row " .. y .. " has " .. #row .. " chars, expected 64" return end
        for x = 0, SIZE - 1 do
          local ch = row:sub(x + 1, x + 1)
          if ch ~= "." then
            local px = pixel[ch]
            if not px then failure = name .. " row " .. y .. " col " .. x .. " has unknown char '" .. ch .. "'" return end
            img:putPixel(x, y, px)
            opaque = opaque + 1
            if y < top then top = y end
            if x < minX then minX = x end
            if x > maxX then maxX = x end
            if y == SIZE - 1 then
              if not soleFrom then soleFrom = x end
              soleTo = x
            end
          end
        end
      end
      local cel = layer:cel(frame)
      if cel then
        cel.image = img
        cel.position = Point(0, 0)
      else
        cel = spr:newCel(layer, frame, img, Point(0, 0))
      end
      cel.opacity = 255
      painted = painted + 1
      local sole = "none"
      if soleFrom then sole = soleFrom .. ".." .. soleTo end
      print(string.format("%s opaque=%d top=%d x=%d..%d center=%.1f row63=%s",
        name, opaque, top, minX, maxX, (minX + maxX) / 2, sole))
    end
  end
end)
if failure then print("ERROR:" .. failure) return end
spr:saveAs(spr.filename)
print(string.format("OK painted=%d missing=%d", painted, missing))
