import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const signOut = vi.fn();

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    session: { access_token: 'token-a' },
    user: { id: 'user-a', email: 'a@example.com' },
    isLoading: false,
    signOut,
  }),
}));

import { AppShell } from '../components/layout/AppShell.js';

function renderShell() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login</p> },
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <p>Page content</p> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('AppShell', () => {
  afterEach(cleanup);

  it('offers the room as its only nav destination', () => {
    renderShell();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Room' })).toHaveAttribute('href', '/');
  });

  it('leaves padding to each page: main scrolls but has no padding of its own', () => {
    renderShell();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex-1', 'overflow-y-auto');
    expect(main).not.toHaveClass('p-4');
    expect(main).toHaveTextContent('Page content');
  });

  it('gives Sign out a 44px touch target', () => {
    renderShell();

    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveClass('min-h-11');
  });

  it('truncates a long email so Sign out stays on screen at 375px', () => {
    renderShell();

    // jsdom has no layout: the classes are what let the email shrink instead of pushing Sign out off.
    const email = screen.getByText('a@example.com');
    expect(email).toHaveClass('min-w-0', 'truncate');
    expect(email).toHaveAttribute('title', 'a@example.com');
    expect(email.parentElement).toHaveClass('min-w-0');
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveClass('shrink-0');
  });
});
