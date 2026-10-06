// Outfit composite from the EXPORTED sheets (run pnpm art:export first): swaps them
// with the app's own palette.ts ramps and swapPixels(), and stacks them in the runtime
// draw order (body -> shoes -> bottom -> top). Writes one PNG per outfit to
// .superpowers/art-previews/clothing-outfit-N.png, 8x: one row per body tag, one
// column per frame, on the wall color. Three outfits use every clothing color once per slot.
// Run: npx tsx art/tools/garments/composite.mts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLOTH_RAMPS, PLACEHOLDER_RAMPS, SKIN_RAMPS } from '../../../apps/web/src/features/avatar/palette.js';
import { buildSwap, swapPixels, type Swap } from '../../../apps/web/src/features/avatar/swap.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SPRITES = join(ROOT, 'apps/web/src/assets/sprites');
const OUT = join(ROOT, '.superpowers/art-previews');
const SCALE = 8;
const GAP = 1;
const CELL = 64;
const BACKGROUND = 0xd8c8a8;

interface PngImage {
  width: number;
  height: number;
  data: Uint8Array;
}
interface PngModule {
  PNG: {
    new (options: { width: number; height: number }): PngImage;
    sync: { read(buffer: Uint8Array): PngImage; write(png: PngImage): Uint8Array };
  };
}
const { PNG } = createRequire(join(ROOT, 'apps/web/package.json'))('pngjs') as PngModule;

interface SheetJson {
  frames: Array<{ frame: { x: number; y: number; w: number; h: number } }>;
  meta: { frameTags: Array<{ name: string; from: number; to: number }> };
}
interface Layer {
  id: string;
  json: SheetJson;
  width: number;
  rgba: Uint8ClampedArray;
}

function loadLayer(id: string, swap: Swap): Layer {
  const json = JSON.parse(readFileSync(`${SPRITES}/${id}.json`, 'utf8')) as SheetJson;
  const png = PNG.sync.read(readFileSync(`${SPRITES}/${id}.png`));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  return { id, json, width: png.width, rgba: swapPixels(rgba, swap) };
}

type SkinTone = keyof typeof SKIN_RAMPS;
type ClothItem = keyof typeof CLOTH_RAMPS;
const OUTFITS: ReadonlyArray<{ skin: SkinTone; shoes: ClothItem; bottom: ClothItem; top: ClothItem }> = [
  { skin: 'tone-1', shoes: 'starter-shoes-white', bottom: 'starter-shorts-navy', top: 'starter-tee-red' },
  { skin: 'tone-3', shoes: 'starter-shoes-black', bottom: 'starter-shorts-gray', top: 'starter-tee-blue' },
  { skin: 'tone-6', shoes: 'starter-shoes-red', bottom: 'starter-shorts-black', top: 'starter-tee-green' },
];

mkdirSync(OUT, { recursive: true });
OUTFITS.forEach((outfit, n) => {
  const cloth = (item: ClothItem): Swap => buildSwap(PLACEHOLDER_RAMPS.cloth, CLOTH_RAMPS[item]);
  const layers = [
    loadLayer('body', buildSwap(PLACEHOLDER_RAMPS.skin, SKIN_RAMPS[outfit.skin])),
    loadLayer('shoes-starter', cloth(outfit.shoes)),
    loadLayer('bottom-starter-shorts', cloth(outfit.bottom)),
    loadLayer('top-starter-tee', cloth(outfit.top)),
  ];
  const [body] = layers;
  if (!body) throw new Error('body sheet missing');
  for (const layer of layers) {
    if (layer.json.frames.length !== body.json.frames.length) {
      throw new Error(`${layer.id} has ${layer.json.frames.length} frames, body has ${body.json.frames.length}`);
    }
  }
  const tags = body.json.meta.frameTags;
  const cols = Math.max(...tags.map((t) => t.to - t.from + 1));
  const w = (cols * CELL + (cols + 1) * GAP) * SCALE;
  const h = (tags.length * CELL + (tags.length + 1) * GAP) * SCALE;
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    out.data[i * 4] = (BACKGROUND >> 16) & 0xff;
    out.data[i * 4 + 1] = (BACKGROUND >> 8) & 0xff;
    out.data[i * 4 + 2] = BACKGROUND & 0xff;
    out.data[i * 4 + 3] = 255;
  }
  tags.forEach((tag, row) => {
    for (let index = tag.from; index <= tag.to; index++) {
      const ox = GAP + (index - tag.from) * (CELL + GAP);
      const oy = GAP + row * (CELL + GAP);
      for (const layer of layers) {
        const rect = layer.json.frames[index]?.frame;
        if (!rect) throw new Error(`${layer.id} has no frame ${index}`);
        for (let y = 0; y < rect.h; y++) {
          for (let x = 0; x < rect.w; x++) {
            const s = ((rect.y + y) * layer.width + rect.x + x) * 4;
            if ((layer.rgba[s + 3] ?? 0) === 0) continue;
            for (let sy = 0; sy < SCALE; sy++) {
              for (let sx = 0; sx < SCALE; sx++) {
                const d = (((oy + y) * SCALE + sy) * w + (ox + x) * SCALE + sx) * 4;
                out.data[d] = layer.rgba[s] ?? 0;
                out.data[d + 1] = layer.rgba[s + 1] ?? 0;
                out.data[d + 2] = layer.rgba[s + 2] ?? 0;
                out.data[d + 3] = 255;
              }
            }
          }
        }
      }
    }
  });
  const file = join(OUT, `clothing-outfit-${n + 1}.png`);
  writeFileSync(file, PNG.sync.write(out));
  console.log(`${file}: ${outfit.skin}, ${outfit.top}, ${outfit.bottom}, ${outfit.shoes} (rows: ${tags.map((t) => t.name).join(', ')})`);
});
