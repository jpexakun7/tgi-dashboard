import React, { useState, useMemo } from 'react';
import {
  History,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  DollarSign,
  UserMinus,
  KeyRound,
  FileText,
  Clock,
  ArrowUpDown,
  Eye,
  X,
  Plus,
  RefreshCw,
  Laptop,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Bell,
  CheckCheck,
  Award,
  Sparkles,
  Trash2,
  HandCoins,
  Banknote,
  XCircle,
} from 'lucide-react';
import {
  SystemAuditLog,
  ActivityActionType,
  ActivityCategory,
  ActivitySeverity,
  GoogleAdminUser,
  GoogleAdminAccount,
} from '../types';

interface AuditLogsViewProps {
  logs: SystemAuditLog[];
  onAddLogNote?: (note: {
    description: string;
    category: ActivityCategory;
    severity: ActivitySeverity;
    targetName?: string;
    notes?: string;
  }) => void;
  adminUser?: GoogleAdminUser | null;
  allowedAdmins?: GoogleAdminAccount[];
}

const CATEGORY_COLORS: Record<ActivityCategory, { bg: string; text: string; border: string }> = {
  'Gaji & Payroll': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Data Karyawan': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Hak Akses & Admin': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Persetujuan & Klaim': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Inventaris & Aset': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Penilaian & KPI': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'Kasbon & Keuangan': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  'Notifikasi Sistem': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Pengaturan Sistem': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  'Autentikasi': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

const SEVERITY_CONFIG: Record<
  ActivitySeverity,
  { label: string; badgeBg: string; badgeText: string; icon: any; dotColor: string }
> = {
  danger: {
    label: 'Kritis / Sensitif',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800 border-rose-200',
    icon: ShieldAlert,
    dotColor: 'bg-rose-500',
  },
  warning: {
    label: 'Peringatan',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800 border-amber-200',
    icon: AlertTriangle,
    dotColor: 'bg-amber-500',
  },
  info: {
    label: 'Informasi',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800 border-sky-200',
    icon: Info,
    dotColor: 'bg-sky-500',
  },
  success: {
    label: 'Normal / Sukses',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
  },
};

const ACTION_ICONS: Record<string, any> = {
  SALARY_UPDATE: DollarSign,
  PAYROLL_RUN: DollarSign,
  EMPLOYEE_DELETE: UserMinus,
  EMPLOYEE_CREATE: Users,
  EMPLOYEE_UPDATE: User,
  ROLE_PERMISSION_UPDATE: KeyRound,
  ADMIN_CREATE: KeyRound,
  ADMIN_UPDATE: KeyRound,
  ADMIN_DELETE: KeyRound,
  LEAVE_STATUS_UPDATE: Calendar,
  OVERTIME_STATUS_UPDATE: Clock,
  REIMBURSEMENT_STATUS_UPDATE: DollarSign,
  COMPANY_SETTINGS_UPDATE: SlidersHorizontal,
  PERFORMANCE_REVIEW_CREATE: Award,
  PERFORMANCE_REVIEW_UPDATE: Award,
  PERFORMANCE_REVIEW_DELETE: Trash2,
  PERFORMANCE_BONUS_APPLY: Sparkles,
  NOTIFICATION_SENT: Bell,
  NOTIFICATION_READ: CheckCheck,
  CASH_ADVANCE_CREATE: Banknote,
  CASH_ADVANCE_APPROVE: CheckCircle2,
  CASH_ADVANCE_DISBURSE: HandCoins,
  CASH_ADVANCE_DEDUCT: DollarSign,
  CASH_ADVANCE_REJECT: XCircle,
  LOGIN_ACTIVITY: Globe,
  MANUAL_AUDIT_NOTE: FileText,
};

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({
  logs,
  onAddLogNote,
  adminUser,
  allowedAdmins = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedAdminEmail, setSelectedAdminEmail] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [selectedLogDetail, setSelectedLogDetail] = useState<SystemAuditLog | null>(null);

  // Manual note modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<{
    description: string;
    category: ActivityCategory;
    severity: ActivitySeverity;
    targetName: string;
    notes: string;
  }>({
    description: '',
    category: 'Hak Akses & Admin',
    severity: 'info',
    targetName: '',
    notes: '',
  });

  // Calculate high-level metrics
  const stats = useMemo(() => {
    const total = logs.length;
    const criticalCount = logs.filter(
      (l) => l.severity === 'danger' || l.actionType === 'SALARY_UPDATE' || l.actionType === 'EMPLOYEE_DELETE'
    ).length;
    const permissionsCount = logs.filter(
      (l) =>
        l.actionType === 'ROLE_PERMISSION_UPDATE' ||
        l.actionType === 'ADMIN_CREATE' ||
        l.actionType === 'ADMIN_UPDATE' ||
        l.actionType === 'ADMIN_DELETE'
    ).length;
    const salaryCount = logs.filter(
      (l) => l.actionType === 'SALARY_UPDATE' || l.actionType === 'PAYROLL_RUN'
    ).length;

    // Most active admin
    const adminCounts: Record<string, { name: string; count: number }> = {};
    logs.forEach((l) => {
      if (!adminCounts[l.adminEmail]) {
        adminCounts[l.adminEmail] = { name: l.adminName, count: 0 };
      }
      adminCounts[l.adminEmail].count += 1;
    });

    let topAdmin = { name: 'Belum Ada', count: 0 };
    Object.values(adminCounts).forEach((adm) => {
      if (adm.count > topAdmin.count) {
        topAdmin = adm;
      }
    });

    return { total, criticalCount, permissionsCount, salaryCount, topAdmin };
  }, [logs]);

  // Unique admin emails for filter dropdown
  const uniqueAdminEmails = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (!map.has(l.adminEmail)) {
        map.set(l.adminEmail, `${l.adminName} (${l.adminEmail})`);
      }
    });
    allowedAdmins.forEach((a) => {
      if (!map.has(a.email)) {
        map.set(a.email, `${a.name} (${a.email})`);
      }
    });
    return Array.from(map.entries());
  }, [logs, allowedAdmins]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const now = new Date('2026-10-10T23:59:59'); // 기준 waktu saat ini

    return logs.filter((log) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchAdmin = log.adminName.toLowerCase().includes(q) || log.adminEmail.toLowerCase().includes(q);
        const matchTarget = (log.targetName || '').toLowerCase().includes(q) || (log.targetId || '').toLowerCase().includes(q);
        const matchNotes = (log.notes || '').toLowerCase().includes(q);
        if (!matchDesc && !matchAdmin && !matchTarget && !matchNotes) return false;
      }

      // Category
      if (selectedCategory !== 'all' && log.actionCategory !== selectedCategory) {
        return false;
      }

      // Severity
      if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) {
        return false;
      }

      // Admin Email
      if (selectedAdminEmail !== 'all' && log.adminEmail.toLowerCase() !== selectedAdminEmail.toLowerCase()) {
        return false;
      }

      // Time Range
      if (selectedTimeRange !== 'all') {
        const logDate = new Date(log.timestamp);
        const diffMs = now.getTime() - logDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (selectedTimeRange === 'today' && diffDays > 1.2) return false;
        if (selectedTimeRange === '7days' && diffDays > 7) return false;
        if (selectedTimeRange === '30days' && diffDays > 30) return false;
      }

      return true;
    });
  }, [logs, searchQuery, selectedCategory, selectedSeverity, selectedAdminEmail, selectedTimeRange]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedAdminEmail('all');
    setSelectedTimeRange('all');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Log',
      'Waktu (WIB)',
      'Nama Admin',
      'Email Google',
      'Peran Admin',
      'Kategori',
      'Tipe Aksi',
      'Tingkat Risiko',
      'Deskripsi Aktivitas',
      'Target Entitas',
      'Nilai Sebelum',
      'Nilai Sesudah',
      'IP Address',
      'Perangkat',
      'Catatan / Alasan',
    ];

    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.formattedTime || l.timestamp}"`,
      `"${l.adminName}"`,
      `"${l.adminEmail}"`,
      `"${l.adminRole}"`,
      `"${l.actionCategory}"`,
      `"${l.actionType}"`,
      `"${l.severity}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      `"${(l.targetName || '-').replace(/"/g, '""')}"`,
      `"${(l.oldValue || '-').replace(/"/g, '""')}"`,
      `"${(l.newValue || '-').replace(/"/g, '""')}"`,
      `"${l.ipAddress || '-'}"`,
      `"${(l.device || '-').replace(/"/g, '""')}"`,
      `"${(l.notes || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Log_Sistem_TGI_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit manual note
  const handleSubmitManualNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.description.trim()) return;

    if (onAddLogNote) {
      onAddLogNote(noteForm);
    }

    setNoteForm({
      description: '',
      category: 'Hak Akses & Admin',
      severity: 'info',
      targetName: '',
      notes: '',
    });
    setIsNoteModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
              <History className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Log Aktivitas Sistem & Jejak Audit
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Audit Trail Terproteksi
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Mencatat secara terperinci setiap tindakan krusial oleh admin—seperti pengubahan gaji,
                penghapusan karyawan, perubahan hak akses, serta aktivitas persetujuan guna menjamin
                keamanan data, kepatuhan audit internal, dan transparansi PT Tas Grosir Import.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsNoteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Catat Inspeksi Manual
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              Ekspor CSV Audit
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Entri Log</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Terekam di sistem TGI</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-rose-200 bg-rose-50/20 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Aksi Kritis & Sensitif</p>
            <h3 className="text-2xl font-bold text-rose-900 mt-0.5">{stats.criticalCount}</h3>
            <p className="text-xs text-rose-600 mt-0.5">Ubah gaji & hapus data</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-purple-200 bg-purple-50/20 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Hak Akses & Admin</p>
            <h3 className="text-2xl font-bold text-purple-900 mt-0.5">{stats.permissionsCount}</h3>
            <p className="text-xs text-purple-600 mt-0.5">Perubahan role & otorisasi</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Gaji & Payroll</p>
            <h3 className="text-2xl font-bold text-emerald-900 mt-0.5">{stats.salaryCount}</h3>
            <p className="text-xs text-emerald-600 mt-0.5">Kalkulasi & edit nominal</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama admin, email, aksi, kata kunci deskripsi, ID karyawan..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <span className="text-xs text-slate-500 font-medium">Tampilan:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Terstruktur
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Linimasa Visual
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kategori Aktivitas</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Kategori ({logs.length})</option>
              <option value="Notifikasi Sistem">Notifikasi Sistem</option>
              <option value="Kasbon & Keuangan">Kasbon & Keuangan</option>
              <option value="Penilaian & KPI">Penilaian & KPI</option>
              <option value="Gaji & Payroll">Gaji & Payroll</option>
              <option value="Data Karyawan">Data Karyawan</option>
              <option value="Hak Akses & Admin">Hak Akses & Admin</option>
              <option value="Persetujuan & Klaim">Persetujuan & Klaim</option>
              <option value="Inventaris & Aset">Inventaris & Aset</option>
              <option value="Pengaturan Sistem">Pengaturan Sistem</option>
              <option value="Autentikasi">Autentikasi & Login</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tingkat Kepentingan</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Tingkat Kepentingan</option>
              <option value="danger">Kritis / Sensitif (Merah)</option>
              <option value="warning">Peringatan (Kuning)</option>
              <option value="info">Informasi (Biru)</option>
              <option value="success">Normal / Sukses (Hijau)</option>
            </select>
          </div>

          {/* Admin Actor Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Admin Pelaku</label>
            <select
              value={selectedAdminEmail}
              onChange={(e) => setSelectedAdminEmail(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 truncate"
            >
              <option value="all">Semua Admin ({uniqueAdminEmails.length})</option>
              {uniqueAdminEmails.map(([email, label]) => (
                <option key={email} value={email}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rentang Waktu</label>
            <div className="flex gap-2 items-center">
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Semua Riwayat Waktu</option>
                <option value="today">Hari Ini (24 Jam)</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
              </select>
              {(searchQuery ||
                selectedCategory !== 'all' ||
                selectedSeverity !== 'all' ||
                selectedAdminEmail !== 'all' ||
                selectedTimeRange !== 'all') && (
                <button
                  onClick={handleResetFilters}
                  title="Reset Filter"
                  className="px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <div>
            Menampilkan <span className="font-semibold text-slate-800">{filteredLogs.length}</span> dari total{' '}
            <span className="font-semibold text-slate-800">{logs.length}</span> catatan log
          </div>
          {filteredLogs.length === 0 && (
            <span className="text-amber-600 font-medium">Tidak ada log yang cocok dengan filter yang dipilih.</span>
          )}
        </div>
      </div>

      {/* Main Content: Table or Timeline */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Waktu (WIB)</th>
                  <th className="py-3.5 px-4">Admin Pelaku</th>
                  <th className="py-3.5 px-4">Kategori & Aksi</th>
                  <th className="py-3.5 px-4">Uraian Tindakan</th>
                  <th className="py-3.5 px-4">Nilai Sebelum → Sesudah</th>
                  <th className="py-3.5 px-4">Tingkat Risiko</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">Tidak ada data log yang sesuai</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Coba gunakan kata kunci lain atau bersihkan filter di atas.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const catStyle = CATEGORY_COLORS[log.actionCategory] || {
                      bg: 'bg-slate-100',
                      text: 'text-slate-700',
                      border: 'border-slate-200',
                    };
                    const sevStyle = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
                    const ActionIcon = ACTION_ICONS[log.actionType] || History;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Waktu */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                          <div className="font-semibold text-slate-800">
                            {log.formattedTime || log.timestamp.replace('T', ' ')}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ID: {log.id}
                          </div>
                        </td>

                        {/* Admin */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200">
                              {log.adminName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">
                                {log.adminName}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                                {log.adminEmail}
                              </p>
                              <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600">
                                {log.adminRole}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Kategori & Aksi */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            <ActionIcon className="w-3 h-3 shrink-0" />
                            {log.actionCategory}
                          </span>
                          <div className="text-[11px] font-mono text-slate-500 mt-1">
                            {log.actionType}
                          </div>
                        </td>

                        {/* Uraian Tindakan */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-xs text-slate-800 font-medium leading-relaxed">
                            {log.description}
                          </p>
                          {log.targetName && (
                            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                              Target: {log.targetName}
                            </p>
                          )}
                          {log.notes && (
                            <p className="text-[11px] text-slate-400 italic mt-0.5">
                              Ket: "{log.notes}"
                            </p>
                          )}
                        </td>

                        {/* Nilai Sebelum vs Sesudah */}
                        <td className="py-3.5 px-4 max-w-xs text-xs">
                          {log.oldValue || log.newValue ? (
                            <div className="space-y-1">
                              {log.oldValue && (
                                <div className="text-[11px] text-rose-700 bg-rose-50/70 px-2 py-0.5 rounded-sm border border-rose-100">
                                  <span className="font-bold">Lama:</span> {log.oldValue}
                                </div>
                              )}
                              {log.newValue && (
                                <div className="text-[11px] text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded-sm border border-emerald-100">
                                  <span className="font-bold">Baru:</span> {log.newValue}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>

                        {/* Tingkat Risiko */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sevStyle.badgeBg} ${sevStyle.badgeText}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${sevStyle.dotColor}`} />
                            {sevStyle.label}
                          </span>
                        </td>

                        {/* Detail Modal Trigger */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLogDetail(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Rincian
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Timeline View */
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-100 space-y-8">
            {filteredLogs.map((log) => {
              const ActionIcon = ACTION_ICONS[log.actionType] || History;
              const catStyle = CATEGORY_COLORS[log.actionCategory] || {
                bg: 'bg-slate-100',
                text: 'text-slate-700',
                border: 'border-slate-200',
              };
              const sevStyle = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-[31px] sm:-left-[39px] top-1 w-8 h-8 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
                      log.severity === 'danger'
                        ? 'bg-rose-600 text-white'
                        : log.severity === 'warning'
                        ? 'bg-amber-500 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <ActionIcon className="w-4 h-4" />
                  </div>

                  {/* Card Content */}
                  <div className="bg-slate-50 hover:bg-white rounded-xl p-4 border border-slate-200 hover:border-indigo-200 transition-all shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {log.actionCategory}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${sevStyle.badgeBg} ${sevStyle.badgeText}`}
                        >
                          {sevStyle.label}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          ID: {log.id}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {log.formattedTime || log.timestamp}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {log.description}
                      </p>

                      {/* Side by side diff if available */}
                      {(log.oldValue || log.newValue) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 p-3 bg-white rounded-lg border border-slate-200 text-xs">
                          {log.oldValue && (
                            <div className="bg-rose-50/50 p-2 rounded-sm border-l-2 border-rose-500">
                              <span className="font-bold text-rose-800">Nilai Sebelum (Lama):</span>
                              <p className="text-slate-700 mt-0.5">{log.oldValue}</p>
                            </div>
                          )}
                          {log.newValue && (
                            <div className="bg-emerald-50/50 p-2 rounded-sm border-l-2 border-emerald-500">
                              <span className="font-bold text-emerald-800">Nilai Sesudah (Baru):</span>
                              <p className="text-slate-700 mt-0.5">{log.newValue}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer Info */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {log.adminName} ({log.adminRole})
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 font-mono text-[11px]">{log.adminEmail}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {log.ipAddress && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Globe className="w-3 h-3" />
                              {log.ipAddress}
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedLogDetail(log)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            Detail Lengkap
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Detail Log Audit */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Rincian Dokumen Log Audit</h3>
                  <p className="text-xs text-slate-500">
                    ID Transaksi Audit: <span className="font-mono font-semibold text-indigo-600">{selectedLogDetail.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Severity and Category Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  SEVERITY_CONFIG[selectedLogDetail.severity].badgeBg
                } ${SEVERITY_CONFIG[selectedLogDetail.severity].badgeText}`}
              >
                {SEVERITY_CONFIG[selectedLogDetail.severity].label}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  CATEGORY_COLORS[selectedLogDetail.actionCategory].bg
                } ${CATEGORY_COLORS[selectedLogDetail.actionCategory].text} ${
                  CATEGORY_COLORS[selectedLogDetail.actionCategory].border
                }`}
              >
                {selectedLogDetail.actionCategory}
              </span>
              <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                {selectedLogDetail.actionType}
              </span>
            </div>

            {/* Description */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Deskripsi Transaksi
              </p>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {selectedLogDetail.description}
              </p>
              {selectedLogDetail.targetName && (
                <p className="text-xs font-medium text-indigo-600 mt-2">
                  Entitas Target: {selectedLogDetail.targetName} ({selectedLogDetail.targetId || 'N/A'})
                </p>
              )}
            </div>

            {/* Before vs After Diff Box */}
            {(selectedLogDetail.oldValue || selectedLogDetail.newValue) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Perbandingan Nilai (Audit Delta)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1 mb-1">
                      Nilai Sebelum Modifikasi (Original)
                    </span>
                    <p className="text-xs font-medium text-slate-800">
                      {selectedLogDetail.oldValue || 'Tidak ada catatan'}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 mb-1">
                      Nilai Sesudah Modifikasi (Updated)
                    </span>
                    <p className="text-xs font-medium text-slate-800">
                      {selectedLogDetail.newValue || 'Tidak ada catatan'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Actor & Technical Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] block">
                  Identitas Admin Pelaku
                </span>
                <p className="font-bold text-slate-900">{selectedLogDetail.adminName}</p>
                <p className="text-slate-600 font-mono text-[11px]">{selectedLogDetail.adminEmail}</p>
                <p className="text-indigo-600 font-semibold">{selectedLogDetail.adminRole}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] block">
                  Metadata Keamanan & Waktu
                </span>
                <p className="text-slate-700">
                  <span className="font-medium text-slate-500">Waktu:</span> {selectedLogDetail.formattedTime || selectedLogDetail.timestamp}
                </p>
                <p className="text-slate-700">
                  <span className="font-medium text-slate-500">IP Address:</span>{' '}
                  <span className="font-mono">{selectedLogDetail.ipAddress || '182.253.112.45'}</span>
                </p>
                <p className="text-slate-700 truncate" title={selectedLogDetail.device}>
                  <span className="font-medium text-slate-500">Perangkat:</span> {selectedLogDetail.device || 'Web Browser'}
                </p>
              </div>
            </div>

            {selectedLogDetail.notes && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">Catatan Khusus / Alasan Kebijakan:</span>
                <p className="text-amber-800">{selectedLogDetail.notes}</p>
              </div>
            )}

            {/* Anti-tamper verification note */}
            <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-xl text-slate-500 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Catatan ini telah terarsip secara permanen (append-only) dan diverifikasi oleh sistem audit internal PT Tas Grosir Import.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Catatan Audit Manual */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Catat Hasil Inspeksi / Audit Manual</h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualNote} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Uraian Aktivitas / Hasil Pemeriksaan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={noteForm.description}
                  onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                  placeholder="Contoh: Telah dilakukan verifikasi fisik mutasi data gaji dan bukti transfer bank oleh internal auditor..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Audit</label>
                  <select
                    value={noteForm.category}
                    onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value as any })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Hak Akses & Admin">Hak Akses & Admin</option>
                    <option value="Gaji & Payroll">Gaji & Payroll</option>
                    <option value="Data Karyawan">Data Karyawan</option>
                    <option value="Persetujuan & Klaim">Persetujuan & Klaim</option>
                    <option value="Pengaturan Sistem">Pengaturan Sistem</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat Kepentingan</label>
                  <select
                    value={noteForm.severity}
                    onChange={(e) => setNoteForm({ ...noteForm, severity: e.target.value as any })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="info">Informasi (Biasa)</option>
                    <option value="warning">Peringatan (Perlu Perhatian)</option>
                    <option value="danger">Kritis / Pelanggaran</option>
                    <option value="success">Sukses / Sesuai Prosedur</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Entitas / Dokumen Rujukan (Opsional)
                </label>
                <input
                  type="text"
                  value={noteForm.targetName}
                  onChange={(e) => setNoteForm({ ...noteForm, targetName: e.target.value })}
                  placeholder="Contoh: Dokumen Payroll Oktober 2026 / ID Karyawan TGI-001"
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Tambahan / Nomor Surat Rujukan (Opsional)
                </label>
                <input
                  type="text"
                  value={noteForm.notes}
                  onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })}
                  placeholder="Contoh: Sesuai Instruksi Direktur Operasional SK No. 10/2026"
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-700 text-[11px]">
                Log ini akan dicatat atas nama admin aktif saat ini:{' '}
                <span className="font-bold">{adminUser?.name || 'Administrator'}</span> ({adminUser?.email || 'System'})
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                >
                  Simpan Catatan Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
