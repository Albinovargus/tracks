// Applies body-art.test.ts's side-run rules (bob, flight frames, 4 px belt travel) to
// grids f08-f15 before painting. Run: node art/tools/body/check-run.mjs [gridDir]
// (default art/tools/body/grids). Ends with CHECK OK or CHECK FAIL.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = process.argv[2] ?? fileURLToPath(new URL('./grids', import.meta.url));
const grids = Array.from({ length: 8 }, (_, k) =>
  readFileSync(`${dir}/f${String(8 + k).padStart(2, '0')}.txt`, 'utf8').split(/\r?\n/).filter(Boolean));
const runs = (r, y) => { const o = []; let f = -1; for (let x = 0; x <= 64; x++) { const op = x < 64 && r[y][x] !== '.'; if (op && f < 0) f = x; if (!op && f >= 0) { o.push([f, x - 1]); f = -1; } } return o; };
let bad = 0;
const soles = [];
grids.forEach((r, k) => {
  const top = r.findIndex((l) => /[^.]/.test(l));
  let mn = 64, mx = -1;
  r.forEach((l) => { for (let x = 0; x < 64; x++) if (l[x] !== '.') { mn = Math.min(mn, x); mx = Math.max(mx, x); } });
  const hip = runs(r, top + 30).find(([a, b]) => a <= 32 && 32 <= b);
  const hipOk = hip && hip[0] >= 27 && hip[1] <= 37 && Math.abs((hip[0] + hip[1]) / 2 - 32) <= 2;
  const s63 = runs(r, 63), s62 = runs(r, 62);
  soles.push(s63);
  const ok = top >= 11 && top <= 18 && mn >= 1 && mx <= 62 && hipOk;
  if (!ok) bad++;
  console.log(`offset ${k} f${8 + k}: top=${top} x=${mn}..${mx} hipRow${top + 30}=${JSON.stringify(hip)} row63=${JSON.stringify(s63)} row62=${JSON.stringify(s62)} ${ok ? 'ok' : 'FAIL'}`);
});
const flight = soles.flatMap((s, k) => (s.length === 0 ? [k] : []));
console.log('flight', JSON.stringify(flight), flight.join() === '2,6' ? 'ok' : 'FAIL');
for (const k of flight) if (runs(grids[k], 62).length) { console.log('row62 not empty at', k); bad++; }
for (const [a, b] of [[7, 0], [0, 1], [3, 4], [4, 5]]) {
  const [p] = soles[a], [c] = soles[b];
  const ok = soles[a].length === 1 && soles[b].length === 1 && c[0] - p[0] === -4 && c[1] - c[0] === p[1] - p[0];
  if (!ok) bad++;
  console.log(`belt ${a}->${b}: ${JSON.stringify(p)} -> ${JSON.stringify(c)} ${ok ? 'ok' : 'FAIL'}`);
}
const uniq = new Set(grids.map((g) => g.join(''))).size;
console.log('unique', uniq, uniq === 8 ? 'ok' : 'FAIL');
const failed = bad || uniq !== 8 || flight.join() !== '2,6';
console.log(failed ? 'CHECK FAIL' : 'CHECK OK');
if (failed) process.exitCode = 1;
