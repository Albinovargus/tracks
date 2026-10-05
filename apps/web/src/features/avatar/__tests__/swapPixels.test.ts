import { describe, it, expect } from 'vitest';
import { buildSwap, swapPixels } from '../swap.js';

const FROM = [0xff80ff, 0xff40ff, 0xff00ff] as const;
const TO = [0x112233, 0x445566, 0x778899] as const;
const SWAP = buildSwap(FROM, TO);

function pixels(...rgba: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(rgba.flat());
}

describe('swapPixels', () => {
  it('maps each opaque placeholder pixel to its target shade', () => {
    const input = pixels(
      [0xff, 0x80, 0xff, 255],
      [0xff, 0x40, 0xff, 255],
      [0xff, 0x00, 0xff, 255],
    );
    expect(Array.from(swapPixels(input, SWAP))).toEqual([
      0x11, 0x22, 0x33, 255,
      0x44, 0x55, 0x66, 255,
      0x77, 0x88, 0x99, 255,
    ]);
  });

  it('leaves colors that are not in the swap unchanged', () => {
    const input = pixels([0x1a, 0x1c, 0x2c, 255], [0xff, 0x40, 0xfe, 255]);
    expect(Array.from(swapPixels(input, SWAP))).toEqual([
      0x1a, 0x1c, 0x2c, 255,
      0xff, 0x40, 0xfe, 255,
    ]);
  });

  it('leaves fully transparent pixels untouched, even with a placeholder RGB', () => {
    const input = pixels([0xff, 0x40, 0xff, 0], [0, 0, 0, 0]);
    expect(Array.from(swapPixels(input, SWAP))).toEqual([0xff, 0x40, 0xff, 0, 0, 0, 0, 0]);
  });

  it('maps only fully opaque pixels and never changes alpha', () => {
    const input = pixels([0xff, 0x40, 0xff, 128], [0xff, 0x00, 0xff, 255]);
    expect(Array.from(swapPixels(input, SWAP))).toEqual([
      0xff, 0x40, 0xff, 128,
      0x77, 0x88, 0x99, 255,
    ]);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = pixels([0xff, 0x40, 0xff, 255]);
    const out = swapPixels(input, SWAP);
    expect(out).not.toBe(input);
    expect(out).toBeInstanceOf(Uint8ClampedArray);
    expect(Array.from(input)).toEqual([0xff, 0x40, 0xff, 255]);
  });

  it('copies the buffer unchanged with an empty swap', () => {
    const input = pixels([0xff, 0x40, 0xff, 255], [1, 2, 3, 0]);
    const out = swapPixels(input, new Map<number, number>());
    expect(out).not.toBe(input);
    expect(Array.from(out)).toEqual(Array.from(input));
  });
});
