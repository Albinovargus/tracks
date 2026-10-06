import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const auth = vi.hoisted(() => ({ signedIn: false }));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    session: auth.signedIn ? { access_token: 'token' } : null,
    user: null,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));
vi.mock('../features/avatar-room/RoomPage.js', () => ({ RoomPage: () => <p>Room page</p> }));
vi.mock('../features/avatar-creator/CreatorPage.js', () => ({
  CreatorPage: () => <p>Creator page</p>,
}));
vi.mock('../components/layout/AppShell.js', async () => {
  const { Outlet } = await import('react-router');
  return { AppShell: () => <Outlet /> };
});

import { routes } from '../router.js';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('routes', () => {
  afterEach(cleanup);

  it.each(['/signup', '/no/such/page'])(
    'sends a signed-out visitor at unknown %s to Sign In',
    async (path) => {
      auth.signedIn = false;
      const router = renderAt(path);

      expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
    },
  );

  it('sends a signed-in user at an unknown route to the room', async () => {
    auth.signedIn = true;
    const router = renderAt('/signup');

    expect(await screen.findByText('Room page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
