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
    listeners: new Set<Listener>(),
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.stored }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: state.getUserError })),
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

function renderApp() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: <RequireAuth />,
        children: [{ index: true, element: <p>Room page</p> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** Lets queued auth callbacks, effects and navigations run. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

describe('useAuth with a stored session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.state.listeners.clear();
    fake.state.stored = { access_token: 'stored', user: { id: 'u1', email: 'a@example.test' } };
    useAuthStore.setState({ session: null, user: null, isLoading: true });
  });
  afterEach(cleanup);

  it('signs a session the server rejects out locally, once, and stays on /login', async () => {
    fake.state.getUserError = { name: 'AuthApiError', status: 403, message: 'invalid JWT' };
    const router = renderApp();

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    await settle();

    expect(router.state.location.pathname).toBe('/login');
    expect(fake.auth.signOut).toHaveBeenCalledTimes(1);
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
    expect(fake.state.stored).toBeNull();
  });

  it('keeps the stored session when the server cannot be reached', async () => {
    fake.state.getUserError = {
      name: 'AuthRetryableFetchError',
      status: 0,
      message: 'Failed to fetch',
    };
    const router = renderApp();

    expect(await screen.findByText('Room page')).toBeInTheDocument();
    await settle();

    expect(router.state.location.pathname).toBe('/');
    expect(fake.auth.signOut).not.toHaveBeenCalled();
    expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
  });
});
