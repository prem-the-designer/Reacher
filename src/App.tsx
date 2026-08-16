import { useState, useEffect } from 'react';
import { AuthState, User } from '@/types';
import { Header } from '@/components/Header';
import { LoginCard } from '@/components/LoginCard';
import { SearchDomain } from '@/components/SearchDomain';
import { AdminShell } from '@/components/admin/AdminShell';
import { getUserProfile, signOut as supabaseSignOut } from '@/services/authService';
import { supabase } from '@/lib/supabase';

export function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('default');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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

      if (event === 'SIGNED_IN' && session) {
        // Update last_login
        await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', session.user.id);
        
        // Record User Presence in Activity Logs
        await supabase.from('activity_logs').insert({
          user_id: session.user.id,
          user_display: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Unknown User',
          action_type: 'login',
          resource_type: 'system',
          details: 'User logged into the application',
          metadata: { provider: session.user.app_metadata?.provider || 'email' }
        });
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



  const handleSignOutLocally = () => {
    setCurrentUser(null);
    setAuthState('default');
  };

  const handleSignOut = async () => {
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
