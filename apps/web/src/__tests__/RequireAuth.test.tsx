import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const auth = vi.hoisted(() => ({
  state: { session: null as { access_token: string } | null, isLoading: false },
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({ ...auth.state, user: null, signOut: vi.fn() }),
}));

import { RequireAuth } from '../components/layout/RequireAuth.js';

function renderGuarded(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login page</p> },
      {
        path: '/',
        element: <RequireAuth />,
        children: [
          { index: true, element: <p>Room page</p> },
          { path: 'create', element: <p>Creator page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('RequireAuth', () => {
  afterEach(cleanup);

  it('shows a full-height loading screen while auth resolves', () => {
    auth.state = { session: null, isLoading: true };
    renderGuarded('/');

    const loading = screen.getByText('Loading...');
    expect(loading.parentElement).toHaveClass('h-[100dvh]');
    expect(screen.queryByText('Room page')).not.toBeInTheDocument();
  });

  it.each(['/', '/create'])('sends a signed-out user on %s to /login', async (path) => {
    auth.state = { session: null, isLoading: false };
    const router = renderGuarded(path);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    // Replace, not push: Back (and Android's back button) must not land on the
    // guarded page only to be bounced to /login again.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('renders the page for a signed-in user', () => {
    auth.state = { session: { access_token: 'token-a' }, isLoading: false };
    renderGuarded('/create');

    expect(screen.getByText('Creator page')).toBeInTheDocument();
  });
});
