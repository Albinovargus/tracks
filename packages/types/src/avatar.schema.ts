import { z } from 'zod';

// Catalog IDs are append-only: never rename or remove one unless a migration
// first rewrites the avatars rows that store it. The first value of each enum
// is the default the creator starts from.

export const SkinToneSchema = z.enum([
  'tone-1',
  'tone-2',
  'tone-3',
  'tone-4',
  'tone-5',
  'tone-6',
]);
export type SkinTone = z.infer<typeof SkinToneSchema>;

export const HairStyleSchema = z.enum(['short', 'curly', 'ponytail']);
export type HairStyle = z.infer<typeof HairStyleSchema>;

export const HairColorSchema = z.enum([
  'black',
  'dark-brown',
  'light-brown',
  'blonde',
  'auburn',
  'red',
  'gray',
  'blue',
]);
export type HairColor = z.infer<typeof HairColorSchema>;

export const TopItemSchema = z.enum([
  'starter-tee-red',
  'starter-tee-blue',
  'starter-tee-green',
]);
export type TopItem = z.infer<typeof TopItemSchema>;

export const BottomItemSchema = z.enum([
  'starter-shorts-navy',
  'starter-shorts-black',
  'starter-shorts-gray',
]);
export type BottomItem = z.infer<typeof BottomItemSchema>;

export const ShoesItemSchema = z.enum([
  'starter-shoes-white',
  'starter-shoes-black',
  'starter-shoes-red',
]);
export type ShoesItem = z.infer<typeof ShoesItemSchema>;

export const AvatarAppearanceSchema = z.object({
  skin_tone: SkinToneSchema,
  hair_style: HairStyleSchema,
  hair_color: HairColorSchema,
  top: TopItemSchema,
  bottom: BottomItemSchema,
  shoes: ShoesItemSchema,
});
export type AvatarAppearance = z.infer<typeof AvatarAppearanceSchema>;

export const AvatarSchema = AvatarAppearanceSchema.extend({
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type Avatar = z.infer<typeof AvatarSchema>;
