import { describe, it, expect } from 'vitest';
import { fitScale } from '../fitScale.js';

describe('fitScale', () => {
  it('fits the 180x120 room on an iPhone SE stage at DPR 2', () => {
    expect(fitScale(375, 551, 2, 180, 120)).toBe(4);
  });

  it('fits the room on a Pixel 7 stage at fractional DPR 2.625', () => {
    expect(fitScale(412, 715, 2.625, 180, 120)).toBe(6);
  });

  it('never goes below 1 when the stage is narrower than the art', () => {
    expect(fitScale(179, 500, 1, 180, 120)).toBe(1);
  });

  it('fits the room on an iPhone 14 stage at DPR 3', () => {
    expect(fitScale(390, 600, 3, 180, 120)).toBe(6);
  });

  it('is limited by height when the stage is short', () => {
    expect(fitScale(1024, 300, 1, 180, 120)).toBe(2);
  });

  it('scales the 64x64 avatar cell in device pixels', () => {
    expect(fitScale(200, 200, 3, 64, 64)).toBe(9);
  });

  it('returns 1 for an empty container', () => {
    expect(fitScale(0, 0, 2, 180, 120)).toBe(1);
  });
});

import { coverScale } from '../fitScale.js';

describe('coverScale', () => {
  // The 630x270 world from the spec, on backing sizes in device px.
  it.each([
    ['iPhone SE 375x667 @2', 750, 1334, 5] as const,
    ['iPhone 14 390x844 @3', 1170, 2532, 10] as const,
    ['Pixel 7 412x915 @2.625', 1082, 2402, 9] as const,
    ['phone landscape 844x390 @3', 2532, 1170, 5] as const,
    ['desktop 1280x800 @1', 1280, 800, 3] as const,
    ['desktop 1920x1080 @1', 1920, 1080, 4] as const,
    ['ultrawide 3440x1440 @1', 3440, 1440, 6] as const,
  ])('covers %s at k = %i', (_name, w, h, k) => {
    expect(coverScale(w, h, 630, 270)).toBe(k);
  });

  it('raises k until the width is covered too on a short, very wide screen', () => {
    // Height alone needs 2; 5000 / 630 needs 8.
    expect(coverScale(5000, 300, 630, 270)).toBe(8);
  });

  it('never goes below 1, even for an empty stage', () => {
    expect(coverScale(100, 100, 630, 270)).toBe(1);
    expect(coverScale(0, 0, 630, 270)).toBe(1);
  });

  it('covers the screen in both directions', () => {
    for (const [w, h] of [[750, 1334], [1170, 2532], [1082, 2402], [2532, 1170], [1280, 800]] as const) {
      const k = coverScale(w, h, 630, 270);
      expect(630 * k).toBeGreaterThanOrEqual(w);
      expect(270 * k).toBeGreaterThanOrEqual(h);
    }
  });
});
