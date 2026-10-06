-- Room composite preview: background, sample items, treadmill and body, timed like the app. Read-only.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/preview.lua")').
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  -- Room checkpoint preview. Writes nothing under art/ or apps/web: the output
  -- goes to .superpowers/art-previews (gitignored).
  local OUT = L.PREVIEWS .. "/room-preview.aseprite"

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

  -- Copies the opaque pixels of one sprite frame onto dst at (x, y). Drawing a
  -- sprite straight onto a non-empty image fills its transparent area instead.
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

  -- Same alignment as roomLayout.ts layoutRoom (spec section 3 Room composition), and the
  -- same items as sampleRoom.ts SAMPLE_ROOM: keep the place() list below in step with it.
  local function stand(b, w, h) return b.x + (b.width - w) // 2, b.y + b.height - h end
  local function hang(b, w) return b.x + (b.width - w) // 2, b.y end

  -- Sources are read from art/room/, or from ROOM_OUT when it is set.
  local bg = open(L.OUT .. "background.aseprite")
  local placed = {}
  local function place(id, sliceName, hanging)
    local item = open(L.OUT .. id .. ".aseprite")
    local b = slice(bg, sliceName).bounds
    local x, y
    if hanging then x, y = hang(b, item.width) else x, y = stand(b, item.width, item.height) end
    placed[#placed + 1] = { spr = item, x = x, y = y }
  end
  -- Draw order: background, frame, trophies, medals, then treadmill and avatar.
  place("frame-bib", "frame", true)
  place("trophy-gold", "trophy-1", false)
  place("trophy-silver", "trophy-2", false)
  place("trophy-bronze", "trophy-3", false)
  place("medal-gold", "medal-1", true)
  place("medal-silver", "medal-2", true)
  place("medal-bronze", "medal-3", true)

  local tm = open(L.OUT .. "treadmill.aseprite")
  local tx, ty = stand(slice(bg, "equipment").bounds, tm.width, tm.height)
  local rider = slice(tm, "rider")
  local feetX = tx + rider.bounds.x + rider.pivot.x
  local feetY = ty + rider.bounds.y + rider.pivot.y
  local body = open(L.BODY)
  local idle = tag(body, "front-idle").fromFrame.frameNumber
  local run = tag(body, "side-run")
  local belt = tag(tm, "belt").fromFrame.frameNumber

  -- Frame 1: idle on the stopped belt. Then side-run frame i on belt frame i.
  local shots = { { bodyFrame = idle, beltFrame = belt, duration = 0.5 } }
  for i = 0, run.toFrame.frameNumber - run.fromFrame.frameNumber do
    local f = run.fromFrame.frameNumber + i
    shots[#shots + 1] = { bodyFrame = f, beltFrame = belt + i, duration = body.frames[f].duration }
  end

  local out = Sprite(bg.width, bg.height, ColorMode.RGB)
  for _ = 2, #shots do out:newEmptyFrame() end
  for i, shot in ipairs(shots) do
    local img = Image(bg.width, bg.height, ColorMode.RGB)
    blit(img, bg, 1, 0, 0)
    for _, p in ipairs(placed) do blit(img, p.spr, 1, p.x, p.y) end
    blit(img, tm, shot.beltFrame, tx, ty)
    blit(img, body, shot.bodyFrame, feetX - 32, feetY - 63)
    out:newCel(out.layers[1], i, img, Point(0, 0))
    out.frames[i].duration = shot.duration
  end
  local idleTag = out:newTag(1, 1)
  idleTag.name = "idle"
  local runTag = out:newTag(2, #shots)
  runTag.name = "run"
  out:saveAs(OUT)
  print(string.format("OK preview: treadmill at (%d, %d), avatar feet at (%d, %d), %d run frames",
    tx, ty, feetX, feetY, #shots - 1))
end)
if not ok then print("ERROR: " .. tostring(err)) end
