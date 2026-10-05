import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
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

import { api } from '../lib/api.js';
import { App } from '../App.js';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('inside a QueryClientProvider, a signed-out visitor at #/ reaches Sign In with no API call or console error', async () => {
    const consoleError = vi.spyOn(console, 'error');
    // main.tsx owns the app's QueryClientProvider. AppShell renders the index RoomPage once
    // before it redirects to /login, and RoomPage's useAvatar needs a client.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    expect(api.get).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
