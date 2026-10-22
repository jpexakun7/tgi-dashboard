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
} from './types';
import { calculatePayroll } from './utils/formatters';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { EmployeeManagement } from './components/EmployeeManagement';
import { PayrollManagement } from './components/PayrollManagement';
import { AttendanceView } from './components/AttendanceView';
import { LeaveAndOvertime } from './components/LeaveAndOvertime';
import { ReimbursementView } from './components/ReimbursementView';
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

  // System Audit Logs State (History of critical admin actions: salary, employee deletion, role permissions)
  const [systemAuditLogs, setSystemAuditLogs] = useState<SystemAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_system_audit_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
  const [portalTabOverride, setPortalTabOverride] = useState<'payroll' | 'leave' | 'claims' | 'assets' | 'performance' | 'profile' | null>(null);

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
            }
          });
        }
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
      const saved = localStorage.getItem('tgi_employees_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved employees', e);
    }
    return initialEmployees;
  });

  // Keep employees in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tgi_employees_data', JSON.stringify(employees));
    } catch (e) {
      console.error('Failed to save employees to localStorage', e);
    }
  }, [employees]);

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_payrolls_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse payrolls', e);
    }
    return initialPayrollRecords;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_payrolls_data', JSON.stringify(payrolls));
    } catch (e) {
      console.error('Failed to save payrolls to localStorage', e);
    }
  }, [payrolls]);

  const [attendances, setAttendances] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_attendances_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved attendances', e);
    }
    return initialAttendanceRecords;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_attendances_data', JSON.stringify(attendances));
    } catch (e) {
      console.error('Failed to save attendances to localStorage', e);
    }
  }, [attendances]);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_leave_requests_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved leave requests', e);
    }
    return initialLeaveRequests;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_leave_requests_data', JSON.stringify(leaveRequests));
    } catch (e) {
      console.error('Failed to save leave requests to localStorage', e);
    }
  }, [leaveRequests]);

  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_overtime_requests_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved overtime requests', e);
    }
    return initialOvertimeRequests;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tgi_overtime_requests_data', JSON.stringify(overtimeRequests));
    } catch (e) {
      console.error('Failed to save overtime requests to localStorage', e);
    }
  }, [overtimeRequests]);

  const [reimbursements, setReimbursements] = useState<ReimbursementClaim[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_reimbursements_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved reimbursements', e);
    }
    return initialReimbursements;
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
        if (Array.isArray(parsed)) return parsed;
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

  // Payslip Modal State
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  // Pending counts for badges & alerts
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'Menunggu Persetujuan');
  const pendingOvertimes = overtimeRequests.filter((o) => o.status === 'Menunggu Persetujuan');
  const pendingReimbursements = reimbursements.filter((r) => r.status === 'Menunggu Persetujuan');

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
      // Strictly lock Admin mode when entering via Employee PIN
      setIsAdminUnlocked(false);
      try {
        sessionStorage.removeItem('tgi_admin_unlocked');
      } catch (e) {
        console.error(e);
      }
      if (options.employeeId) {
        setActiveEmployeeId(options.employeeId);
      }
      setDashboardMode('employee');
    }
  };

  const handleAdminUnlockSuccess = () => {
    setIsAdminUnlocked(true);
    try {
      sessionStorage.setItem('tgi_admin_unlocked', 'true');
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
    } catch (e) {
      console.error(e);
    }
    setDashboardMode('employee');
    logActivity(
      'LOGIN_ACTIVITY',
      'Autentikasi',
      'Mengunci layar keamanan web dan mengakhiri sesi Admin.',
      { severity: 'info' }
    );
  };

  const handleToggleDashboardMode = () => {
    if (dashboardMode === 'employee') {
      if (isAdminUnlocked) {
        setDashboardMode('admin');
      } else {
        setIsAdminAuthModalOpen(true);
      }
    } else {
      setDashboardMode('employee');
    }
  };

  // Selected Employee ID for Portal Karyawan
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>(() => {
    try {
      return localStorage.getItem('tgi_active_employee_id') || '';
    } catch {
      return '';
    }
  });

  // Determine current active employee in Portal Karyawan
  const currentEmployee = useMemo(() => {
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
  }, [activeEmployeeId, employees, adminUser]);

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

  // -------------------------------------------------------------
  // Supabase Connection, Real-time Sync for 7 Tables
  // -------------------------------------------------------------
  const refreshSupabaseStatus = async () => {
    try {
      const status = await checkSupabaseStatus();
      setSupabaseStatus(status);

      if (status.isTablesCreated) {
        // 1. Fetch employees
        const cloudEmps = await fetchEmployeesFromSupabase();
        if (cloudEmps !== null) {
          setEmployees(cloudEmps);
        }

        // 2. Fetch assets
        const cloudAssets = await fetchAssetsFromSupabase();
        if (cloudAssets !== null) {
          setAssets(cloudAssets);
        }

        // 3. Fetch payrolls
        const cloudPayrolls = await fetchPayrollsFromSupabase();
        if (cloudPayrolls !== null) {
          setPayrolls(cloudPayrolls);
        }

        // 4. Fetch attendances (Presensi)
        const cloudAtts = await fetchAttendancesFromSupabase();
        if (cloudAtts !== null) {
          setAttendances(cloudAtts);
        }

        // 5. Fetch leave requests (Cuti & Izin)
        const cloudLeaves = await fetchLeaveRequestsFromSupabase();
        if (cloudLeaves !== null) {
          setLeaveRequests(cloudLeaves);
        }

        // 6. Fetch overtime requests (Lembur)
        const cloudOvertimes = await fetchOvertimeRequestsFromSupabase();
        if (cloudOvertimes !== null) {
          setOvertimeRequests(cloudOvertimes);
        }

        // 7. Fetch reimbursements (Klaim Biaya)
        const cloudReimbursements = await fetchReimbursementsFromSupabase();
        if (cloudReimbursements !== null) {
          setReimbursements(cloudReimbursements);
        }
      }
    } catch (err) {
      console.warn('Supabase status check failed:', err);
    }
  };

  const handleTriggerSeed = async () => {
    setIsSeedingSupabase(true);
    try {
      const res = await autoSeedSupabaseIfEmpty(
        employees.length > 0 ? employees : initialEmployees,
        assets.length > 0 ? assets : initialCompanyAssets,
        payrolls.length > 0 ? payrolls : initialPayrollRecords
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
          if (payload.eventType === 'INSERT') {
            const newEmp = dbToEmployee(payload.new);
            setEmployees((prev) => {
              if (prev.some((e) => e.id === newEmp.id)) return prev;
              return [newEmp, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedEmp = dbToEmployee(payload.new);
            setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setEmployees((prev) => prev.filter((e) => e.id !== oldId));
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
          if (payload.eventType === 'INSERT') {
            const newPay = dbToPayroll(payload.new);
            setPayrolls((prev) => {
              if (prev.some((p) => p.id === newPay.id)) return prev;
              return [newPay, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPay = dbToPayroll(payload.new);
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
          if (payload.eventType === 'INSERT') {
            const newAtt = dbToAttendance(payload.new);
            setAttendances((prev) => {
              if (prev.some((a) => a.id === newAtt.id)) return prev;
              return [newAtt, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedAtt = dbToAttendance(payload.new);
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
          if (payload.eventType === 'INSERT') {
            const newLeave = dbToLeave(payload.new);
            setLeaveRequests((prev) => {
              if (prev.some((l) => l.id === newLeave.id)) return prev;
              return [newLeave, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedLeave = dbToLeave(payload.new);
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
          if (payload.eventType === 'INSERT') {
            const newOt = dbToOvertime(payload.new);
            setOvertimeRequests((prev) => {
              if (prev.some((o) => o.id === newOt.id)) return prev;
              return [newOt, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedOt = dbToOvertime(payload.new);
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
          if (payload.eventType === 'INSERT') {
            const newClaim = dbToReimbursement(payload.new);
            setReimbursements((prev) => {
              if (prev.some((c) => c.id === newClaim.id)) return prev;
              return [newClaim, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedClaim = dbToReimbursement(payload.new);
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
    setEmployees((prev) => [newEmp, ...prev]);
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
    const oldEmp = employees.find((e) => e.id === updatedEmp.id);
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    // Update matching payroll calculation
    setPayrolls((prev) =>
      prev.map((p) => {
        if (p.employeeId === updatedEmp.id) {
          return calculatePayroll(
            updatedEmp,
            companyConfig.currentPayrollPeriod,
            Math.round(p.overtimePay / 100000),
            p.bonus,
            p.lateDeduction > 0 ? 30 : 0
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
    setEmployees((prev) => {
      const remaining = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem('tgi_employees_data', JSON.stringify(remaining));
      } catch (err) {
        console.error('Storage error', err);
      }
      return remaining;
    });
    setPayrolls((prev) => prev.filter((p) => p.employeeId !== id));

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
      `Menghapus permanen data karyawan ${empToDelete?.fullName || id} (NIK: ${empToDelete?.nik || id}) - Jabatan: ${empToDelete?.role || '-'} dari database aktif.`,
      {
        targetId: id,
        targetName: empToDelete?.fullName || id,
        oldValue: empToDelete
          ? `Gaji Pokok: Rp ${empToDelete.baseSalary.toLocaleString('id-ID')}, Dept: ${empToDelete.department}, Status: ${empToDelete.employmentStatus}`
          : undefined,
        newValue: 'Data karyawan dan record payroll dihapus permanen',
        severity: 'danger',
        notes: 'Penghapusan arsip karyawan oleh admin berwenang.',
      }
    );
  };

  // Handlers for Payroll
  const handleRecalculatePayroll = () => {
    const updated = employees.map((emp) => {
      // Find approved overtimes for this employee
      const employeeOts = overtimeRequests.filter(
        (o) => o.employeeId === emp.id && o.status === 'Disetujui'
      );
      const totalOtHours = employeeOts.reduce((acc, curr) => acc + curr.hours, 0);

      // Find attendances
      const empAtts = attendances.filter((a) => a.employeeId === emp.id);
      const totalLateMinutes = empAtts.reduce((acc, curr) => acc + curr.lateMinutes, 0);

      // Find existing bonus if any
      const existingRecord = payrolls.find((p) => p.employeeId === emp.id);
      const bonus = existingRecord ? existingRecord.bonus : 0;

      return calculatePayroll(
        emp,
        companyConfig.currentPayrollPeriod,
        totalOtHours,
        bonus,
        totalLateMinutes
      );
    });

    setPayrolls(updated);

    logActivity(
      'PAYROLL_RUN',
      'Gaji & Payroll',
      `Menjalankan batch kalkulasi payroll periode "${companyConfig.currentPayrollPeriod}" untuk seluruh ${employees.length} karyawan aktif.`,
      {
        targetId: `payroll-${companyConfig.currentPayrollPeriod}`,
        targetName: `Batch Payroll ${companyConfig.currentPayrollPeriod}`,
        severity: 'warning',
        notes: 'Sinkronisasi jam lembur terverifikasi dan potongan keterlambatan.',
      }
    );
  };

  const handleUpdatePayrollRecord = (record: PayrollRecord) => {
    setPayrolls((prev) => prev.map((p) => (p.id === record.id ? record : p)));
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

  // Handlers for Attendance
  const handleAddAttendance = (att: AttendanceRecord) => {
    setAttendances((prev) => {
      const exists = prev.some((a) => a.id === att.id);
      if (exists) {
        return prev.map((a) => (a.id === att.id ? att : a));
      }
      return [att, ...prev];
    });
    upsertAttendanceToSupabase(att);
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

  // Handlers for Overtime
  const handleApproveOvertime = (id: string) => {
    const otItem = overtimeRequests.find((o) => o.id === id);
    const emp = otItem ? employees.find((e) => e.id === otItem.employeeId) : null;

    setOvertimeRequests((prev) =>
      prev.map((ot) => {
        if (ot.id === id) {
          // Add overtime pay to employee payroll
          setPayrolls((pays) =>
            pays.map((p) => {
              if (p.employeeId === ot.employeeId) {
                const newOtPay = p.overtimePay + ot.calculatedPay;
                const newGross = p.totalGrossSalary + ot.calculatedPay;
                const newTHP = Math.max(0, newGross - p.totalDeductions);
                const updatedPayroll = {
                  ...p,
                  overtimePay: newOtPay,
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
      `Menyetujui klaim lembur ${otItem?.hours || 0} jam (Rp ${otItem?.calculatedPay.toLocaleString('id-ID')}) untuk ${emp?.fullName || otItem?.employeeId}.`,
      {
        targetId: id,
        targetName: emp?.fullName || otItem?.employeeId,
        oldValue: 'Status: Menunggu Persetujuan',
        newValue: `Status: Disetujui (+ Rp ${otItem?.calculatedPay.toLocaleString('id-ID')})`,
        severity: 'info',
      }
    );
  };

  const handleRejectOvertime = (id: string) => {
    const otItem = overtimeRequests.find((o) => o.id === id);
    const emp = otItem ? employees.find((e) => e.id === otItem.employeeId) : null;

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
      `Menolak permohonan lembur ${otItem?.hours || 0} jam untuk ${emp?.fullName || otItem?.employeeId}.`,
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
    logActivity(
      'OVERTIME_STATUS_UPDATE',
      'Persetujuan & Klaim',
      `Pengajuan mandiri lembur ${req.hours} jam oleh ${emp?.fullName || req.employeeId}: "${req.taskDescription}".`,
      {
        targetId: req.id,
        targetName: emp?.fullName || req.employeeId,
        newValue: `Tanggal: ${req.date}, Estimasi: Rp ${req.calculatedPay.toLocaleString('id-ID')}`,
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
      `Menghapus klaim reimbursement ${claim?.claimNumber || id} senilai Rp ${claim?.amount.toLocaleString('id-ID') || 0}.`,
      {
        targetId: id,
        targetName: claim?.claimNumber || id,
        oldValue: `Nominal: Rp ${claim?.amount.toLocaleString('id-ID') || 0}, Status: ${claim?.status || '-'}`,
        newValue: 'Klaim reimbursement dihapus dari sistem',
        severity: 'warning',
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
      ? payrolls
      : payrolls.filter((p) => p.employeeId === currentEmployee?.id);

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
            onUpdateProfile={handleUpdateEmployee}
            onOpenPayslip={handleOpenPayslip}
            onSwitchToAdminMode={handleToggleDashboardMode}
            onSelectEmployee={(empId) => setActiveEmployeeId(empId)}
            isAdminUnlocked={isAdminUnlocked}
            onRequestAdminAccess={() => setIsAdminAuthModalOpen(true)}
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
                payrolls={payrolls}
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
                payrolls={payrolls}
                reviews={reviews}
                companyConfig={companyConfig}
                onOpenPayslip={handleOpenPayslip}
                onRecalculatePayroll={handleRecalculatePayroll}
                onUpdatePayrollRecord={handleUpdatePayrollRecord}
                onApplyImportedPayroll={(importedPayrolls) => {
                  setPayrolls(importedPayrolls);
                }}
                onNavigateToPerformanceReview={() => setActiveTab('performance_review')}
                onApplyBonusToPayroll={handleApplyBonusToPayroll}
                onBatchApplyBonusesToPayroll={handleBatchApplyBonusesToPayroll}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceView
                employees={employees}
                attendances={attendances}
                onAddAttendance={handleAddAttendance}
                onApplyImportedAttendance={(importedAttendances) => {
                  setAttendances((prev) => [...importedAttendances, ...prev]);
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
              <TaxAndBpjsView employees={employees} payrolls={payrolls} />
            )}

            {activeTab === 'performance_review' && (
              <PerformanceReviewView
                reviews={reviews}
                employees={employees}
                payrolls={payrolls}
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
                payrolls={payrolls}
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
