-- Paints one garment layer from its ops file, drawn against the hidden
-- body-ref: every masked body pixel is recolored skin light/base/shadow ->
-- PH cloth light/base/shadow (outline stays outline), so the garment follows
-- the body's shape, shading and outline exactly. A cloth light/base pixel
-- that touches bare skin (4-neighbor, outside the mask) becomes PH cloth
-- shadow: the hem. Then "px" ops place single pixels.
-- Repaints EVERY frame of the garment layer; GUI touch-ups are lost, so put
-- touch-ups in "px" ops instead. With CHECK = true it paints in memory only and
-- reports whether the ops reproduce the saved layer (nothing is saved).
--
-- Run: run_lua_script(script = 'ROOT = "<repo>"; GARMENT = "top-starter-tee";
--   dofile(ROOT .. "/art/tools/garments/paint.lua")'). It SAVES the garment source.
-- Ops file: art/tools/garments/ops/<GARMENT>.lua returns one entry per frame
-- (1-based, same count as body). An entry is a list of ops applied in order:
--   { "add", rect = { x, y, w, h } }        mask += opaque body pixels in rect
--   { "add", poly = { x1, y1, x2, y2, ... } } same for a polygon (3+ points,
--                                            edges included)
--   { "cut", rect = ... } / { "cut", poly = ... }  mask -= region
--   { "cut", seed = { x, y }, limit = { x, y, w, h } }
--        mask -= the 4-connected skin component at the seed (flood stops at
--        outline, transparency and the optional limit rect) plus the outline
--        pixels 8-adjacent to it: a nearer limb, with its own outline
--   { "add", seed = ..., limit = ... }       mask += that component
--   { "px", at = { x, y }, color = "light" | "base" | "shadow" | "outline" | "clear" }
-- or { from = n, dx = 0, dy = 0 }: frame n's ops shifted by (dx, dy).
-- Afterwards it writes previews (body-ref plus every painted garment up to
-- this one, in draw order, 8x on the wall color) to
-- .superpowers/art-previews/<GARMENT>-fNN.png.
local G = dofile(ROOT .. "/art/tools/garments/lib.lua")

if not GARMENT or not G.LAYER[GARMENT] then
  print("ERROR: set GARMENT to one of: " .. table.concat(G.ORDER, ", "))
  return
end
local path = G.path(GARMENT)
local spr = app.open(path)
if not spr then print("ERROR: cannot open " .. path) return end
local ref = G.topLayer(spr, G.REF)
local layer = G.topLayer(spr, G.LAYER[GARMENT])
if not ref or not layer then print("ERROR: " .. GARMENT .. " needs top-level layers " .. G.REF .. " and " .. G.LAYER[GARMENT]) return end

local body = app.open(G.BODY)
if not body then print("ERROR: cannot open " .. G.BODY) return end
local outline = G.outlineColor(body)

local opsPath = G.TOOLS .. "/ops/" .. GARMENT .. ".lua"
local loaded, ops = pcall(dofile, opsPath)
if not loaded then print("ERROR: " .. tostring(ops)) return end
if type(ops) ~= "table" or #ops ~= #spr.frames then
  print("ERROR: " .. opsPath .. " must return " .. #spr.frames .. " frame entries")
  return
end

local function shifted(op, dx, dy)
  local out = { op[1], color = op.color }
  if op.rect then out.rect = { op.rect[1] + dx, op.rect[2] + dy, op.rect[3], op.rect[4] } end
  if op.limit then out.limit = { op.limit[1] + dx, op.limit[2] + dy, op.limit[3], op.limit[4] } end
  if op.seed then out.seed = { op.seed[1] + dx, op.seed[2] + dy } end
  if op.at then out.at = { op.at[1] + dx, op.at[2] + dy } end
  if op.poly then
    out.poly = {}
    for k = 1, #op.poly, 2 do
      out.poly[k] = op.poly[k] + dx
      out.poly[k + 1] = op.poly[k + 1] + dy
    end
  end
  return out
end

local function resolve(f, depth)
  local entry = ops[f]
  if type(entry) ~= "table" then error("frame " .. f .. ": entry is not a table") end
  if entry.from == nil then return entry end
  if depth > 8 then error("frame " .. f .. ": 'from' chain is longer than 8") end
  local list = {}
  for _, op in ipairs(resolve(entry.from, depth + 1)) do
    list[#list + 1] = shifted(op, entry.dx or 0, entry.dy or 0)
  end
  return list
end

local function rectSet(b, r)
  local set = {}
  for y = r[2], r[2] + r[4] - 1 do
    for x = r[1], r[1] + r[3] - 1 do
      local i = G.idx(b, x, y)
      if i then set[i] = true end
    end
  end
  return set
end

local function polySet(b, poly, f)
  if #poly < 6 or #poly % 2 ~= 0 then error("frame " .. f .. ": poly needs 3+ x,y pairs") end
  local xs, ys = {}, {}
  for k = 1, #poly, 2 do
    xs[#xs + 1] = poly[k]
    ys[#ys + 1] = poly[k + 1]
  end
  local set = {}
  local minX, maxX, minY, maxY = math.huge, -math.huge, math.huge, -math.huge
  for k = 1, #xs do
    minX, maxX = math.min(minX, xs[k]), math.max(maxX, xs[k])
    minY, maxY = math.min(minY, ys[k]), math.max(maxY, ys[k])
  end
  for y = minY, maxY do
    for x = minX, maxX do
      local inside, j = false, #xs
      for k = 1, #xs do
        if (ys[k] > y) ~= (ys[j] > y) and x < (xs[j] - xs[k]) * (y - ys[k]) / (ys[j] - ys[k]) + xs[k] then
          inside = not inside
        end
        j = k
      end
      local i = G.idx(b, x, y)
      if inside and i then set[i] = true end
    end
  end
  for k = 1, #xs do
    local x0, y0 = xs[k], ys[k]
    local x1, y1 = xs[k % #xs + 1], ys[k % #xs + 1]
    local dx, sx = math.abs(x1 - x0), x0 < x1 and 1 or -1
    local dy, sy = -math.abs(y1 - y0), y0 < y1 and 1 or -1
    local err = dx + dy
    while true do
      local i = G.idx(b, x0, y0)
      if i then set[i] = true end
      if x0 == x1 and y0 == y1 then break end
      local e2 = 2 * err
      if e2 >= dy then err = err + dy; x0 = x0 + sx end
      if e2 <= dx then err = err + dx; y0 = y0 + sy end
    end
  end
  return set
end

local function seedSet(b, op, f)
  local sx, sy = op.seed[1], op.seed[2]
  local l = op.limit or { 0, 0, b.w, b.h }
  local function inLimit(x, y)
    return x >= l[1] and y >= l[2] and x < l[1] + l[3] and y < l[2] + l[4]
  end
  local i0 = G.idx(b, sx, sy)
  if not i0 or b.a[i0] == 0 or not G.skinShade(b.c[i0]) then
    error("frame " .. f .. ": seed (" .. sx .. "," .. sy .. ") is not a skin pixel")
  end
  if not inLimit(sx, sy) then error("frame " .. f .. ": seed (" .. sx .. "," .. sy .. ") is outside its limit") end
  local set, stack = { [i0] = true }, { { sx, sy } }
  while #stack > 0 do
    local p = table.remove(stack)
    for _, d in ipairs(G.N4) do
      local nx, ny = p[1] + d[1], p[2] + d[2]
      local j = G.idx(b, nx, ny)
      if j and not set[j] and inLimit(nx, ny) and b.a[j] > 0 and G.skinShade(b.c[j]) then
        set[j] = true
        stack[#stack + 1] = { nx, ny }
      end
    end
  end
  local ring, n = {}, 0
  local x0, y0, x1, y1 = b.w, b.h, -1, -1
  for i in pairs(set) do
    local x, y = (i - 1) % b.w, (i - 1) // b.w
    n = n + 1
    x0, y0, x1, y1 = math.min(x0, x), math.min(y0, y), math.max(x1, x), math.max(y1, y)
    for _, d in ipairs(G.N8) do
      local j = G.idx(b, x + d[1], y + d[2])
      if j and not set[j] and inLimit(x + d[1], y + d[2]) and b.a[j] > 0 and b.c[j] == outline then ring[j] = true end
    end
  end
  for j in pairs(ring) do set[j] = true end
  print(string.format("  frame %d %s seed (%d,%d): %d skin px, x %d-%d, y %d-%d", f, op[1], sx, sy, n, x0, x1, y0, y1))
  return set
end

local COLORS = { light = G.CLOTH.light, base = G.CLOTH.base, shadow = G.CLOTH.shadow, outline = outline }

local function paintFrame(f, list)
  local b = G.layerGrid(spr, ref, f)
  local mask = {}
  for _, op in ipairs(list) do
    local kind = op[1]
    if kind == "add" or kind == "cut" then
      local set
      if op.rect then set = rectSet(b, op.rect)
      elseif op.poly then set = polySet(b, op.poly, f)
      elseif op.seed then set = seedSet(b, op, f)
      else error("frame " .. f .. ": " .. kind .. " needs rect, poly or seed") end
      for i in pairs(set) do
        if kind == "add" then
          if b.a[i] > 0 then mask[i] = true end
        else
          mask[i] = nil
        end
      end
    elseif kind ~= "px" then
      error("frame " .. f .. ": unknown op '" .. tostring(kind) .. "'")
    end
  end
  local out = G.newGrid(b.w, b.h)
  for i in pairs(mask) do
    local c = b.c[i]
    local shade = G.skinShade(c)
    out.a[i] = 255
    if shade then
      out.c[i] = G.CLOTH[shade]
    else
      out.c[i] = outline
      if c ~= outline then
        print(string.format("  WARN frame %d (%d,%d): body color %s under the garment became outline", f, (i - 1) % b.w, (i - 1) // b.w, G.hex(c)))
      end
    end
  end
  for i in pairs(mask) do
    if out.c[i] == G.CLOTH.light or out.c[i] == G.CLOTH.base then
      local x, y = (i - 1) % b.w, (i - 1) // b.w
      for _, d in ipairs(G.N4) do
        local j = G.idx(b, x + d[1], y + d[2])
        if j and not mask[j] and b.a[j] > 0 and G.skinShade(b.c[j]) then
          out.c[i] = G.CLOTH.shadow
          break
        end
      end
    end
  end
  for _, op in ipairs(list) do
    if op[1] == "px" then
      local i = G.idx(out, op.at[1], op.at[2])
      if not i then error("frame " .. f .. ": px (" .. op.at[1] .. "," .. op.at[2] .. ") is off the canvas") end
      if op.color == "clear" then
        out.a[i] = 0
      elseif COLORS[op.color] then
        out.a[i] = 255
        out.c[i] = COLORS[op.color]
      else
        error("frame " .. f .. ": px color must be light, base, shadow, outline or clear")
      end
    end
  end
  local counts, total = { [G.CLOTH.light] = 0, [G.CLOTH.base] = 0, [G.CLOTH.shadow] = 0, [outline] = 0 }, 0
  for i = 1, out.w * out.h do
    if out.a[i] > 0 then
      total = total + 1
      counts[out.c[i]] = counts[out.c[i]] + 1
    end
  end
  local cel = layer:cel(spr.frames[f])
  if cel then spr:deleteCel(cel) end
  if total > 0 then spr:newCel(layer, spr.frames[f], G.toImage(out), Point(0, 0)) end
  print(string.format("frame %2d (%s): %d px = light %d, base %d, shadow %d, outline %d", f, G.tagOf(spr, f), total,
    counts[G.CLOTH.light], counts[G.CLOTH.base], counts[G.CLOTH.shadow], counts[outline]))
end

local before = {}
for f = 1, #spr.frames do before[f] = G.layerGrid(spr, layer, f) end
local ok, err = pcall(function()
  for f = 1, #spr.frames do paintFrame(f, resolve(f, 0)) end
end)
if not ok then
  print("ERROR: " .. tostring(err) .. " (nothing saved)")
  return
end
if CHECK then
  local changed = {}
  for f = 1, #spr.frames do
    local a, b = before[f], G.layerGrid(spr, layer, f)
    for i = 1, a.w * a.h do
      if a.a[i] ~= b.a[i] or (a.a[i] > 0 and a.c[i] ~= b.c[i]) then
        changed[#changed + 1] = tostring(f)
        break
      end
    end
  end
  if #changed == 0 then
    print("CHECK PASS " .. GARMENT .. ": the ops reproduce all " .. #spr.frames .. " frames (nothing saved)")
  else
    print("CHECK FAIL " .. GARMENT .. ": the ops change frame(s) " .. table.concat(changed, ", ") .. " (nothing saved)")
  end
  return
end
spr:saveAs(path)
print("SAVED " .. path)

local stack = {}
for _, name in ipairs(G.ORDER) do
  if name == GARMENT then
    stack[#stack + 1] = spr
    break
  end
  if app.fs.isFile(G.path(name)) then stack[#stack + 1] = app.open(G.path(name)) end
end
for f = 1, #spr.frames do
  local grid = G.layerGrid(spr, ref, f)
  for _, s in ipairs(stack) do
    local g = G.flatten(s, f)
    for i = 1, g.w * g.h do
      if g.a[i] > 0 then
        grid.a[i] = g.a[i]
        grid.c[i] = g.c[i]
      end
    end
  end
  G.savePreview(grid, 8, 0xD8C8A8, string.format("%s/%s-f%02d.png", G.PREVIEWS, GARMENT, f))
end
print(string.format("PREVIEWS %s/%s-f01.png .. -f%02d.png", G.PREVIEWS, GARMENT, #spr.frames))
