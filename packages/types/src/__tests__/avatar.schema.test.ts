import { describe, it, expect } from 'vitest';
import {
  SkinToneSchema,
  HairStyleSchema,
  HairColorSchema,
  TopItemSchema,
  BottomItemSchema,
  ShoesItemSchema,
  AvatarAppearanceSchema,
  AvatarSchema,
} from '../avatar.schema.js';
import type { AvatarAppearance } from '../avatar.schema.js';
import * as barrel from '../index.js';

const validAppearance: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

const validAvatar = {
  ...validAppearance,
  created_at: '2026-10-04T21:39:39.724427+00:00',
  updated_at: '2026-10-04T21:39:39.724427+00:00',
};

const appearanceFields = [
  'skin_tone',
  'hair_style',
  'hair_color',
  'top',
  'bottom',
  'shoes',
] as const;

describe('catalog enums', () => {
  it('lists skin tones in catalog order', () => {
    expect(SkinToneSchema.options).toEqual([
      'tone-1',
      'tone-2',
      'tone-3',
      'tone-4',
      'tone-5',
      'tone-6',
    ]);
  });

  it('lists hair styles in catalog order', () => {
    expect(HairStyleSchema.options).toEqual(['short', 'curly', 'ponytail']);
  });

  it('lists hair colors in catalog order', () => {
    expect(HairColorSchema.options).toEqual([
      'black',
      'dark-brown',
      'light-brown',
      'blonde',
      'auburn',
      'red',
      'gray',
      'blue',
    ]);
  });

  it('lists starter tops in catalog order', () => {
    expect(TopItemSchema.options).toEqual([
      'starter-tee-red',
      'starter-tee-blue',
      'starter-tee-green',
    ]);
  });

  it('lists starter bottoms in catalog order', () => {
    expect(BottomItemSchema.options).toEqual([
      'starter-shorts-navy',
      'starter-shorts-black',
      'starter-shorts-gray',
    ]);
  });

  it('lists starter shoes in catalog order', () => {
    expect(ShoesItemSchema.options).toEqual([
      'starter-shoes-white',
      'starter-shoes-black',
      'starter-shoes-red',
    ]);
  });

  it('rejects an ID from another slot', () => {
    expect(() => TopItemSchema.parse('starter-shorts-navy')).toThrow();
  });
});

describe('AvatarAppearanceSchema', () => {
  it('parses a valid appearance', () => {
    expect(AvatarAppearanceSchema.parse(validAppearance)).toEqual(
      validAppearance,
    );
  });

  it('parses the first option of every field', () => {
    const firsts = {
      skin_tone: 'tone-1',
      hair_style: 'short',
      hair_color: 'black',
      top: 'starter-tee-red',
      bottom: 'starter-shorts-navy',
      shoes: 'starter-shoes-white',
    };
    expect(AvatarAppearanceSchema.parse(firsts)).toEqual(firsts);
  });

  it.each(appearanceFields)('rejects an unknown %s ID', (field) => {
    const result = AvatarAppearanceSchema.safeParse({
      ...validAppearance,
      [field]: 'not-a-catalog-id',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it.each(appearanceFields)('rejects a missing %s', (field) => {
    const partial = Object.fromEntries(
      Object.entries(validAppearance).filter(([key]) => key !== field),
    );
    const result = AvatarAppearanceSchema.safeParse(partial);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it('rejects an empty object', () => {
    expect(() => AvatarAppearanceSchema.parse({})).toThrow();
  });

  it('strips a user_id sent with the appearance', () => {
    const result = AvatarAppearanceSchema.parse({
      ...validAppearance,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual(validAppearance);
    expect(result).not.toHaveProperty('user_id');
  });
});

describe('AvatarSchema', () => {
  it('accepts Postgres timestamptz values with a +00:00 offset', () => {
    const result = AvatarSchema.parse(validAvatar);
    expect(result.created_at).toBe('2026-10-04T21:39:39.724427+00:00');
    expect(result.updated_at).toBe('2026-10-04T21:39:39.724427+00:00');
  });

  it('accepts Z timestamps', () => {
    expect(() =>
      AvatarSchema.parse({
        ...validAppearance,
        created_at: '2026-10-04T21:39:39.724Z',
        updated_at: '2026-10-04T21:39:39.724Z',
      }),
    ).not.toThrow();
  });

  it('strips unknown keys like user_id from a database row', () => {
    const result = AvatarSchema.parse({
      ...validAvatar,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual(validAvatar);
    expect(result).not.toHaveProperty('user_id');
  });

  it('rejects missing timestamps', () => {
    expect(() => AvatarSchema.parse(validAppearance)).toThrow();
  });

  it('rejects a non-ISO timestamp', () => {
    expect(() =>
      AvatarSchema.parse({ ...validAvatar, updated_at: 'yesterday' }),
    ).toThrow();
  });

  it('rejects an unknown catalog ID in a stored row', () => {
    expect(() =>
      AvatarSchema.parse({ ...validAvatar, hair_style: 'mohawk' }),
    ).toThrow();
  });
});

describe('package barrel', () => {
  it('re-exports every avatar schema from src/index.ts', () => {
    expect(barrel.SkinToneSchema).toBe(SkinToneSchema);
    expect(barrel.HairStyleSchema).toBe(HairStyleSchema);
    expect(barrel.HairColorSchema).toBe(HairColorSchema);
    expect(barrel.TopItemSchema).toBe(TopItemSchema);
    expect(barrel.BottomItemSchema).toBe(BottomItemSchema);
    expect(barrel.ShoesItemSchema).toBe(ShoesItemSchema);
    expect(barrel.AvatarAppearanceSchema).toBe(AvatarAppearanceSchema);
    expect(barrel.AvatarSchema).toBe(AvatarSchema);
  });
});
