// Builds the 3/4 front-right turn grid (f07) and prints it to stdout.
// Run: node art/tools/body/build-turn.mjs > art/tools/body/grids/f07.txt
import { newGrid, mask, spans, draw, put, render, defaultShade } from './gridlib.mjs';

const g = newGrid();
const range = (a, b, v) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, v]));

// Far arm (behind): a 2-px S strip beside the far chest, hand on rows 43-44 (+ outline row 45).
draw(g, spans(mask(), { ...range(32, 42, [[39, 40]]), 43: [[38, 40]], 44: [[38, 40]] }), {
  shade: () => 'S',
});

// Torso + head (interior spans; outline is automatic).
const torso = spans(mask(), {
  16: [[30, 34]],
  ...range(17, 20, [[28, 36]]),
  ...range(21, 23, [[27, 36]]), // ear bump: outline at x 26
  24: [[28, 37]], // nose: outline bump at x 38
  25: [[28, 36]],
  26: [[29, 35]],
  28: [[32, 34]],
  29: [[32, 34]],
  30: [[26, 37]],
  ...range(31, 37, [[27, 37]]),
  ...range(38, 42, [[28, 36]]),
  ...range(43, 47, [[28, 36]]),
});
draw(g, torso, {
  shade: (x, y, from, to) => {
    if (y <= 29 && y >= 28) return y === 29 && x === from ? 'L' : 'S'; // neck
    if (y >= 31 && from === 27) return x === 27 ? 'L' : x >= 35 ? 'S' : 'B'; // chest
    if (y >= 38 && from === 28) return x === 28 ? 'L' : x >= 35 ? 'S' : 'B'; // waist, hips
    return defaultShade(x, y, from, to);
  },
});

// Legs: near x 27-31, far x 33-37 (outlines included); feet turn toward +x.
const near = spans(mask(), {
  ...range(48, 54, [[28, 30]]),
  55: [[27, 30]],
  56: [[27, 30]],
  ...range(57, 60, [[28, 30]]),
  61: [[28, 31]],
  62: [[27, 31]],
});
draw(g, near, { skipOutline: (_x, y) => y <= 47 });
const far = spans(mask(), {
  ...range(48, 60, [[34, 36]]),
  61: [[34, 37]],
  62: [[34, 38]],
});
draw(g, far, { shade: (x) => (x === 34 ? 'B' : 'S'), skipOutline: (_x, y) => y <= 47 });
// Re-assert the crotch / hip bottom and the inner leg outlines.
for (let y = 48; y <= 60; y++) put(g, 32, y, y === 48 ? 'o' : '.');
put(g, 32, 61, 'o');
for (let y = 48; y <= 60; y++) {
  put(g, 31, y, 'o');
  put(g, 33, y, 'o');
}
put(g, 32, 62, 'o');
put(g, 33, 62, 'o');
// Soles on row 63: near 26-32, far 33-39.
for (let x = 26; x <= 39; x++) put(g, x, 63, 'o');

// Near arm (front): upper arm interior 23-25 (outline 26 is the chest's), forearm and
// hand interior 22-24, column 26 empty from row 39 down.
const arm = spans(mask(), { ...range(31, 38, [[23, 25]]), ...range(39, 47, [[22, 24]]) });
draw(g, arm, { skipOutline: (x, y) => x >= 26 && y <= 38 && g[y][x] !== '.' && g[y][x] !== 'o' });

// Face: eyes 1x2 at x 31 and 35, mouth S at 34-35, ear shading.
for (const x of [31, 35]) for (const y of [22, 23]) put(g, x, y, 'o');
put(g, 34, 25, 'S');
put(g, 35, 25, 'S');
put(g, 36, 25, 'B');
put(g, 28, 22, 'S');

process.stdout.write(render(g));
