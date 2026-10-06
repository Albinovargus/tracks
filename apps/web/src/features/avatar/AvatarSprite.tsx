import * as Sentry from '@sentry/react';
import { useEffect, useState } from 'react';
import type { AvatarAppearance } from '@tracks/types';
import { cn } from '../../lib/utils.js';
import { describeAppearance } from './appearance.js';
import { drawAvatar, loadAvatarSheets, type LoadedSheets } from './canvas.js';
import type { AnimationTag } from './frames.js';
import { usePixelCanvas } from './usePixelCanvas.js';

// The shared 64×64 avatar cell; its anchor pixel (32, 63) is the feet point.
const CELL = 64;
const FEET_X = 32;
const FEET_Y = 63;

interface LoadedAvatar {
  appearance: AvatarAppearance;
  sheets: LoadedSheets;
}

/**
 * One avatar on its own pixel-perfect 64×64 canvas, centered in a stage that fills the
 * parent (the parent must have a definite size). Draws `frame` (an offset within `tag`)
 * and never animates: RoomScene's rAF loop is the app's only animation driver.
 *
 * A failure to load or draw this appearance is reported to Sentry and shown inline as a
 * `role="alert"` message. It is never thrown: the data router's default error element
 * would replace the whole AppShell, and the error would never reach Sentry.
 */
export function AvatarSprite({
  appearance,
  tag,
  frame,
  className,
}: {
  appearance: AvatarAppearance;
  tag: AnimationTag;
  frame: number;
  className?: string;
}) {
  const { stageRef, canvasRef, generation } = usePixelCanvas(CELL, CELL);
  const [loaded, setLoaded] = useState<LoadedAvatar | null>(null);
  // The appearance whose sheets failed to load or draw. A new appearance (every picker
  // change is a new object) clears the message and gets its own attempt.
  const [failedFor, setFailedFor] = useState<AvatarAppearance | null>(null);

  useEffect(() => {
    let active = true;
    loadAvatarSheets(appearance).then(
      (sheets) => {
        if (active) setLoaded({ appearance, sheets });
      },
      (error: unknown) => {
        if (!active) return;
        Sentry.captureException(error);
        setFailedFor(appearance);
      },
    );
    return () => {
      active = false;
    };
  }, [appearance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || loaded === null || generation === 0) return;
    if (failedFor === loaded.appearance) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.clearRect(0, 0, CELL, CELL);
    try {
      // Draw the appearance these sheets were loaded for; a newer one shows once it loads.
      drawAvatar(ctx, loaded.sheets, loaded.appearance, tag, frame, FEET_X, FEET_Y);
    } catch (error) {
      Sentry.captureException(error);
      setFailedFor(loaded.appearance);
    }
  }, [canvasRef, loaded, tag, frame, generation, failedFor]);

  const failed = failedFor === appearance;

  return (
    <div
      ref={stageRef}
      className={cn(
        'flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden',
        className,
      )}
    >
      {/* The canvas stays mounted while the message shows: usePixelCanvas needs it. */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={describeAppearance(appearance)}
        hidden={failed}
        className="shrink-0 [image-rendering:pixelated]"
      />
      {failed && (
        <p
          role="alert"
          className="max-w-full rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive"
        >
          Can&apos;t load the avatar preview.
        </p>
      )}
    </div>
  );
}
