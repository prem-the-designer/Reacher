import { UserStatus, Role } from '@/types';
import { supabase } from '@/lib/supabase';

// ── Supabase Auth ────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserProfile(userId: string): Promise<{ role: Role, status: UserStatus, name: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, status, name')
    .eq('id', userId)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching profile:', error.message || error);
    return null;
  }
  return data;
}


