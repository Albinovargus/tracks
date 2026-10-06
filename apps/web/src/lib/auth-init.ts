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

/** Validates the stored session once, then sets isLoading false. */
async function checkStoredSession(): Promise<void> {
  const { setSession, setLoading } = useAuthStore.getState();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    // getUser() validates against the server — safe for frontend display.
    // getSession() user data comes from local storage and can be tampered with.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (user) {
      setSession({ ...session, user });
    } else if (error && isRejection(error.status)) {
      // The server refused the stored session. Clear it from storage too: a session
      // left there comes back through INITIAL_SESSION on every load, bouncing /login
      // and / forever.
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
    } else {
      // The server could not be reached or could not judge the session (network,
      // timeout, rate limit, 5xx): keep the stored session, which the API still
      // validates on every call.
      setSession(session);
    }
  }
  setLoading(false);
}

/**
 * Checks the stored session and follows auth changes into the auth store, once per app
 * load: useAuth() only reads the store, so screens that mount and unmount (the room's
 * menu) cost no extra GET /auth/v1/user. Idempotent: later calls return the same cleanup.
 */
export function initAuth(): () => void {
  if (stop) return stop;

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
  });
  void checkStoredSession();

  const cleanup = () => {
    subscription.unsubscribe();
    if (stop === cleanup) stop = null;
  };
  stop = cleanup;
  return cleanup;
}

/** Stops the initializer so the next initAuth() checks again. For tests. */
export function resetAuthInit(): void {
  stop?.();
}
