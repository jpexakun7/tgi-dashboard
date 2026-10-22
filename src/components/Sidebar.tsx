import React from 'react';
import {
  LayoutDashboard,
  Users,
  WalletCards,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Percent,
  BarChart3,
  Settings,
  ChevronRight,
  Shield,
  HelpCircle,
  LogOut,
  Target,
  Receipt,
  History,
  UserCheck,
  Boxes,
  Award,
} from 'lucide-react';
import { GoogleAdminUser, DashboardModule } from '../types';

export type ActiveTab =
  | 'overview'
  | 'employees'
  | 'payroll'
  | 'attendance'
  | 'leave'
  | 'overtime'
  | 'reimbursement'
  | 'assets'
  | 'performance_review'
  | 'tax_bpjs'
  | 'kpi_performance'
  | 'reports'
  | 'audit_logs'
  | 'roles_management'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingLeavesCount: number;
  pendingOvertimeCount: number;
  pendingReimbursementsCount?: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  adminUser?: GoogleAdminUser | null;
  onLogout?: () => void;
  allowedModules?: DashboardModule[];
  onOpenEmployeePortal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingLeavesCount,
  pendingOvertimeCount,
  pendingReimbursementsCount = 0,
  isOpen,
  setIsOpen,
  adminUser,
  onLogout,
  allowedModules,
  onOpenEmployeePortal,
}) => {
  const menuItems = [
    {
      id: 'overview' as ActiveTab,
      label: 'Ringkasan Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'employees' as ActiveTab,
      label: 'Data Karyawan',
      icon: Users,
      badge: null,
    },
    {
      id: 'payroll' as ActiveTab,
      label: 'Penggajian (Payroll)',
      icon: WalletCards,
      badge: 'Aktif',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'attendance' as ActiveTab,
      label: 'Presensi & Absensi',
      icon: CalendarCheck2,
      badge: null,
    },
    {
      id: 'leave' as ActiveTab,
      label: 'Cuti & Izin',
      icon: CalendarDays,
      badge: pendingLeavesCount > 0 ? `${pendingLeavesCount}` : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'overtime' as ActiveTab,
      label: 'Klaim Lembur',
      icon: Clock,
      badge: pendingOvertimeCount > 0 ? `${pendingOvertimeCount}` : null,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'reimbursement' as ActiveTab,
      label: 'Klaim Reimbursement',
      icon: Receipt,
      badge: pendingReimbursementsCount > 0 ? `${pendingReimbursementsCount}` : null,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'assets' as ActiveTab,
      label: 'Manajemen Aset',
      icon: Boxes,
      badge: 'Inventaris',
      badgeColor: 'bg-teal-100 text-teal-800',
    },
    {
      id: 'tax_bpjs' as ActiveTab,
      label: 'Pajak PPh 21 & BPJS',
      icon: Percent,
      badge: 'TER 2026',
      badgeColor: 'bg-purple-100 text-purple-800',
    },
    {
      id: 'performance_review' as ActiveTab,
      label: 'Performance Review',
      icon: Award,
      badge: 'KPI & Bonus',
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'kpi_performance' as ActiveTab,
      label: 'Kinerja KPI Departemen',
      icon: Target,
      badge: 'Analisis',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Laporan & Rekap',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'audit_logs' as ActiveTab,
      label: 'Log Aktivitas Sistem',
      icon: History,
      badge: 'Audit',
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'roles_management' as ActiveTab,
      label: 'Hak Akses & Role',
      icon: Shield,
      badge: 'RBAC',
      badgeColor: 'bg-purple-100 text-purple-800',
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Setting PIN & Sistem',
      icon: Settings,
      badge: 'PIN Akun',
      badgeColor: 'bg-purple-100 text-purple-800',
      path: 'settings',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-emerald-500/20">
            TGI
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
              TGI Dashboard
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">Platform Penggajian & HR</span>
          </div>
        </div>

        {/* Company Quick Badge */}
        <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-slate-200 truncate">PT Tas Grosir Import</p>
            <p className="text-[10px] text-slate-400">Periode: Okt 2026 (Cut-off 25)</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {onOpenEmployeePortal && (
            <div className="pb-2">
              <button
                type="button"
                onClick={() => {
                  onOpenEmployeePortal();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-600/25 via-teal-600/20 to-indigo-600/25 hover:from-emerald-600/40 hover:to-teal-600/35 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all group cursor-pointer shadow-xs"
                title="Buka Portal Layanan Mandiri Karyawan (Self-Service)"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Portal Karyawan</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
                  Self-Service
                </span>
              </button>
            </div>
          )}

          {/* Quick Nav: Pengaturan Sistem (RBAC & Config) */}
          <div className="pb-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all group cursor-pointer shadow-xs ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-md shadow-indigo-950/50'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-white hover:border-indigo-500/50'
              }`}
              title="Buka Pengaturan Sistem, Konfigurasi Payroll & Hak Akses Role RBAC"
            >
              <div className="flex items-center gap-2">
                <Settings
                  className={`w-4 h-4 ${
                    activeTab === 'settings'
                      ? 'text-white'
                      : 'text-indigo-400 group-hover:rotate-45'
                  } transition-transform duration-300`}
                />
                <span>Pengaturan Sistem</span>
              </div>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider ${
                  activeTab === 'settings'
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                }`}
              >
                RBAC & Config
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Menu Utama
            </p>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 border border-slate-700">
              {adminUser?.role === 'admin' ? 'Super Admin' : (adminUser?.role || 'Admin')}
            </span>
          </div>
          {(() => {
            const userRole = adminUser?.role === 'admin' ? 'Super Admin' : (adminUser?.role || 'Super Admin');
            const visibleMenuItems = menuItems.filter((item) => {
              if (userRole === 'Super Admin') return true;
              if (!allowedModules) return true;
              return allowedModules.includes(item.id);
            });

            return visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'
                  }`}
                />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md uppercase shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0" />}
              </button>
              );
            });
          })()}
        </div>

        {/* Help / Support box */}
        <div className="px-4 py-3 mx-3 my-2 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>Pusat Bantuan TGI</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Panduan TER PPh 21, BPJS, & ekspor bank BCA/Mandiri format.
          </p>
        </div>

        {/* Admin User Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="relative shrink-0">
              <img
                src={adminUser?.picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80"}
                alt="Google Admin"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/50"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {adminUser?.name || 'Administrator Utama'}
              </p>
              <p className="text-[10px] text-emerald-400 truncate font-mono">
                {adminUser?.email || 'jpexakun7@gmail.com'}
              </p>
              <span className="inline-block text-[9px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 truncate mt-0.5">
                {adminUser?.role === 'admin' ? 'Super Admin' : (adminUser?.role || 'Admin')}
              </span>
            </div>
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setIsOpen(false);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'settings'
                    ? 'text-emerald-400 bg-emerald-950/80 ring-1 ring-emerald-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
                title="Buka Pengaturan Sistem (RBAC & Konfigurasi)"
              >
                <Settings className="w-4 h-4" />
              </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Keluar (Logout Google Admin)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
