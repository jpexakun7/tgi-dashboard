import React from 'react';
import { Employee, PayrollRecord, CompanyConfig } from '../types';
import { formatRupiah, terbilangRupiah, formatIndoDate } from '../utils/formatters';
import { X, Printer, Download, CheckCircle, ShieldCheck, Building2 } from 'lucide-react';

interface PayslipModalProps {
  payroll: PayrollRecord | null;
  employee: Employee | null;
  companyConfig: CompanyConfig;
  onClose: () => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  payroll,
  employee,
  companyConfig,
  onClose,
}) => {
  if (!payroll || !employee) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalAllowances =
    payroll.allowancePosition +
    payroll.allowanceTransport +
    payroll.allowanceMeal +
    payroll.allowanceCommunication;

  const totalEarnings = payroll.totalGrossSalary;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:fixed">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Modal Action Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              TGI
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Slip Gaji Elektronik</h3>
              <p className="text-xs text-slate-500">{payroll.referenceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
              title="Unduh dan simpan slip gaji format PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Unduh PDF
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Cetak Fisik
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div className="p-6 sm:p-10 overflow-y-auto print:overflow-visible print:p-6 text-slate-800 bg-white print:text-black">
          {/* Header PT TGI */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-slate-800 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-2xl shadow-md print:border print:border-slate-300">
                TGI
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{companyConfig.companyName}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{companyConfig.address}</p>
                <p className="text-xs text-slate-500">Telp: {companyConfig.phone} | NPWP: {companyConfig.npwpCompany}</p>
              </div>
            </div>
            <div className="text-left sm:text-right bg-emerald-50 sm:bg-transparent p-3 sm:p-0 rounded-lg w-full sm:w-auto">
              <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md print:border print:border-emerald-300">
                SLIP GAJI RESMI
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-1">Periode: {payroll.period}</p>
              <p className="text-xs text-slate-500">Ref: {payroll.referenceNumber}</p>
            </div>
          </div>

          {/* Employee Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 bg-slate-50/75 rounded-xl px-4 mt-5 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 block">Nama Karyawan</span>
              <span className="font-semibold text-slate-900 text-sm">{employee.fullName}</span>
              <span className="text-slate-500 block mt-1">NIK: {employee.nik}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Jabatan & Dept</span>
              <span className="font-semibold text-slate-900">{employee.role}</span>
              <span className="text-slate-500 block mt-1">{employee.department}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Status Pajak (PTKP)</span>
              <span className="font-semibold text-slate-900">{employee.ptkpStatus}</span>
              <span className="text-slate-500 block mt-1">NPWP: {employee.npwp}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Pembayaran Bank</span>
              <span className="font-semibold text-slate-900">{employee.bankName} - {employee.bankAccountNumber}</span>
              <span className="text-slate-500 block mt-1">a/n {employee.bankAccountHolder}</span>
            </div>
          </div>

          {/* Salary Breakdown Dual Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* PENDAPATAN (EARNINGS) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 flex justify-between items-center">
                <span>A. PENDAPATAN / PENGHASILAN</span>
                <span className="text-[11px] opacity-90">Jumlah (IDR)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2 px-4">
                  <span className="text-slate-700">Gaji Pokok</span>
                  <span className="font-medium">{formatRupiah(payroll.baseSalary)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <span className="text-slate-700">Tunjangan Jabatan</span>
                  <span className="font-medium">{formatRupiah(payroll.allowancePosition)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <span className="text-slate-700">Tunjangan Transport</span>
                  <span className="font-medium">{formatRupiah(payroll.allowanceTransport)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <span className="text-slate-700">Tunjangan Uang Makan</span>
                  <span className="font-medium">{formatRupiah(payroll.allowanceMeal)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <span className="text-slate-700">Tunjangan Komunikasi</span>
                  <span className="font-medium">{formatRupiah(payroll.allowanceCommunication)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <span className="text-slate-700">Upah Lembur (Overtime)</span>
                  <span className="font-medium">{formatRupiah(payroll.overtimePay)}</span>
                </div>
                {payroll.bonus > 0 && (
                  <div className="flex justify-between py-2 px-4 bg-emerald-50/50">
                    <span className="text-slate-700 font-medium">Bonus & Insentif Kinerja</span>
                    <span className="font-semibold text-emerald-800">{formatRupiah(payroll.bonus)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2.5 px-4 bg-slate-100/80 font-semibold text-slate-900 border-t border-slate-200">
                  <span>TOTAL PENGHASILAN BRUTO</span>
                  <span className="text-emerald-700">{formatRupiah(totalEarnings)}</span>
                </div>
              </div>
            </div>

            {/* POTONGAN (DEDUCTIONS) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-rose-700 text-white font-semibold text-xs px-4 py-2.5 flex justify-between items-center">
                <span>B. POTONGAN RESMI</span>
                <span className="text-[11px] opacity-90">Jumlah (IDR)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2 px-4">
                  <div>
                    <span className="text-slate-700 block">PPh 21 (TER Ketentuan 2026)</span>
                    <span className="text-[10px] text-slate-400">Pajak Penghasilan Karyawan (Coretax DJP)</span>
                  </div>
                  <span className="font-medium text-rose-600">{formatRupiah(payroll.pph21TER)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <div>
                    <span className="text-slate-700 block">BPJS Kesehatan (1%)</span>
                    <span className="text-[10px] text-slate-400">Iuran Peserta Karyawan</span>
                  </div>
                  <span className="font-medium text-rose-600">{formatRupiah(payroll.bpjsKesehatanEmployee)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <div>
                    <span className="text-slate-700 block">BPJS TK - JHT (2%)</span>
                    <span className="text-[10px] text-slate-400">Jaminan Hari Tua</span>
                  </div>
                  <span className="font-medium text-rose-600">{formatRupiah(payroll.bpjsJhtEmployee)}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <div>
                    <span className="text-slate-700 block">BPJS TK - JP (1%)</span>
                    <span className="text-[10px] text-slate-400">Jaminan Pensiun Karyawan</span>
                  </div>
                  <span className="font-medium text-rose-600">{formatRupiah(payroll.bpjsJpEmployee)}</span>
                </div>
                {payroll.lateDeduction > 0 && (
                  <div className="flex justify-between py-2 px-4">
                    <div>
                      <span className="text-slate-700 block">Potongan Keterlambatan</span>
                      <span className="text-[10px] text-rose-400">Denda jam presensi</span>
                    </div>
                    <span className="font-medium text-rose-600">{formatRupiah(payroll.lateDeduction)}</span>
                  </div>
                )}
                {payroll.otherDeductions > 0 && (
                  <div className="flex justify-between py-2 px-4">
                    <span className="text-slate-700">Potongan Lainnya</span>
                    <span className="font-medium text-rose-600">{formatRupiah(payroll.otherDeductions)}</span>
                  </div>
                )}
                {Boolean(payroll.cashAdvanceDeduction && payroll.cashAdvanceDeduction > 0) && (
                  <div className="flex justify-between py-2 px-4 bg-amber-50/70 border-l-2 border-amber-500">
                    <div>
                      <span className="text-slate-900 font-semibold block">Potongan Cicilan Kasbon Karyawan</span>
                      <span className="text-[10px] text-amber-800">
                        {payroll.cashAdvanceNotes || 'Potongan cicilan cash advance pinjaman karyawan'}
                      </span>
                    </div>
                    <span className="font-bold text-rose-700">{formatRupiah(payroll.cashAdvanceDeduction || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2.5 px-4 bg-slate-100/80 font-semibold text-slate-900 border-t border-slate-200">
                  <span>TOTAL POTONGAN</span>
                  <span className="text-rose-700">({formatRupiah(payroll.totalDeductions)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* BENEFIT PERUSAHAAN (Informasi Transparansi Iuran yang ditanggung PT Tas Grosir Import) */}
          <div className="mt-4 p-3.5 bg-sky-50/60 rounded-xl border border-sky-200/70 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-sky-900 mb-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>C. Iuran Jaminan Sosial Ditanggung Perusahaan (PT Tas Grosir Import)</span>
              <span className="text-[10px] text-sky-600 font-normal ml-auto">(Tidak memotong gaji karyawan)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-sky-800">
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="block text-slate-500">BPJS Kes (4%)</span>
                <span className="font-medium">{formatRupiah(payroll.bpjsKesehatanEmployer)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="block text-slate-500">BPJS JHT (3.7%)</span>
                <span className="font-medium">{formatRupiah(payroll.bpjsJhtEmployer)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="block text-slate-500">BPJS JP (2%)</span>
                <span className="font-medium">{formatRupiah(payroll.bpjsJpEmployer)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="block text-slate-500">BPJS JKK (0.24%)</span>
                <span className="font-medium">{formatRupiah(payroll.bpjsJkkEmployer)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-sky-100">
                <span className="block text-slate-500">BPJS JKM (0.3%)</span>
                <span className="font-medium">{formatRupiah(payroll.bpjsJkmEmployer)}</span>
              </div>
            </div>
          </div>

          {/* TAKE HOME PAY HIGHLIGHT */}
          <div className="mt-6 p-5 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-xs font-medium tracking-wide uppercase text-emerald-100">PENGHASILAN BERSIH DITERIMA (TAKE HOME PAY)</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">{formatRupiah(payroll.takeHomePay)}</h2>
              <p className="text-xs italic text-emerald-100 mt-1 font-serif">
                "{terbilangRupiah(payroll.takeHomePay)}"
              </p>
            </div>
            <div className="sm:text-right text-xs bg-emerald-800/60 sm:bg-transparent p-2.5 sm:p-0 rounded-lg w-full sm:w-auto">
              <span className="inline-flex items-center gap-1 text-emerald-200 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                Status: {payroll.paymentStatus}
              </span>
              <p className="text-emerald-100 mt-0.5">Metode: Transfer Payroll {employee.bankName}</p>
              <p className="text-emerald-200/80 text-[11px]">Tanggal: {payroll.paymentDate ? formatIndoDate(payroll.paymentDate) : '28 Oktober 2026'}</p>
            </div>
          </div>

          {/* Signatures & Verification QR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-4 border-t border-slate-200 text-xs">
            <div className="text-center">
              <span className="text-slate-500 block mb-12">Disiapkan Oleh HRD:</span>
              <div className="w-28 mx-auto border-b border-slate-400"></div>
              <p className="font-semibold text-slate-800 mt-1.5">Siti Rahmawati</p>
              <p className="text-slate-500 text-[11px]">HR & Payroll Specialist</p>
            </div>

            <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
              {/* SVG QR Code Simulation */}
              <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                  <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M22,22 h6 v6 h-6 z" />
                  <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M72,22 h6 v6 h-6 z" />
                  <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M22,72 h6 v6 h-6 z" />
                  <rect x="50" y="20" width="5" height="15" />
                  <rect x="50" y="45" width="20" height="6" />
                  <rect x="75" y="55" width="15" height="6" />
                  <rect x="60" y="70" width="10" height="20" />
                  <rect x="80" y="80" width="10" height="10" />
                  <rect x="45" y="75" width="8" height="8" />
                </svg>
              </div>
              <span className="text-[10px] text-slate-500 mt-1.5">TGI E-Slip Verified Digital</span>
              <span className="text-[9px] text-slate-400 font-mono">{payroll.id.slice(0, 16)}</span>
            </div>

            <div className="text-center">
              <span className="text-slate-500 block mb-12">Diterima Oleh Karyawan:</span>
              <div className="w-28 mx-auto border-b border-slate-400"></div>
              <p className="font-semibold text-slate-800 mt-1.5">{employee.fullName}</p>
              <p className="text-slate-500 text-[11px]">{employee.nik}</p>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-6">
            Dokumen ini dicetak secara sah dan otomatis oleh TGI Dashboard (Platform Penggajian & HRIS). Tidak memerlukan cap basah.
          </p>
        </div>
      </div>
    </div>
  );
};
