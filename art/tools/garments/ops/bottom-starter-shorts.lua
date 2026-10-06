-- Paint ops for bottom-starter-shorts, read by paint.lua (GARMENT = "bottom-starter-shorts"); see paint.lua for the op format.
-- Shorts: from 3 rows above the leg split (S) down to mid-thigh. Side-run
-- splits: f08/f12 S=49, f09/f11/f13/f15 S=48, f10/f14 S=47 (run bob).
-- Measured from map.lua output of the approved body.
local front = { { "add", rect = { 25, 44, 15, 9 } } }    -- x25-39 rows 44-52, between the hands (x20-24, x40-44)
return {
  front, front, front, front, front, front,                -- 1-6 front-idle (S=47)
  { { "add", rect = { 26, 44, 12, 9 } } },                 -- 7 turn: x26-37 rows 44-52, near hand x21-25, far hand x38-40 stay out
  {                                                        -- 8 (S=49) near leg planted, far leg folded back
    { "add", rect = { 29, 46, 10, 4 } },                   -- hips rows 46-49
    { "add", rect = { 33, 50, 8, 3 } },                    -- near thigh rows 50-52
    { "add", rect = { 34, 53, 7, 2 } },                    -- near thigh rows 53-54 (x33 there is far knee)
    { "add", rect = { 31, 50, 3, 4 } },                    -- far thigh x31-33 rows 50-53 (knee x<=30 bare)
  },
  {                                                        -- 9 (S=48) near planted, far thigh swung forward
    { "add", rect = { 29, 45, 9, 4 } },                    -- hips rows 45-48
    { "add", rect = { 31, 49, 6, 5 } },                    -- near thigh x31-36 rows 49-53
    { "add", rect = { 37, 47, 2, 4 } },                    -- far thigh x37-38 rows 47-50 (knee x39 bare)
  },
  {                                                        -- 10 (S=47) near trailing back, far reaching forward
    { "add", rect = { 29, 44, 10, 3 } },                   -- hips rows 44-46
    { "add", rect = { 28, 47, 6, 5 } },                    -- near thigh x28-33 rows 47-51
    { "add", rect = { 34, 46, 6, 4 } },                    -- far thigh x34-39 rows 46-49 (knee x40-41 bare)
  },
  {                                                        -- 11 (S=48) near folded back, far planted
    { "add", rect = { 29, 45, 9, 3 } },                    -- hips rows 45-47
    { "add", rect = { 28, 48, 6, 4 } },                    -- near thigh x28-33 rows 48-51 (shin x<=27 bare)
    { "add", rect = { 34, 48, 7, 6 } },                    -- far thigh x34-40 rows 48-53
  },
  {                                                        -- 12 (S=49) near folded back, far planted
    { "add", rect = { 29, 46, 10, 4 } },                   -- hips rows 46-49
    { "add", rect = { 31, 50, 4, 4 } },                    -- near thigh x31-34 rows 50-53 (knee x<=30 bare)
    { "add", rect = { 35, 50, 6, 5 } },                    -- far thigh x35-40 rows 50-54
  },
  {                                                        -- 13 (S=48) near thigh swung forward, far planted
    { "add", rect = { 29, 45, 10, 4 } },                   -- hips rows 45-48
    { "add", rect = { 34, 49, 5, 2 } },                    -- near thigh x34-38 rows 49-50 (knee x39 bare)
    { "add", rect = { 30, 49, 5, 4 } },                    -- far thigh x30-34 rows 49-52
    { "add", rect = { 30, 53, 4, 1 } },                    -- far thigh x30-33 row 53 ((34,53) is near shin)
  },
  {                                                        -- 14 (S=47) near reaching forward, far trailing back
    { "add", rect = { 29, 44, 10, 3 } },                   -- hips rows 44-46
    { "add", rect = { 34, 47, 6, 3 } },                    -- near thigh x34-39 rows 47-49 (knee x40-41 bare)
    { "add", rect = { 28, 47, 6, 5 } },                    -- far thigh x28-33 rows 47-51
  },
  {                                                        -- 15 (S=48) near planted, far folded back
    { "add", rect = { 29, 45, 9, 3 } },                    -- hips rows 45-47
    { "add", rect = { 33, 48, 8, 6 } },                    -- near thigh x33-40 rows 48-53
    { "add", rect = { 28, 48, 5, 4 } },                    -- far thigh x28-32 rows 48-51 (shin x<=27 bare)
  },
}
