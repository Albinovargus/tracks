// Builds every side-run grid (f08-f15) from one parametric pose cycle.
// Run: node art/tools/body/build-run.mjs [outDir]   (no outDir: print a summary only;
// art/tools/body/grids writes the grids paint-body.lua reads). Check with check-run.mjs.
// Each leg and arm follows the same 8-offset cycle; the far limb runs 4 offsets
// behind the near one. Offset k is MCP frame 8+k (JSON index 7+k).
import { writeFileSync } from 'node:fs';
import { newGrid, mask, spans, capsule, add, draw, put, render, farShade, defaultShade } from './gridlib.mjs';

const range = (a, b, v) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, v]));
const BOB = [1, 0, -1, 0, 1, 0, -1, 0];

// Leg cycle for one leg; its contact (heel-strike) is at offset 7. Points are absolute,
// with the bob already applied where the leg is off the ground. Planted feet use `heel`
// (sole heel..heel+SOLE-1 on row 63, ankle at heel+2, 60) and ignore the bob.
// Toe follow-up: feet are 8 px heel to toe with a rounded toe box ahead of the ankle.
const SOLE = 8;
const LEG = [
  /* 0 down    */ { knee: [37, 54], ankle: [33, 60], heel: 31 },
  /* 1 pass    */ { knee: [34, 53], ankle: [29, 60], heel: 27 },
  // Lifted feet (round 2): foot = direction in degrees (screen: 0 = +x, 90 = down) and
  // length from the ankle; plantar-flexed behind (toes down/back), dorsiflexed in front.
  /* 2 push    */ { knee: [30, 51], ankle: [24, 55], foot: 100, len: 4 },
  /* 3 trail   */ { knee: [28, 53], ankle: [22, 49], foot: 170, len: 4 },
  /* 4 swing   */ { knee: [32, 54], ankle: [27, 50], foot: 150, len: 4, heelOut: 0.4 },
  /* 5 tuck    */ { knee: [38, 50], ankle: [35, 56], foot: 10, len: 5 },
  /* 6 reach   */ { knee: [40, 49], ankle: [39, 56], foot: -10, len: 5 },
  /* 7 contact */ { knee: [38, 53], ankle: [37, 60], heel: 35 },
];
// Arm cycle relative to the shoulder (33, 32 + bob); back at the own leg's contact.
const ARM = [
  /* 0 back, settling */ { elbow: [-7, 3], hand: [-6, 9] },
  /* 1 passing fwd    */ { elbow: [-1, 6], hand: [5, 3] },
  /* 2 forward        */ { elbow: [4, 5], hand: [7, 1] },
  /* 3 forward        */ { elbow: [4, 5], hand: [7, 1] },
  /* 4 fwd, settling  */ { elbow: [4, 6], hand: [7, 2] },
  /* 5 passing back   */ { elbow: [-4, 5], hand: [-2, 10] },
  /* 6 back           */ { elbow: [-8, 2], hand: [-7, 9] },
  /* 7 back           */ { elbow: [-8, 2], hand: [-7, 9] },
];

/** Tapered capsule: radius r0 at (x0,y0) to r1 at (x1,y1). */
function taper(m, x0, y0, x1, y1, r0, r1) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    let t = len2 === 0 ? 0 : ((x - x0) * dx + (y - y0) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const r = r0 + (r1 - r0) * t, px = x0 + t * dx - x, py = y0 + t * dy - y;
    if (px * px + py * py <= r * r + 1e-9) add(m, x, y);
  }
}
/** A lifted foot hinged at the ankle: tapered body to a round toe, heel bump on the sole side. */
function liftedFoot(m, ankle, deg, len, heelOut = 0.9) {
  const a = (deg * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)], s = [-d[1], d[0]];
  taper(m, ankle[0], ankle[1], ankle[0] + d[0] * len, ankle[1] + d[1] * len, 1.2, 0.7);
  const heel = [ankle[0] - d[0] * 0.6 + s[0] * heelOut, ankle[1] - d[1] * 0.6 + s[1] * heelOut];
  capsule(m, heel[0], heel[1], heel[0], heel[1], 1.25);
}

function legMask(pose, hip, bob) {
  const m = mask();
  capsule(m, hip[0], hip[1] + bob, pose.knee[0], pose.knee[1], pose.heel !== undefined ? 2.0 : 1.8);
  if (pose.heel !== undefined) capsule(m, pose.knee[0], pose.knee[1], pose.ankle[0], pose.ankle[1], 1.5);
  else taper(m, pose.knee[0], pose.knee[1], pose.ankle[0], pose.ankle[1], 1.4, 1.0); // ankle narrows: visible hinge
  if (pose.heel !== undefined) {
    const h = pose.heel;
    for (let x = h + 1; x <= h + SOLE - 3; x++) add(m, x, 61);
    for (let x = h + 1; x <= h + SOLE - 2; x++) add(m, x, 62);
  } else {
    liftedFoot(m, pose.ankle, pose.foot, pose.len, pose.heelOut);
  }
  return m;
}
function armMask(pose, sh, forearmR = 1.5) {
  const el = [sh[0] + pose.elbow[0], sh[1] + pose.elbow[1]];
  const ha = [sh[0] + pose.hand[0], sh[1] + pose.hand[1]];
  const m = mask();
  capsule(m, sh[0], sh[1], el[0], el[1], 1.3);
  capsule(m, el[0], el[1], ha[0], ha[1], forearmR);
  capsule(m, ha[0], ha[1], ha[0], ha[1], 1.5);
  return { m, el, ha };
}

export function buildFrame(k) {
  const b = BOB[k];
  const g = newGrid();
  const SH = [33, 32 + b];
  const nearLegPose = LEG[k];
  const farLegPose = LEG[(k + 4) % 8];
  const nearArmPose = ARM[k];
  const farArmPose = ARM[(k + 4) % 8];

  // 1. Far arm, 2. far leg: behind everything, S plus outline.
  draw(g, armMask(farArmPose, SH, 1.3).m, { shade: farShade });
  draw(g, legMask(farLegPose, [32, 45], b), { shade: farShade });
  if (farLegPose.heel !== undefined) for (let x = farLegPose.heel; x <= farLegPose.heel + SOLE - 1; x++) put(g, x, 63, 'o');

  // 3. Torso + head, shifted by the bob.
  const rows = {
    16: [[31, 35]],
    ...range(17, 22, [[29, 37]]),
    23: [[29, 38]],
    24: [[29, 37]],
    25: [[29, 37]],
    26: [[30, 36]],
    27: [[33, 34]],
    28: [[33, 34]],
    29: [[33, 34]],
    30: [[30, 36]],
    ...range(31, 36, [[30, 37]]),
    37: [[30, 36]],
    ...range(38, 42, [[31, 35]]),
    ...range(43, 47, [[30, 36]]),
  };
  const shifted = Object.fromEntries(Object.entries(rows).map(([y, v]) => [Number(y) + b, v]));
  const torso = spans(mask(), shifted);
  const torsoInterior = new Set(torso);
  draw(g, torso, {
    shade: (x, y, from, to) => {
      if (y >= 27 + b && y <= 29 + b) return x === 33 ? 'L' : 'S';
      return defaultShade(x, y, from, to);
    },
  });
  const inTorso = (x, y) => torsoInterior.has(y * 64 + x);

  // 4. Near leg, 5. near arm: over the torso, L/B/S.
  draw(g, legMask(nearLegPose, [33, 45], b), { skipOutline: (x, y) => y <= 47 + b && inTorso(x, y) });
  if (nearLegPose.heel !== undefined) for (let x = nearLegPose.heel; x <= nearLegPose.heel + SOLE - 1; x++) put(g, x, 63, 'o');
  const near = armMask(nearArmPose, SH);
  draw(g, near.m, { skipOutline: (x, y) => y <= SH[1] - 1 && inTorso(x, y) });

  // Face.
  put(g, 36, 22 + b, 'o');
  put(g, 36, 23 + b, 'o');
  put(g, 32, 21 + b, 'o');
  put(g, 31, 22 + b, 'o');
  put(g, 32, 22 + b, 'S');
  put(g, 32, 23 + b, 'o');
  put(g, 37, 25 + b, 'S');
  put(g, 37, 24 + b, 'B');

  // Polish: clean pelvis shading (skin pixels only) where a thigh merges in.
  for (let y = 44 + b; y <= 47 + b; y++) {
    for (let x = 31; x <= 35; x++) if ('LBS'.includes(g[y][x])) g[y][x] = 'B';
    if (y >= 45 + b && 'LBS'.includes(g[y][30])) g[y][30] = 'L';
  }
  if (g[31 + b][32] === 'L') g[31 + b][32] = 'B'; // arm top merges into the shoulder
  return { g, near };
}

const outDir = process.argv[2];
for (let k = 0; k < 8; k++) {
  const { g } = buildFrame(k);
  const text = render(g);
  const name = `f${String(8 + k).padStart(2, '0')}.txt`;
  if (outDir) writeFileSync(`${outDir}/${name}`, text);
  else process.stdout.write(`${name} ok\n`);
}
