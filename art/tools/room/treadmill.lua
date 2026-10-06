-- Draws treadmill.aseprite: static frame layer, belt layer timed to the body's side-run, rider slice.
-- Run: run_lua_script(script = 'ROOT = "<repo>"; dofile(ROOT .. "/art/tools/room/treadmill.lua")').
-- It OVERWRITES the source in art/room/. To check it instead, set ROOM_OUT to a scratch
-- folder and compare with art/tools/lib/compare-sprites.lua (see art/README.md).
local ok, err = pcall(function()
  local L = dofile(ROOT .. "/art/tools/room/prelude.lua")
  local C, rect, hline, vline = L.C, L.rect, L.hline, L.vline

  -- Treadmill layout, treadmill-local. 80x48 with the bottom row (y = 47) on
  -- the floor, runner facing +x. The belt surface is x 6..59 on y = 38 (two rows
  -- deep). The rider slice is x 16..47, y 0..37, with its pivot (the foot
  -- point) at (32, 37), so soles sit on the row just above the belt. Above the
  -- belt, nothing is drawn left of x = 48.
  local W, H = 80, 48
  local BELT_X1, BELT_X2, BELT_Y = 6, 59, 38

  -- 1. side-run timing and the planted foot's per-frame travel, read from
  --    body.aseprite (the timing reference). Row 63 is the ground row: soles
  --    touch it in contact frames only.
  local body = Sprite{ fromFile = L.BODY }
  local run
  for _, tag in ipairs(body.tags) do
    if tag.name == "side-run" then run = tag end
  end
  if run == nil then error("body.aseprite has no side-run tag") end
  local first, last = run.fromFrame.frameNumber, run.toFrame.frameNumber
  local n = last - first + 1
  local ground = body.height - 1
  local durations, soles = {}, {}
  for f = first, last do
    durations[#durations + 1] = body.frames[f].duration
    local flat = Image(body.width, body.height, ColorMode.RGB)
    flat:drawSprite(body, f)
    local left, right
    for x = 0, body.width - 1 do
      if app.pixelColor.rgbaA(flat:getPixel(x, ground)) > 0 then
        left = left or x
        right = x
      end
    end
    soles[#soles + 1] = left and { left, right } or false
  end
  body:close()

  -- A contact pair whose sole moved left by the same amount at both ends is the
  -- planted foot; pairs where the feet change are skipped. The loop wraps.
  local shift
  for i = 1, n do
    local a, b = soles[i], soles[i % n + 1]
    if a and b then
      local dl, dr = a[1] - b[1], a[2] - b[2]
      if dl == dr and dl > 0 then
        if shift ~= nil and shift ~= dl then
          error("side-run planted-foot travel is not constant: " .. shift .. " and " .. dl .. " px")
        end
        shift = dl
      end
    end
  end
  if shift == nil then
    error("no side-run frame pair has a planted sole moving backward on row " .. ground)
  end

  -- 2. Stripe spacing: the smallest divisor of one cycle's total shift that is
  --    more than twice the shift (so the belt never reads as reversing) and at
  --    least 6 px. One cycle then moves whole spacings, so the loop is seamless.
  --    roomArt.test.ts reads the belt surface (x 6..59) in every frame and
  --    joins the frames into one strip, 54 + (n - 1) * shift px long; it can
  --    measure a spacing of up to half that strip.
  local total = n * shift
  local maxSpacing = (BELT_X2 - BELT_X1 + 1 + (n - 1) * shift) // 2
  local spacing
  for d = math.max(2 * shift + 1, 6), math.min(total, maxSpacing) do
    if total % d == 0 then
      spacing = d
      break
    end
  end
  if spacing == nil then
    error(string.format(
      "no stripe spacing fits: side-run has %d frames with %d px of planted-foot travel, "
        .. "and no divisor of %d px is over %d px, at least 6 px and at most %d px",
      n, shift, total, 2 * shift, maxSpacing))
  end
  local STRIPE = 2

  -- 3. The sprite: a static frame layer and a belt layer, one frame per
  --    side-run frame with the same durations.
  local spr = L.newSprite(W, H, "frame")
  local beltLayer = spr:newLayer()
  beltLayer.name = "belt"
  for _ = 2, n do spr:newEmptyFrame() end
  for i = 1, n do spr.frames[i].duration = durations[i] end

  local o, ml, m, ms = C("outline"), C("metal light"), C("metal"), C("metal shadow")
  local static = Image(W, H, ColorMode.RGB)
  -- Deck: rear roller cap, side rail, bottom edge, legs and feet.
  hline(static, 4, 5, 38, o)
  vline(static, 3, 39, 43, o)
  hline(static, 4, 5, 39, ms)
  hline(static, 4, 63, 40, ml)
  rect(static, 4, 41, 60, 2, m)
  hline(static, 4, 63, 43, ms)
  hline(static, 4, 63, 44, o)
  rect(static, 7, 45, 2, 2, ms)
  rect(static, 64, 45, 2, 2, ms)
  hline(static, 6, 9, 47, o)
  hline(static, 63, 66, 47, o)
  -- Motor hood at the front (right) end of the deck.
  hline(static, 62, 71, 30, o)
  static:drawPixel(61, 31, o)
  hline(static, 62, 71, 31, ml)
  static:drawPixel(72, 31, o)
  for y = 32, 43 do
    static:drawPixel(60, y, o)
    static:drawPixel(61, y, ml)
    hline(static, 62, 71, y, m)
    static:drawPixel(72, y, ms)
    static:drawPixel(73, y, o)
  end
  hline(static, 60, 73, 44, o)
  -- Upright post from the hood to the console.
  for y = 9, 29 do
    static:drawPixel(67, y, o)
    static:drawPixel(68, y, m)
    static:drawPixel(69, y, ms)
    static:drawPixel(70, y, o)
  end
  -- Handlebar reaching back toward the runner, with a dark grip.
  hline(static, 54, 66, 10, o)
  hline(static, 55, 66, 11, ml)
  hline(static, 55, 66, 12, m)
  hline(static, 54, 66, 13, o)
  rect(static, 54, 11, 4, 2, o)
  -- Console at the right end: screen and two buttons.
  hline(static, 61, 76, 1, o)
  for y = 2, 7 do
    static:drawPixel(60, y, o)
    hline(static, 61, 76, y, ms)
    static:drawPixel(77, y, o)
  end
  hline(static, 61, 76, 8, o)
  rect(static, 62, 3, 8, 2, C("glass"))
  hline(static, 62, 69, 5, C("glass shadow"))
  hline(static, 63, 64, 3, C("glass light"))
  rect(static, 71, 3, 2, 2, C("red"))
  rect(static, 74, 3, 2, 2, C("blue"))

  -- Belt frame i (0-based) moves the stripes back (toward -x) by i * shift.
  local beltBase, beltStripe = C("belt"), C("belt stripe")
  for i = 0, n - 1 do
    local belt = Image(W, H, ColorMode.RGB)
    local offset = (i * shift) % spacing
    for x = BELT_X1, BELT_X2 do
      local c = beltBase
      if (x - BELT_X1 + offset) % spacing < STRIPE then c = beltStripe end
      belt:drawPixel(x, BELT_Y, c)
      belt:drawPixel(x, BELT_Y + 1, c)
    end
    spr:newCel(spr.layers[1], i + 1, static, Point(0, 0))
    spr:newCel(beltLayer, i + 1, belt, Point(0, 0))
  end

  local tag = spr:newTag(1, n)
  tag.name = "belt"
  tag.aniDir = AniDir.FORWARD
  -- The rider slice: the app anchors the athlete's feet (body pixel 32, 63) on its pivot.
  L.slice(spr, "rider", 16, 0, 32, 38, 16, 37)
  spr:saveAs(L.OUT .. "treadmill.aseprite")
  local list = {}
  for i = 1, n do list[i] = tostring(math.floor(durations[i] * 1000 + 0.5)) end
  print(string.format(
    "OK treadmill %dx%d: belt %d frames [%s] ms, shift %d px, stripe spacing %d px",
    W, H, n, table.concat(list, ","), shift, spacing))
  spr:close()
end)
if not ok then print("ERROR: " .. tostring(err)) end
