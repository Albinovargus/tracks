import { describe, it, expect, vi } from 'vitest';
import {
  AvatarAppearanceSchema,
  BottomItemSchema,
  HairColorSchema,
  HairStyleSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import type { AvatarAppearance } from '@tracks/types';
import { DEFAULT_APPEARANCE, describeAppearance, randomAppearance } from '../appearance.js';

describe('DEFAULT_APPEARANCE', () => {
  it('parses with AvatarAppearanceSchema', () => {
    expect(AvatarAppearanceSchema.parse(DEFAULT_APPEARANCE)).toEqual(DEFAULT_APPEARANCE);
  });

  it('uses the first value of each enum', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      skin_tone: SkinToneSchema.options[0],
      hair_style: HairStyleSchema.options[0],
      hair_color: HairColorSchema.options[0],
      top: TopItemSchema.options[0],
      bottom: BottomItemSchema.options[0],
      shoes: ShoesItemSchema.options[0],
    });
  });
});

describe('describeAppearance', () => {
  it('describes the default appearance from catalog labels', () => {
    expect(describeAppearance(DEFAULT_APPEARANCE)).toBe(
      'Your athlete: tone 1 skin, short black hair, red tee, navy shorts, white shoes',
    );
  });

  it('lowercases multi-word labels', () => {
    const appearance: AvatarAppearance = {
      skin_tone: 'tone-3',
      hair_style: 'curly',
      hair_color: 'dark-brown',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-gray',
      shoes: 'starter-shoes-red',
    };
    expect(describeAppearance(appearance)).toBe(
      'Your athlete: tone 3 skin, curly dark brown hair, green tee, gray shorts, red shoes',
    );
  });
});

describe('randomAppearance', () => {
  it('picks the first option of every field when rng returns 0', () => {
    expect(randomAppearance(() => 0)).toEqual(DEFAULT_APPEARANCE);
  });

  it('picks the last option of every field when rng returns 0.999', () => {
    expect(randomAppearance(() => 0.999)).toEqual({
      skin_tone: 'tone-6',
      hair_style: 'ponytail',
      hair_color: 'blue',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-gray',
      shoes: 'starter-shoes-red',
    });
  });

  it('draws each field independently, once, in schema field order', () => {
    const values = [0, 0.999, 0, 0.999, 0, 0.999];
    const rng = vi.fn(() => values.shift() ?? 0);
    expect(randomAppearance(rng)).toEqual({
      skin_tone: 'tone-1',
      hair_style: 'ponytail',
      hair_color: 'black',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-navy',
      shoes: 'starter-shoes-red',
    });
    expect(rng).toHaveBeenCalledTimes(6);
  });

  it('maps rng into uniform buckets: floor(rng() * n)', () => {
    expect(randomAppearance(() => 0.5)).toEqual({
      skin_tone: 'tone-4',
      hair_style: 'curly',
      hair_color: 'auburn',
      top: 'starter-tee-blue',
      bottom: 'starter-shorts-black',
      shoes: 'starter-shoes-black',
    });
  });

  it('always returns a valid appearance for rng values in [0, 1)', () => {
    for (const r of [0, 0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 0.9, 0.999]) {
      expect(AvatarAppearanceSchema.safeParse(randomAppearance(() => r)).success).toBe(true);
    }
  });

  it('throws when rng returns a value outside [0, 1)', () => {
    expect(() => randomAppearance(() => 1)).toThrow('rng() must return a value in [0, 1)');
  });
});
