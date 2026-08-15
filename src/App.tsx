import { useState, useEffect } from 'react';
import { AuthState, User } from '@/types';
import { Header } from '@/components/Header';
import { LoginCard } from '@/components/LoginCard';
import { SearchDomain } from '@/components/SearchDomain';
import { QAToolbar } from '@/components/QAToolbar';
import { AdminShell } from '@/components/admin/AdminShell';
import { MOCK_ANALYST_USER, MOCK_NON_ANALYST_USER, MOCK_ADMIN_USER, getUserProfile, signOut as supabaseSignOut } from '@/services/authService';
import { supabase } from '@/lib/supabase';

export function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('default');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isQAPanelOpen, setIsQAPanelOpen] = useState(false);
  const [fixtureDomainToSearch, setFixtureDomainToSearch] = useState<string | null>(null);

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
      const profile = await getUserProfile(session.user.id);
      
      if (!mounted) return;

      if (!profile) {
        setAuthState('failed');
        return;
      }

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSession(session);
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
    setFixtureDomainToSearch(null);
  };

  const handleSignOut = async () => {
    await supabaseSignOut();
    handleSignOutLocally();
  };

  const handleSelectAuthState = (state: AuthState) => {
    setAuthState(state);
    if (state === 'success_analyst') {
      setCurrentUser(MOCK_ANALYST_USER);
    } else if (state === 'success_admin') {
      setCurrentUser(MOCK_ADMIN_USER);
    } else if (state === 'forbidden_non_analyst') {
      setCurrentUser(MOCK_NON_ANALYST_USER);
    } else {
      setCurrentUser(null);
    }
  };

  const handleTestSearchFixture = (domain: string) => {
    if (!currentUser || currentUser.role !== 'analyst') {
      setCurrentUser(MOCK_ANALYST_USER);
      setAuthState('success_analyst');
    }
    setFixtureDomainToSearch(domain);
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
        onOpenQAPanel={() => setIsQAPanelOpen(true)}
      />

      <main className="flex-1 flex flex-col">
        {!currentUser || authState === 'forbidden_non_analyst' ? (
          <LoginCard
            authState={authState}
            onAuthStateChange={setAuthState}
            onLoginSuccess={handleLoginSuccess}
            onSignOut={handleSignOut}
            onSimulateState={(state) => {
              setAuthState(state);
              if (state === 'success_analyst') setCurrentUser(MOCK_ANALYST_USER);
              else if (state === 'success_admin') setCurrentUser(MOCK_ADMIN_USER);
              else if (state === 'forbidden_non_analyst') setCurrentUser(MOCK_NON_ANALYST_USER);
              else setCurrentUser(null);
            }}
          />
        ) : (
          <SearchDomain
            key={fixtureDomainToSearch || 'search-main'}
            initialDomain={fixtureDomainToSearch || undefined}
          />
        )}
      </main>

      <footer className="border-t border-border py-4 px-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Reacher</span>
          <span className="font-mono text-[11px]">Strict State Machine Architecture v1.0</span>
        </div>
      </footer>

      <QAToolbar
        isOpen={isQAPanelOpen}
        onClose={() => setIsQAPanelOpen(false)}
        currentAuthState={authState}
        onSelectAuthState={handleSelectAuthState}
        onTestSearchFixture={handleTestSearchFixture}
        onResetDB={() => setFixtureDomainToSearch(null)}
      />
    </div>
  );
}

export default App;
