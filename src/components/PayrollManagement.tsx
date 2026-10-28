import React, { useState } from 'react';
import {
  WalletCards,
  FileSpreadsheet,
  Printer,
  Download,
  Upload,
  Calculator,
  CheckCircle,
  Clock,
  Eye,
  Edit3,
  Search,
  Filter,
  AlertTriangle,
  Building2,
  Send,
  Sparkles,
  Award,
  FileText,
  ChevronDown,
  Settings2,
  MessageCircle,
  Mail,
  Copy,
  X,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  ShieldCheck,
  PenTool,
} from 'lucide-react';
import {
  Employee,
  PayrollRecord,
  AttendanceRecord,
  CompanyConfig,
  PerformanceReview,
  AttendancePenaltyPolicy,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  getOvertimeRatePerMinute,
  calculateOvertimePayByMinutes,
  formatOvertimeMinutes,
  getAttendancePenaltyPolicy,
  evaluateBankAccountValidity,
  formatBankTransferRemark,
  AVAILABLE_PAYROLL_PERIODS,
} from '../utils/formatters';
import {
  getPayslipWhatsAppUrl,
  getPayslipEmailUrl,
  buildBroadcastPayslipWaMessage,
  getBroadcastPayslipWhatsAppUrl,
  formatWhatsAppPhone,
} from '../utils/notificationHelper';
import { UploadPayrollModal } from './UploadPayrollModal';
import { PayrollReportModal } from './PayrollReportModal';
import { SignatoryConfigModal } from './SignatoryConfigModal';
import { exportPayrollToCSV, exportPayrollToPDF } from '../utils/payrollExporter';

interface PayrollManagementProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  attendances?: AttendanceRecord[];
  reviews?: PerformanceReview[];
  companyConfig: CompanyConfig;
  onOpenPayslip: (payroll: PayrollRecord) => void;
  onRecalculatePayroll: () => void;
  onUpdatePayrollRecord: (record: PayrollRecord) => void;
  onUpdatePenaltyPolicy?: (newPolicy: AttendancePenaltyPolicy) => void;
  onChangePayrollPeriod?: (newPeriod: string) => void;
  onToggleLockPayrollPeriod?: (periodToToggle?: string) => void;
  onToggleWaiveLatePenalty?: (employeeId: string, reason?: string) => void;
  onApplyImportedPayroll?: (updatedPayrolls: PayrollRecord[]) => void;
  onNavigateToPerformanceReview?: () => void;
  onApplyBonusToPayroll?: (review: PerformanceReview) => void;
  onBatchApplyBonusesToPayroll?: (reviewsToApply: PerformanceReview[]) => void;
}

export const PayrollManagement: React.FC<PayrollManagementProps> = ({
  employees,
  payrolls,
  reviews = [],
  companyConfig,
  onOpenPayslip,
  onRecalculatePayroll,
  onUpdatePayrollRecord,
  onUpdatePenaltyPolicy,
  onChangePayrollPeriod,
  onToggleLockPayrollPeriod,
  onToggleWaiveLatePenalty,
  onApplyImportedPayroll,
  onNavigateToPerformanceReview,
  onApplyBonusToPayroll,
  onBatchApplyBonusesToPayroll,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isPenaltyConfigOpen, setIsPenaltyConfigOpen] = useState(false);

  const isCurrentPeriodLocked = Boolean(
    (companyConfig.lockedPayrollPeriods || []).includes(companyConfig.currentPayrollPeriod) ||
      payrolls.some((p) => p.period === companyConfig.currentPayrollPeriod && p.isLocked)
  );

  const availablePeriods = React.useMemo(() => {
    const list = [...AVAILABLE_PAYROLL_PERIODS];
    if (
      companyConfig.currentPayrollPeriod &&
      !list.includes(companyConfig.currentPayrollPeriod)
    ) {
      list.unshift(companyConfig.currentPayrollPeriod);
    }
    return list;
  }, [companyConfig.currentPayrollPeriod]);

  const penaltyPolicy = getAttendancePenaltyPolicy(companyConfig.attendancePenaltyPolicy);
  const handleUpdatePolicy = (patch: Partial<AttendancePenaltyPolicy>) => {
    if (isCurrentPeriodLocked) {
      showToast(
        `Periode Payroll ${companyConfig.currentPayrollPeriod} sedang terkunci. Buka kunci terlebih dahulu untuk mengubah aturan denda.`
      );
      return;
    }
    onUpdatePenaltyPolicy?.({
      ...penaltyPolicy,
      ...patch,
    });
  };
  const [editingBonusRecord, setEditingBonusRecord] = useState<PayrollRecord | null>(null);
  const [bonusInput, setBonusInput] = useState<number>(0);
  const [overtimeMinutesInput, setOvertimeMinutesInput] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSignatoryConfigModalOpen, setIsSignatoryConfigModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync all bonuses from Performance Reviews automatically
  const handleSyncAllBonusesFromPerformance = () => {
    if (!reviews || reviews.length === 0) {
      showToast('Belum ada data penilaian kinerja untuk disinkronkan.');
      return;
    }

    if (onBatchApplyBonusesToPayroll) {
      onBatchApplyBonusesToPayroll(reviews);
      showToast('Berhasil menarik dan menyinkronkan seluruh bonus kinerja ke payroll & audit log!');
      return;
    }

    let updatedCount = 0;
    let totalBonusAdded = 0;

    const updatedPayrolls = payrolls.map((record) => {
      const matchingReview =
        reviews.find(
          (r) =>
            r.employeeId === record.employeeId &&
            (r.period === record.period || r.period === companyConfig.currentPayrollPeriod)
        ) || reviews.find((r) => r.employeeId === record.employeeId);

      if (matchingReview && matchingReview.recommendedBonus !== undefined) {
        const newBonus = matchingReview.recommendedBonus;
        const newGross =
          record.baseSalary +
          record.allowancePosition +
          record.allowanceTransport +
          record.allowanceMeal +
          record.allowanceCommunication +
          record.overtimePay +
          newBonus;
        const newTHP = Math.max(0, newGross - record.totalDeductions);

        updatedCount++;
        totalBonusAdded += newBonus;

        return {
          ...record,
          bonus: newBonus,
          totalGrossSalary: newGross,
          takeHomePay: newTHP,
        };
      }
      return record;
    });

    if (onApplyImportedPayroll) {
      onApplyImportedPayroll(updatedPayrolls);
    } else {
      updatedPayrolls.forEach((u) => onUpdatePayrollRecord(u));
    }

    showToast(`Berhasil menarik ${updatedCount} bonus kinerja (Total: ${formatRupiah(totalBonusAdded)}) ke payroll!`);
  };

  // Only aggregate payrolls for employees that currently exist in the active directory
  const validPayrolls = payrolls.filter((p) =>
    employees.some((e) => e.id === p.employeeId && e.isActive !== false)
  );

  // Aggregates
  const totalBaseSalary = validPayrolls.reduce((acc, curr) => acc + curr.baseSalary, 0);
  const totalAllowances = validPayrolls.reduce(
    (acc, curr) =>
      acc +
      curr.allowancePosition +
      curr.allowanceTransport +
      curr.allowanceMeal +
      curr.allowanceCommunication,
    0
  );
  const totalOvertime = validPayrolls.reduce((acc, curr) => acc + curr.overtimePay, 0);
  const totalBonus = validPayrolls.reduce((acc, curr) => acc + curr.bonus, 0);
  const totalGross = validPayrolls.reduce((acc, curr) => acc + curr.totalGrossSalary, 0);
  const totalDeductions = validPayrolls.reduce((acc, curr) => acc + curr.totalDeductions, 0);
  const totalLateAndAlphaDeductions = validPayrolls.reduce(
    (acc, curr) => acc + (curr.lateDeduction || 0),
    0
  );
  const totalTakeHomePay = validPayrolls.reduce((acc, curr) => acc + curr.takeHomePay, 0);
  const totalPph21 = validPayrolls.reduce((acc, curr) => acc + curr.pph21TER, 0);

  // Bank Transfer File Export (Format Transfer Bank KlikBCA Bisnis / Mandiri MCM CSV)
  // Kolom wajib: No Rekening, Nama Pemilik Rekening, Bank, Nominal THP Bersih, Berita Transfer ("Gaji Okt 2026 PT TGI")
  const handleDownloadBankTransferCSV = (bankType: 'BCA_MANDIRI' | 'BCA' | 'Mandiri' = 'BCA_MANDIRI') => {
    const headers = [
      'No Rekening',
      'Nama Pemilik Rekening',
      'Bank',
      'Nominal THP Bersih',
      'Berita Transfer',
    ];

    const targetRecords = validPayrolls.filter((p) => {
      const emp = employees.find((e) => e.id === p.employeeId);
      if (!emp) return false;
      if (bankType === 'BCA') return emp.bankName === 'BCA';
      if (bankType === 'Mandiri') return emp.bankName === 'Mandiri';
      return true;
    });

    const recordsToUse = targetRecords.length > 0 ? targetRecords : validPayrolls;

    const rows = recordsToUse.map((p) => {
      const emp = employees.find((e) => e.id === p.employeeId);
      const beritaTransfer = formatBankTransferRemark(
        p.period || companyConfig.currentPayrollPeriod,
        'PT TGI'
      );
      return [
        `'${emp?.bankAccountNumber || ''}`,
        `"${(emp?.bankAccountHolder || emp?.fullName || '').replace(/"/g, '""')}"`,
        `"${emp?.bankName || 'BCA'}"`,
        p.takeHomePay,
        `"${beritaTransfer}"`,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = bankType === 'BCA_MANDIRI' ? 'BCA_Mandiri' : bankType;
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `TGI_Format_Transfer_Bank_${suffix}_${companyConfig.currentPayrollPeriod.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      `Format Transfer Bank (CSV ${
        bankType === 'BCA_MANDIRI' ? 'BCA/Mandiri' : bankType
      }) untuk ${recordsToUse.length} karyawan berhasil diunduh!`
    );
  };

  // Toggle Dispensasi / Bebaskan Denda Keterlambatan per Karyawan
  const handleToggleDispensasiRow = (record: PayrollRecord) => {
    if (isCurrentPeriodLocked) {
      showToast(
        `Periode ${companyConfig.currentPayrollPeriod} sedang terkunci! Buka kunci payroll terlebih dahulu untuk mengubah dispensasi denda.`
      );
      return;
    }

    const emp = employees.find((e) => e.id === record.employeeId);
    const nextWaived = !record.isLateFeeWaived;

    if (onToggleWaiveLatePenalty) {
      onToggleWaiveLatePenalty(record.employeeId, 'Dispensasi Tugas Luar / Kebijakan HR');
      showToast(
        nextWaived
          ? `Dispensasi Denda diberikan untuk ${emp?.fullName || record.employeeId}! Potongan keterlambatan menjadi Rp 0 (Log absensi tetap tersimpan).`
          : `Dispensasi Denda untuk ${emp?.fullName || record.employeeId} dibatalkan.`
      );
      return;
    }

    // Fallback direct record update if prop not supplied
    const origPenalty =
      record.originalLateDeduction !== undefined
        ? record.originalLateDeduction
        : record.lateDeduction;
    const newLateDeduction = nextWaived ? 0 : origPenalty;
    const otherDed =
      record.bpjsKesehatanEmployee +
      record.bpjsJhtEmployee +
      record.bpjsJpEmployee +
      record.pph21TER +
      (record.cashAdvanceDeduction || 0);
    const newTotalDeductions = newLateDeduction + otherDed;
    const newTHP = Math.max(0, record.totalGrossSalary - newTotalDeductions);

    onUpdatePayrollRecord({
      ...record,
      isLateFeeWaived: nextWaived,
      originalLateDeduction: origPenalty,
      lateDeduction: newLateDeduction,
      totalDeductions: newTotalDeductions,
      takeHomePay: newTHP,
      attendanceDeductionNotes: nextWaived
        ? `Dispensasi Denda Absensi (Tugas Luar / HR): Rp 0 (Semula -${formatRupiah(origPenalty)})`
        : undefined,
    });

    showToast(
      nextWaived
        ? `Dispensasi Denda diberikan untuk ${emp?.fullName || record.employeeId}! Potongan menjadi Rp 0.`
        : `Dispensasi Denda untuk ${emp?.fullName || record.employeeId} dibatalkan.`
    );
  };

  // Ekspor Lengkap Data Payroll ke CSV
  const handleExportCSV = (recordsToExport: PayrollRecord[] = filteredPayrolls) => {
    try {
      exportPayrollToCSV(recordsToExport, employees, companyConfig, {
        period: companyConfig.currentPayrollPeriod,
        departmentFilter: selectedDept,
        searchFilter: search,
      });
      showToast(`Berhasil mengunduh Laporan Payroll (${recordsToExport.length} data) ke format CSV!`);
      setIsExportMenuOpen(false);
    } catch (e) {
      console.error('Export CSV error', e);
      showToast('Gagal mengekspor file CSV. Silakan periksa kembali data payroll.');
    }
  };

  // Ekspor Dokumen Resmi Payroll ke PDF (A4 Landscape)
  const handleExportPDF = (recordsToExport: PayrollRecord[] = filteredPayrolls) => {
    try {
      exportPayrollToPDF(recordsToExport, employees, companyConfig, {
        period: companyConfig.currentPayrollPeriod,
        departmentFilter: selectedDept,
        searchFilter: search,
      });
      showToast(`Berhasil mengunduh Laporan Rekapitulasi Gaji (${recordsToExport.length} data) format PDF resmi!`);
      setIsExportMenuOpen(false);
    } catch (e) {
      console.error('Export PDF error', e);
      showToast('Gagal mengekspor file PDF. Silakan coba lagi.');
    }
  };

  const handleOpenEditBonus = (record: PayrollRecord) => {
    setEditingBonusRecord(record);
    setBonusInput(record.bonus);
    const emp = employees.find((e) => e.id === record.employeeId);
    const ratePerMin = record.overtimeRatePerMinute || getOvertimeRatePerMinute(emp, 1.5);
    const currentMins =
      record.overtimeMinutes !== undefined
        ? record.overtimeMinutes
        : Math.round(record.overtimePay / Math.max(100, ratePerMin));
    setOvertimeMinutesInput(currentMins);
  };

  const handleSaveBonus = () => {
    if (!editingBonusRecord) return;
    const emp = employees.find((e) => e.id === editingBonusRecord.employeeId);
    if (!emp) return;

    const ratePerMin = getOvertimeRatePerMinute(emp, companyConfig.defaultOvertimeMultiplier || 1.5);
    const validMinutes = Math.max(0, Math.round(Number(overtimeMinutesInput) || 0));
    const newOvertimePay = calculateOvertimePayByMinutes(
      emp,
      validMinutes,
      companyConfig.defaultOvertimeMultiplier || 1.5
    );
    const newGross =
      editingBonusRecord.baseSalary +
      editingBonusRecord.allowancePosition +
      editingBonusRecord.allowanceTransport +
      editingBonusRecord.allowanceMeal +
      editingBonusRecord.allowanceCommunication +
      newOvertimePay +
      Number(bonusInput);

    const newTHP = Math.max(0, newGross - editingBonusRecord.totalDeductions);

    const updated: PayrollRecord = {
      ...editingBonusRecord,
      bonus: Number(bonusInput),
      overtimePay: newOvertimePay,
      overtimeMinutes: validMinutes,
      overtimeRatePerMinute: ratePerMin,
      totalGrossSalary: newGross,
      takeHomePay: newTHP,
    };

    onUpdatePayrollRecord(updated);
    setEditingBonusRecord(null);
    showToast(`Komponen gaji & lembur (${validMinutes} menit) ${emp.fullName} berhasil diperbarui!`);
  };

  const uniqueDepartments = React.useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((e) => e.department?.trim())
          .filter((d): d is string => Boolean(d))
      )
    );
  }, [employees]);

  const filteredPayrolls = payrolls.filter((p) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    if (!emp) return false;

    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.nik.toLowerCase().includes(search.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(search.toLowerCase());

    const matchDept = selectedDept === 'ALL' || emp.department === selectedDept;

    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 border border-slate-700">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <WalletCards className="w-6 h-6 text-emerald-600" />
              Penggajian (Payroll) &amp; Slip Gaji
            </h1>
            {isCurrentPeriodLocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                Periode Terkunci (THP Final)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                Periode Terbuka
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola proses payroll bulanan, kalkulasi otomatis PPh 21 TER, BPJS, dispensasi denda, dan ekspor transfer bank.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pemilih Periode Bulan Payroll */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
              Periode:
            </span>
            <select
              value={companyConfig.currentPayrollPeriod}
              onChange={(e) => {
                const nextPeriod = e.target.value;
                onChangePayrollPeriod?.(nextPeriod);
                showToast(`Periode Payroll dialihkan ke ${nextPeriod}`);
              }}
              aria-label="Pilih Periode Bulan Payroll"
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer pr-1"
            >
              {availablePeriods.map((periodOption) => (
                <option key={periodOption} value={periodOption}>
                  {periodOption}
                  {(companyConfig.lockedPayrollPeriods || []).includes(periodOption)
                    ? ' 🔒'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tombol Kunci / Finalisasi Payroll Periode Ini */}
          <button
            type="button"
            onClick={() => {
              onToggleLockPayrollPeriod?.(companyConfig.currentPayrollPeriod);
              showToast(
                isCurrentPeriodLocked
                  ? `Kunci Payroll periode ${companyConfig.currentPayrollPeriod} berhasil dibuka kembali.`
                  : `Payroll periode ${companyConfig.currentPayrollPeriod} berhasil dikunci & difinalisasi! Perhitungan THP kini dibekukan.`
              );
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              isCurrentPeriodLocked
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-600'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title={
              isCurrentPeriodLocked
                ? 'Klik untuk membuka kunci periode payroll ini jika diperlukan revisi darurat'
                : 'Kunci dan bekukan perhitungan Take Home Pay (THP) setelah gaji ditransfer agar tidak berubah lagi'
            }
          >
            {isCurrentPeriodLocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Terkunci (Buka Kunci)</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Kunci Payroll Periode Ini</span>
              </>
            )}
          </button>

          {/* Broadcast WA Slip Gaji Terbit */}
          <button
            type="button"
            onClick={() => setIsBroadcastModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Broadcast WhatsApp Pengumuman Slip Gaji Terbit ke seluruh karyawan PT Tas Grosir Import"
          >
            <MessageCircle className="w-4 h-4 text-white" />
            <span>Broadcast WA Slip Gaji Terbit</span>
          </button>

          {/* Tarik Bonus dari Penilaian Kinerja */}
          <button
            type="button"
            onClick={() => {
              if (isCurrentPeriodLocked) {
                showToast(
                  `Periode ${companyConfig.currentPayrollPeriod} sudah dikunci. Buka kunci terlebih dahulu untuk menarik bonus.`
                );
                return;
              }
              handleSyncAllBonusesFromPerformance();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              isCurrentPeriodLocked
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
            }`}
            title="Tarik rekomendasi bonus semua staf dari penilaian kinerja secara otomatis"
          >
            <Award className="w-4 h-4 text-yellow-300" />
            <span>Tarik Bonus dari Review</span>
          </button>

          {/* Upload Excel / CSV Payroll */}
          <button
            type="button"
            onClick={() => {
              if (isCurrentPeriodLocked) {
                showToast(
                  `Periode ${companyConfig.currentPayrollPeriod} sudah dikunci. Buka kunci terlebih dahulu untuk import data.`
                );
                return;
              }
              setIsUploadModalOpen(true);
            }}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Import data gaji dari file Excel atau CSV"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Upload Payroll</span>
          </button>

          {/* Dropdown Menu Ekspor Lengkap & Transfer Bank */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Menu format ekspor laporan dan transfer bank (CSV BCA/Mandiri)"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Opsi Ekspor</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Format Transfer Bank (KlikBCA Bisnis / Mandiri MCM)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadBankTransferCSV('BCA_MANDIRI');
                  }}
                  className="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-emerald-50 hover:text-emerald-950 flex items-start gap-2.5 cursor-pointer bg-emerald-50/40"
                >
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-emerald-900">
                      Unduh Format Transfer Bank (CSV BCA/Mandiri)
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-snug mt-0.5">
                      Kolom: No Rekening, Nama Pemilik Rekening, Bank, Nominal THP Bersih, Berita Transfer (&ldquo;{formatBankTransferRemark(companyConfig.currentPayrollPeriod, 'PT TGI')}&rdquo;)
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadBankTransferCSV('BCA');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Khusus Rekening KlikBCA Bisnis (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadBankTransferCSV('Mandiri');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Khusus Rekening Mandiri MCM (CSV)</span>
                </button>

                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Format Laporan Payroll
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleExportCSV(payrolls)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="block font-semibold">Laporan Payroll Lengkap (CSV)</span>
                    <span className="text-[10px] text-slate-400">Format tabel lengkap untuk Microsoft Excel</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF(payrolls)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="block font-semibold">Rekapitulasi Resmi (PDF)</span>
                    <span className="text-[10px] text-slate-400">Dokumen A4 Landscape siap cetak/ttd</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <span className="block font-semibold">Pratinjau Cetak Dokumen</span>
                    <span className="text-[10px] text-slate-400">Tinjau di layar sebelum dicetak</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsSignatoryConfigModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-indigo-800 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer border-t border-slate-100 mt-1"
                >
                  <PenTool className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="block font-bold">Pengaturan Penandatangan &amp; TTD</span>
                    <span className="text-[10px] text-slate-500">
                      Ubah nama HR, Finance, Direktur, TTD &amp; Stempel
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Tombol Cepat Pengaturan Penandatangan Laporan & Slip Gaji */}
          <button
            type="button"
            onClick={() => setIsSignatoryConfigModalOpen(true)}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Atur Nama Penandatangan (Disiapkan, Diperiksa, Disetujui), Unggah Tanda Tangan & Stempel Perusahaan"
          >
            <PenTool className="w-4 h-4 text-indigo-600" />
            <span>Atur Penandatangan &amp; TTD</span>
          </button>

          {/* Hitung Ulang Payroll */}
          <button
            type="button"
            onClick={() => {
              if (isCurrentPeriodLocked) {
                showToast(
                  `Periode ${companyConfig.currentPayrollPeriod} telah dikunci! Buka kunci terlebih dahulu jika ingin menghitung ulang.`
                );
                return;
              }
              onRecalculatePayroll();
              showToast('Perhitungan payroll berhasil diperbarui!');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md ${
              isCurrentPeriodLocked
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Hitung Ulang</span>
          </button>
        </div>
      </div>

      {/* Banner Status Kunci / Finalisasi Payroll */}
      {isCurrentPeriodLocked && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-amber-950 block">
                Periode Payroll {companyConfig.currentPayrollPeriod} Telah Dikunci / Difinalisasi (Lock Period Aktif)
              </span>
              <span className="text-amber-800">
                Seluruh perhitungan Gaji Bersih (Take Home Pay / THP) untuk periode ini telah dibekukan setelah transfer agar nilai slip gaji tidak berubah lagi meskipun ada perubahan log absensi atau lembur.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onToggleLockPayrollPeriod?.(companyConfig.currentPayrollPeriod);
              showToast(`Kunci Payroll periode ${companyConfig.currentPayrollPeriod} dibuka kembali.`);
            }}
            className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-400 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Buka Kunci Periode</span>
          </button>
        </div>
      )}

      {/* Payroll Summary Stats Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-5 border-b border-emerald-700/60 gap-3">
          <div>
            <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">
              TOTAL ESTIMASI PENGELUARAN GAJI BERSIH (TAKE HOME PAY)
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              {formatRupiah(totalTakeHomePay)}
            </h2>
            <p className="text-xs text-emerald-200 mt-0.5">
              Untuk {validPayrolls.length} Karyawan Aktif {companyConfig.companyName} • Periode {companyConfig.currentPayrollPeriod}
            </p>
          </div>
          <div className="bg-emerald-950/60 px-4 py-3 rounded-xl border border-emerald-600/40 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              {isCurrentPeriodLocked ? (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-amber-300">
                    Status Payroll: Terkunci &amp; Final (Lunas)
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">Status Payroll: Lunas &amp; Terverifikasi</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-emerald-300 mt-1">
              Jadwal Pencairan: 28 {companyConfig.currentPayrollPeriod} • Berita: &ldquo;{formatBankTransferRemark(companyConfig.currentPayrollPeriod, 'PT TGI')}&rdquo;
            </p>
          </div>
        </div>

        {/* Breakdown bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-5 text-xs">
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Total Gaji Pokok</span>
            <span className="font-bold text-sm">{formatRupiah(totalBaseSalary)}</span>
          </div>
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Total Tunjangan</span>
            <span className="font-bold text-sm">{formatRupiah(totalAllowances)}</span>
          </div>
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Total Lembur</span>
            <span className="font-bold text-sm">{formatRupiah(totalOvertime)}</span>
          </div>
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Total Bonus</span>
            <span className="font-bold text-sm">{formatRupiah(totalBonus)}</span>
          </div>
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Total PPh 21 TER</span>
            <span className="font-bold text-sm text-amber-200">{formatRupiah(totalPph21)}</span>
          </div>
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Denda Terlambat &amp; Absen</span>
            <span className="font-bold text-sm text-rose-200">
              ({formatRupiah(totalLateAndAlphaDeductions)})
            </span>
          </div>
          <div className="bg-emerald-700/40 p-2.5 rounded-xl border border-emerald-600/30">
            <span className="text-emerald-200 block text-[11px]">Total Seluruh Potongan</span>
            <span className="font-bold text-sm text-rose-200">({formatRupiah(totalDeductions)})</span>
          </div>
        </div>
      </div>

      {/* Quick Panel: Aturan Denda Keterlambatan & Potongan Absen */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Settings2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white">
                Aturan Denda Keterlambatan &amp; Potongan Absen:
              </span>{' '}
              <span className="text-emerald-300 font-semibold">
                Toleransi {penaltyPolicy.gracePeriodMinutes} mnt •{' '}
                {penaltyPolicy.latePenaltyScheme === 'flat_per_incident'
                  ? `Flat ${formatRupiah(penaltyPolicy.flatLatePenaltyAmount)}/hari terlambat`
                  : penaltyPolicy.latePenaltyScheme === 'per_minute'
                  ? `Berjenjang ${formatRupiah(penaltyPolicy.perMinutePenaltyAmount)}/menit terlambat`
                  : `Potong ${penaltyPolicy.dailyAllowanceCutPercentage}% Tunjangan Harian`}{' '}
                • Alpha:{' '}
                {penaltyPolicy.alphaPenaltyScheme === 'proportional_25'
                  ? `1/${penaltyPolicy.alphaWorkingDaysDivisor} × Gaji Pokok`
                  : `${formatRupiah(penaltyPolicy.fixedAlphaPenaltyAmount)}/hari`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPenaltyConfigOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            {isPenaltyConfigOpen ? 'Tutup Konfigurasi' : 'Kustomisasi Aturan Denda'}
          </button>
        </div>

        {isPenaltyConfigOpen && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">
                1. Toleransi Keterlambatan (Grace Period)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={penaltyPolicy.gracePeriodMinutes}
                  onChange={(e) =>
                    handleUpdatePolicy({
                      gracePeriodMinutes: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
                <span className="text-slate-500">Menit (Default: 15 mnt)</span>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={penaltyPolicy.useShiftGracePeriod}
                  onChange={(e) =>
                    handleUpdatePolicy({ useShiftGracePeriod: e.target.checked })
                  }
                  className="rounded text-emerald-600"
                />
                <span>Ikuti toleransi masing-masing Shift Kerja</span>
              </label>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">2. Skema Denda Terlambat</label>
              <select
                value={penaltyPolicy.latePenaltyScheme}
                onChange={(e) =>
                  handleUpdatePolicy({
                    latePenaltyScheme: e.target
                      .value as AttendancePenaltyPolicy['latePenaltyScheme'],
                  })
                }
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="flat_per_incident">Flat per Kejadian (Rp / Hari Terlambat)</option>
                <option value="per_minute">Per Menit Keterlambatan (Rp / Menit)</option>
                <option value="daily_allowance_cut">Potong Tunjangan Harian / Makan (%)</option>
              </select>
              {penaltyPolicy.latePenaltyScheme === 'flat_per_incident' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Nominal/hari:</span>
                  <input
                    type="number"
                    step={5000}
                    min={0}
                    value={penaltyPolicy.flatLatePenaltyAmount}
                    onChange={(e) =>
                      handleUpdatePolicy({
                        flatLatePenaltyAmount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              )}
              {penaltyPolicy.latePenaltyScheme === 'per_minute' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Tarif/menit:</span>
                  <input
                    type="number"
                    step={500}
                    min={0}
                    value={penaltyPolicy.perMinutePenaltyAmount}
                    onChange={(e) =>
                      handleUpdatePolicy({
                        perMinutePenaltyAmount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              )}
              {penaltyPolicy.latePenaltyScheme === 'daily_allowance_cut' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Potong (%):</span>
                  <input
                    type="number"
                    step={10}
                    min={10}
                    max={100}
                    value={penaltyPolicy.dailyAllowanceCutPercentage}
                    onChange={(e) =>
                      handleUpdatePolicy({
                        dailyAllowanceCutPercentage: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0)
                        ),
                      })
                    }
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">
                3. Potongan Alpha / Mangkir
              </label>
              <select
                value={penaltyPolicy.alphaPenaltyScheme}
                onChange={(e) =>
                  handleUpdatePolicy({
                    alphaPenaltyScheme: e.target
                      .value as AttendancePenaltyPolicy['alphaPenaltyScheme'],
                  })
                }
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="proportional_25">Proporsional (1/25 × Gaji Pokok)</option>
                <option value="fixed_amount">Nominal Tetap per Hari Alpha</option>
              </select>
              {penaltyPolicy.alphaPenaltyScheme === 'fixed_amount' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Nominal/hari:</span>
                  <input
                    type="number"
                    step={25000}
                    min={0}
                    value={penaltyPolicy.fixedAlphaPenaltyAmount}
                    onChange={(e) =>
                      handleUpdatePolicy({
                        fixedAlphaPenaltyAmount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, NIK, atau no referensi slip..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">Semua Departemen ({employees.length})</option>
            {uniqueDepartments.map((dept) => {
              const count = employees.filter((e) => e.department?.trim() === dept).length;
              return (
                <option key={dept} value={dept}>
                  {dept} ({count})
                </option>
              );
            })}
          </select>

          {/* Quick Transfer Bank CSV Export */}
          <button
            type="button"
            onClick={() => handleDownloadBankTransferCSV('BCA_MANDIRI')}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Unduh Format Transfer Bank (CSV BCA/Mandiri) siap upload ke KlikBCA Bisnis / Mandiri MCM"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-700" />
            <span>Unduh Format Transfer Bank (CSV BCA/Mandiri)</span>
          </button>

          {/* Quick CSV Export */}
          <button
            type="button"
            onClick={() => handleExportCSV(filteredPayrolls)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Unduh data terfilter ke format CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>

          {/* Quick PDF Export */}
          <button
            type="button"
            onClick={() => handleExportPDF(filteredPayrolls)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Unduh data terfilter ke format PDF resmi"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor PDF</span>
          </button>

          {/* Quick Print Preview */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Pratinjau lembar cetak laporan gaji"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Pratinjau</span>
          </button>
        </div>
      </div>

      {/* Peringatan Deteksi Rekening Bank Duplikat / Belum Valid */}
      {(() => {
        const invalidAccountEmps = employees.filter(
          (e) => e.isActive !== false && evaluateBankAccountValidity(e, employees).isInvalid
        );
        if (invalidAccountEmps.length === 0) return null;
        return (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950">
                  Peringatan Validasi Rekening Transfer ({invalidAccountEmps.length} Karyawan Perlu Cek):
                </span>{' '}
                <span className="text-amber-800">
                  Ditemukan nomor rekening bank yang duplikat (dipakai &ge; 2 karyawan) atau kurang dari 10 digit pada:{' '}
                  <strong className="font-bold">
                    {invalidAccountEmps
                      .map((e) => `${e.fullName} (${e.bankName} ${e.bankAccountNumber || '-'})`)
                      .join(', ')}
                  </strong>
                  . Mohon verifikasi sebelum mengekspor CSV Transfer Bank.
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payroll Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan &amp; Rekening</th>
                <th className="py-3 px-4">Gaji Pokok &amp; Tunjangan</th>
                <th className="py-3 px-4">Lembur &amp; Bonus</th>
                <th className="py-3 px-4">Potongan Keterlambatan &amp; Absen</th>
                <th className="py-3 px-4">Potongan (Pajak + BPJS)</th>
                <th className="py-3 px-4">Gaji Bersih (THP)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayrolls.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId);
                const bankCheck = evaluateBankAccountValidity(emp, employees);
                const totalTunjangan =
                  record.allowancePosition +
                  record.allowanceTransport +
                  record.allowanceMeal +
                  record.allowanceCommunication;

                const matchingRev =
                  reviews.find(
                    (r) =>
                      r.employeeId === record.employeeId &&
                      (r.period === record.period || r.period === companyConfig.currentPayrollPeriod)
                  ) || reviews.find((r) => r.employeeId === record.employeeId);

                const hasPendingBonus =
                  matchingRev &&
                  matchingRev.recommendedBonus > 0 &&
                  record.bonus !== matchingRev.recommendedBonus;

                return (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-900 block text-xs">
                            {emp?.fullName}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {emp?.role} • {emp?.bankName} ({emp?.bankAccountNumber || '-'})
                          </span>
                          {bankCheck.isInvalid && (
                            <div className="pt-0.5">
                              <span
                                title={bankCheck.detailReason}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold shadow-2xs"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>{bankCheck.badgeLabel}</span>
                              </span>
                              <span className="block text-[9px] text-amber-700 font-medium mt-0.5">
                                {bankCheck.detailReason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">
                        Pokok: {formatRupiah(record.baseSalary)}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Tunjangan: +{formatRupiah(totalTunjangan)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium text-slate-800 block">
                          {formatRupiah(record.overtimePay + record.bonus)}
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          OT: {formatRupiah(record.overtimePay)}{' '}
                          {record.overtimeMinutes ? `(${record.overtimeMinutes} mnt)` : ''} | Bns:{' '}
                          {formatRupiah(record.bonus)}
                        </span>
                        {matchingRev && (
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 border ${
                              record.bonus === matchingRev.recommendedBonus && matchingRev.recommendedBonus > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                            }`}
                            title={`Skor KPI: ${matchingRev.kpiScore}, Skor Akhir: ${matchingRev.finalScore} (Grade ${matchingRev.grade}) • Rekomendasi: ${formatRupiah(matchingRev.recommendedBonus)}`}
                          >
                            <Award className="w-2.5 h-2.5" />
                            KPI {matchingRev.finalScore} ({matchingRev.grade})
                            {record.bonus === matchingRev.recommendedBonus && matchingRev.recommendedBonus > 0 && ' ✓'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        {record.isLateFeeWaived ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                Rp 0 (Dispensasi Denda)
                              </span>
                              {(record.originalLateDeduction || 0) > 0 && (
                                <span className="text-[10px] text-slate-400 line-through font-mono">
                                  -{formatRupiah(record.originalLateDeduction || 0)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {record.lateFrequency || 0}x terlambat ({record.totalLateMinutes || 0} mnt) • Log tetap utuh
                            </span>
                          </div>
                        ) : record.lateDeduction > 0 ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-600 block">
                              -{formatRupiah(record.lateDeduction)}
                            </span>
                            <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block font-semibold">
                              {record.attendanceDeductionNotes ||
                                `Potongan Terlambat ${record.lateFrequency || 1}x / ${
                                  record.totalLateMinutes || 0
                                } mnt: -${formatRupiah(record.lateDeduction)}`}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Rp 0 (Disiplin Penuh)
                          </span>
                        )}

                        {/* Tombol Toggle "Beri Dispensasi" per Baris Karyawan */}
                        <div>
                          <button
                            type="button"
                            disabled={isCurrentPeriodLocked}
                            onClick={() => handleToggleDispensasiRow(record)}
                            title={
                              record.isLateFeeWaived
                                ? 'Klik untuk membatalkan dispensasi dan mengembalikan perhitungan denda keterlambatan'
                                : 'Bebaskan (nol-kan) denda keterlambatan karyawan ini (misal karena tugas luar) tanpa menghapus log absensinya'
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors border cursor-pointer ${
                              isCurrentPeriodLocked
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : record.isLateFeeWaived
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                                : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border-slate-300 hover:border-amber-300'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>
                              {record.isLateFeeWaived
                                ? 'Dispensasi Aktif (Batalkan)'
                                : 'Beri Dispensasi'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-rose-600 block">
                        ({formatRupiah(record.totalDeductions)})
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        PPh 21: {formatRupiah(record.pph21TER)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 text-sm block">
                        {formatRupiah(record.takeHomePay)}
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">
                        Bruto: {formatRupiah(record.totalGrossSalary)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          {record.paymentStatus}
                        </span>
                        {isCurrentPeriodLocked && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {hasPendingBonus && !isCurrentPeriodLocked && (
                          <button
                            type="button"
                            title={`Terapkan Rekomendasi Bonus KPI Rp ${matchingRev.recommendedBonus.toLocaleString('id-ID')} (Grade ${matchingRev.grade})`}
                            onClick={() => {
                              if (onApplyBonusToPayroll) {
                                onApplyBonusToPayroll(matchingRev);
                                showToast(`Bonus KPI Rp ${formatRupiah(matchingRev.recommendedBonus)} diterapkan untuk ${emp?.fullName}!`);
                              } else {
                                const newGross =
                                  record.baseSalary +
                                  totalTunjangan +
                                  record.overtimePay +
                                  matchingRev.recommendedBonus;
                                const newTHP = Math.max(0, newGross - record.totalDeductions);
                                onUpdatePayrollRecord({
                                  ...record,
                                  bonus: matchingRev.recommendedBonus,
                                  totalGrossSalary: newGross,
                                  takeHomePay: newTHP,
                                });
                                showToast(`Bonus KPI Rp ${formatRupiah(matchingRev.recommendedBonus)} diterapkan untuk ${emp?.fullName}!`);
                              }
                            }}
                            className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="hidden xl:inline">Tarik KPI</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenPayslip(record)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Slip Gaji</span>
                        </button>
                        {emp && (
                          <>
                            <a
                              href={getPayslipWhatsAppUrl(emp, record, companyConfig)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() =>
                                showToast(
                                  `Membuka WhatsApp slip gaji ${emp.fullName} (${
                                    formatWhatsAppPhone(emp.phone) || 'Nomor belum diisi'
                                  })...`
                                )
                              }
                              title={`Kirim Notifikasi WA Slip Gaji ke ${emp.fullName} (${
                                emp.phone || 'No HP kosong'
                              })`}
                              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Kirim Notifikasi WA</span>
                            </a>
                            <a
                              href={getPayslipEmailUrl(emp, record, companyConfig)}
                              onClick={() =>
                                showToast(
                                  `Membuka aplikasi Email untuk mengirim slip gaji ke ${
                                    emp.email || emp.fullName
                                  }...`
                                )
                              }
                              title={`Kirim Email Slip Gaji ke ${emp.fullName} (${
                                emp.email || 'Email kosong'
                              })`}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Kirim Email</span>
                            </a>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={isCurrentPeriodLocked}
                          title={
                            isCurrentPeriodLocked
                              ? 'Periode Payroll sedang terkunci'
                              : 'Sesuaikan Bonus / Lembur'
                          }
                          onClick={() => {
                            if (isCurrentPeriodLocked) {
                              showToast(
                                `Periode ${companyConfig.currentPayrollPeriod} sedang terkunci.`
                              );
                              return;
                            }
                            handleOpenEditBonus(record);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isCurrentPeriodLocked
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Bonus / Overtime Modal */}
      {editingBonusRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Penyesuaian Bonus & Lembur (Hitungan Per Menit)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {employees.find((e) => e.id === editingBonusRecord.employeeId)?.fullName}
            </p>

            {/* Performance Review Integration Card */}
            {(() => {
              const activeReview =
                reviews.find(
                  (r) =>
                    r.employeeId === editingBonusRecord.employeeId &&
                    (r.period === editingBonusRecord.period || r.period === companyConfig.currentPayrollPeriod)
                ) || reviews.find((r) => r.employeeId === editingBonusRecord.employeeId);

              if (!activeReview) {
                return (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-[11px] flex items-center justify-between">
                    <span>Belum ada catatan review kinerja untuk karyawan ini.</span>
                    {onNavigateToPerformanceReview && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBonusRecord(null);
                          onNavigateToPerformanceReview();
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                      >
                        Beri Review
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="mt-3 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-950 font-bold">
                      <Award className="w-4 h-4 text-indigo-600" />
                      <span>Review Kinerja ({activeReview.period})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                      Skor {activeReview.finalScore} • Grade {activeReview.grade}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                    <div className="bg-white p-1 rounded-lg border border-indigo-100">
                      <span className="text-slate-400 block text-[9px]">KPI (40%)</span>
                      <span className="font-bold text-slate-800">{activeReview.kpiScore}</span>
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-indigo-100">
                      <span className="text-slate-400 block text-[9px]">Disiplin</span>
                      <span className="font-bold text-slate-800">{activeReview.disciplineScore}</span>
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-indigo-100">
                      <span className="text-slate-400 block text-[9px]">Tim</span>
                      <span className="font-bold text-slate-800">{activeReview.teamworkScore}</span>
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-indigo-100">
                      <span className="text-slate-400 block text-[9px]">Inisiatif</span>
                      <span className="font-bold text-slate-800">{activeReview.initiativeScore}</span>
                    </div>
                  </div>

                  {activeReview.generalFeedback && (
                    <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded-lg border border-indigo-100/70">
                      &ldquo;{activeReview.generalFeedback}&rdquo;
                    </p>
                  )}

                  <div className="pt-2 border-t border-indigo-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Rekomendasi Bonus KPI:</span>
                      <span className="font-bold text-emerald-800 text-xs">
                        {formatRupiah(activeReview.recommendedBonus)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBonusInput(activeReview.recommendedBonus);
                        showToast(`Bonus diset ke ${formatRupiah(activeReview.recommendedBonus)} sesuai review kinerja.`);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-[10px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-yellow-300" />
                      <span>Tarik Rekomendasi Ini</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">
                  Bonus & Insentif Kinerja Terpasang (IDR)
                </label>
                <input
                  type="number"
                  step={50000}
                  value={bonusInput}
                  onChange={(e) => setBonusInput(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-semibold">
                    Total Durasi Lembur Disetujui (Menit)
                  </label>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {formatOvertimeMinutes(overtimeMinutesInput)}
                  </span>
                </div>
                <input
                  type="number"
                  step={1}
                  min={0}
                  value={overtimeMinutesInput}
                  onChange={(e) => setOvertimeMinutesInput(Math.max(0, Number(e.target.value)))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold text-sm"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[0, 30, 60, 90, 120, 180, 240, 300].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOvertimeMinutesInput(preset)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        overtimeMinutesInput === preset
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      {preset} mnt
                    </button>
                  ))}
                </div>
                {(() => {
                  const emp = employees.find((e) => e.id === editingBonusRecord.employeeId);
                  const ratePerMin = getOvertimeRatePerMinute(
                    emp,
                    companyConfig.defaultOvertimeMultiplier || 1.5
                  );
                  const previewPay = calculateOvertimePayByMinutes(
                    emp,
                    overtimeMinutesInput,
                    companyConfig.defaultOvertimeMultiplier || 1.5
                  );
                  return (
                    <div className="mt-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px]">
                      <span className="text-emerald-800">
                        {overtimeMinutesInput} menit × {formatRupiah(ratePerMin)}/menit:
                      </span>
                      <span className="font-bold text-emerald-950">
                        {formatRupiah(previewPay)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setEditingBonusRecord(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveBonus}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl cursor-pointer"
              >
                Simpan & Perbarui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Payroll Modal */}
      <UploadPayrollModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        employees={employees}
        payrolls={payrolls}
        currentPeriod={companyConfig.currentPayrollPeriod}
        onApplyImportedPayroll={(newPayrolls) => {
          if (onApplyImportedPayroll) {
            onApplyImportedPayroll(newPayrolls);
          }
          showToast('Data payroll berhasil diimpor dari file Excel/CSV!');
        }}
      />

      {/* Pratinjau & Ekspor Laporan Gaji Bulanan Modal */}
      <PayrollReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        payrolls={filteredPayrolls}
        allPayrolls={payrolls}
        employees={employees}
        companyConfig={companyConfig}
        selectedDepartment={selectedDept}
      />

      {/* Modal Pengaturan Penandatangan, Tanda Tangan & Stempel */}
      <SignatoryConfigModal
        isOpen={isSignatoryConfigModalOpen}
        onClose={() => setIsSignatoryConfigModalOpen(false)}
        companyConfig={companyConfig}
        employees={employees}
        onSaveConfig={() => {
          showToast(
            'Konfigurasi Penandatangan, Tanda Tangan & Stempel berhasil disimpan untuk Laporan & Slip Gaji!'
          );
        }}
      />

      {/* Modal Broadcast WA Slip Gaji Terbit & Kirim Cepat per Karyawan */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-100 text-green-700">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Broadcast WA Slip Gaji Terbit — {companyConfig.companyName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Periode {companyConfig.currentPayrollPeriod} • {validPayrolls.length} Karyawan Aktif • Total THP:{' '}
                    <strong className="text-emerald-700">{formatRupiah(totalTakeHomePay)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bagian 1: Template Pengumuman Grup WhatsApp Perusahaan */}
            <div className="p-4 bg-green-50/70 border border-green-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-green-950">
                    1. Pengumuman Grup WhatsApp Karyawan ({companyConfig.companyName})
                  </h4>
                  <p className="text-[11px] text-green-800">
                    Bagikan pengumuman resmi ke grup WhatsApp kantor atau salin teks pesan di bawah ini
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const text = buildBroadcastPayslipWaMessage(
                        companyConfig.currentPayrollPeriod,
                        validPayrolls.length,
                        totalTakeHomePay,
                        companyConfig.companyName
                      );
                      navigator.clipboard?.writeText(text);
                      showToast('Teks Broadcast WA berhasil disalin ke clipboard!');
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-green-100 text-green-800 border border-green-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Teks</span>
                  </button>
                  <a
                    href={getBroadcastPayslipWhatsAppUrl(
                      companyConfig.currentPayrollPeriod,
                      validPayrolls.length,
                      totalTakeHomePay,
                      companyConfig.companyName
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Buka WhatsApp Broadcast</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <pre className="p-3 bg-white border border-green-200 rounded-xl text-[11px] text-slate-700 font-sans whitespace-pre-wrap max-h-40 overflow-y-auto">
                {buildBroadcastPayslipWaMessage(
                  companyConfig.currentPayrollPeriod,
                  validPayrolls.length,
                  totalTakeHomePay,
                  companyConfig.companyName
                )}
              </pre>
            </div>

            {/* Bagian 2: Daftar Kirim Notifikasi Rincian Slip Gaji Personal (WA & Email per Karyawan) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">
                  2. Kirim Rincian Slip Gaji Personal per Karyawan ({validPayrolls.length} Orang)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Otomatis konversi nomor 08 → 628
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {validPayrolls.map((rec) => {
                  const emp = employees.find((e) => e.id === rec.employeeId);
                  if (!emp) return null;
                  const formattedWa = formatWhatsAppPhone(emp.phone);
                  return (
                    <div
                      key={rec.id}
                      className="p-3 bg-white hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={emp.avatarUrl}
                          alt={emp.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>{emp.fullName}</span>
                            <span className="text-[10px] font-mono text-slate-500">({emp.nik})</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              THP: {formatRupiah(rec.takeHomePay)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                            <span>
                              WA:{' '}
                              <strong className="font-mono text-slate-700">
                                {formattedWa ? `+${formattedWa}` : 'Belum diisi'}
                              </strong>
                            </span>
                            <span>
                              Email:{' '}
                              <strong className="text-slate-700">{emp.email || 'Belum diisi'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={getPayslipWhatsAppUrl(emp, rec, companyConfig)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Kirim Notifikasi WA</span>
                        </a>
                        <a
                          href={getPayslipEmailUrl(emp, rec, companyConfig)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Kirim Email</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
