import React, { useState, useEffect, useMemo } from 'react';
import {
  initialEmployees,
  initialPayrollRecords,
  initialAttendanceRecords,
  initialLeaveRequests,
  initialOvertimeRequests,
  initialCompanyConfig,
  initialReimbursements,
  initialSystemAuditLogs,
  initialCompanyAssets,
  initialAssetHistoryLogs,
  initialPerformanceReviews,
  initialNotifications,
  initialCashAdvances,
} from './mockData';
import {
  Employee,
  PayrollRecord,
  AttendanceRecord,
  LeaveRequest,
  OvertimeRequest,
  CompanyConfig,
  GoogleAdminUser,
  GoogleAdminAccount,
  GoogleAdminRole,
  ReimbursementClaim,
  SystemAuditLog,
  ActivityActionType,
  ActivityCategory,
  ActivitySeverity,
  CompanyAsset,
  AssetHistoryLog,
  AssetCondition,
  PerformanceReview,
  ReviewPeriodType,
  AppNotification,
  RolePermissionConfig,
  CashAdvance,
  CashAdvanceInstallment,
  WorkShift,
  AttendancePenaltyPolicy,
} from './types';
import {
  calculatePayroll,
  getOvertimeMinutes,
  getOvertimeRatePerMinute,
  DEFAULT_WORK_SHIFTS,
  DEFAULT_ATTENDANCE_PENALTY_POLICY,
  getAttendancePenaltyPolicy,
  deduplicateDailyAttendances,
  calculateEmployeeAttendancePenalty,
  getEmployeeShift,
  evaluateAttendanceAgainstShift,
} from './utils/formatters';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { EmployeeManagement } from './components/EmployeeManagement';
import { PayrollManagement } from './components/PayrollManagement';
import { AttendanceView } from './components/AttendanceView';
import { LeaveAndOvertime } from './components/LeaveAndOvertime';
import { ReimbursementView } from './components/ReimbursementView';
import { CashAdvanceView } from './components/CashAdvanceView';
import { AssetManagementView } from './components/AssetManagementView';
import { PerformanceReviewView } from './components/PerformanceReviewView';
import { TaxAndBpjsView } from './components/TaxAndBpjsView';
import { DepartmentKpiView } from './components/DepartmentKpiView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { PayslipModal } from './components/PayslipModal';
import { GoogleLoginView } from './components/GoogleLoginView';
import { AuditLogsView } from './components/AuditLogsView';
import { EmployeePortalView } from './components/EmployeePortalView';
import { RoleManagementView } from './components/RoleManagementView';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { AdminPinAuthModal } from './components/AdminPinAuthModal';
import { WebPinGatekeeper } from './components/WebPinGatekeeper';
import {
  checkSupabaseStatus,
  autoSeedSupabaseIfEmpty,
  fetchEmployeesFromSupabase,
  insertEmployeeToSupabase,
  updateEmployeeInSupabase,
  deleteEmployeeFromSupabase,
  fetchAssetsFromSupabase,
  insertAssetToSupabase,
  updateAssetInSupabase,
  deleteAssetFromSupabase,
  fetchPayrollsFromSupabase,
  upsertPayrollToSupabase,
  fetchAttendancesFromSupabase,
  upsertAttendanceToSupabase,
  deleteAttendanceFromSupabase,
  fetchLeaveRequestsFromSupabase,
  upsertLeaveRequestToSupabase,
  fetchOvertimeRequestsFromSupabase,
  upsertOvertimeRequestToSupabase,
  fetchReimbursementsFromSupabase,
  upsertReimbursementToSupabase,
  deleteReimbursementFromSupabase,
  SupabaseSyncStatus,
  dbToEmployee,
  dbToAsset,
  dbToPayroll,
  dbToAttendance,
  dbToLeave,
  dbToOvertime,
  dbToReimbursement,
  getDeletedEmployeeIds,
  addDeletedEmployeeId,
  removeDeletedEmployeeId,
  markEmployeesModified,
  isEmployeesModified,
} from './services/supabaseService';
import { supabase } from './lib/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSeedingSupabase, setIsSeedingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseSyncStatus>({
    isConnected: false,
    isTablesCreated: false,
    statusText: 'Memeriksa koneksi Supabase...',
    lastSyncTime: null,
  });

  // Google Admin Auth State (1 Google Admin Account to manage everything)
  const [adminUser, setAdminUser] = useState<GoogleAdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('tgi_admin_google_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (user: GoogleAdminUser) => {
    setAdminUser(user);
    try {
      localStorage.setItem('tgi_admin_google_user', JSON.stringify(user));
    } catch (e) {
      console.error('Storage error', e);
    }
  };

  const handleLogout = () => {
    setAdminUser(null);
    try {
      localStorage.removeItem('tgi_admin_google_user');
    } catch (e) {
      console.error('Storage error', e);
    }
  };

  // Helper to detect and purge any legacy dummy records from LocalStorage
  const isLegacyDummyRecord = (item: any): boolean => {
    if (!item || typeof item !== 'object') return true;
    const dummyIds = new Set([
      'emp-01', 'emp-02', 'emp-03', 'emp-04', 'emp-05',
      'emp-06', 'emp-07', 'emp-08', 'emp-09', 'emp-10',
      'att-001', 'att-002', 'att-003', 'att-004', 'att-005',
      'att-006', 'att-007', 'att-008', 'att-009', 'att-010',
      'lv-001', 'lv-002', 'lv-003', 'lv-004',
      'ot-001', 'ot-002', 'ot-003', 'ot-004',
      'rmb-001', 'rmb-002', 'rmb-003', 'rmb-004', 'rmb-005',
      'ast-001', 'ast-002', 'ast-003', 'ast-004', 'ast-005',
      'ast-006', 'ast-007', 'ast-008', 'ast-009', 'ast-010',
      'ah-001', 'ah-002', 'ah-003', 'ah-004', 'ah-005',
      'ah-006', 'ah-007', 'ah-008', 'ah-009', 'ah-010',
      'pr-001', 'pr-002', 'pr-003', 'pr-004', 'pr-005',
      'ca-001', 'ca-002', 'ca-003', 'ca-004',
      'notif-001', 'notif-002', 'notif-003', 'notif-004', 'notif-005',
      'log-001', 'log-002', 'log-003', 'log-004', 'log-005',
      'log-006', 'log-007', 'log-008', 'log-009', 'log-010', 'log-011',
      'log-ca-001', 'log-ca-002', 'log-ca-003',
    ]);
    if (item.id && dummyIds.has(String(item.id))) return true;
    if (item.employeeId && dummyIds.has(String(item.employeeId))) return true;
    if (item.assignedToEmployeeId && dummyIds.has(String(item.assignedToEmployeeId))) return true;
    if (item.recipientEmployeeId && dummyIds.has(String(item.recipientEmployeeId))) return true;
    if (item.targetId && dummyIds.has(String(item.targetId))) return true;
    if (item.assetId && dummyIds.has(String(item.assetId))) return true;

    const dummyNames = [
      'Arya Wicaksono',
      'Siti Rahmawati',
      'Dimas Prasetyo',
      'Nadia Putri',
      'Rizky Kurniawan',
      'Dewi Anggraini',
      'Fajar Nugroho',
      'Budi Santoso',
      'Kevin Pratama',
      'Anisa Ramadhani',
      'Bambang Sudiro',
      'Hendro Gunawan',
      'Dewi Lestari',
    ];
    const combinedText = [
      item.fullName,
      item.name,
      item.employeeName,
      item.assignedToEmployeeName,
      item.recipientName,
      item.targetName,
      item.reviewerName,
      item.description,
      item.message,
    ]
      .filter(Boolean)
      .join(' ');
    if (dummyNames.some((dn) => combinedText.includes(dn))) return true;
    return false;
  };

  // System Audit Logs State (History of critical admin actions: salary, employee deletion, role permissions)
  const [systemAuditLogs, setSystemAuditLogs] = useState<SystemAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_system_audit_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((l) => !isLegacyDummyRecord(l));
        }
      }
    } catch (e) {
      console.error('Failed to parse audit logs', e);
    }
    return initialSystemAuditLogs;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_system_audit_logs', JSON.stringify(systemAuditLogs));
    } catch (e) {
      console.error('Failed to save audit logs', e);
    }
  }, [systemAuditLogs]);

  // Centralized System Audit Logger Helper
  const logActivity = (
    actionType: ActivityActionType,
    actionCategory: ActivityCategory,
    description: string,
    meta?: {
      targetId?: string;
      targetName?: string;
      oldValue?: string;
      newValue?: string;
      severity?: ActivitySeverity;
      notes?: string;
    }
  ) => {
    const now = new Date();
    const formatted = `${now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

    const newLog: SystemAuditLog = {
      id: `log-${Date.now().toString().slice(-6)}`,
      timestamp: now.toISOString(),
      formattedTime: formatted,
      adminEmail: adminUser?.email || 'admin@tasgrosirimport.co.id',
      adminName: adminUser?.name || 'Administrator Utama (TGI)',
      adminRole: adminUser?.role || 'Super Admin',
      actionType,
      actionCategory,
      description,
      targetId: meta?.targetId,
      targetName: meta?.targetName,
      oldValue: meta?.oldValue,
      newValue: meta?.newValue,
      severity: meta?.severity || 'info',
      ipAddress: '182.253.112.45',
      device: 'Chrome / Web Browser',
      notes: meta?.notes,
    };

    setSystemAuditLogs((prev) => [newLog, ...prev]);
  };

  // System Notifications & Reminder State
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((n) => !isLegacyDummyRecord(n));
        }
      }
    } catch (e) {
      console.error('Failed to parse notifications', e);
    }
    return initialNotifications;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error('Failed to save notifications', e);
    }
  }, [notifications]);

  // Employee Portal Tab override controller from notifications
  const [portalTabOverride, setPortalTabOverride] = useState<'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile' | null>(null);

  // Send Notification Helper (Dispatches in-app message & logs to Audit Trail)
  const sendNotification = (params: {
    recipientType: 'admin' | 'employee' | 'all';
    recipientEmployeeId?: string;
    recipientName?: string;
    title: string;
    message: string;
    category: AppNotification['category'];
    priority?: AppNotification['priority'];
    actionUrl?: string;
    actionLabel?: string;
    relatedReviewId?: string;
    metadata?: any;
  }) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`,
      recipientType: params.recipientType,
      recipientEmployeeId: params.recipientEmployeeId,
      recipientName: params.recipientName,
      title: params.title,
      message: params.message,
      category: params.category,
      priority: params.priority || 'normal',
      createdAt: new Date().toISOString(),
      isRead: false,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      relatedReviewId: params.relatedReviewId,
      metadata: params.metadata,
    };

    setNotifications((prev) => [newNotif, ...prev]);

    // Mandatory Audit Trail Logging under 'Notifikasi Sistem'
    const targetLabel =
      params.recipientName ||
      (params.recipientType === 'admin' ? 'Semua Atasan & Tim HRD' : 'Portal Karyawan');

    logActivity(
      'NOTIFICATION_SENT',
      'Notifikasi Sistem',
      `Pengiriman notifikasi otomatis "${params.title}" ke ${targetLabel}: "${params.message.slice(0, 90)}..."`,
      {
        targetId: params.recipientEmployeeId || params.recipientType,
        targetName: targetLabel,
        newValue: `Kategori: ${params.category}, Prioritas: ${params.priority || 'normal'}${
          params.metadata?.period ? `, Periode: ${params.metadata.period}` : ''
        }`,
        severity: params.priority === 'urgent' ? 'warning' : 'info',
        notes: 'Otomasi Sistem Notifikasi & Reminder Penilaian Kinerja TGI.',
      }
    );
  };

  const handleMarkNotificationAsRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );

    if (target) {
      logActivity(
        'NOTIFICATION_READ',
        'Notifikasi Sistem',
        `Pesan notifikasi dibaca oleh pengguna: "${target.title}".`,
        {
          targetId: id,
          targetName: target.recipientName || 'Notifikasi',
          severity: 'info',
        }
      );
    }
  };

  const handleMarkAllNotificationsAsRead = () => {
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    if (unreadCount === 0) return;

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );

    logActivity(
      'NOTIFICATION_READ',
      'Notifikasi Sistem',
      `Menandai semua notifikasi (${unreadCount} pesan) telah dibaca oleh pengguna aktif.`,
      {
        newValue: `Jumlah notifikasi dibaca: ${unreadCount}`,
        severity: 'info',
      }
    );
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNavigateNotificationAction = (actionUrl: string) => {
    if (actionUrl === 'rapor_kinerja') {
      setDashboardMode('employee');
      setPortalTabOverride('performance');
    } else if (actionUrl === 'payroll') {
      if (dashboardMode === 'employee') {
        setPortalTabOverride('payroll');
      } else {
        setActiveTab('payroll');
      }
    } else if (actionUrl === 'performance_review') {
      setDashboardMode('admin');
      setActiveTab('performance_review');
    } else if (actionUrl === 'cash_advance') {
      if (dashboardMode === 'employee') {
        setPortalTabOverride('cash_advance');
      } else {
        setActiveTab('cash_advance');
      }
    } else {
      setActiveTab(actionUrl as any);
    }
  };

  const handleOpenNewReviewPeriod = (data: {
    period: string;
    periodType: ReviewPeriodType;
    department: string;
    deadlineDate: string;
    notes?: string;
  }) => {
    // 1. Notifikasi ke Atasan & HRD
    sendNotification({
      recipientType: 'admin',
      recipientName: 'Semua Atasan & Tim HRD',
      title: `Periode Penilaian Kinerja ${data.period} Telah Dibuka`,
      message: `Periode penilaian (${data.department}) telah resmi dibuka. Seluruh atasan diharapkan menyelesaikan evaluasi KPI staf sebelum batas tenggat ${data.deadlineDate}. ${
        data.notes ? `Catatan: "${data.notes}"` : ''
      }`,
      category: 'PERIOD_OPENED',
      priority: 'high',
      actionUrl: 'performance_review',
      actionLabel: 'Mulai Penilaian Staf',
      metadata: {
        period: data.period,
        department: data.department,
        deadlineDate: data.deadlineDate,
      },
    });

    // 2. Notifikasi ke Portal Karyawan
    sendNotification({
      recipientType: 'all',
      recipientName:
        data.department === 'Semua Departemen'
          ? 'Seluruh Karyawan PT TGI'
          : `Karyawan ${data.department}`,
      title: `Periode Evaluasi Kinerja ${data.period} Telah Dimulai`,
      message: `Proses evaluasi kinerja & review KPI periode ${data.period} telah dimulai. Hasil rapor kerja & rekomendasi bonus insentif akan dipublikasikan setelah disetujui atasan.`,
      category: 'PERIOD_OPENED',
      priority: 'normal',
      actionUrl: 'rapor_kinerja',
      actionLabel: 'Info Rapor Kinerja',
      metadata: {
        period: data.period,
        department: data.department,
        deadlineDate: data.deadlineDate,
      },
    });
  };

  const handleSendDeadlineReminder = (data: {
    period: string;
    deadlineDate: string;
    department?: string;
    pendingCount: number;
  }) => {
    sendNotification({
      recipientType: 'admin',
      recipientName: 'Atasan & Manager Divisi',
      title: `Peringatan Deadline: Penilaian Kinerja Periode ${data.period}`,
      message: `Mendekati batas akhir tenggat waktu (${data.deadlineDate})! Masih terdapat ${data.pendingCount} staf ${
        data.department || ''
      } yang belum dievaluasi. Segera lengkapi formulir review sebelum cut-off payroll.`,
      category: 'DEADLINE_REMINDER',
      priority: 'urgent',
      actionUrl: 'performance_review',
      actionLabel: 'Lengkapi Evaluasi KPI',
      metadata: {
        period: data.period,
        deadlineDate: data.deadlineDate,
        department: data.department,
      },
    });
  };

  const handleSwitchAdminUser = (account: GoogleAdminAccount) => {
    const newUser: GoogleAdminUser = {
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.avatarUrl,
      role: account.role,
      lastLogin: new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      phone: account.phone,
    };
    setAdminUser(newUser);
    try {
      localStorage.setItem('tgi_admin_google_user', JSON.stringify(newUser));
    } catch (e) {
      console.error('Storage error', e);
    }

    logActivity(
      'LOGIN_ACTIVITY',
      'Autentikasi',
      `Beralih akun admin aktif ke ${account.name} (${account.email}) dengan peran ${account.role}.`,
      {
        targetId: account.id,
        targetName: account.name,
        newValue: `Peran: ${account.role}`,
        severity: 'info',
      }
    );
  };

  const handleRegisterNewAdmin = (account: GoogleAdminAccount) => {
    setCompanyConfig((prev) => {
      const existing = prev.allowedGoogleAdmins || [];
      const updated = [...existing, account];
      return {
        ...prev,
        allowedGoogleAdmins: updated,
      };
    });

    logActivity(
      'ADMIN_CREATE',
      'Hak Akses & Admin',
      `Mendaftarkan akun Google Admin baru: ${account.name} (${account.email}) dengan peran "${account.role}".`,
      {
        targetId: account.id,
        targetName: `${account.name} (${account.email})`,
        newValue: `Peran: ${account.role}, Status: active`,
        severity: 'warning',
        notes: 'Pendaftaran mandiri akun Google baru oleh pengguna/admin.',
      }
    );
  };

  // Core Data State
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(() => {
    try {
      const saved = localStorage.getItem('tgi_company_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.allowedGoogleAdmins || parsed.allowedGoogleAdmins.length === 0) {
          parsed.allowedGoogleAdmins = initialCompanyConfig.allowedGoogleAdmins;
        } else {
          const cleanedAdmins = parsed.allowedGoogleAdmins.filter(
            (adm: any) => !isLegacyDummyRecord(adm)
          );
          parsed.allowedGoogleAdmins =
            cleanedAdmins.length > 0 ? cleanedAdmins : initialCompanyConfig.allowedGoogleAdmins;
        }
        if (!parsed.rolePermissions) {
          parsed.rolePermissions = initialCompanyConfig.rolePermissions;
        } else {
          // Ensure settings and roles_management are in allowedModules for each role
          Object.keys(parsed.rolePermissions).forEach((key) => {
            const roleConf = parsed.rolePermissions[key];
            if (roleConf && Array.isArray(roleConf.allowedModules)) {
              if (!roleConf.allowedModules.includes('settings')) {
                roleConf.allowedModules.push('settings');
              }
              if (!roleConf.allowedModules.includes('roles_management')) {
                roleConf.allowedModules.push('roles_management');
              }
              if (
                (key === 'Super Admin' ||
                  key === 'HR & Payroll Admin' ||
                  key === 'Finance & Reimbursement') &&
                !roleConf.allowedModules.includes('cash_advance')
              ) {
                roleConf.allowedModules.push('cash_advance');
              }
              if (
                (key === 'Super Admin' ||
                  key === 'HR & Payroll Admin' ||
                  key === 'Operations Manager') &&
                !roleConf.allowedModules.includes('work_shifts')
              ) {
                roleConf.allowedModules.push('work_shifts');
              }
            }
          });
        }
        if (!parsed.workShifts || !Array.isArray(parsed.workShifts) || parsed.workShifts.length === 0) {
          parsed.workShifts = DEFAULT_WORK_SHIFTS;
        } else {
          parsed.workShifts = parsed.workShifts.map((sh: WorkShift) => ({
            ...sh,
            location: sh.location || 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
          }));
        }
        if (!parsed.address || parsed.address.includes('Hayam Wuruk')) {
          parsed.address = 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID';
        }
        parsed.attendancePenaltyPolicy = getAttendancePenaltyPolicy(parsed.attendancePenaltyPolicy);
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved company config', e);
    }
    return initialCompanyConfig;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_company_config', JSON.stringify(companyConfig));
    } catch (e) {
      console.error('Failed to save company config', e);
    }
  }, [companyConfig]);
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      // Reconcile any previously deleted employee IDs from system audit logs (excluding initial mock log-003)
      const savedAuditRaw = localStorage.getItem('tgi_system_audit_logs');
      if (savedAuditRaw) {
        const parsedLogs = JSON.parse(savedAuditRaw);
        if (Array.isArray(parsedLogs)) {
          const createdIds = new Set(
            parsedLogs
              .filter((l: any) => l && l.actionType === 'EMPLOYEE_CREATE' && l.targetId)
              .map((l: any) => l.targetId)
          );
          parsedLogs.forEach((l: any) => {
            if (
              l &&
              l.actionType === 'EMPLOYEE_DELETE' &&
              l.id !== 'log-003' &&
              typeof l.targetId === 'string' &&
              l.targetId.trim().length > 0 &&
              !createdIds.has(l.targetId)
            ) {
              addDeletedEmployeeId(l.targetId);
            }
          });
        }
      }

      const deletedIds = new Set(getDeletedEmployeeIds());
      const saved = localStorage.getItem('tgi_employees_data');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (e: Employee) => e && !deletedIds.has(e.id) && !isLegacyDummyRecord(e)
          );
          if (filtered.length !== parsed.length) {
            localStorage.setItem('tgi_employees_data', JSON.stringify(filtered));
          }
          // Do not re-seed initialEmployees if user has already saved or modified employee data
          if (filtered.length > 0 || isEmployeesModified()) {
            return filtered;
          }
        }
      }
      return initialEmployees.filter((e) => !deletedIds.has(e.id) && !isLegacyDummyRecord(e));
    } catch (e) {
      console.error('Failed to parse saved employees', e);
      const deletedIds = new Set(getDeletedEmployeeIds());
      return initialEmployees.filter((e) => !deletedIds.has(e.id) && !isLegacyDummyRecord(e));
    }
  });

  // Keep employees in localStorage
  useEffect(() => {
    try {
      const deletedIds = new Set(getDeletedEmployeeIds());
      const cleanList = employees.filter((e) => !deletedIds.has(e.id) && !isLegacyDummyRecord(e));
      localStorage.setItem('tgi_employees_data', JSON.stringify(cleanList));
    } catch (e) {
      console.error('Failed to save employees to localStorage', e);
    }
  }, [employees]);

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => {
    const deletedIds = new Set(getDeletedEmployeeIds());
    try {
      const saved = localStorage.getItem('tgi_payrolls_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (p: PayrollRecord) => p && !deletedIds.has(p.employeeId) && !isLegacyDummyRecord(p)
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse payrolls', e);
    }
    return initialPayrollRecords.filter((p) => !deletedIds.has(p.employeeId));
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_payrolls_data', JSON.stringify(payrolls));
    } catch (e) {
      console.error('Failed to save payrolls to localStorage', e);
    }
  }, [payrolls]);

  const [attendances, setAttendances] = useState<AttendanceRecord[]>(() => {
    const deletedIds = new Set(getDeletedEmployeeIds());
    try {
      const saved = localStorage.getItem('tgi_attendances_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (a: AttendanceRecord) => a && !deletedIds.has(a.employeeId) && !isLegacyDummyRecord(a)
          );
          return deduplicateDailyAttendances(
            valid,
            initialEmployees,
            DEFAULT_WORK_SHIFTS,
            DEFAULT_ATTENDANCE_PENALTY_POLICY
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse saved attendances', e);
    }
    return deduplicateDailyAttendances(
      initialAttendanceRecords.filter((a) => !deletedIds.has(a.employeeId)),
      initialEmployees,
      DEFAULT_WORK_SHIFTS,
      DEFAULT_ATTENDANCE_PENALTY_POLICY
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_attendances_data', JSON.stringify(attendances));
    } catch (e) {
      console.error('Failed to save attendances to localStorage', e);
    }
  }, [attendances]);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const deletedIds = new Set(getDeletedEmployeeIds());
    try {
      const saved = localStorage.getItem('tgi_leave_requests_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (l: LeaveRequest) => l && !deletedIds.has(l.employeeId) && !isLegacyDummyRecord(l)
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse saved leave requests', e);
    }
    return initialLeaveRequests.filter((l) => !deletedIds.has(l.employeeId));
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_leave_requests_data', JSON.stringify(leaveRequests));
    } catch (e) {
      console.error('Failed to save leave requests to localStorage', e);
    }
  }, [leaveRequests]);

  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(() => {
    const deletedIds = new Set(getDeletedEmployeeIds());
    try {
      const saved = localStorage.getItem('tgi_overtime_requests_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (o: OvertimeRequest) => o && !deletedIds.has(o.employeeId) && !isLegacyDummyRecord(o)
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse saved overtime requests', e);
    }
    return initialOvertimeRequests.filter((o) => !deletedIds.has(o.employeeId));
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_overtime_requests_data', JSON.stringify(overtimeRequests));
    } catch (e) {
      console.error('Failed to save overtime requests to localStorage', e);
    }
  }, [overtimeRequests]);

  const [reimbursements, setReimbursements] = useState<ReimbursementClaim[]>(() => {
    const deletedIds = new Set(getDeletedEmployeeIds());
    try {
      const saved = localStorage.getItem('tgi_reimbursements_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (r: ReimbursementClaim) => r && !deletedIds.has(r.employeeId) && !isLegacyDummyRecord(r)
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse saved reimbursements', e);
    }
    return initialReimbursements.filter((r) => !deletedIds.has(r.employeeId));
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_reimbursements_data', JSON.stringify(reimbursements));
    } catch (e) {
      console.error('Failed to save reimbursements to localStorage', e);
    }
  }, [reimbursements]);

  // Assets & Inventory State
  const [assets, setAssets] = useState<CompanyAsset[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_company_assets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a) => !isLegacyDummyRecord(a));
        }
      }
    } catch (e) {
      console.error('Failed to parse assets', e);
    }
    return initialCompanyAssets;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_company_assets', JSON.stringify(assets));
    } catch (e) {
      console.error('Failed to save assets', e);
    }
  }, [assets]);

  const [assetLogs, setAssetLogs] = useState<AssetHistoryLog[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_asset_history_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((l) => !isLegacyDummyRecord(l));
        }
      }
    } catch (e) {
      console.error('Failed to parse asset history logs', e);
    }
    return initialAssetHistoryLogs;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_asset_history_logs', JSON.stringify(assetLogs));
    } catch (e) {
      console.error('Failed to save asset history logs', e);
    }
  }, [assetLogs]);

  // Performance Reviews State
  const [reviews, setReviews] = useState<PerformanceReview[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_performance_reviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r) => !isLegacyDummyRecord(r));
        }
      }
    } catch (e) {
      console.error('Failed to parse performance reviews', e);
    }
    return initialPerformanceReviews;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_performance_reviews', JSON.stringify(reviews));
    } catch (e) {
      console.error('Failed to save performance reviews', e);
    }
  }, [reviews]);

  // Cash Advances (Kasbon & Cicilan Potongan Gaji) State
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_cash_advances_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((c) => !isLegacyDummyRecord(c));
        }
      }
    } catch (e) {
      console.error('Failed to parse cash advances', e);
    }
    return initialCashAdvances;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_cash_advances_data', JSON.stringify(cashAdvances));
    } catch (e) {
      console.error('Failed to save cash advances', e);
    }
  }, [cashAdvances]);

  // Listen to storage events across browser tabs so Portal Karyawan and Panel Admin HR sync immediately
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'tgi_cash_advances_data' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setCashAdvances(parsed);
        } catch (err) {
          console.error(err);
        }
      }
      if (e.key === 'tgi_employees_data' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setEmployees(parsed);
        } catch (err) {
          console.error(err);
        }
      }
      if (e.key === 'tgi_company_config' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setCompanyConfig(parsed);
        } catch (err) {
          console.error(err);
        }
      }
      if (e.key === 'tgi_attendances_data' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setAttendances(parsed);
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Payslip Modal State
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  // Pending counts for badges & alerts
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'Menunggu Persetujuan');
  const pendingOvertimes = overtimeRequests.filter((o) => o.status === 'Menunggu Persetujuan');
  const pendingReimbursements = reimbursements.filter((r) => r.status === 'Menunggu Persetujuan');
  const pendingCashAdvances = cashAdvances.filter((c) => c.status === 'pending');

  // Web Gatekeeper PIN Unlock State (controls initial entry into the web app)
  const [isWebPinUnlocked, setIsWebPinUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('tgi_web_pin_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  // Admin PIN / Security Unlock State (controls access to HR & Payroll Admin mode)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('tgi_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  // Mode Dashboard: 'admin' (Panel Admin) atau 'employee' (Portal Karyawan Self-Service)
  const [dashboardMode, setDashboardMode] = useState<'admin' | 'employee'>(() => {
    try {
      const unlocked = sessionStorage.getItem('tgi_admin_unlocked') === 'true';
      if (!unlocked) return 'employee';
      const saved = localStorage.getItem('tgi_dashboard_mode');
      return saved === 'admin' ? 'admin' : 'employee';
    } catch {
      return 'employee';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_dashboard_mode', dashboardMode);
    } catch (e) {
      console.error('Failed to save dashboard mode', e);
    }
  }, [dashboardMode]);

  const handleUnlockWeb = (options: {
    mode: 'admin' | 'employee';
    employeeId?: string;
    unlockAdmin?: boolean;
    adminEmail?: string;
  }) => {
    setIsWebPinUnlocked(true);
    try {
      sessionStorage.setItem('tgi_web_pin_unlocked', 'true');
    } catch (e) {
      console.error(e);
    }

    if (options.unlockAdmin) {
      setIsAdminUnlocked(true);
      try {
        sessionStorage.setItem('tgi_admin_unlocked', 'true');
      } catch (e) {
        console.error(e);
      }
      if (options.adminEmail) {
        const matchedAdm = (companyConfig.allowedGoogleAdmins || []).find(
          (a) => a.email.toLowerCase() === options.adminEmail!.toLowerCase()
        );
        if (matchedAdm) {
          const nextAdminUser: GoogleAdminUser = {
            id: matchedAdm.id,
            email: matchedAdm.email,
            name: matchedAdm.name,
            picture: matchedAdm.avatarUrl,
            role: matchedAdm.role,
            lastLogin: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            phone: matchedAdm.phone,
          };
          setAdminUser(nextAdminUser);
          try {
            localStorage.setItem('tgi_admin_google_user', JSON.stringify(nextAdminUser));
          } catch (e) {
            console.error(e);
          }
        }
      }
      setDashboardMode('admin');
    } else {
      // Strictly lock Admin mode when entering via Employee NIK & PIN
      setIsAdminUnlocked(false);
      try {
        sessionStorage.removeItem('tgi_admin_unlocked');
      } catch (e) {
        console.error(e);
      }
      if (options.employeeId) {
        setActiveEmployeeId(options.employeeId);
        try {
          sessionStorage.setItem('tgi_locked_employee_id', options.employeeId);
          localStorage.setItem('tgi_active_employee_id', options.employeeId);
        } catch (e) {
          console.error(e);
        }
      }
      setDashboardMode('employee');
    }
  };

  const handleAdminUnlockSuccess = () => {
    setIsAdminUnlocked(true);
    try {
      sessionStorage.setItem('tgi_admin_unlocked', 'true');
      sessionStorage.removeItem('tgi_locked_employee_id');
    } catch (e) {
      console.error(e);
    }
    setDashboardMode('admin');
    setIsAdminAuthModalOpen(false);
    logActivity(
      'LOGIN_ACTIVITY',
      'Autentikasi',
      'Akses HR & Payroll Admin berhasil dibuka menggunakan verifikasi PIN / Kredensial Admin.',
      { severity: 'info' }
    );
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    setIsWebPinUnlocked(false);
    try {
      sessionStorage.removeItem('tgi_admin_unlocked');
      sessionStorage.removeItem('tgi_web_pin_unlocked');
      sessionStorage.removeItem('tgi_locked_employee_id');
    } catch (e) {
      console.error(e);
    }
    setDashboardMode('employee');
    logActivity(
      'LOGIN_ACTIVITY',
      'Autentikasi',
      'Mengunci layar keamanan web dan mengakhiri sesi pengguna aktif.',
      { severity: 'info' }
    );
  };

  const handleToggleDashboardMode = () => {
    if (dashboardMode === 'employee') {
      // Sesi Login Ketat: Hanya pengguna dengan sesi Admin terbuka yang dapat beralih ke Dashboard Admin HR
      if (isAdminUnlocked) {
        setDashboardMode('admin');
      }
    } else {
      setDashboardMode('employee');
    }
  };

  // Selected Employee ID for Portal Karyawan (Strictly locked to sessionStorage when logged in as Employee)
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>(() => {
    try {
      return (
        sessionStorage.getItem('tgi_locked_employee_id') ||
        localStorage.getItem('tgi_active_employee_id') ||
        ''
      );
    } catch {
      return '';
    }
  });

  // Determine current active employee in Portal Karyawan
  const currentEmployee = useMemo(() => {
    if (!isAdminUnlocked) {
      try {
        const lockedId = sessionStorage.getItem('tgi_locked_employee_id');
        if (lockedId) {
          const lockedEmp = employees.find((e) => e.id === lockedId);
          if (lockedEmp) return lockedEmp;
        }
      } catch {
        // ignore
      }
    }
    if (activeEmployeeId) {
      const found = employees.find((e) => e.id === activeEmployeeId);
      if (found) return found;
    }
    if (adminUser?.email) {
      const matched = employees.find(
        (e) =>
          e.googleEmail?.toLowerCase() === adminUser.email.toLowerCase() ||
          e.email?.toLowerCase() === adminUser.email.toLowerCase()
      );
      if (matched) return matched;
    }
    return employees[0] || initialEmployees[0];
  }, [activeEmployeeId, employees, adminUser, isAdminUnlocked]);

  useEffect(() => {
    if (currentEmployee?.id && currentEmployee.id !== activeEmployeeId) {
      setActiveEmployeeId(currentEmployee.id);
      try {
        localStorage.setItem('tgi_active_employee_id', currentEmployee.id);
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentEmployee, activeEmployeeId]);

  // Auto-sync Payrolls so every active employee always has a calculated PayrollRecord (THP, PPh 21 TER 2026, BPJS, & Potongan Terlambat/Absen)
  const syncedPayrolls = useMemo(() => {
    const deletedIds = new Set(getDeletedEmployeeIds());
    const validEmployees = employees.filter((e) => !deletedIds.has(e.id));
    const activeEmps = validEmployees.filter((e) => e.isActive !== false);
    const currentPeriod = companyConfig.currentPayrollPeriod;
    const isPeriodLocked = Boolean(
      (companyConfig.lockedPayrollPeriods || []).includes(currentPeriod)
    );
    const waivedIdsForPeriod = companyConfig.waivedLateEmployeeIds?.[currentPeriod] || [];

    return activeEmps.map((emp) => {
      const existing =
        payrolls.find((p) => p.employeeId === emp.id && p.period === currentPeriod) ||
        payrolls.find((p) => p.employeeId === emp.id);

      // If the period is locked and we have an existing frozen payroll record, return it frozen so THP never changes
      if (isPeriodLocked && existing && existing.takeHomePay > 0) {
        return {
          ...existing,
          period: currentPeriod,
          isLocked: true,
        };
      }

      const employeeOts = overtimeRequests.filter(
        (o) => o.employeeId === emp.id && o.status === 'Disetujui'
      );
      const approvedOtMinutes = employeeOts.reduce(
        (acc, curr) => acc + getOvertimeMinutes(curr),
        0
      );
      const effectiveOtMinutes =
        existing?.overtimeMinutes !== undefined ? existing.overtimeMinutes : approvedOtMinutes;

      const penaltySummary = calculateEmployeeAttendancePenalty(
        emp,
        attendances,
        companyConfig.workShifts,
        companyConfig.attendancePenaltyPolicy
      );

      const isLateFeeWaived = Boolean(
        existing?.isLateFeeWaived !== undefined
          ? existing.isLateFeeWaived
          : waivedIdsForPeriod.includes(emp.id)
      );

      const computed = calculatePayroll(
        emp,
        currentPeriod,
        effectiveOtMinutes,
        existing?.bonus || 0,
        penaltySummary.totalLateMinutes,
        existing?.cashAdvanceDeduction || 0,
        existing?.cashAdvanceNotes,
        {
          lateFrequency: penaltySummary.lateFrequency,
          totalLateMinutes: penaltySummary.totalLateMinutes,
          latePenaltyAmount: penaltySummary.latePenaltyAmount,
          alphaDaysCount: penaltySummary.alphaDaysCount,
          alphaPenaltyAmount: penaltySummary.alphaPenaltyAmount,
          attendanceDeductionNotes: penaltySummary.deductionNotes,
          isLateFeeWaived,
          originalLateDeduction: penaltySummary.totalDeductionAmount,
          waiverReason: existing?.waiverReason || 'Dispensasi Tugas Luar / HR',
          isLocked: isPeriodLocked,
          lockedAt: existing?.lockedAt,
          penaltyPolicy: companyConfig.attendancePenaltyPolicy,
        }
      );

      if (existing) {
        return {
          ...computed,
          id: existing.id,
          referenceNumber: existing.referenceNumber || computed.referenceNumber,
          paymentStatus: existing.paymentStatus || computed.paymentStatus,
          paymentDate: existing.paymentDate || computed.paymentDate,
        };
      }

      return computed;
    });
  }, [
    employees,
    payrolls,
    overtimeRequests,
    attendances,
    companyConfig.currentPayrollPeriod,
    companyConfig.lockedPayrollPeriods,
    companyConfig.waivedLateEmployeeIds,
    companyConfig.workShifts,
    companyConfig.attendancePenaltyPolicy,
  ]);

  // -------------------------------------------------------------
  // Supabase Connection, Real-time Sync for 7 Tables
  // -------------------------------------------------------------
  const refreshSupabaseStatus = async () => {
    try {
      const status = await checkSupabaseStatus();
      setSupabaseStatus(status);

      if (status.isTablesCreated) {
        // Ensure any deleted_employee_ids are permanently deleted from Supabase before fetching
        const deletedList = getDeletedEmployeeIds();
        if (deletedList.length > 0) {
          await Promise.allSettled(deletedList.map((delId) => deleteEmployeeFromSupabase(delId)));
        }
        const deletedIds = new Set(getDeletedEmployeeIds());

        // 1. Fetch employees (already filtered against deleted_employee_ids in fetchEmployeesFromSupabase)
        const cloudEmps = await fetchEmployeesFromSupabase();
        let authoritativeEmployees = employees.filter((e) => !deletedIds.has(e.id));
        if (cloudEmps !== null) {
          const cleanCloudEmps = cloudEmps.filter((e) => !deletedIds.has(e.id));
          if (cleanCloudEmps.length > 0 || isEmployeesModified()) {
            authoritativeEmployees = cleanCloudEmps;
            setEmployees(cleanCloudEmps);
            try {
              localStorage.setItem('tgi_employees_data', JSON.stringify(cleanCloudEmps));
            } catch {
              // ignore
            }
          }
        }
        const validEmpIds = new Set(authoritativeEmployees.map((e) => e.id));

        // 2. Fetch assets (and unassign any asset linked to a deleted employee)
        const cloudAssets = await fetchAssetsFromSupabase();
        if (cloudAssets !== null) {
          const cleanedAssets = cloudAssets.map((a) =>
            a.assignedToEmployeeId && deletedIds.has(a.assignedToEmployeeId)
              ? {
                  ...a,
                  assignedToEmployeeId: null,
                  assignedToEmployeeName: null,
                  assignedToEmployeeNik: null,
                  status: 'Tersedia' as const,
                }
              : a
          );
          setAssets(cleanedAssets);
        }

        // 3. Fetch payrolls & auto-generate missing payroll records only for active non-deleted employees
        const cloudPayrolls = await fetchPayrollsFromSupabase();
        const activeEmpsList = authoritativeEmployees.filter(
          (e) => e.isActive !== false && !deletedIds.has(e.id)
        );
        if (cloudPayrolls !== null) {
          const mergedPayrolls = activeEmpsList.map((emp) => {
            const found = cloudPayrolls.find((p) => p.employeeId === emp.id);
            if (found && found.totalGrossSalary > 0 && found.takeHomePay > 0) {
              return found;
            }
            const generated = calculatePayroll(emp, companyConfig.currentPayrollPeriod, 0, 0, 0);
            upsertPayrollToSupabase(generated);
            return generated;
          });
          setPayrolls(mergedPayrolls);
        } else {
          setPayrolls((prev) =>
            prev.filter((p) => !deletedIds.has(p.employeeId) && validEmpIds.has(p.employeeId))
          );
        }

        // 4. Fetch attendances (Presensi)
        const cloudAtts = await fetchAttendancesFromSupabase();
        if (cloudAtts !== null) {
          setAttendances(
            cloudAtts.filter((a) => !deletedIds.has(a.employeeId) && validEmpIds.has(a.employeeId))
          );
        }

        // 5. Fetch leave requests (Cuti & Izin)
        const cloudLeaves = await fetchLeaveRequestsFromSupabase();
        if (cloudLeaves !== null) {
          setLeaveRequests(
            cloudLeaves.filter((l) => !deletedIds.has(l.employeeId) && validEmpIds.has(l.employeeId))
          );
        }

        // 6. Fetch overtime requests (Lembur)
        const cloudOvertimes = await fetchOvertimeRequestsFromSupabase();
        if (cloudOvertimes !== null) {
          setOvertimeRequests(
            cloudOvertimes.filter(
              (o) => !deletedIds.has(o.employeeId) && validEmpIds.has(o.employeeId)
            )
          );
        }

        // 7. Fetch reimbursements (Klaim Biaya)
        const cloudReimbursements = await fetchReimbursementsFromSupabase();
        if (cloudReimbursements !== null) {
          setReimbursements(
            cloudReimbursements.filter(
              (r) => !deletedIds.has(r.employeeId) && validEmpIds.has(r.employeeId)
            )
          );
        }

        // 8. Clean up local states (reviews, cashAdvances, assetLogs, notifications) so they only reference valid real employees
        setReviews((prev) =>
          prev.filter((r) => !isLegacyDummyRecord(r) && validEmpIds.has(r.employeeId))
        );
        setCashAdvances((prev) =>
          prev.filter((c) => !isLegacyDummyRecord(c) && validEmpIds.has(c.employeeId))
        );
        setAssetLogs((prev) =>
          prev.filter(
            (l) =>
              !isLegacyDummyRecord(l) &&
              (!l.employeeId || validEmpIds.has(l.employeeId))
          )
        );
        setNotifications((prev) =>
          prev.filter(
            (n) =>
              !isLegacyDummyRecord(n) &&
              (!n.recipientEmployeeId || validEmpIds.has(n.recipientEmployeeId))
          )
        );
        setSystemAuditLogs((prev) => prev.filter((l) => !isLegacyDummyRecord(l)));
      }
    } catch (err) {
      console.warn('Supabase status check failed:', err);
    }
  };

  const handleTriggerSeed = async () => {
    setIsSeedingSupabase(true);
    try {
      const deletedIds = new Set(getDeletedEmployeeIds());
      const seedEmps = (employees.length > 0 ? employees : initialEmployees).filter(
        (e) => !deletedIds.has(e.id)
      );
      const seedPayrolls = (payrolls.length > 0 ? payrolls : initialPayrollRecords).filter(
        (p) => !deletedIds.has(p.employeeId)
      );
      const res = await autoSeedSupabaseIfEmpty(
        seedEmps,
        assets.length > 0 ? assets : initialCompanyAssets,
        seedPayrolls,
        true
      );
      if (res.seeded) {
        const freshEmps = await fetchEmployeesFromSupabase();
        if (freshEmps && freshEmps.length > 0) setEmployees(freshEmps);
        const freshAssets = await fetchAssetsFromSupabase();
        if (freshAssets && freshAssets.length > 0) setAssets(freshAssets);
      }
      const updatedStatus = await checkSupabaseStatus();
      setSupabaseStatus(updatedStatus);
    } catch (e) {
      console.error('Trigger seed error:', e);
    } finally {
      setIsSeedingSupabase(false);
    }
  };

  useEffect(() => {
    refreshSupabaseStatus();

    // Listen to real-time changes across all core tables
    const channel = supabase
      .channel('realtime-tgi-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload: any) => {
          const deletedIds = new Set(getDeletedEmployeeIds());
          if (payload.eventType === 'INSERT') {
            const newEmp = dbToEmployee(payload.new);
            if (deletedIds.has(newEmp.id)) return;
            setEmployees((prev) => {
              if (prev.some((e) => e.id === newEmp.id)) return prev;
              return [newEmp, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedEmp = dbToEmployee(payload.new);
            if (deletedIds.has(updatedEmp.id)) return;
            setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              addDeletedEmployeeId(oldId);
              setEmployees((prev) => prev.filter((e) => e.id !== oldId));
              setPayrolls((prev) => prev.filter((p) => p.employeeId !== oldId));
              setAttendances((prev) => prev.filter((a) => a.employeeId !== oldId));
              setLeaveRequests((prev) => prev.filter((l) => l.employeeId !== oldId));
              setOvertimeRequests((prev) => prev.filter((o) => o.employeeId !== oldId));
              setReimbursements((prev) => prev.filter((r) => r.employeeId !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_assets' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newAsset = dbToAsset(payload.new);
            setAssets((prev) => {
              if (prev.some((a) => a.id === newAsset.id)) return prev;
              return [newAsset, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedAsset = dbToAsset(payload.new);
            setAssets((prev) => prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setAssets((prev) => prev.filter((a) => a.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payrolls' },
        (payload: any) => {
          const deletedIds = new Set(getDeletedEmployeeIds());
          if (payload.eventType === 'INSERT') {
            const newPay = dbToPayroll(payload.new);
            if (deletedIds.has(newPay.employeeId)) return;
            setPayrolls((prev) => {
              if (prev.some((p) => p.id === newPay.id)) return prev;
              return [newPay, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPay = dbToPayroll(payload.new);
            if (deletedIds.has(updatedPay.employeeId)) return;
            setPayrolls((prev) => prev.map((p) => (p.id === updatedPay.id ? updatedPay : p)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setPayrolls((prev) => prev.filter((p) => p.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendances' },
        (payload: any) => {
          const deletedIds = new Set(getDeletedEmployeeIds());
          if (payload.eventType === 'INSERT') {
            const newAtt = dbToAttendance(payload.new);
            if (deletedIds.has(newAtt.employeeId)) return;
            setAttendances((prev) => {
              if (prev.some((a) => a.id === newAtt.id)) return prev;
              return [newAtt, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedAtt = dbToAttendance(payload.new);
            if (deletedIds.has(updatedAtt.employeeId)) return;
            setAttendances((prev) => prev.map((a) => (a.id === updatedAtt.id ? updatedAtt : a)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setAttendances((prev) => prev.filter((a) => a.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        (payload: any) => {
          const deletedIds = new Set(getDeletedEmployeeIds());
          if (payload.eventType === 'INSERT') {
            const newLeave = dbToLeave(payload.new);
            if (deletedIds.has(newLeave.employeeId)) return;
            setLeaveRequests((prev) => {
              if (prev.some((l) => l.id === newLeave.id)) return prev;
              return [newLeave, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedLeave = dbToLeave(payload.new);
            if (deletedIds.has(updatedLeave.employeeId)) return;
            setLeaveRequests((prev) => prev.map((l) => (l.id === updatedLeave.id ? updatedLeave : l)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setLeaveRequests((prev) => prev.filter((l) => l.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overtime_requests' },
        (payload: any) => {
          const deletedIds = new Set(getDeletedEmployeeIds());
          if (payload.eventType === 'INSERT') {
            const newOt = dbToOvertime(payload.new);
            if (deletedIds.has(newOt.employeeId)) return;
            setOvertimeRequests((prev) => {
              if (prev.some((o) => o.id === newOt.id)) return prev;
              return [newOt, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedOt = dbToOvertime(payload.new);
            if (deletedIds.has(updatedOt.employeeId)) return;
            setOvertimeRequests((prev) => prev.map((o) => (o.id === updatedOt.id ? updatedOt : o)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setOvertimeRequests((prev) => prev.filter((o) => o.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reimbursements' },
        (payload: any) => {
          const deletedIds = new Set(getDeletedEmployeeIds());
          if (payload.eventType === 'INSERT') {
            const newClaim = dbToReimbursement(payload.new);
            if (deletedIds.has(newClaim.employeeId)) return;
            setReimbursements((prev) => {
              if (prev.some((c) => c.id === newClaim.id)) return prev;
              return [newClaim, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedClaim = dbToReimbursement(payload.new);
            if (deletedIds.has(updatedClaim.employeeId)) return;
            setReimbursements((prev) => prev.map((c) => (c.id === updatedClaim.id ? updatedClaim : c)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setReimbursements((prev) => prev.filter((c) => c.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handlers for Employees
  const handleAddEmployee = (newEmp: Employee) => {
    removeDeletedEmployeeId(newEmp.id);
    markEmployeesModified();
    setEmployees((prev) => {
      const next = [newEmp, ...prev.filter((e) => e.id !== newEmp.id)];
      try {
        localStorage.setItem('tgi_employees_data', JSON.stringify(next));
      } catch (err) {
        console.error('Storage error', err);
      }
      return next;
    });
    // Generate initial payroll record for new employee
    const newPayroll = calculatePayroll(newEmp, companyConfig.currentPayrollPeriod, 0, 0, 0);
    setPayrolls((prev) => [newPayroll, ...prev]);

    // Persist to Supabase asynchronously with fallback
    insertEmployeeToSupabase(newEmp);
    upsertPayrollToSupabase(newPayroll);

    logActivity(
      'EMPLOYEE_CREATE',
      'Data Karyawan',
      `Menambahkan karyawan baru: ${newEmp.fullName} (${newEmp.role}) di departemen ${newEmp.department}.`,
      {
        targetId: newEmp.id,
        targetName: `${newEmp.fullName} (NIK: ${newEmp.nik})`,
        newValue: `Gaji Pokok: Rp ${newEmp.baseSalary.toLocaleString('id-ID')}, Tunjangan: Rp ${(newEmp.allowances?.position || 0).toLocaleString('id-ID')}, Status: ${newEmp.employmentStatus}`,
        severity: 'success',
      }
    );
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    markEmployeesModified();
    const oldEmp = employees.find((e) => e.id === updatedEmp.id);
    setEmployees((prev) => {
      const next = prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e));
      try {
        localStorage.setItem('tgi_employees_data', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to persist updated employees to localStorage', err);
      }
      return next;
    });

    // Persist to Supabase asynchronously so Portal Admin & Portal Karyawan stay synced
    updateEmployeeInSupabase(updatedEmp);

    // Update matching payroll calculation
    setPayrolls((prev) =>
      prev.map((p) => {
        if (p.employeeId === updatedEmp.id) {
          const otMins =
            p.overtimeMinutes !== undefined
              ? p.overtimeMinutes
              : Math.round(p.overtimePay / Math.max(100, getOvertimeRatePerMinute(updatedEmp, 1.5)));
          return calculatePayroll(
            updatedEmp,
            companyConfig.currentPayrollPeriod,
            otMins,
            p.bonus,
            p.lateDeduction > 0 ? 30 : 0,
            p.cashAdvanceDeduction,
            p.cashAdvanceNotes
          );
        }
        return p;
      })
    );

    if (
      oldEmp &&
      (oldEmp.baseSalary !== updatedEmp.baseSalary ||
        (oldEmp.allowances?.position || 0) !== (updatedEmp.allowances?.position || 0) ||
        (oldEmp.allowances?.meal || 0) !== (updatedEmp.allowances?.meal || 0))
    ) {
      logActivity(
        'SALARY_UPDATE',
        'Gaji & Payroll',
        `Mengubah komponen gaji karyawan ${updatedEmp.fullName} (NIK: ${updatedEmp.nik}): Gaji Pokok Rp ${oldEmp.baseSalary.toLocaleString('id-ID')} → Rp ${updatedEmp.baseSalary.toLocaleString('id-ID')}.`,
        {
          targetId: updatedEmp.id,
          targetName: `${updatedEmp.fullName} (NIK: ${updatedEmp.nik})`,
          oldValue: `Gaji Pokok: Rp ${oldEmp.baseSalary.toLocaleString('id-ID')}, Tunj. Jabatan: Rp ${(oldEmp.allowances?.position || 0).toLocaleString('id-ID')}`,
          newValue: `Gaji Pokok: Rp ${updatedEmp.baseSalary.toLocaleString('id-ID')}, Tunj. Jabatan: Rp ${(updatedEmp.allowances?.position || 0).toLocaleString('id-ID')}`,
          severity: 'danger',
          notes: 'Perubahan komponen gaji dan tunjangan karyawan.',
        }
      );
    } else if (oldEmp && oldEmp.avatarUrl !== updatedEmp.avatarUrl) {
      logActivity(
        'EMPLOYEE_UPDATE',
        'Data Karyawan',
        `Memperbarui Foto Profil karyawan ${updatedEmp.fullName} (NIK: ${updatedEmp.nik}) dan menyinkronkan ke Portal Admin HR.`,
        {
          targetId: updatedEmp.id,
          targetName: updatedEmp.fullName,
          newValue: 'Foto Profil Diperbarui',
          severity: 'success',
        }
      );
    } else if (oldEmp && oldEmp.ktpPhotoUrl !== updatedEmp.ktpPhotoUrl) {
      logActivity(
        'EMPLOYEE_UPDATE',
        'Data Karyawan',
        `Mengunggah / memperbarui dokumen Foto KTP karyawan ${updatedEmp.fullName} (NIK: ${updatedEmp.nik}).`,
        {
          targetId: updatedEmp.id,
          targetName: updatedEmp.fullName,
          newValue: updatedEmp.ktpPhotoUrl ? 'Dokumen KTP Terunggah' : 'Dokumen KTP Dihapus',
          severity: 'success',
        }
      );
    } else {
      logActivity(
        'EMPLOYEE_UPDATE',
        'Data Karyawan',
        `Memperbarui profil data karyawan ${updatedEmp.fullName} (NIK: ${updatedEmp.nik}).`,
        {
          targetId: updatedEmp.id,
          targetName: updatedEmp.fullName,
          severity: 'info',
        }
      );
    }
  };

  const handleDeleteEmployee = (id: string) => {
    const empToDelete = employees.find((e) => e.id === id);

    // 1. Track deleted employee ID in localStorage (deleted_employee_ids) & mark employee data modified so it is never re-seeded or restored
    addDeletedEmployeeId(id);
    markEmployeesModified();

    // 2. Permanently delete from Supabase (DELETE FROM employees WHERE id = ...) and dependent tables
    deleteEmployeeFromSupabase(id);

    // 3. Remove from employees state & localStorage immediately
    setEmployees((prev) => {
      const remaining = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem('tgi_employees_data', JSON.stringify(remaining));
      } catch (err) {
        console.error('Storage error', err);
      }
      return remaining;
    });

    // 4. Clean up all related records in state & localStorage so Dashboard, Payroll, Presensi, and Portal Karyawan stay 100% consistent
    setPayrolls((prev) => {
      const next = prev.filter((p) => p.employeeId !== id);
      try {
        localStorage.setItem('tgi_payrolls_data', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setAttendances((prev) => {
      const next = prev.filter((a) => a.employeeId !== id);
      try {
        localStorage.setItem('tgi_attendances_data', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setLeaveRequests((prev) => {
      const next = prev.filter((l) => l.employeeId !== id);
      try {
        localStorage.setItem('tgi_leave_requests_data', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setOvertimeRequests((prev) => {
      const next = prev.filter((o) => o.employeeId !== id);
      try {
        localStorage.setItem('tgi_overtime_requests_data', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setReimbursements((prev) => {
      const next = prev.filter((r) => r.employeeId !== id);
      try {
        localStorage.setItem('tgi_reimbursements_data', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setCashAdvances((prev) => {
      const next = prev.filter((c) => c.employeeId !== id);
      try {
        localStorage.setItem('tgi_cash_advances_data', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setReviews((prev) => {
      const next = prev.filter((r) => r.employeeId !== id);
      try {
        localStorage.setItem('tgi_performance_reviews', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setAssets((prev) => {
      const next = prev.map((a) =>
        a.assignedToEmployeeId === id
          ? {
              ...a,
              assignedToEmployeeId: null,
              assignedToEmployeeName: null,
              assignedToEmployeeNik: null,
              status: 'Tersedia' as const,
            }
          : a
      );
      try {
        localStorage.setItem('tgi_company_assets', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    if (activeEmployeeId === id) {
      const remaining = employees.filter((e) => e.id !== id);
      const nextId = remaining[0]?.id || '';
      setActiveEmployeeId(nextId);
      try {
        localStorage.setItem('tgi_active_employee_id', nextId);
      } catch (e) {
        console.error(e);
      }
    }

    logActivity(
      'EMPLOYEE_DELETE',
      'Data Karyawan',
      `Menghapus permanen data karyawan ${empToDelete?.fullName || id} (NIK: ${empToDelete?.nik || id}) - Jabatan: ${empToDelete?.role || '-'} dari database aktif (Supabase & LocalStorage).`,
      {
        targetId: id,
        targetName: empToDelete?.fullName || id,
        oldValue: empToDelete
          ? `Gaji Pokok: Rp ${empToDelete.baseSalary.toLocaleString('id-ID')}, Dept: ${empToDelete.department}, Status: ${empToDelete.employmentStatus}`
          : undefined,
        newValue: 'Data karyawan dan record payroll dihapus permanen (Supabase & LocalStorage)',
        severity: 'danger',
        notes: 'Penghapusan arsip karyawan oleh admin berwenang.',
      }
    );
  };

  // Handlers for Payroll
  const handleRecalculatePayroll = () => {
    const currentPeriod = companyConfig.currentPayrollPeriod;
    const isPeriodLocked = Boolean(
      (companyConfig.lockedPayrollPeriods || []).includes(currentPeriod)
    );
    if (isPeriodLocked) {
      return;
    }

    const waivedIdsForPeriod = companyConfig.waivedLateEmployeeIds?.[currentPeriod] || [];

    const updated = employees.map((emp) => {
      // Find approved overtimes for this employee (in minutes)
      const employeeOts = overtimeRequests.filter(
        (o) => o.employeeId === emp.id && o.status === 'Disetujui'
      );
      const totalOtMinutes = employeeOts.reduce(
        (acc, curr) => acc + getOvertimeMinutes(curr),
        0
      );

      // Deduplicated & Shift-evaluated Attendance Penalty Summary
      const penaltySummary = calculateEmployeeAttendancePenalty(
        emp,
        attendances,
        companyConfig.workShifts,
        companyConfig.attendancePenaltyPolicy
      );

      // Find existing bonus & cash advance deduction if any
      const existingRecord = payrolls.find((p) => p.employeeId === emp.id);
      const bonus = existingRecord ? existingRecord.bonus : 0;
      const caDeduct = existingRecord ? existingRecord.cashAdvanceDeduction : 0;
      const caNotes = existingRecord ? existingRecord.cashAdvanceNotes : undefined;
      const isLateFeeWaived = Boolean(
        existingRecord?.isLateFeeWaived !== undefined
          ? existingRecord.isLateFeeWaived
          : waivedIdsForPeriod.includes(emp.id)
      );

      const computed = calculatePayroll(
        emp,
        currentPeriod,
        totalOtMinutes,
        bonus,
        penaltySummary.totalLateMinutes,
        caDeduct,
        caNotes,
        {
          lateFrequency: penaltySummary.lateFrequency,
          totalLateMinutes: penaltySummary.totalLateMinutes,
          latePenaltyAmount: penaltySummary.latePenaltyAmount,
          alphaDaysCount: penaltySummary.alphaDaysCount,
          alphaPenaltyAmount: penaltySummary.alphaPenaltyAmount,
          attendanceDeductionNotes: penaltySummary.deductionNotes,
          isLateFeeWaived,
          originalLateDeduction: penaltySummary.totalDeductionAmount,
          waiverReason: existingRecord?.waiverReason || 'Dispensasi Tugas Luar / HR',
          penaltyPolicy: companyConfig.attendancePenaltyPolicy,
        }
      );

      const finalRecord = existingRecord
        ? {
            ...computed,
            id: existingRecord.id,
            referenceNumber: existingRecord.referenceNumber || computed.referenceNumber,
          }
        : computed;

      upsertPayrollToSupabase(finalRecord);
      return finalRecord;
    });

    setPayrolls(updated);

    logActivity(
      'PAYROLL_RUN',
      'Gaji & Payroll',
      `Menjalankan batch kalkulasi payroll periode "${currentPeriod}" (lembur per menit + potongan otomatis terlambat/absen) untuk seluruh ${employees.length} karyawan aktif.`,
      {
        targetId: `payroll-${currentPeriod}`,
        targetName: `Batch Payroll ${currentPeriod}`,
        severity: 'warning',
        notes: 'Sinkronisasi durasi menit lembur terverifikasi dan potongan denda keterlambatan/alpha.',
      }
    );
  };

  const handleChangePayrollPeriod = (newPeriod: string) => {
    if (!newPeriod || newPeriod === companyConfig.currentPayrollPeriod) return;
    const prevPeriod = companyConfig.currentPayrollPeriod;
    setCompanyConfig((prev) => ({
      ...prev,
      currentPayrollPeriod: newPeriod,
    }));

    setPayrolls((prev) =>
      prev.map((p) => {
        const cleanPeriod = newPeriod.replace(/\s+/g, '').toUpperCase();
        const emp = employees.find((e) => e.id === p.employeeId);
        return {
          ...p,
          period: newPeriod,
          referenceNumber: emp ? `TGI-PAY-${cleanPeriod}-${emp.nik}` : p.referenceNumber,
        };
      })
    );

    logActivity(
      'COMPANY_SETTINGS_UPDATE',
      'Gaji & Payroll',
      `Mengganti periode aktif penggajian (Payroll) dari "${prevPeriod}" menjadi "${newPeriod}".`,
      {
        targetId: `period-${newPeriod}`,
        targetName: `Periode Payroll: ${newPeriod}`,
        oldValue: prevPeriod,
        newValue: newPeriod,
        severity: 'info',
      }
    );
  };

  const handleToggleLockPayrollPeriod = (periodToToggle?: string) => {
    const targetPeriod = periodToToggle || companyConfig.currentPayrollPeriod;
    const currentLocked = companyConfig.lockedPayrollPeriods || [];
    const isCurrentlyLocked = currentLocked.includes(targetPeriod);
    const nextLocked = isCurrentlyLocked
      ? currentLocked.filter((p) => p !== targetPeriod)
      : [...currentLocked, targetPeriod];
    const nowIso = new Date().toISOString();

    setCompanyConfig((prev) => ({
      ...prev,
      lockedPayrollPeriods: nextLocked,
    }));

    // Snapshot & freeze current syncedPayrolls into payrolls state & Supabase so THP will not change when locked
    const frozenRecords = syncedPayrolls.map((rec) => {
      const updatedRec: PayrollRecord = {
        ...rec,
        period: targetPeriod,
        isLocked: !isCurrentlyLocked,
        lockedAt: !isCurrentlyLocked ? nowIso : undefined,
        paymentStatus: !isCurrentlyLocked ? 'Lunas' : rec.paymentStatus,
      };
      upsertPayrollToSupabase(updatedRec);
      return updatedRec;
    });

    setPayrolls(frozenRecords);

    logActivity(
      'PAYROLL_RUN',
      'Gaji & Payroll',
      !isCurrentlyLocked
        ? `Mengunci / memfinalisasi perhitungan Payroll periode "${targetPeriod}". Nilai Take Home Pay (THP) seluruh karyawan telah dibekukan.`
        : `Membuka kembali kunci (Unlock) periode Payroll "${targetPeriod}" untuk penyesuaian data.`,
      {
        targetId: `lock-payroll-${targetPeriod}`,
        targetName: `Finalisasi Payroll ${targetPeriod}`,
        oldValue: isCurrentlyLocked ? 'Terkunci (Locked)' : 'Terbuka (Draft/Active)',
        newValue: !isCurrentlyLocked ? 'Terkunci (Finalized THP)' : 'Terbuka (Unlocked)',
        severity: !isCurrentlyLocked ? 'success' : 'warning',
      }
    );
  };

  const handleToggleWaiveLatePenalty = (employeeId: string, reason?: string) => {
    const currentPeriod = companyConfig.currentPayrollPeriod;
    const isPeriodLocked = Boolean(
      (companyConfig.lockedPayrollPeriods || []).includes(currentPeriod)
    );
    if (isPeriodLocked) return;

    const currentWaivedMap = companyConfig.waivedLateEmployeeIds || {};
    const currentList = currentWaivedMap[currentPeriod] || [];
    const emp = employees.find((e) => e.id === employeeId);
    const existingRec = syncedPayrolls.find((p) => p.employeeId === employeeId);
    const currentlyWaived = Boolean(
      existingRec?.isLateFeeWaived !== undefined
        ? existingRec.isLateFeeWaived
        : currentList.includes(employeeId)
    );
    const nextWaivedState = !currentlyWaived;

    const nextList = nextWaivedState
      ? Array.from(new Set([...currentList, employeeId]))
      : currentList.filter((id) => id !== employeeId);

    setCompanyConfig((prev) => ({
      ...prev,
      waivedLateEmployeeIds: {
        ...(prev.waivedLateEmployeeIds || {}),
        [currentPeriod]: nextList,
      },
    }));

    if (emp) {
      const penaltySummary = calculateEmployeeAttendancePenalty(
        emp,
        attendances,
        companyConfig.workShifts,
        companyConfig.attendancePenaltyPolicy
      );
      const effectiveOtMins = existingRec?.overtimeMinutes || 0;
      const updatedRecord = calculatePayroll(
        emp,
        currentPeriod,
        effectiveOtMins,
        existingRec?.bonus || 0,
        penaltySummary.totalLateMinutes,
        existingRec?.cashAdvanceDeduction || 0,
        existingRec?.cashAdvanceNotes,
        {
          lateFrequency: penaltySummary.lateFrequency,
          totalLateMinutes: penaltySummary.totalLateMinutes,
          latePenaltyAmount: penaltySummary.latePenaltyAmount,
          alphaDaysCount: penaltySummary.alphaDaysCount,
          alphaPenaltyAmount: penaltySummary.alphaPenaltyAmount,
          attendanceDeductionNotes: penaltySummary.deductionNotes,
          isLateFeeWaived: nextWaivedState,
          originalLateDeduction: penaltySummary.totalDeductionAmount,
          waiverReason: reason || 'Dispensasi Tugas Luar / Kebijakan HR',
          penaltyPolicy: companyConfig.attendancePenaltyPolicy,
        }
      );

      const finalRec: PayrollRecord = existingRec
        ? {
            ...updatedRecord,
            id: existingRec.id,
            referenceNumber: existingRec.referenceNumber || updatedRecord.referenceNumber,
          }
        : updatedRecord;

      setPayrolls((prev) => {
        const exists = prev.some((p) => p.employeeId === employeeId);
        if (exists) {
          return prev.map((p) => (p.employeeId === employeeId ? finalRec : p));
        }
        return [...prev, finalRec];
      });
      upsertPayrollToSupabase(finalRec);

      logActivity(
        'SALARY_UPDATE',
        'Gaji & Payroll',
        nextWaivedState
          ? `Memberikan Dispensasi / Bebas Denda Keterlambatan untuk ${emp.fullName} (Periode ${currentPeriod}). Potongan denda Rp ${penaltySummary.totalDeductionAmount.toLocaleString('id-ID')} di-nol-kan tanpa menghapus log presensi.`
          : `Membatalkan Dispensasi Denda Keterlambatan untuk ${emp.fullName} (Periode ${currentPeriod}). Potongan denda kembali ke Rp ${penaltySummary.totalDeductionAmount.toLocaleString('id-ID')}.`,
        {
          targetId: emp.id,
          targetName: emp.fullName,
          oldValue: nextWaivedState
            ? `Denda: Rp ${penaltySummary.totalDeductionAmount.toLocaleString('id-ID')}`
            : 'Dispensasi Denda: Rp 0',
          newValue: nextWaivedState
            ? `Dispensasi Denda: Rp 0 (THP: Rp ${finalRec.takeHomePay.toLocaleString('id-ID')})`
            : `Denda Aktif: Rp ${penaltySummary.totalDeductionAmount.toLocaleString('id-ID')} (THP: Rp ${finalRec.takeHomePay.toLocaleString('id-ID')})`,
          severity: nextWaivedState ? 'info' : 'warning',
        }
      );
    }
  };

  const handleUpdatePenaltyPolicy = (newPolicy: AttendancePenaltyPolicy) => {
    setCompanyConfig((prev) => ({
      ...prev,
      attendancePenaltyPolicy: newPolicy,
    }));

    logActivity(
      'COMPANY_SETTINGS_UPDATE',
      'Pengaturan Sistem',
      `Memperbarui aturan denda keterlambatan & potongan absen: Toleransi ${newPolicy.gracePeriodMinutes} mnt, Skema Terlambat "${newPolicy.latePenaltyScheme}", Skema Alpha "${newPolicy.alphaPenaltyScheme}".`,
      {
        targetId: 'attendance-penalty-policy',
        targetName: 'Aturan Denda Keterlambatan & Absen',
        newValue: `Aktif: ${newPolicy.enabled ? 'Ya' : 'Tidak'}, Toleransi: ${newPolicy.gracePeriodMinutes} mnt, Flat: Rp ${newPolicy.flatLatePenaltyAmount.toLocaleString('id-ID')}, Per Menit: Rp ${newPolicy.perMinutePenaltyAmount.toLocaleString('id-ID')}`,
        severity: 'warning',
      }
    );
  };

  const handleUpdatePayrollRecord = (record: PayrollRecord) => {
    setPayrolls((prev) => {
      const exists = prev.some((p) => p.id === record.id || p.employeeId === record.employeeId);
      if (exists) {
        return prev.map((p) =>
          p.id === record.id || p.employeeId === record.employeeId ? record : p
        );
      }
      return [...prev, record];
    });
    upsertPayrollToSupabase(record);
    const emp = employees.find((e) => e.id === record.employeeId);
    const empName = emp?.fullName || record.employeeId;

    logActivity(
      'SALARY_UPDATE',
      'Gaji & Payroll',
      `Mengubah rincian slip gaji untuk ${empName} periode ${record.period}: Total THP Rp ${record.takeHomePay.toLocaleString('id-ID')}.`,
      {
        targetId: record.id,
        targetName: empName,
        newValue: `Take Home Pay: Rp ${record.takeHomePay.toLocaleString('id-ID')}, Bonus: Rp ${record.bonus.toLocaleString('id-ID')}, Lembur: Rp ${record.overtimePay.toLocaleString('id-ID')}`,
        severity: 'danger',
        notes: 'Penyesuaian manual rincian gaji / bonus karyawan.',
      }
    );
  };

  // Handlers for Attendance & Work Shifts (Enforcing Anti-Duplicate 1x Check-In & 1x Check-Out per Shift/Day + Automatic Late Minutes Calculation)
  const handleAddAttendance = (att: AttendanceRecord) => {
    const emp = employees.find((e) => e.id === att.employeeId);
    const empShift = getEmployeeShift(emp, companyConfig.workShifts);
    const policy = getAttendancePenaltyPolicy(companyConfig.attendancePenaltyPolicy);
    const effectiveGrace = policy.useShiftGracePeriod
      ? empShift.gracePeriodMinutes
      : policy.gracePeriodMinutes;

    const isNonPresent =
      att.status === 'Sakit' ||
      att.status === 'Izin' ||
      att.status === 'Cuti' ||
      att.status === 'Alpa';

    const evaluatedInput =
      !isNonPresent && att.checkIn && att.checkIn !== '-' && att.checkIn.includes(':')
        ? evaluateAttendanceAgainstShift(att.checkIn, att.checkOut, empShift, effectiveGrace)
        : null;

    const normalizedAtt: AttendanceRecord = evaluatedInput
      ? {
          ...att,
          status: evaluatedInput.status,
          lateMinutes: evaluatedInput.lateMinutes,
          earlyLeaveMinutes: evaluatedInput.earlyLeaveMinutes,
          workHours: evaluatedInput.workHours,
          shiftId: att.shiftId || empShift.id,
          shiftName: att.shiftName || empShift.name,
          scheduledCheckIn: att.scheduledCheckIn || empShift.checkInTime,
          scheduledCheckOut: att.scheduledCheckOut || empShift.checkOutTime,
        }
      : {
          ...att,
          lateMinutes: 0,
        };

    let recordToPersist: AttendanceRecord = normalizedAtt;

    setAttendances((prev) => {
      // Find any existing record for the same employee and date
      const existingSameDay = prev.find(
        (a) =>
          a.id === normalizedAtt.id ||
          (a.employeeId === normalizedAtt.employeeId && a.date === normalizedAtt.date)
      );

      if (existingSameDay) {
        const alreadyHasCheckIn = Boolean(
          existingSameDay.checkIn &&
            existingSameDay.checkIn.trim() !== '' &&
            existingSameDay.checkIn !== '-'
        );
        const alreadyHasCheckOut = Boolean(
          existingSameDay.checkOut &&
            existingSameDay.checkOut.trim() !== '' &&
            existingSameDay.checkOut !== '-'
        );

        // If both Check-In and Check-Out are already recorded for today, prevent duplicate overwrite
        if (alreadyHasCheckIn && alreadyHasCheckOut) {
          recordToPersist = existingSameDay;
          return prev;
        }

        const finalCheckIn = alreadyHasCheckIn ? existingSameDay.checkIn : normalizedAtt.checkIn;
        const finalCheckOut = alreadyHasCheckOut
          ? existingSameDay.checkOut
          : normalizedAtt.checkOut;

        const mergedEval =
          !isNonPresent && finalCheckIn && finalCheckIn !== '-' && finalCheckIn.includes(':')
            ? evaluateAttendanceAgainstShift(
                finalCheckIn,
                finalCheckOut,
                empShift,
                effectiveGrace
              )
            : null;

        // Merge: preserve original 1st Check-In data while allowing 1x Check-Out
        const merged: AttendanceRecord = {
          ...existingSameDay,
          ...normalizedAtt,
          id: existingSameDay.id,
          checkIn: finalCheckIn,
          checkInFullTimestamp:
            existingSameDay.checkInFullTimestamp || normalizedAtt.checkInFullTimestamp,
          facePhotoSnapshot: existingSameDay.facePhotoSnapshot || normalizedAtt.facePhotoSnapshot,
          locationCoords: existingSameDay.locationCoords || normalizedAtt.locationCoords,
          locationAddress: existingSameDay.locationAddress || normalizedAtt.locationAddress,
          checkOut: finalCheckOut,
          checkOutFullTimestamp: alreadyHasCheckOut
            ? existingSameDay.checkOutFullTimestamp
            : normalizedAtt.checkOutFullTimestamp,
          checkOutPhotoSnapshot: alreadyHasCheckOut
            ? existingSameDay.checkOutPhotoSnapshot
            : normalizedAtt.checkOutPhotoSnapshot,
          status: mergedEval ? mergedEval.status : normalizedAtt.status,
          lateMinutes: mergedEval ? mergedEval.lateMinutes : 0,
          earlyLeaveMinutes: mergedEval
            ? mergedEval.earlyLeaveMinutes
            : normalizedAtt.earlyLeaveMinutes,
          workHours: mergedEval ? mergedEval.workHours : normalizedAtt.workHours,
        };
        recordToPersist = merged;
        return prev.map((a) => (a.id === existingSameDay.id ? merged : a));
      }

      return [normalizedAtt, ...prev];
    });

    upsertAttendanceToSupabase(recordToPersist);
  };

  const handleUpdateAttendance = (updatedAtt: AttendanceRecord) => {
    const emp = employees.find((e) => e.id === updatedAtt.employeeId);
    const empShift = getEmployeeShift(emp, companyConfig.workShifts);
    const policy = getAttendancePenaltyPolicy(companyConfig.attendancePenaltyPolicy);
    const effectiveGrace = policy.useShiftGracePeriod
      ? empShift.gracePeriodMinutes
      : policy.gracePeriodMinutes;

    const isNonPresent =
      updatedAtt.status === 'Sakit' ||
      updatedAtt.status === 'Izin' ||
      updatedAtt.status === 'Cuti' ||
      updatedAtt.status === 'Alpa';

    const hasValidCheckIn =
      !isNonPresent &&
      Boolean(updatedAtt.checkIn && updatedAtt.checkIn !== '-' && updatedAtt.checkIn.includes(':'));

    const evalRes = hasValidCheckIn
      ? evaluateAttendanceAgainstShift(
          updatedAtt.checkIn,
          updatedAtt.checkOut,
          empShift,
          effectiveGrace
        )
      : null;

    const finalStatus = isNonPresent
      ? updatedAtt.status
      : updatedAtt.isManualStatus
      ? updatedAtt.status
      : evalRes
      ? evalRes.status
      : updatedAtt.status;

    const finalLateMinutes = isNonPresent
      ? 0
      : updatedAtt.isManualStatus
      ? updatedAtt.status === 'Hadir Tepat Waktu'
        ? 0
        : updatedAtt.lateMinutes > 0
        ? updatedAtt.lateMinutes
        : Math.max(1, evalRes?.rawLateMinutes || evalRes?.lateMinutes || 0)
      : evalRes
      ? evalRes.lateMinutes
      : 0;

    const normalizedAtt: AttendanceRecord = {
      ...updatedAtt,
      checkIn: isNonPresent ? '-' : updatedAtt.checkIn || '-',
      checkOut: isNonPresent ? '-' : updatedAtt.checkOut || '-',
      status: finalStatus,
      lateMinutes: finalLateMinutes,
      earlyLeaveMinutes: isNonPresent ? 0 : evalRes ? evalRes.earlyLeaveMinutes : 0,
      workHours: isNonPresent ? 0 : evalRes ? evalRes.workHours : updatedAtt.workHours || 0,
      shiftId: updatedAtt.shiftId || empShift.id,
      shiftName: updatedAtt.shiftName || empShift.name,
      scheduledCheckIn: empShift.checkInTime || updatedAtt.scheduledCheckIn || '09:00',
      scheduledCheckOut: empShift.checkOutTime || updatedAtt.scheduledCheckOut || '17:30',
    };

    const duplicateIdsToDelete: string[] = [];

    setAttendances((prev) => {
      const next: AttendanceRecord[] = [];
      let replaced = false;

      for (const a of prev) {
        const isSameRecord = a.id === normalizedAtt.id;
        const isSameDayAndEmployee =
          a.employeeId === normalizedAtt.employeeId && a.date === normalizedAtt.date;

        if (isSameRecord || isSameDayAndEmployee) {
          if (!replaced) {
            next.push(normalizedAtt);
            replaced = true;
          } else if (a.id !== normalizedAtt.id) {
            duplicateIdsToDelete.push(a.id);
          }
        } else {
          next.push(a);
        }
      }

      if (!replaced) {
        next.unshift(normalizedAtt);
      }

      try {
        localStorage.setItem('tgi_attendances_data', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save updated attendances', err);
      }
      return next;
    });

    upsertAttendanceToSupabase(normalizedAtt);
    duplicateIdsToDelete.forEach((dupId) => deleteAttendanceFromSupabase(dupId));

    logActivity(
      'COMPANY_SETTINGS_UPDATE',
      'Data Karyawan',
      `Admin memperbarui log presensi harian ${emp?.fullName || updatedAtt.employeeId} (${updatedAtt.date}): Jam Masuk ${normalizedAtt.checkIn}, Jam Pulang ${normalizedAtt.checkOut}, Status "${normalizedAtt.status}".`,
      {
        targetId: normalizedAtt.id,
        targetName: `${emp?.fullName || updatedAtt.employeeId} (${updatedAtt.date})`,
        newValue: `Masuk: ${normalizedAtt.checkIn}, Pulang: ${normalizedAtt.checkOut}, Status: ${normalizedAtt.status}${normalizedAtt.lateMinutes > 0 ? ` (Terlambat ${normalizedAtt.lateMinutes} mnt)` : ''}`,
        severity: 'info',
      }
    );
  };

  const handleDeleteAttendance = (attId: string, employeeId?: string, date?: string) => {
    const targetAtt = attendances.find((a) => a.id === attId);
    const targetEmpId = employeeId || targetAtt?.employeeId;
    const targetDate = date || targetAtt?.date;
    const emp = employees.find((e) => e.id === targetEmpId);

    const idsToDelete = new Set<string>([attId]);
    attendances.forEach((a) => {
      if (
        a.id === attId ||
        (targetEmpId && targetDate && a.employeeId === targetEmpId && a.date === targetDate)
      ) {
        idsToDelete.add(a.id);
      }
    });

    setAttendances((prev) => {
      const next = prev.filter((a) => !idsToDelete.has(a.id));
      try {
        localStorage.setItem('tgi_attendances_data', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save attendances after deletion', err);
      }
      return next;
    });

    idsToDelete.forEach((delId) => deleteAttendanceFromSupabase(delId));

    logActivity(
      'COMPANY_SETTINGS_UPDATE',
      'Data Karyawan',
      `Admin menghapus log presensi harian ${emp?.fullName || targetEmpId || attId} pada tanggal ${targetDate || '-'}.`,
      {
        targetId: attId,
        targetName: `${emp?.fullName || targetEmpId || 'Karyawan'} (${targetDate || '-'})`,
        oldValue: targetAtt
          ? `Masuk: ${targetAtt.checkIn}, Pulang: ${targetAtt.checkOut}, Status: ${targetAtt.status}`
          : undefined,
        newValue: 'Log presensi dihapus permanen',
        severity: 'warning',
      }
    );
  };

  const handleUpdateShifts = (newShifts: WorkShift[]) => {
    const validShifts = newShifts.length > 0 ? newShifts : DEFAULT_WORK_SHIFTS;
    const defaultShift = validShifts.find((s) => s.isDefault) || validShifts[0];
    const validShiftIdsAndCodes = new Set<string>();
    validShifts.forEach((s) => {
      validShiftIdsAndCodes.add(s.id);
      if (s.code) validShiftIdsAndCodes.add(s.code);
    });

    setCompanyConfig((prev) => {
      const updatedConfig = {
        ...prev,
        workShifts: validShifts,
      };
      try {
        localStorage.setItem('tgi_company_config', JSON.stringify(updatedConfig));
      } catch (err) {
        console.error('Failed to persist company config', err);
      }
      return updatedConfig;
    });

    // Ensure employees whose previous shift was deleted are automatically reassigned to the default shift & synced to Supabase
    setEmployees((prev) => {
      let hasReassigned = false;
      const next = prev.map((e) => {
        if (e.shiftId && !validShiftIdsAndCodes.has(e.shiftId)) {
          hasReassigned = true;
          const updatedEmp = { ...e, shiftId: defaultShift.id };
          updateEmployeeInSupabase(updatedEmp);
          return updatedEmp;
        }
        return e;
      });
      if (hasReassigned) {
        try {
          localStorage.setItem('tgi_employees_data', JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return hasReassigned ? next : prev;
    });

    logActivity(
      'SHIFT_SCHEDULE_UPDATE',
      'Pengaturan Sistem',
      `Memperbarui konfigurasi jadwal shift jam masuk, jam pulang, lokasi, & hari kerja (${validShifts.length} shift aktif).`,
      {
        targetId: 'work-shifts',
        targetName: 'Jadwal Shift Jam Kerja',
        newValue: validShifts
          .map(
            (s) =>
              `${s.code} (${s.name}): ${s.checkInTime}-${s.checkOutTime}, ${s.workDays?.length || 5} Hari/Mgg`
          )
          .join(' | '),
        severity: 'info',
      }
    );
  };

  const handleAssignEmployeeShift = (employeeId: string, shiftId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    const shift = (companyConfig.workShifts || DEFAULT_WORK_SHIFTS).find((s) => s.id === shiftId);

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === employeeId) {
          const updatedEmp = { ...e, shiftId };
          updateEmployeeInSupabase(updatedEmp);
          return updatedEmp;
        }
        return e;
      })
    );

    if (emp && shift) {
      logActivity(
        'EMPLOYEE_SHIFT_ASSIGN',
        'Data Karyawan',
        `Mengubah jadwal shift kerja ${emp.fullName} (${emp.nik}) ke ${shift.name} (${shift.checkInTime} - ${shift.checkOutTime} WIB).`,
        {
          targetId: emp.id,
          targetName: emp.fullName,
          newValue: `${shift.code} (${shift.checkInTime} - ${shift.checkOutTime} WIB)`,
          severity: 'info',
        }
      );
    }
  };

  const handleBulkAssignDepartmentShift = (department: string, shiftId: string) => {
    const shift = (companyConfig.workShifts || DEFAULT_WORK_SHIFTS).find((s) => s.id === shiftId);

    setEmployees((prev) =>
      prev.map((e) => {
        if (department === 'ALL' || e.department === department) {
          const updatedEmp = { ...e, shiftId };
          updateEmployeeInSupabase(updatedEmp);
          return updatedEmp;
        }
        return e;
      })
    );

    if (shift) {
      logActivity(
        'EMPLOYEE_SHIFT_ASSIGN',
        'Data Karyawan',
        `Penugasan shift massal "${shift.name}" (${shift.checkInTime} - ${shift.checkOutTime} WIB) ke ${
          department === 'ALL' ? 'Seluruh Departemen' : `Departemen ${department}`
        }.`,
        {
          targetName: department === 'ALL' ? 'Semua Karyawan' : `Departemen ${department}`,
          newValue: `${shift.code} (${shift.checkInTime} - ${shift.checkOutTime} WIB)`,
          severity: 'info',
        }
      );
    }
  };

  // Handlers for Leave
  const handleApproveLeave = (id: string) => {
    const leave = leaveRequests.find((l) => l.id === id);
    const emp = leave ? employees.find((e) => e.id === leave.employeeId) : null;

    setLeaveRequests((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          // Decrement employee remaining leave if annual leave
          if (l.type === 'Cuti Tahunan') {
            setEmployees((emps) =>
              emps.map((e) =>
                e.id === l.employeeId
                  ? { ...e, remainingLeaveDays: Math.max(0, e.remainingLeaveDays - l.totalDays) }
                  : e
              )
            );
          }
          const updated: LeaveRequest = {
            ...l,
            status: 'Disetujui',
            approvedBy: adminUser?.name || 'Siti Rahmawati (HR)',
          };
          upsertLeaveRequestToSupabase(updated);
          return updated;
        }
        return l;
      })
    );

    logActivity(
      'LEAVE_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Menyetujui permohonan ${leave?.type || 'Cuti'} (${leave?.totalDays || 1} hari) untuk ${emp?.fullName || leave?.employeeId || 'Karyawan'}.`,
      {
        targetId: id,
        targetName: emp?.fullName || leave?.employeeId,
        oldValue: 'Status: Menunggu Persetujuan',
        newValue: 'Status: Disetujui',
        severity: 'info',
      }
    );
  };

  const handleRejectLeave = (id: string) => {
    const leave = leaveRequests.find((l) => l.id === id);
    const emp = leave ? employees.find((e) => e.id === leave.employeeId) : null;

    setLeaveRequests((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated: LeaveRequest = {
            ...l,
            status: 'Ditolak',
            approvedBy: adminUser?.name || 'Siti Rahmawati (HR)',
          };
          upsertLeaveRequestToSupabase(updated);
          return updated;
        }
        return l;
      })
    );

    logActivity(
      'LEAVE_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Menolak permohonan ${leave?.type || 'Cuti'} (${leave?.totalDays || 1} hari) untuk ${emp?.fullName || leave?.employeeId || 'Karyawan'}.`,
      {
        targetId: id,
        targetName: emp?.fullName || leave?.employeeId,
        oldValue: 'Status: Menunggu Persetujuan',
        newValue: 'Status: Ditolak',
        severity: 'warning',
      }
    );
  };

  const handleAddLeave = (req: LeaveRequest) => {
    setLeaveRequests((prev) => [req, ...prev]);
    upsertLeaveRequestToSupabase(req);
    const emp = employees.find((e) => e.id === req.employeeId);
    logActivity(
      'LEAVE_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Pengajuan mandiri ${req.type} (${req.totalDays} hari) oleh ${emp?.fullName || req.employeeId}.`,
      {
        targetId: req.id,
        targetName: emp?.fullName || req.employeeId,
        newValue: `Periode: ${req.startDate} s/d ${req.endDate}, Status: Menunggu Persetujuan`,
        severity: 'info',
        notes: req.reason,
      }
    );
  };

  // Handlers for Overtime (Hitungan Per Menit)
  const handleApproveOvertime = (id: string) => {
    const otItem = overtimeRequests.find((o) => o.id === id);
    const emp = otItem ? employees.find((e) => e.id === otItem.employeeId) : null;
    const otMins = otItem ? getOvertimeMinutes(otItem) : 0;

    setOvertimeRequests((prev) =>
      prev.map((ot) => {
        if (ot.id === id) {
          const itemMins = getOvertimeMinutes(ot);
          // Add overtime pay & minutes to employee payroll
          setPayrolls((pays) =>
            pays.map((p) => {
              if (p.employeeId === ot.employeeId) {
                const newOtPay = p.overtimePay + ot.calculatedPay;
                const newOtMins = (p.overtimeMinutes || 0) + itemMins;
                const newGross = p.totalGrossSalary + ot.calculatedPay;
                const newTHP = Math.max(0, newGross - p.totalDeductions);
                const updatedPayroll: PayrollRecord = {
                  ...p,
                  overtimePay: newOtPay,
                  overtimeMinutes: newOtMins,
                  totalGrossSalary: newGross,
                  takeHomePay: newTHP,
                };
                upsertPayrollToSupabase(updatedPayroll);
                return updatedPayroll;
              }
              return p;
            })
          );
          const updatedOt: OvertimeRequest = { ...ot, status: 'Disetujui' };
          upsertOvertimeRequestToSupabase(updatedOt);
          return updatedOt;
        }
        return ot;
      })
    );

    logActivity(
      'OVERTIME_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Menyetujui klaim lembur ${otMins} menit (Rp ${otItem?.calculatedPay.toLocaleString('id-ID')}) untuk ${emp?.fullName || otItem?.employeeId}.`,
      {
        targetId: id,
        targetName: emp?.fullName || otItem?.employeeId,
        oldValue: 'Status: Menunggu Persetujuan',
        newValue: `Status: Disetujui (${otMins} menit = + Rp ${otItem?.calculatedPay.toLocaleString('id-ID')})`,
        severity: 'info',
      }
    );
  };

  const handleRejectOvertime = (id: string) => {
    const otItem = overtimeRequests.find((o) => o.id === id);
    const emp = otItem ? employees.find((e) => e.id === otItem.employeeId) : null;
    const otMins = otItem ? getOvertimeMinutes(otItem) : 0;

    setOvertimeRequests((prev) =>
      prev.map((ot) => {
        if (ot.id === id) {
          const updatedOt: OvertimeRequest = { ...ot, status: 'Ditolak' };
          upsertOvertimeRequestToSupabase(updatedOt);
          return updatedOt;
        }
        return ot;
      })
    );

    logActivity(
      'OVERTIME_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Menolak permohonan lembur ${otMins} menit untuk ${emp?.fullName || otItem?.employeeId}.`,
      {
        targetId: id,
        targetName: emp?.fullName || otItem?.employeeId,
        oldValue: 'Status: Menunggu Persetujuan',
        newValue: 'Status: Ditolak',
        severity: 'warning',
      }
    );
  };

  const handleAddOvertime = (req: OvertimeRequest) => {
    setOvertimeRequests((prev) => [req, ...prev]);
    upsertOvertimeRequestToSupabase(req);
    const emp = employees.find((e) => e.id === req.employeeId);
    const otMins = getOvertimeMinutes(req);
    logActivity(
      'OVERTIME_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Pengajuan lembur ${otMins} menit oleh ${emp?.fullName || req.employeeId}: "${req.taskDescription}".`,
      {
        targetId: req.id,
        targetName: emp?.fullName || req.employeeId,
        newValue: `Tanggal: ${req.date}, Durasi: ${otMins} Menit, Estimasi: Rp ${req.calculatedPay.toLocaleString('id-ID')}`,
        severity: 'info',
      }
    );
  };

  // Handlers for Reimbursement
  const handleAddReimbursement = (claim: ReimbursementClaim) => {
    setReimbursements((prev) => [claim, ...prev]);
    upsertReimbursementToSupabase(claim);

    logActivity(
      'REIMBURSEMENT_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Mendaftarkan pengajuan reimbursement ${claim.claimNumber} (${claim.category}) senilai Rp ${claim.amount.toLocaleString('id-ID')}.`,
      {
        targetId: claim.id,
        targetName: claim.claimNumber,
        newValue: `Nominal: Rp ${claim.amount.toLocaleString('id-ID')}, Status: ${claim.status}`,
        severity: 'info',
      }
    );
  };

  const handleUpdateReimbursement = (claim: ReimbursementClaim) => {
    const oldClaim = reimbursements.find((c) => c.id === claim.id);
    setReimbursements((prev) => prev.map((c) => (c.id === claim.id ? claim : c)));
    upsertReimbursementToSupabase(claim);

    logActivity(
      'REIMBURSEMENT_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Memperbarui status klaim reimbursement ${claim.claimNumber}: ${oldClaim?.status || '-'} → ${claim.status}.`,
      {
        targetId: claim.id,
        targetName: claim.claimNumber,
        oldValue: `Status: ${oldClaim?.status || '-'}`,
        newValue: `Status: ${claim.status} (${claim.paymentMethod || 'Metode Pembayaran'})`,
        severity: claim.status === 'Disetujui' || claim.status === 'Dibayarkan' ? 'success' : 'warning',
      }
    );
  };

  const handleDeleteReimbursement = (id: string) => {
    const claim = reimbursements.find((c) => c.id === id);
    setReimbursements((prev) => prev.filter((c) => c.id !== id));
    deleteReimbursementFromSupabase(id);

    logActivity(
      'REIMBURSEMENT_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Menghapus klaim reimbursement ${claim?.claimNumber || id} dari daftar aktif.`,
      {
        targetId: id,
        targetName: claim?.claimNumber || id,
        severity: 'danger',
      }
    );
  };

  // ============================================================================
  // HANDLERS FOR KASBON & CICILAN POTONGAN GAJI (CONNECTED ADMIN <-> EMPLOYEE)
  // ============================================================================
  const generateInstallmentSchedule = (
    amount: number,
    tenorMonths: number,
    startPeriod: string
  ): CashAdvanceInstallment[] => {
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const parts = startPeriod.split(' ');
    let monthIdx = months.indexOf(parts[0]);
    if (monthIdx === -1) monthIdx = 9; // Oktober default
    let year = parseInt(parts[1], 10) || 2026;

    const baseInst = Math.floor(amount / tenorMonths);
    const remainder = amount - baseInst * tenorMonths;

    const list: CashAdvanceInstallment[] = [];
    for (let i = 0; i < tenorMonths; i++) {
      const m = (monthIdx + i) % 12;
      const y = year + Math.floor((monthIdx + i) / 12);
      list.push({
        installmentNumber: i + 1,
        totalInstallments: tenorMonths,
        period: `${months[m]} ${y}`,
        amount: i === tenorMonths - 1 ? baseInst + remainder : baseInst,
        status: 'scheduled',
      });
    }
    return list;
  };

  const handleCreateCashAdvance = (
    advanceData: Omit<
      CashAdvance,
      'id' | 'createdAt' | 'status' | 'totalPaid' | 'remainingBalance' | 'installments'
    >
  ) => {
    const newId = `ca-${Date.now().toString().slice(-6)}`;
    const installments = generateInstallmentSchedule(
      advanceData.amount,
      advanceData.tenorMonths,
      companyConfig.currentPayrollPeriod
    );

    const newAdvance: CashAdvance = {
      ...advanceData,
      id: newId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      totalPaid: 0,
      remainingBalance: advanceData.amount,
      installments,
    };

    setCashAdvances((prev) => [newAdvance, ...prev]);

    sendNotification({
      recipientType: 'admin',
      recipientName: 'HRD & Finance PT TGI',
      title: `Pengajuan Kasbon Baru: ${advanceData.employeeName}`,
      message: `${advanceData.employeeName} (${advanceData.employeeNik}) mengajukan pinjaman kasbon sebesar Rp ${advanceData.amount.toLocaleString('id-ID')} (Tenor ${advanceData.tenorMonths} bulan). Alasan: "${advanceData.reason}".`,
      category: 'CASH_ADVANCE',
      priority: 'high',
      actionUrl: 'cash_advance',
      actionLabel: 'Review Kasbon',
      metadata: {
        cashAdvanceId: newId,
        cashAdvanceAmount: advanceData.amount,
      },
    });

    logActivity(
      'CASH_ADVANCE_CREATE',
      'Kasbon & Keuangan',
      `Pengajuan kasbon baru #${newId.toUpperCase()} atas nama ${advanceData.employeeName} (${advanceData.employeeNik}) sebesar Rp ${advanceData.amount.toLocaleString('id-ID')} (${advanceData.tenorMonths}x cicilan).`,
      {
        targetId: newId,
        targetName: `${advanceData.employeeName} (${advanceData.employeeNik})`,
        newValue: `Nominal: Rp ${advanceData.amount.toLocaleString('id-ID')}, Tenor: ${advanceData.tenorMonths} Bulan`,
        severity: 'info',
        notes: advanceData.reason,
      }
    );
  };

  const handleApproveCashAdvance = (id: string) => {
    const target = cashAdvances.find((c) => c.id === id);
    if (!target) return;

    const approverName = adminUser?.name || 'Administrator Utama (TGI)';
    setCashAdvances((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'approved',
              approvedAt: new Date().toISOString(),
              approvedBy: approverName,
            }
          : c
      )
    );

    sendNotification({
      recipientType: 'employee',
      recipientEmployeeId: target.employeeId,
      recipientName: target.employeeName,
      title: 'Pengajuan Kasbon Anda Telah Disetujui HRD',
      message: `Permohonan kasbon #${id.toUpperCase()} sebesar Rp ${target.amount.toLocaleString('id-ID')} telah disetujui oleh ${approverName} dan diteruskan ke bagian Finance untuk pencairan dana.`,
      category: 'CASH_ADVANCE',
      priority: 'high',
      actionUrl: 'cash_advance',
      actionLabel: 'Cek Status Kasbon',
    });

    logActivity(
      'CASH_ADVANCE_APPROVE',
      'Kasbon & Keuangan',
      `Menyetujui pengajuan kasbon #${id.toUpperCase()} milik ${target.employeeName} sebesar Rp ${target.amount.toLocaleString('id-ID')}.`,
      {
        targetId: id,
        targetName: target.employeeName,
        oldValue: 'Status: pending',
        newValue: `Status: approved (Oleh ${approverName})`,
        severity: 'info',
      }
    );
  };

  const handleRejectCashAdvance = (id: string, reason: string) => {
    const target = cashAdvances.find((c) => c.id === id);
    if (!target) return;

    const rejecterName = adminUser?.name || 'Administrator Utama (TGI)';
    setCashAdvances((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'rejected',
              rejectedAt: new Date().toISOString(),
              rejectedBy: rejecterName,
              rejectionReason: reason,
            }
          : c
      )
    );

    sendNotification({
      recipientType: 'employee',
      recipientEmployeeId: target.employeeId,
      recipientName: target.employeeName,
      title: 'Pengajuan Kasbon Tidak Disetujui',
      message: `Mohon maaf, pengajuan kasbon #${id.toUpperCase()} sebesar Rp ${target.amount.toLocaleString('id-ID')} belum dapat disetujui. Alasan: "${reason}".`,
      category: 'CASH_ADVANCE',
      priority: 'normal',
      actionUrl: 'cash_advance',
      actionLabel: 'Lihat Detail',
    });

    logActivity(
      'CASH_ADVANCE_REJECT',
      'Kasbon & Keuangan',
      `Menolak pengajuan kasbon #${id.toUpperCase()} milik ${target.employeeName}: "${reason}".`,
      {
        targetId: id,
        targetName: target.employeeName,
        oldValue: `Status: ${target.status}`,
        newValue: `Status: rejected (${reason})`,
        severity: 'warning',
      }
    );
  };

  const handleDisburseCashAdvance = (
    id: string,
    details: {
      method: 'Bank Transfer' | 'Tunai / Petty Cash';
      reference: string;
      notes?: string;
    }
  ) => {
    const target = cashAdvances.find((c) => c.id === id);
    if (!target) return;

    const disburserName = adminUser?.name || 'Finance & Payroll TGI';
    setCashAdvances((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'disbursed',
              disbursedAt: new Date().toISOString(),
              disbursedBy: disburserName,
              disbursementMethod: details.method,
              disbursementReference: details.reference,
            }
          : c
      )
    );

    sendNotification({
      recipientType: 'employee',
      recipientEmployeeId: target.employeeId,
      recipientName: target.employeeName,
      title: 'Dana Kasbon Telah Dicairkan!',
      message: `Dana kasbon #${id.toUpperCase()} sebesar Rp ${target.amount.toLocaleString('id-ID')} telah dicairkan melalui ${details.method} (Ref: ${details.reference}). Jadwal cicilan potong gaji kini aktif.`,
      category: 'CASH_ADVANCE',
      priority: 'high',
      actionUrl: 'cash_advance',
      actionLabel: 'Cek Jadwal Cicilan',
    });

    logActivity(
      'CASH_ADVANCE_DISBURSE',
      'Kasbon & Keuangan',
      `Mencairkan dana kasbon #${id.toUpperCase()} kepada ${target.employeeName} sebesar Rp ${target.amount.toLocaleString('id-ID')} via ${details.method} (Ref: ${details.reference}).`,
      {
        targetId: id,
        targetName: target.employeeName,
        oldValue: 'Status: approved',
        newValue: `Status: disbursed (${details.method} - ${details.reference})`,
        severity: 'warning',
      }
    );
  };

  const handleApplyCashAdvanceDeductionToPayroll = (
    advanceId: string,
    installmentNumber: number
  ) => {
    const target = cashAdvances.find((c) => c.id === advanceId);
    if (!target) return;
    const targetInst = target.installments.find(
      (i) => i.installmentNumber === installmentNumber
    );
    if (!targetInst || targetInst.status === 'deducted') return;

    const newTotalPaid = target.totalPaid + targetInst.amount;
    const newRemaining = Math.max(0, target.amount - newTotalPaid);
    const isNowFullyPaid = newRemaining === 0;

    setCashAdvances((prev) =>
      prev.map((c) => {
        if (c.id !== advanceId) return c;
        return {
          ...c,
          totalPaid: newTotalPaid,
          remainingBalance: newRemaining,
          status: isNowFullyPaid ? 'paid' : 'disbursed',
          installments: c.installments.map((inst) =>
            inst.installmentNumber === installmentNumber
              ? {
                  ...inst,
                  status: 'deducted',
                  deductedAt: new Date().toISOString(),
                }
              : inst
          ),
        };
      })
    );

    // Sync deduction directly into the employee's PayrollRecord
    setPayrolls((prev) =>
      prev.map((p) => {
        if (p.employeeId === target.employeeId) {
          const nextCaDeduct = (p.cashAdvanceDeduction || 0) + targetInst.amount;
          const nextTotalDeduct = p.totalDeductions + targetInst.amount;
          const nextThp = Math.max(0, p.totalGrossSalary - nextTotalDeduct);
          const updatedPayroll: PayrollRecord = {
            ...p,
            cashAdvanceDeduction: nextCaDeduct,
            cashAdvanceNotes: `Cicilan ke-${installmentNumber}/${target.tenorMonths} (Sisa Rp ${newRemaining.toLocaleString('id-ID')})`,
            totalDeductions: nextTotalDeduct,
            takeHomePay: nextThp,
          };
          upsertPayrollToSupabase(updatedPayroll);
          return updatedPayroll;
        }
        return p;
      })
    );

    sendNotification({
      recipientType: 'employee',
      recipientEmployeeId: target.employeeId,
      recipientName: target.employeeName,
      title: `Cicilan Kasbon Ke-${installmentNumber} Terpotong di Slip Gaji`,
      message: `Angsuran kasbon ke-${installmentNumber} dari ${target.tenorMonths} sebesar Rp ${targetInst.amount.toLocaleString('id-ID')} telah dipotong pada slip gaji periode ${targetInst.period}. Sisa pokok kasbon Anda: Rp ${newRemaining.toLocaleString('id-ID')}.`,
      category: 'CASH_ADVANCE',
      priority: 'normal',
      actionUrl: 'payroll',
      actionLabel: 'Lihat Slip Gaji',
    });

    logActivity(
      'CASH_ADVANCE_DEDUCT',
      'Kasbon & Keuangan',
      `Memotong cicilan kasbon ke-${installmentNumber}/${target.tenorMonths} sebesar Rp ${targetInst.amount.toLocaleString('id-ID')} dari slip gaji ${target.employeeName}. Sisa kasbon: Rp ${newRemaining.toLocaleString('id-ID')}.`,
      {
        targetId: advanceId,
        targetName: target.employeeName,
        newValue: `Terpotong: Rp ${targetInst.amount.toLocaleString('id-ID')}, Sisa: Rp ${newRemaining.toLocaleString('id-ID')}`,
        severity: 'info',
      }
    );
  };

  const handleImportReimbursements = (claims: ReimbursementClaim[]) => {
    setReimbursements((prev) => [...claims, ...prev]);
    claims.forEach((claim) => upsertReimbursementToSupabase(claim));
  };

  // Handlers for Asset Management
  const handleAddAsset = (asset: CompanyAsset) => {
    setAssets((prev) => [asset, ...prev]);

    const newLog: AssetHistoryLog = {
      id: `ast-log-${Date.now().toString().slice(-6)}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.name,
      action: 'Pengadaan Baru',
      date: asset.purchaseDate,
      condition: asset.condition,
      notes: `Pengadaan inventaris baru senilai Rp ${asset.purchaseCost.toLocaleString('id-ID')}. Lokasi: ${asset.location || 'Kantor Pusat'}.`,
      adminName: adminUser?.name || 'Administrator Utama (TGI)',
    };
    setAssetLogs((prev) => [newLog, ...prev]);

    logActivity(
      'ASSET_CREATE',
      'Inventaris & Aset',
      `Menambahkan inventaris baru: ${asset.name} (${asset.assetCode}) senilai Rp ${asset.purchaseCost.toLocaleString('id-ID')}.`,
      {
        targetId: asset.id,
        targetName: `${asset.name} (${asset.assetCode})`,
        newValue: `Kategori: ${asset.category}, Kondisi: ${asset.condition}, Status: ${asset.status}`,
        severity: 'info',
        notes: `Pengadaan barang inventaris operasional kantor dan gudang.`,
      }
    );
  };

  const handleUpdateAsset = (asset: CompanyAsset) => {
    const oldAsset = assets.find((a) => a.id === asset.id);
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));

    logActivity(
      'ASSET_UPDATE',
      'Inventaris & Aset',
      `Memperbarui data inventaris aset ${asset.name} (${asset.assetCode}).`,
      {
        targetId: asset.id,
        targetName: `${asset.name} (${asset.assetCode})`,
        oldValue: oldAsset ? `Kondisi: ${oldAsset.condition}, Status: ${oldAsset.status}` : undefined,
        newValue: `Kondisi: ${asset.condition}, Status: ${asset.status}, Lokasi: ${asset.location || '-'}`,
        severity: 'info',
      }
    );
  };

  const handleDeleteAsset = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));

    if (asset) {
      const newLog: AssetHistoryLog = {
        id: `ast-log-${Date.now().toString().slice(-6)}`,
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.name,
        action: 'Penghapusan Aset',
        date: new Date().toISOString().slice(0, 10),
        condition: asset.condition,
        notes: `Aset dihapuskan dari inventaris aktif oleh admin.`,
        adminName: adminUser?.name || 'Administrator Utama (TGI)',
      };
      setAssetLogs((prev) => [newLog, ...prev]);
    }

    logActivity(
      'ASSET_DELETE',
      'Inventaris & Aset',
      `Menghapus data inventaris aset: ${asset?.name || assetId} (${asset?.assetCode || assetId}).`,
      {
        targetId: assetId,
        targetName: asset ? `${asset.name} (${asset.assetCode})` : assetId,
        oldValue: asset ? `Nilai: Rp ${asset.purchaseCost.toLocaleString('id-ID')}, Status: ${asset.status}` : undefined,
        newValue: 'Dihapuskan dari basis data inventaris',
        severity: 'danger',
        notes: 'Pencatatan audit keamanan dan aset perusahaan.',
      }
    );
  };

  const handleAssignAsset = (
    assetId: string,
    employee: Employee,
    date: string,
    notes: string,
    condition: AssetCondition
  ) => {
    const targetAsset = assets.find((a) => a.id === assetId);
    if (!targetAsset) return;

    const updatedAsset: CompanyAsset = {
      ...targetAsset,
      status: 'Dipinjamkan',
      condition,
      assignedToEmployeeId: employee.id,
      assignedToEmployeeName: employee.fullName,
      assignedToEmployeeNik: employee.nik,
      assignedDate: date,
      handoverConditionNotes: notes,
    };

    setAssets((prev) => prev.map((a) => (a.id === assetId ? updatedAsset : a)));

    const newLog: AssetHistoryLog = {
      id: `ast-log-${Date.now().toString().slice(-6)}`,
      assetId,
      assetCode: targetAsset.assetCode,
      assetName: targetAsset.name,
      action: 'Penyerahan / Pinjam',
      employeeId: employee.id,
      employeeNik: employee.nik,
      employeeName: employee.fullName,
      employeeDepartment: employee.department,
      date,
      condition,
      notes,
      adminName: adminUser?.name || 'Administrator Utama (TGI)',
    };
    setAssetLogs((prev) => [newLog, ...prev]);

    logActivity(
      'ASSET_ASSIGN',
      'Inventaris & Aset',
      `Menyerahkan inventaris ${targetAsset.name} (${targetAsset.assetCode}) kepada staf ${employee.fullName} (${employee.nik}).`,
      {
        targetId: assetId,
        targetName: `${targetAsset.name} → ${employee.fullName}`,
        oldValue: `Status: ${targetAsset.status}, Pemegang: ${targetAsset.assignedToEmployeeName || 'Belum ada'}`,
        newValue: `Status: Dipinjamkan, Pemegang: ${employee.fullName} (${employee.nik}), Tgl: ${date}`,
        severity: 'info',
        notes: `Catatan kondisi serah terima: "${notes}"`,
      }
    );
  };

  const handleReturnAsset = (
    assetId: string,
    date: string,
    condition: AssetCondition,
    notes: string
  ) => {
    const targetAsset = assets.find((a) => a.id === assetId);
    if (!targetAsset) return;

    const prevHolder = targetAsset.assignedToEmployeeName;
    const prevNik = targetAsset.assignedToEmployeeNik;
    const prevEmpId = targetAsset.assignedToEmployeeId;

    const nextStatus =
      condition === 'Rusak' || condition === 'Perlu Perbaikan'
        ? 'Dalam Perbaikan'
        : 'Tersedia';

    const updatedAsset: CompanyAsset = {
      ...targetAsset,
      status: nextStatus,
      condition,
      assignedToEmployeeId: null,
      assignedToEmployeeName: null,
      assignedToEmployeeNik: null,
      assignedDate: null,
      handoverConditionNotes: null,
    };

    setAssets((prev) => prev.map((a) => (a.id === assetId ? updatedAsset : a)));

    const newLog: AssetHistoryLog = {
      id: `ast-log-${Date.now().toString().slice(-6)}`,
      assetId,
      assetCode: targetAsset.assetCode,
      assetName: targetAsset.name,
      action: condition === 'Rusak' ? 'Penggantian / Rusak' : 'Pengembalian',
      employeeId: prevEmpId || undefined,
      employeeNik: prevNik || undefined,
      employeeName: prevHolder || undefined,
      date,
      condition,
      notes,
      adminName: adminUser?.name || 'Administrator Utama (TGI)',
    };
    setAssetLogs((prev) => [newLog, ...prev]);

    logActivity(
      'ASSET_RETURN',
      'Inventaris & Aset',
      `Pengembalian inventaris ${targetAsset.name} (${targetAsset.assetCode}) dari ${prevHolder || 'karyawan'}. Kondisi: ${condition}.`,
      {
        targetId: assetId,
        targetName: targetAsset.name,
        oldValue: `Dipinjamkan ke ${prevHolder || 'Karyawan'} (${prevNik || '-'})`,
        newValue: `Status: ${nextStatus}, Kondisi: ${condition}`,
        severity: condition === 'Rusak' ? 'warning' : 'info',
        notes: `Catatan pengembalian: "${notes}"`,
      }
    );
  };

  // Handlers for Performance Review & Appraisal
  const handleAddReview = (review: PerformanceReview, applyToPayrollImmediately?: boolean) => {
    let finalReview = { ...review };
    if (applyToPayrollImmediately && review.recommendedBonus > 0) {
      handleApplyBonusToPayroll(review);
      finalReview.isBonusAppliedToPayroll = true;
      finalReview.payrollPeriodApplied = review.period || companyConfig.currentPayrollPeriod;
    }
    setReviews((prev) => [finalReview, ...prev]);

    logActivity(
      'PERFORMANCE_REVIEW_CREATE',
      'Penilaian & KPI',
      `Menambahkan lembar penilaian kinerja (${review.period}) staf ${review.employeeName} dengan skor akhir ${review.finalScore} (Grade ${review.grade}). Rekomendasi bonus: Rp ${review.recommendedBonus.toLocaleString('id-ID')}.`,
      {
        targetId: review.id,
        targetName: `${review.employeeName} (Skor: ${review.finalScore})`,
        newValue: `KPI: ${review.kpiScore}, Disiplin: ${review.disciplineScore}, Tim: ${review.teamworkScore}, Inisiatif: ${review.initiativeScore}. Rekomendasi Bonus: Rp ${review.recommendedBonus.toLocaleString('id-ID')}`,
        severity: 'info',
        notes: review.generalFeedback,
      }
    );

    // Kirim notifikasi otomatis ke portal mandiri karyawan
    sendNotification({
      recipientType: 'employee',
      recipientEmployeeId: review.employeeId,
      recipientName: review.employeeName,
      title: `Rapor Kinerja & KPI Periode ${review.period} Diterbitkan`,
      message: `Lembar evaluasi kinerja Anda periode ${review.period} telah diterbitkan dengan Skor Akhir ${review.finalScore} (Grade ${review.grade}). Anda berhak atas rekomendasi bonus ${
        review.recommendedBonus > 0 ? `Rp ${review.recommendedBonus.toLocaleString('id-ID')}` : 'insentif'
      }.`,
      category: 'PERFORMANCE_REVIEW',
      priority: 'normal',
      actionUrl: 'rapor_kinerja',
      actionLabel: 'Buka Rapor Kinerja',
      relatedReviewId: review.id,
      metadata: {
        period: review.period,
        grade: review.grade,
        finalScore: review.finalScore,
        bonusAmount: review.recommendedBonus,
      },
    });
  };

  const handleUpdateReview = (review: PerformanceReview, applyToPayrollImmediately?: boolean) => {
    let finalReview = { ...review };
    if (applyToPayrollImmediately && review.recommendedBonus > 0) {
      handleApplyBonusToPayroll(review);
      finalReview.isBonusAppliedToPayroll = true;
      finalReview.payrollPeriodApplied = review.period || companyConfig.currentPayrollPeriod;
    }
    setReviews((prev) => prev.map((r) => (r.id === review.id ? finalReview : r)));

    logActivity(
      'PERFORMANCE_REVIEW_UPDATE',
      'Penilaian & KPI',
      `Memperbarui penilaian kinerja (${review.period}) staf ${review.employeeName}. Skor akhir baru: ${review.finalScore} (Grade ${review.grade}).`,
      {
        targetId: review.id,
        targetName: `${review.employeeName} (${review.period})`,
        newValue: `Skor: ${review.finalScore}, Grade: ${review.grade}, Rekomendasi Bonus: Rp ${review.recommendedBonus.toLocaleString('id-ID')}`,
        severity: 'info',
        notes: review.generalFeedback,
      }
    );
  };

  const handleDeleteReview = (reviewId: string) => {
    const rev = reviews.find((r) => r.id === reviewId);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));

    if (rev) {
      logActivity(
        'PERFORMANCE_REVIEW_DELETE',
        'Penilaian & KPI',
        `Menghapus rekaman evaluasi kinerja (${rev.period}) untuk staf ${rev.employeeName}.`,
        {
          targetId: reviewId,
          targetName: `${rev.employeeName} (${rev.period})`,
          severity: 'warning',
        }
      );
    }
  };

  const handleApplyBonusToPayroll = (review: PerformanceReview) => {
    const bonusAmount = review.recommendedBonus || 0;
    setPayrolls((prev) =>
      prev.map((rec) => {
        if (
          rec.employeeId === review.employeeId &&
          (rec.period === review.period || rec.period === companyConfig.currentPayrollPeriod)
        ) {
          const newGross =
            rec.baseSalary +
            rec.allowancePosition +
            rec.allowanceTransport +
            rec.allowanceMeal +
            rec.allowanceCommunication +
            rec.overtimePay +
            bonusAmount;
          const newTHP = Math.max(0, newGross - rec.totalDeductions);
          return {
            ...rec,
            bonus: bonusAmount,
            totalGrossSalary: newGross,
            takeHomePay: newTHP,
          };
        }
        return rec;
      })
    );

    setReviews((prev) =>
      prev.map((r) =>
        r.id === review.id
          ? {
              ...r,
              isBonusAppliedToPayroll: true,
              payrollPeriodApplied: review.period || companyConfig.currentPayrollPeriod,
            }
          : r
      )
    );

    logActivity(
      'PERFORMANCE_BONUS_APPLY',
      'Penilaian & KPI',
      `Menerapkan bonus kinerja Rp ${bonusAmount.toLocaleString('id-ID')} ke slip gaji ${review.employeeName} periode ${review.period || companyConfig.currentPayrollPeriod}.`,
      {
        targetId: review.id,
        targetName: review.employeeName,
        newValue: `Bonus Masuk Payroll: Rp ${bonusAmount.toLocaleString('id-ID')}`,
        severity: 'success',
      }
    );

    // Kirim notifikasi otomatis ke portal mandiri karyawan
    sendNotification({
      recipientType: 'employee',
      recipientEmployeeId: review.employeeId,
      recipientName: review.employeeName,
      title: 'Bonus Kinerja Berhasil Masuk ke Slip Gaji',
      message: `Bonus kinerja hasil penilaian KPI periode ${review.period || companyConfig.currentPayrollPeriod} sebesar Rp ${bonusAmount.toLocaleString('id-ID')} telah berhasil disinkronkan ke rincian slip gaji & menambah Take Home Pay (THP) Anda.`,
      category: 'PAYROLL_BONUS',
      priority: 'high',
      actionUrl: 'payroll',
      actionLabel: 'Cek Rincian Slip Gaji',
      metadata: {
        period: review.period || companyConfig.currentPayrollPeriod,
        bonusAmount,
      },
    });
  };

  const handleBatchApplyBonusesToPayroll = (reviewsToApply: PerformanceReview[]) => {
    let appliedCount = 0;
    let totalBonus = 0;

    setPayrolls((prev) => {
      return prev.map((rec) => {
        const matchingReview = reviewsToApply.find(
          (r) =>
            r.employeeId === rec.employeeId &&
            (r.period === rec.period || r.period === companyConfig.currentPayrollPeriod)
        );

        if (matchingReview && matchingReview.recommendedBonus > 0) {
          appliedCount++;
          totalBonus += matchingReview.recommendedBonus;
          const newGross =
            rec.baseSalary +
            rec.allowancePosition +
            rec.allowanceTransport +
            rec.allowanceMeal +
            rec.allowanceCommunication +
            rec.overtimePay +
            matchingReview.recommendedBonus;
          const newTHP = Math.max(0, newGross - rec.totalDeductions);
          return {
            ...rec,
            bonus: matchingReview.recommendedBonus,
            totalGrossSalary: newGross,
            takeHomePay: newTHP,
          };
        }
        return rec;
      });
    });

    const appliedIds = new Set(reviewsToApply.map((r) => r.id));
    setReviews((prev) =>
      prev.map((r) =>
        appliedIds.has(r.id)
          ? {
              ...r,
              isBonusAppliedToPayroll: true,
              payrollPeriodApplied: r.period || companyConfig.currentPayrollPeriod,
            }
          : r
      )
    );

    logActivity(
      'PERFORMANCE_BONUS_APPLY',
      'Penilaian & KPI',
      `Sinkronisasi massal ${appliedCount} bonus kinerja (Total: Rp ${totalBonus.toLocaleString('id-ID')}) ke payroll periode ${companyConfig.currentPayrollPeriod}.`,
      {
        targetName: `${appliedCount} Karyawan`,
        newValue: `Total Bonus: Rp ${totalBonus.toLocaleString('id-ID')}`,
        severity: 'success',
      }
    );

    // Kirim notifikasi otomatis ke setiap karyawan yang mendapatkan bonus
    reviewsToApply.forEach((r) => {
      if (r.recommendedBonus > 0) {
        sendNotification({
          recipientType: 'employee',
          recipientEmployeeId: r.employeeId,
          recipientName: r.employeeName,
          title: 'Bonus Kinerja Berhasil Masuk ke Slip Gaji',
          message: `Bonus kinerja hasil penilaian KPI periode ${r.period || companyConfig.currentPayrollPeriod} sebesar Rp ${r.recommendedBonus.toLocaleString('id-ID')} telah berhasil disinkronkan ke slip gaji Anda.`,
          category: 'PAYROLL_BONUS',
          priority: 'high',
          actionUrl: 'payroll',
          actionLabel: 'Cek Rincian Slip Gaji',
          metadata: {
            period: r.period || companyConfig.currentPayrollPeriod,
            bonusAmount: r.recommendedBonus,
          },
        });
      }
    });
  };

  // Helper to open payslip modal
  const handleOpenPayslip = (payroll: PayrollRecord) => {
    setSelectedPayslip(payroll);
  };

  const selectedEmployeeForPayslip = selectedPayslip
    ? employees.find((e) => e.id === selectedPayslip.employeeId) || null
    : null;

  // Helper to switch admin role for live simulation/testing
  const handleSwitchAdminUserRole = (roleName: string) => {
    if (!adminUser) return;
    const updatedUser: GoogleAdminUser = {
      ...adminUser,
      role: roleName as any,
    };
    setAdminUser(updatedUser);
    try {
      localStorage.setItem('tgi_admin_google_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Storage error', e);
    }
    logActivity(
      'LOGIN_ACTIVITY',
      'Autentikasi',
      `Beralih simulasi peran pengguna ke "${roleName}". Sistem memperbarui visibilitas menu sidebar sesuai izin peran.`,
      {
        targetId: adminUser.id,
        targetName: adminUser.name,
        newValue: `Peran Baru: ${roleName}`,
        severity: 'info',
      }
    );
  };

  // Compute current user role and allowed modules from companyConfig.rolePermissions
  const currentRole = (adminUser?.role === 'admin' ? 'Super Admin' : (adminUser?.role || 'Super Admin')) as GoogleAdminRole;
  
  const getRolePermissionConfig = (role: string): RolePermissionConfig | undefined => {
    if (!companyConfig.rolePermissions) return undefined;
    if (companyConfig.rolePermissions[role as GoogleAdminRole]) {
      return companyConfig.rolePermissions[role as GoogleAdminRole];
    }
    const rLower = role.toLowerCase();
    for (const [key, perm] of Object.entries(companyConfig.rolePermissions)) {
      const kLower = key.toLowerCase();
      if (rLower === kLower) return perm;
      if (rLower.includes('hr') && kLower.includes('hr')) return perm;
      if (rLower.includes('finan') && kLower.includes('finan')) return perm;
      if (
        (rLower.includes('operat') || rLower.includes('lead') || rLower.includes('supervis')) &&
        (kLower.includes('operat') || kLower.includes('lead') || kLower.includes('supervis'))
      ) {
        return perm;
      }
      if (
        (rLower.includes('view') || rLower.includes('audit')) &&
        (kLower.includes('view') || kLower.includes('audit'))
      ) {
        return perm;
      }
    }
    return undefined;
  };

  const rolePerm = getRolePermissionConfig(currentRole);
  const userAllowedModules = currentRole === 'Super Admin'
    ? undefined
    : (rolePerm?.allowedModules || ['overview', 'reports']);

  // Redirect if current tab is restricted for this role
  useEffect(() => {
    if (adminUser && currentRole !== 'Super Admin' && userAllowedModules && userAllowedModules.length > 0) {
      // Never block settings or roles_management for admin dashboard users
      if (activeTab === 'settings' || activeTab === 'roles_management') {
        return;
      }
      if (!userAllowedModules.includes(activeTab)) {
        setActiveTab(userAllowedModules[0]);
      }
    }
  }, [adminUser, currentRole, userAllowedModules, activeTab]);

  // Full-Screen Web Access PIN Gatekeeper (Before entering the web app)
  if ((companyConfig.securitySettings?.requirePinForWebAccess ?? true) && !isWebPinUnlocked) {
    return (
      <WebPinGatekeeper
        companyConfig={companyConfig}
        employees={employees}
        onUnlockWeb={handleUnlockWeb}
      />
    );
  }

  // Gatekeeper: If not logged in as Admin and not in employee mode, show Google Login Gateway
  if (!adminUser && dashboardMode !== 'employee') {
    return (
      <GoogleLoginView
        adminEmail={companyConfig.adminGoogleEmail || 'jpexakun7@gmail.com'}
        allowedAdmins={companyConfig.allowedGoogleAdmins}
        employees={employees}
        companyConfig={companyConfig}
        onLoginSuccess={handleLoginSuccess}
        onRegisterNewAdmin={handleRegisterNewAdmin}
        onLoginAsEmployee={(empId) => {
          if (empId) {
            setActiveEmployeeId(empId);
          }
          setDashboardMode('employee');
        }}
      />
    );
  }

  // View: Mode Portal Layanan Mandiri Karyawan (Self-Service)
  if (dashboardMode === 'employee') {
    const safePayrolls = isAdminUnlocked
      ? syncedPayrolls
      : syncedPayrolls.filter((p) => p.employeeId === currentEmployee?.id);

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col antialiased font-sans text-slate-800">
        <Header
          onOpenSidebar={() => {}}
          companyConfig={companyConfig}
          onOpenAddEmployee={() => setIsAddEmployeeModalOpen(true)}
          onOpenRunPayroll={() => {}}
          searchQuery=""
          setSearchQuery={() => {}}
          pendingLeaves={pendingLeaves}
          pendingOvertimes={pendingOvertimes}
          onNavigateTab={setActiveTab}
          adminUser={adminUser}
          onLogout={handleLogout}
          onSwitchAdminUser={handleSwitchAdminUser}
          dashboardMode={dashboardMode}
          onToggleDashboardMode={handleToggleDashboardMode}
          currentEmployeeName={currentEmployee?.fullName}
          currentEmployee={currentEmployee}
          notifications={notifications}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
          onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
          onDeleteNotification={handleDeleteNotification}
          onClearAllNotifications={handleClearAllNotifications}
          onNavigateNotificationAction={handleNavigateNotificationAction}
          supabaseStatus={supabaseStatus}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          isAdminUnlocked={isAdminUnlocked}
          onRequestAdminLogin={() => setIsAdminAuthModalOpen(true)}
          onLockAdmin={handleLockAdmin}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <EmployeePortalView
            currentEmployee={currentEmployee}
            allEmployees={employees}
            payrollRecord={safePayrolls.find((p) => p.employeeId === currentEmployee?.id) || null}
            allPayrolls={safePayrolls}
            attendances={attendances}
            onAddAttendance={handleAddAttendance}
            leaveRequests={leaveRequests}
            overtimeRequests={overtimeRequests}
            reimbursements={reimbursements}
            assets={assets}
            reviews={reviews}
            companyConfig={companyConfig}
            notifications={notifications}
            activePortalTabOverride={portalTabOverride}
            onApplyLeave={handleAddLeave}
            onApplyOvertime={handleAddOvertime}
            onApplyReimbursement={handleAddReimbursement}
            cashAdvances={cashAdvances}
            onApplyCashAdvance={handleCreateCashAdvance}
            onUpdateProfile={handleUpdateEmployee}
            onOpenPayslip={handleOpenPayslip}
            onSwitchToAdminMode={handleToggleDashboardMode}
            onSelectEmployee={(empId) => {
              if (isAdminUnlocked) {
                setActiveEmployeeId(empId);
              }
            }}
            isAdminUnlocked={isAdminUnlocked}
            onRequestAdminAccess={() => {
              if (isAdminUnlocked) {
                setDashboardMode('admin');
              }
            }}
            onLockAdmin={handleLockAdmin}
            onReportAssetIssue={(assetId, notes) => {
              const targetAsset = assets.find((a) => a.id === assetId);
              logActivity(
                'ASSET_UPDATE',
                'Inventaris & Aset',
                `Laporan kendala inventaris dari karyawan ${currentEmployee?.fullName}: "${notes}".`,
                {
                  targetId: assetId,
                  targetName: targetAsset ? `${targetAsset.name} (${targetAsset.assetCode})` : assetId,
                  severity: 'warning',
                  notes,
                }
              );
            }}
          />
        </main>

        {/* Slip Gaji Modal (Printable/Downloadable) */}
        <PayslipModal
          payroll={selectedPayslip}
          employee={selectedEmployeeForPayslip}
          companyConfig={companyConfig}
          onClose={() => setSelectedPayslip(null)}
        />

        {/* Admin PIN & Supabase Auth Modal */}
        <AdminPinAuthModal
          isOpen={isAdminAuthModalOpen}
          onClose={() => setIsAdminAuthModalOpen(false)}
          onSuccess={handleAdminUnlockSuccess}
          companyConfig={companyConfig}
        />

        {/* Supabase Cloud Database & SQL Schema Modal */}
        <SupabaseSyncModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          syncStatus={supabaseStatus}
          onRefreshStatus={refreshSupabaseStatus}
          onTriggerSeed={handleTriggerSeed}
          isSeeding={isSeedingSupabase}
          employeeCount={employees.length}
          assetCount={assets.length}
        />
      </div>
    );
  }

  // View: Admin HR Panel PT Tas Grosir Import (Accessible by Google Admin)
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased font-sans text-slate-800">
      <div className="flex flex-1 min-h-screen">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingLeavesCount={pendingLeaves.length}
          pendingOvertimeCount={pendingOvertimes.length}
          pendingReimbursementsCount={pendingReimbursements.length}
          pendingCashAdvancesCount={pendingCashAdvances.length}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          adminUser={adminUser}
          onLogout={handleLogout}
          allowedModules={userAllowedModules}
          onOpenEmployeePortal={() => setDashboardMode('employee')}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            activeTab={activeTab}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            companyConfig={companyConfig}
            onOpenAddEmployee={() => {
              setActiveTab('employees');
              setIsAddEmployeeModalOpen(true);
            }}
            onOpenRunPayroll={() => {
              setActiveTab('payroll');
              handleRecalculatePayroll();
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            pendingLeaves={pendingLeaves}
            pendingOvertimes={pendingOvertimes}
            onNavigateTab={setActiveTab}
            adminUser={adminUser}
            onLogout={handleLogout}
            onSwitchAdminUser={handleSwitchAdminUser}
            onSwitchAdminUserRole={handleSwitchAdminUserRole}
            dashboardMode={dashboardMode}
            onToggleDashboardMode={() => setDashboardMode('employee')}
            currentEmployeeName={currentEmployee?.fullName}
            currentEmployee={currentEmployee}
            notifications={notifications}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
            onDeleteNotification={handleDeleteNotification}
            onClearAllNotifications={handleClearAllNotifications}
            onNavigateNotificationAction={handleNavigateNotificationAction}
            supabaseStatus={supabaseStatus}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            isAdminUnlocked={isAdminUnlocked}
            onRequestAdminLogin={() => setIsAdminAuthModalOpen(true)}
            onLockAdmin={handleLockAdmin}
            onQuickBroadcastReminder={() =>
              handleSendDeadlineReminder({
                period: companyConfig.currentPayrollPeriod,
                deadlineDate: '25 Oktober 2026',
                pendingCount: Math.max(1, employees.length - reviews.length),
              })
            }
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activeTab === 'overview' && (
              <DashboardOverview
                employees={employees}
                payrolls={syncedPayrolls}
                attendances={attendances}
                leaveRequests={leaveRequests}
                overtimeRequests={overtimeRequests}
                reimbursements={reimbursements}
                companyConfig={companyConfig}
                onNavigateTab={setActiveTab}
                onOpenPayslip={handleOpenPayslip}
                onApproveLeave={handleApproveLeave}
                onRejectLeave={handleRejectLeave}
                onApproveOvertime={handleApproveOvertime}
                onRejectOvertime={handleRejectOvertime}
                onUpdateAttendance={handleUpdateAttendance}
                onDeleteAttendance={handleDeleteAttendance}
              />
            )}

            {activeTab === 'employees' && (
              <EmployeeManagement
                employees={employees}
                assets={assets}
                reviews={reviews}
                onAddEmployee={handleAddEmployee}
                onUpdateEmployee={handleUpdateEmployee}
                onDeleteEmployee={handleDeleteEmployee}
                isAddModalOpen={isAddEmployeeModalOpen}
                setIsAddModalOpen={setIsAddEmployeeModalOpen}
              />
            )}

            {activeTab === 'payroll' && (
              <PayrollManagement
                employees={employees}
                payrolls={syncedPayrolls}
                attendances={attendances}
                reviews={reviews}
                companyConfig={companyConfig}
                onOpenPayslip={handleOpenPayslip}
                onRecalculatePayroll={handleRecalculatePayroll}
                onUpdatePayrollRecord={handleUpdatePayrollRecord}
                onUpdatePenaltyPolicy={handleUpdatePenaltyPolicy}
                onChangePayrollPeriod={handleChangePayrollPeriod}
                onToggleLockPayrollPeriod={handleToggleLockPayrollPeriod}
                onToggleWaiveLatePenalty={handleToggleWaiveLatePenalty}
                onApplyImportedPayroll={(importedPayrolls) => {
                  setPayrolls(importedPayrolls);
                }}
                onNavigateToPerformanceReview={() => setActiveTab('performance_review')}
                onApplyBonusToPayroll={handleApplyBonusToPayroll}
                onBatchApplyBonusesToPayroll={handleBatchApplyBonusesToPayroll}
              />
            )}

            {(activeTab === 'attendance' || activeTab === 'work_shifts') && (
              <AttendanceView
                employees={employees}
                attendances={attendances}
                companyConfig={companyConfig}
                initialSubTab={activeTab === 'work_shifts' ? 'shifts' : 'attendance'}
                onAddAttendance={handleAddAttendance}
                onUpdateAttendance={handleUpdateAttendance}
                onDeleteAttendance={handleDeleteAttendance}
                onUpdateShifts={handleUpdateShifts}
                onUpdatePenaltyPolicy={handleUpdatePenaltyPolicy}
                onAssignEmployeeShift={handleAssignEmployeeShift}
                onBulkAssignDepartmentShift={handleBulkAssignDepartmentShift}
                onApplyImportedAttendance={(importedAttendances) => {
                  setAttendances((prev) =>
                    deduplicateDailyAttendances(
                      [...importedAttendances, ...prev],
                      employees,
                      companyConfig.workShifts,
                      companyConfig.attendancePenaltyPolicy
                    )
                  );
                  importedAttendances.forEach((att) => upsertAttendanceToSupabase(att));
                }}
              />
            )}

            {activeTab === 'leave' && (
              <LeaveAndOvertime
                employees={employees}
                leaveRequests={leaveRequests}
                overtimeRequests={overtimeRequests}
                onApproveLeave={handleApproveLeave}
                onRejectLeave={handleRejectLeave}
                onAddLeave={handleAddLeave}
                onApproveOvertime={handleApproveOvertime}
                onRejectOvertime={handleRejectOvertime}
                onAddOvertime={handleAddOvertime}
              />
            )}

            {activeTab === 'overtime' && (
              <LeaveAndOvertime
                employees={employees}
                leaveRequests={leaveRequests}
                overtimeRequests={overtimeRequests}
                onApproveLeave={handleApproveLeave}
                onRejectLeave={handleRejectLeave}
                onAddLeave={handleAddLeave}
                onApproveOvertime={handleApproveOvertime}
                onRejectOvertime={handleRejectOvertime}
                onAddOvertime={handleAddOvertime}
              />
            )}

            {activeTab === 'reimbursement' && (
              <ReimbursementView
                employees={employees}
                reimbursements={reimbursements}
                onAddReimbursement={handleAddReimbursement}
                onUpdateReimbursement={handleUpdateReimbursement}
                onDeleteReimbursement={handleDeleteReimbursement}
                onImportReimbursements={handleImportReimbursements}
                adminEmail={adminUser?.email}
              />
            )}

            {activeTab === 'cash_advance' && (
              <CashAdvanceView
                cashAdvances={cashAdvances}
                employees={employees}
                payrolls={syncedPayrolls}
                companyConfig={companyConfig}
                adminUser={adminUser}
                onApproveCashAdvance={handleApproveCashAdvance}
                onRejectCashAdvance={handleRejectCashAdvance}
                onDisburseCashAdvance={handleDisburseCashAdvance}
                onCreateCashAdvance={handleCreateCashAdvance}
                onApplyDeductionToPayroll={handleApplyCashAdvanceDeductionToPayroll}
                onNavigateToPayroll={() => setActiveTab('payroll')}
              />
            )}

            {activeTab === 'assets' && (
              <AssetManagementView
                assets={assets}
                assetLogs={assetLogs}
                employees={employees}
                adminUser={adminUser}
                onAddAsset={handleAddAsset}
                onUpdateAsset={handleUpdateAsset}
                onDeleteAsset={handleDeleteAsset}
                onAssignAsset={handleAssignAsset}
                onReturnAsset={handleReturnAsset}
              />
            )}

            {activeTab === 'tax_bpjs' && (
              <TaxAndBpjsView employees={employees} payrolls={syncedPayrolls} />
            )}

            {activeTab === 'performance_review' && (
              <PerformanceReviewView
                reviews={reviews}
                employees={employees}
                payrolls={syncedPayrolls}
                companyConfig={companyConfig}
                adminUser={adminUser}
                onAddReview={handleAddReview}
                onUpdateReview={handleUpdateReview}
                onDeleteReview={handleDeleteReview}
                onApplyBonusToPayroll={handleApplyBonusToPayroll}
                onBatchApplyBonusesToPayroll={handleBatchApplyBonusesToPayroll}
                onNavigateToPayroll={() => setActiveTab('payroll')}
                onOpenNewPeriod={handleOpenNewReviewPeriod}
                onSendDeadlineReminder={handleSendDeadlineReminder}
              />
            )}

            {activeTab === 'kpi_performance' && (
              <DepartmentKpiView employees={employees} />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                employees={employees}
                payrolls={syncedPayrolls}
                companyConfig={companyConfig}
              />
            )}

            {activeTab === 'audit_logs' && (
              <AuditLogsView
                logs={systemAuditLogs}
                adminUser={adminUser}
                allowedAdmins={companyConfig.allowedGoogleAdmins}
                onAddLogNote={(note) => {
                  logActivity(
                    'MANUAL_AUDIT_NOTE',
                    note.category,
                    note.description,
                    {
                      targetName: note.targetName,
                      severity: note.severity,
                      notes: note.notes,
                    }
                  );
                }}
              />
            )}

            {activeTab === 'roles_management' && (
              <RoleManagementView
                onLogAudit={logActivity}
                onSendNotification={sendNotification}
                adminUser={adminUser}
                companyConfig={companyConfig}
                onUpdateConfig={(newConfig) => setCompanyConfig(newConfig)}
                onSwitchAdminUserRole={handleSwitchAdminUserRole}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                companyConfig={companyConfig}
                onUpdateConfig={(newConfig) => {
                  // Audit Logging: Track changes in Role Permissions, Admin Accounts, or Settings
                  const oldPerms = JSON.stringify(companyConfig.rolePermissions);
                  const newPerms = JSON.stringify(newConfig.rolePermissions);
                  if (oldPerms !== newPerms) {
                    logActivity(
                      'ROLE_PERMISSION_UPDATE',
                      'Hak Akses & Admin',
                      'Mengubah matriks pengaturan hak akses peran dan wewenang modul dashboard.',
                      {
                        targetId: 'role-permissions',
                        targetName: 'Matriks Hak Akses Peran',
                        severity: 'warning',
                        notes: 'Pembaruan izin akses modul dan eksekusi admin.',
                      }
                    );
                  }

                  const oldAdmins = companyConfig.allowedGoogleAdmins || [];
                  const newAdmins = newConfig.allowedGoogleAdmins || [];
                  if (newAdmins.length > oldAdmins.length) {
                    const added = newAdmins.find((a) => !oldAdmins.some((o) => o.id === a.id)) || newAdmins[newAdmins.length - 1];
                    logActivity(
                      'ADMIN_CREATE',
                      'Hak Akses & Admin',
                      `Menambahkan akun Google Admin baru: ${added?.name} (${added?.email}) dengan peran "${added?.role}".`,
                      {
                        targetId: added?.id,
                        targetName: `${added?.name} (${added?.email})`,
                        newValue: `Role: ${added?.role}, Status: ${added?.status}`,
                        severity: 'warning',
                      }
                    );
                  } else if (newAdmins.length < oldAdmins.length) {
                    const removed = oldAdmins.find((a) => !newAdmins.some((n) => n.id === a.id));
                    logActivity(
                      'ADMIN_DELETE',
                      'Hak Akses & Admin',
                      `Menghapus akses akun Google Admin: ${removed?.name || 'Admin'} (${removed?.email || 'Email'}).`,
                      {
                        targetId: removed?.id,
                        targetName: `${removed?.name} (${removed?.email})`,
                        oldValue: `Role: ${removed?.role}`,
                        newValue: 'Akun dihapus dari daftar pengelola',
                        severity: 'danger',
                      }
                    );
                  } else {
                    const changed = newAdmins.find((a) => {
                      const match = oldAdmins.find((o) => o.id === a.id);
                      return match && (match.status !== a.status || match.role !== a.role);
                    });
                    if (changed) {
                      const oldMatch = oldAdmins.find((o) => o.id === changed.id);
                      logActivity(
                        'ADMIN_UPDATE',
                        'Hak Akses & Admin',
                        `Mengubah akun Google Admin ${changed.name} (${changed.email}): Status ${oldMatch?.status} → ${changed.status}, Peran ${oldMatch?.role} → ${changed.role}.`,
                        {
                          targetId: changed.id,
                          targetName: changed.name,
                          oldValue: `Status: ${oldMatch?.status}, Role: ${oldMatch?.role}`,
                          newValue: `Status: ${changed.status}, Role: ${changed.role}`,
                          severity: changed.status === 'suspended' ? 'danger' : 'warning',
                          notes: 'Pembaruan status operasional akun admin.',
                        }
                      );
                    }
                  }

                  if (
                    companyConfig.disbursementAccount !== newConfig.disbursementAccount ||
                    companyConfig.disbursementBank !== newConfig.disbursementBank
                  ) {
                    logActivity(
                      'COMPANY_SETTINGS_UPDATE',
                      'Pengaturan Sistem',
                      `Memperbarui rekening bank pencairan gaji utama perusahaan: ${newConfig.disbursementBank} (${newConfig.disbursementAccount}).`,
                      {
                        targetId: 'bank-disbursement',
                        targetName: 'Rekening Payroll Perusahaan',
                        oldValue: `${companyConfig.disbursementBank} (${companyConfig.disbursementAccount})`,
                        newValue: `${newConfig.disbursementBank} (${newConfig.disbursementAccount})`,
                        severity: 'warning',
                      }
                    );
                  }

                  setCompanyConfig(newConfig);
                  if (adminUser) {
                    const matched = newConfig.allowedGoogleAdmins?.find(
                      (a) => a.email.toLowerCase() === adminUser.email.toLowerCase()
                    );
                    if (matched) {
                      const updatedUser: GoogleAdminUser = {
                        ...adminUser,
                        name: matched.name,
                        picture: matched.avatarUrl || adminUser.picture,
                        role: matched.role,
                        phone: matched.phone,
                      };
                      setAdminUser(updatedUser);
                      try {
                        localStorage.setItem('tgi_admin_google_user', JSON.stringify(updatedUser));
                      } catch (e) {
                        console.error('Storage error', e);
                      }
                    } else if (newConfig.adminGoogleEmail && adminUser.email !== newConfig.adminGoogleEmail) {
                      const updatedUser: GoogleAdminUser = { ...adminUser, email: newConfig.adminGoogleEmail };
                      setAdminUser(updatedUser);
                      try {
                        localStorage.setItem('tgi_admin_google_user', JSON.stringify(updatedUser));
                      } catch (e) {
                        console.error('Storage error', e);
                      }
                    }
                  }
                }}
                employees={employees}
                onUpdateEmployee={handleUpdateEmployee}
                onLogAudit={logActivity}
                onSendNotification={sendNotification}
                adminUser={adminUser}
                onSwitchAdminUserRole={handleSwitchAdminUserRole}
                onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
              />
            )}
          </main>
        </div>
      </div>

      {/* Slip Gaji Modal (Printable) */}
      <PayslipModal
        payroll={selectedPayslip}
        employee={selectedEmployeeForPayslip}
        companyConfig={companyConfig}
        onClose={() => setSelectedPayslip(null)}
      />

      {/* Admin PIN & Supabase Auth Modal */}
      <AdminPinAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={handleAdminUnlockSuccess}
        companyConfig={companyConfig}
      />

      {/* Supabase Cloud Database & SQL Schema Modal */}
      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        syncStatus={supabaseStatus}
        onRefreshStatus={refreshSupabaseStatus}
        onTriggerSeed={handleTriggerSeed}
        isSeeding={isSeedingSupabase}
        employeeCount={employees.length}
        assetCount={assets.length}
      />
    </div>
  );
}
