import { cn } from '../../lib/utils.js';

// The visible face of an option. It sits after the radio, so the peer-* variants
// read the radio's state: a 2px foreground ring (border) when checked, and the
// shadcn focus ring on keyboard focus. The two compose, so neither hides the other.
const FACE =
  'pointer-events-none flex flex-1 items-center justify-center rounded-md border-2 border-transparent peer-checked:border-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50';

/**
 * One picker: a native fieldset of radios named `name`, one per catalog ID in
 * `options`. Each radio is transparent and covers its 44px label, so it stays the
 * tap target (and Playwright's check() target). With `swatch`, an option shows a
 * color chip and its label is screen-reader text; without it, the label shows.
 */
export function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  swatch,
}: {
  legend: string;
  name: string;
  options: Record<T, { label: string }>;
  value: T;
  onChange: (v: T) => void;
  swatch?: (v: T) => string;
}) {
  // Object.keys loses the key type; every key of `options` is a T.
  const ids = Object.keys(options) as T[];

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const { label } = options[id];
          return (
            <label
              key={id}
              className={cn('relative flex shrink-0', swatch ? 'size-11' : 'h-11 min-w-11')}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={id === value}
                onChange={() => onChange(id)}
                className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
              />
              {swatch ? (
                <>
                  <span aria-hidden="true" className={FACE}>
                    <span
                      className="size-8 rounded-sm border border-foreground/25"
                      style={{ backgroundColor: swatch(id) }}
                    />
                  </span>
                  <span className="sr-only">{label}</span>
                </>
              ) : (
                <span className={cn(FACE, 'bg-muted px-3 text-sm')}>{label}</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
