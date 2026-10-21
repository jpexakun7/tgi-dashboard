import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Eye,
  EyeOff,
  Check,
  X,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Users,
  Wallet,
  Clock,
  Calendar,
  Receipt,
  Boxes,
  Percent,
  Award,
  Target,
  BarChart3,
  History,
  Lock,
  Search,
  ExternalLink,
  ChevronRight,
  Settings as SettingsIcon,
  HelpCircle,
  LayoutDashboard,
  CheckSquare,
  Square,
  ShieldCheck,
  Zap,
  Table,
  SlidersHorizontal,
  Layers,
  CheckCheck,
} from 'lucide-react';
import {
  CompanyConfig,
  DashboardModule,
  GoogleAdminRole,
  GoogleAdminUser,
  RolePermissionConfig,
  ActivityActionType,
  ActivityCategory,
} from '../types';
import { initialRolePermissions } from '../mockData';

export interface ModuleDefinition {
  id: DashboardModule;
  label: string;
  category: 'Ringkasan & Personalia' | 'Penggajian & Keuangan' | 'Operasional & Presensi' | 'Kinerja & Laporan' | 'Administrasi & Keamanan';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  sensitive?: boolean;
}

export const ALL_DASHBOARD_MODULES: ModuleDefinition[] = [
  {
    id: 'overview',
    label: 'Ringkasan Dashboard',
    category: 'Ringkasan & Personalia',
    icon: LayoutDashboard,
    description: 'Metrik utama perusahaan, pengingat persetujuan cuti/lembur, tren grafik biaya gaji Recharts 6 bulan.',
  },
  {
    id: 'employees',
    label: 'Data Karyawan & Kontrak',
    category: 'Ringkasan & Personalia',
    icon: Users,
    description: 'Master database seluruh karyawan, nomor NIK, berkas kontrak PKWT/PKWTT, dan status kepegawaian.',
    sensitive: true,
  },
  {
    id: 'attendance',
    label: 'Presensi & Face Recognition',
    category: 'Operasional & Presensi',
    icon: Clock,
    description: 'Catatan presensi harian datang/pulang, radius geolokasi GPS kantor, snapshot scan wajah, dan jam kerja.',
  },
  {
    id: 'leave',
    label: 'Pengajuan Cuti Karyawan',
    category: 'Operasional & Presensi',
    icon: Calendar,
    description: 'Formulir permohonan cuti tahunan, kuota sisa cuti, cuti sakit, dan persetujuan manajerial.',
  },
  {
    id: 'overtime',
    label: 'Lembur & SPL (Surat Perintah)',
    category: 'Operasional & Presensi',
    icon: Clock,
    description: 'Pengajuan jam lembur staf, rincian pekerjaan lembur, dan verifikasi persetujuan atasan.',
  },
  {
    id: 'payroll',
    label: 'Penggajian & Slip Gaji (Payroll)',
    category: 'Penggajian & Keuangan',
    icon: Wallet,
    description: 'Kalkulasi gaji bulanan, rincian potongan, PPh 21 TER, BPJS, cicilan kasbon, dan penerbitan slip gaji.',
    sensitive: true,
  },
  {
    id: 'tax_bpjs',
    label: 'Pajak PPh 21 & Iuran BPJS',
    category: 'Penggajian & Keuangan',
    icon: Percent,
    description: 'Perhitungan tarif TER 2026 PPh 21, plafon BPJS Kesehatan, dan BPJS Ketenagakerjaan perusahaan.',
    sensitive: true,
  },
  {
    id: 'reimbursement',
    label: 'Klaim Reimbursement & Biaya',
    category: 'Penggajian & Keuangan',
    icon: Receipt,
    description: 'Pengajuan klaim bon/nota bensin, transportasi, medis, konsumsi lembur, dan pencairan kasbon.',
  },
  {
    id: 'assets',
    label: 'Inventaris & Aset Kantor',
    category: 'Operasional & Presensi',
    icon: Boxes,
    description: 'Pendataan laptop, barcode scanner Zebra, kendaraan dinas, kondisi aset, dan riwayat peminjaman.',
  },
  {
    id: 'performance_review',
    label: 'Performance Review & Bonus',
    category: 'Kinerja & Laporan',
    icon: Award,
    description: 'Evaluasi berkala KPI bawahan, penilaian grade prestasi kerja, dan integrasi bonus ke payroll.',
  },
  {
    id: 'kpi_performance',
    label: 'Kinerja KPI Departemen',
    category: 'Kinerja & Laporan',
    icon: Target,
    description: 'Analisis grafik pencapaian target kinerja divisi (IT, Keuangan, Operasional, HR, Bisnis).',
  },
  {
    id: 'reports',
    label: 'Laporan & Rekapitulasi',
    category: 'Kinerja & Laporan',
    icon: BarChart3,
    description: 'Unduhan rekap payroll bulanan format bank BCA/Mandiri, rekap kehadiran, dan laporan operasional.',
  },
  {
    id: 'audit_logs',
    label: 'Log Aktivitas Sistem (Audit Trail)',
    category: 'Administrasi & Keamanan',
    icon: History,
    description: 'Pencatatan riwayat perubahan gaji, mutasi data personal, pemberian wewenang role, dan aktivitas sensitif.',
    sensitive: true,
  },
  {
    id: 'roles_management',
    label: 'Hak Akses & Role (RBAC)',
    category: 'Administrasi & Keamanan',
    icon: Shield,
    description: 'Matriks izin operasional granular (View, Create, Edit, Delete, Approve, Export) per modul.',
    sensitive: true,
  },
  {
    id: 'settings',
    label: 'Pengaturan (Settings & RBAC)',
    category: 'Administrasi & Keamanan',
    icon: SettingsIcon,
    description: 'Konfigurasi cut-off payroll, plafon kasbon, standar jam kerja, rekening disbursement bank, dan Google Admin.',
    sensitive: true,
  },
];

export interface RoleModuleVisibilityPanelProps {
  companyConfig: CompanyConfig;
  onUpdateConfig: (newConfig: CompanyConfig) => void;
  onLogAudit?: (
    actionType: ActivityActionType,
    category: ActivityCategory,
    description: string,
    meta?: any
  ) => void;
  adminUser?: GoogleAdminUser | null;
  onSwitchAdminUserRole?: (roleName: string) => void;
}

export const RoleModuleVisibilityPanel: React.FC<RoleModuleVisibilityPanelProps> = ({
  companyConfig,
  onUpdateConfig,
  onLogAudit,
  adminUser,
  onSwitchAdminUserRole,
}) => {
  // Available 5 Roles list (Super Admin, HR, Finance, Operations, Auditor)
  const standardRoles: {
    role: GoogleAdminRole;
    shortLabel: string;
    label: string;
    description: string;
    badgeColor: string;
    activeColor: string;
    isSuperAdmin?: boolean;
  }[] = [
    {
      role: 'Super Admin',
      shortLabel: 'Super Admin',
      label: 'Super Admin (Administrator Utama)',
      description: 'Otoritas tertinggi tanpa batasan: berhak melihat dan mengelola seluruh modul sistem.',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      activeColor: 'text-purple-700 bg-purple-50 border-purple-300',
      isSuperAdmin: true,
    },
    {
      role: 'HR & Payroll Admin',
      shortLabel: 'HR & Payroll',
      label: 'HR & Payroll Admin (HR Manager)',
      description: 'Pengelolaan data personil karyawan, absensi, cuti, lembur, aset kantor, dan penggajian bulanan.',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      activeColor: 'text-blue-700 bg-blue-50 border-blue-300',
    },
    {
      role: 'Finance & Reimbursement',
      shortLabel: 'Finance & Klaim',
      label: 'Finance & Reimbursement (Finance)',
      description: 'Fokus pada perhitungan gaji, pajak PPh 21 TER, BPJS, klaim reimbursement, dan pencairan kasbon.',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      activeColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      role: 'Operations Manager',
      shortLabel: 'Operations',
      label: 'Operations Manager (Operations)',
      description: 'Pengawasan presensi tim lapangan, pengesahan cuti/lembur divisi, inventaris gudang, dan KPI staf.',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      activeColor: 'text-amber-700 bg-amber-50 border-amber-300',
    },
    {
      role: 'Viewer / Auditor',
      shortLabel: 'Auditor',
      label: 'Viewer / Auditor (Auditor)',
      description: 'Akses audit baca-saja (read-only) untuk pemantauan kepatuhan laporan, KPI, dan log audit.',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      activeColor: 'text-slate-700 bg-slate-50 border-slate-300',
    },
  ];

  const [viewLayout, setViewLayout] = useState<'matrix' | 'cards'>('matrix');
  const [selectedRole, setSelectedRole] = useState<GoogleAdminRole>('HR & Payroll Admin');
  const [searchModuleQuery, setSearchModuleQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize rolePermissions state from companyConfig or fallback to initialRolePermissions
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermissionConfig>>(() => {
    return companyConfig.rolePermissions && Object.keys(companyConfig.rolePermissions).length > 0
      ? companyConfig.rolePermissions
      : initialRolePermissions;
  });

  // Sync state when companyConfig.rolePermissions changes
  useEffect(() => {
    if (companyConfig.rolePermissions && Object.keys(companyConfig.rolePermissions).length > 0) {
      setRolePermissions(companyConfig.rolePermissions);
    }
  }, [companyConfig.rolePermissions]);

  const activeRoleConfig = useMemo(() => {
    return (
      rolePermissions[selectedRole] || {
        role: selectedRole,
        isAllowedToLogin: true,
        allowedModules: ALL_DASHBOARD_MODULES.map((m) => m.id),
        canApproveLeave: false,
        canApproveOvertime: false,
        canApproveReimbursement: false,
        canEditEmployees: false,
        canRunPayroll: false,
        canEditCompanySettings: false,
        description: '',
      }
    );
  }, [rolePermissions, selectedRole]);

  const isCurrentSuperAdmin = selectedRole === 'Super Admin';

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to commit changes immediately to system state
  const commitPermissionsUpdate = (updated: Record<string, RolePermissionConfig>, message?: string) => {
    setRolePermissions(updated);
    setHasChanges(false);
    onUpdateConfig({
      ...companyConfig,
      rolePermissions: updated as any,
    });
    if (message) {
      triggerToast(message);
    }
  };

  // Toggle single module visibility for any role (used in Matrix and Cards view)
  const handleToggleModuleForRole = (role: GoogleAdminRole, moduleId: DashboardModule) => {
    if (role === 'Super Admin') {
      triggerToast('Peran Super Admin selalu memiliki akses ke seluruh modul untuk mencegah penguncian sistem.');
      return;
    }

    const currentConf = rolePermissions[role] || {
      role,
      isAllowedToLogin: true,
      allowedModules: initialRolePermissions[role]?.allowedModules || ['overview'],
      canApproveLeave: false,
      canApproveOvertime: false,
      canApproveReimbursement: false,
      canEditEmployees: false,
      canRunPayroll: false,
      canEditCompanySettings: false,
      description: '',
    };

    const currentModules = currentConf.allowedModules || [];
    const isCurrentlyAllowed = currentModules.includes(moduleId);

    let updatedModules: DashboardModule[];
    if (isCurrentlyAllowed) {
      if (currentModules.length === 1 && currentModules[0] === moduleId) {
        triggerToast(`Peran ${role} harus memiliki minimal 1 modul aktif.`);
        return;
      }
      updatedModules = currentModules.filter((id) => id !== moduleId);
    } else {
      updatedModules = [...currentModules, moduleId];
    }

    const updated = {
      ...rolePermissions,
      [role]: {
        ...currentConf,
        allowedModules: updatedModules,
      },
    };

    const moduleObj = ALL_DASHBOARD_MODULES.find((m) => m.id === moduleId);
    const actionLabel = isCurrentlyAllowed ? 'disembunyikan dari' : 'diaktifkan untuk';
    commitPermissionsUpdate(
      updated,
      `Modul "${moduleObj?.label || moduleId}" berhasil ${actionLabel} peran ${role}.`
    );
  };

  // Toggle single module visibility for currently selected role
  const handleToggleModule = (moduleId: DashboardModule) => {
    handleToggleModuleForRole(selectedRole, moduleId);
  };

  // Toggle all modules for a specific role (Column Action in Matrix)
  const handleToggleAllModulesForRole = (role: GoogleAdminRole, enableAll: boolean) => {
    if (role === 'Super Admin') return;

    const currentConf = rolePermissions[role] || {
      role,
      isAllowedToLogin: true,
      allowedModules: [],
      canApproveLeave: false,
      canApproveOvertime: false,
      canApproveReimbursement: false,
      canEditEmployees: false,
      canRunPayroll: false,
      canEditCompanySettings: false,
      description: '',
    };

    const newModules = enableAll
      ? ALL_DASHBOARD_MODULES.map((m) => m.id)
      : ['overview' as DashboardModule];

    const updated = {
      ...rolePermissions,
      [role]: {
        ...currentConf,
        allowedModules: newModules,
      },
    };

    commitPermissionsUpdate(
      updated,
      enableAll
        ? `Seluruh 15 modul diaktifkan untuk peran "${role}".`
        : `Hanya modul Ringkasan Dashboard yang diaktifkan untuk peran "${role}".`
    );
  };

  // Toggle module visibility across all 4 operational roles (Row Action in Matrix)
  const handleToggleModuleForAllRoles = (moduleId: DashboardModule) => {
    const operationalRoles: GoogleAdminRole[] = [
      'HR & Payroll Admin',
      'Finance & Reimbursement',
      'Operations Manager',
      'Viewer / Auditor',
    ];

    const allCurrentlyEnabled = operationalRoles.every((r) =>
      (rolePermissions[r]?.allowedModules || []).includes(moduleId)
    );

    setRolePermissions((prev) => {
      const updated = { ...prev };
      operationalRoles.forEach((r) => {
        const conf = updated[r] || {
          role: r,
          isAllowedToLogin: true,
          allowedModules: initialRolePermissions[r]?.allowedModules || ['overview'],
          canApproveLeave: false,
          canApproveOvertime: false,
          canApproveReimbursement: false,
          canEditEmployees: false,
          canRunPayroll: false,
          canEditCompanySettings: false,
          description: '',
        };
        const curMods = conf.allowedModules || [];
        if (allCurrentlyEnabled) {
          if (curMods.length > 1) {
            updated[r] = {
              ...conf,
              allowedModules: curMods.filter((id) => id !== moduleId),
            };
          }
        } else {
          if (!curMods.includes(moduleId)) {
            updated[r] = {
              ...conf,
              allowedModules: [...curMods, moduleId],
            };
          }
        }
      });
      commitPermissionsUpdate(
        updated,
        allCurrentlyEnabled
          ? `Modul "${moduleId}" dinonaktifkan untuk semua peran operasional.`
          : `Modul "${moduleId}" diaktifkan untuk semua peran operasional.`
      );
      return updated;
    });
  };

  // Quick preset: Select all modules for currently selected role
  const handleSelectAllModules = () => {
    handleToggleAllModulesForRole(selectedRole, true);
  };

  // Quick preset: Reset all 5 roles to standard default
  const handleResetAllRolesToStandard = () => {
    commitPermissionsUpdate(
      initialRolePermissions,
      'Seluruh matriks hak akses 5 peran telah dikembalikan ke standar awal sistem.'
    );
  };

  // Quick preset: Reset single role to standard default
  const handleResetToDefaultPreset = () => {
    if (isCurrentSuperAdmin) return;
    const initialPerm = initialRolePermissions[selectedRole as keyof typeof initialRolePermissions];
    if (initialPerm) {
      const updated = {
        ...rolePermissions,
        [selectedRole]: {
          ...initialPerm,
        },
      };
      commitPermissionsUpdate(
        updated,
        `Visibilitas role ${selectedRole} dikembalikan ke rekomendasi standar.`
      );
    }
  };

  // Quick preset: Hide sensitive modules for all non-superadmin roles
  const handleHideSensitiveModules = () => {
    const nonSensitive = ALL_DASHBOARD_MODULES.filter((m) => !m.sensitive).map((m) => m.id);
    const nonAdminRoles: GoogleAdminRole[] = [
      'HR & Payroll Admin',
      'Finance & Reimbursement',
      'Operations Manager',
      'Viewer / Auditor',
    ];

    const updated = { ...rolePermissions };
    nonAdminRoles.forEach((r) => {
      const conf = updated[r] || {
        role: r,
        isAllowedToLogin: true,
        allowedModules: [],
        canApproveLeave: false,
        canApproveOvertime: false,
        canApproveReimbursement: false,
        canEditEmployees: false,
        canRunPayroll: false,
        canEditCompanySettings: false,
        description: '',
      };
      updated[r] = {
        ...conf,
        allowedModules: nonSensitive.length > 0 ? nonSensitive : ['overview'],
      };
    });
    commitPermissionsUpdate(
      updated,
      'Modul sensitif (Gaji, Pajak, Audit, Settings) disembunyikan untuk seluruh peran non-SuperAdmin.'
    );
  };

  // Save changes to companyConfig & system
  const handleSaveConfiguration = () => {
    const updatedConfig: CompanyConfig = {
      ...companyConfig,
      rolePermissions: rolePermissions as any,
    };

    onUpdateConfig(updatedConfig);
    setHasChanges(false);
    triggerToast('Konfigurasi hak akses modul peran (RBAC) berhasil disimpan dan diterapkan secara real-time!');

    if (onLogAudit) {
      onLogAudit(
        'ROLE_PERMISSION_UPDATE',
        'Hak Akses & Admin',
        `Memperbarui matriks visibilitas modul peran RBAC untuk 5 peran (Super Admin, HR, Finance, Operations, Auditor).`,
        {
          targetId: 'rbac-matrix-update',
          targetName: 'Matriks RBAC 5 Peran',
          newValue: 'Konfigurasi hak akses modul telah disinkronkan',
          severity: 'warning',
          notes: `Diperbarui oleh ${adminUser?.name || 'Administrator Utama'} (${adminUser?.email || 'admin@tgi.co.id'}).`,
        }
      );
    }
  };

  // Filter modules based on search & category
  const filteredModules = useMemo(() => {
    return ALL_DASHBOARD_MODULES.filter((mod) => {
      const matchSearch =
        mod.label.toLowerCase().includes(searchModuleQuery.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchModuleQuery.toLowerCase()) ||
        mod.id.toLowerCase().includes(searchModuleQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || mod.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [searchModuleQuery, selectedCategory]);

  const categories = ['ALL', 'Ringkasan & Personalia', 'Penggajian & Keuangan', 'Operasional & Presensi', 'Kinerja & Laporan', 'Administrasi & Keamanan'];

  const allowedCount = isCurrentSuperAdmin
    ? ALL_DASHBOARD_MODULES.length
    : (activeRoleConfig.allowedModules || []).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Overview Banner & Layout Switcher */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-indigo-800/60 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Kontrol Akses Peran Fleksibel (RBAC)</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Pengaturan Hak Akses Modul untuk Berbagai Peran
            </h2>
            <p className="text-xs text-indigo-200/80 leading-relaxed">
              Atur hak akses 15 modul dashboard secara fleksibel untuk <strong>Super Admin</strong>, <strong>HR</strong>, <strong>Finance</strong>, <strong>Operations</strong>, dan <strong>Auditor</strong>.
              Menu yang dinonaktifkan akan disembunyikan sepenuhnya dari navigasi pengguna dengan peran tersebut.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* View Mode Layout Switcher */}
            <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewLayout('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayout === 'matrix'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilkan tabel matriks komparasi 5 peran sekaligus"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Matriks 5 Peran</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayout === 'cards'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilkan kartu modul per peran dengan simulasi sidebar"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Kartu Per Peran</span>
              </button>
            </div>

            {hasChanges && (
              <span className="text-xs font-bold text-amber-300 bg-amber-950/70 border border-amber-700/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Perubahan Belum Disimpan</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveConfiguration}
              disabled={!hasChanges}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                hasChanges
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-400/50'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Simpan Konfigurasi Matriks</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: MATRIKS KOMPARASI 5 PERAN SEKALIGUS (GRID VIEW) */}
      {viewLayout === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Matrix Top Filters and Presets Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari modul (contoh: Karyawan, Gaji, Presensi, Audit)..."
                  value={searchModuleQuery}
                  onChange={(e) => setSearchModuleQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'Semua Kategori' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Bulk Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleHideSensitiveModules}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title="Kunci modul Gaji, Pajak, dan Audit untuk semua peran non-SuperAdmin"
              >
                Kunci Modul Sensitif
              </button>
              <button
                type="button"
                onClick={handleResetAllRolesToStandard}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Kembalikan semua peran ke konfigurasi rekomendasi standar"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset ke Standar</span>
              </button>
            </div>
          </div>

          {/* Responsive Comparison Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase tracking-wider w-80">
                    Modul Dashboard ({filteredModules.length})
                  </th>
                  {standardRoles.map((r) => {
                    const activeCount = r.isSuperAdmin
                      ? ALL_DASHBOARD_MODULES.length
                      : (rolePermissions[r.role]?.allowedModules || []).length;
                    return (
                      <th
                        key={r.role}
                        className="py-3 px-3 font-semibold text-center border-l border-slate-800 min-w-[145px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${r.badgeColor}`}
                          >
                            {r.shortLabel}
                          </span>
                          <span className="text-[10px] text-slate-300 font-mono">
                            {activeCount}/{ALL_DASHBOARD_MODULES.length} Modul
                          </span>

                          {/* Quick Column Actions */}
                          {!r.isSuperAdmin ? (
                            <div className="flex items-center gap-1 pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleAllModulesForRole(r.role, true)}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 cursor-pointer"
                                title="Buka seluruh 15 modul untuk peran ini"
                              >
                                Buka Semua
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAllModulesForRole(r.role, false)}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 cursor-pointer"
                                title="Hanya aktifkan modul Ringkasan Dashboard"
                              >
                                Tutup
                              </button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-purple-300 font-bold pt-1">
                              Akses Root Penuh
                            </span>
                          )}

                          {/* Instant Simulation Button */}
                          {onSwitchAdminUserRole && (
                            <button
                              type="button"
                              onClick={() => {
                                onSwitchAdminUserRole(r.role);
                                triggerToast(`Simulasi peran aktif beralih ke: ${r.role}. Cek menu sidebar!`);
                              }}
                              className="mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white flex items-center gap-1 transition-colors cursor-pointer"
                              title="Uji coba langsung dashboard dengan peran ini"
                            >
                              <Zap className="w-2.5 h-2.5 text-amber-300" />
                              <span>Simulasi</span>
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredModules.map((mod, idx) => {
                  const Icon = mod.icon;
                  return (
                    <tr
                      key={mod.id}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Module Info & Row Toggle */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 mt-0.5 shrink-0">
                              <Icon className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 truncate">
                                  {mod.label}
                                </span>
                                {mod.sensitive && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    Sensitif
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                {mod.category}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleModuleForAllRoles(mod.id)}
                            className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 shrink-0 cursor-pointer"
                            title="Aktifkan/nonaktifkan modul ini untuk seluruh peran operasional"
                          >
                            Semua Peran
                          </button>
                        </div>
                      </td>

                      {/* Role Checkbox Cells */}
                      {standardRoles.map((r) => {
                        const isSuper = r.isSuperAdmin;
                        const isAllowed =
                          isSuper || (rolePermissions[r.role]?.allowedModules || []).includes(mod.id);

                        return (
                          <td
                            key={r.role}
                            className="py-2.5 px-3 text-center border-l border-slate-200/60 align-middle"
                          >
                            {isSuper ? (
                              <div className="flex items-center justify-center gap-1 text-purple-700 font-bold text-[10px]">
                                <Lock className="w-3.5 h-3.5 text-purple-500" />
                                <span>Penuh</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleForRole(r.role, mod.id)}
                                className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                                  isAllowed
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/70 hover:text-slate-600'
                                }`}
                                title={`Klik untuk mengubah akses modul ${mod.label} bagi peran ${r.role}`}
                              >
                                {isAllowed ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Aktif</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Tutup</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800">
                <tr>
                  <td className="py-3 px-4 font-extrabold uppercase text-[11px]">
                    Total Akses Modul Aktif
                  </td>
                  {standardRoles.map((r) => {
                    const count = r.isSuperAdmin
                      ? ALL_DASHBOARD_MODULES.length
                      : (rolePermissions[r.role]?.allowedModules || []).length;
                    return (
                      <td
                        key={r.role}
                        className="py-3 px-3 text-center border-l border-slate-300 font-mono text-xs"
                      >
                        <span className="font-extrabold text-slate-900">
                          {count} / {ALL_DASHBOARD_MODULES.length}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: KARTU PER PERAN (CARD VIEW WITH LIVE SIMULATOR) */}
      {viewLayout === 'cards' && (
        <div className="space-y-6">
          {/* Role Selector Tabs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Pilih Role / Peran yang Ingin Dikonfigurasi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {standardRoles.map((r) => {
                  const isSelected = selectedRole === r.role;
                  const roleCount = r.isSuperAdmin
                    ? ALL_DASHBOARD_MODULES.length
                    : (rolePermissions[r.role]?.allowedModules || []).length;

                  return (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => setSelectedRole(r.role)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${r.badgeColor}`}>
                          {r.shortLabel}
                        </span>
                        {r.isSuperAdmin && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                            Kunci Penuh
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {r.label.split('(')[0].trim()}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Dapat melihat:</span>
                          <strong className={`font-mono ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {roleCount}/{ALL_DASHBOARD_MODULES.length} Menu
                          </strong>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Role Status Strip */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedRole}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {allowedCount} Modul Terbuka
                    </span>
                    {isCurrentSuperAdmin && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Akses Permanen Root
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {standardRoles.find((r) => r.role === selectedRole)?.description}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {!isCurrentSuperAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAllModules}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
                      title="Berikan izin melihat seluruh 15 modul"
                    >
                      Buka Semua (15/15)
                    </button>
                    <button
                      type="button"
                      onClick={handleHideSensitiveModules}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
                      title="Sembunyikan modul sensitif seperti Gaji, Pajak, dan Audit"
                    >
                      Kunci Modul Sensitif
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToDefaultPreset}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>Preset Standar</span>
                    </button>
                  </>
                )}

                {onSwitchAdminUserRole && (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchAdminUserRole(selectedRole);
                      triggerToast(`Beralih simulasi ke peran: ${selectedRole}. Cek menu sidebar sekarang!`);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Beralih ke peran ini untuk mencoba langsung menu sidebar"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Uji Coba Peran Ini</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Grid: Modules Visibility Cards + Live Sidebar Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Modules List & Toggles */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search & Category Filter */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari modul (contoh: Karyawan, Gaji, Cuti, Pajak)..."
                    value={searchModuleQuery}
                    onChange={(e) => setSearchModuleQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium w-full sm:w-auto"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'Semua Kategori' : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredModules.map((module) => {
                  const Icon = module.icon;
                  const isAllowed = isCurrentSuperAdmin || (activeRoleConfig.allowedModules || []).includes(module.id);

                  return (
                    <div
                      key={module.id}
                      onClick={() => !isCurrentSuperAdmin && handleToggleModule(module.id)}
                      className={`p-4 rounded-2xl border transition-all select-none ${
                        isCurrentSuperAdmin ? 'cursor-default' : 'cursor-pointer'
                      } ${
                        isAllowed
                          ? 'bg-white border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/10 hover:border-emerald-400'
                          : 'bg-slate-50/70 border-slate-200 opacity-65 hover:opacity-85 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              isAllowed
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-slate-200 text-slate-500 border border-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-xs font-bold leading-tight ${
                                  isAllowed ? 'text-slate-900' : 'text-slate-500 line-through'
                                }`}
                              >
                                {module.label}
                              </span>
                              {module.sensitive && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  Sensitif
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">
                              {module.category}
                            </span>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {module.description}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch Component */}
                        <div className="shrink-0 pt-0.5">
                          <div
                            className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                              isAllowed ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-full bg-white shadow-xs flex items-center justify-center">
                              {isAllowed ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <X className="w-3 h-3 text-slate-400" />
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold block text-center mt-1 ${
                              isAllowed ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {isAllowed ? 'Dapat Dilihat' : 'Disembunyikan'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Col: Live Sidebar Preview Simulator */}
            <div className="space-y-4">
              <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl border border-slate-800 shadow-lg sticky top-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      Simulasi Tampilan Sidebar ({selectedRole})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    {allowedCount}/{ALL_DASHBOARD_MODULES.length} Menu
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Berikut adalah menu navigasi yang akan benar-benar terlihat di bilah samping ketika pengguna dengan peran{' '}
                  <strong className="text-slate-200">{selectedRole}</strong> masuk ke dashboard:
                </p>

                <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                  {ALL_DASHBOARD_MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const isVisible =
                      isCurrentSuperAdmin || (activeRoleConfig.allowedModules || []).includes(mod.id);

                    if (isVisible) {
                      return (
                        <div
                          key={mod.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 text-emerald-300 border border-slate-700/60 group transition-all"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate text-slate-200">{mod.label}</span>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-800/40 shrink-0">
                            Aktif
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={mod.id}
                          className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-950/40 text-slate-600 border border-slate-800/40 line-through select-none"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span className="truncate text-slate-600">{mod.label}</span>
                          </div>
                          <span className="text-[9px] font-semibold text-slate-500 flex items-center gap-1 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Terkunci</span>
                          </span>
                        </div>
                      );
                    }
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Status Perubahan:</span>
                  <span className={`font-bold ${hasChanges ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {hasChanges ? 'Belum Disimpan' : 'Tersinkronisasi'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
