import type { SheetData, SheetSlice, SheetTag } from "../../avatar/sheets.js";

export function slice(
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  pivot: { x: number; y: number } | null = null,
): SheetSlice {
  return { name, x, y, w, h, pivot };
}

/** A sheet whose frames sit side by side, each w x h, 100 ms long unless `durations` says otherwise. */
export function sheet(
  id: string,
  w: number,
  h: number,
  options: {
    frames?: number;
    durations?: number[];
    tags?: SheetTag[];
    slices?: SheetSlice[];
  } = {},
): SheetData {
  const count = options.durations?.length ?? options.frames ?? 1;
  return {
    id,
    imageUrl: `/sprites/${id}.png`,
    frames: Array.from({ length: count }, (_, i) => ({
      x: i * w,
      y: 0,
      w,
      h,
      duration: options.durations?.[i] ?? 100,
    })),
    tags: options.tags ?? [],
    slices: options.slices ?? [],
  };
}

/** The background's slot slices, one per sample item. */
export const SLOTS: SheetSlice[] = [
  slice("trophy-1", 10, 20, 16, 18),
  slice("trophy-2", 30, 20, 16, 18),
  slice("trophy-3", 50, 20, 16, 18),
  slice("medal-1", 100, 10, 12, 20),
  slice("medal-2", 114, 10, 12, 20),
  slice("medal-3", 128, 10, 12, 20),
  slice("frame", 70, 12, 24, 30),
  slice("equipment", 60, 60, 80, 50),
  slice("decor", 150, 70, 20, 40),
];

// The belt is sheet frames 1..3; frame 0 is an unused still.
export const BELT: SheetTag = {
  name: "belt",
  from: 1,
  to: 3,
  direction: "forward",
};
export const RIDER = slice("rider", 20, 10, 24, 24, { x: 12, y: 23 });

/**
 * body.json's timing: front-idle is frames 0..3 at 100 ms (a 400 ms loop), turn is
 * frame 4 at 150 ms, and side-run is frames 5..7 at 80 ms, one per belt frame.
 */
export const BODY = sheet("body", 64, 64, {
  durations: [100, 100, 100, 100, 150, 80, 80, 80],
  tags: [
    { name: "front-idle", from: 0, to: 3, direction: "forward" },
    { name: "turn", from: 4, to: 4, direction: "forward" },
    { name: "side-run", from: 5, to: 7, direction: "forward" },
  ],
});

/** Every room sheet plus body; `overrides` replace sheets with the same id. */
export function roomRegistry(
  overrides: SheetData[] = [],
): ReadonlyMap<string, SheetData> {
  const sheets = [
    sheet("background", 180, 120, { slices: SLOTS }),
    sheet("frame-bib", 20, 26),
    sheet("trophy-gold", 10, 14),
    sheet("trophy-silver", 9, 12),
    sheet("trophy-bronze", 8, 10),
    sheet("medal-gold", 8, 12),
    sheet("medal-silver", 7, 12),
    sheet("medal-bronze", 8, 11),
    sheet("plant", 14, 30),
    sheet("treadmill", 72, 40, { frames: 4, tags: [BELT], slices: [RIDER] }),
    BODY,
    ...overrides,
  ];
  return new Map(sheets.map((s) => [s.id, s]));
}
