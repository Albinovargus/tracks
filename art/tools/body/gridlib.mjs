// Grid library for the body builders (build-run.mjs, build-turn.mjs); imported, not run.
// Parts are interior masks; each part gets a 1-px 4-neighbour outline, drawn in depth
// order (later parts overdraw earlier ones). Grid chars: . o L B S (see paint-body.lua).
export const SIZE = 64;

export function newGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill('.'));
}

export function mask() {
  return new Set();
}
const k = (x, y) => y * SIZE + x;
export function add(m, x, y) {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) m.add(k(x, y));
}
export function has(m, x, y) {
  return m.has(k(x, y));
}
/** spans: { y: [[x0, x1], ...] } inclusive */
export function spans(m, rows) {
  for (const [y, list] of Object.entries(rows)) {
    for (const [a, b] of list) for (let x = a; x <= b; x++) add(m, x, Number(y));
  }
  return m;
}
export function capsule(m, x0, y0, x1, y1, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let t = len2 === 0 ? 0 : ((x - x0) * dx + (y - y0) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = x0 + t * dx - x;
      const py = y0 + t * dy - y;
      if (px * px + py * py <= r * r + 1e-9) add(m, x, y);
    }
  }
  return m;
}

/**
 * Draw a part. shade(x, y, runFrom, runTo) returns L/B/S for interior pixels;
 * skipOutline(x, y) can veto an outline pixel (to merge a limb into the torso).
 */
export function draw(g, m, { shade = defaultShade, skipOutline = () => false } = {}) {
  const outline = [];
  for (const key of m) {
    const x = key % SIZE;
    const y = Math.floor(key / SIZE);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      if (!has(m, nx, ny) && !skipOutline(nx, ny)) outline.push([nx, ny]);
    }
  }
  for (const [x, y] of outline) g[y][x] = 'o';
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      if (!has(m, x, y)) {
        x++;
        continue;
      }
      const from = x;
      while (x < SIZE && has(m, x, y)) x++;
      const to = x - 1;
      for (let i = from; i <= to; i++) g[y][i] = shade(i, y, from, to);
    }
  }
}
export function defaultShade(x, _y, from, to) {
  if (to - from >= 1 && x === from) return 'L';
  if (to - from >= 2 && x === to) return 'S';
  return 'B';
}
export function farShade(x, _y, from, to) {
  return to - from >= 2 && x === from ? 'B' : 'S';
}
export function put(g, x, y, ch) {
  g[y][x] = ch;
}
export function render(g) {
  return g.map((r) => r.join('')).join('\n') + '\n';
}
export function check(g) {
  for (const r of g) if (r.length !== SIZE) throw new Error('bad row');
}
