import { describe, it, expect } from 'vitest';
import type { AvatarAppearance } from '@tracks/types';
import { drawList } from '../layers.js';
import { CLOTH_RAMPS, HAIR_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from '../palette.js';
import { getSheet, type SheetFrame, type SheetId } from '../sheets.js';
import { buildSwap } from '../swap.js';
import { FIXTURE_REGISTRY, registryOf } from './fixtures.js';

const LOOK: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'blonde',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-gray',
  shoes: 'starter-shoes-red',
};

function rect(id: SheetId, index: number): SheetFrame {
  const frame = getSheet(id, FIXTURE_REGISTRY).frames[index];
  if (!frame) throw new Error(`fixture ${id} has no frame ${index}`);
  return frame;
}

describe('drawList', () => {
  it('draws body, shoes, bottom, top, then hair', () => {
    expect(drawList(LOOK, 'front-idle', 0, FIXTURE_REGISTRY).map((d) => d.sheet)).toEqual([
      'body',
      'shoes-starter',
      'bottom-starter-shorts',
      'top-starter-tee',
      'hair-curly',
    ]);
  });

  it('picks the hair sheet from the hair style', () => {
    const short = drawList({ ...LOOK, hair_style: 'short' }, 'front-idle', 0, FIXTURE_REGISTRY);
    const ponytail = drawList({ ...LOOK, hair_style: 'ponytail' }, 'front-idle', 0, FIXTURE_REGISTRY);
    expect(short.at(-1)?.sheet).toBe('hair-short');
    expect(ponytail.at(-1)?.sheet).toBe('hair-ponytail');
  });

  it('swaps skin on body, hair on hair, and cloth to each clothing item', () => {
    expect(drawList(LOOK, 'front-idle', 0, FIXTURE_REGISTRY).map((d) => d.swap)).toEqual([
      buildSwap(PLACEHOLDER_RAMPS.skin, SKIN_RAMPS['tone-3']),
      buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS['starter-shoes-red']),
      buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS['starter-shorts-gray']),
      buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS['starter-tee-blue']),
      buildSwap(PLACEHOLDER_RAMPS.hair, HAIR_RAMPS.blonde),
    ]);
  });

  it("offsets from each sheet's own tag start", () => {
    // side-run starts at 5 in body/shoes/bottom, 6 in hair-curly (pad 1), 7 in top (pad 2).
    expect(drawList(LOOK, 'side-run', 2, FIXTURE_REGISTRY).map((d) => d.rect)).toEqual([
      rect('body', 7),
      rect('shoes-starter', 7),
      rect('bottom-starter-shorts', 7),
      rect('top-starter-tee', 9),
      rect('hair-curly', 8),
    ]);
  });

  it('reads source rects from the sheet data, never from the frame index', () => {
    // Re-pack top-starter-tee as a vertical strip. A drawList that computed
    // rects as (index × 64, 0), or reused body's rects, would get the top wrong.
    const vertical = registryOf(
      ...[...FIXTURE_REGISTRY.values()].map((sheet) =>
        sheet.id === 'top-starter-tee'
          ? { ...sheet, frames: sheet.frames.map((frame, i) => ({ ...frame, x: 0, y: i * 64 })) }
          : sheet,
      ),
    );
    const [bodyItem, , , topItem] = drawList(LOOK, 'turn', 0, vertical);
    expect(bodyItem?.rect).toEqual({ x: 4 * 64, y: 0, w: 64, h: 64, duration: 150 });
    expect(topItem?.rect).toEqual({ x: 0, y: 6 * 64, w: 64, h: 64, duration: 150 });
  });

  it('throws naming a sheet missing from the registry', () => {
    const withoutCurly = registryOf(
      ...[...FIXTURE_REGISTRY.values()].filter((sheet) => sheet.id !== 'hair-curly'),
    );
    expect(() => drawList(LOOK, 'front-idle', 0, withoutCurly)).toThrow('"hair-curly"');
  });

  it('throws when the offset is past the end of a tag', () => {
    expect(() => drawList(LOOK, 'turn', 1, FIXTURE_REGISTRY)).toThrow(
      'Sprite sheet "body" tag "turn" has no frame at offset 1',
    );
  });
});
