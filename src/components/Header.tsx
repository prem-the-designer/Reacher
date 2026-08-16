import React from 'react';
import { User } from '@/types';
import { Moon, Sun, LogOut } from 'lucide-react';
import { Button } from './ui/Button';

interface HeaderProps {
  currentUser: User | null;
  onSignOut: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSignOut,
  darkMode,
  onToggleDarkMode
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-xs">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Identity wordmark */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg tracking-tight text-foreground">
            Reacher
          </span>
          {currentUser && currentUser.role === 'analyst' && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border border-border">
              Analyst Portal
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme mode"
          >
            {darkMode ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </Button>

          {/* Authenticated User info & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="hidden sm:flex flex-col text-right leading-none">
                <span className="text-xs font-medium text-foreground">{currentUser.name}</span>
                <span className="text-[10px] text-muted-foreground">{currentUser.email}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onSignOut}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
