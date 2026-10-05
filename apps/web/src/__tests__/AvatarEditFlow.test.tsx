import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Avatar, AvatarAppearance } from '@tracks/types';

// Accessible names RoomScene was rendered with, in order.
const roomRenders = vi.hoisted((): string[] => []);

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'token-a', user: { id: 'user-a', email: 'a@example.com' } },
        },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-a', email: 'a@example.com' } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  captureException: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// jsdom has no canvas: both canvas components become an accessible <div>.
vi.mock('../features/avatar-room/RoomScene.js', async () => {
  const { describeAppearance } = await import('../features/avatar/appearance.js');
  return {
    RoomScene: ({ appearance }: { appearance: AvatarAppearance }) => {
      const name = describeAppearance(appearance);
      roomRenders.push(name);
      return <div role="img" aria-label={name} data-testid="room-scene" />;
    },
  };
});

vi.mock('../features/avatar/AvatarSprite.js', async () => {
  const { describeAppearance } = await import('../features/avatar/appearance.js');
  return {
    AvatarSprite: ({ appearance }: { appearance: AvatarAppearance }) => (
      <div role="img" aria-label={describeAppearance(appearance)} data-testid="avatar-sprite" />
    ),
  };
});

import { api } from '../lib/api.js';
import { queryClient as appQueryClient } from '../lib/queryClient.js';
import { App } from '../App.js';
import { describeAppearance } from '../features/avatar/appearance.js';
import {
  BOTTOM_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SHOES_OPTIONS,
  SKIN_TONE_OPTIONS,
  TOP_OPTIONS,
} from '../features/avatar/catalog.js';

const initialAppearance: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
};

// Every field differs from initialAppearance.
const savedAppearance: AvatarAppearance = {
  skin_tone: 'tone-5',
  hair_style: 'ponytail',
  hair_color: 'blonde',
  top: 'starter-tee-green',
  bottom: 'starter-shorts-gray',
  shoes: 'starter-shoes-red',
};

const initialAvatar: Avatar = {
  ...initialAppearance,
  created_at: '2026-10-04T12:00:00.000Z',
  updated_at: '2026-10-04T12:00:00.000Z',
};

const savedAvatar: Avatar = {
  ...savedAppearance,
  created_at: '2026-10-04T12:00:00.000Z',
  updated_at: '2026-10-04T12:05:00.000Z',
};

function group(legend: string) {
  return within(screen.getByRole('group', { name: legend }));
}

function pick(legend: string, label: string) {
  fireEvent.click(group(legend).getByRole('radio', { name: label }));
}

function expectPrefilled(appearance: AvatarAppearance) {
  const checked = (legend: string) =>
    group(legend).getByRole('radio', { checked: true }).getAttribute('value');
  expect(checked('Skin tone')).toBe(appearance.skin_tone);
  expect(checked('Hair style')).toBe(appearance.hair_style);
  expect(checked('Hair color')).toBe(appearance.hair_color);
  expect(checked('Top')).toBe(appearance.top);
  expect(checked('Bottom')).toBe(appearance.bottom);
  expect(checked('Shoes')).toBe(appearance.shoes);
}

describe('avatar edit flow', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('After Edit -> Save, without a reload, the room renders the saved appearance without another GET, and reopening Edit prefills it', async () => {
    const consoleError = vi.spyOn(console, 'error');
    vi.mocked(api.get).mockResolvedValue({ success: true, data: initialAvatar });
    vi.mocked(api.put).mockResolvedValue({ success: true, data: savedAvatar });
    // Fresh client with the app's query defaults (5-minute staleTime), so a page
    // that mounts reuses the cache exactly as it does in the app.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { ...appQueryClient.getDefaultOptions().queries, retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    // #/ is the room, inside AppShell's <main>, full-bleed.
    const room = await screen.findByTestId('room-scene');
    expect(room).toHaveAccessibleName(describeAppearance(initialAppearance));
    expect(screen.getByRole('main').firstElementChild).not.toHaveClass('p-4');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/avatar');

    // Edit avatar opens #/create prefilled; the creator pads itself.
    fireEvent.click(screen.getByRole('link', { name: 'Edit avatar' }));
    await screen.findByRole('group', { name: 'Skin tone' });
    expect(window.location.hash).toBe('#/create');
    expect(screen.getByRole('main').firstElementChild).toHaveClass('p-4');
    expectPrefilled(initialAppearance);

    pick('Skin tone', SKIN_TONE_OPTIONS[savedAppearance.skin_tone].label);
    pick('Hair style', HAIR_STYLE_OPTIONS[savedAppearance.hair_style].label);
    pick('Hair color', HAIR_COLOR_OPTIONS[savedAppearance.hair_color].label);
    pick('Top', TOP_OPTIONS[savedAppearance.top].label);
    pick('Bottom', BOTTOM_OPTIONS[savedAppearance.bottom].label);
    pick('Shoes', SHOES_OPTIONS[savedAppearance.shoes].label);
    roomRenders.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));

    // Back on #/, the room's very first render already shows the saved appearance.
    const savedRoom = await screen.findByTestId('room-scene');
    expect(window.location.hash).toBe('#/');
    expect(savedRoom).toHaveAccessibleName(describeAppearance(savedAppearance));
    expect(new Set(roomRenders)).toEqual(new Set([describeAppearance(savedAppearance)]));
    expect(screen.queryByTestId('avatar-sprite')).not.toBeInTheDocument();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/avatar', expect.objectContaining(savedAppearance));
    expect(api.get).toHaveBeenCalledTimes(1);

    // Reopening Edit prefills the saved appearance, still from the cache.
    fireEvent.click(screen.getByRole('link', { name: 'Edit avatar' }));
    await screen.findByRole('group', { name: 'Skin tone' });
    expectPrefilled(savedAppearance);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
