import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Shuffle } from 'lucide-react';
import type { Avatar, AvatarAppearance } from '@tracks/types';
import { Button } from '../../components/ui/button.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { AvatarSprite } from '../avatar/AvatarSprite.js';
import { DEFAULT_APPEARANCE, randomAppearance } from '../avatar/appearance.js';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../avatar/catalog.js';
import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS, rampToCss } from '../avatar/palette.js';
import { useAvatar, useSaveAvatar } from '../avatar/useAvatar.js';
import { OptionGroup } from './OptionGroup.js';

const PAGE = 'flex h-full flex-col p-4';
const PREVIEW_BOX = 'h-[40dvh] w-full shrink-0';

/** The six appearance fields of a saved avatar, without its timestamps. */
function appearanceOf({
  skin_tone,
  hair_style,
  hair_color,
  top,
  bottom,
  shoes,
}: Avatar): AvatarAppearance {
  return { skin_tone, hair_style, hair_color, top, bottom, shoes };
}

/**
 * Create mode when the user has no avatar yet, edit mode when one exists. The
 * pickers mount only after the GET resolves, so the form state starts once.
 */
export function CreatorPage() {
  const avatar = useAvatar();

  // Data first: once the GET has resolved, the form stays mounted. A failed
  // background refetch (window focus or reconnect after the 5-minute staleTime)
  // keeps the data and sets isError; branching on isError first would unmount
  // the form and throw away the user's unsaved picks.
  if (avatar.data !== undefined) {
    return <CreatorForm saved={avatar.data} />;
  }

  if (avatar.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <p role="alert" className="text-sm text-muted-foreground">
          Can't reach the server
        </p>
        <Button
          variant="secondary"
          disabled={avatar.isFetching}
          onClick={() => void avatar.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className={PREVIEW_BOX}>
        <Skeleton role="status" aria-label="Loading your athlete" className="size-full" />
      </div>
    </div>
  );
}

function CreatorForm({ saved }: { saved: Avatar | null }) {
  // Frozen at mount: saving writes the new avatar into the cache, and a new
  // user must not flip into edit mode (showing Cancel) before navigating away.
  const [editing] = useState(saved !== null);
  const [appearance, setAppearance] = useState<AvatarAppearance>(() =>
    saved === null ? DEFAULT_APPEARANCE : appearanceOf(saved)
  );
  const save = useSaveAvatar();
  const navigate = useNavigate();
  // Set synchronously on submit. save.isPending only reaches React on the next
  // notifyManager tick (setTimeout 0), so a fast double tap would otherwise
  // submit twice. Reset on settle so a failed save can be retried.
  const submitting = useRef(false);

  return (
    <div className={PAGE}>
      <div className={PREVIEW_BOX}>
        {/* Static frame 0: RoomScene's rAF loop is the app's only animation driver. */}
        <AvatarSprite appearance={appearance} tag="front-idle" frame={0} />
      </div>
      <form
        className="min-h-0 flex-1 overflow-y-auto pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting.current) return;
          submitting.current = true;
          save.mutate(appearance, {
            onSuccess: () => {
              void navigate('/');
            },
            onSettled: () => {
              submitting.current = false;
            },
          });
        }}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <h1 className="text-lg font-semibold">
            {editing ? 'Edit your athlete' : 'Create your athlete'}
          </h1>
          <OptionGroup
            legend="Skin tone"
            name="skin_tone"
            options={SKIN_TONE_OPTIONS}
            value={appearance.skin_tone}
            onChange={(skin_tone) => setAppearance((a) => ({ ...a, skin_tone }))}
            swatch={(id) => rampToCss(SKIN_RAMPS[id])}
          />
          <OptionGroup
            legend="Hair style"
            name="hair_style"
            options={HAIR_STYLE_OPTIONS}
            value={appearance.hair_style}
            onChange={(hair_style) => setAppearance((a) => ({ ...a, hair_style }))}
          />
          <OptionGroup
            legend="Hair color"
            name="hair_color"
            options={HAIR_COLOR_OPTIONS}
            value={appearance.hair_color}
            onChange={(hair_color) => setAppearance((a) => ({ ...a, hair_color }))}
            swatch={(id) => rampToCss(HAIR_RAMPS[id])}
          />
          <OptionGroup
            legend="Top"
            name="top"
            options={TOP_OPTIONS}
            value={appearance.top}
            onChange={(top) => setAppearance((a) => ({ ...a, top }))}
            swatch={(id) => rampToCss(CLOTH_RAMPS[id])}
          />
          <OptionGroup
            legend="Bottom"
            name="bottom"
            options={BOTTOM_OPTIONS}
            value={appearance.bottom}
            onChange={(bottom) => setAppearance((a) => ({ ...a, bottom }))}
            swatch={(id) => rampToCss(CLOTH_RAMPS[id])}
          />
          <OptionGroup
            legend="Shoes"
            name="shoes"
            options={SHOES_OPTIONS}
            value={appearance.shoes}
            onChange={(shoes) => setAppearance((a) => ({ ...a, shoes }))}
            swatch={(id) => rampToCss(CLOTH_RAMPS[id])}
          />
          {save.isError && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Couldn't save your athlete. Try again.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAppearance(randomAppearance(Math.random))}
            >
              <Shuffle /> Randomize
            </Button>
            <div className="ml-auto flex gap-2">
              {editing && (
                <Button asChild variant="ghost">
                  <Link to="/">Cancel</Link>
                </Button>
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
