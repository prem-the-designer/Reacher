import React from 'react';
import { User } from '@/types';
import { Moon, Sun, LogOut, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

interface HeaderProps {
  currentUser: User | null;
  onSignOut: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenQAPanel?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSignOut,
  darkMode,
  onToggleDarkMode,
  onOpenQAPanel
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-xs">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Identity wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-xs select-none">
            RV
          </div>
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
          {/* QA Toolbar trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenQAPanel}
            className="gap-1.5 text-xs border-dashed text-muted-foreground hover:text-foreground"
            title="Open State Machine & QA Controller"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden md:inline">QA State Inspector</span>
          </Button>

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
