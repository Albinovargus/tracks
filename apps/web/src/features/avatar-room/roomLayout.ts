import { tagFrames, type AnimationTag } from "../avatar/frames.js";
import {
  getSheet,
  SHEETS,
  type SheetData,
  type SheetFrame,
  type SheetId,
  type SheetSlice,
} from "../avatar/sheets.js";
import type { SampleRoom } from "./sampleRoom.js";

export interface PlacedSprite {
  sheet: SheetId;
  /** Top-left draw position in room pixels. */
  x: number;
  y: number;
  /** True for the equipment: it plays its `belt` tag in step with the run. */
  animated: boolean;
}

export interface RoomLayout {
  /** Draw order: background, frame, trophies, medals, plant, treadmill. */
  sprites: PlacedSprite[];
  /** Where the avatar cell's anchor pixel (32, 63) goes, in room pixels. */
  avatarFeet: { x: number; y: number };
}

type Registry = ReadonlyMap<SheetId, SheetData>;
type Alignment = "standing" | "hanging";

const BACKGROUND_SHEET: SheetId = "background";
const RIDER_SLICE = "rider";
const BELT_TAG = "belt";

function findSlice(sheet: SheetData, name: string): SheetSlice {
  const found = sheet.slices.find((s) => s.name === name);
  if (!found) throw new Error(`Sheet "${sheet.id}" has no slice "${name}"`);
  return found;
}

function firstFrame(sheet: SheetData): SheetFrame {
  const frame = sheet.frames[0];
  if (!frame) throw new Error(`Sheet "${sheet.id}" has no frames`);
  return frame;
}

/**
 * Standing items sit bottom-centered on the slot's bottom edge; hanging items
 * hang top-centered from its top edge. An odd leftover rounds to the left.
 */
function place(
  id: SheetId,
  slot: SheetSlice,
  alignment: Alignment,
  registry: Registry,
  animated = false,
): PlacedSprite {
  const item = firstFrame(getSheet(id, registry));
  return {
    sheet: id,
    x: slot.x + Math.floor((slot.w - item.w) / 2),
    y: alignment === "standing" ? slot.y + slot.h - item.h : slot.y,
    animated,
  };
}

/** Pure: positions every room sprite from the background's slot slices. */
export function layoutRoom(
  room: SampleRoom,
  registry: Registry = SHEETS,
): RoomLayout {
  const background = getSheet(BACKGROUND_SHEET, registry);
  const slot = (name: string): SheetSlice => findSlice(background, name);

  const equipment = getSheet(room.equipment, registry);
  if (!equipment.tags.some((t) => t.name === BELT_TAG)) {
    throw new Error(`Sheet "${equipment.id}" has no "${BELT_TAG}" tag`);
  }
  const rider = findSlice(equipment, RIDER_SLICE);
  if (!rider.pivot) {
    throw new Error(
      `Slice "${RIDER_SLICE}" in sheet "${equipment.id}" has no pivot`,
    );
  }

  const treadmill = place(
    room.equipment,
    slot("equipment"),
    "standing",
    registry,
    true,
  );

  return {
    sprites: [
      { sheet: BACKGROUND_SHEET, x: 0, y: 0, animated: false },
      place(room.frame, slot("frame"), "hanging", registry),
      ...room.trophies.map((id, i) =>
        place(id, slot(`trophy-${i + 1}`), "standing", registry),
      ),
      ...room.medals.map((id, i) =>
        place(id, slot(`medal-${i + 1}`), "hanging", registry),
      ),
      place(room.decor, slot("decor"), "standing", registry),
      treadmill,
    ],
    avatarFeet: {
      x: treadmill.x + rider.x + rider.pivot.x,
      y: treadmill.y + rider.y + rider.pivot.y,
    },
  };
}

/**
 * Pure: the sheet rect to draw for a placed sprite. Static sprites use frame 0.
 * The animated equipment shows belt frame i with side-run frame i, and belt
 * frame 0 in every other tag.
 */
export function spriteFrame(
  sprite: PlacedSprite,
  tag: AnimationTag,
  frameOffset: number,
  registry: Registry = SHEETS,
): SheetFrame {
  const sheet = getSheet(sprite.sheet, registry);
  if (!sprite.animated) return firstFrame(sheet);
  const offset = tag === "side-run" ? frameOffset : 0;
  const index = tagFrames(sheet, BELT_TAG)[offset]?.index;
  const rect = index === undefined ? undefined : sheet.frames[index];
  if (!rect)
    throw new Error(`Sheet "${sheet.id}" has no "${BELT_TAG}" frame ${offset}`);
  return rect;
}
