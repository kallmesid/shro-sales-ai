import React from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Building2, 
  BarChart3, 
  ShieldAlert, 
  PlusCircle,
  Clock
} from 'lucide-react';
import { User } from '../types.ts';
import { ShroLogo } from './ShroLogo.tsx';

export type NavTab = 'dashboard' | 'cost_sheets' | 'accounts' | 'reports' | 'admin';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  user: User;
  onNewCostSheet: () => void;
  pendingApprovalsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  user,
  onNewCostSheet,
  pendingApprovalsCount,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'cost_sheets' as NavTab,
      label: 'All Cost Sheets',
      icon: FileSpreadsheet,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: 'accounts' as NavTab,
      label: 'Accounts',
      icon: Building2,
      badge: null,
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports',
      icon: BarChart3,
      badge: null,
    },
  ];

  if (user.access_level === 'Admin') {
    navItems.push({
      id: 'admin' as NavTab,
      label: 'Admin Tools',
      icon: ShieldAlert,
      badge: null,
    });
  }

  return (
    <aside id="app-sidebar" className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="h-20 px-5 flex items-center border-b border-slate-800 bg-slate-950/40">
        <div className="bg-white/95 rounded-lg px-2.5 py-1.5 shadow-sm">
          <ShroLogo className="h-8 w-auto" variant="color" />
        </div>
      </div>

      {/* New Cost Sheet Primary CTA */}
      <div className="p-4">
        <button
          id="sidebar-new-cost-sheet-button"
          onClick={onNewCostSheet}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Cost Sheet</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 6 Sequential Stages Reference Guide */}
      <div className="p-4 mx-3 mb-4 rounded-xl bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400">
        <p className="font-semibold text-slate-300 text-[11px] mb-2 uppercase tracking-wider">Sequential Workflow</p>
        <ol className="space-y-1 text-[10px] text-slate-400">
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">1</span> Finance 1</li>
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">2</span> Presales</li>
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">3</span> Management</li>
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">4</span> Operations</li>
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">5</span> Logistics</li>
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">6</span> Finance 2</li>
        </ol>
      </div>

      {/* User Info footer */}
      <div className="p-4 border-t border-slate-800 text-xs">
        <p className="text-slate-400 text-[11px]">Logged in as:</p>
        <p className="font-semibold text-slate-200 truncate">{user.name}</p>
        <span className="text-[10px] text-slate-500 capitalize">{user.role} • {user.access_level}</span>
      </div>
    </aside>
  );
};
