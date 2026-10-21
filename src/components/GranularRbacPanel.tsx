import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  Lock,
  CheckCircle2,
  Save,
  AlertCircle,
  Users,
  Key,
  Sliders,
  RotateCcw,
  Check,
  X,
  Copy,
  Table,
  SlidersHorizontal,
  Plus,
  Edit2,
  Trash2,
  Download,
  Info,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  ActivityActionType,
  ActivityCategory,
  GoogleAdminUser,
  GranularRolePermission,
  ModulePermission,
  PermissionAction,
  SystemModuleKey,
} from '../types';

export const SYSTEM_MODULES: {
  key: SystemModuleKey;
  label: string;
  desc: string;
  category: string;
  iconName: string;
}[] = [
  {
    key: 'employees',
    label: 'Modul Karyawan & Kontrak',
    desc: 'Pengelolaan data personal karyawan, NIK, berkas kontrak kerja PKWT/PKWTT, dan status kepegawaian',
    category: 'Manajemen Personalia',
    iconName: 'Users',
  },
  {
    key: 'payroll',
    label: 'Modul Penggajian & Slip Gaji (Payroll)',
    desc: 'Kalkulasi gaji bulanan, integrasi PPh 21 TER, BPJS Kesehatan & Ketenagakerjaan, dan pencairan slip gaji',
    category: 'Keuangan & Kompensasi',
    iconName: 'Wallet',
  },
  {
    key: 'leave_overtime',
    label: 'Modul Cuti & Lembur',
    desc: 'Pengajuan & persetujuan izin cuti tahunan, rekapitulasi presensi, dan surat perintah lembur (SPL)',
    category: 'Operasional & Kehadiran',
    iconName: 'Clock',
  },
  {
    key: 'cash_advance',
    label: 'Modul Kasbon & Pinjaman (Cash Advance)',
    desc: 'Pengajuan kasbon darurat, validasi plafon gaji pokok, persetujuan finance, pencairan dana, dan angsuran payroll',
    category: 'Keuangan & Fasilitas',
    iconName: 'HandCoins',
  },
  {
    key: 'kpi_performance',
    label: 'Modul Rapor KPI & Evaluasi Kinerja',
    desc: 'Pengelolaan periode review kinerja, penilaian evaluasi KPI bawahan, penentuan grade, dan insentif bonus',
    category: 'Manajemen Kinerja',
    iconName: 'Award',
  },
  {
    key: 'audit_trail',
    label: 'Modul Audit Trail & Log Aktivitas',
    desc: 'Pemantauan rekam jejak aktivitas sensitif, perubahan gaji, mutasi hak akses, dan kepatuhan sistem',
    category: 'Keamanan & Kepatuhan',
    iconName: 'History',
  },
  {
    key: 'system_settings',
    label: 'Modul Pengaturan Sistem',
    desc: 'Konfigurasi parameter global, siklus cut-off payroll, integrasi Google Workspace, dan matriks hak akses',
    category: 'Sistem Global',
    iconName: 'Settings',
  },
];

export const PERMISSION_ACTIONS: {
  key: PermissionAction;
  label: string;
  desc: string;
  color: string;
}[] = [
  { key: 'view', label: 'View (Lihat)', desc: 'Melihat & membaca data dalam modul', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'create', label: 'Create (Tambah)', desc: 'Membuat atau mengajukan data baru', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'edit', label: 'Edit (Ubah)', desc: 'Mengubah atau memperbarui data yang ada', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'delete', label: 'Delete (Hapus)', desc: 'Menghapus atau membatalkan rekaman data', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'approve', label: 'Approve (Setujui)', desc: 'Menyetujui atau menolak permohonan staf', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'export', label: 'Export (Unduh)', desc: 'Mengekspor laporan ke format Excel/PDF', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
];

const FULL_PERMISSIONS: ModulePermission = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
  export: true,
};

const NO_PERMISSIONS: ModulePermission = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

export const DEFAULT_GRANULAR_ROLES: GranularRolePermission[] = [
  {
    roleId: 'super_admin',
    roleName: 'Super Admin',
    description: 'Akses penuh tanpa batas ke seluruh modul sistem, pengaturan global, dan tata kelola otorisasi root.',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    userCount: 2,
    modulePermissions: {
      employees: { ...FULL_PERMISSIONS },
      payroll: { ...FULL_PERMISSIONS },
      leave_overtime: { ...FULL_PERMISSIONS },
      cash_advance: { ...FULL_PERMISSIONS },
      kpi_performance: { ...FULL_PERMISSIONS },
      audit_trail: { ...FULL_PERMISSIONS },
      system_settings: { ...FULL_PERMISSIONS },
    },
  },
  {
    roleId: 'hr_manager',
    roleName: 'HR Manager',
    description: 'Mengelola database kepegawaian, verifikasi presensi/cuti/lembur, penilaian KPI tim, dan pengajuan fasilitas kasbon.',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    userCount: 4,
    modulePermissions: {
      employees: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      payroll: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      leave_overtime: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      cash_advance: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      kpi_performance: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      audit_trail: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      system_settings: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    },
  },
  {
    roleId: 'finance_admin',
    roleName: 'Finance / Payroll Admin',
    description: 'Menangani kalkulasi gaji karyawan, PPh 21 TER, BPJS, klaim reimbursement, pencairan kasbon darurat, dan ekspor laporan.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    userCount: 3,
    modulePermissions: {
      employees: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      payroll: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      leave_overtime: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      cash_advance: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      kpi_performance: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      audit_trail: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      system_settings: { view: true, create: false, edit: true, delete: false, approve: false, export: false },
    },
  },
  {
    roleId: 'division_lead',
    roleName: 'Division Lead / Supervisor',
    description: 'Atasan langsung departemen yang berwenang mengevaluasi KPI staf dan menyetujui jadwal cuti/lembur anggota divisi.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    userCount: 6,
    modulePermissions: {
      employees: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
      payroll: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      leave_overtime: { view: true, create: true, edit: false, delete: false, approve: true, export: true },
      cash_advance: { view: true, create: true, edit: false, delete: false, approve: false, export: false },
      kpi_performance: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
      audit_trail: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      system_settings: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
    },
  },
  {
    roleId: 'auditor',
    roleName: 'Viewer / Auditor',
    description: 'Akses audit read-only dan ekspor kepatuhan untuk memantau integritas payroll, laporan keuangan, log audit, dan KPI tanpa izin modifikasi.',
    badgeColor: 'bg-slate-200 text-slate-800 border-slate-300',
    userCount: 1,
    modulePermissions: {
      employees: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      payroll: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      leave_overtime: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      cash_advance: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      kpi_performance: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      audit_trail: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      system_settings: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
    },
  },
  {
    roleId: 'employee',
    roleName: 'Employee (Staf Biasa)',
    description: 'Akses portal mandiri karyawan untuk melihat slip gaji, mengajukan kasbon/cuti/lembur, dan melihat capaian rapor KPI.',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    userCount: 28,
    modulePermissions: {
      employees: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
      payroll: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
      leave_overtime: { view: true, create: true, edit: false, delete: false, approve: false, export: false },
      cash_advance: { view: true, create: true, edit: false, delete: false, approve: false, export: false },
      kpi_performance: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
      audit_trail: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
      system_settings: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
    },
  },
];

interface GranularRbacPanelProps {
  onLogAudit?: (
    actionType: ActivityActionType,
    category: ActivityCategory,
    description: string,
    meta?: any
  ) => void;
  onSendNotification?: (notif: any) => void;
  adminUser?: GoogleAdminUser | null;
}

export function GranularRbacPanel({
  onLogAudit,
  onSendNotification,
  adminUser,
}: GranularRbacPanelProps) {
  const [roles, setRoles] = useState<GranularRolePermission[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_granular_rbac_roles_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse granular RBAC roles', e);
    }
    return DEFAULT_GRANULAR_ROLES;
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string>('hr_manager');
  const [viewMode, setViewMode] = useState<'editor' | 'matrix'>('editor');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState<boolean>(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);

  // New role form state
  const [newRoleForm, setNewRoleForm] = useState<{
    roleName: string;
    description: string;
    badgeColor: string;
    cloneFromRoleId: string;
  }>({
    roleName: '',
    description: '',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    cloneFromRoleId: 'division_lead',
  });

  // Edit role form state
  const [editRoleForm, setEditRoleForm] = useState<{
    roleName: string;
    description: string;
    badgeColor: string;
  }>({
    roleName: '',
    description: '',
    badgeColor: '',
  });

  const activeRole = roles.find((r) => r.roleId === selectedRoleId) || roles[0];

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle single action permission
  const handleTogglePermission = (
    roleId: string,
    moduleKey: SystemModuleKey,
    action: PermissionAction
  ) => {
    if (roleId === 'super_admin') {
      triggerToast('Izin Super Admin terkunci untuk menjamin integritas kendali sistem.');
      return;
    }

    setRoles((prev) =>
      prev.map((role) => {
        if (role.roleId === roleId) {
          const currentModule = role.modulePermissions[moduleKey] || { ...NO_PERMISSIONS };
          return {
            ...role,
            modulePermissions: {
              ...role.modulePermissions,
              [moduleKey]: {
                ...currentModule,
                [action]: !currentModule[action],
              },
            },
          };
        }
        return role;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Module quick preset actions
  const handleSetModulePreset = (
    moduleKey: SystemModuleKey,
    preset: 'all' | 'readonly' | 'none'
  ) => {
    if (selectedRoleId === 'super_admin') return;

    let targetPerms: ModulePermission;
    if (preset === 'all') {
      targetPerms = { ...FULL_PERMISSIONS };
    } else if (preset === 'readonly') {
      targetPerms = { view: true, create: false, edit: false, delete: false, approve: false, export: true };
    } else {
      targetPerms = { ...NO_PERMISSIONS };
    }

    setRoles((prev) =>
      prev.map((role) => {
        if (role.roleId === selectedRoleId) {
          return {
            ...role,
            modulePermissions: {
              ...role.modulePermissions,
              [moduleKey]: targetPerms,
            },
          };
        }
        return role;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Save changes to storage & trigger audit trail
  const handleSaveConfiguration = () => {
    try {
      localStorage.setItem('tgi_granular_rbac_roles_v1', JSON.stringify(roles));
    } catch (e) {
      console.error('Failed to save granular RBAC', e);
    }

    setHasUnsavedChanges(false);
    triggerToast('Konfigurasi Matriks RBAC berhasil disimpan & disinkronkan ke seluruh sistem!');

    if (onLogAudit) {
      onLogAudit(
        'ROLE_UPDATED',
        'Hak Akses & Admin',
        `Memperbarui matriks granular hak akses RBAC (View, Create, Edit, Delete, Approve, Export) untuk ${roles.length} role pengguna.`,
        {
          targetId: selectedRoleId,
          targetName: activeRole.roleName,
          severity: 'warning',
          notes: `Diperbarui oleh ${adminUser?.name || 'Administrator'} (${adminUser?.email || 'admin@tgi.co.id'}).`,
        }
      );
    }

    if (onSendNotification) {
      onSendNotification({
        recipientType: 'admin',
        title: 'Matriks Granular RBAC Telah Diperbarui',
        message: `Pembaruan izin operasi (View, Create, Edit, Delete, Approve, Export) untuk role ${activeRole.roleName} berhasil diterapkan.`,
        category: 'SYSTEM_SECURITY',
        priority: 'normal',
      });
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Kembalikan Matriks RBAC Standar',
      message: 'Apakah Anda yakin ingin mengembalikan seluruh matriks hak akses ke setelan bawaan standar (Super Admin, HR Manager, Finance, Division Lead, Employee)?',
      isDanger: false,
      onConfirm: () => {
        setRoles(DEFAULT_GRANULAR_ROLES);
        setHasUnsavedChanges(true);
        triggerToast('Matriks telah dikembalikan ke pengaturan standar. Klik Simpan untuk menerapkan.');
        setConfirmDialog(null);
      },
    });
  };

  // Create new dynamic role
  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleForm.roleName.trim()) return;

    const newId = `role_${newRoleForm.roleName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;

    const templateRole =
      roles.find((r) => r.roleId === newRoleForm.cloneFromRoleId) || roles[3];

    const newRole: GranularRolePermission = {
      roleId: newId,
      roleName: newRoleForm.roleName.trim(),
      description: newRoleForm.description.trim() || 'Peran khusus tambahan sistem TGI.',
      badgeColor: newRoleForm.badgeColor,
      userCount: 0,
      isCustom: true,
      modulePermissions: JSON.parse(JSON.stringify(templateRole.modulePermissions)),
    };

    const updated = [...roles, newRole];
    setRoles(updated);
    setSelectedRoleId(newId);
    setIsAddRoleModalOpen(false);
    setHasUnsavedChanges(true);
    setNewRoleForm({
      roleName: '',
      description: '',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      cloneFromRoleId: 'division_lead',
    });

    triggerToast(`Role baru "${newRole.roleName}" berhasil ditambahkan.`);

    if (onLogAudit) {
      onLogAudit(
        'ROLE_UPDATED',
        'Hak Akses & Admin',
        `Menambahkan role kustom baru: "${newRole.roleName}" (ID: ${newRole.roleId}).`,
        {
          targetId: newRole.roleId,
          targetName: newRole.roleName,
          severity: 'info',
        }
      );
    }
  };

  // Open edit modal
  const handleOpenEditModal = () => {
    setEditRoleForm({
      roleName: activeRole.roleName,
      description: activeRole.description,
      badgeColor: activeRole.badgeColor,
    });
    setIsEditRoleModalOpen(true);
  };

  // Save edit role metadata
  const handleSaveEditRole = (e: React.FormEvent) => {
    e.preventDefault();
    setRoles((prev) =>
      prev.map((r) =>
        r.roleId === selectedRoleId
          ? {
              ...r,
              roleName: editRoleForm.roleName.trim(),
              description: editRoleForm.description.trim(),
              badgeColor: editRoleForm.badgeColor,
            }
          : r
      )
    );
    setIsEditRoleModalOpen(false);
    setHasUnsavedChanges(true);
    triggerToast(`Informasi role "${editRoleForm.roleName}" berhasil diperbarui.`);
  };

  // Delete custom role
  const handleDeleteRole = (roleId: string) => {
    const target = roles.find((r) => r.roleId === roleId);
    if (!target) return;
    if (['super_admin', 'hr_manager', 'finance_admin', 'division_lead', 'employee'].includes(roleId)) {
      triggerToast('Role bawaan sistem tidak dapat dihapus demi kestabilan aplikasi.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Role Kustom',
      message: `Hapus role "${target.roleName}" secara permanen?`,
      isDanger: true,
      onConfirm: () => {
        setRoles((prev) => prev.filter((r) => r.roleId !== roleId));
        setSelectedRoleId('hr_manager');
        setHasUnsavedChanges(true);
        triggerToast(`Role "${target.roleName}" telah dihapus.`);
        setConfirmDialog(null);

        if (onLogAudit) {
          onLogAudit(
            'ROLE_UPDATED',
            'Hak Akses & Admin',
            `Menghapus role kustom: "${target.roleName}" (ID: ${target.roleId}).`,
            {
              targetId: target.roleId,
              targetName: target.roleName,
              severity: 'danger',
            }
          );
        }
      },
    });
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(roles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tgi_rbac_matrix_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('JSON konfigurasi RBAC berhasil diunduh.');
  };

  // Count active permissions for a role
  const countRoleActions = (perms: Record<SystemModuleKey, ModulePermission>) => {
    let granted = 0;
    const total = SYSTEM_MODULES.length * PERMISSION_ACTIONS.length;
    SYSTEM_MODULES.forEach((mod) => {
      const p = perms[mod.key];
      if (p) {
        PERMISSION_ACTIONS.forEach((act) => {
          if (p[act.key]) granted++;
        });
      }
    });
    return { granted, total };
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Manajemen Role & Matriks Hak Akses Granular (RBAC)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi izin 6 level operasi (View, Create, Edit, Delete, Approve, Export) untuk 7 modul utama TGI Dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'editor'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Editor Per Peran</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Matriks Tabel Lengkap</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddRoleModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Role</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Ekspor Skema JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="p-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset ke Default Bawaan"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSaveConfiguration}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse ring-2 ring-indigo-400'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Simpan Matriks RBAC</span>
          </button>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">
              Perubahan matriks hak akses belum disimpan permanen. Jangan lupa klik tombol "Simpan Matriks RBAC".
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveConfiguration}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition-all cursor-pointer shrink-0"
          >
            Simpan Sekarang
          </button>
        </div>
      )}

      {/* VIEW MODE 1: Role by Role Granular Editor */}
      {viewMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Role Selector Tabs */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Daftar Peran ({roles.length})
              </span>
              <span className="text-[11px] text-slate-400">Pilih untuk mengedit</span>
            </div>

            <div className="space-y-2">
              {roles.map((role) => {
                const isSelected = role.roleId === selectedRoleId;
                const { granted, total } = countRoleActions(role.modulePermissions);
                const isSuperAdmin = role.roleId === 'super_admin';

                return (
                  <div
                    key={role.roleId}
                    onClick={() => setSelectedRoleId(role.roleId)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-600" />
                    )}

                    <div className="flex items-center justify-between mb-1.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{role.roleName}</span>
                        {isSuperAdmin && (
                          <span title="Hak Root Absolut (Terkunci)">
                            <Lock className="w-3.5 h-3.5 text-purple-600" />
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${role.badgeColor}`}>
                        {role.userCount} Pengguna
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                      {role.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-500">Izin Granular Aktif:</span>
                      <span
                        className={`font-semibold ${
                          granted === total
                            ? 'text-purple-700 font-bold'
                            : granted === 0
                            ? 'text-slate-400'
                            : 'text-indigo-600'
                        }`}
                      >
                        {granted} / {total} Hak Akses ({Math.round((granted / total) * 100)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Security Tip Card */}
            <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-purple-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Prinsip Least Privilege & RBAC Granular</span>
              </div>
              <p className="text-purple-800 text-[11px] leading-relaxed">
                Setiap modul kini memiliki 6 izin terpisah: <strong>View</strong> (lihat), <strong>Create</strong> (tambah), <strong>Edit</strong> (ubah), <strong>Delete</strong> (hapus), <strong>Approve</strong> (setujui), dan <strong>Export</strong> (unduh file). Batasi aksi Delete & Approve hanya untuk jabatan manajerial.
              </p>
            </div>
          </div>

          {/* Right Column: Detailed Granular Matrix for Selected Role */}
          <div className="lg:col-span-8 space-y-5">
            {/* Header of Active Role */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{activeRole.roleName}</h3>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${activeRole.badgeColor}`}>
                        {activeRole.roleId}
                      </span>
                      {activeRole.isCustom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                          Kustom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{activeRole.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Ubah nama / deskripsi role"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Info</span>
                  </button>

                  {activeRole.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(activeRole.roleId)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Hapus role kustom ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>

              {activeRole.roleId === 'super_admin' && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-100 rounded-xl text-purple-900 text-xs">
                  <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    Role <strong>Super Admin</strong> memiliki otoritas tertinggi dan semua izin (View, Create, Edit, Delete, Approve, Export) terkunci aktif untuk mencegah lockout sistem.
                  </span>
                </div>
              )}
            </div>

            {/* Modules List with Granular Action Checkboxes */}
            <div className="space-y-3.5">
              {SYSTEM_MODULES.map((mod) => {
                const perms = activeRole.modulePermissions[mod.key] || { ...NO_PERMISSIONS };
                const isSuperAdmin = activeRole.roleId === 'super_admin';

                return (
                  <div
                    key={mod.key}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{mod.label}</h4>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            {mod.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{mod.desc}</p>
                      </div>

                      {!isSuperAdmin && (
                        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSetModulePreset(mod.key, 'all')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors cursor-pointer"
                          >
                            Pilih Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetModulePreset(mod.key, 'readonly')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors cursor-pointer"
                          >
                            Hanya Baca
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetModulePreset(mod.key, 'none')}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md font-semibold transition-colors cursor-pointer"
                          >
                            Kosongkan
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 6 Actions Grid Checkboxes */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {PERMISSION_ACTIONS.map((act) => {
                        const isChecked = perms[act.key];

                        return (
                          <button
                            key={act.key}
                            type="button"
                            disabled={isSuperAdmin}
                            onClick={() => handleTogglePermission(activeRole.roleId, mod.key, act.key)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                              isSuperAdmin
                                ? 'bg-purple-50/60 border-purple-200 opacity-90 cursor-not-allowed'
                                : isChecked
                                ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs'
                                : 'bg-slate-50/60 border-slate-200 text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[11px] font-bold ${
                                  isChecked ? 'text-indigo-900' : 'text-slate-500'
                                }`}
                              >
                                {act.label.split(' ')[0]}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors ${
                                  isChecked
                                    ? isSuperAdmin
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-indigo-600 text-white'
                                    : 'border border-slate-300 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 leading-tight">
                              {act.label.includes('(') ? act.label.split('(')[1].replace(')', '') : act.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Comprehensive RBAC Matrix Table */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Matriks Perbandingan Izin Granular Seluruh Peran
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik checkbox di dalam tabel untuk mengaktifkan atau menonaktifkan wewenang secara instan.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-indigo-600 rounded-sm inline-block" /> Diizinkan
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-slate-200 rounded-sm inline-block" /> Dinonaktifkan
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="p-3 font-bold sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                    Modul Sistem & Otorisasi
                  </th>
                  {roles.map((r) => (
                    <th key={r.roleId} className="p-3 text-center min-w-[130px]">
                      <div className="font-bold text-slate-900">{r.roleName}</div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.2 rounded-full border mt-1 ${r.badgeColor}`}>
                        {r.roleId === 'super_admin' ? 'Root' : `${r.userCount} User`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SYSTEM_MODULES.map((mod) => (
                  <React.Fragment key={mod.key}>
                    {/* Header Row for Module */}
                    <tr className="bg-slate-100/60 font-bold text-slate-800 text-[11px]">
                      <td colSpan={roles.length + 1} className="py-2 px-3">
                        <span className="text-indigo-700 uppercase tracking-wider font-extrabold text-[10px] mr-2">
                          [MODUL]
                        </span>
                        {mod.label}
                      </td>
                    </tr>
                    {/* 6 Actions Sub-rows */}
                    {PERMISSION_ACTIONS.map((act) => (
                      <tr key={act.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 pl-6 font-medium text-slate-700 border-r border-slate-100 flex items-center justify-between">
                          <span>{act.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">.{act.key}</span>
                        </td>
                        {roles.map((role) => {
                          const isAllowed = role.modulePermissions[mod.key]?.[act.key] || false;
                          const isSuperAdmin = role.roleId === 'super_admin';

                          return (
                            <td key={role.roleId} className="py-2 px-3 text-center border-r border-slate-100 last:border-r-0">
                              <button
                                type="button"
                                disabled={isSuperAdmin}
                                onClick={() => handleTogglePermission(role.roleId, mod.key, act.key)}
                                className={`w-5 h-5 mx-auto rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                  isSuperAdmin
                                    ? 'bg-purple-600 text-white cursor-not-allowed opacity-90'
                                    : isAllowed
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                                    : 'border border-slate-300 bg-white hover:border-indigo-400'
                                }`}
                                title={`${role.roleName}: ${mod.label} - ${act.label}`}
                              >
                                {isAllowed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Tambah Role Baru */}
      {isAddRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Tambah Role Baru Dinamis</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Role / Jabatan *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Warehouse Supervisor, GA Officer, dll."
                  value={newRoleForm.roleName}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, roleName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Deskripsi Wewenang</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan ruang lingkup tugas dan tanggung jawab role ini..."
                  value={newRoleForm.description}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Salin Template Izin Awal Dari:</label>
                <select
                  value={newRoleForm.cloneFromRoleId}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, cloneFromRoleId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                >
                  {roles.map((r) => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.roleName} ({r.roleId})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Matriks granular izin akan disalin dari role ini dan bisa dikustomisasi setelahnya.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Warna Badge Tampilan</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Indigo', val: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                    { label: 'Emerald', val: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                    { label: 'Amber', val: 'bg-amber-100 text-amber-800 border-amber-200' },
                    { label: 'Rose', val: 'bg-rose-100 text-rose-800 border-rose-200' },
                    { label: 'Cyan', val: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
                    { label: 'Purple', val: 'bg-purple-100 text-purple-800 border-purple-200' },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setNewRoleForm({ ...newRoleForm, badgeColor: c.val })}
                      className={`p-2 rounded-xl text-center border font-bold text-[11px] cursor-pointer ${
                        newRoleForm.badgeColor === c.val ? 'ring-2 ring-indigo-500 ' + c.val : c.val
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Buat Role Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Metadata Role */}
      {isEditRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Edit Informasi Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRole} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Role / Jabatan *</label>
                <input
                  type="text"
                  required
                  value={editRoleForm.roleName}
                  onChange={(e) => setEditRoleForm({ ...editRoleForm, roleName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Deskripsi Wewenang</label>
                <textarea
                  rows={2}
                  value={editRoleForm.description}
                  onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                  confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
