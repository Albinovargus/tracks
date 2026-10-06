import { describe, expect, it } from 'vitest';
import type { RgbaImage } from '../../avatar/__tests__/sheetRules.js';
import {
  beltMotionProblems,
  beltSpan,
  pixelAt,
  plantedFootTravels,
  rowPeriod,
  rowPixels,
  rowShift,
  soleSpan,
} from './roomRules.js';

const BELT = 0x2c2e36;
const STRIPE = 0x464a56;

/** A w x h image; `opaque` lists [x, y, 0xRRGGBB] pixels at alpha 255. */
function image(w: number, h: number, opaque: Array<[number, number, number]>): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (const [x, y, color] of opaque) {
    const o = (y * w + x) * 4;
    data[o] = (color >> 16) & 0xff;
    data[o + 1] = (color >> 8) & 0xff;
    data[o + 2] = color & 0xff;
    data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}

/** A 32 px belt window (the rider slice's width): 2 px stripes every
 * `spacing` px, moved back by `offset` px. */
function beltRow(spacing: number, offset: number): number[] {
  return Array.from({ length: 32 }, (_, x) => ((x + offset) % spacing < 2 ? STRIPE : BELT));
}

/** n belt frames, each moved back `shift` px from the one before. */
function beltCycle(n: number, spacing: number, shift: number): number[][] {
  return Array.from({ length: n }, (_, i) => beltRow(spacing, (i * shift) % spacing));
}

describe('pixelAt', () => {
  it('packs an opaque pixel and returns -1 for transparent or outside pixels', () => {
    const img = image(2, 1, [[1, 0, 0x8c5e3c]]);
    expect(pixelAt(img, 1, 0)).toBe(0x8c5e3c);
    expect(pixelAt(img, 0, 0)).toBe(-1);
    expect(pixelAt(img, 2, 0)).toBe(-1);
  });
});

describe('rowPixels', () => {
  it('reads `length` pixels of one row, starting at x0', () => {
    const img = image(4, 2, [[2, 1, 0x8c5e3c]]);
    expect(rowPixels(img, 1, 1, 3)).toEqual([-1, 0x8c5e3c, -1]);
  });
});

describe('soleSpan', () => {
  it("reads the frame's bottom row, in frame-local x", () => {
    const img = image(8, 4, [
      [5, 3, 1],
      [6, 3, 1],
      [5, 1, 1],
    ]);
    expect(soleSpan(img, { x: 4, y: 0, w: 4, h: 4 })).toEqual({ left: 1, right: 2 });
  });

  it('is null in a flight frame', () => {
    expect(soleSpan(image(4, 4, [[1, 2, 1]]), { x: 0, y: 0, w: 4, h: 4 })).toBeNull();
  });
});

describe('plantedFootTravels', () => {
  it('measures the backward sole travel between contact frames, wrapping the loop', () => {
    // Only the last -> first pair (36 -> 34) adds the second travel.
    const soles = [
      { left: 34, right: 38 },
      null,
      { left: 38, right: 42 },
      { left: 36, right: 40 },
    ];
    expect(plantedFootTravels(soles)).toEqual([2, 2]);
  });

  it('skips foot changes and spans that move unevenly', () => {
    const soles = [
      { left: 30, right: 34 },
      { left: 36, right: 40 },
      { left: 35, right: 38 },
    ];
    expect(plantedFootTravels(soles)).toEqual([]);
  });
});

describe('rowPeriod', () => {
  it('finds the stripe spacing', () => {
    expect(rowPeriod(beltRow(8, 0))).toBe(8);
  });

  it('is null when no pattern repeats at least twice', () => {
    expect(rowPeriod([1, 2, 3, 4, 5, 6])).toBeNull();
  });
});

describe('rowShift', () => {
  it('measures how far the texture moved backward', () => {
    expect(rowShift(beltRow(8, 0), beltRow(8, 3))).toBe(3);
  });

  it('is null when no offset matches', () => {
    const plain = Array.from({ length: 32 }, () => BELT);
    expect(rowShift(beltRow(8, 0), plain)).toBeNull();
  });
});

describe('beltSpan', () => {
  const O = 0x1e1a24;

  it('grows from the part under the rider over the colors seen there, in every frame', () => {
    const rows = [
      [-1, O, BELT, STRIPE, BELT, BELT, STRIPE, BELT, O, -1],
      [-1, O, STRIPE, BELT, BELT, STRIPE, BELT, BELT, O, -1],
    ];
    expect(beltSpan(rows, 3, 5)).toEqual({ from: 2, to: 7 });
  });

  it('is null when a frame has a transparent pixel under the rider', () => {
    expect(beltSpan([[O, BELT, -1, BELT, O]], 1, 3)).toBeNull();
  });
});

describe('beltMotionProblems', () => {
  it('accepts a belt that moves with the planted foot and loops seamlessly', () => {
    expect(beltMotionProblems(beltCycle(8, 8, 2), 2)).toEqual([]);
  });

  it('measures stripe spacings longer than half the window across the cycle', () => {
    expect(beltMotionProblems(beltCycle(8, 20, 5), 5)).toEqual([]);
    expect(beltMotionProblems(beltCycle(8, 28, 7), 7)).toEqual([]);
  });

  it('reports a shift that differs from the foot travel', () => {
    expect(beltMotionProblems(beltCycle(8, 8, 2), 3)).toContain(
      'belt frame 0 -> 1 shifts 2 px (planted foot travels 3 px)',
    );
  });

  it('reports stripes too close together for the shift', () => {
    expect(beltMotionProblems(beltCycle(4, 6, 3), 3)).toEqual([
      'stripe spacing 6 px is not more than twice the 3 px shift',
    ]);
  });

  it('reports a cycle that does not move whole stripe spacings', () => {
    expect(beltMotionProblems(beltCycle(6, 8, 2), 2)).toEqual([
      'belt frame 5 -> 0 shifts 6 px (planted foot travels 2 px)',
      'one cycle shifts 12 px, not a whole number of 8 px stripe spacings',
    ]);
  });

  it('reports a belt without a repeating pattern', () => {
    expect(beltMotionProblems([[1, 2, 3, 4, 5, 6]], 2)).toContain(
      'the belt surface has no repeating stripe pattern',
    );
  });

  it('reports a belt with no frames', () => {
    expect(beltMotionProblems([], 2)).toEqual(['the belt has no frames']);
  });
});
