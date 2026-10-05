import type {
  BottomItem,
  HairColor,
  HairStyle,
  ShoesItem,
  SkinTone,
  TopItem,
} from '@tracks/types';

/** Display data for one catalog ID. */
export interface Option {
  label: string;
}

// Sheet IDs are export basenames: apps/web/src/assets/sprites/<id>.json and <id>.png.

export const SKIN_TONE_OPTIONS: Record<SkinTone, Option> = {
  'tone-1': { label: 'Tone 1' },
  'tone-2': { label: 'Tone 2' },
  'tone-3': { label: 'Tone 3' },
  'tone-4': { label: 'Tone 4' },
  'tone-5': { label: 'Tone 5' },
  'tone-6': { label: 'Tone 6' },
};

export const HAIR_STYLE_OPTIONS: Record<HairStyle, Option & { sheet: string }> = {
  short: { label: 'Short', sheet: 'hair-short' },
  curly: { label: 'Curly', sheet: 'hair-curly' },
  ponytail: { label: 'Ponytail', sheet: 'hair-ponytail' },
};

export const HAIR_COLOR_OPTIONS: Record<HairColor, Option> = {
  black: { label: 'Black' },
  'dark-brown': { label: 'Dark brown' },
  'light-brown': { label: 'Light brown' },
  blonde: { label: 'Blonde' },
  auburn: { label: 'Auburn' },
  red: { label: 'Red' },
  gray: { label: 'Gray' },
  blue: { label: 'Blue' },
};

export const TOP_OPTIONS: Record<TopItem, Option & { sheet: string }> = {
  'starter-tee-red': { label: 'Red tee', sheet: 'top-starter-tee' },
  'starter-tee-blue': { label: 'Blue tee', sheet: 'top-starter-tee' },
  'starter-tee-green': { label: 'Green tee', sheet: 'top-starter-tee' },
};

export const BOTTOM_OPTIONS: Record<BottomItem, Option & { sheet: string }> = {
  'starter-shorts-navy': { label: 'Navy shorts', sheet: 'bottom-starter-shorts' },
  'starter-shorts-black': { label: 'Black shorts', sheet: 'bottom-starter-shorts' },
  'starter-shorts-gray': { label: 'Gray shorts', sheet: 'bottom-starter-shorts' },
};

export const SHOES_OPTIONS: Record<ShoesItem, Option & { sheet: string }> = {
  'starter-shoes-white': { label: 'White shoes', sheet: 'shoes-starter' },
  'starter-shoes-black': { label: 'Black shoes', sheet: 'shoes-starter' },
  'starter-shoes-red': { label: 'Red shoes', sheet: 'shoes-starter' },
};

export const BODY_SHEET = 'body';

/** Every avatar sheet, each once: body, then hair, top, bottom and shoes sheets. */
export const AVATAR_SHEET_IDS: readonly string[] = [
  ...new Set([
    BODY_SHEET,
    ...Object.values(HAIR_STYLE_OPTIONS).map((option) => option.sheet),
    ...Object.values(TOP_OPTIONS).map((option) => option.sheet),
    ...Object.values(BOTTOM_OPTIONS).map((option) => option.sheet),
    ...Object.values(SHOES_OPTIONS).map((option) => option.sheet),
  ]),
];
