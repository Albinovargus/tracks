import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Avatar, AvatarAppearance } from '@tracks/types';

type Listener = (event: string, session: unknown) => void;
type FakeSession = { access_token: string; user: { id: string; email: string } };

/**
 * A stand-in for supabase.auth backed by one stored session, like localStorage: every
 * subscriber gets INITIAL_SESSION from storage, and sign-in and sign-out notify them all.
 */
const fake = vi.hoisted(() => {
  const state = {
    stored: null as FakeSession | null,
    listeners: new Set<Listener>(),
  };
  const emit = (event: string) => {
    for (const listener of state.listeners) listener(event, state.stored);
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.stored }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: state.stored?.user ?? null }, error: null })),
    onAuthStateChange: vi.fn((callback: Listener) => {
      state.listeners.add(callback);
      const initial = state.stored;
      queueMicrotask(() => callback('INITIAL_SESSION', initial));
      return {
        data: { subscription: { unsubscribe: () => state.listeners.delete(callback) } },
      };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
      state.stored = { access_token: 'fresh', user: { id: 'u1', email } };
      emit('SIGNED_IN');
      return { data: { session: state.stored }, error: null };
    }),
    signOut: vi.fn(async () => {
      state.stored = null;
      emit('SIGNED_OUT');
      return { error: null };
    }),
    signUp: vi.fn(),
  };
  return { state, auth };
});

vi.mock('@/lib/supabase.js', () => ({ supabase: { auth: fake.auth } }));

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  captureException: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(false) },
}));

vi.mock('../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// jsdom has no canvas: the room becomes an accessible <div>.
vi.mock('../features/avatar-room/RoomScene.js', () => ({
  RoomScene: () => <div role="img" aria-label="Room" />,
}));

import { api } from '../lib/api.js';
import { App } from '../App.js';
import { router } from '../router.js';
import { resetAuthInit } from '../lib/auth-init.js';
import { useAuthStore } from '../store/auth.store.js';

const APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
};
const AVATAR: Avatar = {
  ...APPEARANCE,
  created_at: '2026-10-04T12:00:00.000Z',
  updated_at: '2026-10-04T12:00:00.000Z',
};

/**
 * Renders App at /login. The app's hash router is a singleton that outlives each test;
 * navigating it directly (not through window.location.hash, whose hashchange lands
 * later) means no late navigation can unmount the room mid-test.
 */
async function renderApp() {
  await router.navigate('/login');
  expect(router.state.location.pathname).toBe('/login');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

async function openMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
  return screen.findByRole('dialog');
}

async function closeMenu(sheet: HTMLElement) {
  fireEvent.click(within(sheet).getByRole('button', { name: 'Close menu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('the auth check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ success: true, data: AVATAR });
    fake.state.listeners.clear();
    fake.state.stored = { access_token: 'stored', user: { id: 'u1', email: 'a@example.com' } };
    useAuthStore.setState({ session: null, user: null, isLoading: true });
  });
  afterEach(() => {
    cleanup();
    resetAuthInit();
  });

  it('runs once per app load, however often LoginPage, RequireAuth and the room menu mount', async () => {
    await renderApp();

    // LoginPage, then RequireAuth, then the room.
    expect(await screen.findByRole('img', { name: 'Room' })).toBeInTheDocument();
    for (let i = 0; i < 3; i += 1) {
      const sheet = await openMenu();
      expect(within(sheet).getByText('a@example.com')).toBeInTheDocument();
      await closeMenu(sheet);
    }

    expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
    expect(fake.auth.getSession).toHaveBeenCalledTimes(1);
    expect(fake.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('signing out from the menu and back in updates every consumer', async () => {
    await renderApp();

    expect(await screen.findByRole('img', { name: 'Room' })).toBeInTheDocument();
    const sheet = await openMenu();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    expect(useAuthStore.getState().session).toBeNull();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'b@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('img', { name: 'Room' })).toBeInTheDocument();
    const again = await openMenu();
    expect(within(again).getByText('b@example.com')).toBeInTheDocument();

    expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
    expect(fake.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });
});
