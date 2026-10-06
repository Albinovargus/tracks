import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

type Listener = (event: string, session: unknown) => void;
type FakeSession = { access_token: string; user: { id: string; email: string } };
type UserResult = {
  data: { user: FakeSession['user'] | null };
  error: { name: string; status: number; message: string } | null;
};

/** A supabase.auth whose getUser answers only when a test resolves it. */
const fake = vi.hoisted(() => {
  const state = {
    stored: null as FakeSession | null,
    listeners: new Set<Listener>(),
    answerUser: null as ((result: UserResult) => void) | null,
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.stored }, error: null })),
    getUser: vi.fn(
      () =>
        new Promise<UserResult>((resolve) => {
          state.answerUser = resolve;
        }),
    ),
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
  };
  return { state, auth };
});

vi.mock('../lib/supabase.js', () => ({ supabase: { auth: fake.auth } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import * as Sentry from '@sentry/react';
import { initAuth, resetAuthInit } from '../lib/auth-init.js';
import { useAuthStore } from '../store/auth.store.js';

const STORED: FakeSession = { access_token: 'stored', user: { id: 'u1', email: 'a@example.test' } };

/** Lets queued promise callbacks and INITIAL_SESSION run. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Runs initAuth until its getUser request is in flight. */
async function startCheck(): Promise<(result: UserResult) => void> {
  initAuth();
  await flush();
  const answer = fake.state.answerUser;
  if (!answer) throw new Error('getUser was not called');
  return answer;
}

describe('initAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.state.listeners.clear();
    fake.state.answerUser = null;
    fake.state.stored = { ...STORED };
    useAuthStore.setState({ session: null, user: null, isLoading: true });
  });
  afterEach(() => {
    resetAuthInit();
  });

  it('ends loading and reports to Sentry when getSession rejects', async () => {
    const failure = new Error('storage unavailable');
    fake.auth.getSession.mockRejectedValueOnce(failure);

    initAuth();
    await flush();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledWith(failure);
  });

  it('ends loading and reports to Sentry when getUser rejects', async () => {
    const failure = new Error('boom');
    fake.auth.getUser.mockRejectedValueOnce(failure);

    initAuth();
    await flush();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledWith(failure);
  });

  it('keeps a SIGNED_OUT that lands while getUser is in flight', async () => {
    const answerUser = await startCheck();
    expect(useAuthStore.getState().session).not.toBeNull(); // INITIAL_SESSION

    // Signed out (another tab, say) before /user answers for the old session.
    fake.state.stored = null;
    for (const listener of fake.state.listeners) listener('SIGNED_OUT', null);
    answerUser({ data: { user: STORED.user }, error: null });
    await flush();

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('does not sign out a session that replaced the one a late rejection was about', async () => {
    const answerUser = await startCheck();

    const fresh: FakeSession = { access_token: 'fresh', user: { id: 'u2', email: 'b@example.test' } };
    fake.state.stored = fresh;
    for (const listener of fake.state.listeners) listener('SIGNED_IN', fresh);
    answerUser({
      data: { user: null },
      error: { name: 'AuthApiError', status: 403, message: 'invalid JWT' },
    });
    await flush();

    expect(fake.auth.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toEqual(fresh);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('writes nothing to the store from a check that outlives resetAuthInit', async () => {
    const answerUser = await startCheck();
    resetAuthInit();
    useAuthStore.setState({ session: null, user: null, isLoading: true });

    answerUser({
      data: { user: null },
      error: { name: 'AuthApiError', status: 401, message: 'expired' },
    });
    await flush();

    expect(fake.auth.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ session: null, user: null, isLoading: true });

    // The same for a stale check that succeeds.
    const answerAgain = await startCheck();
    resetAuthInit();
    useAuthStore.setState({ session: null, user: null, isLoading: true });
    answerAgain({ data: { user: STORED.user }, error: null });
    await flush();

    expect(useAuthStore.getState()).toMatchObject({ session: null, user: null, isLoading: true });
  });
});
