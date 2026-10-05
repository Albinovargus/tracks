import type { BottomItem, HairColor, ShoesItem, SkinTone, TopItem } from '@tracks/types';
import type { Ramp } from './swap.js';

/**
 * Reserved key colors drawn into the art. Matched by exact RGB at runtime and
 * replaced by a target ramp; never shown on screen.
 */
export const PLACEHOLDER_RAMPS: { skin: Ramp; hair: Ramp; cloth: Ramp } = {
  skin: [0xff80ff, 0xff40ff, 0xff00ff],
  hair: [0x80ffff, 0x40ffff, 0x00ffff],
  cloth: [0xffff80, 0xffff40, 0xffff00],
};

/** Skin tones, light to deep. */
export const SKIN_RAMPS: Record<SkinTone, Ramp> = {
  'tone-1': [0xfce3d3, 0xf5cdb6, 0xdda88e],
  'tone-2': [0xf6d2b4, 0xedb98f, 0xcf9670],
  'tone-3': [0xe8b88e, 0xd49a6a, 0xb07a4e],
  'tone-4': [0xc98e63, 0xb0744a, 0x8c5636],
  'tone-5': [0x9c6644, 0x80502f, 0x613a20],
  'tone-6': [0x6e4630, 0x563321, 0x3d2216],
};

export const HAIR_RAMPS: Record<HairColor, Ramp> = {
  black: [0x4a4458, 0x2b2733, 0x18151d],
  'dark-brown': [0x7a5236, 0x5a3a24, 0x3e2716],
  'light-brown': [0xb78652, 0x96693b, 0x714c29],
  blonde: [0xf6de8d, 0xe3c163, 0xbf9a41],
  auburn: [0xb8583a, 0x924126, 0x6c2e1a],
  red: [0xe8643c, 0xc8462a, 0x9a301e],
  gray: [0xd2d2d6, 0xa9a9b1, 0x7e7e88],
  blue: [0x6fa8f0, 0x3f7fd9, 0x2a59a8],
};

/** One ramp per clothing item ID; every item's sheet carries PH cloth. */
export const CLOTH_RAMPS: Record<TopItem | BottomItem | ShoesItem, Ramp> = {
  'starter-tee-red': [0xf2685e, 0xd93b3b, 0xa82a32],
  'starter-tee-blue': [0x6aa9f2, 0x3b7dd9, 0x2a5aa8],
  'starter-tee-green': [0x7ed37a, 0x46a84a, 0x2f7a3a],
  'starter-shorts-navy': [0x4a5c8c, 0x2f3e6b, 0x1f2848],
  'starter-shorts-black': [0x5a5a66, 0x3a3a44, 0x24242c],
  'starter-shorts-gray': [0xb4b4bc, 0x8e8e98, 0x6a6a74],
  'starter-shoes-white': [0xf8f8f4, 0xe2e2da, 0xb8b8b0],
  'starter-shoes-black': [0x4e4e58, 0x2e2e36, 0x1a1a20],
  'starter-shoes-red': [0xf06a5a, 0xd63a34, 0xa0262a],
};

/** The ramp's base shade as a CSS color, for picker swatches. */
export function rampToCss(ramp: Ramp): string {
  return `#${ramp[1].toString(16).padStart(6, '0')}`;
}
