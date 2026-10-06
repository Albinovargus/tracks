import * as Sentry from '@sentry/react';
import { supabase } from './supabase.js';
import { useAuthStore } from '../store/auth.store.js';

/**
 * Statuses where the auth server judged the session itself invalid (bad or expired JWT,
 * deleted user or session). Others, like 408 timeouts and 429 rate limits, say nothing
 * about the session, so it is kept.
 */
const SESSION_REJECTED = new Set([400, 401, 403, 404]);

function isRejection(status: number | undefined): boolean {
  return status !== undefined && SESSION_REJECTED.has(status);
}

/** The running initializer's cleanup, or null before initAuth (and after a reset). */
let stop: (() => void) | null = null;
/** Bumped by every initAuth and cleanup: a check from an older generation is stale. */
let generation = 0;
/**
 * Counts auth events that carry new truth (sign-in, sign-out, refresh; not the
 * INITIAL_SESSION replay of storage). The store already holds what they said.
 */
let authChanges = 0;

/**
 * Validates the stored session once, then sets isLoading false. It gives way to
 * anything newer: after a reset (another generation) it writes nothing, and after a
 * sign-in or sign-out during the check it leaves the session alone.
 */
async function checkStoredSession(gen: number): Promise<void> {
  const changesAtStart = authChanges;
  const current = () => gen === generation;
  const superseded = () => !current() || authChanges !== changesAtStart;
  const { setSession, setLoading } = useAuthStore.getState();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session || superseded()) return;
    // getUser() validates against the server — safe for frontend display.
    // getSession() user data comes from local storage and can be tampered with.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (superseded()) return;
    if (user) {
      setSession({ ...session, user });
    } else if (error && isRejection(error.status)) {
      // The server refused the stored session. Clear it from storage too: a session
      // left there comes back through INITIAL_SESSION on every load, bouncing /login
      // and / forever.
      await supabase.auth.signOut({ scope: 'local' });
      if (current()) setSession(null);
    } else {
      // The server could not be reached or could not judge the session (network,
      // timeout, rate limit, 5xx): keep the stored session, which the API still
      // validates on every call.
      setSession(session);
    }
  } catch (error) {
    // A failed check must not leave the app on its loading screen; the session (if
    // any) stays as INITIAL_SESSION set it, and the API still validates every call.
    Sentry.captureException(error);
  } finally {
    if (current()) setLoading(false);
  }
}

/**
 * Checks the stored session and follows auth changes into the auth store, once per app
 * load: useAuth() only reads the store, so screens that mount and unmount (the room's
 * menu) cost no extra GET /auth/v1/user. Idempotent: later calls return the same cleanup.
 */
export function initAuth(): () => void {
  if (stop) return stop;

  generation += 1;
  const gen = generation;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'INITIAL_SESSION') authChanges += 1;
    useAuthStore.getState().setSession(session);
  });
  void checkStoredSession(gen);

  const cleanup = () => {
    subscription.unsubscribe();
    if (stop === cleanup) {
      stop = null;
      generation += 1;
    }
  };
  stop = cleanup;
  return cleanup;
}

/** Stops the initializer so the next initAuth() checks again. For tests. */
export function resetAuthInit(): void {
  stop?.();
}

// A dev hot reload of this module starts a new initializer: drop the old one's
// subscription so they do not stack.
import.meta.hot?.dispose(() => stop?.());
