import { AuthState, User, UserStatus, Role } from '@/types';
import { supabase } from '@/lib/supabase';

// ── Mock Users (Kept for QA Panel compatibility) ─────────────────────────────
export const MOCK_ANALYST_USER: User = {
  id: 'usr-analyst-101',
  email: 'analyst@company.com',
  name: 'Sarah Chen',
  role: 'analyst',
};

export const MOCK_ADMIN_USER: User = {
  id: 'usr-002',
  email: 'jordan.miller@company.com',
  name: 'Jordan Miller',
  role: 'admin',
};

export const MOCK_NON_ANALYST_USER: User = {
  id: 'usr-admin-909',
  email: 'jordan@company.com',
  name: 'Jordan Miller',
  role: 'admin',
};

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

// ── Mock Auth (QA Panel) ─────────────────────────────────────────────────────

export async function authenticateWithGoogle(
  targetScenario: AuthState = 'success_analyst',
  customEmail: string = 'analyst@company.com'
): Promise<{ user: User | null; nextState: AuthState; emailAttempted?: string }> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  switch (targetScenario) {
    case 'cancelled':
      return { user: null, nextState: 'cancelled' };
    case 'unregistered':
      return {
        user: null,
        nextState: 'unregistered',
        emailAttempted: customEmail || 'unregistered.user@company.com',
      };
    case 'failed':
      return { user: null, nextState: 'failed' };
    case 'forbidden_non_analyst':
      return { user: MOCK_NON_ANALYST_USER, nextState: 'forbidden_non_analyst' };
    case 'success_admin':
      return { user: MOCK_ADMIN_USER, nextState: 'success_admin' };
    case 'pending_approval':
      return { user: null, nextState: 'pending_approval', emailAttempted: customEmail };
    case 'success_analyst':
    default:
      return { user: MOCK_ANALYST_USER, nextState: 'success_analyst' };
  }
}
