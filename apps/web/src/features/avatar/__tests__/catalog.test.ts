import { describe, it, expect } from 'vitest';
import {
  BottomItemSchema,
  HairColorSchema,
  HairStyleSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import {
  AVATAR_SHEET_IDS,
  BODY_SHEET,
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../catalog.js';
import type { Option } from '../catalog.js';

const GROUPS: ReadonlyArray<readonly [string, readonly string[], Record<string, Option>]> = [
  ['skin tone', SkinToneSchema.options, SKIN_TONE_OPTIONS],
  ['hair style', HairStyleSchema.options, HAIR_STYLE_OPTIONS],
  ['hair color', HairColorSchema.options, HAIR_COLOR_OPTIONS],
  ['top', TopItemSchema.options, TOP_OPTIONS],
  ['bottom', BottomItemSchema.options, BOTTOM_OPTIONS],
  ['shoes', ShoesItemSchema.options, SHOES_OPTIONS],
];

describe('catalog option sets', () => {
  it.each(GROUPS)('%s has exactly one entry per enum value', (_name, ids, options) => {
    expect(Object.keys(options).sort()).toEqual([...ids].sort());
  });

  it.each(GROUPS)('every %s option has a non-empty label', (_name, ids, options) => {
    for (const id of ids) {
      const label = options[id]?.label ?? '';
      expect(label.trim().length, id).toBeGreaterThan(0);
    }
  });

  it.each(GROUPS)('%s labels are unique within the group', (_name, _ids, options) => {
    const labels = Object.values(options).map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses the display labels the creator and describeAppearance rely on', () => {
    expect(SKIN_TONE_OPTIONS['tone-1'].label).toBe('Tone 1');
    expect(SKIN_TONE_OPTIONS['tone-6'].label).toBe('Tone 6');
    expect(HAIR_STYLE_OPTIONS.short.label).toBe('Short');
    expect(HAIR_STYLE_OPTIONS.curly.label).toBe('Curly');
    expect(HAIR_STYLE_OPTIONS.ponytail.label).toBe('Ponytail');
    expect(HAIR_COLOR_OPTIONS.black.label).toBe('Black');
    expect(HAIR_COLOR_OPTIONS['dark-brown'].label).toBe('Dark brown');
    expect(TOP_OPTIONS['starter-tee-red'].label).toBe('Red tee');
    expect(BOTTOM_OPTIONS['starter-shorts-navy'].label).toBe('Navy shorts');
    expect(SHOES_OPTIONS['starter-shoes-white'].label).toBe('White shoes');
  });
});

describe('catalog sheets', () => {
  it('gives each hair style its own sheet', () => {
    expect(HAIR_STYLE_OPTIONS.short.sheet).toBe('hair-short');
    expect(HAIR_STYLE_OPTIONS.curly.sheet).toBe('hair-curly');
    expect(HAIR_STYLE_OPTIONS.ponytail.sheet).toBe('hair-ponytail');
  });

  it('maps every starter clothing color to its one shared base sprite', () => {
    for (const option of Object.values(TOP_OPTIONS)) {
      expect(option.sheet).toBe('top-starter-tee');
    }
    for (const option of Object.values(BOTTOM_OPTIONS)) {
      expect(option.sheet).toBe('bottom-starter-shorts');
    }
    for (const option of Object.values(SHOES_OPTIONS)) {
      expect(option.sheet).toBe('shoes-starter');
    }
  });

  it('names the body sheet', () => {
    expect(BODY_SHEET).toBe('body');
  });

  it('lists body plus every distinct hair and clothing sheet once', () => {
    expect(AVATAR_SHEET_IDS).toEqual([
      'body',
      'hair-short',
      'hair-curly',
      'hair-ponytail',
      'top-starter-tee',
      'bottom-starter-shorts',
      'shoes-starter',
    ]);
  });
});
