import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import type { AvatarAppearance } from "@tracks/types";
import { describeAppearance } from "../avatar/appearance.js";
import {
  drawAvatar,
  loadAvatarSheets,
  loadSheetCanvas,
  type LoadedSheets,
} from "../avatar/canvas.js";
import { BODY_SHEET } from "../avatar/catalog.js";
import {
  frameAt,
  tagFrames,
  type AnimationTag,
  type TagFrame,
} from "../avatar/frames.js";
import { getSheet } from "../avatar/sheets.js";
import { usePixelCanvas } from "../avatar/usePixelCanvas.js";
import {
  initialBehavior,
  step,
  tagForPhase,
  timingsFromSheet,
  type BehaviorTimings,
} from "./behavior.js";
import { clampDt } from "./clock.js";
import {
  layoutRoom,
  spriteFrame,
  type PlacedSprite,
  type RoomLayout,
} from "./roomLayout.js";
import { SAMPLE_ROOM } from "./sampleRoom.js";

const ROOM_W = 180;
const ROOM_H = 120;

/** Everything one appearance needs on screen, loaded and swapped up front. */
interface RoomArt {
  appearance: AvatarAppearance;
  layout: RoomLayout;
  room: { sprite: PlacedSprite; image: HTMLCanvasElement }[];
  avatar: LoadedSheets;
  timings: BehaviorTimings;
  frames: Record<AnimationTag, TagFrame[]>;
}

async function loadRoomArt(appearance: AvatarAppearance): Promise<RoomArt> {
  const layout = layoutRoom(SAMPLE_ROOM);
  const body = getSheet(BODY_SHEET);
  const timings = timingsFromSheet(body);
  const frames: Record<AnimationTag, TagFrame[]> = {
    "front-idle": tagFrames(body, "front-idle"),
    turn: tagFrames(body, "turn"),
    "side-run": tagFrames(body, "side-run"),
  };
  const [room, avatar] = await Promise.all([
    Promise.all(
      layout.sprites.map(async (sprite) => ({
        sprite,
        image: await loadSheetCanvas(getSheet(sprite.sheet), null),
      })),
    ),
    loadAvatarSheets(appearance),
  ]);
  return { appearance, layout, room, avatar, timings, frames };
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  art: RoomArt,
  tag: AnimationTag,
  frameOffset: number,
): void {
  ctx.clearRect(0, 0, ROOM_W, ROOM_H);
  for (const { sprite, image } of art.room) {
    const rect = spriteFrame(sprite, tag, frameOffset);
    ctx.drawImage(
      image,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      sprite.x,
      sprite.y,
      rect.w,
      rect.h,
    );
  }
  const feet = art.layout.avatarFeet;
  drawAvatar(ctx, art.avatar, art.appearance, tag, frameOffset, feet.x, feet.y);
}

/** One string per distinct look, built from the six appearance fields. */
function appearanceKey(a: AvatarAppearance): string {
  return [
    a.skin_tone,
    a.hair_style,
    a.hair_color,
    a.top,
    a.bottom,
    a.shoes,
  ].join("|");
}

/** The room canvas. Its rAF loop is the app's only animation driver. */
export function RoomScene({ appearance }: { appearance: AvatarAppearance }) {
  // A new look (say, a refetch after an edit on another device) remounts the
  // canvas, so data-ready and any earlier load error never carry over to it.
  return <RoomCanvas key={appearanceKey(appearance)} appearance={appearance} />;
}

function RoomCanvas({ appearance }: { appearance: AvatarAppearance }) {
  const { stageRef, canvasRef, generation } = usePixelCanvas(ROOM_W, ROOM_H);
  const [art, setArt] = useState<RoomArt | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // A resize clears the canvas: the loop sees the new generation, and the
  // effect below redraws the current frame at once so the canvas never sits blank.
  const generationRef = useRef(generation);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    generationRef.current = generation;
  }, [generation]);

  useEffect(() => {
    let cancelled = false;
    loadRoomArt(appearance).then(
      (loaded) => {
        if (!cancelled) setArt(loaded);
      },
      (error: unknown) => {
        if (cancelled) return;
        Sentry.captureException(error);
        setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [appearance]);

  useEffect(() => {
    // No context until the sheets are in: a failed load never asks for one.
    if (!art) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let behavior = initialBehavior(Math.random, art.timings);
    let lastTime: number | null = null;
    let current: { tag: AnimationTag; frameOffset: number } = {
      tag: "front-idle",
      frameOffset: 0,
    };
    let drawnKey = "";
    let announced = false;
    let frameId = 0;

    // Draws the current frame unless it is already on the sized canvas. Returns false on a draw error.
    const paint = (): boolean => {
      // Generation 0: usePixelCanvas has not sized the canvas yet, and its first
      // resize would wipe this frame right after data-ready announced it.
      const sizedGeneration = generationRef.current;
      const key = `${sizedGeneration}|${current.tag}|${current.frameOffset}`;
      if (sizedGeneration === 0 || key === drawnKey) return true;
      try {
        drawRoom(ctx, art, current.tag, current.frameOffset);
      } catch (error) {
        Sentry.captureException(error);
        setFailed(true);
        return false;
      }
      drawnKey = key;
      if (!announced) {
        announced = true;
        setReady(true);
      }
      return true;
    };

    const tick = (now: number): void => {
      // A tab back from the background resumes where it was (see clock.ts).
      const dtMs = lastTime === null ? 0 : clampDt(now - lastTime);
      lastTime = now;
      behavior = step(behavior, dtMs, Math.random, art.timings);
      const tag = tagForPhase(behavior.phase);
      current = {
        tag,
        frameOffset: frameAt(art.frames[tag], behavior.msInPhase),
      };
      if (!paint()) return;
      frameId = requestAnimationFrame(tick);
    };

    redrawRef.current = () => {
      if (!paint()) cancelAnimationFrame(frameId);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      redrawRef.current = null;
      cancelAnimationFrame(frameId);
    };
  }, [art, canvasRef]);

  // After the resize effect's wipe (or once the art arrives on an already sized canvas), repaint now.
  useEffect(() => {
    redrawRef.current?.();
  }, [generation, art]);

  // The root fills RoomPage's stage, so usePixelCanvas's ResizeObserver measures the stage.
  return (
    <div
      ref={stageRef}
      className="flex size-full min-w-0 items-center justify-center overflow-hidden"
    >
      {failed && (
        <p
          role="alert"
          className="m-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          Couldn't load the room. Refresh the page to try again.
        </p>
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={describeAppearance(appearance)}
        data-ready={ready && !failed ? "true" : undefined}
        hidden={failed}
        className="[image-rendering:pixelated]"
      />
    </div>
  );
}
