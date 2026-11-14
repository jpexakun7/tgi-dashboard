import React, { useState, useMemo, useEffect } from 'react';
import {
  Gift,
  Calendar,
  CheckSquare,
  Square,
  RefreshCw,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Download,
  FileText,
  AlertCircle,
  Sparkles,
  Wallet,
  Users,
  Info,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  Employee,
  ThrPayoutRecord,
  PartTimeWorkLog,
  AttendanceRecord,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  isEmployeePartTime,
  normalizePeriodToYearMonth,
  calculateEmployeeThrPermenaker,
  HOLIDAY_PRESETS_CONFIG,
  getHolidayDateForYearAndPreset,
  getDefaultUpcomingHolidayConfig,
  getJakartaYearMonth,
  getJakartaDateParts,
  getJakartaDateString,
  getJakartaIsoTimestamp,
  JAKARTA_TIMEZONE,
} from '../utils/formatters';

interface ThrManagementPanelProps {
  employees: Employee[];
  thrPayouts: ThrPayoutRecord[];
  partTimeLogs: PartTimeWorkLog[];
  attendances: AttendanceRecord[];
  currentPayrollPeriod: string;
  adminName?: string;
  onSaveThrPayout: (record: ThrPayoutRecord) => Promise<void> | void;
  onBatchSaveThrPayouts: (records: ThrPayoutRecord[]) => Promise<void> | void;
  onOpenPayslipByEmployeeId?: (employeeId: string) => void;
  onRefreshThrPayouts?: () => Promise<void> | void;
}

export const ThrManagementPanel: React.FC<ThrManagementPanelProps> = ({
  employees,
  thrPayouts,
  partTimeLogs,
  attendances,
  currentPayrollPeriod,
  adminName = 'Administrator HR',
  onSaveThrPayout,
  onBatchSaveThrPayouts,
  onOpenPayslipByEmployeeId,
  onRefreshThrPayouts,
}) => {
  const defaultPeriodYm = useMemo(
    () => normalizePeriodToYearMonth(currentPayrollPeriod) || getJakartaYearMonth(),
    [currentPayrollPeriod]
  );

  const initialHolidayConfig = useMemo(
    () => getDefaultUpcomingHolidayConfig(thrPayouts, currentPayrollPeriod),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [selectedYear, setSelectedYear] = useState<number>(initialHolidayConfig.selectedYear);
  const [selectedHolidayName, setSelectedHolidayName] = useState<string>(
    initialHolidayConfig.selectedHolidayName
  );
  const [selectedHolidayDate, setSelectedHolidayDate] = useState<string>(
    initialHolidayConfig.selectedHolidayDate
  );
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState<string>(
    initialHolidayConfig.selectedPeriodMonth || defaultPeriodYm
  );

  const dynamicYearOptions = useMemo(() => {
    const curYear = getJakartaDateParts().year;
    return [curYear - 1, curYear, curYear + 1, curYear + 2, curYear + 3];
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [employmentFilter, setEmploymentFilter] = useState<'ALL' | 'FULL_CONTRACT' | 'PART_TIME'>('ALL');
  const [payslipCheckFilter, setPayslipCheckFilter] = useState<'ALL' | 'CHECKED' | 'UNCHECKED'>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'Belum Cair' | 'Sudah Dibayar'>('ALL');

  const [manualAdjustmentsDraft, setManualAdjustmentsDraft] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDisbursing, setIsDisbursing] = useState<boolean>(false);
  const [savingEmpId, setSavingEmpId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPeriodMonth(defaultPeriodYm);
  }, [defaultPeriodYm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const activeEmployees = useMemo(
    () =>
      (Array.isArray(employees) ? employees : []).filter(
        (e) => e && e.isActive !== false && e.approvalStatus !== 'rejected'
      ),
    [employees]
  );

  // Map existing saved THR records for the selected year
  const existingRecordByEmpId = useMemo(() => {
    const map = new Map<string, ThrPayoutRecord>();
    for (const rec of thrPayouts) {
      if (!rec) continue;
      if (Number(rec.thr_year) === Number(selectedYear)) {
        map.set(rec.employee_id, rec);
      }
    }
    return map;
  }, [thrPayouts, selectedYear]);

  // Compute live THR rows for all active employees (PKWTT, PKWT, and Part-Time)
  const computedRows = useMemo<ThrPayoutRecord[]>(() => {
    return activeEmployees.map((emp) => {
      const existing = existingRecordByEmpId.get(emp.id) || null;
      return calculateEmployeeThrPermenaker({
        employee: emp,
        holidayDate: selectedHolidayDate,
        holidayName: selectedHolidayName,
        thrYear: selectedYear,
        periodMonth: selectedPeriodMonth,
        partTimeLogs,
        attendances,
        existingRecord: existing
          ? {
              ...existing,
              holiday_name: selectedHolidayName,
              holiday_date: selectedHolidayDate,
              period_month: selectedPeriodMonth,
            }
          : null,
      });
    });
  }, [
    activeEmployees,
    existingRecordByEmpId,
    selectedHolidayDate,
    selectedHolidayName,
    selectedYear,
    selectedPeriodMonth,
    partTimeLogs,
    attendances,
  ]);

  const filteredRows = useMemo(() => {
    return computedRows.filter((row) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.employee_name.toLowerCase().includes(q);
        const matchNik = row.employee_nik.toLowerCase().includes(q);
        const matchDept = row.department.toLowerCase().includes(q);
        const matchRole = row.role.toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchDept && !matchRole) return false;
      }

      const isPt = row.employment_type === 'Part-Time';
      if (employmentFilter === 'FULL_CONTRACT' && isPt) return false;
      if (employmentFilter === 'PART_TIME' && !isPt) return false;

      if (payslipCheckFilter === 'CHECKED' && !row.show_in_payslip) return false;
      if (payslipCheckFilter === 'UNCHECKED' && row.show_in_payslip) return false;

      if (paymentStatusFilter !== 'ALL' && row.payment_status !== paymentStatusFilter) {
        return false;
      }

      return true;
    });
  }, [
    computedRows,
    searchQuery,
    employmentFilter,
    payslipCheckFilter,
    paymentStatusFilter,
  ]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const totalEmployees = computedRows.length;
    const eligibleFullCount = computedRows.filter(
      (r) => r.eligibility_status === 'Berhak Penuh (100%)'
    ).length;
    const eligibleProportionalCount = computedRows.filter(
      (r) => r.eligibility_status === 'Berhak Proporsional'
    ).length;
    const ineligibleCount = computedRows.filter(
      (r) => r.eligibility_status === 'Belum Berhak THR'
    ).length;

    const totalCalculatedThr = computedRows.reduce((s, r) => s + r.total_thr_amount, 0);
    const checkedRows = computedRows.filter((r) => r.show_in_payslip);
    const checkedCount = checkedRows.length;
    const totalCheckedThr = checkedRows.reduce((s, r) => s + r.total_thr_amount, 0);

    const paidRows = computedRows.filter((r) => r.payment_status === 'Sudah Dibayar');
    const paidCount = paidRows.length;
    const totalPaidThr = paidRows.reduce((s, r) => s + r.total_thr_amount, 0);

    const unpaidCheckedCount = checkedRows.filter(
      (r) => r.payment_status !== 'Sudah Dibayar' && r.total_thr_amount > 0
    ).length;

    return {
      totalEmployees,
      eligibleFullCount,
      eligibleProportionalCount,
      ineligibleCount,
      totalCalculatedThr,
      checkedCount,
      totalCheckedThr,
      paidCount,
      totalPaidThr,
      unpaidCheckedCount,
    };
  }, [computedRows]);

  // Generate THR Otomatis untuk seluruh karyawan
  const handleGenerateAllThr = async () => {
    setIsGenerating(true);
    try {
      const recordsToSave: ThrPayoutRecord[] = activeEmployees.map((emp) => {
        const existing = existingRecordByEmpId.get(emp.id) || null;
        return calculateEmployeeThrPermenaker({
          employee: emp,
          holidayDate: selectedHolidayDate,
          holidayName: selectedHolidayName,
          thrYear: selectedYear,
          periodMonth: selectedPeriodMonth,
          partTimeLogs,
          attendances,
          existingRecord: existing
            ? {
                ...existing,
                holiday_name: selectedHolidayName,
                holiday_date: selectedHolidayDate,
                period_month: selectedPeriodMonth,
                // Pertahankan status ceklis yang sudah diatur Admin; jika baru, default false
                show_in_payslip: Boolean(existing.show_in_payslip === true),
              }
            : {
                show_in_payslip: false,
                payment_status: 'Belum Cair',
              },
        });
      });

      await onBatchSaveThrPayouts(recordsToSave);
      showToast(
        `Berhasil men-generate perhitungan THR ${selectedHolidayName} ${selectedYear} untuk ${recordsToSave.length} karyawan sesuai Permenaker No. 6/2016!`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle Checkbox "Tampilkan & Cairkan di Slip Gaji" per karyawan
  const handleToggleShowInPayslip = async (row: ThrPayoutRecord) => {
    setSavingEmpId(row.employee_id);
    try {
      const nextChecked = !row.show_in_payslip;
      const updatedRecord: ThrPayoutRecord = {
        ...row,
        holiday_name: selectedHolidayName,
        holiday_date: selectedHolidayDate,
        period_month: selectedPeriodMonth,
        show_in_payslip: nextChecked,
        updated_at: getJakartaIsoTimestamp(),
      };
      await onSaveThrPayout(updatedRecord);
      showToast(
        nextChecked
          ? `✓ THR ${row.employee_name} (${formatRupiah(row.total_thr_amount)}) diaktifkan & tampil pada Slip Gaji!`
          : `THR ${row.employee_name} disembunyikan dari Slip Gaji & Take Home Pay.`
      );
    } finally {
      setSavingEmpId(null);
    }
  };

  // Toggle Ceklis Semua Karyawan yang Berhak pada tampilan filter saat ini
  const handleToggleCheckAllEligible = async (targetCheck: boolean) => {
    const eligibleInView = filteredRows.filter(
      (r) => r.eligibility_status !== 'Belum Berhak THR' || r.total_thr_amount > 0
    );
    if (eligibleInView.length === 0) return;

    setIsGenerating(true);
    try {
      const nowWib = getJakartaIsoTimestamp();
      const updatedList = eligibleInView.map((r) => ({
        ...r,
        holiday_name: selectedHolidayName,
        holiday_date: selectedHolidayDate,
        period_month: selectedPeriodMonth,
        show_in_payslip: targetCheck,
        updated_at: nowWib,
      }));
      await onBatchSaveThrPayouts(updatedList);
      showToast(
        targetCheck
          ? `✓ ${updatedList.length} karyawan berhak THR telah diceklis untuk tampil di Slip Gaji.`
          : `Ceklis Slip Gaji untuk ${updatedList.length} karyawan telah dinonaktifkan.`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Simpan Penyesuaian / Bonus Tambahan THR Manual per karyawan
  const handleSaveManualAdjustment = async (row: ThrPayoutRecord) => {
    setSavingEmpId(row.employee_id);
    try {
      const rawDraft = manualAdjustmentsDraft[row.employee_id];
      const parsedAdj =
        rawDraft !== undefined
          ? Math.round(Number(rawDraft.replace(/[^0-9-]/g, '')) || 0)
          : row.manual_adjustment_amount;
      const noteText =
        notesDraft[row.employee_id] !== undefined ? notesDraft[row.employee_id] : row.notes || '';
      const nextTotal = Math.max(0, Math.round(row.calculated_thr_amount + parsedAdj));

      const updated: ThrPayoutRecord = {
        ...row,
        holiday_name: selectedHolidayName,
        holiday_date: selectedHolidayDate,
        period_month: selectedPeriodMonth,
        manual_adjustment_amount: parsedAdj,
        total_thr_amount: nextTotal,
        notes: noteText,
        updated_at: getJakartaIsoTimestamp(),
      };

      await onSaveThrPayout(updated);
      showToast(
        `Penyesuaian THR ${row.employee_name} disimpan. Total THR: ${formatRupiah(nextTotal)}`
      );
    } finally {
      setSavingEmpId(null);
    }
  };

  // Tandai Sudah Dibayar / Belum Cair per karyawan
  const handleTogglePaymentStatus = async (row: ThrPayoutRecord) => {
    setSavingEmpId(row.employee_id);
    try {
      const isMarkingPaid = row.payment_status !== 'Sudah Dibayar';
      const nowIso = getJakartaIsoTimestamp();
      const updated: ThrPayoutRecord = {
        ...row,
        holiday_name: selectedHolidayName,
        holiday_date: selectedHolidayDate,
        period_month: selectedPeriodMonth,
        // Jika ditandai Sudah Dibayar oleh Admin, otomatis pastikan tercatat
        payment_status: isMarkingPaid ? 'Sudah Dibayar' : 'Belum Cair',
        paid_at: isMarkingPaid ? nowIso : undefined,
        paid_by: isMarkingPaid ? adminName : undefined,
        updated_at: nowIso,
      };
      await onSaveThrPayout(updated);
      showToast(
        isMarkingPaid
          ? `✓ THR ${row.employee_name} sebesar ${formatRupiah(row.total_thr_amount)} ditandai SUDAH DIBAYAR & tercatat di Laporan Pengeluaran!`
          : `Status pembayaran THR ${row.employee_name} dikembalikan menjadi Belum Cair.`
      );
    } finally {
      setSavingEmpId(null);
    }
  };

  // Cairkan THR Terpilih (Hanya memproses karyawan yang sudah diceklis show_in_payslip === true)
  const handleDisburseSelectedThr = async () => {
    const selectedToDisburse = computedRows.filter(
      (r) => r.show_in_payslip === true && r.total_thr_amount > 0
    );

    if (selectedToDisburse.length === 0) {
      showToast(
        '⚠ Belum ada karyawan yang diceklis! Silakan centang kolom "Tampilkan & Cairkan di Slip Gaji" terlebih dahulu.'
      );
      return;
    }

    setIsDisbursing(true);
    try {
      const nowIso = getJakartaIsoTimestamp();
      const updatedRecords: ThrPayoutRecord[] = selectedToDisburse.map((r) => ({
        ...r,
        holiday_name: selectedHolidayName,
        holiday_date: selectedHolidayDate,
        period_month: selectedPeriodMonth,
        show_in_payslip: true,
        payment_status: 'Sudah Dibayar',
        paid_at: r.paid_at || nowIso,
        paid_by: adminName,
        updated_at: nowIso,
      }));

      await onBatchSaveThrPayouts(updatedRecords);
      const totalDisbursedAmount = updatedRecords.reduce((s, r) => s + r.total_thr_amount, 0);
      showToast(
        `✓ Berhasil mencairkan THR untuk ${updatedRecords.length} karyawan terpilih sebesar ${formatRupiah(
          totalDisbursedAmount
        )} & tercatat otomatis di Laporan Keuangan/Pengeluaran Gaji!`
      );
    } finally {
      setIsDisbursing(false);
    }
  };

  // Ekspor CSV Rekap THR
  const handleExportThrCsv = () => {
    const headers = [
      'NIK',
      'Nama Karyawan',
      'Divisi',
      'Jabatan',
      'Status Karyawan',
      'Tanggal Masuk',
      'Tanggal Hari Raya',
      'Masa Kerja',
      'Status Kelayakan THR',
      'Rumus Proporsional',
      'Dasar Perhitungan Upah (Rp)',
      'THR Terhitung Otomatis (Rp)',
      'Penyesuaian Manual (Rp)',
      'Total THR Akhir (Rp)',
      'Tampil di Slip Gaji (Ceklis Admin)',
      'Status Pembayaran',
      'Waktu Pencairan (WIB)',
    ];

    const csvRows = computedRows.map((r) => [
      `"${r.employee_nik}"`,
      `"${r.employee_name}"`,
      `"${r.department}"`,
      `"${r.role}"`,
      `"${r.employment_type}"`,
      r.join_date,
      r.holiday_date,
      `"${r.tenure_label}"`,
      `"${r.eligibility_status}"`,
      `"${r.proportion_formula}"`,
      r.calculation_basis_amount,
      r.calculated_thr_amount,
      r.manual_adjustment_amount,
      r.total_thr_amount,
      r.show_in_payslip ? 'YA (Tampil di Slip)' : 'TIDAK (Disembunyikan)',
      `"${r.payment_status}"`,
      `"${
        r.paid_at
          ? new Date(r.paid_at).toLocaleString('id-ID', { timeZone: JAKARTA_TIMEZONE }) + ' WIB'
          : '-'
      }"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TGI_Rekap_THR_${selectedHolidayName.replace(/\s+/g, '_')}_${selectedYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {Boolean(toastMessage) && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-950 text-emerald-50 border border-emerald-700 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-200 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Action Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  THR &amp; Tunjangan Hari Raya Keagamaan
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                  Permenaker No. 6/2016
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kalkulator THR otomatis berdasarkan masa kerja (PKWTT, PKWT, &amp; Part-Time). Baris THR di Slip Gaji &amp; Portal Karyawan <strong>hanya muncul jika kotak ceklis diaktifkan oleh Admin</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onRefreshThrPayouts && (
              <button
                type="button"
                onClick={() => onRefreshThrPayouts()}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Sinkronkan ulang dari Supabase Cloud"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Cloud</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportThrCsv}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Ekspor CSV</span>
            </button>
            <button
              type="button"
              onClick={handleGenerateAllThr}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Menghitung...' : 'Generate THR Otomatis'}</span>
            </button>
            <button
              type="button"
              onClick={handleDisburseSelectedThr}
              disabled={isDisbursing || summaryStats.checkedCount === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
              title="Cairkan THR hanya untuk karyawan yang sudah diceklis & catat ke Laporan Pengeluaran"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>
                {isDisbursing
                  ? 'Memproses Pencairan...'
                  : `Cairkan THR Terpilih (${summaryStats.checkedCount})`}
              </span>
            </button>
          </div>
        </div>

        {/* Pemilih Tahun, Jenis Hari Raya, Tanggal Hari Raya, & Periode Slip Gaji */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tahun THR
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                const yr = Number(e.target.value) || getJakartaDateParts().year;
                setSelectedYear(yr);
                const resolvedDate = getHolidayDateForYearAndPreset(
                  selectedHolidayName,
                  yr,
                  selectedHolidayName === 'Hari Raya Keagamaan Lainnya'
                );
                setSelectedHolidayDate(resolvedDate);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {dynamicYearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nama / Jenis Hari Raya
            </label>
            <select
              value={selectedHolidayName}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedHolidayName(val);
                const todayWib = getJakartaDateString();
                const currentWibYear = getJakartaDateParts().year;
                let targetYr = selectedYear;
                let candidateDate = getHolidayDateForYearAndPreset(
                  val,
                  targetYr,
                  val === 'Hari Raya Keagamaan Lainnya'
                );
                // Jika tanggal hari raya pada tahun berjalan sudah lewat dari hari ini WIB, otomatis arahkan ke tahun berikutnya agar >= hari ini WIB
                if (targetYr <= currentWibYear && candidateDate < todayWib) {
                  targetYr = currentWibYear + 1;
                  setSelectedYear(targetYr);
                  candidateDate = getHolidayDateForYearAndPreset(val, targetYr, false);
                }
                setSelectedHolidayDate(candidateDate);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {HOLIDAY_PRESETS_CONFIG.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tanggal Hari Raya (Acuan Masa Kerja)
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedHolidayDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedHolidayDate(val);
                    const yr = Number(val.slice(0, 4));
                    if (!isNaN(yr) && yr >= 2020) setSelectedYear(yr);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Periode Slip Gaji Terkait (YYYY-MM)
            </label>
            <input
              type="month"
              value={selectedPeriodMonth}
              onChange={(e) => setSelectedPeriodMonth(e.target.value || defaultPeriodYm)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Estimasi THR ({selectedYear})
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-2">
            {formatRupiah(summaryStats.totalCalculatedThr)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summaryStats.eligibleFullCount} Penuh (100%) • {summaryStats.eligibleProportionalCount} Proporsional • {summaryStats.ineligibleCount} Belum Berhak
          </p>
        </div>

        <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Diceklis Tampil di Slip Gaji
            </span>
            <div className="p-2 rounded-xl bg-emerald-600 text-white">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-emerald-900 mt-2">
            {formatRupiah(summaryStats.totalCheckedThr)}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            {summaryStats.checkedCount} dari {summaryStats.totalEmployees} karyawan diaktifkan di Slip Gaji
          </p>
        </div>

        <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              THR Sudah Dicairkan / Dibayar
            </span>
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-indigo-900 mt-2">
            {formatRupiah(summaryStats.totalPaidThr)}
          </p>
          <p className="text-[11px] text-indigo-700 font-semibold mt-1">
            {summaryStats.paidCount} karyawan berstatus &ldquo;Sudah Dibayar&rdquo;
          </p>
        </div>

        <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Aturan Permenaker No. 6/2016
            </span>
            <div className="p-2 rounded-xl bg-amber-500 text-white">
              <Info className="w-4 h-4" />
            </div>
          </div>
          <ul className="text-[11px] text-amber-900 space-y-0.5 mt-1.5 leading-snug">
            <li>• <strong>&ge; 12 Bln:</strong> 100% Upah (Pokok + Tunj. Tetap)</li>
            <li>• <strong>1–11 Bln:</strong> (Masa Kerja / 12) &times; Upah</li>
            <li>• <strong>Part-Time:</strong> Basis Rata-rata Upah Bulanan</li>
            <li>• <strong>&lt; 1 Bln (&lt; 30 hr):</strong> Belum Berhak THR</li>
          </ul>
        </div>
      </div>

      {/* Filter & Bulk Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan, NIK, divisi, atau jabatan..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={employmentFilter}
            onChange={(e) => setEmploymentFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          >
            <option value="ALL">Semua Tipe Karyawan</option>
            <option value="FULL_CONTRACT">PKWTT (Tetap) &amp; PKWT (Kontrak)</option>
            <option value="PART_TIME">Part-Time / Harian Lepas</option>
          </select>

          <select
            value={payslipCheckFilter}
            onChange={(e) => setPayslipCheckFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          >
            <option value="ALL">Semua Status Ceklis Slip</option>
            <option value="CHECKED">Sudah Diceklis (Tampil di Slip Gaji)</option>
            <option value="UNCHECKED">Belum Diceklis (Disembunyikan)</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          >
            <option value="ALL">Semua Status Pembayaran</option>
            <option value="Belum Cair">Belum Cair</option>
            <option value="Sudah Dibayar">Sudah Dibayar</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleCheckAllEligible(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ceklis Semua yang Berhak</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleCheckAllEligible(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 text-slate-500" />
            <span>Hapus Semua Ceklis</span>
          </button>
        </div>
      </div>

      {/* Main THR Calculation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Daftar Perhitungan &amp; Aktivasi Slip THR Karyawan ({filteredRows.length} Karyawan)
            </h2>
            <p className="text-[11px] text-slate-500">
              Acuan Tanggal Hari Raya: <strong>{formatIndoDate(selectedHolidayDate)}</strong> ({selectedHolidayName}) • Periode Slip: <strong>{selectedPeriodMonth}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Karyawan yang <strong>belum diceklis</strong> tidak akan melihat baris THR di Slip Gaji maupun Portal Karyawan.
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-3 text-center w-[130px]">
                  Tampilkan &amp; Cairkan di Slip Gaji
                </th>
                <th className="py-3 px-3">Karyawan &amp; Status</th>
                <th className="py-3 px-3">Tgl Masuk &amp; Masa Kerja</th>
                <th className="py-3 px-3 text-right">Dasar Perhitungan Upah</th>
                <th className="py-3 px-3 text-right">THR Terhitung Otomatis</th>
                <th className="py-3 px-3">Penyesuaian / Bonus THR Manual</th>
                <th className="py-3 px-3 text-right">Total THR Akhir</th>
                <th className="py-3 px-3 text-center">Status Pembayaran</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.map((row) => {
                const isPartTime = row.employment_type === 'Part-Time';
                const isIneligible =
                  row.eligibility_status === 'Belum Berhak THR' && row.total_thr_amount <= 0;
                const isSavingThis = savingEmpId === row.employee_id;
                const draftAdjValue =
                  manualAdjustmentsDraft[row.employee_id] !== undefined
                    ? manualAdjustmentsDraft[row.employee_id]
                    : String(row.manual_adjustment_amount || 0);
                const draftNoteValue =
                  notesDraft[row.employee_id] !== undefined
                    ? notesDraft[row.employee_id]
                    : row.notes || '';

                return (
                  <tr
                    key={row.employee_id}
                    className={`transition-colors ${
                      row.show_in_payslip
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Kolom 1: Checkbox Aktivasi Slip Gaji */}
                    <td className="py-3 px-3 text-center">
                      <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(row.show_in_payslip)}
                          disabled={isSavingThis}
                          onChange={() => handleToggleShowInPayslip(row)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            row.show_in_payslip
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {row.show_in_payslip ? 'Tampil di Slip' : 'Sembunyi'}
                        </span>
                      </label>
                    </td>

                    {/* Kolom 2: Karyawan & Status */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{row.employee_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {row.employee_nik} • {row.department}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isPartTime
                              ? 'bg-orange-50 text-orange-800 border-orange-200'
                              : row.employment_type.includes('PKWTT')
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}
                        >
                          {row.employment_type}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                          {row.role}
                        </span>
                      </div>
                    </td>

                    {/* Kolom 3: Masa Kerja Otomatis & Kelayakan */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{row.tenure_label}</div>
                      <div className="text-[10px] text-slate-500">
                        Masuk: <span className="font-mono">{row.join_date}</span>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            row.eligibility_status === 'Berhak Penuh (100%)'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : row.eligibility_status === 'Berhak Proporsional'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {row.eligibility_status}
                        </span>
                      </div>
                    </td>

                    {/* Kolom 4: Dasar Perhitungan Upah */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono font-bold text-slate-900">
                        {formatRupiah(row.calculation_basis_amount)}
                      </div>
                      {!isPartTime ? (
                        <div className="text-[10px] text-slate-500">
                          Pokok {formatRupiah(row.base_salary_component)} + Tunj. Tetap{' '}
                          {formatRupiah(row.fixed_allowance_component)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-orange-700 font-medium">
                          Rata-rata Pendapatan Bulanan Part-Time
                        </div>
                      )}
                      <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                        {row.proportion_formula}
                      </div>
                    </td>

                    {/* Kolom 5: Nominal THR Terhitung Otomatis */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {isIneligible && row.calculated_thr_amount === 0 ? (
                        <span className="text-rose-600 font-semibold">Rp 0 (Belum Berhak)</span>
                      ) : (
                        formatRupiah(row.calculated_thr_amount)
                      )}
                    </td>

                    {/* Kolom 6: Penyesuaian / Bonus Tambahan THR Manual */}
                    <td className="py-3 px-3 min-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="10000"
                          value={draftAdjValue}
                          onChange={(e) =>
                            setManualAdjustmentsDraft((prev) => ({
                              ...prev,
                              [row.employee_id]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-right font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveManualAdjustment(row)}
                          disabled={isSavingThis}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold cursor-pointer shrink-0"
                          title="Simpan penyesuaian manual THR"
                        >
                          Simpan
                        </button>
                      </div>
                      <input
                        type="text"
                        value={draftNoteValue}
                        onChange={(e) =>
                          setNotesDraft((prev) => ({
                            ...prev,
                            [row.employee_id]: e.target.value,
                          }))
                        }
                        placeholder="Catatan tambahan THR (opsional)..."
                        className="mt-1.5 w-full px-2 py-1 rounded border border-slate-200 text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Kolom 7: Total THR Akhir */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono font-extrabold text-sm text-emerald-800">
                        {formatRupiah(row.total_thr_amount)}
                      </div>
                      {row.manual_adjustment_amount !== 0 && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Penyesuaian: {row.manual_adjustment_amount > 0 ? '+' : ''}
                          {formatRupiah(row.manual_adjustment_amount)}
                        </div>
                      )}
                    </td>

                    {/* Kolom 8: Status Pembayaran */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          row.payment_status === 'Sudah Dibayar'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {row.payment_status === 'Sudah Dibayar' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        <span>{row.payment_status}</span>
                      </span>
                      {Boolean(row.paid_at) && row.payment_status === 'Sudah Dibayar' && (
                        <div className="text-[9px] text-slate-400 mt-1 font-mono">
                          {new Date(row.paid_at!).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </td>

                    {/* Kolom 9: Aksi Per Karyawan */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePaymentStatus(row)}
                          disabled={isSavingThis || row.total_thr_amount <= 0}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 ${
                            row.payment_status === 'Sudah Dibayar'
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          }`}
                        >
                          {row.payment_status === 'Sudah Dibayar' ? (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>Batalkan Bayar</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Tandai Sudah Dibayar</span>
                            </>
                          )}
                        </button>

                        {onOpenPayslipByEmployeeId && !isPartTime && (
                          <button
                            type="button"
                            onClick={() => onOpenPayslipByEmployeeId(row.employee_id)}
                            className="w-full px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            title="Buka Slip Gaji Resmi Karyawan"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Lihat Slip Gaji</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    Tidak ada karyawan yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
