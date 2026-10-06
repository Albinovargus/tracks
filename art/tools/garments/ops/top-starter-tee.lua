-- Paint ops for top-starter-tee, read by paint.lua (GARMENT = "top-starter-tee"); see paint.lua for the op format.
-- Tee: torso from the shoulder row (first torso row below the neck) down to
-- 1 row below the shorts' top row (shorts top = S-3, so tee bottom = S-2).
-- Side-run: torso band, cut the near arm (seed + limit = arm skin bbox + 1),
-- add the near sleeve back (~4 px of upper arm from the shoulder), far upper
-- arm beside the torso is sleeve, far forearm/hand inside the band is cut.
-- Measured from map.lua output of the approved body.
local f1 = {                                         -- shoulders at row 30/31, arms separate from row 32
  { "add", rect = { 20, 30, 25, 6 } },               -- shoulders + both sleeves, rows 30-35 (arm skin rows 32-35)
  { "add", rect = { 25, 36, 15, 10 } },              -- torso x25-39 rows 36-45, hands x20-24/x40-44 stay out
}
local f2 = {                                         -- breathing frames: shoulders 1 row higher, waist unchanged
  { "add", rect = { 20, 29, 25, 6 } },               -- rows 29-34 (arm skin rows 31-34)
  { "add", rect = { 25, 35, 15, 11 } },              -- rows 35-45
}
return {
  f1, f2, f2, f2, f2, f2,                            -- 1-6 front-idle (f3-f5 torso = f2 torso; only the head/neck differ)
  {                                                  -- 7 turn: near arm (x23-25) does not overlap the torso
    { "add", rect = { 21, 30, 22, 5 } },             -- shoulders + near sleeve rows 31-34 + far sleeve rows 32-34
    { "add", rect = { 38, 35, 4, 1 } },              -- far sleeve row 35 (far arm starts 1 row lower; same 4-row length)
    { "add", rect = { 26, 35, 12, 11 } },            -- torso x26-37 rows 35-45 (far hand x38-40 rows 43-44 stays out)
  },
  {                                                  -- 8: near arm swung back over the torso, far arm in front of the chest
    { "add", rect = { 29, 31, 10, 17 } },            -- torso band rows 31-47
    { "cut", seed = { 26, 40 }, limit = { 24, 33, 12, 12 } },   -- near arm, skin x25-34 y33-43
    { "add", rect = { 30, 33, 6, 3 } },              -- near sleeve: upper arm x>=30 rows 33-35
    { "cut", seed = { 39, 37 }, limit = { 36, 37, 7, 5 } },     -- far forearm x37-40 rows 37-40
    { "add", rect = { 38, 33, 5, 3 } },              -- far sleeve x39-41 rows 34-35
  },
  {                                                  -- 9: near arm bent forward across the chest, far forearm behind the back
    { "add", rect = { 29, 30, 10, 17 } },            -- torso band rows 30-46
    { "cut", seed = { 32, 34 }, limit = { 30, 32, 11, 9 } },    -- near arm, skin x31-39 y32-39
    { "add", rect = { 31, 32, 4, 4 } },              -- near sleeve x32-34 rows 32-35
    { "cut", seed = { 29, 39 }, limit = { 27, 36, 4, 6 } },     -- far forearm x28-29 rows 37-40
  },
  {                                                  -- 10: near arm bent forward (hand up), far upper arm back
    { "add", rect = { 29, 29, 10, 17 } },            -- torso band rows 29-45
    { "cut", seed = { 33, 32 }, limit = { 31, 31, 12, 8 } },    -- near arm, skin x32-41 y31-37
    { "add", rect = { 31, 31, 6, 4 } },              -- near sleeve rows 31-34
    { "add", rect = { 26, 30, 4, 4 } },              -- far sleeve x26-28 rows 31-33
  },
  { from = 10, dy = 1 },                             -- 11: upper body = frame 10 one row lower (bob); waist S also +1
  {                                                  -- 12: near arm bent forward, far arm back
    { "add", rect = { 29, 31, 10, 17 } },            -- torso band rows 31-47
    { "cut", seed = { 34, 35 }, limit = { 31, 33, 12, 9 } },    -- near arm, skin x32-41 y33-40
    { "add", rect = { 31, 33, 6, 4 } },              -- near sleeve rows 33-36
    { "add", rect = { 26, 33, 4, 4 } },              -- far sleeve x26-28 rows 34-36
  },
  {                                                  -- 13: near arm hanging back over the torso, far hand tip in front
    { "add", rect = { 29, 30, 10, 17 } },            -- torso band rows 30-46
    { "cut", seed = { 30, 38 }, limit = { 27, 32, 9, 13 } },    -- near arm, skin x28-34 y32-43
    { "add", rect = { 29, 32, 6, 4 } },              -- near sleeve rows 32-35
  },
  {                                                  -- 14: near arm swung back, far arm in front of the chest
    { "add", rect = { 29, 29, 10, 17 } },            -- torso band rows 29-45
    { "cut", seed = { 26, 36 }, limit = { 23, 31, 13, 12 } },   -- near arm, skin x24-34 y31-41
    { "add", rect = { 30, 31, 6, 3 } },              -- near sleeve: upper arm x>=30 rows 31-33
    { "cut", seed = { 39, 34 }, limit = { 36, 34, 7, 5 } },     -- far forearm x39-40 rows 34-35
    { "cut", rect = { 37, 36, 2, 2 } },              -- far hand (38,36),(37,37): only diagonally joined to the forearm
    { "add", rect = { 38, 30, 5, 3 } },              -- far sleeve x39-41 rows 31-32
  },
  { from = 14, dy = 1 },                             -- 15: upper body = frame 14 one row lower (bob); waist S also +1
}
