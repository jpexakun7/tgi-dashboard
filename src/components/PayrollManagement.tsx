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
} from 'lucide-react';
import { Employee, PayrollRecord, CompanyConfig, PerformanceReview } from '../types';
import {
  formatRupiah,
  formatIndoDate,
  getOvertimeRatePerMinute,
  calculateOvertimePayByMinutes,
  formatOvertimeMinutes,
} from '../utils/formatters';
import { UploadPayrollModal } from './UploadPayrollModal';
import { PayrollReportModal } from './PayrollReportModal';
import { exportPayrollToCSV, exportPayrollToPDF } from '../utils/payrollExporter';

interface PayrollManagementProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  reviews?: PerformanceReview[];
  companyConfig: CompanyConfig;
  onOpenPayslip: (payroll: PayrollRecord) => void;
  onRecalculatePayroll: () => void;
  onUpdatePayrollRecord: (record: PayrollRecord) => void;
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
  onApplyImportedPayroll,
  onNavigateToPerformanceReview,
  onApplyBonusToPayroll,
  onBatchApplyBonusesToPayroll,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [editingBonusRecord, setEditingBonusRecord] = useState<PayrollRecord | null>(null);
  const [bonusInput, setBonusInput] = useState<number>(0);
  const [overtimeMinutesInput, setOvertimeMinutesInput] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

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

  // Aggregates
  const totalBaseSalary = payrolls.reduce((acc, curr) => acc + curr.baseSalary, 0);
  const totalAllowances = payrolls.reduce(
    (acc, curr) =>
      acc +
      curr.allowancePosition +
      curr.allowanceTransport +
      curr.allowanceMeal +
      curr.allowanceCommunication,
    0
  );
  const totalOvertime = payrolls.reduce((acc, curr) => acc + curr.overtimePay, 0);
  const totalBonus = payrolls.reduce((acc, curr) => acc + curr.bonus, 0);
  const totalGross = payrolls.reduce((acc, curr) => acc + curr.totalGrossSalary, 0);
  const totalDeductions = payrolls.reduce((acc, curr) => acc + curr.totalDeductions, 0);
  const totalTakeHomePay = payrolls.reduce((acc, curr) => acc + curr.takeHomePay, 0);
  const totalPph21 = payrolls.reduce((acc, curr) => acc + curr.pph21TER, 0);

  // Bank Transfer File Export (Format BCA Payroll CSV / Mandiri MCM)
  const handleDownloadBankTransferCSV = (bankType: 'BCA' | 'Mandiri') => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (bankType === 'BCA') {
      // Standard Format BCA Internet Banking CSV (Payroll)
      headers = ['No Rekening Penerima', 'Nama Penerima', 'Nominal Transfer', 'Berita / Referensi', 'Email Karyawan'];
      rows = payrolls.map((p) => {
        const emp = employees.find((e) => e.id === p.employeeId);
        return [
          `'${emp?.bankAccountNumber || ''}`,
          `"${emp?.bankAccountHolder || emp?.fullName || ''}"`,
          p.takeHomePay,
          `"Gaji ${p.period} TGI"`,
          emp?.email || '',
        ];
      });
    } else {
      // Mandiri Cash Management format
      headers = ['Beneficiary Account', 'Beneficiary Name', 'Amount', 'Remark 1', 'Email Notification'];
      rows = payrolls.map((p) => {
        const emp = employees.find((e) => e.id === p.employeeId);
        return [
          `'${emp?.bankAccountNumber || ''}`,
          `"${emp?.bankAccountHolder || emp?.fullName || ''}"`,
          p.takeHomePay,
          `"GAJI ${companyConfig.companyName.toUpperCase()} ${p.period}"`,
          emp?.email || '',
        ];
      });
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TGI_Format_Transfer_${bankType}_${companyConfig.currentPayrollPeriod.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`File format transfer ${bankType} berhasil diunduh!`);
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

  const filteredPayrolls = payrolls.filter((p) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    if (!emp) return false;

    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.nik.toLowerCase().includes(search.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(search.toLowerCase());

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <WalletCards className="w-6 h-6 text-emerald-600" />
            Penggajian (Payroll) & Slip Gaji
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola proses payroll bulanan, kalkulasi otomatis PPh 21 TER, BPJS, dan cetak slip gaji.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tarik Bonus dari Penilaian Kinerja */}
          <button
            onClick={handleSyncAllBonusesFromPerformance}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Tarik rekomendasi bonus semua staf dari penilaian kinerja secara otomatis"
          >
            <Award className="w-4 h-4 text-yellow-300" />
            <span>Tarik Bonus dari Review</span>
          </button>

          {/* Upload Excel / CSV Payroll */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Import data gaji dari file Excel atau CSV"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Upload Payroll</span>
          </button>

          {/* Ekspor CSV Laporan Payroll */}
          <button
            onClick={() => handleExportCSV(payrolls)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shadow-emerald-600/30"
            title="Unduh seluruh data payroll bulanan ke format CSV (Excel-Compatible)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          {/* Ekspor PDF Laporan Resmi */}
          <button
            onClick={() => handleExportPDF(payrolls)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shadow-slate-900/30"
            title="Unduh dokumen rekapitulasi penggajian resmi format PDF A4 Landscape"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Ekspor PDF</span>
          </button>

          {/* Dropdown Menu Ekspor Lengkap & Transfer Bank */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Menu format ekspor lainnya dan transfer bank"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Opsi Ekspor</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Format Laporan Payroll
                  </span>
                </div>
                <button
                  onClick={() => handleExportCSV(payrolls)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="block font-semibold">Laporan Payroll (CSV)</span>
                    <span className="text-[10px] text-slate-400">Format tabel lengkap untuk Microsoft Excel</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExportPDF(payrolls)}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="block font-semibold">Rekapitulasi Resmi (PDF)</span>
                    <span className="text-[10px] text-slate-400">Dokumen A4 Landscape siap cetak/ttd</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="block font-semibold">Pratinjau Cetak Dokumen</span>
                    <span className="text-[10px] text-slate-400">Tinjau di layar sebelum dicetak</span>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Format Transfer Bank
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadBankTransferCSV('BCA');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Format KlikBCA Bisnis (CSV)</span>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadBankTransferCSV('Mandiri');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Format Mandiri MCM (CSV)</span>
                </button>
              </div>
            )}
          </div>

          {/* Hitung Ulang Payroll */}
          <button
            onClick={() => {
              onRecalculatePayroll();
              showToast('Perhitungan payroll berhasil diperbarui!');
            }}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-700/20"
          >
            <Calculator className="w-4 h-4" />
            <span>Hitung Ulang</span>
          </button>
        </div>
      </div>

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
              Untuk {payrolls.length} Karyawan Aktif {companyConfig.companyName} • Periode {companyConfig.currentPayrollPeriod}
            </p>
          </div>
          <div className="bg-emerald-950/60 px-4 py-3 rounded-xl border border-emerald-600/40 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">Status Payroll: Lunas & Terverifikasi</span>
            </div>
            <p className="text-[11px] text-emerald-300 mt-1">
              Jadwal Pencairan: 28 {companyConfig.currentPayrollPeriod}
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
            <span className="text-emerald-200 block text-[11px]">Total Potongan</span>
            <span className="font-bold text-sm text-rose-200">({formatRupiah(totalDeductions)})</span>
          </div>
        </div>
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
            <option value="ALL">Semua Departemen</option>
            <option value="Teknologi & IT">Teknologi & IT</option>
            <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
            <option value="Operasional">Operasional</option>
            <option value="Human Resources & GA">Human Resources & GA</option>
            <option value="Pemasaran & Bisnis">Pemasaran & Bisnis</option>
            <option value="Layanan Pelanggan">Layanan Pelanggan</option>
          </select>

          {/* Quick CSV Export */}
          <button
            onClick={() => handleExportCSV(filteredPayrolls)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Unduh data terfilter ke format CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>

          {/* Quick PDF Export */}
          <button
            onClick={() => handleExportPDF(filteredPayrolls)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Unduh data terfilter ke format PDF resmi"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor PDF</span>
          </button>

          {/* Quick Print Preview */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Pratinjau lembar cetak laporan gaji"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Pratinjau</span>
          </button>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Gaji Pokok</th>
                <th className="py-3 px-4">Tunjangan</th>
                <th className="py-3 px-4">Lembur & Bonus</th>
                <th className="py-3 px-4">Potongan (Pajak + BPJS)</th>
                <th className="py-3 px-4">Gaji Bersih (THP)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayrolls.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId);
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
                      <div className="flex items-center gap-3">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <span className="font-semibold text-slate-900 block text-xs">
                            {emp?.fullName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {emp?.role} • {emp?.bankName} ({emp?.bankAccountNumber})
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {formatRupiah(record.baseSalary)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 block">
                        {formatRupiah(totalTunjangan)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Jabatan, Transport, Makan
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
                      <span className="font-medium text-rose-600 block">
                        ({formatRupiah(record.totalDeductions)})
                      </span>
                      <span className="text-[10px] text-slate-400">
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        {record.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {hasPendingBonus && (
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
                          onClick={() => onOpenPayslip(record)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Slip Gaji
                        </button>
                        <button
                          title="Sesuaikan Bonus / Lembur"
                          onClick={() => handleOpenEditBonus(record)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
    </div>
  );
};
