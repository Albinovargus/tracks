import { z } from "zod";
import type { SheetId } from "../avatar/sheets.js";

/** The world's places, left to right (room world spec §2). */
export const PlaceIdSchema = z.enum([
  "door-left",
  "trophy-wall",
  "treadmill-corner",
  "mirror-corner",
  "door-right",
]);
export type PlaceId = z.infer<typeof PlaceIdSchema>;

/** Tappable objects, from `hotspot-<id>` slices in the place art. */
export const HotspotIdSchema = z.enum(["mirror"]);
export type HotspotId = z.infer<typeof HotspotIdSchema>;

/** An item drawn in one of its place's slot slices. */
export interface PlaceItem {
  slot: string;
  sheet: SheetId;
}

// Code-only data, not shared with the API: interfaces are fine here. Ids that may
// cross the wire later are z.enums already.
export interface PlaceDef {
  id: PlaceId;
  /** The place art, `place-<id>`. */
  sheet: SheetId;
  /** Shown on the place dot. */
  label: string;
  /** Drawn in this order after every place background. */
  items: PlaceItem[];
}

/** The slot whose item the avatar stands on: equipment with a `belt` tag and a `rider` pivot. */
export interface AvatarSpot {
  place: PlaceId;
  slot: string;
}

/** What the world shows. Hard-coded here; per-user room state replaces it later. */
export const WORLD: readonly PlaceDef[] = [
  { id: "door-left", sheet: "place-door-left", label: "Left door", items: [] },
  {
    id: "trophy-wall",
    sheet: "place-trophy-wall",
    label: "Trophy wall",
    items: [
      { slot: "frame", sheet: "frame-bib" },
      { slot: "trophy-1", sheet: "trophy-gold" },
      { slot: "trophy-2", sheet: "trophy-silver" },
      { slot: "trophy-3", sheet: "trophy-bronze" },
      { slot: "medal-1", sheet: "medal-gold" },
      { slot: "medal-2", sheet: "medal-silver" },
      { slot: "medal-3", sheet: "medal-bronze" },
    ],
  },
  {
    id: "treadmill-corner",
    sheet: "place-treadmill-corner",
    label: "Treadmill",
    items: [{ slot: "equipment", sheet: "treadmill" }],
  },
  // The decor slot stays empty this iteration.
  { id: "mirror-corner", sheet: "place-mirror-corner", label: "Mirror", items: [] },
  { id: "door-right", sheet: "place-door-right", label: "Right door", items: [] },
];

/** The camera opens centered on this place. */
export const HOME_PLACE: PlaceId = "treadmill-corner";

export const AVATAR_SPOT: AvatarSpot = { place: "treadmill-corner", slot: "equipment" };

/** What tapping each hotspot does. The medal shelf picker adds a picker action later. */
export const HOTSPOT_ACTIONS: Record<HotspotId, { label: string; to: string }> = {
  mirror: { label: "Mirror: edit avatar", to: "/create" },
};
