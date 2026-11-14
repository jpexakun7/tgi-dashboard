import React, { useState, useMemo, useEffect } from 'react';
import { Employee, EmployeeAdjustment } from '../types';
import {
  formatRupiah,
  normalizePeriodToYearMonth,
  formatYearMonthToIndo,
  doesEmployeeMatchAdjustment,
  getJakartaYearMonth,
} from '../utils/formatters';
import {
  Award,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit3,
  PlusCircle,
  Search,
  Calendar,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  FileText,
  Calculator,
  RotateCcw,
} from 'lucide-react';

interface PayrollAdjustmentPanelProps {
  employees: Employee[];
  adjustments: EmployeeAdjustment[];
  currentPayrollPeriod: string;
  onSaveAdjustment: (
    payload: Omit<EmployeeAdjustment, 'id' | 'updated_at'> & {
      id?: string;
      updated_at?: string;
    }
  ) => Promise<EmployeeAdjustment>;
  onDeleteAdjustment: (adjustmentId: string) => Promise<void>;
  onOpenPayslipByEmployeeId?: (employeeId: string) => void;
  onRefreshAdjustments?: () => Promise<void>;
}

const DEFAULT_KESALAHAN_RATE = 10000;

export const PayrollAdjustmentPanel: React.FC<PayrollAdjustmentPanelProps> = ({
  employees,
  adjustments,
  currentPayrollPeriod,
  onSaveAdjustment,
  onDeleteAdjustment,
  onOpenPayslipByEmployeeId,
  onRefreshAdjustments,
}) => {
  const defaultPeriodYm = useMemo(
    () =>
      normalizePeriodToYearMonth(currentPayrollPeriod) ||
      getJakartaYearMonth(),
    [currentPayrollPeriod]
  );

  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState<string>(defaultPeriodYm);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);

  const [tunjanganKerajinan, setTunjanganKerajinan] = useState<number>(0);
  const [tunjanganKedisiplinan, setTunjanganKedisiplinan] = useState<number>(0);
  const [kesalahanCount, setKesalahanCount] = useState<number>(0);
  const [kesalahanRate, setKesalahanRate] = useState<number>(DEFAULT_KESALAHAN_RATE);
  const [catatanKesalahan, setCatatanKesalahan] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const normalized = normalizePeriodToYearMonth(currentPayrollPeriod);
    if (normalized) {
      setSelectedPeriodMonth(normalized);
    }
  }, [currentPayrollPeriod]);

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((e) => e && e.isActive !== false)
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
    [employees]
  );

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const emp of activeEmployees) {
      if (emp.department) set.add(emp.department);
    }
    return Array.from(set).sort();
  }, [activeEmployees]);

  // Period adjustments list
  const periodAdjustments = useMemo(() => {
    return adjustments.filter(
      (adj) => normalizePeriodToYearMonth(adj.period_month) === selectedPeriodMonth
    );
  }, [adjustments, selectedPeriodMonth]);

  // Auto-populate form when employee or period changes
  const handleSelectEmployeeChange = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) {
      setEditingAdjustmentId(null);
      setTunjanganKerajinan(0);
      setTunjanganKedisiplinan(0);
      setKesalahanCount(0);
      setKesalahanRate(DEFAULT_KESALAHAN_RATE);
      setCatatanKesalahan('');
      return;
    }

    const empObj = activeEmployees.find((e) => e.id === empId);
    const existingAdj = periodAdjustments.find((a) =>
      empObj ? doesEmployeeMatchAdjustment(a, empObj) : a.employee_id === empId
    );

    if (existingAdj) {
      setEditingAdjustmentId(existingAdj.id);
      setTunjanganKerajinan(Math.max(0, Math.round(Number(existingAdj.tunjangan_kerajinan) || 0)));
      setTunjanganKedisiplinan(
        Math.max(0, Math.round(Number(existingAdj.tunjangan_kedisiplinan) || 0))
      );
      setKesalahanCount(Math.max(0, Math.round(Number(existingAdj.kesalahan_count) || 0)));
      setKesalahanRate(
        existingAdj.kesalahan_rate !== undefined && !isNaN(Number(existingAdj.kesalahan_rate))
          ? Math.max(0, Math.round(Number(existingAdj.kesalahan_rate)))
          : DEFAULT_KESALAHAN_RATE
      );
      setCatatanKesalahan(existingAdj.catatan_kesalahan || '');
    } else {
      setEditingAdjustmentId(null);
      const defaultKerajinan = empObj
        ? Math.max(
            0,
            Math.round(
              (Number(empObj.allowances?.transport) || 0) +
                (Number(empObj.allowances?.communication) || 0)
            )
          )
        : 0;
      const defaultKedisiplinan = empObj
        ? Math.max(0, Math.round(Number(empObj.allowances?.meal) || 0))
        : 0;
      setTunjanganKerajinan(defaultKerajinan);
      setTunjanganKedisiplinan(defaultKedisiplinan);
      setKesalahanCount(0);
      setKesalahanRate(DEFAULT_KESALAHAN_RATE);
      setCatatanKesalahan('');
    }
  };

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === selectedEmployeeId) || null,
    [activeEmployees, selectedEmployeeId]
  );

  const computedKesalahanTotal = useMemo(
    () => Math.max(0, Math.round((Number(kesalahanCount) || 0) * (Number(kesalahanRate) || 0))),
    [kesalahanCount, kesalahanRate]
  );

  const computedNetAdjustmentImpact = useMemo(
    () =>
      Math.round(
        (Number(tunjanganKerajinan) || 0) +
          (Number(tunjanganKedisiplinan) || 0) -
          computedKesalahanTotal
      ),
    [tunjanganKerajinan, tunjanganKedisiplinan, computedKesalahanTotal]
  );

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const resetForm = () => {
    setSelectedEmployeeId('');
    setEditingAdjustmentId(null);
    setTunjanganKerajinan(0);
    setTunjanganKedisiplinan(0);
    setKesalahanCount(0);
    setKesalahanRate(DEFAULT_KESALAHAN_RATE);
    setCatatanKesalahan('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showToast('error', 'Silakan pilih karyawan terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onSaveAdjustment({
        id: editingAdjustmentId || undefined,
        employee_id: selectedEmployee.id,
        employee_nik: selectedEmployee.nik || '-',
        employee_name: selectedEmployee.fullName,
        period_month: selectedPeriodMonth,
        tunjangan_kerajinan: Math.max(0, Math.round(Number(tunjanganKerajinan) || 0)),
        tunjangan_kedisiplinan: Math.max(0, Math.round(Number(tunjanganKedisiplinan) || 0)),
        kesalahan_count: Math.max(0, Math.round(Number(kesalahanCount) || 0)),
        kesalahan_rate: Math.max(0, Math.round(Number(kesalahanRate) || 0)),
        catatan_kesalahan: catatanKesalahan.trim(),
        department: selectedEmployee.department,
        role: selectedEmployee.role,
      });

      setEditingAdjustmentId(saved.id);
      showToast(
        'success',
        `Penyesuaian Tunjangan & Kedisiplinan untuk ${selectedEmployee.fullName} (${formatYearMonthToIndo(
          selectedPeriodMonth
        )}) berhasil disimpan dan langsung tersinkronisasi ke Slip Gaji!`
      );
    } catch {
      showToast('error', 'Gagal menyimpan data penyesuaian karyawan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRow = (adj: EmployeeAdjustment) => {
    const matchedEmp = activeEmployees.find((e) => doesEmployeeMatchAdjustment(adj, e));
    setSelectedPeriodMonth(normalizePeriodToYearMonth(adj.period_month) || selectedPeriodMonth);
    setSelectedEmployeeId(matchedEmp?.id || adj.employee_id);
    setEditingAdjustmentId(adj.id);
    setTunjanganKerajinan(Math.max(0, Math.round(Number(adj.tunjangan_kerajinan) || 0)));
    setTunjanganKedisiplinan(Math.max(0, Math.round(Number(adj.tunjangan_kedisiplinan) || 0)));
    setKesalahanCount(Math.max(0, Math.round(Number(adj.kesalahan_count) || 0)));
    setKesalahanRate(
      adj.kesalahan_rate !== undefined && !isNaN(Number(adj.kesalahan_rate))
        ? Math.max(0, Math.round(Number(adj.kesalahan_rate)))
        : DEFAULT_KESALAHAN_RATE
    );
    setCatatanKesalahan(adj.catatan_kesalahan || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRow = async (adj: EmployeeAdjustment) => {
    await onDeleteAdjustment(adj.id);
    if (editingAdjustmentId === adj.id) {
      resetForm();
    }
    showToast(
      'success',
      `Data penyesuaian ${adj.employee_name} periode ${formatYearMonthToIndo(
        adj.period_month
      )} telah direset/dihapus.`
    );
  };

  const filteredAdjustments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodAdjustments.filter((adj) => {
      const emp = activeEmployees.find((e) => doesEmployeeMatchAdjustment(adj, e));
      const dept = adj.department || emp?.department || '';
      if (departmentFilter !== 'ALL' && dept !== departmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (adj.employee_name || '').toLowerCase().includes(q) ||
        (adj.employee_nik || '').toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q) ||
        (adj.catatan_kesalahan || '').toLowerCase().includes(q)
      );
    });
  }, [periodAdjustments, activeEmployees, departmentFilter, searchQuery]);

  // Summary KPI for selected period
  const kpiSummary = useMemo(() => {
    let totalKerajinan = 0;
    let totalKedisiplinan = 0;
    let totalKesalahanCount = 0;
    let totalKesalahanRupiah = 0;
    for (const adj of periodAdjustments) {
      totalKerajinan += Math.max(0, Math.round(Number(adj.tunjangan_kerajinan) || 0));
      totalKedisiplinan += Math.max(0, Math.round(Number(adj.tunjangan_kedisiplinan) || 0));
      const c = Math.max(0, Math.round(Number(adj.kesalahan_count) || 0));
      const r =
        adj.kesalahan_rate !== undefined && !isNaN(Number(adj.kesalahan_rate))
          ? Math.max(0, Math.round(Number(adj.kesalahan_rate)))
          : DEFAULT_KESALAHAN_RATE;
      totalKesalahanCount += c;
      totalKesalahanRupiah += c * r;
    }
    return {
      employeesAdjustedCount: periodAdjustments.length,
      totalKerajinan,
      totalKedisiplinan,
      totalKesalahanCount,
      totalKesalahanRupiah,
    };
  }, [periodAdjustments]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-indigo-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sinkronisasi Real-Time ke Slip Gaji (A4) &amp; Portal Karyawan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Manajemen Tunjangan Kerajinan, Kedisiplinan &amp; Potongan Kesalahan
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Atur nominal <strong className="text-white">Tunjangan Kerajinan</strong>,{' '}
              <strong className="text-white">Tunjangan Kedisiplinan</strong> (Bagian 2 — Gaji Tidak
              Tetap), serta <strong className="text-rose-300">Potongan Kesalahan</strong> (Bagian 3
              — Pengurangan) per karyawan per periode. Perubahan otomatis memperbarui Slip Gaji dan
              Take Home Pay secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-indigo-300 shrink-0" />
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-indigo-200 font-bold">
                  Filter Periode Bulan
                </label>
                <input
                  type="month"
                  value={selectedPeriodMonth}
                  onChange={(e) => {
                    const nextPeriod = e.target.value || defaultPeriodYm;
                    setSelectedPeriodMonth(nextPeriod);
                    if (selectedEmployeeId) {
                      const empObj = activeEmployees.find((emp) => emp.id === selectedEmployeeId);
                      const existingForNext = adjustments.find(
                        (a) =>
                          normalizePeriodToYearMonth(a.period_month) === nextPeriod &&
                          (empObj
                            ? doesEmployeeMatchAdjustment(a, empObj)
                            : a.employee_id === selectedEmployeeId)
                      );
                      if (existingForNext) {
                        setEditingAdjustmentId(existingForNext.id);
                        setTunjanganKerajinan(existingForNext.tunjangan_kerajinan);
                        setTunjanganKedisiplinan(existingForNext.tunjangan_kedisiplinan);
                        setKesalahanCount(existingForNext.kesalahan_count);
                        setKesalahanRate(existingForNext.kesalahan_rate);
                        setCatatanKesalahan(existingForNext.catatan_kesalahan || '');
                      } else {
                        setEditingAdjustmentId(null);
                      }
                    }
                  }}
                  className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {Boolean(onRefreshAdjustments) && (
              <button
                type="button"
                onClick={async () => {
                  if (!onRefreshAdjustments) return;
                  setIsRefreshing(true);
                  try {
                    await onRefreshAdjustments();
                    showToast('success', 'Data penyesuaian berhasil disinkronkan ulang.');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Segarkan Data</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {Boolean(toastMessage) && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs ${
            toastMessage?.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {toastMessage?.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage?.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Karyawan Disesuaikan ({formatYearMonthToIndo(selectedPeriodMonth)})
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {kpiSummary.employeesAdjustedCount}{' '}
            <span className="text-xs font-semibold text-slate-500">
              dari {activeEmployees.length} Karyawan
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Tunjangan Kerajinan</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-700 font-mono mt-2">
            {formatRupiah(kpiSummary.totalKerajinan)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Masuk ke Bagian 2 — Gaji Tidak Tetap
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Tunjangan Kedisiplinan
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-teal-700 font-mono mt-2">
            {formatRupiah(kpiSummary.totalKedisiplinan)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Masuk ke Bagian 2 — Gaji Tidak Tetap
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Potongan Kesalahan ({kpiSummary.totalKesalahanCount}x)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-rose-700 font-mono mt-2">
            {formatRupiah(kpiSummary.totalKesalahanRupiah)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Masuk ke Bagian 3 — Pengurangan</p>
        </div>
      </div>

      {/* Main Grid: Form Input/Edit (Left) & Live Calculation Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
        >
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                {editingAdjustmentId ? (
                  <Edit3 className="w-4 h-4" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {editingAdjustmentId
                    ? 'Edit Penyesuaian Tunjangan & Kedisiplinan Karyawan'
                    : 'Form Input Tunjangan Kerajinan, Kedisiplinan & Potongan Kesalahan'}
                </h2>
                <p className="text-xs text-slate-500">
                  Periode Aktif: <strong>{formatYearMonthToIndo(selectedPeriodMonth)}</strong> (
                  {selectedPeriodMonth})
                </p>
              </div>
            </div>

            {Boolean(selectedEmployeeId || editingAdjustmentId) && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Form</span>
              </button>
            )}
          </div>

          <div className="p-6 space-y-5">
            {/* Row 1: Pilih Karyawan & Periode */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Karyawan (Nama, NIK, Divisi) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleSelectEmployeeChange(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {activeEmployees.map((emp) => {
                    const hasAdj = periodAdjustments.some((a) =>
                      doesEmployeeMatchAdjustment(a, emp)
                    );
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} — {emp.nik} ({emp.department || '-'} / {emp.role || '-'})
                        {hasAdj ? ' ✓ [Sudah Diatur]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Periode Bulan (YYYY-MM) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="month"
                  value={selectedPeriodMonth}
                  onChange={(e) => setSelectedPeriodMonth(e.target.value || defaultPeriodYm)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Row 2: Tunjangan Kerajinan & Tunjangan Kedisiplinan */}
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  A. Komponen Penambah — Bagian 2. Gaji Tidak Tetap
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Kuantitas di Slip Gaji: × 1 Kali / Bulan
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Nominal Tunjangan Kerajinan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={tunjanganKerajinan}
                      onChange={(e) =>
                        setTunjanganKerajinan(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      placeholder="0"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0, 100000, 150000, 200000, 250000, 300000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTunjanganKerajinan(preset)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                          tunjanganKerajinan === preset
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'
                        }`}
                      >
                        {preset === 0 ? 'Rp 0' : `${preset / 1000}rb`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Nominal Tunjangan Kedisiplinan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={tunjanganKedisiplinan}
                      onChange={(e) =>
                        setTunjanganKedisiplinan(
                          Math.max(0, Math.round(Number(e.target.value) || 0))
                        )
                      }
                      placeholder="0"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0, 100000, 150000, 200000, 250000, 300000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTunjanganKedisiplinan(preset)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                          tunjanganKedisiplinan === preset
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'
                        }`}
                      >
                        {preset === 0 ? 'Rp 0' : `${preset / 1000}rb`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Potongan Kesalahan */}
            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-black uppercase tracking-wider text-rose-900">
                  B. Komponen Pengurang — Bagian 3. Pengurangan (Baris &ldquo;Kesalahan&rdquo;)
                </span>
                <span className="text-xs font-bold font-mono text-rose-700">
                  Total Potongan Kesalahan: {formatRupiah(computedKesalahanTotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Jumlah Kesalahan (Kali / Bulan)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={kesalahanCount}
                    onChange={(e) =>
                      setKesalahanCount(Math.max(0, Math.round(Number(e.target.value) || 0)))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0, 1, 2, 3, 5, 10].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setKesalahanCount(cnt)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                          kesalahanCount === cnt
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50'
                        }`}
                      >
                        {cnt}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tarif Denda per Kesalahan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={kesalahanRate}
                      onChange={(e) =>
                        setKesalahanRate(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[5000, 10000, 20000, 25000, 50000].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setKesalahanRate(rate)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                          kesalahanRate === rate
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50'
                        }`}
                      >
                        {rate / 1000}rb
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Total Potongan Kesalahan (Otomatis)
                  </label>
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 bg-rose-100/70 text-sm font-mono font-black text-rose-800 flex items-center justify-between">
                    <span>{formatRupiah(computedKesalahanTotal)}</span>
                    <span className="text-[11px] font-sans font-semibold text-rose-600">
                      ({kesalahanCount} × {formatRupiah(kesalahanRate)})
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan / Keterangan Kesalahan atau Kedisiplinan (Opsional)
                </label>
                <input
                  type="text"
                  value={catatanKesalahan}
                  onChange={(e) => setCatatanKesalahan(e.target.value)}
                  placeholder="Contoh: Salah packing kode barang / salah input resi pengiriman..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                Efek Bersih ke Slip Gaji:{' '}
                <strong
                  className={
                    computedNetAdjustmentImpact >= 0
                      ? 'text-emerald-700 font-mono'
                      : 'text-rose-700 font-mono'
                  }
                >
                  {computedNetAdjustmentImpact >= 0 ? '+' : ''}
                  {formatRupiah(computedNetAdjustmentImpact)}
                </strong>
              </div>

              <button
                type="submit"
                disabled={isSaving || !selectedEmployeeId}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Menyimpan...'
                    : editingAdjustmentId
                    ? 'Perbarui & Sinkronkan Penyesuaian'
                    : 'Simpan Penyesuaian'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Right Side: Live Payslip Preview Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pratinjau Baris Slip Gaji Resmi
              </h3>
              <p className="text-[11px] text-slate-500">
                Tampilan otomatis pada dokumen Slip Gaji A4
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Karyawan Terpilih
              </p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {selectedEmployee ? selectedEmployee.fullName : 'Belum memilih karyawan'}
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedEmployee
                  ? `${selectedEmployee.nik} • ${selectedEmployee.department || '-'} (${
                      selectedEmployee.role || '-'
                    })`
                  : 'Pilih karyawan pada dropdown di sebelah kiri'}
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-800 border-b border-slate-200">
                2. GAJI TIDAK TETAP
              </div>
              <div className="divide-y divide-slate-200">
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">Tunjangan Kerajinan</p>
                    <p className="text-[10px] text-slate-500">× 1 Kali / Bulan</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatRupiah(tunjanganKerajinan)}
                  </span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">Tunjangan Kedisiplinan</p>
                    <p className="text-[10px] text-slate-500">× 1 Kali / Bulan</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatRupiah(tunjanganKedisiplinan)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-rose-200 rounded-xl overflow-hidden">
              <div className="bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-950 border-b border-rose-200">
                3. PENGURANGAN
              </div>
              <div className="px-3 py-2.5 space-y-1 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">Kesalahan</p>
                    <p className="text-[10px] text-slate-600">
                      Tarif: {formatRupiah(kesalahanCount > 0 ? kesalahanRate : 0)} • ×{' '}
                      {kesalahanCount} Kesalahan / Bulan
                    </p>
                  </div>
                  <span className="font-mono font-bold text-rose-700">
                    {formatRupiah(computedKesalahanTotal)}
                  </span>
                </div>
                {Boolean(catatanKesalahan.trim()) && (
                  <p className="text-[11px] italic text-slate-500 pt-1 border-t border-slate-100">
                    Catatan: &ldquo;{catatanKesalahan.trim()}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {Boolean(selectedEmployee && onOpenPayslipByEmployeeId) && (
              <button
                type="button"
                onClick={() => {
                  if (selectedEmployee && onOpenPayslipByEmployeeId) {
                    onOpenPayslipByEmployeeId(selectedEmployee.id);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Lihat Slip Gaji {selectedEmployee?.fullName}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabel Rekap Penyesuaian Karyawan Periode Terpilih */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Tabel Rekap Penyesuaian Karyawan — Periode{' '}
              {formatYearMonthToIndo(selectedPeriodMonth)}
            </h3>
            <p className="text-xs text-slate-500">
              Daftar karyawan yang memiliki pengaturan Tunjangan Kerajinan, Kedisiplinan, atau
              Potongan Kesalahan pada periode {selectedPeriodMonth}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIK, catatan..."
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="ALL">Semua Divisi</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Divisi / Jabatan</th>
                <th className="py-3 px-4 text-right">Tunj. Kerajinan</th>
                <th className="py-3 px-4 text-right">Tunj. Kedisiplinan</th>
                <th className="py-3 px-4 text-center">Jml Kesalahan</th>
                <th className="py-3 px-4 text-right">Tarif Denda</th>
                <th className="py-3 px-4 text-right">Total Potongan</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center text-slate-500">
                    Belum ada data penyesuaian Tunjangan Kerajinan, Kedisiplinan, atau Potongan
                    Kesalahan untuk periode{' '}
                    <strong>{formatYearMonthToIndo(selectedPeriodMonth)}</strong>. Silakan pilih
                    karyawan pada form di atas lalu klik <strong>Simpan Penyesuaian</strong>.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const empObj = activeEmployees.find((e) => doesEmployeeMatchAdjustment(adj, e));
                  const count = Math.max(0, Math.round(Number(adj.kesalahan_count) || 0));
                  const rate =
                    adj.kesalahan_rate !== undefined && !isNaN(Number(adj.kesalahan_rate))
                      ? Math.max(0, Math.round(Number(adj.kesalahan_rate)))
                      : DEFAULT_KESALAHAN_RATE;
                  const totalCut = count * rate;

                  return (
                    <tr
                      key={adj.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{adj.employee_name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{adj.employee_nik}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-700">
                          {adj.department || empObj?.department || '-'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {adj.role || empObj?.role || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatRupiah(adj.tunjangan_kerajinan)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-700">
                        {formatRupiah(adj.tunjangan_kedisiplinan)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            count > 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {count} Kesalahan / Bulan
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatRupiah(rate)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        {formatRupiah(totalCut)}
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <p className="truncate text-slate-600" title={adj.catatan_kesalahan}>
                          {adj.catatan_kesalahan || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {Boolean(empObj && onOpenPayslipByEmployeeId) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (empObj && onOpenPayslipByEmployeeId) {
                                  onOpenPayslipByEmployeeId(empObj.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                              title="Lihat Slip Gaji"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditRow(adj)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-semibold transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(adj)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-semibold transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Reset/Hapus</span>
                          </button>
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
  );
};
