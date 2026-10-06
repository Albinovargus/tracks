-- Compares freshly drawn sprites with the committed ones: size, color mode, layers,
-- frame durations, tags, slices (bounds and pivot) and every flattened frame's pixels.
-- Read-only. Use it to prove a drawing script still reproduces the committed art:
--   run_lua_script(script = 'ROOT = "<repo>"; CANDIDATE_DIR = ROOT .. "/.superpowers/art-previews/room-check";
--     IDS = { "background", "treadmill" }; dofile(ROOT .. "/art/tools/lib/compare-sprites.lua")')
-- Optional REFERENCE_DIR (default art/room). Ends with "RESULT: PASS" or "RESULT: FAIL (<n> problems)".
local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
if type(CANDIDATE_DIR) ~= "string" or type(IDS) ~= "table" or #IDS == 0 then
  print("ERROR: set CANDIDATE_DIR and IDS before dofile") return
end
local refDir = (REFERENCE_DIR or P.ROOM):gsub("/+$", "")
local candDir = CANDIDATE_DIR:gsub("/+$", "")

local problems = 0
local function fail(id, msg)
  problems = problems + 1
  print("FAIL " .. id .. ": " .. msg)
end

local function ms(frame) return math.floor(frame.duration * 1000 + 0.5) end

local function layerList(spr)
  local out = {}
  for _, l in ipairs(spr.layers) do
    out[#out + 1] = l.name .. (l.isVisible and "" or "(hidden)")
  end
  return table.concat(out, ",")
end

local function tagList(spr)
  local out = {}
  for _, t in ipairs(spr.tags) do
    out[#out + 1] = string.format("%s:%d-%d:%s", t.name, t.fromFrame.frameNumber, t.toFrame.frameNumber, tostring(t.aniDir))
  end
  return table.concat(out, " ")
end

local function sliceMap(spr)
  local out = {}
  for _, s in ipairs(spr.slices) do
    local b = s.bounds
    local pivot = s.pivot and string.format(" pivot %d,%d", s.pivot.x, s.pivot.y) or ""
    out[s.name] = string.format("%d,%d %dx%d%s", b.x, b.y, b.width, b.height, pivot)
  end
  return out
end

for _, id in ipairs(IDS) do
  local before = problems
  local refPath = refDir .. "/" .. id .. ".aseprite"
  local candPath = candDir .. "/" .. id .. ".aseprite"
  local ref = app.fs.isFile(refPath) and Sprite{ fromFile = refPath } or nil
  local cand = app.fs.isFile(candPath) and Sprite{ fromFile = candPath } or nil
  if not ref then fail(id, "missing " .. refPath) end
  if not cand then fail(id, "missing " .. candPath) end
  if ref and cand then
    if ref.width ~= cand.width or ref.height ~= cand.height then
      fail(id, string.format("size %dx%d, committed %dx%d", cand.width, cand.height, ref.width, ref.height))
    end
    if ref.colorMode ~= cand.colorMode then fail(id, "color mode differs") end
    if layerList(ref) ~= layerList(cand) then
      fail(id, "layers [" .. layerList(cand) .. "], committed [" .. layerList(ref) .. "]")
    end
    if tagList(ref) ~= tagList(cand) then
      fail(id, "tags [" .. tagList(cand) .. "], committed [" .. tagList(ref) .. "]")
    end
    local rs, cs = sliceMap(ref), sliceMap(cand)
    for name, v in pairs(rs) do
      if cs[name] ~= v then fail(id, "slice " .. name .. " is " .. tostring(cs[name]) .. ", committed " .. v) end
    end
    for name, v in pairs(cs) do
      if not rs[name] then fail(id, "extra slice " .. name .. " " .. v) end
    end
    if #ref.frames ~= #cand.frames then
      fail(id, #cand.frames .. " frames, committed " .. #ref.frames)
    elseif ref.width == cand.width and ref.height == cand.height then
      for f = 1, #ref.frames do
        if ms(ref.frames[f]) ~= ms(cand.frames[f]) then
          fail(id, string.format("frame %d lasts %d ms, committed %d ms", f, ms(cand.frames[f]), ms(ref.frames[f])))
        end
        local a = Image(ref.width, ref.height, ColorMode.RGB)
        local b = Image(ref.width, ref.height, ColorMode.RGB)
        a:drawSprite(ref, f)
        b:drawSprite(cand, f)
        local diff = 0
        for y = 0, ref.height - 1 do
          for x = 0, ref.width - 1 do
            if a:getPixel(x, y) ~= b:getPixel(x, y) then diff = diff + 1 end
          end
        end
        if diff > 0 then fail(id, string.format("frame %d has %d differing pixels", f, diff)) end
      end
    end
    if problems == before then
      print(string.format("PASS %s: %dx%d, %d frame(s), identical", id, ref.width, ref.height, #ref.frames))
    end
  end
  if ref then ref:close() end
  if cand then cand:close() end
end

if problems == 0 then
  print("RESULT: PASS")
else
  print("RESULT: FAIL (" .. problems .. " problems)")
end
