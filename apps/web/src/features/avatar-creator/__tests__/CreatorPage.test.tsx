import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiSuccess, Avatar, AvatarAppearance } from '@tracks/types';
import type { User } from '../../../lib/supabase.js';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('../../../lib/api.js', () => ({
  api: { get, put },
}));

// jsdom has no canvas: the real <AvatarSprite> never mounts (.claude/CLAUDE.md rule 26).
vi.mock('../../avatar/AvatarSprite.js', async () => {
  const { describeAppearance } = await import('../../avatar/appearance.js');
  return {
    AvatarSprite: (props: { appearance: AvatarAppearance; tag: string; frame: number }) => (
      <div
        role="img"
        aria-label={describeAppearance(props.appearance)}
        data-tag={props.tag}
        data-frame={props.frame}
      />
    ),
  };
});

import { useAuthStore } from '../../../store/auth.store.js';
import { DEFAULT_APPEARANCE, describeAppearance } from '../../avatar/appearance.js';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../../avatar/catalog.js';
import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS, rampToCss } from '../../avatar/palette.js';
import { avatarQueryKey } from '../../avatar/useAvatar.js';
import { CreatorPage } from '../CreatorPage.js';

const USER = { id: 'user-a' } as User;

const LEGENDS: Record<keyof AvatarAppearance, string> = {
  skin_tone: 'Skin tone',
  hair_style: 'Hair style',
  hair_color: 'Hair color',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
};

const FIELD_OPTIONS: Record<keyof AvatarAppearance, Record<string, { label: string }>> = {
  skin_tone: SKIN_TONE_OPTIONS,
  hair_style: HAIR_STYLE_OPTIONS,
  hair_color: HAIR_COLOR_OPTIONS,
  top: TOP_OPTIONS,
  bottom: BOTTOM_OPTIONS,
  shoes: SHOES_OPTIONS,
};

const NOT_FOUND = {
  success: false,
  error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
};

const EDIT_APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-4',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

function avatarOf(appearance: AvatarAppearance): Avatar {
  return {
    ...appearance,
    created_at: '2026-10-04T12:00:00+00:00',
    updated_at: '2026-10-04T12:00:00+00:00',
  };
}

function renderCreator(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/" element={<p>Room stub</p>} />
          <Route path="/create" element={<CreatorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
}

async function renderNewUser(): Promise<QueryClient> {
  get.mockRejectedValue(NOT_FOUND);
  const queryClient = renderCreator();
  await screen.findByRole('group', { name: 'Skin tone' });
  return queryClient;
}

async function renderExistingUser(appearance: AvatarAppearance): Promise<QueryClient> {
  get.mockResolvedValue({ success: true, data: avatarOf(appearance) });
  const queryClient = renderCreator();
  await screen.findByRole('group', { name: 'Skin tone' });
  return queryClient;
}

function group(legend: string): HTMLElement {
  return screen.getByRole('group', { name: legend });
}

function radio(legend: string, label: string): HTMLElement {
  return within(group(legend)).getByRole('radio', { name: label });
}

function swatchOf(legend: string, label: string): HTMLElement | null {
  return radio(legend, label).closest('label')?.querySelector<HTMLElement>('span[style]') ?? null;
}

function checkedAppearance(): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(LEGENDS).map(([field, legend]) => [
      field,
      within(group(legend)).getByRole('radio', { checked: true }).getAttribute('value'),
    ])
  );
}

describe('CreatorPage', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    useAuthStore.setState({ user: USER });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('fills the preview box with a skeleton and renders no pickers while the avatar loads', async () => {
    get.mockReturnValue(new Promise(() => {}));
    renderCreator();

    const skeleton = screen.getByRole('status', { name: 'Loading your athlete' });
    expect(skeleton.parentElement).toHaveClass('h-[40dvh]', 'w-full', 'shrink-0');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/avatar'));
  });

  it('starts a new user from DEFAULT_APPEARANCE with a static front-idle preview and no Cancel', async () => {
    await renderNewUser();

    expect(screen.getByRole('heading', { name: 'Create your athlete' })).toBeInTheDocument();
    expect(checkedAppearance()).toEqual(DEFAULT_APPEARANCE);
    const preview = screen.getByRole('img', { name: describeAppearance(DEFAULT_APPEARANCE) });
    expect(preview).toHaveAttribute('data-tag', 'front-idle');
    expect(preview).toHaveAttribute('data-frame', '0');
    expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the preview box fixed above a scrolling region that holds the pickers and buttons', async () => {
    await renderNewUser();

    const previewBox = screen.getByRole('img').parentElement;
    expect(previewBox).toHaveClass('h-[40dvh]', 'w-full', 'shrink-0');
    expect(previewBox?.parentElement).toHaveClass('flex', 'h-full', 'flex-col', 'p-4');
    const scroller = group('Skin tone').closest('.overflow-y-auto');
    expect(scroller).toHaveClass('min-h-0', 'flex-1');
    expect(scroller).toContainElement(screen.getByRole('button', { name: 'Save' }));
    expect(scroller).not.toContainElement(screen.getByRole('img'));
  });

  it('renders one fieldset per field, in order, with every catalog option as a full-size radio', async () => {
    await renderNewUser();

    const legends = screen
      .getAllByRole('group')
      .map((fieldset) => fieldset.querySelector('legend')?.textContent);
    expect(legends).toEqual(Object.values(LEGENDS));

    for (const [field, legend] of Object.entries(LEGENDS) as [keyof AvatarAppearance, string][]) {
      const scope = within(group(legend));
      const options = FIELD_OPTIONS[field];
      expect(scope.getAllByRole('radio')).toHaveLength(Object.keys(options).length);
      for (const [id, option] of Object.entries(options)) {
        const input = scope.getByRole('radio', { name: option.label });
        expect(input).toHaveAttribute('value', id);
        expect(input).toHaveAttribute('name', field);
        expect(input).toHaveClass(
          'peer',
          'absolute',
          'inset-0',
          'm-0',
          'cursor-pointer',
          'opacity-0'
        );
        expect(input).not.toHaveClass('sr-only');
        // The radio is invisible, so the face after it must show selection and
        // keyboard focus: a foreground border ring when checked, a focus ring.
        expect(input.nextElementSibling).toHaveClass(
          'peer-checked:border-foreground',
          'peer-focus-visible:ring-[3px]',
          'peer-focus-visible:ring-ring/50'
        );
        // A 44px tap area: square for swatches, at least 44px wide for text.
        const size = field === 'hair_style' ? ['h-11', 'min-w-11'] : ['size-11'];
        const label = input.closest('label');
        expect(label).toHaveClass('relative', ...size);
        expect(label?.parentElement).toHaveClass('flex', 'flex-wrap', 'gap-2');
      }
    }
  });

  it('shows ramp swatches for skin, hair color and clothing, and the label text for hair style', async () => {
    await renderNewUser();

    expect(swatchOf('Skin tone', SKIN_TONE_OPTIONS['tone-3'].label)).toHaveStyle({
      backgroundColor: rampToCss(SKIN_RAMPS['tone-3']),
    });
    expect(swatchOf('Hair color', HAIR_COLOR_OPTIONS.blonde.label)).toHaveStyle({
      backgroundColor: rampToCss(HAIR_RAMPS.blonde),
    });
    expect(swatchOf('Top', TOP_OPTIONS['starter-tee-blue'].label)).toHaveStyle({
      backgroundColor: rampToCss(CLOTH_RAMPS['starter-tee-blue']),
    });
    expect(swatchOf('Bottom', BOTTOM_OPTIONS['starter-shorts-black'].label)).toHaveStyle({
      backgroundColor: rampToCss(CLOTH_RAMPS['starter-shorts-black']),
    });
    expect(swatchOf('Shoes', SHOES_OPTIONS['starter-shoes-red'].label)).toHaveStyle({
      backgroundColor: rampToCss(CLOTH_RAMPS['starter-shoes-red']),
    });

    const curly = radio('Hair style', HAIR_STYLE_OPTIONS.curly.label).closest('label');
    expect(curly).toHaveTextContent(HAIR_STYLE_OPTIONS.curly.label);
    expect(curly?.querySelector('span[style]')).toBeNull();
  });

  it('updates the static preview when a picker changes', async () => {
    await renderNewUser();

    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));

    const chosen: AvatarAppearance = { ...DEFAULT_APPEARANCE, hair_color: 'blonde' };
    expect(checkedAppearance()).toEqual(chosen);
    const preview = screen.getByRole('img', { name: describeAppearance(chosen) });
    expect(preview).toHaveAttribute('data-tag', 'front-idle');
    expect(preview).toHaveAttribute('data-frame', '0');
  });

  it('prefills every picker from the saved avatar in edit mode', async () => {
    await renderExistingUser(EDIT_APPEARANCE);

    expect(screen.getByRole('heading', { name: 'Edit your athlete' })).toBeInTheDocument();
    expect(checkedAppearance()).toEqual(EDIT_APPEARANCE);
    expect(
      screen.getByRole('img', { name: describeAppearance(EDIT_APPEARANCE) })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveClass('min-h-11');
  });

  it('Cancel returns to the room without saving', async () => {
    await renderExistingUser(EDIT_APPEARANCE);
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));

    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('Save sends only the six fields, is disabled while pending, writes the cache and navigates', async () => {
    const queryClient = await renderExistingUser(EDIT_APPEARANCE);
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));
    fireEvent.click(radio('Top', TOP_OPTIONS['starter-tee-green'].label));
    const chosen: AvatarAppearance = {
      ...EDIT_APPEARANCE,
      hair_color: 'blonde',
      top: 'starter-tee-green',
    };
    let resolvePut: (value: ApiSuccess<Avatar>) => void = () => {};
    put.mockReturnValue(
      new Promise<ApiSuccess<Avatar>>((resolve) => {
        resolvePut = resolve;
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    await waitFor(() => expect(put).toHaveBeenCalledWith('/avatar', chosen));
    expect(put).toHaveBeenCalledTimes(1);

    resolvePut({ success: true, data: avatarOf(chosen) });

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(queryClient.getQueryData(avatarQueryKey(USER.id))).toEqual(avatarOf(chosen));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("replaces a new user's cached null with the saved avatar before navigating", async () => {
    const queryClient = await renderNewUser();
    expect(queryClient.getQueryData(avatarQueryKey(USER.id))).toBeNull();
    put.mockResolvedValue({ success: true, data: avatarOf(DEFAULT_APPEARANCE) });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith('/avatar', DEFAULT_APPEARANCE);
    expect(queryClient.getQueryData(avatarQueryKey(USER.id))).toEqual(avatarOf(DEFAULT_APPEARANCE));
  });

  it('keeps the choices and shows an inline alert above the buttons when the save fails', async () => {
    await renderNewUser();
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.red.label));
    fireEvent.click(radio('Shoes', SHOES_OPTIONS['starter-shoes-black'].label));
    const chosen: AvatarAppearance = {
      ...DEFAULT_APPEARANCE,
      hair_color: 'red',
      shoes: 'starter-shoes-black',
    };
    put.mockRejectedValue(new TypeError('Failed to fetch'));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't save your athlete. Try again.");
    expect(alert).toHaveClass(
      'rounded-md',
      'bg-destructive/10',
      'p-3',
      'text-sm',
      'text-destructive'
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    expect(alert.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(checkedAppearance()).toEqual(chosen);
    expect(screen.getByRole('img', { name: describeAppearance(chosen) })).toBeInTheDocument();
    expect(screen.queryByText('Room stub')).not.toBeInTheDocument();
  });

  it('Randomize picks every field from its own options without saving', async () => {
    await renderNewUser();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);

    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));

    const last: AvatarAppearance = {
      skin_tone: 'tone-6',
      hair_style: 'ponytail',
      hair_color: 'blue',
      top: 'starter-tee-green',
      bottom: 'starter-shorts-gray',
      shoes: 'starter-shoes-red',
    };
    expect(random).toHaveBeenCalledTimes(6);
    expect(checkedAppearance()).toEqual(last);
    expect(screen.getByRole('img', { name: describeAppearance(last) })).toBeInTheDocument();

    random.mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));

    expect(checkedAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    { cause: 'a network failure', failure: new TypeError('Failed to fetch') },
    {
      cause: 'an UNKNOWN error (Pages HTML 404)',
      failure: { success: false, error: { code: 'UNKNOWN', message: 'Not Found' } },
    },
  ])("shows Can't reach the server for $cause, and Retry refetches", async ({ failure }) => {
    get.mockRejectedValueOnce(failure).mockRejectedValueOnce(NOT_FOUND);
    renderCreator();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach the server");
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveClass('min-h-11');

    fireEvent.click(retry);

    expect(await screen.findByRole('group', { name: 'Skin tone' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
    expect(checkedAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(screen.queryByText('Room stub')).not.toBeInTheDocument();
  });

  it('keeps the form and the unsaved picks when a background refetch fails', async () => {
    const queryClient = await renderExistingUser(EDIT_APPEARANCE);
    fireEvent.click(radio('Hair color', HAIR_COLOR_OPTIONS.blonde.label));
    get.mockRejectedValue(new TypeError('Failed to fetch'));

    // A window-focus or reconnect refetch after the 5-minute staleTime, failing.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: avatarQueryKey(USER.id) });
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(avatarQueryKey(USER.id))?.status).toBe('error')
    );
    // Flush the observer's batched notification so CreatorPage renders the error state.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(checkedAppearance()).toEqual({ ...EDIT_APPEARANCE, hair_color: 'blonde' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('gives keyboard players one native radio group per fieldset, named by its legend', async () => {
    await renderNewUser();

    const groupNames: string[] = [];
    for (const legend of Object.values(LEGENDS)) {
      // getByRole('group', { name }) resolves the name from the <legend>.
      const fieldset = group(legend);
      expect(fieldset.tagName).toBe('FIELDSET');
      expect(fieldset.querySelector('legend')).toHaveTextContent(legend);

      const radios = within(fieldset).getAllByRole('radio') as HTMLInputElement[];
      const names = new Set(radios.map((r) => r.name));
      // One shared, non-empty name: the browser's arrow keys move the selection
      // within it, and Tab stops once, on the checked radio.
      expect(names.size).toBe(1);
      const [name] = [...names];
      if (!name) throw new Error('radio without name');
      groupNames.push(name);

      const checked = radios.filter((r) => r.checked);
      expect(checked).toHaveLength(1);
      const first = checked[0];
      expect(first).toBeDefined();
      expect(first).toBeEnabled();
      expect(first).not.toHaveAttribute('tabindex', '-1');
      first?.focus();
      expect(first).toHaveFocus();
    }
    // Distinct between groups, or arrowing out of Skin tone would change Hair color.
    expect(new Set(groupNames).size).toBe(groupNames.length);
  });

  it('sends exactly one PUT when Save is tapped twice', async () => {
    await renderExistingUser(EDIT_APPEARANCE);
    let resolvePut: (value: ApiSuccess<Avatar>) => void = () => {};
    put.mockReturnValue(
      new Promise<ApiSuccess<Avatar>>((resolve) => {
        resolvePut = resolve;
      })
    );

    // Two taps in the same tick: React has not yet seen isPending, because
    // TanStack Query delivers it on a setTimeout(0) notifyManager tick.
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);

    const saving = await screen.findByRole('button', { name: 'Saving...' });
    expect(saving).toBeDisabled();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledTimes(1);

    // A third tap on the disabled button sends nothing either.
    fireEvent.click(saving);
    expect(put).toHaveBeenCalledTimes(1);

    resolvePut({ success: true, data: avatarOf(EDIT_APPEARANCE) });

    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('re-enables Save after a failed save, and a retry sends a second PUT', async () => {
    await renderNewUser();
    put
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ success: true, data: avatarOf(DEFAULT_APPEARANCE) });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your athlete. Try again."
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    expect(put).toHaveBeenCalledTimes(1);

    fireEvent.click(save);

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put).toHaveBeenNthCalledWith(1, '/avatar', DEFAULT_APPEARANCE);
    expect(await screen.findByText('Room stub')).toBeInTheDocument();
    expect(put).toHaveBeenNthCalledWith(2, '/avatar', DEFAULT_APPEARANCE);
  });
});
