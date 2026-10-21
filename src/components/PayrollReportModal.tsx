import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  Building2,
  CheckCircle,
  Calendar,
  Filter,
} from 'lucide-react';
import { Employee, PayrollRecord, CompanyConfig } from '../types';
import { formatRupiah, formatIndoDate } from '../utils/formatters';
import { exportPayrollToCSV, exportPayrollToPDF } from '../utils/payrollExporter';

interface PayrollReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrolls: PayrollRecord[];
  allPayrolls: PayrollRecord[];
  employees: Employee[];
  companyConfig: CompanyConfig;
  selectedDepartment?: string;
}

export const PayrollReportModal: React.FC<PayrollReportModalProps> = ({
  isOpen,
  onClose,
  payrolls,
  allPayrolls,
  employees,
  companyConfig,
  selectedDepartment = 'ALL',
}) => {
  const [dataScope, setDataScope] = useState<'current_filter' | 'all'>(
    selectedDepartment !== 'ALL' ? 'current_filter' : 'all'
  );

  if (!isOpen) return null;

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
    exportPayrollToPDF(activePayrolls, employees, companyConfig);
  };

  const handleExportCSV = () => {
    exportPayrollToCSV(activePayrolls, employees, companyConfig);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:fixed">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Header Action Bar (Hidden when printing) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base">
              TGI
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                <span>Pratinjau & Ekspor Laporan Gaji Bulanan</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {companyConfig.currentPayrollPeriod}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Laporan resmi penggajian karyawan PT Tas Grosir Import
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Scope Filter Switcher */}
            {allPayrolls.length !== payrolls.length && (
              <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
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

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 rounded-lg hover:bg-emerald-900/60 transition-colors cursor-pointer"
              title="Unduh data format spreadsheet CSV (Excel Compatible)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unduh CSV</span>
            </button>

            {/* Export PDF via jsPDF */}
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-xs shadow-emerald-600/30"
              title="Unduh dokumen resmi format PDF A4 Landscape"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>

            {/* Print directly */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
              title="Cetak langsung menggunakan dialog print browser"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
                Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                  <th className="py-2.5 px-3 text-right">Lembur & Bonus</th>
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

          {/* Kolom Tanda Tangan Resmi Pengesahan */}
          <div className="pt-6 grid grid-cols-3 gap-6 text-center text-xs break-inside-avoid">
            <div className="space-y-12">
              <p className="text-slate-600">
                Disiapkan Oleh,<br />
                <span className="font-semibold text-slate-800">Staff HR & Payroll Admin</span>
              </p>
              <div className="pt-4 border-t border-slate-300 w-36 mx-auto">
                <p className="font-bold text-slate-900">Siti Rahmawati, S.E.</p>
                <p className="text-[10px] text-slate-500">HR Department</p>
              </div>
            </div>

            <div className="space-y-12">
              <p className="text-slate-600">
                Diperiksa & Diverifikasi,<br />
                <span className="font-semibold text-slate-800">Finance & Accounting Lead</span>
              </p>
              <div className="pt-4 border-t border-slate-300 w-36 mx-auto">
                <p className="font-bold text-slate-900">Budi Santoso, M.Ak.</p>
                <p className="text-[10px] text-slate-500">Finance Department</p>
              </div>
            </div>

            <div className="space-y-12">
              <p className="text-slate-600">
                Disetujui Oleh,<br />
                <span className="font-semibold text-slate-800">Direktur Utama</span>
              </p>
              <div className="pt-4 border-t border-slate-300 w-36 mx-auto">
                <p className="font-bold text-slate-900">H. Hendra Wijaya</p>
                <p className="text-[10px] text-slate-500">PT Tas Grosir Import</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
