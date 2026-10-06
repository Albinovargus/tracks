import { describe, it, expect } from 'vitest';
import { buildSwap, swapKey } from '../swap.js';
import type { Ramp } from '../swap.js';

const FROM: Ramp = [0xff80ff, 0xff40ff, 0xff00ff];
const TO: Ramp = [0x112233, 0x445566, 0x778899];

describe('buildSwap', () => {
  it('maps each placeholder shade to the target shade at the same position', () => {
    const swap = buildSwap(FROM, TO);
    expect(swap.size).toBe(3);
    expect(swap.get(0xff80ff)).toBe(0x112233);
    expect(swap.get(0xff40ff)).toBe(0x445566);
    expect(swap.get(0xff00ff)).toBe(0x778899);
  });

  it('leaves colors outside the source ramp unmapped', () => {
    const swap = buildSwap(FROM, TO);
    expect(swap.has(0x000000)).toBe(false);
    expect(swap.has(0x112233)).toBe(false);
  });
});

describe('swapKey', () => {
  it('returns "none" for no swap or an empty swap', () => {
    expect(swapKey(null)).toBe('none');
    expect(swapKey(new Map())).toBe('none');
  });

  it('lists from:to pairs as 6-digit hex sorted by source color', () => {
    expect(swapKey(buildSwap(FROM, TO))).toBe('ff00ff:778899,ff40ff:445566,ff80ff:112233');
  });

  it('zero-pads small colors to 6 hex digits', () => {
    expect(swapKey(new Map([[0x00000a, 0x0000ff]]))).toBe('00000a:0000ff');
  });

  it('does not depend on insertion order', () => {
    const a = new Map([
      [0x010101, 0x020202],
      [0x030303, 0x040404],
    ]);
    const b = new Map([
      [0x030303, 0x040404],
      [0x010101, 0x020202],
    ]);
    expect(swapKey(a)).toBe(swapKey(b));
  });

  it('differs when any target differs', () => {
    const other: Ramp = [0x112233, 0x445566, 0x778800];
    expect(swapKey(buildSwap(FROM, TO))).not.toBe(swapKey(buildSwap(FROM, other)));
  });

  it('never contains the "|" separator used by LoadedSheets keys', () => {
    expect(swapKey(buildSwap(FROM, TO))).not.toContain('|');
    expect(swapKey(null)).not.toContain('|');
  });
});
