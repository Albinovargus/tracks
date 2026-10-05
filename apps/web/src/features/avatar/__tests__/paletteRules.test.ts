import { describe, expect, it } from 'vitest';
import { hex, paletteProblems, parseGpl, targetRampProblems } from './paletteRules.js';

const PLACEHOLDERS = [
  0xff80ff, 0xff40ff, 0xff00ff, 0x80ffff, 0x40ffff, 0x00ffff, 0xffff80, 0xffff40, 0xffff00,
];

describe('hex', () => {
  it('formats a packed color as #rrggbb', () => {
    expect(hex(0x0a0b0c)).toBe('#0a0b0c');
    expect(hex(0xff40ff)).toBe('#ff40ff');
  });
});

describe('parseGpl', () => {
  it('reads RGB rows in file order, skipping header, properties and comments', () => {
    const text = [
      'GIMP Palette',
      'Name: Tracks',
      'Columns: 8',
      '#',
      '# a comment',
      ' 30  26  36\toutline',
      '',
      '# a comment between rows',
      '255 128 255\tPH skin light',
      '  0 255 255\tPH hair shadow',
      '',
    ].join('\n');
    expect(parseGpl(text)).toEqual([0x1e1a24, 0xff80ff, 0x00ffff]);
  });

  it('tolerates CRLF line endings and a byte-order mark', () => {
    const text = '\uFEFFGIMP Palette\r\n#\r\n 10  20  30\tUntitled\r\n 40  50  60\tUntitled\r\n';
    expect(parseGpl(text)).toEqual([0x0a141e, 0x28323c]);
  });

  it('reads Channels: RGBA files with 4-column rows and ignores the alpha column', () => {
    const text = 'GIMP Palette\nChannels: RGBA\n#\n 10  20  30 255\tone\n 40  50  60 128\ttwo\n';
    expect(parseGpl(text)).toEqual([0x0a141e, 0x28323c]);
  });

  it('accepts names that contain spaces and digits without reading them as channels', () => {
    expect(parseGpl('GIMP Palette\n1 2 3 PH cloth base 2\n')).toEqual([0x010203]);
  });

  it('rejects a file without the GIMP Palette header', () => {
    expect(() => parseGpl('Name: x\n1 2 3 a\n')).toThrow(/GIMP Palette/);
  });

  it('rejects a row whose channel is out of range', () => {
    expect(() => parseGpl('GIMP Palette\n256 0 0 too-red\n')).toThrow(/line 2/);
  });

  it('rejects a row with too few numbers', () => {
    expect(() => parseGpl('GIMP Palette\n1 2 short\n')).toThrow(/line 2/);
  });

  it('rejects a row without a name, because Aseprite silently skips such rows', () => {
    expect(() => parseGpl('GIMP Palette\n1 2 3\n')).toThrow(/line 2 has no name/);
    expect(() => parseGpl('GIMP Palette\nChannels: RGBA\n1 2 3 255\n')).toThrow(
      /line 3 has no name/,
    );
  });
});

describe('paletteProblems', () => {
  it('accepts every placeholder once plus fixed colors far from all of them', () => {
    expect(paletteProblems([0x1e1a24, 0xd8c8a8, ...PLACEHOLDERS], PLACEHOLDERS)).toEqual([]);
  });

  it('reports a missing placeholder', () => {
    expect(paletteProblems(PLACEHOLDERS.slice(1), PLACEHOLDERS)).toEqual([
      'placeholder #ff80ff appears 0 times in palette.gpl (expected exactly 1)',
    ]);
  });

  it('reports a duplicated placeholder', () => {
    expect(paletteProblems([...PLACEHOLDERS, 0xffff00], PLACEHOLDERS)).toEqual([
      'placeholder #ffff00 appears 2 times in palette.gpl (expected exactly 1)',
    ]);
  });

  it('reports a fixed color within 31 of a placeholder in every channel', () => {
    expect(paletteProblems([...PLACEHOLDERS, 0xe0ff9f], PLACEHOLDERS)).toEqual([
      'fixed color #e0ff9f is within 31 of placeholder #ffff80 in every RGB channel',
    ]);
  });

  it('accepts a fixed color exactly 32 away in one channel', () => {
    expect(paletteProblems([...PLACEHOLDERS, 0xdfffa0], PLACEHOLDERS)).toEqual([]);
  });
});

describe('targetRampProblems', () => {
  it('accepts a ramp of 3 colors', () => {
    expect(targetRampProblems('skin tone-1', [0xf6d7c3, 0xe8b896, 0xc98e6c])).toEqual([]);
  });

  it('reports a ramp that does not have exactly 3 entries', () => {
    expect(targetRampProblems('hair red', [0xff0000, 0xcc0000])).toEqual([
      'hair red has 2 entries (expected 3)',
    ]);
  });

  it('reports an entry that is not a 24-bit color', () => {
    expect(targetRampProblems('top x', [0xff0000, 0x1000000, -1])).toEqual([
      'top x entry 1 (16777216) is not a 0xRRGGBB color',
      'top x entry 2 (-1) is not a 0xRRGGBB color',
    ]);
  });
});
