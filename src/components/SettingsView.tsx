import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Building,
  Calendar,
  CreditCard,
  Globe,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Mail,
  Phone,
  Lock,
  Save,
  CheckCircle,
  Sliders,
  DollarSign,
  Clock,
  KeyRound,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  Eye,
  Percent,
  Banknote,
  Briefcase,
  Copy,
  Database,
} from 'lucide-react';
import {
  CompanyConfig,
  GoogleAdminAccount,
  GoogleAdminRole,
  DashboardModule,
  RolePermissionConfig,
  GoogleAuthSettings,
  Employee,
  ActivityActionType,
  ActivityCategory,
  GoogleAdminUser,
} from '../types';
import {
  initialAllowedGoogleAdmins,
  initialRolePermissions,
  initialGoogleAuthSettings,
} from '../mockData';
import { GranularRbacPanel } from './GranularRbacPanel';
import { RoleModuleVisibilityPanel } from './RoleModuleVisibilityPanel';

export interface UserAccountItem {
  id: string;
  nik: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  role: string;
  assignedRoles: string[];
  status: 'active' | 'suspended';
  avatarUrl: string;
  lastLogin?: string;
  passwordLastChanged?: string;
}

const DEFAULT_USER_ACCOUNTS: UserAccountItem[] = [
  {
    id: 'usr-01',
    nik: 'TGI-ADM-001',
    name: 'Super Admin TGI',
    email: 'jpexakun7@gmail.com',
    phone: '0812-3456-7890',
    department: 'Direksi & Manajemen',
    role: 'Super Admin',
    assignedRoles: ['Super Admin'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: 'Hari ini, 09:15 WIB',
    passwordLastChanged: '2026-09-10',
  },
  {
    id: 'usr-02',
    nik: 'TGI-HR-002',
    name: 'Siti Nurhaliza',
    email: 'hr.tasgrosirimport@gmail.com',
    phone: '0813-2233-4455',
    department: 'Human Resources & GA',
    role: 'HR Manager',
    assignedRoles: ['HR Manager'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: 'Kemarin, 16:40 WIB',
    passwordLastChanged: '2026-08-15',
  },
  {
    id: 'usr-03',
    nik: 'TGI-FIN-003',
    name: 'Budi Santoso',
    email: 'finance.tasgrosirimport@gmail.com',
    phone: '0812-7788-9900',
    department: 'Keuangan & Akuntansi',
    role: 'Finance / Payroll Admin',
    assignedRoles: ['Finance / Payroll Admin'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: '12 Okt 2026, 14:20 WIB',
    passwordLastChanged: '2026-07-22',
  },
  {
    id: 'usr-04',
    nik: 'TGI-OPS-004',
    name: 'Dewi Lestari',
    email: 'operasional.tasgrosirimport@gmail.com',
    phone: '0818-5566-7788',
    department: 'Operasional & Gudang',
    role: 'Division Lead / Supervisor',
    assignedRoles: ['Division Lead / Supervisor'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: '10 Okt 2026, 11:05 WIB',
    passwordLastChanged: '2026-09-01',
  },
  {
    id: 'usr-05',
    nik: 'TGI-2021-001',
    name: 'Arya Wicaksono',
    email: 'arya.wicaksono@tasgrosirimport.co.id',
    phone: '0812-9988-7711',
    department: 'Teknologi & IT',
    role: 'Division Lead / Supervisor',
    assignedRoles: ['Division Lead / Supervisor'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: 'Hari ini, 08:30 WIB',
    passwordLastChanged: '2026-08-30',
  },
  {
    id: 'usr-06',
    nik: 'TGI-2022-014',
    name: 'Rian Pratama',
    email: 'rian.pratama@tasgrosirimport.co.id',
    phone: '0813-8899-0011',
    department: 'Gudang & Logistik',
    role: 'Employee (Staf Biasa)',
    assignedRoles: ['Employee (Staf Biasa)'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: '09 Okt 2026, 17:10 WIB',
    passwordLastChanged: '2026-06-18',
  },
  {
    id: 'usr-07',
    nik: 'TGI-2023-089',
    name: 'Nadia Putri',
    email: 'nadia.putri@tasgrosirimport.co.id',
    phone: '0812-1122-3344',
    department: 'Pemasaran & Penjualan',
    role: 'Employee (Staf Biasa)',
    assignedRoles: ['Employee (Staf Biasa)'],
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: '08 Okt 2026, 15:45 WIB',
    passwordLastChanged: '2026-05-12',
  },
  {
    id: 'usr-08',
    nik: 'TGI-2024-112',
    name: 'Bambang Irawan',
    email: 'bambang.irawan@tasgrosirimport.co.id',
    phone: '0817-4455-6677',
    department: 'Operasional & Toko',
    role: 'Employee (Staf Biasa)',
    assignedRoles: ['Employee (Staf Biasa)'],
    status: 'suspended',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&h=256&q=80',
    lastLogin: '01 Sep 2026, 09:00 WIB',
    passwordLastChanged: '2026-04-10',
  },
];

const AVAILABLE_ROLE_OPTIONS = [
  'Super Admin',
  'HR Manager',
  'Finance / Payroll Admin',
  'Division Lead / Supervisor',
  'Employee (Staf Biasa)',
];

const ROLE_BADGE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'Super Admin': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  'HR Manager': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'Finance / Payroll Admin': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  'Division Lead / Supervisor': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  'Employee (Staf Biasa)': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
};

interface SettingsViewProps {
  companyConfig: CompanyConfig;
  onUpdateConfig: (newConfig: CompanyConfig) => void;
  onNavigateToRoleManagement?: () => void;
  employees?: Employee[];
  onLogAudit?: (
    actionType: ActivityActionType,
    category: ActivityCategory,
    description: string,
    meta?: any
  ) => void;
  onSendNotification?: (notif: any) => void;
  adminUser?: GoogleAdminUser | null;
  initialTab?: 'module_visibility' | 'rbac' | 'accounts' | 'general_payroll';
  onSwitchAdminUserRole?: (roleName: string) => void;
  onOpenSupabaseModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  companyConfig,
  onUpdateConfig,
  employees = [],
  onLogAudit,
  onSendNotification,
  adminUser,
  initialTab = 'module_visibility',
  onSwitchAdminUserRole,
  onOpenSupabaseModal,
}) => {
  // Navigation tabs:
  // 1. "Visibilitas Menu & Role"
  // 2. "Manajemen Role & Hak Akses (RBAC)"
  // 3. "Pengaturan Akun & Akses Pengguna"
  // 4. "Konfigurasi Umum Sistem & Payroll"
  const [activeSubTab, setActiveSubTab] = useState<'module_visibility' | 'rbac' | 'accounts' | 'general_payroll'>(
    initialTab
  );

  const [formData, setFormData] = useState<CompanyConfig>({
    ...companyConfig,
    maxCashAdvancePercentage: companyConfig.maxCashAdvancePercentage ?? 50,
    standardWorkHoursPerDay: companyConfig.standardWorkHoursPerDay ?? 8,
    standardWorkDaysPerWeek: companyConfig.standardWorkDaysPerWeek ?? 5,
    defaultOvertimeMultiplier: companyConfig.defaultOvertimeMultiplier ?? 1.5,
    defaultOvertimeRatePerHour: companyConfig.defaultOvertimeRatePerHour ?? 55000,
  });

  // Keep formData in sync when companyConfig updates
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      ...companyConfig,
      maxCashAdvancePercentage: companyConfig.maxCashAdvancePercentage ?? prev.maxCashAdvancePercentage ?? 50,
      standardWorkHoursPerDay: companyConfig.standardWorkHoursPerDay ?? prev.standardWorkHoursPerDay ?? 8,
      standardWorkDaysPerWeek: companyConfig.standardWorkDaysPerWeek ?? prev.standardWorkDaysPerWeek ?? 5,
      defaultOvertimeMultiplier: companyConfig.defaultOvertimeMultiplier ?? prev.defaultOvertimeMultiplier ?? 1.5,
      defaultOvertimeRatePerHour: companyConfig.defaultOvertimeRatePerHour ?? prev.defaultOvertimeRatePerHour ?? 55000,
    }));
  }, [companyConfig]);

  // Keep activeSubTab in sync if initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  // Account Status Toggle Confirmation Dialog
  const [accountConfirmDialog, setAccountConfirmDialog] = useState<{
    isOpen: boolean;
    user: UserAccountItem;
    actionLabel: string;
    newStatus: 'active' | 'suspended';
  } | null>(null);

  // User Accounts State for Tab 2
  const [userAccounts, setUserAccounts] = useState<UserAccountItem[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_user_accounts_list_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse user accounts', e);
    }
    return DEFAULT_USER_ACCOUNTS;
  });

  // Search & Filter State for Tab 2
  const [searchAccountQuery, setSearchAccountQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals for Tab 2: Assign Role, Reset Password, Add User
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<UserAccountItem | null>(null);

  // Assign Role form state
  const [selectedRolesForUser, setSelectedRolesForUser] = useState<string[]>([]);

  // Reset Password state
  const [tempPassword, setTempPassword] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Add user form state
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    nik: '',
    email: '',
    phone: '',
    department: 'Human Resources & GA',
    role: 'Employee (Staf Biasa)',
  });

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConfigSaved, setIsConfigSaved] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Save user accounts to storage
  const saveUserAccounts = (newList: UserAccountItem[]) => {
    setUserAccounts(newList);
    try {
      localStorage.setItem('tgi_user_accounts_list_v1', JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save user accounts', e);
    }
  };

  // Submit Tab 3: General & Payroll Settings
  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(formData);
    setIsConfigSaved(true);
    triggerToast('Konfigurasi umum sistem dan payroll berhasil disimpan!');
    setTimeout(() => setIsConfigSaved(false), 3500);

    // Audit Logging
    if (onLogAudit) {
      onLogAudit(
        'SETTINGS_MODIFIED',
        'Pengaturan Sistem',
        `Memperbarui konfigurasi global: Cut-off (${formData.cutOffStartDay}-${formData.cutOffEndDay}), Payday (${formData.payrollDisbursementDay}), Plafon Kasbon (${formData.maxCashAdvancePercentage}%), Jam Kerja (${formData.standardWorkHoursPerDay} jam/hari).`,
        {
          targetId: 'system-config',
          targetName: 'Konfigurasi Umum Sistem & Payroll',
          severity: 'warning',
          notes: `Diperbarui oleh ${adminUser?.name || 'Admin'} (${adminUser?.email || 'admin@tgi.co.id'}).`,
        }
      );
    }

    if (onSendNotification) {
      onSendNotification({
        recipientType: 'admin',
        title: 'Konfigurasi Sistem & Payroll Telah Diperbarui',
        message: `Parameter siklus cut-off, plafon kasbon (${formData.maxCashAdvancePercentage}%), dan tarif lembur telah diperbarui.`,
        category: 'SYSTEM_SECURITY',
        priority: 'normal',
      });
    }
  };

  // Open Assign Role Modal
  const handleOpenAssignRoleModal = (user: UserAccountItem) => {
    setSelectedUserForAction(user);
    setSelectedRolesForUser(user.assignedRoles || [user.role]);
    setIsAssignRoleModalOpen(true);
  };

  // Save Assign Role
  const handleSaveAssignedRoles = () => {
    if (!selectedUserForAction || selectedRolesForUser.length === 0) return;

    const primaryRole = selectedRolesForUser[0];
    const oldRole = selectedUserForAction.role;

    const updated = userAccounts.map((u) => {
      if (u.id === selectedUserForAction.id) {
        return {
          ...u,
          role: primaryRole,
          assignedRoles: selectedRolesForUser,
        };
      }
      return u;
    });

    saveUserAccounts(updated);
    setIsAssignRoleModalOpen(false);
    triggerToast(`Role untuk ${selectedUserForAction.name} berhasil diperbarui menjadi ${primaryRole}.`);

    // Audit Logging
    if (onLogAudit) {
      onLogAudit(
        'USER_ACCESS_CHANGED',
        'Hak Akses & Admin',
        `Mengubah hak akses role pengguna ${selectedUserForAction.name} (${selectedUserForAction.email}): "${oldRole}" → "${primaryRole}".`,
        {
          targetId: selectedUserForAction.id,
          targetName: `${selectedUserForAction.name} (${selectedUserForAction.nik})`,
          oldValue: oldRole,
          newValue: primaryRole,
          severity: 'warning',
        }
      );
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPasswordModal = (user: UserAccountItem) => {
    setSelectedUserForAction(user);
    const newPass = `TGI#${Math.random().toString(36).slice(-6).toUpperCase()}!26`;
    setTempPassword(newPass);
    setCopiedPassword(false);
    setIsResetPasswordModalOpen(true);
  };

  // Confirm Reset Password
  const handleConfirmResetPassword = () => {
    if (!selectedUserForAction) return;

    const updated = userAccounts.map((u) => {
      if (u.id === selectedUserForAction.id) {
        return {
          ...u,
          passwordLastChanged: new Date().toISOString().slice(0, 10),
        };
      }
      return u;
    });

    saveUserAccounts(updated);
    setIsResetPasswordModalOpen(false);
    triggerToast(`Password untuk ${selectedUserForAction.name} berhasil di-reset.`);

    // Audit Logging
    if (onLogAudit) {
      onLogAudit(
        'USER_ACCESS_CHANGED',
        'Hak Akses & Admin',
        `Reset password akun pengguna: ${selectedUserForAction.name} (${selectedUserForAction.email}).`,
        {
          targetId: selectedUserForAction.id,
          targetName: `${selectedUserForAction.name} (${selectedUserForAction.nik})`,
          severity: 'warning',
          notes: 'Kredensial login sementara telah dibuat dan diverifikasi oleh admin.',
        }
      );
    }
  };

  // Toggle Suspend / Cabut Akses
  const handleToggleAccountStatus = (user: UserAccountItem) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const actionLabel = newStatus === 'suspended' ? 'Cabut Akses (Tangguhkan)' : 'Aktifkan Kembali';

    setAccountConfirmDialog({
      isOpen: true,
      user,
      actionLabel,
      newStatus: newStatus as 'active' | 'suspended',
    });
  };

  const confirmToggleAccountStatus = () => {
    if (!accountConfirmDialog) return;
    const { user, actionLabel, newStatus } = accountConfirmDialog;

    const updated = userAccounts.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          status: newStatus,
        };
      }
      return u;
    });

    saveUserAccounts(updated);
    setAccountConfirmDialog(null);
    triggerToast(
      `Status akses ${user.name} berhasil diubah menjadi ${newStatus === 'active' ? 'Aktif' : 'Ditangguhkan'}.`
    );

    // Audit Logging
    if (onLogAudit) {
      onLogAudit(
        'USER_ACCESS_CHANGED',
        'Hak Akses & Admin',
        `${actionLabel} akun pengguna: ${user.name} (${user.email}). Status: ${user.status} → ${newStatus}.`,
        {
          targetId: user.id,
          targetName: `${user.name} (${user.nik})`,
          oldValue: user.status,
          newValue: newStatus,
          severity: newStatus === 'suspended' ? 'danger' : 'success',
        }
      );
    }
  };

  // Create new user account
  const handleCreateUserAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email) return;

    const newId = `usr-${Date.now().toString().slice(-6)}`;
    const newAccount: UserAccountItem = {
      id: newId,
      nik: newUserForm.nik.trim() || `TGI-2026-${Math.floor(100 + Math.random() * 900)}`,
      name: newUserForm.name.trim(),
      email: newUserForm.email.trim(),
      phone: newUserForm.phone.trim() || '0812-0000-0000',
      department: newUserForm.department,
      role: newUserForm.role,
      assignedRoles: [newUserForm.role],
      status: 'active',
      avatarUrl: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&w=256&h=256&q=80`,
      lastLogin: 'Belum pernah login',
      passwordLastChanged: new Date().toISOString().slice(0, 10),
    };

    const updated = [newAccount, ...userAccounts];
    saveUserAccounts(updated);
    setIsAddUserModalOpen(false);
    setNewUserForm({
      name: '',
      nik: '',
      email: '',
      phone: '',
      department: 'Human Resources & GA',
      role: 'Employee (Staf Biasa)',
    });

    triggerToast(`Akun pengguna ${newAccount.name} (${newAccount.nik}) berhasil dibuat.`);

    // Audit Logging
    if (onLogAudit) {
      onLogAudit(
        'USER_ACCESS_CHANGED',
        'Hak Akses & Admin',
        `Membuat akun pengguna & menetapkan role: ${newAccount.name} (${newAccount.email}) dengan role "${newAccount.role}".`,
        {
          targetId: newAccount.id,
          targetName: `${newAccount.name} (${newAccount.nik})`,
          newValue: `Role: ${newAccount.role}, Status: active`,
          severity: 'info',
        }
      );
    }
  };

  // Synchronize from employees database
  const handleSyncFromEmployees = () => {
    if (employees.length === 0) {
      triggerToast('Tidak ada data karyawan tambahan untuk disinkronkan.');
      return;
    }

    let addedCount = 0;
    const currentEmails = new Set(userAccounts.map((u) => u.email.toLowerCase()));

    const newEntries: UserAccountItem[] = [];
    employees.forEach((emp) => {
      if (!currentEmails.has(emp.email.toLowerCase())) {
        currentEmails.add(emp.email.toLowerCase());
        newEntries.push({
          id: `usr-${emp.id}`,
          nik: emp.nik,
          name: emp.fullName,
          email: emp.email,
          phone: emp.phone,
          department: emp.department,
          role: emp.department.includes('IT') || emp.department.includes('Teknologi')
            ? 'Division Lead / Supervisor'
            : 'Employee (Staf Biasa)',
          assignedRoles: [
            emp.department.includes('IT') ? 'Division Lead / Supervisor' : 'Employee (Staf Biasa)',
          ],
          status: emp.isActive ? 'active' : 'suspended',
          avatarUrl: emp.avatarUrl,
          lastLogin: 'Belum pernah login',
          passwordLastChanged: new Date().toISOString().slice(0, 10),
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      const merged = [...userAccounts, ...newEntries];
      saveUserAccounts(merged);
      triggerToast(`Berhasil menyinkronkan ${addedCount} akun baru dari database Karyawan TGI.`);

      if (onLogAudit) {
        onLogAudit(
          'USER_ACCESS_CHANGED',
          'Data Karyawan',
          `Sinkronisasi massal ${addedCount} akun karyawan ke sistem kredensial & penetapan role RBAC.`,
          {
            severity: 'info',
            notes: 'Otomasi sinkronisasi master karyawan ke User Role Assignment.',
          }
        );
      }
    } else {
      triggerToast('Seluruh karyawan dalam database sudah memiliki akun pengguna aktif.');
    }
  };

  // Filtered accounts list
  const filteredAccounts = userAccounts.filter((account) => {
    const q = searchAccountQuery.toLowerCase();
    const matchSearch =
      account.name.toLowerCase().includes(q) ||
      account.nik.toLowerCase().includes(q) ||
      account.email.toLowerCase().includes(q) ||
      account.department.toLowerCase().includes(q) ||
      account.role.toLowerCase().includes(q);

    const matchRole = roleFilter === 'ALL' || account.role === roleFilter;
    const matchStatus = statusFilter === 'ALL' || account.status === statusFilter;

    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-7 h-7 text-indigo-600" />
            Pengaturan Sistem & Manajemen Role/Hak Akses Terpusat
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Pusat konfigurasi parameter perusahaan, matriks RBAC 6-level otorisasi, penugasan peran akun karyawan, dan jadwal payroll.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenSupabaseModal && (
            <button
              type="button"
              onClick={onOpenSupabaseModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Cloud Supabase & SQL Schema</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-4 h-4" />
            RBAC Enterprise Ready
          </span>
        </div>
      </div>

      {/* 4 Navigation Tabs:
          1. "Visibilitas Menu & Role (Atur Tampilan)"
          2. "Matriks Granular RBAC (Operasi CRUD)"
          3. "Pengaturan Akun & Akses Pengguna"
          4. "Konfigurasi Umum Sistem & Payroll" */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('module_visibility')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'module_visibility'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Visibilitas Menu & Role</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
            Atur Tampilan
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('rbac')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'rbac'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Matriks Granular RBAC</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
            Operasi CRUD
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('accounts')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'accounts'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengaturan Akun & Akses Pengguna</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
            {userAccounts.length} Akun
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('general_payroll')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'general_payroll'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Konfigurasi Umum Sistem & Payroll</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
            Cut-Off & Plafon
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: VISIBILITAS MENU & ROLE (ATUR TAMPILAN)                 */}
      {/* ============================================================== */}
      {activeSubTab === 'module_visibility' && (
        <div className="animate-fade-in space-y-6">
          <RoleModuleVisibilityPanel
            companyConfig={companyConfig}
            onUpdateConfig={onUpdateConfig}
            onLogAudit={onLogAudit}
            adminUser={adminUser}
            onSwitchAdminUserRole={onSwitchAdminUserRole}
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MANAJEMEN ROLE & HAK AKSES (RBAC)                      */}
      {/* ============================================================== */}
      {activeSubTab === 'rbac' && (
        <div className="animate-fade-in space-y-6">
          <GranularRbacPanel
            onLogAudit={onLogAudit}
            onSendNotification={onSendNotification}
            adminUser={adminUser}
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: PENGATURAN AKUN & AKSES PENGGUNA (USER ROLE ASSIGNMENT) */}
      {/* ============================================================== */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Action Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Daftar Akun Pengguna & Penugasan Role (User Role Assignment)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola hak akses masuk, ubah peran otorisasi karyawan, reset kata sandi, dan suspensi akses akun secara cepat.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSyncFromEmployees}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Sinkronisasi akun dari database master karyawan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sinkron Karyawan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Akun Baru</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Total Akun Terdaftar</span>
                <span className="text-lg font-bold text-slate-900">{userAccounts.length} Pengguna</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 block text-[11px]">Akun Aktif</span>
                <span className="text-lg font-bold text-emerald-800">
                  {userAccounts.filter((u) => u.status === 'active').length} Akun
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-rose-700 block text-[11px]">Akses Dicabut / Suspended</span>
                <span className="text-lg font-bold text-rose-800">
                  {userAccounts.filter((u) => u.status === 'suspended').length} Akun
                </span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-purple-700 block text-[11px]">Super Admin & Otoritas</span>
                <span className="text-lg font-bold text-purple-800">
                  {userAccounts.filter((u) => u.role.includes('Super Admin')).length} Root
                </span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-center gap-3 pt-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, NIK, email, atau departemen..."
                  value={searchAccountQuery}
                  onChange={(e) => setSearchAccountQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                >
                  <option value="ALL">Semua Peran (Role)</option>
                  {AVAILABLE_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="suspended">Ditangguhkan</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Accounts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Nama & Karyawan</th>
                    <th className="py-3 px-3">NIK</th>
                    <th className="py-3 px-3">Email Pengguna</th>
                    <th className="py-3 px-3">Role yang Aktif</th>
                    <th className="py-3 px-3 hidden md:table-cell">Departemen</th>
                    <th className="py-3 px-3 text-center">Status Akun</th>
                    <th className="py-3 px-4 text-right">Tombol Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Tidak ada akun pengguna yang sesuai dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((account) => {
                      const badge = ROLE_BADGE_MAP[account.role] || {
                        bg: 'bg-indigo-100',
                        text: 'text-indigo-800',
                        border: 'border-indigo-200',
                      };
                      const isSuperAdmin = account.role === 'Super Admin';

                      return (
                        <tr
                          key={account.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            account.status === 'suspended' ? 'bg-rose-50/20 opacity-75' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={account.avatarUrl}
                                alt={account.name}
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-slate-900 leading-tight">
                                  {account.name}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Login: {account.lastLogin || 'Belum ada'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            {account.nik}
                          </td>

                          <td className="py-3 px-3 text-slate-700">
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>{account.email}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {account.role}
                            </span>
                          </td>

                          <td className="py-3 px-3 hidden md:table-cell text-slate-600 font-medium">
                            {account.department}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                account.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  account.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {account.status === 'active' ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. Tombol Ubah Role */}
                              <button
                                type="button"
                                onClick={() => handleOpenAssignRoleModal(account)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                title="Ubah atau tetapkan peran baru"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Ubah Role</span>
                              </button>

                              {/* 2. Tombol Reset Password */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetPasswordModal(account)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                title="Reset Kata Sandi"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* 3. Tombol Cabut Akses / Aktifkan */}
                              {!isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAccountStatus(account)}
                                  className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                                    account.status === 'active'
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                  }`}
                                  title={
                                    account.status === 'active'
                                      ? 'Cabut Akses Pengguna'
                                      : 'Aktifkan Kembali Akses'
                                  }
                                >
                                  {account.status === 'active' ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: KONFIGURASI UMUM SISTEM & PAYROLL                       */}
      {/* ============================================================== */}
      {activeSubTab === 'general_payroll' && (
        <form onSubmit={handleSaveGeneralSettings} className="space-y-6 animate-fade-in">
          {/* Section 1: Siklus Cut-Off Payroll & Pembayaran */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Siklus Cut-Off & Tanggal Pembayaran Payroll (Payday)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tentukan tanggal penutupan rekapitulasi presensi, cuti, lembur, dan tanggal transfer slip gaji.
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                Periode: {formData.currentPayrollPeriod}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Periode Aktif Penggajian</label>
                <input
                  type="text"
                  value={formData.currentPayrollPeriod}
                  onChange={(e) =>
                    setFormData({ ...formData, currentPayrollPeriod: e.target.value })
                  }
                  placeholder="e.g. Oktober 2026"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tanggal Mulai Cut-Off Presensi</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.cutOffStartDay}
                  onChange={(e) =>
                    setFormData({ ...formData, cutOffStartDay: Number(e.target.value) })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: Tanggal 26</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tanggal Selesai Cut-Off Presensi</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.cutOffEndDay}
                  onChange={(e) =>
                    setFormData({ ...formData, cutOffEndDay: Number(e.target.value) })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: Tanggal 25</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-emerald-800">
                  Tanggal Pencairan Gaji (Payday)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.payrollDisbursementDay}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payrollDisbursementDay: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 bg-emerald-50/60 border border-emerald-300 rounded-xl font-extrabold text-emerald-800 focus:border-emerald-500"
                />
                <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                  Default: Tanggal 28 setiap bulan
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Plafon Maksimum Kasbon & Pinjaman */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Pengaturan Plafon Maksimum Kasbon Karyawan (Cash Advance Policy)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Batasan maksimum total pinjaman tunai darurat yang dapat diajukan karyawan dihitung dari persentase Gaji Pokok.
                  </p>
                </div>
              </div>

              <span className="text-xs font-extrabold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                Plafon Aktif: {formData.maxCashAdvancePercentage}% Gaji Pokok
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs items-center">
              <div className="space-y-3">
                <label className="block text-slate-700 font-bold">
                  Persentase Plafon Maksimum Kasbon (%):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={formData.maxCashAdvancePercentage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxCashAdvancePercentage: Number(e.target.value),
                      })
                    }
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 font-mono font-extrabold text-base text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 min-w-[70px] justify-center">
                    <span>{formData.maxCashAdvancePercentage}</span>
                    <span>%</span>
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>10% (Ketat)</span>
                  <span>50% (Standar Disarankan)</span>
                  <span>100% (Fleksibel)</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-amber-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-xs text-amber-900">
                  <Percent className="w-4 h-4 text-amber-600" />
                  <span>Simulasi Perhitungan Plafon Nyata:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Jika karyawan memiliki Gaji Pokok sebesar <strong>Rp 10.000.000</strong>, maka nominal kasbon maksimal yang diizinkan oleh sistem adalah:{' '}
                  <strong className="text-emerald-800">
                    Rp {((10000000 * (formData.maxCashAdvancePercentage || 50)) / 100).toLocaleString('id-ID')}
                  </strong>
                  . Pengajuan melebihi angka ini akan ditolak secara otomatis oleh form Portal Karyawan.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Standar Jam Kerja & Tarif Lembur Default */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Standar Jam Kerja & Tarif Lembur Default (Overtime Rates)
                </h3>
                <p className="text-xs text-slate-500">
                  Parameter kalkulasi jam kerja harian dan formula kompensasi lembur otomatis di slip gaji.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Jam Kerja Harian Standar</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={4}
                    max={12}
                    value={formData.standardWorkHoursPerDay}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        standardWorkHoursPerDay: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  />
                  <span className="text-slate-500 font-semibold shrink-0">Jam/Hari</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Hari Kerja per Minggu</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={4}
                    max={6}
                    value={formData.standardWorkDaysPerWeek}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        standardWorkDaysPerWeek: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  />
                  <span className="text-slate-500 font-semibold shrink-0">Hari/Minggu</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Pengali Lembur (Multiplier)</label>
                <input
                  type="number"
                  step={0.1}
                  min={1.0}
                  max={3.0}
                  value={formData.defaultOvertimeMultiplier}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultOvertimeMultiplier: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Regulasi Depnaker: 1.5x jam ke-1</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tarif Lembur Dasar (IDR / Jam)</label>
                <input
                  type="number"
                  step={5000}
                  min={20000}
                  value={formData.defaultOvertimeRatePerHour}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultOvertimeRatePerHour: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: Rp 55.000 / jam</span>
              </div>
            </div>
          </div>

          {/* Section 4: Legalitas Perusahaan & Rekening Disbursement */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Profil Legal Perusahaan & Rekening Sumber Payroll
                </h3>
                <p className="text-xs text-slate-500">
                  Informasi resmi yang tertera di header slip gaji dan konfigurasi file transfer bank.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Legal Badan Usaha</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Brand / Platform</label>
                <input
                  type="text"
                  required
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">NPWP Badan Perusahaan</label>
                <input
                  type="text"
                  value={formData.npwpCompany}
                  onChange={(e) => setFormData({ ...formData, npwpCompany: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Alamat Kantor Sentral</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Telepon Kantor</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Bank Operasional Payroll</label>
                <select
                  value={formData.disbursementBank}
                  onChange={(e) =>
                    setFormData({ ...formData, disbursementBank: e.target.value as any })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                >
                  <option value="BCA Bisnis">BCA Bisnis (KlikBCA)</option>
                  <option value="Mandiri Cash Management">Mandiri Cash Management (MCM)</option>
                  <option value="BNI Direct">BNI Direct</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nomor Rekening Sumber</label>
                <input
                  type="text"
                  value={formData.disbursementAccount}
                  onChange={(e) =>
                    setFormData({ ...formData, disbursementAccount: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Plafon Maksimal BPJS Kesehatan</label>
                <input
                  type="number"
                  step={500000}
                  value={formData.bpjsKesehatanMaxCap}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bpjsKesehatanMaxCap: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Regulasi Max: Rp 12.000.000</span>
              </div>
            </div>
          </div>

          {/* Section 5: Google Identity & Domain Whitelist */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Google Workspace & Pembatasan Domain Login
                </h3>
                <p className="text-xs text-slate-500">
                  Konfigurasi autentikasi Google Sign-In terverifikasi dan pembatasan domain perusahaan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Google OAuth Client ID</label>
                <input
                  type="text"
                  placeholder="e.g. 571301356157-xxxxx.apps.googleusercontent.com"
                  value={formData.googleAuthSettings?.googleClientId || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      googleAuthSettings: {
                        ...(formData.googleAuthSettings || initialGoogleAuthSettings),
                        googleClientId: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Super Admin Google</label>
                <input
                  type="email"
                  value={formData.adminGoogleEmail || 'jpexakun7@gmail.com'}
                  onChange={(e) => setFormData({ ...formData, adminGoogleEmail: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs"
                />
              </div>
            </div>
          {/* Section 6: PIN Keamanan & Kunci Panel HR/Payroll Admin */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  PIN Keamanan & Kunci Panel HR/Payroll Admin
                </h3>
                <p className="text-xs text-slate-500">
                  Mencegah karyawan umum membuka panel admin, mengintip besaran gaji rekan kerja, atau mengubah data payroll.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  PIN Keamanan Admin (4 - 8 Karakter)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={8}
                    required
                    value={formData.securitySettings?.adminPin || '2026'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        securitySettings: {
                          ...formData.securitySettings,
                          adminPin: e.target.value.trim(),
                        },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 tracking-wider"
                    placeholder="2026"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  PIN bawaan standar: <code className="font-mono text-purple-700">2026</code>. Ubah sesuai kebutuhan privasi HR.
                </span>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={formData.securitySettings?.requirePinForAdminMode ?? true}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        securitySettings: {
                          ...formData.securitySettings,
                          requirePinForAdminMode: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Wajibkan verifikasi PIN saat beralih ke Mode Admin
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 pl-6">
                  Jika aktif, siapapun yang membuka tautan aplikasi akan berada di Portal Karyawan mandiri dan hanya dapat melihat slip gajinya sendiri.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Seluruh perubahan konfigurasi otomatis tercatat ke Log Audit Trail sistem.</span>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Konfigurasi Sistem & Payroll</span>
            </button>
         </div>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: PENUGASAN ROLE KEPADA AKUN TERTENTU (ASSIGN ROLE)      */}
      {/* ============================================================== */}
      {isAssignRoleModalOpen && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Ubah Role Pengguna</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <img
                  src={selectedUserForAction.avatarUrl}
                  alt={selectedUserForAction.name}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-300"
                />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight">
                    {selectedUserForAction.name}
                  </h4>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {selectedUserForAction.nik} • {selectedUserForAction.email}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Departemen: {selectedUserForAction.department}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-2">
                  Pilih Role Utama yang Ditetapkan:
                </label>
                <div className="space-y-2">
                  {AVAILABLE_ROLE_OPTIONS.map((roleOpt) => {
                    const isChecked = selectedRolesForUser.includes(roleOpt);
                    const badge = ROLE_BADGE_MAP[roleOpt] || {
                      bg: 'bg-indigo-50',
                      text: 'text-indigo-800',
                      border: 'border-indigo-200',
                    };

                    return (
                      <label
                        key={roleOpt}
                        onClick={() => setSelectedRolesForUser([roleOpt])}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="assignedRoleRadio"
                            checked={isChecked}
                            onChange={() => setSelectedRolesForUser([roleOpt])}
                            className="w-4 h-4 text-indigo-600"
                          />
                          <span className="font-bold text-slate-800">{roleOpt}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          Tingkatan Izin
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignedRoles}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Terapkan Perubahan Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: RESET PASSWORD PENGGUNA                                */}
      {/* ============================================================== */}
      {isResetPasswordModalOpen && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Reset Kata Sandi Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Anda akan mereset kata sandi login untuk pengguna{' '}
                <strong className="text-slate-900">{selectedUserForAction.name}</strong> (
                {selectedUserForAction.email}).
              </p>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Kata Sandi Sementara Baru:
                </span>
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-300 font-mono font-extrabold text-sm text-slate-900">
                  <span>{tempPassword}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      setCopiedPassword(true);
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                    title="Salin password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copiedPassword && (
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    ✓ Kata sandi berhasil disalin ke papan klip!
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                Pengguna akan diminta mengganti kata sandi ini saat pertama kali login kembali ke portal karyawan. Tindakan ini akan dicatat ke Log Audit Trail sistem.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetPassword}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Konfirmasi & Terapkan Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: TAMBAH AKUN PENGGUNA BARU                              */}
      {/* ============================================================== */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Tambah Akun Pengguna Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserAccount} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hendra Gunawan"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nomor Induk Karyawan (NIK)</label>
                  <input
                    type="text"
                    placeholder="e.g. TGI-2026-099"
                    value={newUserForm.nik}
                    onChange={(e) => setNewUserForm({ ...newUserForm, nik: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nomor Telepon</label>
                  <input
                    type="text"
                    placeholder="e.g. 0812-3456-7890"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Alamat Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. hendra.gunawan@tasgrosirimport.co.id"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Departemen</label>
                  <select
                    value={newUserForm.department}
                    onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                  >
                    <option value="Human Resources & GA">Human Resources & GA</option>
                    <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
                    <option value="Operasional & Gudang">Operasional & Gudang</option>
                    <option value="Teknologi & IT">Teknologi & IT</option>
                    <option value="Pemasaran & Penjualan">Pemasaran & Penjualan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Role / Peran Utama</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                  >
                    {AVAILABLE_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Buat Akun Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Status Akun (Cabut / Aktifkan) */}
      {accountConfirmDialog && accountConfirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  accountConfirmDialog.newStatus === 'suspended'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {accountConfirmDialog.actionLabel}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Konfirmasi Akses Pengguna</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin melakukan tindakan{' '}
              <strong>"{accountConfirmDialog.actionLabel}"</strong> untuk pengguna{' '}
              <strong>{accountConfirmDialog.user.name}</strong> ({accountConfirmDialog.user.email})?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAccountConfirmDialog(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmToggleAccountStatus}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                  accountConfirmDialog.newStatus === 'suspended'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
