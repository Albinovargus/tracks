-- World composite preview: every place side by side with its items and the avatar,
-- laid out like roomLayout.ts layoutWorld, plus phone and desktop crops at home.
-- Read-only: writes PNGs to .superpowers/art-previews/world/ (gitignored).
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/world-preview.lua")').
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local OUT = L.PREVIEWS .. "/world"
  app.fs.makeAllDirectories(OUT)

  -- Keep in step with WORLD and HOME_PLACE in apps/web/src/features/avatar-room/world.ts.
  local WORLD = {
    { sheet = "place-door-left", items = {} },
    { sheet = "place-trophy-wall", items = {
      { "frame", "frame-bib" },
      { "trophy-1", "trophy-gold" }, { "trophy-2", "trophy-silver" }, { "trophy-3", "trophy-bronze" },
      { "medal-1", "medal-gold" }, { "medal-2", "medal-silver" }, { "medal-3", "medal-bronze" },
    } },
    { sheet = "place-treadmill-corner", items = { { "equipment", "treadmill" } }, home = true },
    { sheet = "place-mirror-corner", items = {} },
    { sheet = "place-door-right", items = {} },
  }

  local function open(path)
    local spr = Sprite{ fromFile = path }
    if spr == nil then error("cannot open " .. path) end
    return spr
  end
  local function slice(spr, name)
    for _, s in ipairs(spr.slices) do
      if s.name == name then return s end
    end
    error(spr.filename .. " has no slice " .. name)
  end
  local function tag(spr, name)
    for _, t in ipairs(spr.tags) do
      if t.name == name then return t end
    end
    error(spr.filename .. " has no tag " .. name)
  end
  -- Copies the opaque pixels of one sprite frame onto dst at (x, y).
  local function blit(dst, spr, frame, x, y)
    local flat = Image(spr.width, spr.height, ColorMode.RGB)
    flat:drawSprite(spr, frame)
    for py = 0, spr.height - 1 do
      for px = 0, spr.width - 1 do
        local c = flat:getPixel(px, py)
        if app.pixelColor.rgbaA(c) > 0 then dst:drawPixel(x + px, y + py, c) end
      end
    end
  end
  -- Same rule as roomLayout.ts slotAlignment.
  local function hanging(slot) return slot == "frame" or slot:match("^medal%-%d+$") ~= nil end

  -- Places left to right; every place must be the same height.
  local places, W, H = {}, 0, nil
  for _, def in ipairs(WORLD) do
    local spr = open(L.OUT .. def.sheet .. ".aseprite")
    if H == nil then H = spr.height end
    if spr.height ~= H then error(def.sheet .. " is " .. spr.height .. " tall, expected " .. H) end
    places[#places + 1] = { def = def, spr = spr, x = W }
    W = W + spr.width
  end

  -- Draw order as in layoutWorld: every place, then each place's items, then the avatar.
  local img = Image(W, H, ColorMode.RGB)
  for _, p in ipairs(places) do blit(img, p.spr, 1, p.x, 0) end
  local feetX, feetY, homeCenter
  for _, p in ipairs(places) do
    if p.def.home then homeCenter = p.x + p.spr.width // 2 end
    for _, item in ipairs(p.def.items) do
      local spr = open(L.OUT .. item[2] .. ".aseprite")
      local b = slice(p.spr, item[1]).bounds
      local ix = p.x + b.x + (b.width - spr.width) // 2
      local iy = hanging(item[1]) and b.y or (b.y + b.height - spr.height)
      local frame = 1
      if item[1] == "equipment" then
        frame = tag(spr, "belt").fromFrame.frameNumber
        local r = slice(spr, "rider")
        feetX, feetY = ix + r.bounds.x + r.pivot.x, iy + r.bounds.y + r.pivot.y
      end
      blit(img, spr, frame, ix, iy)
    end
  end
  if feetX == nil then error("no equipment item: nowhere to stand the avatar") end
  if homeCenter == nil then error("no home place") end
  local body = open(L.BODY)
  blit(img, body, tag(body, "front-idle").fromFrame.frameNumber, feetX - 32, feetY - 63)

  -- A bottom-anchored w x h crop centered on world x cx, clamped to the world.
  local function crop(w, h, cx)
    local left = math.max(0, math.min(W - w, cx - w // 2))
    local c = Image(w, h, ColorMode.RGB)
    c:drawImage(img, Point(-left, -(H - h)))
    return c
  end
  -- Saves src as <OUT>/<name>.png, upscaled nearest-neighbor by `scale`.
  local function save(src, name, scale)
    local spr = Sprite(src.width, src.height, ColorMode.RGB)
    spr:newCel(spr.layers[1], 1, src, Point(0, 0))
    if scale > 1 then app.command.SpriteSize{ ui = false, scale = scale, method = "nearest" } end
    spr:saveCopyAs(OUT .. "/" .. name .. ".png")
    spr:close()
  end
  save(img, "world", 2)
  save(crop(117, 253, homeCenter), "iphone14-home", 3) -- spec §3 table: k 10 @3
  save(crop(427, 267, homeCenter), "desktop-1280x800-home", 2) -- k 3 @1
  print(string.format("OK world %dx%d, home center x %d, avatar feet (%d, %d)", W, H, homeCenter, feetX, feetY))
end)
if not ok then print("ERROR: " .. tostring(err)) end
