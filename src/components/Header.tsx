import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  X,
  FileText,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import {
  CompanyConfig,
  LeaveRequest,
  OvertimeRequest,
  GoogleAdminUser,
  GoogleAdminAccount,
  Employee,
  AppNotification,
  PayrollRecord,
  CashAdvance,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  isEmployeePartTime,
  getJakartaDateString,
} from '../utils/formatters';
import { NotificationCenterModal } from './NotificationCenterModal';

interface HeaderProps {
  onOpenSidebar: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  companyConfig: CompanyConfig;
  onOpenAddEmployee: () => void;
  onOpenRunPayroll: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  employees?: Employee[];
  payrolls?: PayrollRecord[];
  cashAdvances?: CashAdvance[];
  onOpenPayslip?: (payroll: PayrollRecord) => void;
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

interface UnifiedNotificationItem {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  badgeColor: string;
  targetTab: string;
  actionLabel: string;
  requiresAction: boolean;
  isRead: boolean;
  isAppNotification?: boolean;
  actionUrl?: string;
  metadata?: any;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenSidebar,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
  companyConfig,
  onOpenAddEmployee,
  onOpenRunPayroll,
  searchQuery,
  setSearchQuery,
  employees: propEmployees,
  payrolls: propPayrolls,
  cashAdvances: propCashAdvances,
  onOpenPayslip,
  pendingLeaves = [],
  pendingOvertimes = [],
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
  const [showNotificationPopover, setShowNotificationPopover] = useState(false);
  const [notifFilterTab, setNotifFilterTab] = useState<'all' | 'action'>('all');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Local Search State for Global Search Dropdown
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(searchQuery || '');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    setLocalSearchQuery(searchQuery || '');
  }, [searchQuery]);

  // Persistent read state for dynamically synthesized notifications
  const [readDynamicNotifIds, setReadDynamicNotifIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('tgi_read_dynamic_notif_ids');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const markDynamicNotifAsRead = (notifId: string) => {
    if (!notifId) return;
    setReadDynamicNotifIds((prev) => {
      if (prev.includes(notifId)) return prev;
      const next = [...prev, notifId];
      try {
        localStorage.setItem('tgi_read_dynamic_notif_ids', JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
  };

  // Click-outside refs
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const roleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchDropdownOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setShowNotificationPopover(false);
      }
      if (roleContainerRef.current && !roleContainerRef.current.contains(target)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Defensive data resolution (from props or fallback to localStorage)
  const safeEmployees = useMemo<Employee[]>(() => {
    if (Array.isArray(propEmployees) && propEmployees.length > 0) {
      return propEmployees.filter((e) => Boolean(e && e.id));
    }
    try {
      const raw = localStorage.getItem('tgi_employees_data');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((e: any) => Boolean(e && e.id)) : [];
    } catch {
      return [];
    }
  }, [propEmployees]);

  const safePayrolls = useMemo<PayrollRecord[]>(() => {
    if (Array.isArray(propPayrolls) && propPayrolls.length > 0) {
      return propPayrolls.filter((p) => Boolean(p && p.id));
    }
    try {
      const raw = localStorage.getItem('tgi_payrolls_data');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((p: any) => Boolean(p && p.id)) : [];
    } catch {
      return [];
    }
  }, [propPayrolls]);

  const safeCashAdvances = useMemo<CashAdvance[]>(() => {
    if (Array.isArray(propCashAdvances)) {
      return propCashAdvances.filter((c) => Boolean(c && c.id));
    }
    try {
      const raw = localStorage.getItem('tgi_cash_advances_data');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((c: any) => Boolean(c && c.id)) : [];
    } catch {
      return [];
    }
  }, [propCashAdvances]);

  const employeeMapById = useMemo(() => {
    const map = new Map<string, Employee>();
    safeEmployees.forEach((emp) => {
      if (emp?.id) map.set(emp.id, emp);
    });
    return map;
  }, [safeEmployees]);

  // 1. PENCARIAN GLOBAL REAL-TIME (Minimal 2 karakter)
  const trimmedSearch = (localSearchQuery || '').trim().toLowerCase();
  const isSearchActive = trimmedSearch.length >= 2;

  const matchedEmployees = useMemo(() => {
    if (!isSearchActive) return [];
    return safeEmployees
      .filter((emp) => {
        const name = (emp?.fullName || '').toLowerCase();
        const nik = (emp?.nik || '').toLowerCase();
        const role = (emp?.role || '').toLowerCase();
        const dept = (emp?.department || '').toLowerCase();
        return (
          name.includes(trimmedSearch) ||
          nik.includes(trimmedSearch) ||
          role.includes(trimmedSearch) ||
          dept.includes(trimmedSearch)
        );
      })
      .slice(0, 6);
  }, [isSearchActive, safeEmployees, trimmedSearch]);

  const matchedPayrolls = useMemo(() => {
    if (!isSearchActive) return [];
    const results: Array<{
      id: string;
      employee: Employee;
      payroll?: PayrollRecord;
      period: string;
      takeHomePay: number;
      paymentStatus: string;
      isPartTime: boolean;
    }> = [];
    const seenKeys = new Set<string>();

    // Cari dari data PayrollRecord yang ada
    for (const pay of safePayrolls) {
      if (!pay?.employeeId) continue;
      const emp = employeeMapById.get(pay.employeeId);
      if (!emp) continue;
      const name = (emp?.fullName || '').toLowerCase();
      const nik = (emp?.nik || '').toLowerCase();
      const period = (pay?.period || '').toLowerCase();
      const refNo = (pay?.referenceNumber || '').toLowerCase();
      if (
        name.includes(trimmedSearch) ||
        nik.includes(trimmedSearch) ||
        period.includes(trimmedSearch) ||
        refNo.includes(trimmedSearch)
      ) {
        const key = `${emp.id}__${pay.period}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push({
            id: pay.id,
            employee: emp,
            payroll: pay,
            period: pay.period || companyConfig?.currentPayrollPeriod || '-',
            takeHomePay: Number(pay.takeHomePay) || 0,
            paymentStatus: pay.paymentStatus || 'Draft',
            isPartTime: isEmployeePartTime(emp),
          });
        }
      }
      if (results.length >= 6) break;
    }

    // Jika karyawan cocok tapi belum ada record eksplisit di safePayrolls pada periode aktif, tampilkan item Slip Gaji periode berjalan
    if (results.length < 6) {
      const activePeriod = companyConfig?.currentPayrollPeriod || 'Periode Aktif';
      for (const emp of matchedEmployees) {
        const key = `${emp.id}__${activePeriod}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const pt = isEmployeePartTime(emp);
        results.push({
          id: `virtual-pay-${emp.id}`,
          employee: emp,
          payroll: undefined,
          period: pt ? 'Siklus Mingguan (Flexible Payout)' : activePeriod,
          takeHomePay: Number(emp?.baseSalary) || 0,
          paymentStatus: pt ? 'Part-Time' : 'Periode Aktif',
          isPartTime: pt,
        });
        if (results.length >= 6) break;
      }
    }

    return results;
  }, [isSearchActive, safePayrolls, employeeMapById, trimmedSearch, companyConfig?.currentPayrollPeriod, matchedEmployees]);

  // Compute notifications relevant to current view mode
  const relevantNotifications = useMemo(() => {
    const safeList = Array.isArray(notifications) ? notifications : [];
    return safeList.filter((n: AppNotification) => {
      if (!n) return false;
      if (dashboardMode === 'admin') {
        return n.recipientType === 'admin' || n.recipientType === 'all';
      } else {
        if (!currentEmployee?.id) return false;
        return (
          (n.recipientType === 'employee' && n.recipientEmployeeId === currentEmployee.id) ||
          n.recipientType === 'all'
        );
      }
    });
  }, [notifications, dashboardMode, currentEmployee]);

  // 2. PUSAT NOTIFIKASI REAL-TIME & FLEKSIBEL (Defensif dengan Optional Chaining)
  const unifiedNotifications = useMemo<UnifiedNotificationItem[]>(() => {
    const items: UnifiedNotificationItem[] = [];
    const todayWibStr = getJakartaDateString();
    const todayDate = new Date(`${todayWibStr}T00:00:00+07:00`);

    if (dashboardMode === 'admin') {
      // A. Pengajuan Lembur, Cuti/Izin, atau Kasbon berstatus Pending
      const safePendingLeaves = (Array.isArray(pendingLeaves) ? pendingLeaves : []).filter(
        (l) =>
          l &&
          (l.status === 'Menunggu Persetujuan' ||
            String(l.status || '').toLowerCase() === 'pending')
      );
      if (safePendingLeaves.length > 0) {
        const firstEmp = employeeMapById.get(safePendingLeaves[0]?.employeeId || '');
        const id = `dyn-pending-leaves-${safePendingLeaves.length}-${safePendingLeaves[0]?.id || '0'}`;
        items.push({
          id,
          title: `${safePendingLeaves.length} Pengajuan Cuti / Izin Menunggu Persetujuan`,
          description: firstEmp?.fullName
            ? `Termasuk pengajuan dari ${firstEmp.fullName} (${safePendingLeaves[0]?.type || 'Cuti/Izin'}).`
            : 'Terdapat pengajuan cuti atau izin karyawan berstatus Pending yang memerlukan verifikasi HR.',
          categoryLabel: 'Cuti & Izin (Pending)',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          targetTab: 'leave',
          actionLabel: 'Buka Cuti & Izin',
          requiresAction: true,
          isRead: readDynamicNotifIds.includes(id),
        });
      }

      const safePendingOvertimes = (Array.isArray(pendingOvertimes) ? pendingOvertimes : []).filter(
        (o) =>
          o &&
          ((o as any).status === undefined ||
            (o as any).status === 'Menunggu Persetujuan' ||
            String((o as any).status || '').toLowerCase() === 'pending')
      );
      if (safePendingOvertimes.length > 0) {
        const firstOtEmp = employeeMapById.get(safePendingOvertimes[0]?.employeeId || '');
        const id = `dyn-pending-overtimes-${safePendingOvertimes.length}-${safePendingOvertimes[0]?.id || '0'}`;
        items.push({
          id,
          title: `${safePendingOvertimes.length} Klaim Lembur Menunggu Verifikasi`,
          description: firstOtEmp?.fullName
            ? `Pengajuan lembur ${firstOtEmp.fullName} pada ${safePendingOvertimes[0]?.date || 'periode berjalan'}.`
            : 'Periksa & setujui jam lembur karyawan agar otomatis masuk perhitungan gaji.',
          categoryLabel: 'Lembur (Pending)',
          badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          targetTab: 'overtime',
          actionLabel: 'Buka Klaim Lembur',
          requiresAction: true,
          isRead: readDynamicNotifIds.includes(id),
        });
      }

      const pendingKasbons = safeCashAdvances.filter(
        (c) =>
          c &&
          (String(c.status || '').toLowerCase() === 'pending' ||
            String(c.status || '').toLowerCase() === 'menunggu persetujuan')
      );
      if (pendingKasbons.length > 0) {
        const firstKasbon = pendingKasbons[0];
        const id = `dyn-pending-kasbon-${pendingKasbons.length}-${firstKasbon?.id || '0'}`;
        items.push({
          id,
          title: `${pendingKasbons.length} Pengajuan Kasbon Karyawan Pending`,
          description: `${firstKasbon?.employeeName || 'Karyawan'} mengajukan kasbon sebesar ${formatRupiah(
            Number(firstKasbon?.amount) || 0
          )}.`,
          categoryLabel: 'Kasbon (Pending)',
          badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
          targetTab: 'cash_advance',
          actionLabel: 'Buka Modul Kasbon',
          requiresAction: true,
          isRead: readDynamicNotifIds.includes(id),
        });
      }

      // B. Peringatan Kontrak / Probation Karyawan yang Sisa <= 30 Hari
      for (const emp of safeEmployees) {
        if (!emp || emp.isActive === false) continue;
        const endDateStr = (
          emp?.contractEndDate ||
          emp?.contract_end_date ||
          emp?.probationEndDate ||
          emp?.probation_end_date ||
          ''
        )
          .toString()
          .trim()
          .slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) continue;
        const endDate = new Date(`${endDateStr}T00:00:00+07:00`);
        if (isNaN(endDate.getTime()) || isNaN(todayDate.getTime())) continue;
        const diffDays = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= -14) {
          const isProbation =
            String(emp?.employmentStatus || '').toLowerCase().includes('probation') ||
            Boolean(emp?.probationEndDate || emp?.probation_end_date);
          const id = `dyn-contract-exp-${emp.id}-${endDateStr}`;
          const statusLabel =
            diffDays < 0
              ? `Telah melewati jatuh tempo ${Math.abs(diffDays)} hari lalu (${formatIndoDate(endDateStr)})`
              : diffDays === 0
              ? `Berakhir HARI INI (${formatIndoDate(endDateStr)})`
              : `Tersisa ${diffDays} hari lagi (Berakhir ${formatIndoDate(endDateStr)})`;
          items.push({
            id,
            title: `Peringatan ${isProbation ? 'Probation' : 'Kontrak PKWT'}: ${emp.fullName}`,
            description: `${emp.nik || '-'} • ${emp.role || emp.department || '-'} — ${statusLabel}.`,
            categoryLabel: diffDays <= 7 ? 'Kontrak Segera Habis' : 'Evaluasi Kontrak ≤30 Hari',
            badgeColor:
              diffDays <= 7
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : 'bg-amber-100 text-amber-800 border-amber-300',
            targetTab: 'employees',
            actionLabel: 'Tinjau Data Karyawan',
            requiresAction: true,
            isRead: readDynamicNotifIds.includes(id),
          });
        }
      }

      // C. Pengingat Jadwal Payroll Dinamis (Cut-Off H-3 & Jadwal Pencairan Fleksibel / Manual Tanpa Peringatan Terlambat)
      const cutOffDay = Number(companyConfig?.cutOffEndDay) || 25;
      const currentDayOfMonth = Number(todayWibStr.split('-')[2]) || new Date().getDate();
      const daysUntilCutoff = cutOffDay - currentDayOfMonth;

      if (daysUntilCutoff >= 0 && daysUntilCutoff <= 3) {
        const id = `dyn-cutoff-reminder-${todayWibStr.slice(0, 7)}-${daysUntilCutoff}`;
        items.push({
          id,
          title:
            daysUntilCutoff === 0
              ? `Hari Ini Tanggal Cut-Off Absensi (Tgl ${cutOffDay})!`
              : `H-${daysUntilCutoff} Menuju Cut-Off Absensi (Tgl ${cutOffDay})`,
          description: `Pastikan seluruh presensi, izin/cuti, dan lembur periode ${
            companyConfig?.currentPayrollPeriod || 'berjalan'
          } telah lengkap sebelum penutupan siklus tanggal ${cutOffDay}.`,
          categoryLabel: 'Pengingat Cut-Off H-3',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
          targetTab: 'attendance',
          actionLabel: 'Cek Presensi & Cut-Off',
          requiresAction: true,
          isRead: readDynamicNotifIds.includes(id),
        });
      }

      // Jadwal Pencairan Gaji Bulanan (Mengikuti mode fleksibel / tanggal manual tanpa warning terlambat)
      const activePeriod = companyConfig?.currentPayrollPeriod || '';
      const periodPayoutSetting =
        companyConfig?.periodPayoutDates?.[activePeriod] ||
        (companyConfig?.payrollPayoutMode === 'flexible'
          ? 'FLEKSIBEL'
          : companyConfig?.manualPayrollPayoutDate || '');
      const isFlexibleMode =
        periodPayoutSetting === 'FLEKSIBEL' ||
        (companyConfig?.payrollPayoutMode === 'flexible' && !periodPayoutSetting);
      const hasManualDate =
        Boolean(periodPayoutSetting) &&
        periodPayoutSetting !== 'FLEKSIBEL' &&
        /^\d{4}-\d{2}-\d{2}$/.test(periodPayoutSetting);

      if (isFlexibleMode) {
        const id = `dyn-payout-schedule-flex-${activePeriod}`;
        items.push({
          id,
          title: `Jadwal Gaji ${activePeriod}: Mode Fleksibel`,
          description: `Cut-off absensi tetap Tgl ${cutOffDay}. Pencairan gaji mengikuti jadwal fleksibel Admin tanpa batas tanggal tetap / peringatan keterlambatan.`,
          categoryLabel: 'Jadwal Payroll Fleksibel',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          targetTab: 'payroll',
          actionLabel: 'Buka Penggajian',
          requiresAction: false,
          isRead: readDynamicNotifIds.includes(id),
        });
      } else if (hasManualDate) {
        const manualDateObj = new Date(`${periodPayoutSetting}T00:00:00+07:00`);
        const diffPayoutDays = !isNaN(manualDateObj.getTime())
          ? Math.ceil((manualDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
          : 99;
        const isNearPayout = diffPayoutDays >= 0 && diffPayoutDays <= 3;
        const id = `dyn-payout-schedule-manual-${activePeriod}-${periodPayoutSetting}`;
        items.push({
          id,
          title: isNearPayout
            ? diffPayoutDays === 0
              ? `Hari Ini Jadwal Rencana Pencairan Gaji (${formatIndoDate(periodPayoutSetting)})`
              : `H-${diffPayoutDays} Rencana Pencairan Gaji (${formatIndoDate(periodPayoutSetting)})`
            : `Jadwal Pencairan Gaji Manual: ${formatIndoDate(periodPayoutSetting)}`,
          description: `Tanggal pencairan gaji periode ${activePeriod} diatur manual ke ${formatIndoDate(
            periodPayoutSetting
          )} (dapat disesuaikan kapan saja secara fleksibel).`,
          categoryLabel: 'Jadwal Pencairan Manual',
          badgeColor: isNearPayout
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
            : 'bg-teal-50 text-teal-800 border-teal-200',
          targetTab: 'payroll',
          actionLabel: 'Buka Penggajian',
          requiresAction: isNearPayout,
          isRead: readDynamicNotifIds.includes(id),
        });
      } else {
        const defaultPayday = Number(companyConfig?.payrollDisbursementDay) || 28;
        const id = `dyn-payout-schedule-default-${activePeriod}-${defaultPayday}`;
        items.push({
          id,
          title: `Jadwal Payroll ${activePeriod} (Cut-Off Tgl ${cutOffDay})`,
          description: `Rencana pencairan default Tgl ${defaultPayday} ${activePeriod}. Anda dapat mengubah tanggal gajian secara manual atau fleksibel di menu Penggajian.`,
          categoryLabel: 'Info Siklus Payroll',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
          targetTab: 'payroll',
          actionLabel: 'Atur Jadwal Cair',
          requiresAction: false,
          isRead: readDynamicNotifIds.includes(id),
        });
      }
    }

    // D. Tambahkan notifikasi dari state AppNotification
    for (const n of relevantNotifications) {
      if (!n?.id) continue;
      const targetTab =
        n.actionUrl === 'performance_review'
          ? 'performance_review'
          : n.actionUrl === 'payroll'
          ? 'payroll'
          : n.actionUrl || 'overview';
      items.push({
        id: n.id,
        title: n.title || 'Notifikasi Sistem',
        description: n.message || '',
        categoryLabel: n.category || 'Sistem',
        badgeColor:
          n.priority === 'urgent' || n.priority === 'high'
            ? 'bg-rose-100 text-rose-800 border-rose-300'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200',
        targetTab,
        actionLabel: n.actionLabel || 'Lihat Detail',
        requiresAction: Boolean(!n.isRead || n.priority === 'urgent' || n.priority === 'high'),
        isRead: Boolean(n.isRead),
        isAppNotification: true,
        actionUrl: n.actionUrl,
        metadata: n.metadata,
      });
    }

    return items;
  }, [
    dashboardMode,
    pendingLeaves,
    pendingOvertimes,
    safeCashAdvances,
    safeEmployees,
    employeeMapById,
    companyConfig,
    relevantNotifications,
    readDynamicNotifIds,
  ]);

  const unreadOrActionNotificationsCount = useMemo(() => {
    return unifiedNotifications.filter((item) => !item.isRead).length;
  }, [unifiedNotifications]);

  const actionNeededCount = useMemo(() => {
    return unifiedNotifications.filter((item) => item.requiresAction).length;
  }, [unifiedNotifications]);

  const filteredPopoverNotifications = useMemo(() => {
    if (notifFilterTab === 'action') {
      return unifiedNotifications.filter((item) => item.requiresAction);
    }
    return unifiedNotifications;
  }, [unifiedNotifications, notifFilterTab]);

  const handleMarkAllUnifiedAsRead = () => {
    const allIds = unifiedNotifications.map((item) => item.id);
    setReadDynamicNotifIds((prev) => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('tgi_read_dynamic_notif_ids', JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
    onMarkAllNotificationsAsRead?.();
  };

  const handleClickUnifiedNotification = (item: UnifiedNotificationItem) => {
    if (!item) return;
    markDynamicNotifAsRead(item.id);
    if (item.isAppNotification) {
      onMarkNotificationAsRead?.(item.id);
      if (item.actionUrl && onNavigateNotificationAction) {
        onNavigateNotificationAction(item.actionUrl, item.metadata);
      } else if (item.targetTab) {
        onNavigateTab?.(item.targetTab);
      }
    } else if (item.targetTab) {
      onNavigateTab?.(item.targetTab);
    }
    setShowNotificationPopover(false);
  };

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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs w-full max-w-full">
      {/* Main Top Navigation Row (Responsive Flex-Wrap Anti-Overflow) */}
      <div className="min-h-16 py-2.5 px-3 sm:px-5 lg:px-6 flex flex-wrap items-center justify-between gap-2 w-full max-w-full">
        {/* Left: Hamburger (Admin <1024px) + Desktop Collapse Toggle + Company Identity & Cut-off Period */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 max-w-full">
          {dashboardMode === 'admin' && (
            <>
              <button
                type="button"
                onClick={onOpenSidebar}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden cursor-pointer shrink-0 border border-slate-200/70"
                title="Buka Menu Navigasi Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              {onToggleSidebarCollapse && (
                <button
                  type="button"
                  onClick={onToggleSidebarCollapse}
                  className="hidden lg:inline-flex p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer shrink-0 border border-slate-200/70 transition-colors"
                  title={
                    isSidebarCollapsed
                      ? 'Lebarkan Sidebar Navigasi (w-64)'
                      : 'Ciutkan Sidebar Navigasi (Mode Ikon w-20)'
                  }
                >
                  {isSidebarCollapsed ? (
                    <PanelLeftOpen className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4 text-slate-600" />
                  )}
                </button>
              )}
            </>
          )}

          {/* Brand / Company identity in header */}
          <div className="flex items-center gap-2 sm:gap-2.5 text-slate-700 min-w-0">
            <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate max-w-[160px] sm:max-w-[240px] md:max-w-none">
                {companyConfig?.companyName || 'Tas Grosir Import'}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Periode: {companyConfig?.currentPayrollPeriod || '-'}</span>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="hidden sm:inline font-medium text-slate-600 whitespace-nowrap">
                  Cut-off tgl {companyConfig?.cutOffEndDay ?? 25}
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

        {/* Search Input & Right Action Buttons Container (Responsive Flex-Wrap) */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0 max-w-full">
          {/* 1. PENCARIAN GLOBAL REAL-TIME (Admin Mode): w-full sm:w-64 lg:w-80 */}
          {dashboardMode === 'admin' && (
            <div
              ref={searchContainerRef}
              className="relative w-full sm:w-64 lg:w-80 max-w-full flex-grow sm:flex-grow-0"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari karyawan, NIK, jabatan, atau slip gaji..."
                  value={localSearchQuery}
                  onFocus={() => {
                    if ((localSearchQuery || '').trim().length >= 2) {
                      setIsSearchDropdownOpen(true);
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalSearchQuery(val);
                    setSearchQuery?.(val);
                    setIsSearchDropdownOpen(val.trim().length >= 2);
                  }}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder-slate-400"
                />
                {Boolean(localSearchQuery && localSearchQuery.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalSearchQuery('');
                      setSearchQuery?.('');
                      setIsSearchDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Floating Global Search Results Dropdown */}
              {isSearchDropdownOpen && isSearchActive && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-96 lg:w-[430px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5 truncate">
                      <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Hasil Pencarian: &ldquo;{localSearchQuery.trim()}&rdquo;
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                      {matchedEmployees.length + matchedPayrolls.length} Hasil
                    </span>
                  </div>

                  <div className="max-h-[68vh] overflow-y-auto divide-y divide-slate-100">
                    {/* Kelompok 1: Data Karyawan */}
                    <div className="p-2">
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-emerald-600" />
                          <span>Data Karyawan ({matchedEmployees.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateTab?.('employees');
                            setLocalSearchQuery('');
                            setSearchQuery?.('');
                            setIsSearchDropdownOpen(false);
                          }}
                          className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                        >
                          Buka Menu Karyawan →
                        </button>
                      </div>

                      {matchedEmployees.length === 0 ? (
                        <p className="px-2 py-2.5 text-[11px] text-slate-400 italic">
                          Tidak ditemukan karyawan dengan nama, NIK, atau jabatan tersebut.
                        </p>
                      ) : (
                        <div className="space-y-1 mt-1">
                          {matchedEmployees.map((emp) => {
                            const pt = isEmployeePartTime(emp);
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  onNavigateTab?.('employees');
                                  setLocalSearchQuery('');
                                  setSearchQuery?.('');
                                  setIsSearchDropdownOpen(false);
                                }}
                                className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-emerald-50/70 transition-colors text-left group cursor-pointer border border-transparent hover:border-emerald-200/70"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={
                                      emp?.avatarUrl ||
                                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80'
                                    }
                                    alt={emp?.fullName || 'Karyawan'}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-800">
                                      {emp?.fullName || '-'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate">
                                      <span className="font-mono font-semibold text-slate-700">
                                        {emp?.nik || '-'}
                                      </span>{' '}
                                      • {emp?.role || '-'} ({emp?.department || '-'})
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 border ${
                                    pt
                                      ? 'bg-orange-50 text-orange-800 border-orange-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {pt ? 'Part-Time' : emp?.employmentStatus || 'Tetap'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Kelompok 2: Slip Gaji / Payroll */}
                    <div className="p-2">
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-indigo-600" />
                          <span>Slip Gaji / Payroll ({matchedPayrolls.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateTab?.('payroll');
                            setLocalSearchQuery('');
                            setSearchQuery?.('');
                            setIsSearchDropdownOpen(false);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Buka Penggajian →
                        </button>
                      </div>

                      {matchedPayrolls.length === 0 ? (
                        <p className="px-2 py-2.5 text-[11px] text-slate-400 italic">
                          Tidak ditemukan slip gaji untuk kata kunci tersebut.
                        </p>
                      ) : (
                        <div className="space-y-1 mt-1">
                          {matchedPayrolls.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                onNavigateTab?.(item.isPartTime ? 'part_time_payroll' : 'payroll');
                                if (item.payroll && onOpenPayslip) {
                                  onOpenPayslip(item.payroll);
                                }
                                setLocalSearchQuery('');
                                setSearchQuery?.('');
                                setIsSearchDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-indigo-50/70 transition-colors text-left group cursor-pointer border border-transparent hover:border-indigo-200/70"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-900">
                                    {item.employee?.fullName || '-'}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                    ({item.employee?.nik || '-'})
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  Periode: <strong className="text-slate-700">{item.period}</strong> • THP:{' '}
                                  <strong className="text-emerald-700 font-mono">
                                    {formatRupiah(item.takeHomePay)}
                                  </strong>
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold shrink-0 border ${
                                  item.paymentStatus === 'Lunas'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : item.isPartTime
                                    ? 'bg-orange-50 text-orange-800 border-orange-200'
                                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                }`}
                              >
                                {item.payroll ? 'Lihat Slip' : 'Buka Payroll'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons Group (Wraps cleanly onto new line when needed) */}
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {/* Quick RBAC Role Switcher & Simulator (Admin Mode) */}
            {dashboardMode === 'admin' && adminUser && onSwitchAdminUserRole && (
              <div ref={roleContainerRef} className="relative shrink-0">
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

          {/* Mode Tampilan Switcher: Hanya tampil jika sesi Admin terbuka (isAdminUnlocked). Jika karyawan login dengan NIK & PIN (!isAdminUnlocked), seluruh navigasi ke Dashboard Admin HR disembunyikan! */}
          {dashboardMode === 'employee' ? (
            Boolean(isAdminUnlocked && onToggleDashboardMode) ? (
              <button
                onClick={onToggleDashboardMode}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 hover:border-purple-300 shrink-0 whitespace-nowrap"
                title="Kembali ke Mode HR & Payroll Admin"
              >
                <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="hidden sm:inline">Kembali ke Panel Admin</span>
              </button>
            ) : (
              onLockAdmin && (
                <button
                  onClick={onLockAdmin}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shrink-0 whitespace-nowrap"
                  title="Keluar Sesi Portal Karyawan (Logout)"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline">Keluar Sesi</span>
                </button>
              )
            )
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleDashboardMode}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 whitespace-nowrap"
                title="Beralih ke Portal Layanan Mandiri Karyawan"
              >
                {currentEmployee?.avatarUrl ? (
                  <img
                    src={currentEmployee.avatarUrl}
                    alt={currentEmployee.fullName}
                    className="w-4 h-4 rounded-full object-cover ring-1 ring-indigo-400 shrink-0"
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                )}
                <span className="hidden md:inline">Portal Karyawan</span>
                <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded font-semibold">
                  Buka
                </span>
              </button>

              {onLockAdmin && (
                <button
                  onClick={onLockAdmin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shrink-0 whitespace-nowrap"
                  title="Kunci & Keluar Sesi Admin"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600 shrink-0" />
                  <span className="hidden 2xl:inline text-[11px]">Kunci Sesi</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Button: Hitung Payroll (Admin Only) */}
          {dashboardMode === 'admin' && (
            <button
              onClick={onOpenRunPayroll}
              className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
              title="Hitung & Proses Payroll Bulan Ini"
            >
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Proses Payroll</span>
              <span className="sm:hidden">Payroll</span>
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

          {/* Indikator Status Koneksi Cloud-First Supabase (Tampil di Admin & Portal Karyawan) */}
          {onOpenSupabaseModal && (
            <button
              onClick={onOpenSupabaseModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap ${
                supabaseStatus?.isConnected && supabaseStatus?.isTablesCreated
                  ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                  : supabaseStatus?.isConnected
                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                  : 'text-rose-800 bg-rose-50 hover:bg-rose-100 border-rose-300'
              }`}
              title={
                supabaseStatus?.isConnected
                  ? 'Supabase Cloud (Sinkron Antar-Perangkat) — Klik untuk detail tabel & Skrip SQL'
                  : 'Mode Offline / Lokal — Klik untuk cek koneksi & Skrip SQL Supabase'
              }
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    supabaseStatus?.isConnected && supabaseStatus?.isTablesCreated
                      ? 'bg-emerald-400'
                      : supabaseStatus?.isConnected
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    supabaseStatus?.isConnected && supabaseStatus?.isTablesCreated
                      ? 'bg-emerald-500'
                      : supabaseStatus?.isConnected
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </span>
              <Database
                className={`w-3.5 h-3.5 shrink-0 ${
                  supabaseStatus?.isConnected ? 'text-emerald-600' : 'text-rose-600'
                }`}
              />
              <span className="hidden lg:inline">
                {supabaseStatus?.isConnected
                  ? 'Supabase Cloud (Sinkron Antar-Perangkat)'
                  : 'Mode Offline / Lokal'}
              </span>
              <span className="lg:hidden">
                {supabaseStatus?.isConnected ? 'Cloud Aktif' : 'Mode Lokal'}
              </span>
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

          {/* 2. PUSAT NOTIFIKASI REAL-TIME & FLEKSIBEL (Bell + Popover w-80 sm:w-96) */}
          <div ref={notifContainerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowNotificationPopover((prev) => !prev)}
              className={`p-2 rounded-xl relative cursor-pointer transition-colors border ${
                showNotificationPopover
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100 border-transparent hover:border-slate-200'
              }`}
              title="Buka Pusat Notifikasi & Pengingat Jadwal Payroll"
            >
              <Bell className="w-4 h-4" />
              {unreadOrActionNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
                  {unreadOrActionNotificationsCount > 99 ? '99+' : unreadOrActionNotificationsCount}
                </span>
              )}
            </button>

            {showNotificationPopover && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                {/* Popover Header */}
                <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold tracking-tight truncate">
                        Pusat Notifikasi Real-Time
                      </h4>
                      <p className="text-[10px] text-slate-300 truncate">
                        {unreadOrActionNotificationsCount} belum dibaca • {actionNeededCount} perlu tindakan
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMarkAllUnifiedAsRead}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-emerald-300 border border-white/15 shrink-0 cursor-pointer transition-colors"
                  >
                    Tandai semua dibaca
                  </button>
                </div>

                {/* Filter Tabs: Semua & Perlu Tindakan */}
                <div className="p-2 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNotifFilterTab('all')}
                    className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      notifFilterTab === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>Semua</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20 font-extrabold">
                      {unifiedNotifications.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilterTab('action')}
                    className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      notifFilterTab === 'action'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>Perlu Tindakan</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                        notifFilterTab === 'action'
                          ? 'bg-white/25 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {actionNeededCount}
                    </span>
                  </button>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {filteredPopoverNotifications.length === 0 ? (
                    <div className="p-6 text-center space-y-1.5">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">
                        Tidak Ada Notifikasi {notifFilterTab === 'action' ? 'Perlu Tindakan' : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Seluruh pengajuan, jadwal payroll, dan masa kontrak karyawan telah terkendali.
                      </p>
                    </div>
                  ) : (
                    filteredPopoverNotifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleClickUnifiedNotification(item)}
                        className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col gap-1.5 ${
                          !item.isRead ? 'bg-emerald-50/35' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${item.badgeColor}`}
                          >
                            {item.categoryLabel}
                          </span>
                          {!item.isRead && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Baru
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 leading-snug">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {item.description}
                        </p>
                        <div className="pt-1 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 hover:underline">
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Popover Footer */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationPopover(false);
                      setShowNotificationSlideOver(true);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    Buka Panel Notifikasi Lengkap →
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotificationPopover(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-200/70 hover:bg-slate-300/70 text-slate-700 text-[10px] font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
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
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-200/40 text-slate-600">
                    <span>NIK KTP (16 Digit):</span>
                    {currentEmployee.ktpNumber && /^\d{16}$/.test(currentEmployee.ktpNumber) ? (
                      <strong className="font-mono text-indigo-700">{currentEmployee.ktpNumber}</strong>
                    ) : (
                      <span className="font-bold text-amber-700">Belum dilengkapi</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                  {isAdminUnlocked && onToggleDashboardMode && (
                    <button
                      onClick={() => {
                        onToggleDashboardMode();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100"
                    >
                      <span className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span>Kembali ke Panel Admin</span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  )}

                  {(onLockAdmin || onLogout) && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onLockAdmin) {
                          onLockAdmin();
                        } else if (onLogout) {
                          onLogout();
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar Sesi (Logout)</span>
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
      </div>

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
