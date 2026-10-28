import React, { useState, useEffect } from 'react';
import {
  Employee,
  PayrollRecord,
  CompanyConfig,
  PayrollSignatoriesConfig,
} from '../types';
import {
  formatRupiah,
  terbilangRupiah,
  formatIndoDate,
  getOvertimeRatePerMinute,
  getPayrollSignatoriesConfig,
  savePayrollSignatoriesConfig,
} from '../utils/formatters';
import { getPayslipWhatsAppUrl, getPayslipEmailUrl } from '../utils/notificationHelper';
import {
  X,
  Printer,
  Download,
  CheckCircle,
  ShieldCheck,
  MessageCircle,
  Mail,
  PenTool,
  Check,
} from 'lucide-react';
import { SignatoryConfigModal } from './SignatoryConfigModal';

interface PayslipModalProps {
  payroll: PayrollRecord | null;
  employee: Employee | null;
  companyConfig: CompanyConfig;
  employees?: Employee[];
  onClose: () => void;
  onUpdateSignatories?: (config: PayrollSignatoriesConfig) => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  payroll,
  employee,
  companyConfig,
  employees = [],
  onClose,
  onUpdateSignatories,
}) => {
  const [signatories, setSignatories] = useState<PayrollSignatoriesConfig>(() =>
    getPayrollSignatoriesConfig(companyConfig)
  );
  const [isSignatoryModalOpen, setIsSignatoryModalOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    setSignatories(getPayrollSignatoriesConfig(companyConfig));
  }, [companyConfig, payroll]);

  useEffect(() => {
    const handleSync = () => {
      setSignatories(getPayrollSignatoriesConfig(companyConfig));
    };
    window.addEventListener('tgi_signatories_updated', handleSync);
    return () => window.removeEventListener('tgi_signatories_updated', handleSync);
  }, [companyConfig]);

  if (!payroll || !employee) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveSignatories = (newConfig: PayrollSignatoriesConfig) => {
    setSignatories(newConfig);
    savePayrollSignatoriesConfig(newConfig);
    onUpdateSignatories?.(newConfig);
    setSavedToast('Pengaturan penandatangan & tanda tangan slip gaji berhasil diperbarui!');
    setTimeout(() => setSavedToast(null), 3500);
  };

  const totalEarnings = payroll.totalGrossSalary;

  const effectiveSignDate =
    signatories.customDateText && signatories.customDateText.trim()
      ? signatories.customDateText.trim()
      : payroll.paymentDate
      ? formatIndoDate(payroll.paymentDate)
      : new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

  const preparedStamp =
    signatories.preparedBy.stampDataUrl || signatories.companyStampDataUrl;
  const verifiedStamp =
    signatories.verifiedBy.stampDataUrl || signatories.companyStampDataUrl;
  const approvedStamp =
    signatories.approvedBy.stampDataUrl || signatories.companyStampDataUrl;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:fixed">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Modal Action Bar (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              TGI
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Slip Gaji Elektronik</h3>
              <p className="text-xs text-slate-500">{payroll.referenceNumber}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSignatoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
              title="Ubah nama penandatangan, jabatan, tanda tangan digital & stempel perusahaan"
            >
              <PenTool className="w-3.5 h-3.5 text-indigo-600" />
              <span>Atur Penandatangan &amp; TTD</span>
            </button>
            <a
              href={getPayslipWhatsAppUrl(employee, payroll, companyConfig)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-2xs"
              title={`Kirim Notifikasi WA Slip Gaji ke ${employee.fullName} (${employee.phone || 'No HP kosong'})`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim Notifikasi WA</span>
            </a>
            <a
              href={getPayslipEmailUrl(employee, payroll, companyConfig)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs"
              title={`Kirim Email Slip Gaji ke ${employee.fullName} (${employee.email || 'Email kosong'})`}
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Kirim Email</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
              title="Unduh dan simpan slip gaji format PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak Fisik</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {savedToast && (
          <div className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between print:hidden">
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

        {/* Printable Payslip Body */}
        <div className="p-6 sm:p-10 overflow-y-auto print:overflow-visible print:p-6 text-slate-800 bg-white print:text-black">
          {/* Header PT TGI */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-slate-800 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-2xl shadow-md print:border print:border-slate-300">
                TGI
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {companyConfig.companyName}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">{companyConfig.address}</p>
                <p className="text-xs text-slate-500">
                  Telp: {companyConfig.phone} | NPWP: {companyConfig.npwpCompany}
                </p>
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
              <span className="text-slate-500 block">Jabatan &amp; Dept</span>
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
              <span className="font-semibold text-slate-900">
                {employee.bankName} - {employee.bankAccountNumber}
              </span>
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
                  <div>
                    <span className="text-slate-700 block">Upah Lembur (Hitungan Per Menit)</span>
                    {payroll.overtimePay > 0 && (
                      <span className="text-[10px] text-emerald-700 font-mono">
                        {(() => {
                          const ratePerMin =
                            payroll.overtimeRatePerMinute || getOvertimeRatePerMinute(employee, 1.5);
                          const mins =
                            payroll.overtimeMinutes !== undefined
                              ? payroll.overtimeMinutes
                              : Math.round(payroll.overtimePay / Math.max(100, ratePerMin));
                          return `${mins} menit × ${formatRupiah(ratePerMin)}/menit`;
                        })()}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{formatRupiah(payroll.overtimePay)}</span>
                </div>
                {payroll.bonus > 0 && (
                  <div className="flex justify-between py-2 px-4 bg-emerald-50/50">
                    <span className="text-slate-700 font-medium">Bonus &amp; Insentif Kinerja</span>
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
                {payroll.isLateFeeWaived ? (
                  <div className="flex justify-between py-2 px-4 bg-indigo-50/70 border-l-2 border-indigo-500">
                    <div>
                      <span className="text-slate-900 font-semibold block">
                        Potongan Keterlambatan &amp; Absen (Dispensasi Denda)
                      </span>
                      <span className="text-[10px] text-indigo-700 font-medium block">
                        {payroll.attendanceDeductionNotes ||
                          `Dispensasi Denda Absensi (Tugas Luar / Kebijakan HR): Bebas Potongan`}
                      </span>
                    </div>
                    <span className="font-bold text-indigo-700">Rp 0</span>
                  </div>
                ) : (
                  payroll.lateDeduction > 0 && (
                    <div className="flex justify-between py-2 px-4 bg-rose-50/70 border-l-2 border-rose-500">
                      <div>
                        <span className="text-slate-900 font-semibold block">
                          Potongan Keterlambatan &amp; Absen
                        </span>
                        <span className="text-[10px] text-rose-700 font-medium block">
                          {payroll.attendanceDeductionNotes ||
                            `Potongan Terlambat ${payroll.lateFrequency || 1}x / ${
                              payroll.totalLateMinutes || 0
                            } mnt: -${formatRupiah(payroll.lateDeduction)}`}
                        </span>
                      </div>
                      <span className="font-bold text-rose-700">
                        -{formatRupiah(payroll.lateDeduction)}
                      </span>
                    </div>
                  )
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

          {/* BENEFIT PERUSAHAAN */}
          <div className="mt-4 p-3.5 bg-sky-50/60 rounded-xl border border-sky-200/70 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-sky-900 mb-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>C. Iuran Jaminan Sosial Ditanggung Perusahaan ({companyConfig.companyName})</span>
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
              <span className="text-xs font-medium tracking-wide uppercase text-emerald-100">
                PENGHASILAN BERSIH DITERIMA (TAKE HOME PAY)
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                {formatRupiah(payroll.takeHomePay)}
              </h2>
              <p className="text-xs italic text-emerald-100 mt-1 font-serif">
                &ldquo;{terbilangRupiah(payroll.takeHomePay)}&rdquo;
              </p>
            </div>
            <div className="sm:text-right text-xs bg-emerald-800/60 sm:bg-transparent p-2.5 sm:p-0 rounded-lg w-full sm:w-auto">
              <span className="inline-flex items-center gap-1 text-emerald-200 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                Status: {payroll.paymentStatus}
              </span>
              <p className="text-emerald-100 mt-0.5">Metode: Transfer Payroll {employee.bankName}</p>
              <p className="text-emerald-200/80 text-[11px]">
                Tanggal: {signatories.city || 'Jakarta'}, {effectiveSignDate}
              </p>
            </div>
          </div>

          {/* Signatures & Verification Section (Dinamis dari Konfigurasi Penandatangan) */}
          <div className="mt-8 pt-4 border-t border-slate-200 space-y-3 break-inside-avoid">
            <div className="flex items-center justify-between text-[11px] text-slate-500 print:hidden">
              <span>
                Pengesahan Slip Gaji ({signatories.city || 'Jakarta'}, {effectiveSignDate})
              </span>
              <button
                type="button"
                onClick={() => setIsSignatoryModalOpen(true)}
                className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <PenTool className="w-3 h-3" />
                <span>Ubah Penandatangan / TTD / Stempel</span>
              </button>
            </div>

            {signatories.showAllThreeOnPayslip ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-center pt-1">
                {/* 1. Disiapkan Oleh */}
                <div
                  onClick={() => setIsSignatoryModalOpen(true)}
                  className="p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex flex-col justify-between"
                  title="Klik untuk mengubah penandatangan"
                >
                  <div>
                    <span className="text-slate-500 block">{signatories.preparedBy.headerLabel}</span>
                    <span className="font-semibold text-slate-700 text-[10px] block">
                      {signatories.preparedBy.topSubtitle}
                    </span>
                  </div>
                  <div className="relative h-20 flex items-end justify-center my-1">
                    {signatories.preparedBy.showStamp && preparedStamp && (
                      <img
                        src={preparedStamp}
                        alt="Stempel"
                        className="absolute left-1/2 -translate-x-10 bottom-0 w-16 h-16 object-contain opacity-80 pointer-events-none z-10"
                      />
                    )}
                    {signatories.preparedBy.signatureDataUrl && (
                      <img
                        src={signatories.preparedBy.signatureDataUrl}
                        alt={signatories.preparedBy.name}
                        className="max-h-16 max-w-[130px] object-contain relative z-20"
                      />
                    )}
                  </div>
                  <div className="w-36 mx-auto border-t border-slate-400 pt-1.5 relative z-20">
                    <p className="font-bold text-slate-900 text-[11px] leading-tight">
                      {signatories.preparedBy.name || '( ........................ )'}
                    </p>
                    <p className="text-slate-500 text-[10px]">{signatories.preparedBy.jobTitle}</p>
                  </div>
                </div>

                {/* 2. Diperiksa & Diverifikasi */}
                <div
                  onClick={() => setIsSignatoryModalOpen(true)}
                  className="p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex flex-col justify-between"
                  title="Klik untuk mengubah penandatangan"
                >
                  <div>
                    <span className="text-slate-500 block">{signatories.verifiedBy.headerLabel}</span>
                    <span className="font-semibold text-slate-700 text-[10px] block">
                      {signatories.verifiedBy.topSubtitle}
                    </span>
                  </div>
                  <div className="relative h-20 flex items-end justify-center my-1">
                    {signatories.verifiedBy.showStamp && verifiedStamp && (
                      <img
                        src={verifiedStamp}
                        alt="Stempel"
                        className="absolute left-1/2 -translate-x-10 bottom-0 w-16 h-16 object-contain opacity-80 pointer-events-none z-10"
                      />
                    )}
                    {signatories.verifiedBy.signatureDataUrl && (
                      <img
                        src={signatories.verifiedBy.signatureDataUrl}
                        alt={signatories.verifiedBy.name}
                        className="max-h-16 max-w-[130px] object-contain relative z-20"
                      />
                    )}
                  </div>
                  <div className="w-36 mx-auto border-t border-slate-400 pt-1.5 relative z-20">
                    <p className="font-bold text-slate-900 text-[11px] leading-tight">
                      {signatories.verifiedBy.name || '( ........................ )'}
                    </p>
                    <p className="text-slate-500 text-[10px]">{signatories.verifiedBy.jobTitle}</p>
                  </div>
                </div>

                {/* 3. Disetujui Oleh */}
                <div
                  onClick={() => setIsSignatoryModalOpen(true)}
                  className="p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex flex-col justify-between"
                  title="Klik untuk mengubah penandatangan"
                >
                  <div>
                    <span className="text-slate-500 block">{signatories.approvedBy.headerLabel}</span>
                    <span className="font-semibold text-slate-700 text-[10px] block">
                      {signatories.approvedBy.topSubtitle}
                    </span>
                  </div>
                  <div className="relative h-20 flex items-end justify-center my-1">
                    {signatories.approvedBy.showStamp && approvedStamp && (
                      <img
                        src={approvedStamp}
                        alt="Stempel"
                        className="absolute left-1/2 -translate-x-10 bottom-0 w-16 h-16 object-contain opacity-80 pointer-events-none z-10"
                      />
                    )}
                    {signatories.approvedBy.signatureDataUrl && (
                      <img
                        src={signatories.approvedBy.signatureDataUrl}
                        alt={signatories.approvedBy.name}
                        className="max-h-16 max-w-[130px] object-contain relative z-20"
                      />
                    )}
                  </div>
                  <div className="w-36 mx-auto border-t border-slate-400 pt-1.5 relative z-20">
                    <p className="font-bold text-slate-900 text-[11px] leading-tight">
                      {signatories.approvedBy.name || '( ........................ )'}
                    </p>
                    <p className="text-slate-500 text-[10px]">{signatories.approvedBy.jobTitle}</p>
                  </div>
                </div>

                {/* 4. Diterima Oleh Karyawan */}
                <div className="p-2 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 block">Diterima Oleh,</span>
                    <span className="font-semibold text-slate-700 text-[10px] block">
                      Karyawan Penerima
                    </span>
                  </div>
                  <div className="h-20 flex items-center justify-center my-1">
                    <div className="w-14 h-14 bg-slate-50 p-1 rounded-lg border border-slate-200 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800 fill-current">
                        <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M22,22 h6 v6 h-6 z" />
                        <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M72,22 h6 v6 h-6 z" />
                        <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M22,72 h6 v6 h-6 z" />
                        <rect x="50" y="20" width="5" height="15" />
                        <rect x="50" y="45" width="20" height="6" />
                        <rect x="75" y="55" width="15" height="6" />
                        <rect x="60" y="70" width="10" height="20" />
                      </svg>
                    </div>
                  </div>
                  <div className="w-36 mx-auto border-t border-slate-400 pt-1.5">
                    <p className="font-bold text-slate-900 text-[11px] leading-tight">
                      {employee.fullName}
                    </p>
                    <p className="text-slate-500 text-[10px]">NIK: {employee.nik}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs pt-1">
                <div
                  onClick={() => setIsSignatoryModalOpen(true)}
                  className="text-center cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors"
                >
                  <span className="text-slate-500 block">{signatories.preparedBy.headerLabel}</span>
                  <div className="relative h-20 flex items-end justify-center my-1">
                    {signatories.preparedBy.showStamp && preparedStamp && (
                      <img
                        src={preparedStamp}
                        alt="Stempel"
                        className="absolute left-1/2 -translate-x-10 bottom-0 w-16 h-16 object-contain opacity-80 pointer-events-none z-10"
                      />
                    )}
                    {signatories.preparedBy.signatureDataUrl && (
                      <img
                        src={signatories.preparedBy.signatureDataUrl}
                        alt={signatories.preparedBy.name}
                        className="max-h-16 max-w-[140px] object-contain relative z-20"
                      />
                    )}
                  </div>
                  <div className="w-36 mx-auto border-b border-slate-400"></div>
                  <p className="font-semibold text-slate-800 mt-1.5">
                    {signatories.preparedBy.name || '( ........................ )'}
                  </p>
                  <p className="text-slate-500 text-[11px]">{signatories.preparedBy.jobTitle}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
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

                <div className="text-center p-2">
                  <span className="text-slate-500 block">Diterima Oleh Karyawan:</span>
                  <div className="h-20" />
                  <div className="w-36 mx-auto border-b border-slate-400"></div>
                  <p className="font-semibold text-slate-800 mt-1.5">{employee.fullName}</p>
                  <p className="text-slate-500 text-[11px]">{employee.nik}</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-6">
            Dokumen ini dicetak secara sah dan otomatis oleh TGI Dashboard (Platform Penggajian &amp; HRIS).
          </p>
        </div>
      </div>

      {/* Modal Pengaturan Penandatangan & TTD */}
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
