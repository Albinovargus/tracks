import {
  BottomItemSchema,
  HairColorSchema,
  HairStyleSchema,
  ShoesItemSchema,
  SkinToneSchema,
  TopItemSchema,
} from '@tracks/types';
import type { AvatarAppearance } from '@tracks/types';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from './catalog.js';

/** The first value of each catalog enum: a new player's starting look. */
export const DEFAULT_APPEARANCE = {
  skin_tone: 'tone-1',
  hair_style: 'short',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
} as const satisfies AvatarAppearance;

/** Accessible description built from catalog labels, used as the canvas aria-label. */
export function describeAppearance(appearance: AvatarAppearance): string {
  const skin = SKIN_TONE_OPTIONS[appearance.skin_tone].label.toLowerCase();
  const style = HAIR_STYLE_OPTIONS[appearance.hair_style].label.toLowerCase();
  const color = HAIR_COLOR_OPTIONS[appearance.hair_color].label.toLowerCase();
  const top = TOP_OPTIONS[appearance.top].label.toLowerCase();
  const bottom = BOTTOM_OPTIONS[appearance.bottom].label.toLowerCase();
  const shoes = SHOES_OPTIONS[appearance.shoes].label.toLowerCase();
  return `Your athlete: ${skin} skin, ${style} ${color} hair, ${top}, ${bottom}, ${shoes}`;
}

function pick<T extends string>(options: readonly T[], rng: () => number): T {
  const value = rng();
  const choice = options[Math.floor(value * options.length)];
  if (choice === undefined) {
    throw new Error(`rng() must return a value in [0, 1), got ${value}`);
  }
  return choice;
}

/**
 * Picks each field independently and uniformly from its enum, calling `rng`
 * once per field in schema order. `rng` returns values in [0, 1).
 */
export function randomAppearance(rng: () => number): AvatarAppearance {
  return {
    skin_tone: pick(SkinToneSchema.options, rng),
    hair_style: pick(HairStyleSchema.options, rng),
    hair_color: pick(HairColorSchema.options, rng),
    top: pick(TopItemSchema.options, rng),
    bottom: pick(BottomItemSchema.options, rng),
    shoes: pick(ShoesItemSchema.options, rng),
  };
}
