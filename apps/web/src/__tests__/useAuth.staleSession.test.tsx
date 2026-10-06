import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

type Listener = (event: string, session: unknown) => void;

/**
 * A stand-in for supabase.auth backed by one stored session, like localStorage:
 * every subscriber gets INITIAL_SESSION from storage, and only signOut clears it.
 */
const fake = vi.hoisted(() => {
  const state = {
    stored: null as { access_token: string; user: { id: string; email: string } } | null,
    getUserError: null as { name: string; status: number; message: string } | null,
    getUserDelayMs: 0,
    listeners: new Set<Listener>(),
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.stored }, error: null })),
    // A network round trip: answers after a macrotask, so INITIAL_SESSION lands first.
    getUser: vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, state.getUserDelayMs));
      return { data: { user: null }, error: state.getUserError };
    }),
    onAuthStateChange: vi.fn((callback: Listener) => {
      state.listeners.add(callback);
      const initial = state.stored;
      queueMicrotask(() => callback('INITIAL_SESSION', initial));
      return {
        data: { subscription: { unsubscribe: () => state.listeners.delete(callback) } },
      };
    }),
    signOut: vi.fn(async () => {
      state.stored = null;
      for (const listener of state.listeners) listener('SIGNED_OUT', null);
      return { error: null };
    }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  };
  return { state, auth };
});

vi.mock('../lib/supabase.js', () => ({ supabase: { auth: fake.auth } }));
vi.mock('../lib/api.js', () => ({ api: { post: vi.fn() } }));

import { RequireAuth } from '../components/layout/RequireAuth.js';
import { LoginPage } from '../pages/LoginPage.js';
import { useAuthStore } from '../store/auth.store.js';
import { initAuth, resetAuthInit } from '../lib/auth-init.js';

function renderApp(start = '/') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: <RequireAuth />,
        children: [{ index: true, element: <p>Room page</p> }],
      },
    ],
    { initialEntries: [start] },
  );
  const visited: string[] = [];
  router.subscribe((state) => visited.push(state.location.pathname));
  // What App does once per load.
  initAuth();
  render(<RouterProvider router={router} />);
  return { router, visited };
}

/** Lets queued auth callbacks, effects and navigations run. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

describe('useAuth with a stored session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.state.listeners.clear();
    fake.state.getUserDelayMs = 0;
    fake.state.stored = { access_token: 'stored', user: { id: 'u1', email: 'a@example.test' } };
    useAuthStore.setState({ session: null, user: null, isLoading: true });
  });
  afterEach(() => {
    cleanup();
    resetAuthInit();
  });

  it.each([400, 401, 403, 404])(
    'signs a session the server rejects with %i out locally, once, and stays on /login',
    async (status) => {
      fake.state.getUserError = { name: 'AuthApiError', status, message: 'rejected' };
      const { router } = renderApp();

      expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
      await settle();

      expect(router.state.location.pathname).toBe('/login');
      expect(fake.auth.signOut).toHaveBeenCalledTimes(1);
      expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
      expect(fake.state.stored).toBeNull();
    },
  );

  // One check per app load, however slow /user answers: RequireAuth mounting while it is
  // in flight starts no second check (it once did: two checks, two local sign-outs).
  it.each([
    { delayMs: 0, checks: 1 },
    { delayMs: 30, checks: 1 },
  ])(
    'opened at /login with a rejected session (getUser after $delayMs ms), bounces through / once and settles on /login',
    async ({ delayMs, checks }) => {
      fake.state.getUserError = { name: 'AuthApiError', status: 403, message: 'invalid JWT' };
      fake.state.getUserDelayMs = delayMs;
      const { router, visited } = renderApp('/login');

      await settle();
      await settle();

      expect(router.state.location.pathname).toBe('/login');
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
      // LoginPage's INITIAL_SESSION carries the stored session to / once; RequireAuth sends it back.
      expect(visited).toEqual(['/', '/login']);
      expect(fake.auth.getUser).toHaveBeenCalledTimes(checks);
      expect(fake.auth.signOut).toHaveBeenCalledTimes(checks);
      expect(fake.state.stored).toBeNull();
    },
  );

  it.each([
    { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
    { name: 'AuthApiError', status: 408, message: 'Request Timeout' },
    { name: 'AuthApiError', status: 429, message: 'Too Many Requests' },
    { name: 'AuthApiError', status: 500, message: 'Internal Server Error' },
  ])('keeps the stored session when getUser fails with $status', async (error) => {
    fake.state.getUserError = error;
    const { router } = renderApp();

    expect(await screen.findByText('Room page')).toBeInTheDocument();
    await settle();

    expect(router.state.location.pathname).toBe('/');
    expect(fake.auth.signOut).not.toHaveBeenCalled();
    expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
    expect(fake.state.stored).not.toBeNull();
  });
});
