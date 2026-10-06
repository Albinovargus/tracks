-- Paint ops for shoes-starter, read by paint.lua (GARMENT = "shoes-starter"); see paint.lua for the op format.
-- Shoes (checkpoint changes: body f363032 planted toe box, body 438241c reshaped lifted feet): each shoe
-- covers the whole foot plus one collar row above it (the automatic hem
-- makes the collar PH cloth shadow). The upper keeps the body's
-- light/base/shadow shading; the sole edge (the foot pixels resting on the
-- outline, or facing back on toe-down feet) is a light "midsole" stripe.
-- Measured from map.lua output of the refreshed body.
local function sole(...)
  local list, pts = {}, { ... }
  for k = 1, #pts, 2 do list[#list + 1] = { "px", at = { pts[k], pts[k + 1] }, color = "light" } end
  return list
end
local function row(y, x0, x1)
  local pts = {}
  for x = x0, x1 do pts[#pts + 1] = x; pts[#pts + 1] = y end
  return table.unpack(pts)
end
local function join(...)
  local out = {}
  for _, l in ipairs({ ... }) do for _, op in ipairs(l) do out[#out + 1] = op end end
  return out
end

-- Front and turn: collar row 59, upper rows 60-61, midsole row 62, outline sole row 63.
local front = join({ { "add", rect = { 24, 59, 17, 5 } } }, sole(row(62, 26, 30)), sole(row(62, 34, 38)))
local turn = join({ { "add", rect = { 25, 59, 16, 5 } } }, sole(row(62, 27, 31)), sole(row(62, 34, 38)))

-- Side-run feet. Planted: heel at -x, toe at +x, sole on row 62.
local function planted(x0, heel)       -- rect from x0 (10 wide), sole x heel+1 .. heel+6
  return join({ { "add", rect = { x0, 59, 10, 5 } } }, sole(row(62, heel + 1, heel + 6)))
end
local planted_31 = planted(30, 31)     -- sole outline x31-38 (f08 near, f12 far)
local planted_27 = planted(26, 27)     -- sole outline x27-34 (f09 near, f13 far)
local planted_35 = planted(34, 35)     -- sole outline x35-42 (f11 far, f15 near)

-- Lifted feet (body 438241c, reshaped side-run feet): each shoe = the
-- whole foot + a collar where the shin meets it (the auto-hem shades it).
-- The midsole (light) runs along the sole edge; the toe tip keeps the
-- body shade so it reads as a rounded cap.
-- Folded low, shin horizontal behind, heel bump up at x26-28, toe tip
-- (23,52) pointing back-down; sole = upper-left edge. Collar x28 (shin
-- x29-30 + knee stay bare). Row 53 stops at x28: (29,53) is the knee.
-- f08 far, f12 near.
local folded_low = join({ { "add", rect = { 22, 48, 7, 6 } } },
  sole(24, 51, 25, 51, 26, 50, 27, 49))
-- Folded high, heel bump up at x22-23 rows 46-48, toe tip x18 rows 49-50
-- pointing back; sole = top edge. Collar (24,50),(25,50); row 51 is the
-- outline under the foot, (24,51) is knee skin and stays out.
-- f11 near, f15 far.
local folded_high = join({ { "add", rect = { 17, 46, 9, 5 } }, { "add", rect = { 17, 51, 7, 1 } } },
  sole(19, 49, 20, 49, 21, 49, 22, 48, 22, 47))
-- Push-off (trailing), toe pointing down x23-24 rows 55-59 from the ankle
-- bend at row 54, heel bump (22,54); sole = back (-x) edge. Collar
-- (26,54),(27,54) where the diagonal shin enters; shin rows 52-53 bare.
-- f10 near, f14 far.
local trailing = join({ { "add", rect = { 21, 54, 9, 7 } } },
  sole(22, 54, 23, 55, 23, 56, 23, 57, 23, 58))
-- Reaching, dorsiflexed: heel x38-39 rows 57-58, toe up at (44,55);
-- sole = bottom edge. Collar row 54 (x39-40).
-- f10 far, f14 near.
local reaching = join({ { "add", rect = { 37, 54, 9, 6 } } },
  sole(38, 58, 39, 58, 40, 56, 41, 56, 42, 56, 43, 56))
-- Flat lifted foot rows 56-58 x34-40, heel x34, toe (40,57); sole =
-- bottom edge. f09 far (behind the near shin, x<=33) and f13 near (in
-- front of the far shin, x<=32). Collar row 55 from x35: (34,55) is
-- near-shin skin in f09.
local function flat(collar)
  return join({ { "add", rect = { 34, 56, 8, 4 } }, { "add", rect = collar } },
    sole(34, 58, 35, 57, 36, 57, 37, 57, 38, 57, 39, 57))
end

return {
  front, front, front, front, front, front,                    -- 1-6 front-idle
  turn,                                                        -- 7 turn
  join(planted_31, folded_low),                                -- 8 near planted, far folded
  join(planted_27, flat({ 35, 55, 7, 1 })),                    -- 9 near planted, far foot behind near shin
  join(trailing, reaching),                                    -- 10 near trailing, far reaching
  join(folded_high, planted_35),                               -- 11 near folded, far planted
  join(folded_low, planted_31),                                -- 12 near folded, far planted
  join(planted_27, flat({ 34, 55, 8, 1 })),                    -- 13 near foot in front of far shin
  join(reaching, trailing),                                    -- 14 near reaching, far trailing
  join(planted_35, folded_high),                               -- 15 near planted, far folded
}
