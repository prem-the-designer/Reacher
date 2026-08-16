import React from 'react';
import { cn } from '@/lib/utils';
import type { AdminModule } from '@/types';
import {
  LayoutDashboard,
  Search,
  Upload,
  Users,
  ScrollText,
  Settings,
} from 'lucide-react';

interface NavItem {
  module: AdminModule;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { module: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4 shrink-0" /> },
  { module: 'search', label: 'Search Domain', icon: <Search className="h-4 w-4 shrink-0" /> },
  // { module: 'user-activity', label: 'User Activity', icon: <Activity className="h-4 w-4 shrink-0" /> },
  { module: 'import-export', label: 'Import / Export', icon: <Upload className="h-4 w-4 shrink-0" /> },
  { module: 'users', label: 'Users', icon: <Users className="h-4 w-4 shrink-0" /> },
  { module: 'logs', label: 'Logs', icon: <ScrollText className="h-4 w-4 shrink-0" /> },
  { module: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4 shrink-0" /> },
];

interface AdminSidebarProps {
  activeModule: AdminModule;
  onNavigate: (module: AdminModule) => void;
  collapsed?: boolean;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeModule,
  onNavigate,
  collapsed = false,
}) => {
  return (
    <nav
      aria-label="Admin navigation"
      className={cn(
        'flex flex-col h-full bg-card border-r border-border transition-all duration-200',
        collapsed ? 'w-14' : 'w-64'
      )}
    >
      {/* Wordmark */}
      <div className={cn(
        'flex items-center gap-3 h-14 px-4 border-b border-border shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-xs select-none">
          RV
        </div>
        {!collapsed && (
          <span className="font-semibold text-base tracking-tight text-foreground truncate">
            Reacher
          </span>
        )}
      </div>

      {/* Nav items */}
      <ul className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2" role="list">
        {NAV_ITEMS.map(({ module, label, icon }) => {
          const isActive = activeModule === module;
          return (
            <li key={module}>
              <button
                type="button"
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(module)}
                title={collapsed ? label : undefined}
                className={cn(
                  'w-full flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A1A1A1]/80 focus-visible:ring-offset-1',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  collapsed && 'justify-center px-0'
                )}
              >
                {icon}
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
