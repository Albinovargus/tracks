import { describe, expect, it } from 'vitest';
import {
  AVATAR_TAGS,
  ROOM_SLOT_SLICES,
  beltProblems,
  cellProblems,
  isAvatarSheet,
  opaqueColors,
  parseAsepriteJson,
  pixelProblems,
  placeholderProblems,
  sliceProblems,
  swapRampFor,
  tagProblems,
  timingProblems,
  turnFrameProblems,
  type AsepriteJson,
  type RgbaImage,
} from './sheetRules.js';

const SKIN = [0xff80ff, 0xff40ff, 0xff00ff] as const;
const PLACEHOLDERS = [...SKIN, 0x80ffff, 0x40ffff, 0x00ffff, 0xffff80, 0xffff40, 0xffff00];
const OUTLINE = 0x1e1a24;

type Pixel = readonly [x: number, y: number, rgb: number, alpha?: number];

function image(width: number, height: number, pixels: readonly Pixel[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (const [x, y, rgb, alpha = 255] of pixels) {
    const o = (y * width + x) * 4;
    data[o] = (rgb >> 16) & 0xff;
    data[o + 1] = (rgb >> 8) & 0xff;
    data[o + 2] = rgb & 0xff;
    data[o + 3] = alpha;
  }
  return { width, height, data };
}

type TagRow = readonly [name: string, from: number, to: number, direction?: string];

/** A horizontal strip shaped like `aseprite --format json-array` output. */
function strip(
  durations: readonly number[],
  tags: readonly TagRow[] = [],
  slices: readonly unknown[] = [],
  cell = 64,
): AsepriteJson {
  return parseAsepriteJson({
    frames: durations.map((duration, i) => ({
      filename: `x ${i}.aseprite`,
      frame: { x: i * cell, y: 0, w: cell, h: cell },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cell, h: cell },
      sourceSize: { w: cell, h: cell },
      duration,
    })),
    meta: {
      app: 'https://www.aseprite.org/',
      version: '1.3.18.6-x64',
      image: 'x.png',
      format: 'RGBA8888',
      size: { w: durations.length * cell, h: cell },
      scale: '1',
      frameTags: tags.map(([name, from, to, direction = 'forward']) => ({
        name,
        from,
        to,
        direction,
        color: '#000000ff',
      })),
      slices,
    },
  });
}

const BODY_DURATIONS = [200, 200, 200, 150, 80, 80, 80, 80];
const BODY_TAGS: readonly TagRow[] = [
  ['front-idle', 0, 2],
  ['turn', 3, 3],
  ['side-run', 4, 7],
];

describe('parseAsepriteJson', () => {
  it('accepts json-array output and keeps frames, tags and slices', () => {
    const data = strip(
      [100, 120],
      [['belt', 0, 1]],
      [
        {
          name: 'rider',
          color: '#0000ffff',
          keys: [{ frame: 0, bounds: { x: 4, y: 2, w: 10, h: 6 }, pivot: { x: 5, y: 6 } }],
        },
      ],
    );
    expect(data.frames.map((f) => f.duration)).toEqual([100, 120]);
    expect(data.meta.frameTags).toEqual([{ name: 'belt', from: 0, to: 1, direction: 'forward' }]);
    expect(data.meta.slices[0]?.keys[0]?.pivot).toEqual({ x: 5, y: 6 });
  });

  it('rejects a sheet with no frames', () => {
    expect(() =>
      parseAsepriteJson({ frames: [], meta: { size: { w: 1, h: 1 }, frameTags: [], slices: [] } }),
    ).toThrow();
  });

  it('rejects the json-hash format', () => {
    expect(() =>
      parseAsepriteJson({
        frames: { 'x 0.aseprite': { frame: { x: 0, y: 0, w: 1, h: 1 }, duration: 100 } },
        meta: { size: { w: 1, h: 1 }, frameTags: [], slices: [] },
      }),
    ).toThrow();
  });
});

describe('swapRampFor and isAvatarSheet', () => {
  it('maps each avatar sheet to the ramp its swap replaces', () => {
    expect(swapRampFor('body')).toBe('skin');
    expect(swapRampFor('hair-curly')).toBe('hair');
    expect(swapRampFor('top-starter-tee')).toBe('cloth');
    expect(swapRampFor('bottom-starter-shorts')).toBe('cloth');
    expect(swapRampFor('shoes-starter')).toBe('cloth');
    expect(isAvatarSheet('body')).toBe(true);
    expect(isAvatarSheet('hair-short')).toBe(true);
  });

  it('treats room sheets as unswapped and not part of the avatar', () => {
    for (const id of ['background', 'treadmill', 'frame-bib', 'trophy-gold', 'medal-gold', 'plant']) {
      expect(swapRampFor(id)).toBeNull();
      expect(isAvatarSheet(id)).toBe(false);
    }
  });
});

describe('pixelProblems', () => {
  const palette = new Set([OUTLINE, ...SKIN]);

  it('accepts transparent pixels and exact palette colors at alpha 255', () => {
    const img = image(4, 2, [
      [0, 0, OUTLINE],
      [1, 0, 0xff40ff],
      [2, 1, 0x123456, 0],
    ]);
    expect(pixelProblems(img, palette)).toEqual([]);
  });

  it('reports pixels whose alpha is neither 0 nor 255', () => {
    const img = image(4, 2, [
      [3, 0, OUTLINE, 128],
      [0, 1, OUTLINE, 1],
    ]);
    expect(pixelProblems(img, palette)).toEqual([
      '2 pixels have alpha other than 0 or 255, first at (3, 0)',
    ]);
  });

  it('reports each off-palette opaque color once, at its first position', () => {
    const img = image(4, 2, [
      [1, 0, 0x010203],
      [2, 0, 0x010203],
      [0, 1, 0xfe40ff],
    ]);
    expect(pixelProblems(img, palette)).toEqual([
      'color #010203 at (1, 0) is not in palette.gpl',
      'color #fe40ff at (0, 1) is not in palette.gpl',
    ]);
  });
});

describe('opaqueColors', () => {
  it('collects the colors of alpha-255 pixels only', () => {
    const img = image(3, 1, [
      [0, 0, OUTLINE],
      [1, 0, 0xff00ff],
      [2, 0, 0x00ffff, 0],
    ]);
    expect([...opaqueColors(img)].sort((a, b) => a - b)).toEqual([OUTLINE, 0xff00ff]);
  });
});

describe('placeholderProblems', () => {
  it('accepts a swapped sheet that uses its own ramp', () => {
    expect(placeholderProblems(new Set([OUTLINE, 0xff40ff]), SKIN, PLACEHOLDERS)).toEqual([]);
  });

  it('reports a placeholder from another ramp', () => {
    expect(placeholderProblems(new Set([0xff40ff, 0x40ffff]), SKIN, PLACEHOLDERS)).toEqual([
      "placeholder #40ffff is not in this sheet's swap ramp (#ff80ff #ff40ff #ff00ff)",
    ]);
  });

  it('reports a swapped sheet that uses none of its ramp', () => {
    expect(placeholderProblems(new Set([OUTLINE]), SKIN, PLACEHOLDERS)).toEqual([
      'uses no color of its swap ramp (#ff80ff #ff40ff #ff00ff)',
    ]);
  });

  it('reports any placeholder in an unswapped sheet', () => {
    expect(placeholderProblems(new Set([OUTLINE, 0xffff00]), null, PLACEHOLDERS)).toEqual([
      'placeholder #ffff00 is used, but this sheet is not palette-swapped',
    ]);
    expect(placeholderProblems(new Set([OUTLINE]), null, PLACEHOLDERS)).toEqual([]);
  });
});

describe('cellProblems', () => {
  it('accepts 64x64 frames whose top row is transparent', () => {
    const img = image(128, 64, [
      [32, 15, OUTLINE],
      [96, 63, OUTLINE],
    ]);
    expect(cellProblems(img, strip([100, 100]))).toEqual([]);
  });

  it('reports a frame that is not 64x64', () => {
    expect(cellProblems(image(32, 32, []), strip([100], [], [], 32))).toEqual([
      'frame 0 is 32x32 (expected 64x64)',
    ]);
  });

  it('reports a non-transparent pixel on row 0 of a frame, at its frame-local x', () => {
    const img = image(128, 64, [[64 + 5, 0, OUTLINE, 128]]);
    expect(cellProblems(img, strip([100, 100]))).toEqual([
      'frame 1 has a non-transparent pixel on row 0 at x = 5',
    ]);
  });

  it('reports a frame that lies outside the PNG', () => {
    expect(cellProblems(image(64, 64, []), strip([100, 100]))).toEqual([
      'frame 1 lies outside the 64x64 PNG',
    ]);
  });
});

describe('turnFrameProblems', () => {
  it('accepts a one-frame turn tag, and sheets without one', () => {
    expect(turnFrameProblems(strip(BODY_DURATIONS, BODY_TAGS))).toEqual([]);
    expect(turnFrameProblems(strip([100]))).toEqual([]);
  });

  it('reports a turn tag that spans more than one frame', () => {
    const data = strip([100, 100, 100], [['turn', 1, 2]]);
    expect(turnFrameProblems(data)).toEqual(['tag "turn" covers 2 frames (expected 1)']);
  });
});

describe('tagProblems', () => {
  it('accepts the required tags played forward', () => {
    expect(tagProblems(strip(BODY_DURATIONS, BODY_TAGS), AVATAR_TAGS)).toEqual([]);
  });

  it('reports a missing tag, a non-forward direction and a range outside the frames', () => {
    const data = strip(
      [100, 100, 100],
      [
        ['front-idle', 0, 1, 'pingpong'],
        ['side-run', 2, 5],
      ],
    );
    expect(tagProblems(data, AVATAR_TAGS)).toEqual([
      'missing tag "turn"',
      'tag "front-idle" plays pingpong (expected forward)',
      'tag "side-run" covers frames 2-5, outside the 3 frames',
    ]);
  });
});

describe('timingProblems', () => {
  const body = strip(BODY_DURATIONS, BODY_TAGS);

  it('accepts a layer with the same frames, durations and tags as body', () => {
    expect(timingProblems(strip(BODY_DURATIONS, BODY_TAGS), body)).toEqual([]);
  });

  it('reports a different frame count, durations and tags', () => {
    const layer = strip(
      [200, 200, 200, 150, 80, 80, 80],
      [
        ['front-idle', 0, 2],
        ['turn', 3, 3],
        ['side-run', 4, 6],
      ],
    );
    expect(timingProblems(layer, body)).toEqual([
      'has 7 frames (body has 8)',
      'frame durations [200,200,200,150,80,80,80] differ from body [200,200,200,150,80,80,80,80]',
      'tags [front-idle 0-2 forward, turn 3-3 forward, side-run 4-6 forward] differ from body [front-idle 0-2 forward, turn 3-3 forward, side-run 4-7 forward]',
    ]);
  });
});

describe('beltProblems', () => {
  const body = strip(BODY_DURATIONS, BODY_TAGS);

  it('accepts a belt tag timed like body side-run', () => {
    expect(beltProblems(strip([80, 80, 80, 80], [['belt', 0, 3]]), body)).toEqual([]);
  });

  it('reports a missing belt tag', () => {
    expect(beltProblems(strip([80]), body)).toEqual(['missing tag "belt"']);
  });

  it('reports a belt whose frame count or durations differ from side-run', () => {
    expect(beltProblems(strip([80, 80, 80], [['belt', 0, 2]]), body)).toEqual([
      'belt has 3 frames (body side-run has 4)',
    ]);
    expect(beltProblems(strip([80, 80, 90, 80], [['belt', 0, 3]]), body)).toEqual([
      'belt durations [80,80,90,80] differ from body side-run [80,80,80,80]',
    ]);
  });

  it('reports a body without side-run', () => {
    expect(beltProblems(strip([80], [['belt', 0, 0]]), strip([100]))).toEqual([
      'body has no "side-run" tag',
    ]);
  });
});

describe('sliceProblems', () => {
  const bounds = { x: 0, y: 0, w: 8, h: 8 };

  it('accepts present slices, with pivots where required', () => {
    const data = strip([100], [], [{ name: 'rider', keys: [{ frame: 0, bounds, pivot: { x: 4, y: 8 } }] }]);
    expect(sliceProblems(data, ['rider'], true)).toEqual([]);
  });

  it('reports a missing pivot and a missing slice', () => {
    const data = strip([100], [], [{ name: 'rider', keys: [{ frame: 0, bounds }] }]);
    expect(sliceProblems(data, ['rider', 'decor'], true)).toEqual([
      'slice "rider" has no pivot',
      'missing slice "decor"',
    ]);
  });

  it('names every room slot slice', () => {
    expect(ROOM_SLOT_SLICES).toEqual([
      'trophy-1',
      'trophy-2',
      'trophy-3',
      'medal-1',
      'medal-2',
      'medal-3',
      'frame',
      'equipment',
      'decor',
    ]);
  });
});
