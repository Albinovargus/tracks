import type { SheetId } from "../avatar/sheets.js";

/** What the room shows, slot by slot. Hard-coded in v1; owned items replace it later. */
export interface SampleRoom {
  trophies: SheetId[];
  medals: SheetId[];
  frame: SheetId;
  equipment: SheetId;
  /** Optional: with no decor item, the background's decor slot stays empty. */
  decor?: SheetId;
}

export const SAMPLE_ROOM: SampleRoom = {
  trophies: ["trophy-gold", "trophy-silver", "trophy-bronze"],
  medals: ["medal-gold", "medal-silver", "medal-bronze"],
  frame: "frame-bib",
  equipment: "treadmill",
};
