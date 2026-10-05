// Pure helpers for the art check (art.test.ts). They read no files, so
// paletteRules.test.ts unit-tests them with literal inputs.

/** Every fixed palette color must differ from every placeholder by at least
 * this much in at least one RGB channel (spec §1 Layers and palette swap). */
export const MIN_PLACEHOLDER_DISTANCE = 32;

/** Packed 0xRRGGBB → '#rrggbb'. */
export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

/** Largest per-channel difference between two packed colors. */
function maxChannelDiff(a: number, b: number): number {
  const ca = channels(a);
  const cb = channels(b);
  return Math.max(...ca.map((v, i) => Math.abs(v - (cb[i] ?? 0))));
}

/**
 * Parses a GIMP palette into packed 0xRRGGBB colors, in file order.
 * Tolerates CRLF, a byte-order mark, comment lines anywhere, properties such
 * as `Name:` and `Columns:`, and Aseprite's `Channels: RGBA` with 4-column rows
 * (the alpha column is ignored). Rows without a name are rejected, because
 * Aseprite's loader silently drops them.
 */
export function parseGpl(text: string): number[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== 'GIMP Palette') {
    throw new Error('Not a GIMP palette: the first line must be "GIMP Palette"');
  }
  let columns = 3;
  const colors: number[] = [];
  lines.forEach((raw, index) => {
    if (index === 0) return;
    const lineNo = index + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    if (!/^\d/.test(line)) {
      const channelsMatch = /^Channels:\s*(\S+)$/.exec(line);
      if (channelsMatch) columns = channelsMatch[1] === 'RGBA' ? 4 : 3;
      return;
    }
    const parts = line.split(/\s+/);
    const numbers = parts.slice(0, columns);
    if (numbers.length < columns || numbers.some((p) => !/^\d+$/.test(p) || Number(p) > 255)) {
      throw new Error(
        `palette line ${lineNo} must start with ${columns} integers from 0 to 255: "${line}"`,
      );
    }
    if (parts.slice(columns).join(' ') === '') {
      throw new Error(
        `palette line ${lineNo} has no name; Aseprite skips rows without a name: "${line}"`,
      );
    }
    const [r = 0, g = 0, b = 0] = numbers.map(Number);
    colors.push((r << 16) | (g << 8) | b);
  });
  return colors;
}

/**
 * Checks palette.gpl against the placeholder colors: each placeholder appears
 * exactly once, and every other (fixed) color differs from every placeholder
 * by at least MIN_PLACEHOLDER_DISTANCE in at least one channel. Returns one
 * message per problem; an empty array means the palette is valid.
 */
export function paletteProblems(
  palette: readonly number[],
  placeholders: readonly number[],
): string[] {
  const problems: string[] = [];
  for (const placeholder of placeholders) {
    const count = palette.filter((c) => c === placeholder).length;
    if (count !== 1) {
      problems.push(
        `placeholder ${hex(placeholder)} appears ${count} times in palette.gpl (expected exactly 1)`,
      );
    }
  }
  for (const color of palette) {
    if (placeholders.includes(color)) continue;
    for (const placeholder of placeholders) {
      if (maxChannelDiff(color, placeholder) < MIN_PLACEHOLDER_DISTANCE) {
        problems.push(
          `fixed color ${hex(color)} is within ${MIN_PLACEHOLDER_DISTANCE - 1} of placeholder ${hex(placeholder)} in every RGB channel`,
        );
      }
    }
  }
  return problems;
}

/** A target ramp (palette.ts) must be exactly 3 packed 0xRRGGBB colors. */
export function targetRampProblems(name: string, ramp: readonly number[]): string[] {
  const problems: string[] = [];
  if (ramp.length !== 3) problems.push(`${name} has ${ramp.length} entries (expected 3)`);
  ramp.forEach((color, i) => {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      problems.push(`${name} entry ${i} (${color}) is not a 0xRRGGBB color`);
    }
  });
  return problems;
}
