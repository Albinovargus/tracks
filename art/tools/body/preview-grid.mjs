// Renders one body grid to an 8x PNG on white, for quick review without Aseprite.
// Run: node art/tools/body/preview-grid.mjs art/tools/body/grids/f08.txt .superpowers/art-previews/f08.png
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { PNG } = require('pngjs');
const [src, out] = process.argv.slice(2);
const rows = readFileSync(src, 'utf8').split(/\r?\n/).filter((r) => r.length);
const C = { '.': [255, 255, 255], o: [30, 26, 36], L: [255, 128, 255], B: [255, 64, 255], S: [255, 0, 255] };
const S = 8;
const png = new PNG({ width: 64 * S, height: 64 * S });
for (let y = 0; y < 64 * S; y++) for (let x = 0; x < 64 * S; x++) {
  const c = C[rows[Math.floor(y / S)][Math.floor(x / S)]];
  const i = (y * 64 * S + x) * 4;
  png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
}
writeFileSync(out, PNG.sync.write(png));
