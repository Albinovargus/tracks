// Pure helpers for the room art check (roomArt.test.ts). They take decoded PNG
// pixels and plain numbers, so roomRules.test.ts covers them with hand-built
// inputs and no exported art.
import type { RgbaImage } from '../../avatar/__tests__/sheetRules.js';
import type { SheetFrame } from '../../avatar/sheets.js';

/** A source rect in a sheet PNG: a SheetFrame without its duration. */
export type Rect = Pick<SheetFrame, 'x' | 'y' | 'w' | 'h'>;

/** Leftmost and rightmost opaque x on a frame's bottom row, frame-local. */
export interface SoleSpan {
  left: number;
  right: number;
}

/** Packed 0xRRGGBB of an opaque pixel; -1 where alpha is 0 or outside the image. */
export function pixelAt(image: RgbaImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return -1;
  const o = (y * image.width + x) * 4;
  const d = image.data;
  if ((d[o + 3] ?? 0) === 0) return -1;
  return ((d[o] ?? 0) << 16) | ((d[o + 1] ?? 0) << 8) | (d[o + 2] ?? 0);
}

/** `length` pixelAt values of row y, starting at x0. */
export function rowPixels(image: RgbaImage, x0: number, y: number, length: number): number[] {
  return Array.from({ length }, (_, i) => pixelAt(image, x0 + i, y));
}

/** `length` pixelAt values of column x, starting at y0. */
export function columnPixels(image: RgbaImage, x: number, y0: number, length: number): number[] {
  return Array.from({ length }, (_, i) => pixelAt(image, x, y0 + i));
}

/** One message per rect reaching outside the central `safeW` px of a place `placeW` px wide. */
export function outsideSafeBand(
  rects: readonly { name: string; x: number; w: number }[],
  placeW: number,
  safeW: number,
): string[] {
  const left = Math.floor((placeW - safeW) / 2);
  const right = left + safeW;
  return rects
    .filter((r) => r.x < left || r.x + r.w > right)
    .map(
      (r) =>
        `${r.name} spans x ${r.x}..${r.x + r.w - 1}, outside the central ${safeW} px (${left}..${right - 1})`,
    );
}

/** The sole on a frame's bottom row (the avatar's ground row, y = 63), or null
 * in a flight frame. */
export function soleSpan(image: RgbaImage, frame: Rect): SoleSpan | null {
  const row = rowPixels(image, frame.x, frame.y + frame.h - 1, frame.w);
  const left = row.findIndex((c) => c !== -1);
  if (left === -1) return null;
  const right = row.length - 1 - [...row].reverse().findIndex((c) => c !== -1);
  return { left, right };
}

/**
 * The planted foot's backward travel per frame: for each consecutive pair of
 * contact frames (the last wraps to the first) whose sole moved toward -x by
 * the same amount at both ends, that amount. Pairs where the feet change, or
 * where a sole changes width, are skipped.
 */
export function plantedFootTravels(soles: readonly (SoleSpan | null)[]): number[] {
  const travels: number[] = [];
  soles.forEach((a, i) => {
    const b = soles[(i + 1) % soles.length];
    if (!a || !b) return;
    const travel = a.left - b.left;
    if (travel > 0 && travel === a.right - b.right) travels.push(travel);
  });
  return travels;
}

/** Smallest p, at most half the row, with row[x] === row[x + p] everywhere;
 * null when no pattern repeats at least twice. */
export function rowPeriod(row: readonly number[]): number | null {
  for (let p = 1; p <= Math.floor(row.length / 2); p++) {
    let repeats = true;
    for (let x = 0; x + p < row.length; x++) {
      if (row[x] !== row[x + p]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return p;
  }
  return null;
}

/** True when `to` is `from` moved k px toward -x: to[x] === from[x + k]
 * wherever both exist. */
function shiftsBy(from: readonly number[], to: readonly number[], k: number): boolean {
  for (let x = 0; x + k < from.length; x++) {
    if (to[x] !== from[x + k]) return false;
  }
  return true;
}

/** Smallest k, at most half the row, by which `to` is `from` moved toward -x
 * (backward under a right-facing runner); null when no offset matches. */
export function rowShift(from: readonly number[], to: readonly number[]): number | null {
  for (let k = 0; k <= Math.floor(from.length / 2); k++) {
    if (shiftsBy(from, to, k)) return k;
  }
  return null;
}

/**
 * The x range of the belt surface on one row of every belt frame: [from, to]
 * (the part under the rider) grown outward while each frame's pixel is a color
 * seen under the rider in some frame. null when a frame has a transparent
 * pixel under the rider.
 */
export function beltSpan(
  rows: readonly (readonly number[])[],
  from: number,
  to: number,
): { from: number; to: number } | null {
  const seen = rows.flatMap((row) => row.slice(from, to + 1));
  if (seen.length === 0 || seen.includes(-1)) return null;
  const colors = new Set(seen);
  const isBelt = (x: number): boolean => rows.every((row) => colors.has(row[x] ?? -1));
  let start = from;
  let end = to;
  while (start > 0 && isBelt(start - 1)) start--;
  while (isBelt(end + 1)) end++;
  return { from: start, to: end };
}

/**
 * The belt rules (spec section 1): `rows` is the belt surface in each belt
 * frame, over the same x range. Every step, including last to first, moves the
 * texture backward by the planted foot's `travel`; the stripe spacing is more
 * than twice that; one cycle moves a whole number of stripe spacings.
 */
export function beltMotionProblems(
  rows: readonly (readonly number[])[],
  travel: number,
): string[] {
  const first = rows[0];
  if (first === undefined) return ['the belt has no frames'];
  const problems: string[] = [];
  rows.forEach((row, i) => {
    const j = (i + 1) % rows.length;
    const next = rows[j] ?? first;
    if (shiftsBy(row, next, travel)) return;
    const shift = rowShift(row, next);
    const moved = shift === null ? 'by no single offset' : `${shift} px`;
    problems.push(`belt frame ${i} -> ${j} shifts ${moved} (planted foot travels ${travel} px)`);
  });
  // When every step moves the texture back by `travel`, the frames are windows
  // onto one strip: the first row plus the `travel` px each later frame shows
  // at its right end. Its period is measurable up to half the strip, which is
  // longer than one frame's row.
  const strip =
    problems.length === 0
      ? [...first, ...rows.slice(1).flatMap((row) => row.slice(row.length - travel))]
      : [...first];
  const spacing = rowPeriod(strip);
  if (spacing === null) return [...problems, 'the belt surface has no repeating stripe pattern'];
  if (2 * travel >= spacing) {
    problems.push(`stripe spacing ${spacing} px is not more than twice the ${travel} px shift`);
  }
  const cycle = rows.length * travel;
  if (cycle % spacing !== 0) {
    problems.push(
      `one cycle shifts ${cycle} px, not a whole number of ${spacing} px stripe spacings`,
    );
  }
  return problems;
}
