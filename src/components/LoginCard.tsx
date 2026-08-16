import React, { useState } from 'react';
import { AuthState, User } from '@/types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { signInWithGoogle } from '@/services/authService';
import { Lock, LogOut } from 'lucide-react';

interface LoginCardProps {
  authState: AuthState;
  onAuthStateChange: (newState: AuthState) => void;
  onLoginSuccess: (user: User) => void;
  onSignOut: () => void;
  unregisteredEmail?: string;
  onSimulateState?: (state: AuthState, email?: string) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  authState,
  onAuthStateChange,
  // onLoginSuccess intentionally unused
  onSignOut,
  unregisteredEmail = 'unregistered.user@company.com',
  // onSimulateState intentionally unused — QA fixture section commented out
}) => {
  const [attemptEmail] = useState(unregisteredEmail);

  // Trigger Google SSO authentication exchange
  const handleGoogleSignIn = async () => {
    onAuthStateChange('signing_in');
    try {
      await signInWithGoogle();
      // Note: Supabase will redirect the page, so no state setting happens here.
      // The session will be caught by onAuthStateChange in App.tsx when the page reloads.
    } catch {
      onAuthStateChange('failed');
    }
  };

  // Dedicated Forbidden view for non-analyst user per §4
  if (authState === 'forbidden_non_analyst') {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <Card elevation="sm" className="w-full max-w-[448px] p-6 sm:p-8 space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Analyst Access Required
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Analyst access required — you're signed in, but this account isn't set up as an Analyst. Ask your administrator to grant access, then sign in again.
            </p>
          </div>

          <Alert variant="default" className="text-left text-xs">
            Admin portal features are restricted on this domain. Search Domain requires explicit Analyst permissions.
          </Alert>

          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full h-10 gap-2"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out & try another account</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-4">
      <Card elevation="sm" className="w-full max-w-[448px] p-6 sm:p-8 space-y-6">
        {/* Identity & Header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs mb-1">
            Reacher
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use your work Google account. Access is limited to accounts with Analyst permission.
          </p>
        </div>

        {/* Dynamic Auth Alerts per §4 */}
        {authState === 'cancelled' && (
          <Alert variant="default">
            Sign-in cancelled — continue with Google when you're ready.
          </Alert>
        )}

        {authState === 'unregistered' && (
          <Alert variant="destructive">
            That account isn't registered. <span className="font-semibold">{attemptEmail}</span> doesn't have a Reach Value account. Ask your administrator to add it.
          </Alert>
        )}

        {authState === 'failed' && (
          <Alert variant="destructive">
            We couldn't sign you in. The sign-in didn't complete — try again in a moment.
          </Alert>
        )}

        {authState === 'pending_approval' && (
          <Alert variant="default">
            Your account <span className="font-semibold">{attemptEmail}</span> has been created but is awaiting Administrator approval. You will be able to access the portal once activated.
          </Alert>
        )}

        {/* Single Google SSO Sign-in Button per §4 */}
        <div className="space-y-4 pt-1">
          <Button
            variant="outline"
            size="default"
            className="w-full h-10 gap-3 border-border font-medium text-foreground hover:bg-accent hover:border-input transition-all"
            isLoading={authState === 'signing_in'}
            loadingText="Signing in…"
            onClick={handleGoogleSignIn}
          >
            {/* Official Google Mark on white circular chip per §4 */}
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-2xs shrink-0">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </span>
            <span>Continue with Google</span>
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            Protected by enterprise single sign-on security.
          </p>
        </div>
      </Card>

      {/* Quick Auth Scenario Switcher for easy testing during QA */}
      {/* <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-[448px] px-2 text-xs">
        <span className="w-full text-center text-muted-foreground text-[11px] mb-1 font-mono">
          QA Auth Fixtures:
        </span>
        <button
          onClick={() => onSimulateState('default')}
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          Default
        </button>
        <button
          onClick={() => onSimulateState('cancelled')}
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          Cancelled
        </button>
        <button
          onClick={() => onSimulateState('unregistered', 'unknown.analyst@domain.com')}
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          Unregistered
        </button>
        <button
          onClick={() => onSimulateState('failed')}
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          Auth Failure
        </button>
        <button
          onClick={() => onSimulateState('forbidden_non_analyst')}
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          Non-Analyst
        </button>
        <button
          onClick={() => onSimulateState('success_analyst')}
          className="rounded border border-primary bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/90"
        >
          Sign in as Analyst
        </button>
      </div> */}
    </div>
  );
};
