// Derives the front-idle grids f02-f06 from the rest pose f01 and writes them.
// Run: node art/tools/body/derive-idle.mjs
// The constants below describe f01. If f01's neck, chest or eyes move, update them first.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('./grids/', import.meta.url));
const NECK_ROW = 28; // dropped in the rise pose, so shoulders, chest and arms move up 1 px
const CHEST_LAST_ROW = 37; // last row that moves up; it repeats once to close the gap
const EYE_XS = [29, 35]; // eye columns in f01
const EYE_TOP_ROW = 22; // f01's eyes are 1x2, on rows EYE_TOP_ROW and EYE_TOP_ROW + 1

const rest = readFileSync(`${DIR}f01.txt`, 'utf8').split(/\r?\n/).filter((row) => row.length > 0);
if (rest.length !== 64 || rest.some((row) => row.length !== 64)) {
  throw new Error('f01.txt must be 64 rows of 64 characters');
}
const crown = rest.findIndex((row) => /[^.]/.test(row));
if (crown < 1 || crown >= NECK_ROW) throw new Error(`f01 crown row ${crown} must be above NECK_ROW`);
for (const x of EYE_XS) {
  for (const y of [EYE_TOP_ROW, EYE_TOP_ROW + 1]) {
    if (rest[y][x] !== 'o') throw new Error(`f01 has no eye pixel at (${x}, ${y}); update EYE_XS/EYE_TOP_ROW`);
  }
}

// rise: rows NECK_ROW+1..CHEST_LAST_ROW move up 1 px (a small shrug); CHEST_LAST_ROW repeats.
const rise = [
  ...rest.slice(0, NECK_ROW),
  ...rest.slice(NECK_ROW + 1, CHEST_LAST_ROW + 1),
  rest[CHEST_LAST_ROW],
  ...rest.slice(CHEST_LAST_ROW + 1),
];
// top: the head and everything down to CHEST_LAST_ROW move up 1 px. The empty row above
// the crown drops out and CHEST_LAST_ROW repeats.
const top = [
  ...rest.slice(0, crown - 1),
  ...rest.slice(crown, CHEST_LAST_ROW + 1),
  rest[CHEST_LAST_ROW],
  ...rest.slice(CHEST_LAST_ROW + 1),
];

function put(rows, y, x, ch) {
  const row = rows[y];
  rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
}

// blink: the top pose with each eye closed to a 2-px lash line on its lower row,
// extended toward the face's center.
const blink = [...top];
for (const x of EYE_XS) {
  const inward = x < 32 ? 1 : -1;
  put(blink, EYE_TOP_ROW - 1, x, 'B');
  put(blink, EYE_TOP_ROW, x, 'o');
  put(blink, EYE_TOP_ROW, x + inward, 'o');
}

const frames = { 'f02.txt': rise, 'f03.txt': top, 'f04.txt': blink, 'f05.txt': top, 'f06.txt': rise };
for (const [name, rows] of Object.entries(frames)) {
  if (rows.length !== 64) throw new Error(`${name} has ${rows.length} rows`);
  writeFileSync(`${DIR}${name}`, `${rows.join('\n')}\n`);
  console.log(`wrote grids/${name}`);
}
