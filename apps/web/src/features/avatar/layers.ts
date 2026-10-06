import type { AvatarAppearance } from '@tracks/types';
import {
  BODY_SHEET,
  BOTTOM_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  TOP_OPTIONS,
} from './catalog.js';
import { tagFrames, type AnimationTag } from './frames.js';
import { CLOTH_RAMPS, HAIR_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from './palette.js';
import { getSheet, SHEETS, type SheetData, type SheetFrame, type SheetId } from './sheets.js';
import { buildSwap, type Swap } from './swap.js';

/** One layer to draw: which sheet, the recolor to apply, and the source rect. */
export interface DrawItem {
  sheet: SheetId;
  swap: Swap;
  rect: SheetFrame;
}

/**
 * The avatar's layers in draw order (body, shoes, bottom, top, hair) for one
 * frame. `frameOffset` is the 0-based offset within `tag` (frameAt's result);
 * each sheet maps it through its own tag range, and the source rect is read
 * from that sheet's frame data.
 */
export function drawList(
  appearance: AvatarAppearance,
  tag: AnimationTag,
  frameOffset: number,
  registry: ReadonlyMap<SheetId, SheetData> = SHEETS,
): DrawItem[] {
  const layers: { sheet: SheetId; swap: Swap }[] = [
    {
      sheet: BODY_SHEET,
      swap: buildSwap(PLACEHOLDER_RAMPS.skin, SKIN_RAMPS[appearance.skin_tone]),
    },
    {
      sheet: SHOES_OPTIONS[appearance.shoes].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[appearance.shoes]),
    },
    {
      sheet: BOTTOM_OPTIONS[appearance.bottom].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[appearance.bottom]),
    },
    {
      sheet: TOP_OPTIONS[appearance.top].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[appearance.top]),
    },
    {
      sheet: HAIR_STYLE_OPTIONS[appearance.hair_style].sheet,
      swap: buildSwap(PLACEHOLDER_RAMPS.hair, HAIR_RAMPS[appearance.hair_color]),
    },
  ];

  return layers.map(({ sheet, swap }) => {
    const data = getSheet(sheet, registry);
    const frame = tagFrames(data, tag)[frameOffset];
    const rect = frame ? data.frames[frame.index] : undefined;
    if (!rect) {
      throw new Error(`Sprite sheet "${sheet}" tag "${tag}" has no frame at offset ${frameOffset}`);
    }
    return { sheet, swap, rect };
  });
}
