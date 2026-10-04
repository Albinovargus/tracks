import { useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuthStore } from '../store/auth.store.js';
import { api } from '../lib/api.js';

export function useAuth() {
  const { session, user, isLoading, setSession, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // getUser() validates against the server — safe for frontend display.
        // getSession() user data comes from local storage and can be tampered with.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setSession({ ...session, user });
        } else {
          setSession(null);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Return confirmation links to wherever the app is served (localhost, GitHub Pages)
      options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href },
    });
    if (error) throw error;
    // Projects with email confirmation enabled return no session until the link is clicked
    if (!data.session) return { needsEmailConfirmation: true };
    // Notify API so it can enqueue the welcome email
    await api.post('/auth/callback').catch(() => {
      // Non-critical: welcome email may not send, but signup still succeeds
    });
    return { needsEmailConfirmation: false };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { session, user, isLoading, signIn, signUp, signOut };
}
