import React, { useState, useMemo, useEffect } from 'react';
import { Employee, PayrollDeductionRecord, LeaveRequest, CashAdvance } from '../types';
import {
  formatRupiah,
  formatAccountingRupiah,
  normalizePeriodToYearMonth,
  formatYearMonthToIndo,
  doesEmployeeMatchPayrollDeduction,
  getEmployeeDailySalary,
  getEmployeeHourlyRate,
  getEmployeeStandardDailyHours,
  STANDARD_WORK_HOURS_PER_DAY,
  getApprovedSickLeaveSummaryForPeriod,
  getJakartaYearMonth,
} from '../utils/formatters';
import {
  ShieldAlert,
  WalletCards,
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
  Clock,
  HeartPulse,
  ArrowRight,
  HandCoins,
} from 'lucide-react';

interface PayrollDeductionPanelProps {
  employees: Employee[];
  deductions: PayrollDeductionRecord[];
  leaveRequests: LeaveRequest[];
  cashAdvances?: CashAdvance[];
  currentPayrollPeriod: string;
  onSaveDeduction: (
    payload: Omit<PayrollDeductionRecord, 'id' | 'updated_at' | 'sisa_kasbon_depan'> & {
      id?: string;
      sisa_kasbon_depan?: number;
      updated_at?: string;
    }
  ) => Promise<PayrollDeductionRecord>;
  onDeleteDeduction: (deductionId: string) => Promise<void>;
  onOpenPayslipByEmployeeId?: (employeeId: string) => void;
  onRefreshDeductions?: () => Promise<void>;
}

export const PayrollDeductionPanel: React.FC<PayrollDeductionPanelProps> = ({
  employees,
  deductions,
  leaveRequests,
  cashAdvances = [],
  currentPayrollPeriod,
  onSaveDeduction,
  onDeleteDeduction,
  onOpenPayslipByEmployeeId,
  onRefreshDeductions,
}) => {
  const defaultPeriodYm = useMemo(
    () =>
      normalizePeriodToYearMonth(currentPayrollPeriod) ||
      getJakartaYearMonth(),
    [currentPayrollPeriod]
  );

  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState<string>(defaultPeriodYm);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [editingDeductionId, setEditingDeductionId] = useState<string | null>(null);

  // Bagian 1: Potongan Kehadiran Manual
  const [tanpaKeteranganHari, setTanpaKeteranganHari] = useState<number>(0);
  const [tanpaKeteranganRate, setTanpaKeteranganRate] = useState<number>(0);
  const [izinJamMenit, setIzinJamMenit] = useState<number>(0);
  const [izinJamRate, setIzinJamRate] = useState<number>(0);
  const [izinHariJumlah, setIzinHariJumlah] = useState<number>(0);
  const [izinHariRate, setIzinHariRate] = useState<number>(0);

  // Bagian 2: Manajemen Kasbon (3 Tahap Berurutan)
  const [sisaKasbonLalu, setSisaKasbonLalu] = useState<number>(0);
  const [cicilanKasbonBulanIni, setCicilanKasbonBulanIni] = useState<number>(0);

  // Bagian 3: Potongan Pajak & BPJS (Opsional / Manual, default Rp 0)
  const [bpjsTkManual, setBpjsTkManual] = useState<number>(0);
  const [bpjsKesehatanManual, setBpjsKesehatanManual] = useState<number>(0);
  const [pph21Manual, setPph21Manual] = useState<number>(0);

  const [catatanPotongan, setCatatanPotongan] = useState<string>('');

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

  const periodDeductions = useMemo(() => {
    return deductions.filter(
      (d) => normalizePeriodToYearMonth(d.period_month) === selectedPeriodMonth
    );
  }, [deductions, selectedPeriodMonth]);

  const computeDefaultRatesForEmployee = (emp: Employee | null | undefined) => {
    if (!emp) {
      return { dailyRate: 0, perMinuteRate: 0, defaultSisaKasbon: 0, defaultCicilanKasbon: 0 };
    }
    const stdHours = getEmployeeStandardDailyHours(emp, STANDARD_WORK_HOURS_PER_DAY);
    const hourly = getEmployeeHourlyRate(emp, stdHours, 25);
    const daily = getEmployeeDailySalary(emp, 25, stdHours) || Math.round(hourly * stdHours);
    const perMin = Math.max(0, Math.round(hourly / 60));

    const empActiveCa = cashAdvances.filter(
      (c) =>
        c &&
        c.employeeId === emp.id &&
        (c.status === 'disbursed' || c.status === 'approved')
    );
    const caRemaining = empActiveCa.reduce(
      (sum, c) => sum + Math.max(0, Math.round(Number(c.remainingBalance) || 0)),
      0
    );
    const caInstallment = empActiveCa.reduce(
      (sum, c) => sum + Math.max(0, Math.round(Number(c.monthlyInstallment) || 0)),
      0
    );

    return {
      dailyRate: Math.max(0, Math.round(daily)),
      perMinuteRate: perMin,
      defaultSisaKasbon: caRemaining,
      defaultCicilanKasbon: caRemaining > 0 ? Math.min(caRemaining, caInstallment) : 0,
    };
  };

  const handleSelectEmployeeChange = (empId: string, periodOverride?: string) => {
    const targetPeriod = periodOverride || selectedPeriodMonth;
    setSelectedEmployeeId(empId);
    if (!empId) {
      setEditingDeductionId(null);
      setTanpaKeteranganHari(0);
      setTanpaKeteranganRate(0);
      setIzinJamMenit(0);
      setIzinJamRate(0);
      setIzinHariJumlah(0);
      setIzinHariRate(0);
      setSisaKasbonLalu(0);
      setCicilanKasbonBulanIni(0);
      setBpjsTkManual(0);
      setBpjsKesehatanManual(0);
      setPph21Manual(0);
      setCatatanPotongan('');
      return;
    }

    const empObj = activeEmployees.find((e) => e.id === empId);
    const defaults = computeDefaultRatesForEmployee(empObj);
    const existingDed = deductions.find(
      (d) =>
        normalizePeriodToYearMonth(d.period_month) === targetPeriod &&
        (empObj ? doesEmployeeMatchPayrollDeduction(d, empObj) : d.employee_id === empId)
    );

    if (existingDed) {
      setEditingDeductionId(existingDed.id);
      setTanpaKeteranganHari(Math.max(0, Number(existingDed.tanpa_keterangan_hari) || 0));
      setTanpaKeteranganRate(
        existingDed.tanpa_keterangan_rate > 0
          ? Math.round(existingDed.tanpa_keterangan_rate)
          : defaults.dailyRate
      );
      setIzinJamMenit(Math.max(0, Math.round(Number(existingDed.izin_jam_menit) || 0)));
      setIzinJamRate(
        existingDed.izin_jam_rate > 0
          ? Math.round(existingDed.izin_jam_rate)
          : defaults.perMinuteRate
      );
      setIzinHariJumlah(Math.max(0, Number(existingDed.izin_hari_jumlah) || 0));
      setIzinHariRate(
        existingDed.izin_hari_rate > 0
          ? Math.round(existingDed.izin_hari_rate)
          : defaults.dailyRate
      );
      setSisaKasbonLalu(Math.max(0, Math.round(Number(existingDed.sisa_kasbon_lalu) || 0)));
      setCicilanKasbonBulanIni(
        Math.max(0, Math.round(Number(existingDed.cicilan_kasbon_bulan_ini) || 0))
      );
      setBpjsTkManual(Math.max(0, Math.round(Number(existingDed.bpjs_tk_manual) || 0)));
      setBpjsKesehatanManual(
        Math.max(0, Math.round(Number(existingDed.bpjs_kesehatan_manual) || 0))
      );
      setPph21Manual(Math.max(0, Math.round(Number(existingDed.pph21_manual) || 0)));
      setCatatanPotongan(existingDed.catatan_potongan || '');
    } else {
      setEditingDeductionId(null);
      const empApprovedIzinDays = leaveRequests
        .filter(
          (l) =>
            l &&
            l.employeeId === empId &&
            l.status === 'Disetujui' &&
            l.type === 'Izin Pribadi' &&
            (normalizePeriodToYearMonth(l.startDate) === targetPeriod ||
              normalizePeriodToYearMonth(l.endDate) === targetPeriod)
        )
        .reduce((sum, l) => sum + Math.max(0, Number(l.totalDays) || 0), 0);

      setTanpaKeteranganHari(0);
      setTanpaKeteranganRate(defaults.dailyRate);
      setIzinJamMenit(0);
      setIzinJamRate(defaults.perMinuteRate);
      setIzinHariJumlah(empApprovedIzinDays);
      setIzinHariRate(defaults.dailyRate);
      setSisaKasbonLalu(defaults.defaultSisaKasbon);
      setCicilanKasbonBulanIni(defaults.defaultCicilanKasbon);
      setBpjsTkManual(0);
      setBpjsKesehatanManual(0);
      setPph21Manual(0);
      setCatatanPotongan('');
    }
  };

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === selectedEmployeeId) || null,
    [activeEmployees, selectedEmployeeId]
  );

  // Integrasi Otomatis Data "Sakit" dari Panel Cuti & Izin (Approved)
  const selectedEmployeeSickSummary = useMemo(() => {
    if (!selectedEmployee) {
      return { sickDays: 0, sickRatePerDay: 0, sickDeductionTotal: 0, sickNotes: '' };
    }
    const stdHours = getEmployeeStandardDailyHours(selectedEmployee, STANDARD_WORK_HOURS_PER_DAY);
    const daily =
      tanpaKeteranganRate > 0
        ? tanpaKeteranganRate
        : getEmployeeDailySalary(selectedEmployee, 25, stdHours);
    return getApprovedSickLeaveSummaryForPeriod(
      leaveRequests,
      selectedEmployee,
      selectedPeriodMonth,
      daily
    );
  }, [leaveRequests, selectedEmployee, selectedPeriodMonth, tanpaKeteranganRate]);

  // Live Computed Totals
  const totalPotonganTanpaKeterangan = useMemo(
    () => Math.max(0, Math.round((Number(tanpaKeteranganHari) || 0) * (Number(tanpaKeteranganRate) || 0))),
    [tanpaKeteranganHari, tanpaKeteranganRate]
  );

  const totalPotonganIzinJam = useMemo(
    () => Math.max(0, Math.round((Number(izinJamMenit) || 0) * (Number(izinJamRate) || 0))),
    [izinJamMenit, izinJamRate]
  );

  const totalPotonganIzinHari = useMemo(
    () => Math.max(0, Math.round((Number(izinHariJumlah) || 0) * (Number(izinHariRate) || 0))),
    [izinHariJumlah, izinHariRate]
  );

  const isCicilanExceedingSisa = useMemo(
    () =>
      Number(cicilanKasbonBulanIni) > 0 &&
      Number(cicilanKasbonBulanIni) > Number(sisaKasbonLalu),
    [cicilanKasbonBulanIni, sisaKasbonLalu]
  );

  const validatedCicilanBulanIni = useMemo(() => {
    const raw = Math.max(0, Math.round(Number(cicilanKasbonBulanIni) || 0));
    const sisa = Math.max(0, Math.round(Number(sisaKasbonLalu) || 0));
    return sisa > 0 ? Math.min(sisa, raw) : 0;
  }, [cicilanKasbonBulanIni, sisaKasbonLalu]);

  // Hasil Otomatis Tahap 3: Sisa Kasbon Bulan Depan = Math.max(0, sisa_kasbon_lalu - cicilan_kasbon_bulan_ini)
  const sisaKasbonDepanOtomatis = useMemo(
    () =>
      Math.max(
        0,
        Math.round((Number(sisaKasbonLalu) || 0) - validatedCicilanBulanIni)
      ),
    [sisaKasbonLalu, validatedCicilanBulanIni]
  );

  const totalPotonganBpjsPphManual = useMemo(
    () =>
      Math.max(0, Math.round(Number(bpjsTkManual) || 0)) +
      Math.max(0, Math.round(Number(bpjsKesehatanManual) || 0)) +
      Math.max(0, Math.round(Number(pph21Manual) || 0)),
    [bpjsTkManual, bpjsKesehatanManual, pph21Manual]
  );

  const totalDeductionEffect = useMemo(
    () =>
      totalPotonganTanpaKeterangan +
      totalPotonganIzinJam +
      totalPotonganIzinHari +
      selectedEmployeeSickSummary.sickDeductionTotal +
      validatedCicilanBulanIni +
      totalPotonganBpjsPphManual,
    [
      totalPotonganTanpaKeterangan,
      totalPotonganIzinJam,
      totalPotonganIzinHari,
      selectedEmployeeSickSummary.sickDeductionTotal,
      validatedCicilanBulanIni,
      totalPotonganBpjsPphManual,
    ]
  );

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const resetForm = () => {
    setSelectedEmployeeId('');
    setEditingDeductionId(null);
    setTanpaKeteranganHari(0);
    setTanpaKeteranganRate(0);
    setIzinJamMenit(0);
    setIzinJamRate(0);
    setIzinHariJumlah(0);
    setIzinHariRate(0);
    setSisaKasbonLalu(0);
    setCicilanKasbonBulanIni(0);
    setBpjsTkManual(0);
    setBpjsKesehatanManual(0);
    setPph21Manual(0);
    setCatatanPotongan('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showToast('error', 'Silakan pilih karyawan terlebih dahulu.');
      return;
    }

    if (Number(cicilanKasbonBulanIni) > Number(sisaKasbonLalu)) {
      showToast(
        'error',
        'Nominal Cicilan Kasbon Bulan Ini tidak boleh melebihi Sisa Kasbon Bulan Lalu.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onSaveDeduction({
        id: editingDeductionId || undefined,
        employee_id: selectedEmployee.id,
        employee_nik: selectedEmployee.nik || '-',
        employee_name: selectedEmployee.fullName,
        period_month: selectedPeriodMonth,
        tanpa_keterangan_hari: Math.max(0, Number(tanpaKeteranganHari) || 0),
        tanpa_keterangan_rate: Math.max(0, Math.round(Number(tanpaKeteranganRate) || 0)),
        izin_jam_menit: Math.max(0, Math.round(Number(izinJamMenit) || 0)),
        izin_jam_rate: Math.max(0, Math.round(Number(izinJamRate) || 0)),
        izin_hari_jumlah: Math.max(0, Number(izinHariJumlah) || 0),
        izin_hari_rate: Math.max(0, Math.round(Number(izinHariRate) || 0)),
        sisa_kasbon_lalu: Math.max(0, Math.round(Number(sisaKasbonLalu) || 0)),
        cicilan_kasbon_bulan_ini: validatedCicilanBulanIni,
        sisa_kasbon_depan: sisaKasbonDepanOtomatis,
        bpjs_tk_manual: Math.max(0, Math.round(Number(bpjsTkManual) || 0)),
        bpjs_kesehatan_manual: Math.max(0, Math.round(Number(bpjsKesehatanManual) || 0)),
        pph21_manual: Math.max(0, Math.round(Number(pph21Manual) || 0)),
        catatan_potongan: catatanPotongan.trim(),
        department: selectedEmployee.department,
        role: selectedEmployee.role,
        employment_status:
          selectedEmployee.employmentStatus || selectedEmployee.status || 'PKWT (Kontrak)',
      });

      setEditingDeductionId(saved.id);
      showToast(
        'success',
        `Data Pengurangan & Kasbon untuk ${selectedEmployee.fullName} (${formatYearMonthToIndo(
          selectedPeriodMonth
        )}) berhasil disimpan dan langsung tersinkronisasi 100% ke Slip Gaji!`
      );
    } catch {
      showToast('error', 'Gagal menyimpan data pengurangan & kasbon karyawan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRow = (ded: PayrollDeductionRecord) => {
    const matchedEmp = activeEmployees.find((e) => doesEmployeeMatchPayrollDeduction(ded, e));
    const periodYm = normalizePeriodToYearMonth(ded.period_month) || selectedPeriodMonth;
    setSelectedPeriodMonth(periodYm);
    setSelectedEmployeeId(matchedEmp?.id || ded.employee_id);
    setEditingDeductionId(ded.id);
    setTanpaKeteranganHari(Math.max(0, Number(ded.tanpa_keterangan_hari) || 0));
    setTanpaKeteranganRate(Math.max(0, Math.round(Number(ded.tanpa_keterangan_rate) || 0)));
    setIzinJamMenit(Math.max(0, Math.round(Number(ded.izin_jam_menit) || 0)));
    setIzinJamRate(Math.max(0, Math.round(Number(ded.izin_jam_rate) || 0)));
    setIzinHariJumlah(Math.max(0, Number(ded.izin_hari_jumlah) || 0));
    setIzinHariRate(Math.max(0, Math.round(Number(ded.izin_hari_rate) || 0)));
    setSisaKasbonLalu(Math.max(0, Math.round(Number(ded.sisa_kasbon_lalu) || 0)));
    setCicilanKasbonBulanIni(Math.max(0, Math.round(Number(ded.cicilan_kasbon_bulan_ini) || 0)));
    setBpjsTkManual(Math.max(0, Math.round(Number(ded.bpjs_tk_manual) || 0)));
    setBpjsKesehatanManual(Math.max(0, Math.round(Number(ded.bpjs_kesehatan_manual) || 0)));
    setPph21Manual(Math.max(0, Math.round(Number(ded.pph21_manual) || 0)));
    setCatatanPotongan(ded.catatan_potongan || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRow = async (ded: PayrollDeductionRecord) => {
    await onDeleteDeduction(ded.id);
    if (editingDeductionId === ded.id) {
      resetForm();
    }
    showToast(
      'success',
      `Data pengurangan & kasbon ${ded.employee_name} periode ${formatYearMonthToIndo(
        ded.period_month
      )} telah direset/dihapus.`
    );
  };

  const filteredDeductions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodDeductions.filter((ded) => {
      const emp = activeEmployees.find((e) => doesEmployeeMatchPayrollDeduction(ded, e));
      const dept = ded.department || emp?.department || '';
      if (departmentFilter !== 'ALL' && dept !== departmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (ded.employee_name || '').toLowerCase().includes(q) ||
        (ded.employee_nik || '').toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q) ||
        (ded.catatan_potongan || '').toLowerCase().includes(q)
      );
    });
  }, [periodDeductions, activeEmployees, departmentFilter, searchQuery]);

  const kpiSummary = useMemo(() => {
    let totalAttendanceCut = 0;
    let totalSisaKasbonLalu = 0;
    let totalCicilanBulanIni = 0;
    let totalSisaKasbonDepan = 0;

    for (const ded of periodDeductions) {
      const tk = Math.round(
        (Number(ded.tanpa_keterangan_hari) || 0) * (Number(ded.tanpa_keterangan_rate) || 0)
      );
      const ij = Math.round(
        (Number(ded.izin_jam_menit) || 0) * (Number(ded.izin_jam_rate) || 0)
      );
      const ih = Math.round(
        (Number(ded.izin_hari_jumlah) || 0) * (Number(ded.izin_hari_rate) || 0)
      );
      totalAttendanceCut += tk + ij + ih;
      totalSisaKasbonLalu += Math.max(0, Math.round(Number(ded.sisa_kasbon_lalu) || 0));
      totalCicilanBulanIni += Math.max(0, Math.round(Number(ded.cicilan_kasbon_bulan_ini) || 0));
      totalSisaKasbonDepan += Math.max(0, Math.round(Number(ded.sisa_kasbon_depan) || 0));
    }

    return {
      recordCount: periodDeductions.length,
      totalAttendanceCut,
      totalSisaKasbonLalu,
      totalCicilanBulanIni,
      totalSisaKasbonDepan,
    };
  }, [periodDeductions]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-rose-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
              <span>Sinkronisasi Penuh Bagian &ldquo;3. PENGURANGAN&rdquo; di Slip Gaji A4</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Panel Potongan Absensi (Tanpa Keterangan / Izin / Sakit) &amp; Kasbon Karyawan
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Kelola potongan kehadiran manual (<strong className="text-white">Tanpa Keterangan</strong>
              , <strong className="text-white">Izin Jam/Menit</strong>,{' '}
              <strong className="text-white">Izin Hari</strong>), integrasi otomatis{' '}
              <strong className="text-teal-300">Sakit (Disetujui)</strong>, serta skema{' '}
              <strong className="text-amber-300">3 Tahap Kasbon</strong> (Sisa Bulan Lalu &rarr;
              Cicilan Bulan Ini &rarr; Sisa Bulan Depan).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-rose-300 shrink-0" />
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-rose-200 font-bold">
                  Filter Periode Bulan
                </label>
                <input
                  type="month"
                  value={selectedPeriodMonth}
                  onChange={(e) => {
                    const nextPeriod = e.target.value || defaultPeriodYm;
                    setSelectedPeriodMonth(nextPeriod);
                    if (selectedEmployeeId) {
                      handleSelectEmployeeChange(selectedEmployeeId, nextPeriod);
                    }
                  }}
                  className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {Boolean(onRefreshDeductions) && (
              <button
                type="button"
                onClick={async () => {
                  if (!onRefreshDeductions) return;
                  setIsRefreshing(true);
                  try {
                    await onRefreshDeductions();
                    showToast('success', 'Data potongan & kasbon berhasil disinkronkan ulang.');
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
              Karyawan Tercatat ({formatYearMonthToIndo(selectedPeriodMonth)})
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {kpiSummary.recordCount}{' '}
            <span className="text-xs font-semibold text-slate-500">
              dari {activeEmployees.length} Karyawan
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Potongan Absensi &amp; Izin
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-rose-700 font-mono mt-2">
            {formatRupiah(kpiSummary.totalAttendanceCut)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tanpa Keterangan + Izin Jam + Izin Hari
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Cicilan Kasbon Bulan Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <HandCoins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-amber-700 font-mono mt-2">
            {formatRupiah(kpiSummary.totalCicilanBulanIni)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Memotong Gaji Bersih (Take Home Pay)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Sisa Kasbon Bulan Depan
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <WalletCards className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-indigo-700 font-mono mt-2">
            {formatRupiah(kpiSummary.totalSisaKasbonDepan)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Dari Sisa Bulan Lalu {formatRupiah(kpiSummary.totalSisaKasbonLalu)}
          </p>
        </div>
      </div>

      {/* Main Grid: Form Input (Left) & Live Section 3 Payslip Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
        >
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                {editingDeductionId ? (
                  <Edit3 className="w-4 h-4" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {editingDeductionId
                    ? 'Edit Data Potongan Absensi & Kasbon Karyawan'
                    : 'Form Input Potongan Absensi & Manajemen Kasbon Karyawan'}
                </h2>
                <p className="text-xs text-slate-500">
                  Periode Aktif: <strong>{formatYearMonthToIndo(selectedPeriodMonth)}</strong> (
                  {selectedPeriodMonth})
                </p>
              </div>
            </div>

            {Boolean(selectedEmployeeId || editingDeductionId) && (
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

          <div className="p-6 space-y-6">
            {/* Row 1: Pilih Karyawan & Periode */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Karyawan (Nama, NIK, Divisi, Status) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleSelectEmployeeChange(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {activeEmployees.map((emp) => {
                    const hasDed = periodDeductions.some((d) =>
                      doesEmployeeMatchPayrollDeduction(d, emp)
                    );
                    const statusLabel = emp.employmentStatus || emp.status || 'PKWT';
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} — {emp.nik} ({emp.department || '-'} • {statusLabel})
                        {hasDed ? ' ✓ [Sudah Diatur]' : ''}
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
                  onChange={(e) => {
                    const nextPeriod = e.target.value || defaultPeriodYm;
                    setSelectedPeriodMonth(nextPeriod);
                    if (selectedEmployeeId) {
                      handleSelectEmployeeChange(selectedEmployeeId, nextPeriod);
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Bagian 1: Potongan Kehadiran Manual */}
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-rose-200/70 pb-3">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-rose-950">
                    1. Bagian Potongan Kehadiran Manual (Bagian 3 — Pengurangan)
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Tarif potongan otomatis terisi dari Gaji Harian / Tarif Menit karyawan dan dapat
                    diedit manual.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-rose-700">
                  Subtotal Potongan Kehadiran:{' '}
                  {formatRupiah(
                    totalPotonganTanpaKeterangan + totalPotonganIzinJam + totalPotonganIzinHari
                  )}
                </span>
              </div>

              {/* 1. Tidak Masuk Tanpa Keterangan */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white p-3.5 rounded-xl border border-rose-100">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    1. Tidak Masuk Tanpa Keterangan (Hari)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={31}
                      step={0.5}
                      value={tanpaKeteranganHari}
                      onChange={(e) =>
                        setTanpaKeteranganHari(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Hari
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tarif Potongan per Hari (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={tanpaKeteranganRate}
                      onChange={(e) =>
                        setTanpaKeteranganRate(
                          Math.max(0, Math.round(Number(e.target.value) || 0))
                        )
                      }
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Total Potongan Tanpa Keterangan
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-sm font-mono font-black text-rose-800 flex items-center justify-between">
                    <span>{formatRupiah(totalPotonganTanpaKeterangan)}</span>
                    <span className="text-[10px] font-sans font-semibold text-rose-600">
                      × {tanpaKeteranganHari} Hari
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Izin (Jam / Menit) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white p-3.5 rounded-xl border border-rose-100">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    2. Izin (Jam / Menit) — Total Menit
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={izinJamMenit}
                      onChange={(e) =>
                        setIzinJamMenit(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Menit
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tarif Potongan per Menit (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={izinJamRate}
                      onChange={(e) =>
                        setIzinJamRate(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Total Potongan Izin (Jam)
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-sm font-mono font-black text-rose-800 flex items-center justify-between">
                    <span>{formatRupiah(totalPotonganIzinJam)}</span>
                    <span className="text-[10px] font-sans font-semibold text-rose-600">
                      × {izinJamMenit} Menit
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Izin (Hari) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white p-3.5 rounded-xl border border-rose-100">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    3. Izin (Hari) — Jumlah Hari Izin
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={31}
                      step={0.5}
                      value={izinHariJumlah}
                      onChange={(e) =>
                        setIzinHariJumlah(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Hari
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tarif Potongan per Hari (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={izinHariRate}
                      onChange={(e) =>
                        setIzinHariRate(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Total Potongan Izin (Hari)
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-sm font-mono font-black text-rose-800 flex items-center justify-between">
                    <span>{formatRupiah(totalPotonganIzinHari)}</span>
                    <span className="text-[10px] font-sans font-semibold text-rose-600">
                      × {izinHariJumlah} Hari
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Integrasi Otomatis Baris "Sakit" dari Panel Cuti & Izin */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl bg-teal-50/90 border border-teal-200 text-xs">
                <div className="flex items-center gap-2.5">
                  <HeartPulse className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <span className="font-bold text-teal-950">
                      Baris &ldquo;Sakit&rdquo; (Otomatis Terhubung dari Panel Cuti &amp; Izin —
                      Approved):
                    </span>{' '}
                    <span className="text-teal-800">
                      {selectedEmployee
                        ? `Tercatat × ${selectedEmployeeSickSummary.sickDays} Hari Sakit yang disetujui pada periode ini.`
                        : 'Pilih karyawan untuk melihat jumlah hari Sakit yang disetujui.'}
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-teal-900 shrink-0">
                  Potongan: {formatRupiah(selectedEmployeeSickSummary.sickDeductionTotal)}
                </span>
              </div>
            </div>

            {/* Bagian 2: Manajemen Kasbon (3 Tahap Berurutan) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-amber-200/70 pb-3">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                    2. Bagian Manajemen Kasbon (3 Tahap Berurutan)
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Hanya <strong>Tahap 2 (Cicilan Pembayaran Kasbon Bulan Ini)</strong> yang
                    memotong gaji. Tahap 1 &amp; Tahap 3 tampil sebagai informasi saldo kasbon pada
                    Slip Gaji.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800">
                  Potong Gaji Bulan Ini: {formatRupiah(validatedCicilanBulanIni)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Tahap 1: Sisa Kasbon Bulan Lalu */}
                <div className="md:col-span-4 bg-white p-3.5 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase">
                      Tahap 1 — Input
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">Baris: Kasbon</span>
                  </div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Sisa Kasbon Bulan Lalu (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={sisaKasbonLalu}
                      onChange={(e) => {
                        const nextSisa = Math.max(0, Math.round(Number(e.target.value) || 0));
                        setSisaKasbonLalu(nextSisa);
                        if (cicilanKasbonBulanIni > nextSisa) {
                          setCicilanKasbonBulanIni(nextSisa);
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 italic">
                    Keterangan di Slip: &ldquo;Sisa Kasbon bulan lalu&rdquo; (Total: Rp -)
                  </p>
                </div>

                {/* Tahap 2: Cicilan Pembayaran Kasbon Bulan Ini */}
                <div className="md:col-span-4 bg-white p-3.5 rounded-xl border border-amber-300 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase">
                      Tahap 2 — Dipotong Gaji
                    </span>
                    <span className="text-[10px] text-rose-600 font-bold">
                      Masuk Subtotal Pengurangan
                    </span>
                  </div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Cicilan Pembayaran Kasbon Bulan Ini (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={sisaKasbonLalu > 0 ? sisaKasbonLalu : undefined}
                      step={50000}
                      value={cicilanKasbonBulanIni}
                      onChange={(e) => {
                        const rawVal = Math.max(0, Math.round(Number(e.target.value) || 0));
                        setCicilanKasbonBulanIni(
                          sisaKasbonLalu > 0 ? Math.min(sisaKasbonLalu, rawVal) : 0
                        );
                      }}
                      className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm font-mono font-bold focus:ring-2 ${
                        isCicilanExceedingSisa
                          ? 'border-rose-500 text-rose-700 focus:ring-rose-500'
                          : 'border-slate-300 text-slate-900 focus:ring-amber-500'
                      }`}
                    />
                  </div>
                  {sisaKasbonLalu > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[
                        { label: 'Rp 0', val: 0 },
                        { label: '25%', val: Math.round(sisaKasbonLalu * 0.25) },
                        { label: '50%', val: Math.round(sisaKasbonLalu * 0.5) },
                        { label: 'Lunas 100%', val: sisaKasbonLalu },
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => setCicilanKasbonBulanIni(btn.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            cicilanKasbonBulanIni === btn.val
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tahap 3: Sisa Kasbon Bulan Depan (Read-Only Highlight) */}
                <div className="md:col-span-4 bg-gradient-to-br from-indigo-950 to-slate-900 text-white p-3.5 rounded-xl border border-indigo-500/40 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 text-[10px] font-extrabold uppercase">
                      Tahap 3 — Otomatis
                    </span>
                    <span className="text-[10px] text-indigo-300 font-semibold">Read-Only</span>
                  </div>
                  <label className="block text-xs font-bold text-indigo-100 mb-1.5">
                    Sisa Kasbon Bulan Depan (Rp)
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 font-mono text-base font-black text-emerald-300 flex items-center justify-between">
                    <span>{formatRupiah(sisaKasbonDepanOtomatis)}</span>
                    <ArrowRight className="w-4 h-4 text-indigo-300" />
                  </div>
                  <p className="text-[10px] text-indigo-200/80 mt-1.5">
                    Rumus: {formatRupiah(sisaKasbonLalu)} &minus;{' '}
                    {formatRupiah(validatedCicilanBulanIni)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Potongan Kehadiran / Kasbon (Opsional)
                </label>
                <input
                  type="text"
                  value={catatanPotongan}
                  onChange={(e) => setCatatanPotongan(e.target.value)}
                  placeholder="Contoh: Angsuran Kasbon ke-2 dari 3 • Izin pulang cepat 120 menit tanggal 14 Nov..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Bagian 3: Potongan Pajak & BPJS (Opsional / Manual) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-indigo-200/70 pb-3">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                    3. Potongan Pajak &amp; BPJS (Opsional / Manual)
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Potongan otomatis BPJS &amp; PPh 21 telah dimatikan (Default <strong>Rp 0</strong>
                    ). Hanya nominal yang diinput manual di bawah ini yang akan mengurangi gaji dan
                    tampil pada Slip Gaji.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-800">
                  Subtotal Pajak &amp; BPJS: {formatRupiah(totalPotonganBpjsPphManual)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Input Nominal BPJS Ketenagakerjaan */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Nominal BPJS Ketenagakerjaan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={bpjsTkManual}
                      onChange={(e) =>
                        setBpjsTkManual(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Slip Gaji: <strong>**BPJS Ketenagakerjaan</strong> (Default Rp 0 / Rp -)
                  </p>
                </div>

                {/* Input Nominal BPJS Kesehatan */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Nominal BPJS Kesehatan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={bpjsKesehatanManual}
                      onChange={(e) =>
                        setBpjsKesehatanManual(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Slip Gaji: <strong>**BPJS Kesehatan</strong> (Default Rp 0 / Rp -)
                  </p>
                </div>

                {/* Input Nominal PPh 21 */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Nominal PPh 21 (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={pph21Manual}
                      onChange={(e) =>
                        setPph21Manual(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Slip Gaji: <strong>**PPh 21</strong> (Default Rp 0 / Rp -)
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-600">
                Total Potongan yang Memotong Gaji Bulan Ini:{' '}
                <strong className="font-mono text-rose-700 font-black">
                  -{formatRupiah(totalDeductionEffect)}
                </strong>
              </div>

              <button
                type="submit"
                disabled={isSaving || !selectedEmployeeId || isCicilanExceedingSisa}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Menyimpan...'
                    : editingDeductionId
                    ? 'Perbarui & Sinkronkan Pengurangan'
                    : 'Simpan Data Pengurangan'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Right Side: Live Preview of Section "3. PENGURANGAN" on Official Payslip */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pratinjau &ldquo;3. PENGURANGAN&rdquo; Slip Gaji
              </h3>
              <p className="text-[11px] text-slate-500">
                Tampilan persis pada tabel Slip Gaji A4 (Admin &amp; Portal)
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Karyawan Terpilih
            </p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {selectedEmployee ? selectedEmployee.fullName : 'Belum memilih karyawan'}
            </p>
            <p className="text-[11px] text-slate-500">
              {selectedEmployee
                ? `${selectedEmployee.nik} • ${selectedEmployee.department || '-'}`
                : 'Pilih karyawan pada dropdown di sebelah kiri'}
            </p>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden text-[11px]">
            <div className="bg-rose-50 px-3 py-1.5 font-extrabold text-rose-950 border-b border-slate-300">
              3. PENGURANGAN
            </div>
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">Tanpa Keterangan</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(tanpaKeteranganHari > 0 ? tanpaKeteranganRate : 0)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">× {tanpaKeteranganHari} Hari</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(totalPotonganTanpaKeterangan)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">Izin (Jam)</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(izinJamMenit > 0 ? izinJamRate : 0)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">× {izinJamMenit} Menit</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(totalPotonganIzinJam)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">Izin (Hari)</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(izinHariJumlah > 0 ? izinHariRate : 0)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">× {izinHariJumlah} Hari</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(totalPotonganIzinHari)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">Sakit</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(
                      selectedEmployeeSickSummary.sickDeductionTotal > 0
                        ? selectedEmployeeSickSummary.sickRatePerDay
                        : 0
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">
                    × {selectedEmployeeSickSummary.sickDays} Hari
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(selectedEmployeeSickSummary.sickDeductionTotal)}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-1.5 px-2.5 font-medium text-slate-700">Kasbon</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                    {formatAccountingRupiah(sisaKasbonLalu)}
                  </td>
                  <td className="py-1.5 px-2 italic text-slate-500">Sisa Kasbon bulan lalu</td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-slate-400">Rp -</td>
                </tr>
                <tr className="bg-amber-50/50">
                  <td className="py-1.5 px-2.5 font-semibold text-slate-800">Pembayaran Kasbon</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                    {formatAccountingRupiah(validatedCicilanBulanIni)}
                  </td>
                  <td className="py-1.5 px-2 font-medium text-slate-700">Cicilan bulan ini</td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(validatedCicilanBulanIni)}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-1.5 px-2.5 font-medium text-slate-700">Sisa Kasbon</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                    {formatAccountingRupiah(sisaKasbonDepanOtomatis)}
                  </td>
                  <td className="py-1.5 px-2 italic text-slate-500">Sisa Kasbon bulan depan</td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-slate-400">Rp -</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">
                    **BPJS Ketenagakerjaan
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(bpjsTkManual)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">
                    {bpjsTkManual > 0 ? 'Potongan Manual' : '-'}
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(bpjsTkManual)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">**BPJS Kesehatan</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(bpjsKesehatanManual)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">
                    {bpjsKesehatanManual > 0 ? 'Potongan Manual' : '-'}
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(bpjsKesehatanManual)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800">**PPh 21</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                    {formatAccountingRupiah(pph21Manual)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">
                    {pph21Manual > 0 ? 'Potongan Manual' : '-'}
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(pph21Manual)}
                  </td>
                </tr>
              </tbody>
            </table>
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
              <span>Buka Slip Gaji Resmi {selectedEmployee?.fullName}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabel Rekapitulasi Pengurangan & Kasbon Karyawan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Tabel Rekapitulasi Pengurangan &amp; Kasbon Karyawan — Periode{' '}
              {formatYearMonthToIndo(selectedPeriodMonth)}
            </h3>
            <p className="text-xs text-slate-500">
              Seluruh perubahan langsung tersinkronisasi ke Slip Gaji (Admin &amp; Portal Karyawan)
              tanpa perlu reload halaman.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIK, divisi..."
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500"
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
                <th className="py-3 px-4 text-right">Tanpa Ket.</th>
                <th className="py-3 px-4 text-right">Izin (Jam)</th>
                <th className="py-3 px-4 text-right">Izin (Hari)</th>
                <th className="py-3 px-4 text-center">Sakit (Approved)</th>
                <th className="py-3 px-4 text-right">Sisa Kasbon Lalu</th>
                <th className="py-3 px-4 text-right">Cicilan Bulan Ini</th>
                <th className="py-3 px-4 text-right">Sisa Kasbon Depan</th>
                <th className="py-3 px-4 text-right">BPJS &amp; PPh 21 (Manual)</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDeductions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 px-4 text-center text-slate-500">
                    Belum ada data potongan absensi manual atau kasbon untuk periode{' '}
                    <strong>{formatYearMonthToIndo(selectedPeriodMonth)}</strong>. Silakan pilih
                    karyawan pada form di atas lalu klik <strong>Simpan Data Pengurangan</strong>.
                  </td>
                </tr>
              ) : (
                filteredDeductions.map((ded) => {
                  const empObj = activeEmployees.find((e) =>
                    doesEmployeeMatchPayrollDeduction(ded, e)
                  );
                  const tkTotal = Math.round(
                    (Number(ded.tanpa_keterangan_hari) || 0) *
                      (Number(ded.tanpa_keterangan_rate) || 0)
                  );
                  const ijTotal = Math.round(
                    (Number(ded.izin_jam_menit) || 0) * (Number(ded.izin_jam_rate) || 0)
                  );
                  const ihTotal = Math.round(
                    (Number(ded.izin_hari_jumlah) || 0) * (Number(ded.izin_hari_rate) || 0)
                  );
                  const sickInfo = getApprovedSickLeaveSummaryForPeriod(
                    leaveRequests,
                    empObj || { id: ded.employee_id, nik: ded.employee_nik, fullName: ded.employee_name },
                    ded.period_month,
                    ded.tanpa_keterangan_rate
                  );
                  const bpjsTkVal = Math.max(0, Math.round(Number(ded.bpjs_tk_manual) || 0));
                  const bpjsKesVal = Math.max(
                    0,
                    Math.round(Number(ded.bpjs_kesehatan_manual) || 0)
                  );
                  const pph21Val = Math.max(0, Math.round(Number(ded.pph21_manual) || 0));
                  const totalTaxBpjsRow = bpjsTkVal + bpjsKesVal + pph21Val;

                  return (
                    <tr key={ded.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{ded.employee_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {ded.employee_nik} • {ded.department || empObj?.department || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono font-bold text-rose-700">{formatRupiah(tkTotal)}</p>
                        <p className="text-[10px] text-slate-500">
                          {ded.tanpa_keterangan_hari} Hari × {formatRupiah(ded.tanpa_keterangan_rate)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono font-bold text-rose-700">{formatRupiah(ijTotal)}</p>
                        <p className="text-[10px] text-slate-500">
                          {ded.izin_jam_menit} Mnt × {formatRupiah(ded.izin_jam_rate)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono font-bold text-rose-700">{formatRupiah(ihTotal)}</p>
                        <p className="text-[10px] text-slate-500">
                          {ded.izin_hari_jumlah} Hari × {formatRupiah(ded.izin_hari_rate)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          × {sickInfo.sickDays} Hari
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatRupiah(ded.sisa_kasbon_lalu)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-800">
                        {formatRupiah(ded.cicilan_kasbon_bulan_ini)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                        {formatRupiah(ded.sisa_kasbon_depan)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono font-bold text-indigo-900">
                          {formatRupiah(totalTaxBpjsRow)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          TK: {formatRupiah(bpjsTkVal)} • Kes: {formatRupiah(bpjsKesVal)} • PPh:{' '}
                          {formatRupiah(pph21Val)}
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
                            onClick={() => handleEditRow(ded)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-semibold transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(ded)}
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

export default PayrollDeductionPanel;

