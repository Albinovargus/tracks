// pnpm art:export — exports every art/**/*.aseprite to
// apps/web/src/assets/sprites/<name>.png + <name>.json (spec §4 Export).
// The exports are committed, so CI and Pages never need Aseprite. A failed
// export removes its partial outputs and exits non-zero with Aseprite's output.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART_DIR = path.join(ROOT, 'art');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'src', 'assets', 'sprites');
const STEAM_ASEPRITE = path.win32.normalize(
  'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe',
);

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/** ASEPRITE_PATH if set (the MCP registration's env does not reach this
 * script), else the Steam install, else fail naming both. */
function resolveAseprite(): string {
  const fromEnv = process.env['ASEPRITE_PATH'];
  if (fromEnv !== undefined && fromEnv !== '') {
    if (!existsSync(fromEnv)) {
      throw new Error(`ASEPRITE_PATH is set to "${fromEnv}", but no file exists there.`);
    }
    return fromEnv;
  }
  if (existsSync(STEAM_ASEPRITE)) return STEAM_ASEPRITE;
  throw new Error(
    `Aseprite not found. Set ASEPRITE_PATH to Aseprite.exe, or install it at "${STEAM_ASEPRITE}".`,
  );
}

/** Every .aseprite file under art/, keyed by export name (its basename). */
function findSources(): Map<string, string> {
  const sources = new Map<string, string>();
  if (!existsSync(ART_DIR)) return sources;
  const files = readdirSync(ART_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.aseprite'))
    .map((file) => path.join(ART_DIR, file))
    .sort();
  for (const file of files) {
    const name = path.basename(file, '.aseprite');
    const other = sources.get(name);
    if (other !== undefined) {
      throw new Error(
        `${rel(other)} and ${rel(file)} would both export to ${name}.png; rename one.`,
      );
    }
    sources.set(name, file);
  }
  return sources;
}

/** Aseprite's combined output, from a result or from execFile's error. */
function outputOf(result: unknown): string {
  if (typeof result !== 'object' || result === null) return String(result);
  const parts: string[] = [];
  if (result instanceof Error) parts.push(result.message);
  if ('stdout' in result) parts.push(String(result.stdout));
  if ('stderr' in result) parts.push(String(result.stderr));
  const text = parts.filter((part) => part.trim() !== '').join('\n');
  return text === '' ? '(no output)' : text;
}

/** Aseprite exits 0 even when a source fails to load, leaving a 0-byte JSON,
 * so check the outputs. Returns a problem, or null when both are usable. */
function checkOutputs(pngFile: string, jsonFile: string): string | null {
  if (!existsSync(pngFile)) return `no PNG was written at ${rel(pngFile)}`;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(jsonFile, 'utf8'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `${rel(jsonFile)} is missing or is not valid JSON (${reason})`;
  }
  const frames =
    typeof data === 'object' && data !== null && 'frames' in data ? data.frames : undefined;
  if (!Array.isArray(frames) || frames.length < 1) {
    return `${rel(jsonFile)} has no frames array with at least one frame`;
  }
  return null;
}

async function exportSheet(aseprite: string, name: string, source: string): Promise<void> {
  const pngFile = path.join(OUT_DIR, `${name}.png`);
  const jsonFile = path.join(OUT_DIR, `${name}.json`);
  const removeOutputs = (): void => {
    rmSync(pngFile, { force: true });
    rmSync(jsonFile, { force: true });
  };
  removeOutputs();
  // An args array, because the Aseprite path has spaces. Exactly these flags:
  // the default horizontal strip with untrimmed frame rects.
  const args = [
    '--batch',
    source,
    '--sheet',
    pngFile,
    '--data',
    jsonFile,
    '--format',
    'json-array',
    '--list-tags',
    '--list-slices',
  ];
  let output: string;
  try {
    output = outputOf(await execFileAsync(aseprite, args, { windowsHide: true }));
  } catch (err) {
    removeOutputs();
    throw new Error(`Aseprite failed on ${rel(source)}:\n${outputOf(err)}`);
  }
  const problem = checkOutputs(pngFile, jsonFile);
  if (problem !== null) {
    removeOutputs();
    throw new Error(`${rel(source)}: ${problem}\nAseprite output:\n${output}`);
  }
  console.log(`exported ${rel(source)} -> ${rel(pngFile)} + ${name}.json`);
}

async function main(): Promise<void> {
  const aseprite = resolveAseprite();
  const sources = findSources();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, source] of sources) {
    await exportSheet(aseprite, name, source);
  }
  console.log(`art:export: ${sources.size} sheet(s) exported with ${aseprite}`);
}

main().catch((err: unknown) => {
  console.error(`art:export failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
