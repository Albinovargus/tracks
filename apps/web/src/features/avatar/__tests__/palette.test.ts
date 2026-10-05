import { describe, it, expect } from 'vitest';
import {
  BottomItemSchema,
  HairColorSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import {
  CLOTH_RAMPS,
  HAIR_RAMPS,
  PLACEHOLDER_RAMPS,
  SKIN_RAMPS,
  rampToCss,
} from '../palette.js';
import type { Ramp } from '../swap.js';

const PLACEHOLDER_COLORS = new Set<number>([
  ...PLACEHOLDER_RAMPS.skin,
  ...PLACEHOLDER_RAMPS.hair,
  ...PLACEHOLDER_RAMPS.cloth,
]);

const TARGET_RAMPS: ReadonlyArray<readonly [string, Ramp]> = [
  ...Object.entries(SKIN_RAMPS),
  ...Object.entries(HAIR_RAMPS),
  ...Object.entries(CLOTH_RAMPS),
];

/** Rec. 601 luma of a packed 0xRRGGBB color. */
function luma(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe('PLACEHOLDER_RAMPS', () => {
  it('holds the exact reserved key colors as [light, base, shadow]', () => {
    expect(PLACEHOLDER_RAMPS).toEqual({
      skin: [0xff80ff, 0xff40ff, 0xff00ff],
      hair: [0x80ffff, 0x40ffff, 0x00ffff],
      cloth: [0xffff80, 0xffff40, 0xffff00],
    });
  });

  it('has 9 distinct placeholder colors', () => {
    expect(PLACEHOLDER_COLORS.size).toBe(9);
  });
});

describe('target ramps', () => {
  it('cover every skin tone, hair color and clothing item exactly', () => {
    expect(Object.keys(SKIN_RAMPS).sort()).toEqual([...SkinToneSchema.options].sort());
    expect(Object.keys(HAIR_RAMPS).sort()).toEqual([...HairColorSchema.options].sort());
    expect(Object.keys(CLOTH_RAMPS).sort()).toEqual(
      [...TopItemSchema.options, ...BottomItemSchema.options, ...ShoesItemSchema.options].sort(),
    );
  });

  it.each(TARGET_RAMPS)('%s has 3 packed RGB shades', (_id, ramp) => {
    expect(ramp).toHaveLength(3);
    for (const color of ramp) {
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it.each(TARGET_RAMPS)('%s contains no placeholder color', (_id, ramp) => {
    for (const color of ramp) {
      expect(PLACEHOLDER_COLORS.has(color)).toBe(false);
    }
  });

  it.each(TARGET_RAMPS)('%s runs light > base > shadow', (_id, ramp) => {
    const [light, base, shadow] = ramp;
    expect(luma(light)).toBeGreaterThan(luma(base));
    expect(luma(base)).toBeGreaterThan(luma(shadow));
  });

  it('orders skin tones from light to deep', () => {
    const bases = SkinToneSchema.options.map((tone) => luma(SKIN_RAMPS[tone][1]));
    expect(new Set(bases).size).toBe(bases.length);
    expect(bases).toEqual([...bases].sort((a, b) => b - a));
  });
});

describe('rampToCss', () => {
  it('formats the base shade as lowercase #rrggbb', () => {
    expect(rampToCss(PLACEHOLDER_RAMPS.skin)).toBe('#ff40ff');
    expect(rampToCss([0xabcdef, 0xa1b2c3, 0x000000])).toBe('#a1b2c3');
  });

  it('zero-pads dark colors to 6 digits', () => {
    expect(rampToCss([0x000010, 0x00000a, 0x000000])).toBe('#00000a');
  });
});
