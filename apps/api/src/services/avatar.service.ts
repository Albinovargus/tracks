import type { Avatar, AvatarAppearance } from '@tracks/types';
import { supabase } from '../lib/supabase.js';

// Returns null when the user has no avatar yet. Use maybeSingle(), not single():
// single() turns "no row" into a PGRST116 error, which surfaces as a 500.
export async function getByUserId(userId: string): Promise<Avatar | null> {
  const { data, error } = await supabase
    .from('avatars')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Creates or replaces the user's avatar. Never sends created_at/updated_at:
// an update keeps created_at, and the set_updated_at trigger moves updated_at.
export async function upsertForUser(
  userId: string,
  appearance: AvatarAppearance,
): Promise<Avatar> {
  const { data, error } = await supabase
    .from('avatars')
    .upsert({ user_id: userId, ...appearance }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
