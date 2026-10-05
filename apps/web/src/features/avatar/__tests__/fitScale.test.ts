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
