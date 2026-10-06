import { describe, it, expect } from 'vitest';
import { frameAt, loopLength, tagFrames, type TagFrame } from '../frames.js';
import { getSheet } from '../sheets.js';
import { FIXTURE_REGISTRY } from './fixtures.js';

const body = getSheet('body', FIXTURE_REGISTRY);
const curly = getSheet('hair-curly', FIXTURE_REGISTRY);

// Absolute indices start at 5 so a frameAt that returned the absolute index
// instead of the offset within the tag would fail.
const THREE: TagFrame[] = [
  { index: 5, duration: 100 },
  { index: 6, duration: 200 },
  { index: 7, duration: 100 },
];

describe('tagFrames', () => {
  it('lists absolute sheet frame indices with their durations', () => {
    expect(tagFrames(body, 'side-run')).toEqual([
      { index: 5, duration: 100 },
      { index: 6, duration: 120 },
      { index: 7, duration: 100 },
      { index: 8, duration: 120 },
    ]);
  });

  it("uses the sheet's own tag range", () => {
    expect(tagFrames(curly, 'side-run').map((f) => f.index)).toEqual([6, 7, 8, 9]);
  });

  it('returns the single turn frame', () => {
    expect(tagFrames(body, 'turn')).toEqual([{ index: 4, duration: 150 }]);
  });

  it('throws naming the sheet and the missing tag', () => {
    expect(() => tagFrames(body, 'belt')).toThrow('Sprite sheet "body" has no tag "belt"');
  });
});

describe('loopLength', () => {
  it('sums the per-frame durations', () => {
    expect(loopLength(tagFrames(body, 'front-idle'))).toBe(1600);
    expect(loopLength(tagFrames(body, 'side-run'))).toBe(440);
    expect(loopLength(THREE)).toBe(400);
  });

  it('is 0 for no frames', () => {
    expect(loopLength([])).toBe(0);
  });
});

describe('frameAt', () => {
  it('returns the 0-based offset within the tag, not the sheet index', () => {
    expect(frameAt(THREE, 0)).toBe(0);
  });

  it('switches frames exactly at each duration boundary', () => {
    expect(frameAt(THREE, 99)).toBe(0);
    expect(frameAt(THREE, 100)).toBe(1);
    expect(frameAt(THREE, 299)).toBe(1);
    expect(frameAt(THREE, 300)).toBe(2);
    expect(frameAt(THREE, 399)).toBe(2);
  });

  it('handles fractional rAF times', () => {
    expect(frameAt(THREE, 99.9)).toBe(0);
    expect(frameAt(THREE, 100.5)).toBe(1);
  });

  it('loops after the last frame', () => {
    expect(frameAt(THREE, 400)).toBe(0);
    expect(frameAt(THREE, 500)).toBe(1);
    expect(frameAt(THREE, 1300)).toBe(1);
    expect(frameAt(THREE, 4399)).toBe(2);
  });

  it('always returns 0 for a single-frame tag', () => {
    const turn = tagFrames(body, 'turn');
    expect(frameAt(turn, 0)).toBe(0);
    expect(frameAt(turn, 149)).toBe(0);
    expect(frameAt(turn, 10_000)).toBe(0);
  });

  it('walks a real fixture tag', () => {
    const idle = tagFrames(body, 'front-idle');
    expect([0, 399, 400, 599, 600, 999, 1000, 1599, 1600].map((ms) => frameAt(idle, ms))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 0,
    ]);
  });

  it('returns 0 for no frames', () => {
    expect(frameAt([], 123)).toBe(0);
  });
});
