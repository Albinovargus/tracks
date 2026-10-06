import { describe, it, expect } from 'vitest';
import { buildRegistry, getSheet, parseSheet, SHEETS } from '../sheets.js';

// Hand-written in the shape of `aseprite --batch --format json-array --list-tags --list-slices`.
// Frame 1 sits BELOW frame 0 (y: 64), so a parser that computed rects from the
// frame index (i * 64) instead of reading frames[i].frame would fail.
const EXPORT = {
  frames: [
    {
      filename: 'treadmill 0.aseprite',
      frame: { x: 0, y: 0, w: 64, h: 64 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
      sourceSize: { w: 64, h: 64 },
      duration: 120,
    },
    {
      filename: 'treadmill 1.aseprite',
      frame: { x: 0, y: 64, w: 64, h: 64 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
      sourceSize: { w: 64, h: 64 },
      duration: 80,
    },
  ],
  meta: {
    app: 'https://www.aseprite.org/',
    version: '1.3.18.6-x64',
    image: 'treadmill.png',
    format: 'RGBA8888',
    size: { w: 64, h: 128 },
    scale: '1',
    frameTags: [
      { name: 'belt', from: 0, to: 1, direction: 'forward', color: '#000000ff' },
    ],
    slices: [
      {
        name: 'rider',
        color: '#0000ffff',
        keys: [{ frame: 0, bounds: { x: 20, y: 10, w: 16, h: 30 }, pivot: { x: 8, y: 29 } }],
      },
      {
        name: 'console',
        color: '#0000ffff',
        keys: [{ frame: 0, bounds: { x: 50, y: 4, w: 10, h: 20 } }],
      },
    ],
  },
};

describe('parseSheet', () => {
  it('keeps the id and image url', () => {
    const sheet = parseSheet('treadmill', EXPORT, '/assets/treadmill.png');
    expect(sheet.id).toBe('treadmill');
    expect(sheet.imageUrl).toBe('/assets/treadmill.png');
  });

  it('reads source rects from frames[i].frame and durations from frames[i].duration', () => {
    expect(parseSheet('treadmill', EXPORT, '/t.png').frames).toEqual([
      { x: 0, y: 0, w: 64, h: 64, duration: 120 },
      { x: 0, y: 64, w: 64, h: 64, duration: 80 },
    ]);
  });

  it('reads 0-based tag ranges from meta.frameTags', () => {
    expect(parseSheet('treadmill', EXPORT, '/t.png').tags).toEqual([
      { name: 'belt', from: 0, to: 1, direction: 'forward' },
    ]);
  });

  it('reads slice bounds and pivot from keys[0], with a null pivot when absent', () => {
    expect(parseSheet('treadmill', EXPORT, '/t.png').slices).toEqual([
      { name: 'rider', x: 20, y: 10, w: 16, h: 30, pivot: { x: 8, y: 29 } },
      { name: 'console', x: 50, y: 4, w: 10, h: 20, pivot: null },
    ]);
  });

  it('treats missing frameTags and slices as empty', () => {
    const sheet = parseSheet('plain', { frames: EXPORT.frames, meta: { image: 'plain.png' } }, '/p.png');
    expect(sheet.tags).toEqual([]);
    expect(sheet.slices).toEqual([]);
  });

  it('rejects a json-hash export, naming the sheet', () => {
    const hash = { frames: { 'treadmill 0.aseprite': EXPORT.frames[0] }, meta: EXPORT.meta };
    expect(() => parseSheet('treadmill', hash, '/t.png')).toThrow('Sprite sheet "treadmill"');
  });

  it('rejects an export with no frames, naming the sheet', () => {
    expect(() => parseSheet('empty', { frames: [], meta: {} }, '/e.png')).toThrow(
      'Sprite sheet "empty"',
    );
  });
});

describe('getSheet', () => {
  const registry = new Map([['treadmill', parseSheet('treadmill', EXPORT, '/t.png')]]);

  it('returns the sheet from the given registry', () => {
    expect(getSheet('treadmill', registry).frames).toHaveLength(2);
  });

  it('throws an error naming a missing id', () => {
    expect(() => getSheet('trophy-gold', registry)).toThrow('"trophy-gold"');
  });
});

describe('buildRegistry', () => {
  it('pairs each JSON export with the PNG of the same basename', () => {
    const registry = buildRegistry(
      { '../../assets/sprites/treadmill.json': EXPORT },
      { '../../assets/sprites/treadmill.png': '/assets/treadmill-abc123.png' },
    );
    expect([...registry.keys()]).toEqual(['treadmill']);
    expect(getSheet('treadmill', registry).imageUrl).toBe('/assets/treadmill-abc123.png');
  });

  it('throws when a JSON export has no matching PNG', () => {
    expect(() => buildRegistry({ '../../assets/sprites/treadmill.json': EXPORT }, {})).toThrow(
      'Sprite sheet "treadmill"',
    );
  });
});

describe('SHEETS', () => {
  it('holds every committed export, keyed by its own id', () => {
    expect(SHEETS).toBeInstanceOf(Map);
    for (const [id, sheet] of SHEETS) {
      expect(sheet.id).toBe(id);
      expect(sheet.frames.length).toBeGreaterThan(0);
      expect(sheet.imageUrl).not.toBe('');
    }
  });
});
