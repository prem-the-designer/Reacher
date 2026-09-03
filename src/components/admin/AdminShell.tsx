import React, { useState, useEffect } from 'react';
import type { User, AdminModule, Notification } from '@/types';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { Button } from '@/components/ui/Button';
import { Menu, X, AlertCircle } from 'lucide-react';
import { getNotifications, getSettings } from '@/services/adminService';

// ── Module pages (lazy imports replaced with direct imports for simplicity) ──

import { DashboardModule } from './DashboardModule';
import { UserActivityModule } from './UserActivityModule';
import { ImportExportModule } from './ImportExportModule';
import { UsersModule } from './UsersModule';
import { LogsModule } from './LogsModule';
import { SettingsModule } from './SettingsModule';
import { SearchDomain } from '@/components/SearchDomain';

interface AdminShellProps {
  currentUser: User;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSignOut: () => void;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  currentUser,
  darkMode,
  onToggleDarkMode,
  onSignOut,
}) => {
  const [activeModule, setActiveModule] = useState<AdminModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isCriticalCredit, setIsCriticalCredit] = useState(false);

  // Responsive: collapse at 1024px, drawer below 768px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(false); // drawer handles this
      } else if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load notifications and credit state
  useEffect(() => {
    const fetchGlobalState = async () => {
      try {
        const notifs = await getNotifications();
        setNotifications(notifs);
        
        const settings = await getSettings();
        const creds = settings.credits;
        if (creds?.current_credits != null && creds?.critical_threshold != null) {
          setIsCriticalCredit(creds.current_credits <= creds.critical_threshold);
        } else {
          setIsCriticalCredit(false);
        }
      } catch (e) {
        // silently ignore error
      }
    };

    fetchGlobalState();
    window.addEventListener('reload-notifications', fetchGlobalState);
    return () => window.removeEventListener('reload-notifications', fetchGlobalState);
  }, []);

  const handleNavigate = (module: AdminModule) => {
    setActiveModule(module);
    setDrawerOpen(false);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop / tablet sidebar ─────────────────────────────────────── */}
      <div className="hidden md:flex shrink-0">
        <AdminSidebar
          activeModule={activeModule}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
        />
      </div>

      {/* ── Mobile sidebar drawer ────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-foreground/20"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <div className="relative z-10 flex flex-col w-64 h-full">
            <AdminSidebar
              activeModule={activeModule}
              onNavigate={handleNavigate}
              collapsed={false}
            />
          </div>
          {/* Close button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute top-4 left-[17rem] text-foreground z-10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile hamburger */}
        <div className="md:hidden flex items-center h-14 px-4 border-b border-border bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          <span className="ml-3 font-semibold text-sm text-foreground">Reacher Admin</span>
        </div>

        {/* Sticky header */}
        <AdminHeader
          activeModule={activeModule}
          currentUser={currentUser}
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          onSignOut={onSignOut}
          notifications={notifications}
          onNotificationsChange={setNotifications}
          onNavigate={handleNavigate}
        />

        {isCriticalCredit && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive text-sm font-medium px-6 py-3 flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
            <span>Critical Credit Limit</span>
          </div>
        )}

        {/* Module content */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-background">
          <div className="mx-auto max-w-7xl">
            {activeModule === 'dashboard' && (
              <DashboardModule onNavigate={handleNavigate} />
            )}
            {activeModule === 'search' && (
              <SearchDomain key="admin-search" />
            )}
            {activeModule === 'user-activity' && (
              <UserActivityModule />
            )}
            {activeModule === 'import-export' && (
              <ImportExportModule />
            )}
            {activeModule === 'users' && (
              <UsersModule currentUserId={currentUser.id} />
            )}
            {activeModule === 'logs' && (
              <LogsModule />
            )}
            {activeModule === 'settings' && (
              <SettingsModule />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
