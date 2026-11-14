import React, { useState, useMemo } from 'react';
import {
  Award,
  Send,
  Trash2,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  FileText,
  Filter,
  AlertCircle,
  Banknote,
} from 'lucide-react';
import { Employee, EmployeeBonus } from '../types';
import {
  formatRupiah,
  formatIndoDate,
  formatYearMonthToIndo,
  isEmployeePartTime,
  getJakartaYearMonth,
  getJakartaIsoTimestamp,
} from '../utils/formatters';
import {
  sanitizeSafeText,
  validatePositiveIntegerAmount,
} from '../services/authSecurityService';

interface BonusManagementViewProps {
  employees: Employee[];
  bonuses: EmployeeBonus[];
  currentPayrollPeriod?: string;
  selectedPeriod?: string;
  onAddBonus: (
    bonus: Omit<EmployeeBonus, 'id' | 'date_awarded' | 'is_read'> & {
      id?: string;
      date_awarded?: string;
      is_read?: boolean;
    }
  ) => Promise<EmployeeBonus | void>;
  onDeleteBonus: (bonusId: string) => Promise<boolean | void>;
  onMarkAsRead?: (bonusId: string) => Promise<boolean | void>;
  onRefreshBonuses?: () => Promise<void>;
}

function formatRoleAndDepartment(role?: string, department?: string): string {
  const cleanRole = (role || '').trim();
  const cleanDept = (department || '').trim();
  if (!cleanRole && !cleanDept) return '-';
  if (!cleanRole) return cleanDept;
  if (!cleanDept) return cleanRole;
  if (cleanRole.toLowerCase() === cleanDept.toLowerCase()) {
    return cleanRole;
  }
  return `${cleanRole} • ${cleanDept}`;
}

const QUICK_REASON_TEMPLATES = [
  'Bonus pencapaian target live streaming',
  'Lembur sorting gudang',
  'Apresiasi kedisiplinan & hadir tepat waktu',
  'Bonus penjualan grosir melampaui target',
  'Insentif bongkar muat kontainer import',
];

export const BonusManagementView: React.FC<BonusManagementViewProps> = ({
  employees = [],
  bonuses = [],
  onAddBonus,
  onDeleteBonus,
}) => {
  const safeEmployees = useMemo(() => (Array.isArray(employees) ? employees : []), [employees]);
  const safeBonuses = useMemo(() => (Array.isArray(bonuses) ? bonuses : []), [bonuses]);
  const currentYearMonth = useMemo(() => getJakartaYearMonth(), []);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [periodMonth, setPeriodMonth] = useState<string>(currentYearMonth);
  const [reasonNote, setReasonNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Filters for History Table
  const [filterPeriod, setFilterPeriod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READ' | 'UNREAD'>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => safeEmployees.find((e) => e.id === selectedEmployeeId) || null,
    [safeEmployees, selectedEmployeeId]
  );

  const numericAmount = useMemo(() => {
    const cleaned = amountInput.replace(/[^\d]/g, '');
    return cleaned ? Math.max(0, parseInt(cleaned, 10)) : 0;
  }, [amountInput]);

  const availablePeriods = useMemo(() => {
    const set = new Set<string>([currentYearMonth]);
    safeBonuses.forEach((b) => {
      if (b?.period_month) set.add(String(b.period_month).slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [safeBonuses, currentYearMonth]);

  const filteredBonuses = useMemo(() => {
    return safeBonuses.filter((b) => {
      if (filterPeriod !== 'ALL' && b.period_month !== filterPeriod) {
        return false;
      }
      if (statusFilter === 'READ' && !b.is_read) return false;
      if (statusFilter === 'UNREAD' && b.is_read) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = (b.employee_name || '').toLowerCase().includes(q);
        const matchNik = (b.employee_nik || '').toLowerCase().includes(q);
        const matchNote = (b.reason_note || '').toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchNote) return false;
      }
      return true;
    });
  }, [bonuses, filterPeriod, statusFilter, searchQuery]);

  const kpiStats = useMemo(() => {
    const totalNominal = filteredBonuses.reduce(
      (sum, b) => sum + Math.max(0, Number(b.amount) || 0),
      0
    );
    const uniqueRecipients = new Set(
      filteredBonuses.map((b) => b.employee_id || b.employee_nik)
    ).size;
    const unreadCount = filteredBonuses.filter((b) => !b.is_read).length;
    const readCount = filteredBonuses.filter((b) => Boolean(b.is_read)).length;
    return {
      totalNominal,
      uniqueRecipients,
      unreadCount,
      readCount,
      totalRecords: filteredBonuses.length,
    };
  }, [filteredBonuses]);

  const handleAmountChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) {
      setAmountInput('');
      return;
    }
    const num = parseInt(digits, 10);
    setAmountInput(num > 0 ? num.toLocaleString('id-ID') : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedEmployee) {
      setFormError('Silakan pilih karyawan penerima bonus terlebih dahulu.');
      return;
    }
    const validatedAmount = validatePositiveIntegerAmount(numericAmount);
    if (!validatedAmount || validatedAmount <= 0) {
      setFormError('Nominal bonus wajib berupa bilangan bulat positif (> Rp 0).');
      return;
    }
    if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
      setFormError('Periode bulan wajib diisi dengan format YYYY-MM.');
      return;
    }
    const cleanReasonNote = sanitizeSafeText(reasonNote, 500);
    if (!cleanReasonNote) {
      setFormError('Catatan / alasan pemberian bonus wajib diisi dengan teks yang valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddBonus({
        employee_id: selectedEmployee.id,
        employee_nik: sanitizeSafeText(selectedEmployee.nik || '-', 50),
        employee_name: sanitizeSafeText(selectedEmployee.fullName, 120),
        amount: validatedAmount,
        reason_note: cleanReasonNote,
        period_month: periodMonth,
        date_awarded: getJakartaIsoTimestamp(),
        is_read: false,
        department: sanitizeSafeText(selectedEmployee.department, 100),
        role: sanitizeSafeText(selectedEmployee.role, 100),
      });

      setToastMessage(
        `Bonus sebesar ${formatRupiah(validatedAmount)} berhasil dikirim ke ${selectedEmployee.fullName} dan otomatis terhubung ke Slip Gaji periode ${formatYearMonthToIndo(periodMonth)}!`
      );
      setAmountInput('');
      setReasonNote('');
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan data bonus karyawan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (bonusId: string) => {
    await onDeleteBonus(bonusId);
    setConfirmDeleteId(null);
    setToastMessage('Data bonus berhasil dihapus / dibatalkan.');
    setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-emerald-700/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                  HR & Finance • End-to-End Sync
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold mt-1">
                Manajemen Bonus & Apresiasi Karyawan
              </h2>
              <p className="text-emerald-100/80 text-sm mt-1">
                Kirim bonus pencapaian ke karyawan tetap maupun part-time. Notifikasi langsung tampil di Portal Karyawan dan otomatis menambah Gaji Bersih di Slip Gaji.
              </p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/15 shrink-0">
            <p className="text-xs text-emerald-200 uppercase tracking-wider font-medium">
              Total Bonus Terdistribusi
            </p>
            <p className="text-xl font-bold text-white mt-0.5">
              {formatRupiah(kpiStats.totalNominal)}
            </p>
            <p className="text-[11px] text-emerald-200/80 mt-0.5">
              {kpiStats.totalRecords} transaksi • {kpiStats.uniqueRecipients} karyawan
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {Boolean(toastMessage) && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1"
          >
            Tutup
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Total Bonus (Filter)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-2">
            {formatRupiah(kpiStats.totalNominal)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Otomatis masuk ke Slip Gaji periode terkait
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Penerima Bonus
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-2">
            {kpiStats.uniqueRecipients} Karyawan
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Dari total {kpiStats.totalRecords} pencatatan bonus
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Sudah Dibaca Karyawan
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-teal-700 mt-2">
            {kpiStats.readCount} Notifikasi
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Telah dikonfirmasi di Portal Mandiri
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Belum Dibaca
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-amber-600 mt-2">
            {kpiStats.unreadCount} Notifikasi
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan banner alert di Portal Karyawan
          </p>
        </div>
      </div>

      {/* Form Input Bonus */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Form Pemberian Bonus & Apresiasi Karyawan
              </h3>
              <p className="text-xs text-slate-500">
                Pilih karyawan, masukkan nominal bonus manual, periode bulan gaji, serta alasan/catatan pekerjaan.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {Boolean(formError) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pilih Karyawan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pilih Karyawan <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900"
                required
              >
                <option value="">-- Pilih Karyawan Penerima Bonus --</option>
                {employees.map((emp) => {
                  const roleDept = formatRoleAndDepartment(emp.role, emp.department);
                  const ptTag = isEmployeePartTime(emp) ? ' [Part-Time]' : '';
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nik}) — {roleDept}
                      {ptTag}
                    </option>
                  );
                })}
              </select>
              {Boolean(selectedEmployee) && (
                <p className="text-[11px] text-emerald-700 font-medium mt-1.5">
                  NIK: {selectedEmployee?.nik} •{' '}
                  {formatRoleAndDepartment(selectedEmployee?.role, selectedEmployee?.department)}
                </p>
              )}
            </div>

            {/* Nominal Bonus (Rp) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nominal Bonus (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="Contoh: 250.000"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[50000, 100000, 250000, 500000, 1000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(preset.toLocaleString('id-ID'))}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors"
                  >
                    +{(preset / 1000).toLocaleString('id-ID')}rb
                  </button>
                ))}
              </div>
            </div>

            {/* Periode Bulan (YYYY-MM) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Periode Bulan (YYYY-MM) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="month"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Terhubung ke Slip Gaji periode:{' '}
                <span className="font-semibold text-slate-700">
                  {formatYearMonthToIndo(periodMonth)} ({periodMonth})
                </span>
              </p>
            </div>
          </div>

          {/* Catatan / Alasan Bonus */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan / Alasan Bonus (Wajib Diisi) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder='Contoh: "Bonus pencapaian target live streaming", "Lembur sorting gudang", dll.'
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 font-medium mr-1">
                Template Cepat:
              </span>
              {QUICK_REASON_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setReasonNote(tpl)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Bonus yang dikirim langsung disimpan ke Supabase & localStorage (
                <code className="text-emerald-700 font-mono">tgi_employee_bonuses</code>) tanpa mengubah status kontrak karyawan.
              </span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Mengirim Bonus...' : 'Kirim Bonus'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Riwayat Bonus */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Riwayat Pemberian Bonus Karyawan
            </h3>
            <p className="text-xs text-slate-500">
              Daftar seluruh bonus apresiasi yang telah diberikan beserta status konfirmasi baca di Portal Karyawan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIK, alasan..."
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter Periode Bulan */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
              >
                <option value="ALL">Semua Periode Bulan</option>
                {availablePeriods.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatYearMonthToIndo(ym)} ({ym})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status Baca */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'READ' | 'UNREAD')}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="ALL">Semua Status Baca</option>
              <option value="UNREAD">Belum Dibaca</option>
              <option value="READ">Sudah Dibaca</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Tanggal Diberikan</th>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Periode Gaji</th>
                <th className="py-3.5 px-4">Catatan / Alasan Bonus</th>
                <th className="py-3.5 px-4 text-right">Nominal Bonus</th>
                <th className="py-3.5 px-4 text-center">Status Baca</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredBonuses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Award className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        Belum ada data bonus karyawan pada filter ini.
                      </p>
                      <p className="text-xs text-slate-400">
                        Gunakan form di atas untuk mengirim bonus apresiasi baru.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBonuses.map((bonus) => {
                  const matchedEmp = employees.find(
                    (e) =>
                      e.id === bonus.employee_id ||
                      (e.nik &&
                        bonus.employee_nik &&
                        e.nik.toLowerCase() === bonus.employee_nik.toLowerCase())
                  );
                  const roleDept = formatRoleAndDepartment(
                    bonus.role || matchedEmp?.role,
                    bonus.department || matchedEmp?.department
                  );

                  return (
                    <tr
                      key={bonus.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {formatIndoDate(bonus.date_awarded)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(bonus.date_awarded).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {bonus.employee_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          NIK: <span className="font-mono">{bonus.employee_nik || '-'}</span>
                          {Boolean(roleDept && roleDept !== '-') && ` • ${roleDept}`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {formatYearMonthToIndo(bonus.period_month)}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {bonus.period_month}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-md">
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">
                          {bonus.reason_note}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <span className="text-sm font-bold text-emerald-700">
                          +{formatRupiah(bonus.amount)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        {bonus.is_read ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sudah Dibaca
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            Belum Dibaca
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {confirmDeleteId === bonus.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(bonus.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(bonus.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                            title="Hapus / Batalkan Bonus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus / Batalkan</span>
                          </button>
                        )}
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
  );
};
