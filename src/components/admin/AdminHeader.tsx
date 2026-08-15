import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { User, AdminModule, Notification } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Bell, Sun, Moon, LogOut, ChevronDown, User as UserIcon } from 'lucide-react';
import { markNotificationRead, markAllNotificationsRead } from '@/services/adminService';

const MODULE_TITLES: Record<AdminModule, string> = {
  dashboard: 'Dashboard',
  search: 'Search Domain',
  'user-activity': 'User Activity',
  'import-export': 'Import / Export',
  users: 'Users',
  logs: 'Logs',
  settings: 'Settings',
};

const CATEGORY_LABELS: Record<string, string> = {
  new_request: 'New Request',
  bulk_import_completed: 'Import',
  high_request_volume: 'High Volume',
  low_api_credits: 'Low Credits',
  system_alert: 'System',
};

interface AdminHeaderProps {
  activeModule: AdminModule;
  currentUser: User;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSignOut: () => void;
  notifications: Notification[];
  onNotificationsChange: (updated: Notification[]) => void;
  onNavigate: (module: AdminModule) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeModule,
  currentUser,
  darkMode,
  onToggleDarkMode,
  onSignOut,
  notifications,
  onNotificationsChange,
  onNavigate,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    onNotificationsChange(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    onNotificationsChange(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-none px-4 sm:px-6 gap-4">
      {/* Page title */}
      <span className="text-sm font-medium text-muted-foreground truncate">
        {MODULE_TITLES[activeModule]}
      </span>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            id="notif-bell"
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((v) => !v)}
            className="relative"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground tabular-nums px-0.5"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          {/* Notification panel */}
          {notifOpen && (
            <div
              role="dialog"
              aria-label="Notification Center"
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-lg ring-1 ring-border overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'px-4 py-3 transition-colors duration-150',
                        notif.read ? 'bg-card' : 'bg-muted/30'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="secondary" className="text-[10px] py-0">
                              {CATEGORY_LABELS[notif.category] ?? notif.category}
                            </Badge>
                            {!notif.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-label="Unread" />
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground leading-snug">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                          {notif.link_module && (
                            <button
                              type="button"
                              className="mt-1.5 text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline"
                              onClick={() => {
                                if (notif.link_module) onNavigate(notif.link_module);
                                setNotifOpen(false);
                                handleMarkRead(notif.id);
                              }}
                            >
                              {notif.link_label}
                            </button>
                          )}
                        </div>
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(notif.id)}
                            className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Mark as read"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {darkMode ? (
            <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 text-slate-600" aria-hidden="true" />
          )}
        </Button>

        {/* Profile menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            id="profile-menu-btn"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150',
              'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A1A1A1]/80'
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary border border-border">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="hidden sm:flex flex-col text-right leading-none">
              <span className="text-xs font-medium text-foreground">{currentUser.name}</span>
              <span className="text-[10px] text-muted-foreground">{currentUser.email}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </button>

          {profileOpen && (
            <div
              role="menu"
              aria-labelledby="profile-menu-btn"
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-lg ring-1 ring-border overflow-hidden"
            >
              <div className="px-3 py-3 border-b border-border">
                <p className="text-xs font-medium text-foreground truncate">{currentUser.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentUser.email}</p>
                <Badge variant="secondary" className="mt-1.5 text-[10px]">Admin</Badge>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); onSignOut(); }}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1'
                  )}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
