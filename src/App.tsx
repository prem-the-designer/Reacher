import { useState, useEffect } from 'react';
import { AuthState, User } from '@/types';
import { Header } from '@/components/Header';
import { LoginCard } from '@/components/LoginCard';
import { SearchDomain } from '@/components/SearchDomain';
import { AdminShell } from '@/components/admin/AdminShell';
import { getUserProfile, signOut as supabaseSignOut } from '@/services/authService';
import { supabase } from '@/lib/supabase';

const getInitialDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem('reacher_theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;

    const cookieMatch = document.cookie.match(/(^|;)\s*reacher_theme\s*=\s*([^;]+)/);
    if (cookieMatch) {
      if (cookieMatch[2] === 'dark') return true;
      if (cookieMatch[2] === 'light') return false;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }
  } catch {}
  return false;
};

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(getInitialDarkMode);
  const [authState, setAuthState] = useState<AuthState>('default');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('reacher_theme', 'dark');
        document.cookie = 'reacher_theme=dark; path=/; max-age=31536000; SameSite=Lax';
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('reacher_theme', 'light');
        document.cookie = 'reacher_theme=light; path=/; max-age=31536000; SameSite=Lax';
      } catch {}
    }
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async (session: any) => {
      if (!session) {
        if (mounted && authState !== 'default' && !authState.startsWith('success')) {
          // Keep current state if we're simulating mock states
        } else if (mounted) {
          handleSignOutLocally();
        }
        return;
      }

      // We have a real Supabase session, fetch the profile
      let profile = await getUserProfile(session.user.id);
      
      if (!mounted) return;

      // If the user was invited via magic link, they don't have a profile yet. 
      // Create it now using the metadata attached during the invite.
      if (!profile) {
        const { data, error } = await supabase.from('profiles').insert({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          role: session.user.user_metadata?.role || 'analyst',
          status: session.user.user_metadata?.status || 'active'
        }).select().single();

        if (error) {
          console.error('Failed to auto-create profile:', error);
          setAuthState('failed');
          return;
        }
        profile = data;
      }

      if (!profile) return;

      if (profile.status === 'pending') {
        setAuthState('pending_approval');
        return;
      }

      if (profile.status === 'inactive') {
        setAuthState('failed'); // Or a new inactive state
        return;
      }

      const userObj: User = {
        id: session.user.id,
        email: session.user.email,
        name: profile.name,
        role: profile.role,
      };

      setCurrentUser(userObj);
      if (profile.role === 'admin') setAuthState('success_admin');
      else setAuthState('success_analyst');
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      loadSession(session);

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        // Update last_login for any active session
        const { error: profileError } = await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', session.user.id);
        if (profileError) console.error('Failed to update last_login:', profileError);
        
        // Record User Presence in Activity Logs only on actual login
        if (event === 'SIGNED_IN') {
          const { error: logError } = await supabase.from('activity_logs').insert({
            user_id: session.user.id,
            user_display: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Unknown User',
            action_type: 'login',
            resource_type: 'system',
            details: 'User logged into the application'
          });
          if (logError) console.error('Failed to insert activity_log:', logError);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setAuthState('success_admin');
    } else if (user.role === 'analyst') {
      setAuthState('success_analyst');
    } else {
      setAuthState('forbidden_non_analyst');
    }
  };



  // ── Tab Close Tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const handleBeforeUnload = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !anonKey) return;

      const payload = {
        user_id: currentUser.id,
        user_display: currentUser.name || currentUser.email || 'Unknown User',
        action_type: 'logout',
        resource_type: 'system',
        details: 'User closed the application tab'
      };

      // Fire-and-forget background fetch that survives tab closure
      fetch(`${supabaseUrl}/rest/v1/activity_logs`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser]);

  const handleSignOutLocally = () => {
    setCurrentUser(null);
    setAuthState('default');
  };

  const handleSignOut = async () => {
    if (currentUser) {
      await supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        user_display: currentUser.name || currentUser.email || 'Unknown User',
        action_type: 'logout',
        resource_type: 'system',
        details: 'User logged out of the application'
      });
    }
    await supabaseSignOut();
    handleSignOutLocally();
  };



  // ── Admin Portal ────────────────────────────────────────────────────────────
  // Admin users get the full Admin Shell — no analyst chrome
  if (currentUser?.role === 'admin' && authState === 'success_admin') {
    return (
      <AdminShell
        currentUser={currentUser}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onSignOut={handleSignOut}
      />
    );
  }

  // ── Analyst Portal ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-muted font-sans antialiased">
      <Header
        currentUser={currentUser}
        onSignOut={handleSignOut}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      <main className="flex-1 flex flex-col">
        {!currentUser || authState === 'forbidden_non_analyst' ? (
          <LoginCard
            authState={authState}
            onAuthStateChange={setAuthState}
            onLoginSuccess={handleLoginSuccess}
            onSignOut={handleSignOut}
          />
        ) : (
          <SearchDomain key="search-main" />
        )}
      </main>

      <footer className="border-t border-border py-4 px-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Reacher</span>
          <span className="font-mono text-[11px]">Strict State Machine Architecture v1.0</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
