import { cn } from "../../lib/utils.js";
import type { WorldPlace } from "./roomLayout.js";

/** One dot per place; tapping a dot scrolls to that place. The current place is aria-current. */
export function PlaceDots({
  places,
  current,
  onPick,
}: {
  places: readonly WorldPlace[];
  current: number;
  onPick: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Places"
      className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 flex -translate-x-1/2 rounded-full bg-background/70 px-1 shadow-sm backdrop-blur-sm"
    >
      {places.map((place, i) => (
        <button
          key={place.id}
          type="button"
          aria-label={place.label}
          aria-current={i === current ? "true" : undefined}
          onClick={() => onPick(i)}
          className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              i === current ? "bg-foreground" : "bg-foreground/30",
            )}
          />
        </button>
      ))}
    </nav>
  );
}
