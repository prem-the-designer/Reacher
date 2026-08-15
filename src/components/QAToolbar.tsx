import React, { useState } from 'react';
import { AuthState } from '@/types';
import { Button } from './ui/Button';
import { resetMasterDatabase } from '@/services/domainService';
import { Sparkles, X, Check, RefreshCw, Shield, Search } from 'lucide-react';

interface QAToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  currentAuthState: AuthState;
  onSelectAuthState: (state: AuthState) => void;
  onTestSearchFixture: (domain: string) => void;
  onResetDB: () => void;
}

export const QAToolbar: React.FC<QAToolbarProps> = ({
  isOpen,
  onClose,
  currentAuthState,
  onSelectAuthState,
  onTestSearchFixture,
  onResetDB,
}) => {
  const [activeTab, setActiveTab] = useState<'auth' | 'search'>('auth');

  if (!isOpen) return null;

  const authScenarios: { id: AuthState; label: string; desc: string }[] = [
    { id: 'default', label: '1. Default Login', desc: 'Initial card state' },
    { id: 'signing_in', label: '2. Signing In…', desc: 'Disabled button + spinner' },
    { id: 'cancelled', label: '3. Cancelled', desc: 'Neutral warning alert' },
    { id: 'unregistered', label: '4. Unregistered Account', desc: 'Destructive email alert' },
    { id: 'failed', label: '5. Sign-in Failed', desc: 'Generic sign-in failure alert' },
    { id: 'success_analyst', label: '6. Success (Analyst)', desc: 'Lands on Search Domain' },
    { id: 'forbidden_non_analyst', label: '7. Success (Non-Analyst)', desc: 'Forbidden view + sign out' },
    { id: 'success_admin', label: '8. Success (Admin)', desc: 'Lands on Admin Portal' },
  ];

  const searchFixtures: { domain: string; label: string; desc: string }[] = [
    { domain: 'bbc.com', label: 'Master DB Domain (bbc.com)', desc: 'Returns stored record instantly' },
    { domain: 'https://www.nytimes.com/news?ref=top', label: 'URL Normalisation Test', desc: 'Strips https://, www., query' },
    { domain: 'brandnewdomain.com', label: 'New Domain (Get Reach)', desc: 'Shows Get Reach -> API Fetch (— metadata)' },
    { domain: 'invalid_domain_format', label: 'Invalid Domain Format', desc: 'Triggers inline validation error' },
    { domain: 'rate-limit.test', label: 'Rate Limited (.test)', desc: 'Triggers verbatim 429 error copy' },
    { domain: 'server-error.test', label: 'Server Error (.test)', desc: 'Triggers verbatim server failure copy' },
    { domain: 'offline.test', label: 'Network Failure (.test)', desc: 'Triggers verbatim network copy' },
    { domain: 'db-down.test', label: 'Database Down (.test)', desc: 'Triggers database unavailable error' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-background shadow-2xl transition-transform animate-in slide-in-from-right duration-200">
      {/* QA Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>QA State Machine Inspector</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close QA Toolbar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setActiveTab('auth')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'auth' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Login States (§4)</span>
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'search' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search Fixtures (§11)</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {activeTab === 'auth' ? (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Select any of the 7 specification-defined auth states to test UI rendering:
            </p>
            {authScenarios.map((sc) => (
              <button
                key={sc.id}
                onClick={() => onSelectAuthState(sc.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-0.5 ${
                  currentAuthState === sc.id
                    ? 'border-primary bg-primary/5 text-primary font-medium shadow-xs'
                    : 'border-border bg-card hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">{sc.label}</span>
                  {currentAuthState === sc.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{sc.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Click a fixture to inject into Search Domain & trigger state machine:
            </p>
            {searchFixtures.map((fx) => (
              <button
                key={fx.domain}
                onClick={() => {
                  onTestSearchFixture(fx.domain);
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition-all flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-primary">{fx.domain}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{fx.desc}</span>
              </button>
            ))}

            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onResetDB();
                  resetMasterDatabase();
                }}
                className="w-full gap-2 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reset Master DB to Seed State</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-border p-3 bg-muted/20 text-[10px] text-muted-foreground text-center">
        Conforms strictly to §12 QA Checklist
      </div>
    </div>
  );
};
