import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  PenTool,
  Stamp,
  Upload,
  Sparkles,
  Check,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Employee,
  PayrollRecord,
  CompanyConfig,
  PayrollSignatoriesConfig,
  SignatoryItemConfig,
} from '../types';
import {
  formatRupiah,
  getPayrollSignatoriesConfig,
  savePayrollSignatoriesConfig,
  generateStylizedSignatureDataUrl,
  generateOfficialCompanyStampDataUrl,
} from '../utils/formatters';
import { exportPayrollToCSV, exportPayrollToPDF } from '../utils/payrollExporter';
import { SignatoryConfigModal } from './SignatoryConfigModal';

interface PayrollReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrolls: PayrollRecord[];
  allPayrolls: PayrollRecord[];
  employees: Employee[];
  companyConfig: CompanyConfig;
  selectedDepartment?: string;
  onUpdateSignatories?: (config: PayrollSignatoriesConfig) => void;
}

export const PayrollReportModal: React.FC<PayrollReportModalProps> = ({
  isOpen,
  onClose,
  payrolls,
  allPayrolls,
  employees,
  companyConfig,
  selectedDepartment = 'ALL',
  onUpdateSignatories,
}) => {
  const [dataScope, setDataScope] = useState<'current_filter' | 'all'>(
    selectedDepartment !== 'ALL' ? 'current_filter' : 'all'
  );
  const [signatories, setSignatories] = useState<PayrollSignatoriesConfig>(() =>
    getPayrollSignatoriesConfig(companyConfig)
  );
  const [isSignatoryModalOpen, setIsSignatoryModalOpen] = useState(false);
  const [isQuickInlineEditorOpen, setIsQuickInlineEditorOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSignatories(getPayrollSignatoriesConfig(companyConfig));
    }
  }, [isOpen, companyConfig]);

  useEffect(() => {
    const handleSync = () => {
      setSignatories(getPayrollSignatoriesConfig(companyConfig));
    };
    window.addEventListener('tgi_signatories_updated', handleSync);
    return () => window.removeEventListener('tgi_signatories_updated', handleSync);
  }, [companyConfig]);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 3500);
  };

  const handleSaveSignatories = (newConfig: PayrollSignatoriesConfig) => {
    setSignatories(newConfig);
    savePayrollSignatoriesConfig(newConfig);
    onUpdateSignatories?.(newConfig);
    showNotice('Konfigurasi penandatangan, tanda tangan & stempel berhasil disimpan!');
  };

  const handleInlineFieldChange = (
    key: 'preparedBy' | 'verifiedBy' | 'approvedBy',
    patch: Partial<SignatoryItemConfig>
  ) => {
    const updated: PayrollSignatoriesConfig = {
      ...signatories,
      [key]: {
        ...signatories[key],
        ...patch,
      },
    };
    setSignatories(updated);
    savePayrollSignatoriesConfig(updated);
    onUpdateSignatories?.(updated);
  };

  const activePayrolls = dataScope === 'current_filter' ? payrolls : allPayrolls;

  const totalBaseSalary = activePayrolls.reduce((a, b) => a + b.baseSalary, 0);
  const totalAllowances = activePayrolls.reduce(
    (a, b) =>
      a +
      b.allowancePosition +
      b.allowanceTransport +
      b.allowanceMeal +
      b.allowanceCommunication,
    0
  );
  const totalOvertime = activePayrolls.reduce((a, b) => a + b.overtimePay, 0);
  const totalBonus = activePayrolls.reduce((a, b) => a + b.bonus, 0);
  const totalGross = activePayrolls.reduce((a, b) => a + b.totalGrossSalary, 0);
  const totalPph21 = activePayrolls.reduce((a, b) => a + b.pph21TER, 0);
  const totalDeductions = activePayrolls.reduce((a, b) => a + b.totalDeductions, 0);
  const totalTakeHomePay = activePayrolls.reduce((a, b) => a + b.takeHomePay, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    exportPayrollToPDF(activePayrolls, employees, companyConfig, {
      signatories,
    });
  };

  const handleExportCSV = () => {
    exportPayrollToCSV(activePayrolls, employees, companyConfig, {
      signatories,
    });
  };

  const effectiveSignDate =
    signatories.customDateText && signatories.customDateText.trim()
      ? signatories.customDateText.trim()
      : new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

  const signatoryColumns: {
    key: 'preparedBy' | 'verifiedBy' | 'approvedBy';
    item: SignatoryItemConfig;
  }[] = [
    { key: 'preparedBy', item: signatories.preparedBy },
    { key: 'verifiedBy', item: signatories.verifiedBy },
    { key: 'approvedBy', item: signatories.approvedBy },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:fixed">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Header Action Bar (Hidden when printing) */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base">
              TGI
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide flex items-center gap-2 flex-wrap">
                <span>Pratinjau &amp; Ekspor Laporan Gaji Bulanan</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {companyConfig.currentPayrollPeriod}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Laporan resmi penggajian karyawan {companyConfig.companyName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* Scope Filter Switcher */}
            {allPayrolls.length !== payrolls.length && (
              <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setDataScope('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    dataScope === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua ({allPayrolls.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDataScope('current_filter')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    dataScope === 'current_filter'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Terfilter ({payrolls.length})
                </button>
              </div>
            )}

            {/* Toggle Quick Inline Edit Penandatangan */}
            <button
              type="button"
              onClick={() => setIsQuickInlineEditorOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 rounded-lg hover:bg-amber-900/60 transition-colors cursor-pointer"
              title="Ketik cepat nama & jabatan penandatangan langsung di atas laporan"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Cepat Nama</span>
              {isQuickInlineEditorOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Open Full Signatory & Signature/Stamp Modal */}
            <button
              type="button"
              onClick={() => setIsSignatoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-200 bg-indigo-950/80 border border-indigo-500/50 rounded-lg hover:bg-indigo-900 transition-colors cursor-pointer"
              title="Buka Pengaturan Lengkap Penandatangan, Upload Tanda Tangan & Stempel Perusahaan"
            >
              <PenTool className="w-3.5 h-3.5 text-indigo-400" />
              <span>Atur Penandatangan &amp; TTD</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 rounded-lg hover:bg-emerald-900/60 transition-colors cursor-pointer"
              title="Unduh data format spreadsheet CSV (Excel Compatible)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unduh CSV</span>
            </button>

            {/* Export PDF via jsPDF */}
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-xs shadow-emerald-600/30"
              title="Unduh dokumen resmi format PDF A4 Landscape lengkap dengan tanda tangan & stempel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>

            {/* Print directly */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
              title="Cetak langsung menggunakan dialog print browser"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Notification Banner */}
        {savedToast && (
          <div className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{savedToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSavedToast(null)}
              className="text-emerald-100 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Collapsible Quick Inline Editor for Signatories (Hidden when printing) */}
        {isQuickInlineEditorOpen && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 space-y-3 print:hidden animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Edit Cepat Penandatangan Laporan &amp; Slip Gaji (Tersimpan Otomatis)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Ketik nama dan jabatan secara bebas di bawah ini, atau buka modal lengkap untuk menggambar TTD &amp; unggah stempel.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const autoStamp =
                      signatories.companyStampDataUrl ||
                      generateOfficialCompanyStampDataUrl(companyConfig.companyName);
                    const updated: PayrollSignatoriesConfig = {
                      ...signatories,
                      companyStampDataUrl: autoStamp,
                      preparedBy: {
                        ...signatories.preparedBy,
                        signatureDataUrl:
                          signatories.preparedBy.signatureDataUrl ||
                          generateStylizedSignatureDataUrl(signatories.preparedBy.name, '#0f172a'),
                      },
                      verifiedBy: {
                        ...signatories.verifiedBy,
                        signatureDataUrl:
                          signatories.verifiedBy.signatureDataUrl ||
                          generateStylizedSignatureDataUrl(signatories.verifiedBy.name, '#1e3a8a'),
                      },
                      approvedBy: {
                        ...signatories.approvedBy,
                        showStamp: true,
                        signatureDataUrl:
                          signatories.approvedBy.signatureDataUrl ||
                          generateStylizedSignatureDataUrl(signatories.approvedBy.name, '#065f46'),
                      },
                    };
                    handleSaveSignatories(updated);
                  }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Pasang TTD &amp; Stempel Otomatis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignatoryModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Gambar TTD / Stempel</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Disiapkan Oleh */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                  1. Bagian &ldquo;Disiapkan Oleh&rdquo;
                </span>
                <div>
                  <label className="text-[10px] text-slate-500 block">Nama Penandatangan</label>
                  <input
                    type="text"
                    value={signatories.preparedBy.name}
                    onChange={(e) =>
                      handleInlineFieldChange('preparedBy', { name: e.target.value })
                    }
                    placeholder="Ketik Nama Penandatangan HR..."
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Sub-Jabatan Atas</label>
                    <input
                      type="text"
                      value={signatories.preparedBy.topSubtitle}
                      onChange={(e) =>
                        handleInlineFieldChange('preparedBy', { topSubtitle: e.target.value })
                      }
                      placeholder="Staff HR & Payroll Admin"
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Departemen / Bagian</label>
                    <input
                      type="text"
                      value={signatories.preparedBy.jobTitle}
                      onChange={(e) =>
                        handleInlineFieldChange('preparedBy', { jobTitle: e.target.value })
                      }
                      placeholder="HR Department"
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Diperiksa & Diverifikasi */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">
                  2. Bagian &ldquo;Diperiksa &amp; Diverifikasi&rdquo;
                </span>
                <div>
                  <label className="text-[10px] text-slate-500 block">Nama Penandatangan</label>
                  <input
                    type="text"
                    value={signatories.verifiedBy.name}
                    onChange={(e) =>
                      handleInlineFieldChange('verifiedBy', { name: e.target.value })
                    }
                    placeholder="Ketik Nama Penandatangan Finance..."
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Sub-Jabatan Atas</label>
                    <input
                      type="text"
                      value={signatories.verifiedBy.topSubtitle}
                      onChange={(e) =>
                        handleInlineFieldChange('verifiedBy', { topSubtitle: e.target.value })
                      }
                      placeholder="Finance & Accounting Lead"
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Departemen / Bagian</label>
                    <input
                      type="text"
                      value={signatories.verifiedBy.jobTitle}
                      onChange={(e) =>
                        handleInlineFieldChange('verifiedBy', { jobTitle: e.target.value })
                      }
                      placeholder="Finance Department"
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Disetujui Oleh */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                  3. Bagian &ldquo;Disetujui Oleh&rdquo;
                </span>
                <div>
                  <label className="text-[10px] text-slate-500 block">Nama Penandatangan</label>
                  <input
                    type="text"
                    value={signatories.approvedBy.name}
                    onChange={(e) =>
                      handleInlineFieldChange('approvedBy', { name: e.target.value })
                    }
                    placeholder="Ketik Nama Direktur Utama..."
                    className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Sub-Jabatan Atas</label>
                    <input
                      type="text"
                      value={signatories.approvedBy.topSubtitle}
                      onChange={(e) =>
                        handleInlineFieldChange('approvedBy', { topSubtitle: e.target.value })
                      }
                      placeholder="Direktur Utama"
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Jabatan / Perusahaan</label>
                    <input
                      type="text"
                      value={signatories.approvedBy.jobTitle}
                      onChange={(e) =>
                        handleInlineFieldChange('approvedBy', { jobTitle: e.target.value })
                      }
                      placeholder="Direktur Utama"
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 print:p-0 print:overflow-visible">
          {/* Document Header / Kop Surat */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  TGI
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {companyConfig.companyName}
                </h1>
              </div>
              <p className="text-xs text-slate-600 max-w-xl">
                {companyConfig.address} • Telp: {companyConfig.phone} • NPWP: {companyConfig.npwpCompany}
              </p>
              <p className="text-xs font-bold text-emerald-800 pt-1">
                LAPORAN REKAPITULASI PENGGAJIAN BULANAN (PAYROLL DISBURSEMENT REPORT)
              </p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <p className="text-slate-500">
                Periode Gaji: <strong className="text-slate-900">{companyConfig.currentPayrollPeriod}</strong>
              </p>
              <p className="text-slate-500">
                Cut-off: <strong>Tgl {companyConfig.cutOffEndDay}</strong> • Pencairan: <strong>Tgl {companyConfig.payrollDisbursementDay}</strong>
              </p>
              <p className="text-slate-500">
                Bank Pembayar: <strong>{companyConfig.disbursementBank} ({companyConfig.disbursementAccount})</strong>
              </p>
              <p className="text-[11px] text-slate-400">
                Dicetak: {signatories.city || 'Jakarta'}, {effectiveSignDate}
              </p>
            </div>
          </div>

          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                Total Karyawan
              </span>
              <span className="text-lg font-bold text-slate-900">
                {activePayrolls.length} Orang
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                Total Gaji Kotor (Gross)
              </span>
              <span className="text-lg font-bold text-slate-900">
                {formatRupiah(totalGross)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                Total Potongan (PPh + BPJS)
              </span>
              <span className="text-lg font-bold text-rose-600">
                ({formatRupiah(totalDeductions)})
              </span>
            </div>
            <div className="bg-emerald-50 -m-2 p-3 rounded-lg border border-emerald-200">
              <span className="text-[10px] text-emerald-800 uppercase tracking-wider font-bold block">
                Total Gaji Bersih (THP)
              </span>
              <span className="text-lg font-extrabold text-emerald-700">
                {formatRupiah(totalTakeHomePay)}
              </span>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-900 text-white font-semibold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3 text-center">No</th>
                  <th className="py-2.5 px-3">NIK</th>
                  <th className="py-2.5 px-3">Nama Karyawan</th>
                  <th className="py-2.5 px-3">Departemen</th>
                  <th className="py-2.5 px-3 text-right">Gaji Pokok</th>
                  <th className="py-2.5 px-3 text-right">Tunjangan</th>
                  <th className="py-2.5 px-3 text-right">Lembur &amp; Bonus</th>
                  <th className="py-2.5 px-3 text-right">Gaji Kotor</th>
                  <th className="py-2.5 px-3 text-right">PPh 21 TER</th>
                  <th className="py-2.5 px-3 text-right">Potongan</th>
                  <th className="py-2.5 px-3 text-right">Gaji Bersih (THP)</th>
                  <th className="py-2.5 px-3">Rekening Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activePayrolls.map((p, idx) => {
                  const emp = employees.find((e) => e.id === p.employeeId);
                  const sumAllowances =
                    p.allowancePosition +
                    p.allowanceTransport +
                    p.allowanceMeal +
                    p.allowanceCommunication;
                  const sumOvertimeBonus = p.overtimePay + p.bonus;

                  return (
                    <tr
                      key={p.id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                    >
                      <td className="py-2 px-3 text-center font-sans">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-700">{emp?.nik}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {emp?.fullName}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 text-[10px]">
                        {emp?.department}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {formatRupiah(p.baseSalary)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {formatRupiah(sumAllowances)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {formatRupiah(sumOvertimeBonus)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatRupiah(p.totalGrossSalary)}
                      </td>
                      <td className="py-2 px-3 text-right text-amber-700">
                        {formatRupiah(p.pph21TER)}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-600">
                        ({formatRupiah(p.totalDeductions)})
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                        {formatRupiah(p.takeHomePay)}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 text-[10px]">
                        {emp?.bankName} - {emp?.bankAccountNumber}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 font-mono">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-center font-sans font-extrabold uppercase">
                    Total Keseluruhan ({activePayrolls.length} Karyawan)
                  </td>
                  <td className="py-2.5 px-3 text-right">{formatRupiah(totalBaseSalary)}</td>
                  <td className="py-2.5 px-3 text-right">{formatRupiah(totalAllowances)}</td>
                  <td className="py-2.5 px-3 text-right">{formatRupiah(totalOvertime + totalBonus)}</td>
                  <td className="py-2.5 px-3 text-right font-extrabold">{formatRupiah(totalGross)}</td>
                  <td className="py-2.5 px-3 text-right text-amber-800">{formatRupiah(totalPph21)}</td>
                  <td className="py-2.5 px-3 text-right text-rose-700">({formatRupiah(totalDeductions)})</td>
                  <td className="py-2.5 px-3 text-right text-emerald-800 font-extrabold">
                    {formatRupiah(totalTakeHomePay)}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">Lunas / Transfer Bank</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Kolom Tanda Tangan Resmi Pengesahan (Dinamis + Gambar TTD & Stempel) */}
          <div className="pt-4 space-y-2 break-inside-avoid">
            <div className="flex items-center justify-between print:hidden">
              <span className="text-[11px] font-semibold text-slate-500">
                Kolom Pengesahan Resmi ({signatories.city || 'Jakarta'}, {effectiveSignDate})
              </span>
              <button
                type="button"
                onClick={() => setIsSignatoryModalOpen(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <PenTool className="w-3 h-3" />
                <span>Ubah Nama, Jabatan, Tanda Tangan &amp; Stempel</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs pt-2">
              {signatoryColumns.map(({ key, item }) => {
                const stampImg = item.stampDataUrl || signatories.companyStampDataUrl;
                return (
                  <div
                    key={key}
                    onClick={() => setIsSignatoryModalOpen(true)}
                    title="Klik untuk mengubah penandatangan, tanda tangan digital, atau stempel"
                    className="group relative flex flex-col justify-between p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50/60 transition-all cursor-pointer print:p-0 print:border-none print:bg-transparent"
                  >
                    <div>
                      <p className="text-slate-600">
                        {item.headerLabel}
                        {item.topSubtitle && (
                          <>
                            <br />
                            <span className="font-semibold text-slate-800">{item.topSubtitle}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Area Tanda Tangan & Stempel di Atas Garis */}
                    <div className="relative h-24 flex items-end justify-center my-1">
                      {item.showStamp && stampImg && (
                        <img
                          src={stampImg}
                          alt="Stempel Resmi"
                          className="absolute left-1/2 -translate-x-14 bottom-0 w-20 h-20 object-contain opacity-80 pointer-events-none select-none z-10"
                        />
                      )}
                      {item.signatureDataUrl ? (
                        <img
                          src={item.signatureDataUrl}
                          alt={`Tanda Tangan ${item.name}`}
                          className="max-h-20 max-w-[180px] object-contain relative z-20 mb-0.5"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-300 group-hover:text-indigo-500 transition-colors mb-3 print:hidden">
                          + Klik untuk tambah TTD / Stempel
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-400 w-48 mx-auto relative z-20">
                      <p className="font-bold text-slate-900">
                        {item.name || '( .................................... )'}
                      </p>
                      <p className="text-[10px] text-slate-500">{item.jobTitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Pengaturan Penandatangan, Tanda Tangan Digital & Stempel */}
      <SignatoryConfigModal
        isOpen={isSignatoryModalOpen}
        onClose={() => setIsSignatoryModalOpen(false)}
        companyConfig={companyConfig}
        employees={employees}
        initialConfig={signatories}
        onSaveConfig={handleSaveSignatories}
      />
    </div>
  );
};
