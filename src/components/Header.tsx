import React, { useState, useEffect, useMemo } from 'react';
import {
  Menu,
  Bell,
  Search,
  PlusCircle,
  Calculator,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
  LogOut,
  Shield,
  ShieldCheck,
  Lock,
  KeyRound,
  ChevronDown,
  User,
  Users,
  Check,
  UserCheck,
  Settings,
  Database,
} from 'lucide-react';
import {
  CompanyConfig,
  LeaveRequest,
  OvertimeRequest,
  GoogleAdminUser,
  GoogleAdminAccount,
  Employee,
  AppNotification,
} from '../types';
import { NotificationCenterModal } from './NotificationCenterModal';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallPrompt';

interface HeaderProps {
  onOpenSidebar: () => void;
  companyConfig: CompanyConfig;
  onOpenAddEmployee: () => void;
  onOpenRunPayroll: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab?: string;
  pendingLeaves: LeaveRequest[];
  pendingOvertimes: OvertimeRequest[];
  onNavigateTab: (tab: any) => void;
  adminUser?: GoogleAdminUser | null;
  onLogout?: () => void;
  onSwitchAdminUser?: (account: GoogleAdminAccount) => void;
  onSwitchAdminUserRole?: (roleName: string) => void;
  dashboardMode?: 'admin' | 'employee';
  onToggleDashboardMode?: () => void;
  currentEmployeeName?: string;
  currentEmployee?: Employee | null;
  notifications?: AppNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
  onNavigateNotificationAction?: (actionUrl: string, metadata?: any) => void;
  onQuickBroadcastReminder?: () => void;
  supabaseStatus?: { isConnected: boolean; isTablesCreated: boolean; statusText: string };
  onOpenSupabaseModal?: () => void;
  isAdminUnlocked?: boolean;
  onRequestAdminLogin?: () => void;
  onLockAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenSidebar,
  companyConfig,
  onOpenAddEmployee,
  onOpenRunPayroll,
  searchQuery,
  setSearchQuery,
  pendingLeaves,
  pendingOvertimes,
  onNavigateTab,
  adminUser,
  onLogout,
  onSwitchAdminUser,
  onSwitchAdminUserRole,
  dashboardMode = 'admin',
  onToggleDashboardMode,
  currentEmployeeName,
  currentEmployee,
  notifications = [],
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onNavigateNotificationAction,
  onQuickBroadcastReminder,
  supabaseStatus,
  onOpenSupabaseModal,
  isAdminUnlocked = false,
  onRequestAdminLogin,
  onLockAdmin,
}) => {
  const [showNotificationSlideOver, setShowNotificationSlideOver] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  
  // Compute notifications relevant to current view mode
  const relevantNotifications = useMemo(() => {
    return notifications.filter((n: AppNotification) => {
      if (dashboardMode === 'admin') {
        return n.recipientType === 'admin' || n.recipientType === 'all';
      } else {
        if (!currentEmployee) return false;
        return (
          (n.recipientType === 'employee' && n.recipientEmployeeId === currentEmployee.id) ||
          n.recipientType === 'all'
        );
      }
    });
  }, [notifications, dashboardMode, currentEmployee]);

  const unreadNotificationsCount = useMemo(() => {
    return relevantNotifications.filter((n: AppNotification) => !n.isRead).length;
  }, [relevantNotifications]);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(currentTime);

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <OfflineIndicator />
      {/* Main Top Navigation Row */}
      <div className="h-16 px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Hamburger (Admin Mobile) + Company Identity & Cut-off Period */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          {dashboardMode === 'admin' && (
            <button
              onClick={onOpenSidebar}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden cursor-pointer shrink-0"
              title="Buka Menu Navigasi Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Brand / Company identity in header */}
          <div className="flex items-center gap-2 sm:gap-2.5 text-slate-700 min-w-0">
            <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate max-w-[145px] xs:max-w-[190px] sm:max-w-[240px] md:max-w-none">
                {companyConfig.companyName}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 whitespace-nowrap mt-0.5">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Periode: {companyConfig.currentPayrollPeriod}</span>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="hidden sm:inline font-medium text-slate-600">
                  Cut-off tgl {companyConfig.cutOffEndDay}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Real-Time Date & Clock Badge (Wide Desktop Only) */}
        <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 shadow-2xs shrink-0 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="font-medium text-slate-800">{formattedDate}</span>
          <span className="text-slate-300">|</span>
          <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-200/60 tabular-nums">
            {formattedTime} WIB
          </span>
        </div>

        {/* Center Search Input (Admin Desktop XL+ Inline) */}
        {dashboardMode === 'admin' && (
          <div className="flex-1 max-w-xs 2xl:max-w-md mx-2 hidden xl:block min-w-[200px]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari karyawan, NIK, jabatan, atau slip gaji..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>
        )}

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick RBAC Role Switcher & Simulator (Admin Mode) */}
          {dashboardMode === 'admin' && adminUser && onSwitchAdminUserRole && (
            <div className="relative hidden md:block shrink-0">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 whitespace-nowrap"
                title="Simulasi Peran Akses RBAC (Super Admin, HR, Finance, Operations, Auditor)"
              >
                <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="hidden 2xl:inline text-[10px] text-purple-600 font-normal">Peran:</span>
                <span className="font-extrabold truncate max-w-[110px] text-purple-950">
                  {adminUser.role === 'admin' ? 'Super Admin' : adminUser.role}
                </span>
                <ChevronDown className="w-3 h-3 text-purple-400 shrink-0" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Simulasi Akses Peran (RBAC)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Uji coba langsung visibilitas menu sidebar untuk setiap peran
                    </p>
                  </div>

                  <div className="p-1 space-y-0.5">
                    {[
                      {
                        role: 'Super Admin',
                        label: 'Super Admin',
                        desc: 'Akses penuh tanpa batas (15 Modul)',
                        badge: 'Root',
                        badgeColor: 'bg-purple-100 text-purple-800',
                      },
                      {
                        role: 'HR & Payroll Admin',
                        label: 'HR & Payroll Admin (HR)',
                        desc: 'Personalia, Cuti, Lembur & Presensi',
                        badge: 'HR',
                        badgeColor: 'bg-blue-100 text-blue-800',
                      },
                      {
                        role: 'Finance & Reimbursement',
                        label: 'Finance & Reimbursement (Finance)',
                        desc: 'Payroll, Pajak TER, Kasbon & Aset',
                        badge: 'Finance',
                        badgeColor: 'bg-emerald-100 text-emerald-800',
                      },
                      {
                        role: 'Operations Manager',
                        label: 'Operations Manager (Operations)',
                        desc: 'Operasional Gudang, Presensi & KPI',
                        badge: 'Ops',
                        badgeColor: 'bg-amber-100 text-amber-800',
                      },
                      {
                        role: 'Viewer / Auditor',
                        label: 'Viewer / Auditor (Auditor)',
                        desc: 'Read-only Laporan, KPI & Audit Trail',
                        badge: 'Audit',
                        badgeColor: 'bg-slate-100 text-slate-800',
                      },
                    ].map((item) => {
                      const isCurrent =
                        (adminUser.role === 'admin' ? 'Super Admin' : adminUser.role) === item.role;
                      return (
                        <button
                          key={item.role}
                          type="button"
                          onClick={() => {
                            onSwitchAdminUserRole(item.role);
                            setShowRoleDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer text-xs ${
                            isCurrent
                              ? 'bg-purple-50 text-purple-900 font-bold border border-purple-200'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold truncate">{item.label}</span>
                              {isCurrent && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                          </div>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3 pt-2 pb-1 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab('settings');
                        setShowRoleDropdown(false);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Atur Hak Akses di Pengaturan (RBAC) →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PWA Install App Button (Mobile & Desktop) */}
          <PWAInstallButton />

          {/* Mode Tampilan Switcher (Panel Admin vs Portal Karyawan) */}
          {dashboardMode === 'employee' ? (
            <button
              onClick={() => {
                if (isAdminUnlocked) {
                  onToggleDashboardMode?.();
                } else if (onRequestAdminLogin) {
                  onRequestAdminLogin();
                } else {
                  onToggleDashboardMode?.();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 hover:border-purple-300 shrink-0 whitespace-nowrap"
              title="Masuk ke Mode HR & Payroll Admin (Perlu PIN Keamanan)"
            >
              <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="hidden sm:inline">Panel Admin</span>
              <span className="text-[10px] text-purple-700 bg-purple-200/60 px-1.5 py-0.2 rounded font-semibold">
                PIN
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleDashboardMode}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 whitespace-nowrap"
                title="Beralih ke Portal Layanan Mandiri Karyawan"
              >
                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="hidden md:inline">Portal Karyawan</span>
                <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded font-semibold">
                  Buka
                </span>
              </button>

              {onLockAdmin && (
                <button
                  onClick={onLockAdmin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shrink-0 whitespace-nowrap"
                  title="Kunci Akses Admin dan Kembali ke Portal Karyawan"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600 shrink-0" />
                  <span className="hidden 2xl:inline text-[11px]">Kunci</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Button: Hitung Payroll (Admin Only) */}
          {dashboardMode === 'admin' && (
            <button
              onClick={onOpenRunPayroll}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
              title="Hitung & Proses Payroll Bulan Ini"
            >
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">Proses Payroll</span>
            </button>
          )}

          {/* Quick Button: Tambah Karyawan (Admin Only) */}
          {dashboardMode === 'admin' && (
            <button
              onClick={onOpenAddEmployee}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs shadow-emerald-600/30 shrink-0 whitespace-nowrap"
              title="Tambah Data Karyawan Baru"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">+ Karyawan</span>
            </button>
          )}

          {/* Quick Button: Supabase Cloud Status */}
          {onOpenSupabaseModal && (
            <button
              onClick={onOpenSupabaseModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap ${
                supabaseStatus?.isTablesCreated
                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                  : supabaseStatus?.isConnected
                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
              }`}
              title={supabaseStatus?.statusText || 'Status Supabase Cloud Database'}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    supabaseStatus?.isTablesCreated ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    supabaseStatus?.isTablesCreated ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden 2xl:inline">Supabase</span>
            </button>
          )}

          {/* Quick Button: Pengaturan Sistem & Role (Admin Only) */}
          {dashboardMode === 'admin' && (
            <button
              onClick={() => onNavigateTab('settings')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer border shrink-0 whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs shadow-indigo-600/30'
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
              }`}
              title="Pengaturan Sistem & Hak Akses Role RBAC"
            >
              <Settings className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`} />
              <span className="hidden 2xl:inline">Pengaturan</span>
            </button>
          )}

          {/* Notification Bell (Admin & Portal Karyawan) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowNotificationSlideOver(true)}
              className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl relative cursor-pointer transition-colors border border-transparent hover:border-slate-200"
              title="Buka Pusat Notifikasi & Pengingat Kinerja"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

        {/* Mode Karyawan Profile Dropdown */}
        {dashboardMode === 'employee' && currentEmployee ? (
          <div className="relative pl-1 sm:pl-2 border-l border-slate-200">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              title="Profil Akun Karyawan"
            >
              <div className="relative">
                <img
                  src={
                    currentEmployee.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                  }
                  alt={currentEmployee.fullName}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-emerald-500/40"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                  {currentEmployee.fullName}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <UserCheck className="w-2.5 h-2.5" />
                  <span>Portal Karyawan</span>
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95">
                {/* Employee Account Card */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={
                        currentEmployee.avatarUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                      }
                      alt={currentEmployee.fullName}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/50"
                    />
                    <div className="overflow-hidden flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {currentEmployee.fullName}
                      </p>
                      <p className="text-[11px] font-mono text-emerald-700 truncate font-semibold">
                        {currentEmployee.googleEmail || currentEmployee.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-200/40 text-slate-600">
                    <span>
                      NIK: <strong className="font-mono">{currentEmployee.nik}</strong>
                    </span>
                    <span className="font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      {currentEmployee.role}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                  {onToggleDashboardMode && (
                    <button
                      onClick={() => {
                        onToggleDashboardMode();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100"
                    >
                      <span className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span>Beralih ke Panel Admin</span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  )}

                  {onLogout && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : adminUser ? (() => {
          const roleDisplay = adminUser.role === 'admin' ? 'Super Admin' : adminUser.role;
          const otherAdmins = (companyConfig.allowedGoogleAdmins || []).filter(
            (a) => a.email.toLowerCase() !== adminUser.email.toLowerCase() && a.status === 'active'
          );

          return (
            <div className="relative pl-1 sm:pl-2 border-l border-slate-200">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                title="Akun Google Admin"
              >
                <div className="relative">
                  <img
                    src={adminUser.picture}
                    alt={adminUser.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-emerald-500/40"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                    {adminUser.email}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    <span>{roleDisplay}</span>
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95">
                  {/* Current Account Card */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={adminUser.picture}
                        alt={adminUser.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/50"
                      />
                      <div className="overflow-hidden flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {adminUser.name}
                        </p>
                        <p className="text-[11px] font-mono text-emerald-700 truncate font-semibold">
                          {adminUser.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">Peran Otoritas:</span>
                      <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {roleDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Switch to Other Google Admin Accounts */}
                  {otherAdmins.length > 0 && onSwitchAdminUser && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between px-1 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>Ganti Akun Pengelola:</span>
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          {otherAdmins.length} Akun Lain
                        </span>
                      </div>

                      <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                        {otherAdmins.map((other) => (
                          <button
                            key={other.id}
                            type="button"
                            onClick={() => {
                              onSwitchAdminUser(other);
                              setShowUserMenu(false);
                            }}
                            className="w-full flex items-center justify-between p-1.5 hover:bg-emerald-50/70 rounded-lg transition-colors cursor-pointer text-left border border-transparent hover:border-emerald-200 group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={other.avatarUrl}
                                alt={other.name}
                                className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                              />
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 truncate group-hover:text-emerald-800">
                                  {other.name}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 truncate">
                                  {other.email}
                                </div>
                              </div>
                            </div>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0 ml-1">
                              {other.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Menu Actions */}
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    {onToggleDashboardMode && (
                      <button
                        onClick={() => {
                          onToggleDashboardMode();
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left border ${
                          dashboardMode === 'employee'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {dashboardMode === 'employee' ? (
                            <Shield className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                          )}
                          <span>
                            {dashboardMode === 'employee'
                              ? 'Kembali ke Panel Admin'
                              : 'Buka Portal Karyawan (Self-Service)'}
                          </span>
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onNavigateTab('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-left font-medium"
                    >
                      <Building className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pengaturan Perusahaan & Admin</span>
                    </button>

                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar (Logout Google Admin)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })() : null}
        </div>
      </div>

      {/* Responsive Sub-Bar for Admin Mode (<1280px) so Search Input & Actions Never Crowd the Top Bar */}
      {dashboardMode === 'admin' && (
        <div className="xl:hidden px-3 sm:px-5 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama karyawan, NIK, atau divisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 font-medium whitespace-nowrap">
              <Clock className="w-3 h-3 text-emerald-600" />
              <span className="font-mono font-bold text-emerald-700 tabular-nums">{formattedTime} WIB</span>
            </span>
            <button
              type="button"
              onClick={onOpenRunPayroll}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl whitespace-nowrap cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Payroll</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Mobile Info Strip for Employee Portal (<640px) */}
      {dashboardMode === 'employee' && (
        <div className="sm:hidden px-3 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-600">
          <span className="truncate font-medium">
            Cut-off Payroll: <strong className="text-slate-800">Tgl {companyConfig.cutOffEndDay}</strong>
          </span>
          <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 shrink-0 tabular-nums">
            <Clock className="w-3 h-3 text-emerald-600" />
            {formattedTime} WIB
          </span>
        </div>
      )}

      {/* Slide-over Modal Pusat Notifikasi & Pengingat Kinerja */}
      <NotificationCenterModal
        isOpen={showNotificationSlideOver}
        onClose={() => setShowNotificationSlideOver(false)}
        notifications={notifications}
        recipientMode={dashboardMode}
        currentEmployee={currentEmployee}
        onMarkAsRead={(id) => onMarkNotificationAsRead?.(id)}
        onMarkAllAsRead={() => onMarkAllNotificationsAsRead?.()}
        onDeleteNotification={(id) => onDeleteNotification?.(id)}
        onClearAll={() => onClearAllNotifications?.()}
        onNavigateAction={(actionUrl, metadata) => {
          if (onNavigateNotificationAction) {
            onNavigateNotificationAction(actionUrl, metadata);
          } else {
            if (actionUrl === 'performance_review') onNavigateTab('performance_review');
            if (actionUrl === 'payroll') onNavigateTab('payroll');
          }
        }}
        onQuickBroadcastReminder={onQuickBroadcastReminder}
      />
    </header>
  );
};
