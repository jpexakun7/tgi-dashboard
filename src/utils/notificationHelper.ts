import {
  Employee,
  PayrollRecord,
  LeaveRequest,
  OvertimeRequest,
  CashAdvance,
  CompanyConfig,
} from '../types';
import { formatRupiah, formatIndoDate, formatOvertimeMinutes } from './formatters';

const DEFAULT_COMPANY_NAME = 'PT Tas Grosir Import';

/**
 * Otomatis memformat nomor HP/WhatsApp karyawan ke format internasional Indonesia (628...)
 * Contoh:
 * - "0812-3456-7890" -> "6281234567890"
 * - "+62 812 3456 7890" -> "6281234567890"
 * - "81234567890" -> "6281234567890"
 */
export function formatWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('08')) {
    digits = '628' + digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else if (digits.startsWith('6208')) {
    digits = '628' + digits.slice(4);
  }

  return digits;
}

/**
 * Mengecek apakah karyawan memiliki nomor WhatsApp yang valid (minimal 9 digit)
 */
export function hasValidWhatsAppPhone(phone?: string | null): boolean {
  const formatted = formatWhatsAppPhone(phone);
  return formatted.length >= 9;
}

/**
 * Menghasilkan URL WhatsApp (https://wa.me/...) lengkap dengan teks pesan ter-encode
 */
export function generateWhatsAppUrl(phone: string | undefined | null, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  if (!formattedPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

/**
 * Menghasilkan URL Email (mailto:...) lengkap dengan subject dan body ter-encode
 */
export function generateMailtoUrl(
  email: string | undefined | null,
  subject: string,
  body: string
): string {
  const cleanEmail = (email || '').trim();
  return `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Template Pesan WhatsApp Slip Gaji Karyawan
 */
export function buildPayslipWaMessage(
  emp: Employee,
  payroll: PayrollRecord,
  companyConfig?: CompanyConfig
): string {
  const companyName = companyConfig?.companyName || DEFAULT_COMPANY_NAME;
  const totalAllowances =
    (payroll.allowancePosition || 0) +
    (payroll.allowanceTransport || 0) +
    (payroll.allowanceMeal || 0) +
    (payroll.allowanceCommunication || 0);

  const lines: string[] = [
    `*NOTIFIKASI SLIP GAJI ELEKTRONIK*`,
    `*${companyName.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Halo *${emp.fullName}* (${emp.nik}),`,
    `Slip gaji Anda untuk periode *${payroll.period}* telah terbit dengan rincian sebagai berikut:`,
    ``,
    `*Data Karyawan:*`,
    `• Nama: ${emp.fullName}`,
    `• Jabatan / Divisi: ${emp.role} (${emp.department})`,
    `• No. Referensi: ${payroll.referenceNumber}`,
    ``,
    `*Rincian Penghasilan:*`,
    `• Gaji Pokok: ${formatRupiah(payroll.baseSalary)}`,
    `• Total Tunjangan: ${formatRupiah(totalAllowances)}`,
  ];

  if (payroll.overtimePay > 0) {
    lines.push(`• Upah Lembur: ${formatRupiah(payroll.overtimePay)}`);
  }
  if (payroll.bonus > 0) {
    lines.push(`• Bonus & Insentif KPI: ${formatRupiah(payroll.bonus)}`);
  }

  lines.push(
    `• *Total Penghasilan Bruto: ${formatRupiah(payroll.totalGrossSalary)}*`,
    ``,
    `*Rincian Potongan:*`,
    `• PPh 21 (TER): -${formatRupiah(payroll.pph21TER)}`,
    `• BPJS (Kes + JHT + JP): -${formatRupiah(
      (payroll.bpjsKesehatanEmployee || 0) +
        (payroll.bpjsJhtEmployee || 0) +
        (payroll.bpjsJpEmployee || 0)
    )}`
  );

  if (payroll.lateDeduction > 0) {
    lines.push(
      `• Potongan Keterlambatan & Absen: -${formatRupiah(payroll.lateDeduction)}${
        payroll.attendanceDeductionNotes ? ` (${payroll.attendanceDeductionNotes})` : ''
      }`
    );
  }
  if (payroll.cashAdvanceDeduction && payroll.cashAdvanceDeduction > 0) {
    lines.push(
      `• Potongan Cicilan Kasbon: -${formatRupiah(payroll.cashAdvanceDeduction)}`
    );
  }
  if (payroll.otherDeductions > 0) {
    lines.push(`• Potongan Lainnya: -${formatRupiah(payroll.otherDeductions)}`);
  }

  lines.push(
    `• *Total Potongan: -${formatRupiah(payroll.totalDeductions)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 *TAKE HOME PAY (GAJI BERSIH):*`,
    `*${formatRupiah(payroll.takeHomePay)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*Rekening Penerima:*`,
    `${emp.bankName} — ${emp.bankAccountNumber} (a/n ${emp.bankAccountHolder || emp.fullName})`,
    `Status Pembayaran: *${payroll.paymentStatus}*`,
    ``,
    `📌 *Instruksi Portal Karyawan:*`,
    `Silakan login ke *Portal Karyawan ${companyName}* (menu *Slip Gaji*) menggunakan NIK & PIN Anda untuk melihat rincian lengkap dan mengunduh dokumen Slip Gaji PDF resmi.`,
    ``,
    `Terima kasih atas dedikasi dan kontribusi terbaik Anda.`,
    `Salam hangat,`,
    `*HRD & Finance ${companyName}*`
  );

  return lines.join('\n');
}

export function getPayslipWhatsAppUrl(
  emp: Employee,
  payroll: PayrollRecord,
  companyConfig?: CompanyConfig
): string {
  const msg = buildPayslipWaMessage(emp, payroll, companyConfig);
  return generateWhatsAppUrl(emp.phone, msg);
}

/**
 * Template Email Slip Gaji Karyawan
 */
export function buildPayslipEmailContent(
  emp: Employee,
  payroll: PayrollRecord,
  companyConfig?: CompanyConfig
): { subject: string; body: string } {
  const companyName = companyConfig?.companyName || DEFAULT_COMPANY_NAME;
  const totalAllowances =
    (payroll.allowancePosition || 0) +
    (payroll.allowanceTransport || 0) +
    (payroll.allowanceMeal || 0) +
    (payroll.allowanceCommunication || 0);

  const subject = `[Slip Gaji Resmi] Periode ${payroll.period} - ${emp.fullName} (${emp.nik}) - ${companyName}`;

  const bodyLines: string[] = [
    `Yth. ${emp.fullName} (${emp.nik}),`,
    `Jabatan: ${emp.role} — Divisi ${emp.department}`,
    ``,
    `Bersama email ini kami menginformasikan bahwa Slip Gaji Elektronik Anda untuk periode ${payroll.period} telah diterbitkan oleh HRD & Finance ${companyName}.`,
    ``,
    `==================================================`,
    `RINGKASAN SLIP GAJI (${payroll.period.toUpperCase()})`,
    `No. Referensi: ${payroll.referenceNumber}`,
    `==================================================`,
    `A. PENGHASILAN:`,
    `- Gaji Pokok: ${formatRupiah(payroll.baseSalary)}`,
    `- Total Tunjangan: ${formatRupiah(totalAllowances)}`,
    `- Upah Lembur: ${formatRupiah(payroll.overtimePay)}`,
    `- Bonus & Insentif: ${formatRupiah(payroll.bonus)}`,
    `Total Penghasilan Bruto: ${formatRupiah(payroll.totalGrossSalary)}`,
    ``,
    `B. POTONGAN:`,
    `- Pajak PPh 21 (TER): -${formatRupiah(payroll.pph21TER)}`,
    `- Iuran BPJS Karyawan: -${formatRupiah(
      (payroll.bpjsKesehatanEmployee || 0) +
        (payroll.bpjsJhtEmployee || 0) +
        (payroll.bpjsJpEmployee || 0)
    )}`,
    `- Potongan Keterlambatan & Absen: -${formatRupiah(payroll.lateDeduction || 0)}`,
    `- Potongan Cicilan Kasbon: -${formatRupiah(payroll.cashAdvanceDeduction || 0)}`,
    `Total Potongan: -${formatRupiah(payroll.totalDeductions)}`,
    ``,
    `--------------------------------------------------`,
    `TAKE HOME PAY (GAJI BERSIH DITERIMA): ${formatRupiah(payroll.takeHomePay)}`,
    `--------------------------------------------------`,
    `Rekening Transfer: ${emp.bankName} - ${emp.bankAccountNumber} a/n ${
      emp.bankAccountHolder || emp.fullName
    }`,
    `Status: ${payroll.paymentStatus}`,
    ``,
    `CARA UNDUH SLIP GAJI PDF:`,
    `Silakan buka Portal Karyawan ${companyName}, masuk ke tab "Slip Gaji", lalu klik tombol "Unduh PDF" atau "Cetak Slip Gaji".`,
    ``,
    `Apabila terdapat pertanyaan terkait rincian komponen gaji, silakan menghubungi tim HRD & Finance.`,
    ``,
    `Hormat kami,`,
    `Departemen HRD & Finance`,
    `${companyName}`,
  ];

  return { subject, body: bodyLines.join('\n') };
}

export function getPayslipEmailUrl(
  emp: Employee,
  payroll: PayrollRecord,
  companyConfig?: CompanyConfig
): string {
  const { subject, body } = buildPayslipEmailContent(emp, payroll, companyConfig);
  return generateMailtoUrl(emp.email, subject, body);
}

/**
 * Template Broadcast WA Slip Gaji Terbit (Pengumuman ke Grup / Seluruh Karyawan)
 */
export function buildBroadcastPayslipWaMessage(
  period: string,
  employeeCount: number,
  totalPayrollAmount: number,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  return [
    `📢 *PENGUMUMAN RESMI: SLIP GAJI PERIODE ${period.toUpperCase()} TELAH TERBIT*`,
    `*${companyName.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Halo Rekan-Rekan Karyawan *${companyName}*,`,
    ``,
    `Kami menginformasikan bahwa perhitungan penggajian (*Payroll*) dan *Slip Gaji Elektronik* untuk periode *${period}* (${employeeCount} karyawan aktif) telah selesai diverifikasi dan diterbitkan.`,
    ``,
    `📌 *Panduan Cek & Unduh Slip Gaji:*`,
    `1. Buka aplikasi *Portal Karyawan ${companyName}*`,
    `2. Pilih nama/akun Anda dan masukkan PIN akses pribadi`,
    `3. Masuk ke menu *Slip Gaji* untuk memeriksa rincian Gaji Pokok, Tunjangan, Lembur, Bonus KPI, Potongan Absensi/Kasbon, serta *Take Home Pay (THP)*`,
    `4. Klik *Unduh PDF* untuk menyimpan bukti slip gaji resmi Anda`,
    ``,
    `Pastikan data Nomor Rekening Bank, NIK KTP 16 Digit, dan NPWP di menu *Profil Saya* sudah sesuai. Jika ada pertanyaan, silakan hubungi Admin HRD & Finance.`,
    ``,
    `Terima kasih atas kerja keras dan kontribusi seluruh tim! 🙏`,
    `*HRD & Finance ${companyName}*`,
  ].join('\n');
}

export function getBroadcastPayslipWhatsAppUrl(
  period: string,
  employeeCount: number,
  totalPayrollAmount: number,
  companyName: string = DEFAULT_COMPANY_NAME,
  targetPhone?: string
): string {
  const message = buildBroadcastPayslipWaMessage(
    period,
    employeeCount,
    totalPayrollAmount,
    companyName
  );
  return generateWhatsAppUrl(targetPhone, message);
}

/**
 * Template Pesan WhatsApp Status Pengajuan Cuti & Izin (Disetujui / Ditolak)
 */
export function buildLeaveStatusWaMessage(
  emp: Employee | undefined,
  leave: LeaveRequest,
  status: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan',
  adminNotes?: string,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const empName = emp?.fullName || 'Karyawan';
  const empNik = emp?.nik ? ` (${emp.nik})` : '';
  const statusIcon =
    status === 'Disetujui' ? '✅ *DISETUJUI*' : status === 'Ditolak' ? '❌ *DITOLAK*' : '⏳ *MENUNGGU PERSETUJUAN*';

  const defaultNote =
    status === 'Disetujui'
      ? 'Permohonan cuti/izin Anda telah disetujui oleh HRD. Pastikan serah terima tugas (handover) dengan rekan satu tim telah diatur dengan baik.'
      : status === 'Ditolak'
      ? 'Mohon maaf, permohonan cuti/izin belum dapat disetujui dikarenakan kebutuhan operasional divisi. Silakan koordinasi dengan HRD/Atasan untuk penjadwalan ulang.'
      : 'Permohonan Anda sedang dalam antrean verifikasi HRD.';

  return [
    `*NOTIFIKASI PENGAJUAN CUTI & IZIN*`,
    `*${companyName.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Halo *${empName}*${empNik},`,
    `Berikut adalah pembaruan status pengajuan Cuti / Izin Anda:`,
    ``,
    `• *Status Pengajuan:* ${statusIcon}`,
    `• *Jenis Cuti/Izin:* ${leave.type}`,
    `• *Tanggal Pelaksanaan:* ${formatIndoDate(leave.startDate)} s/d ${formatIndoDate(
      leave.endDate
    )} (${leave.totalDays} hari kerja)`,
    `• *Alasan Pengajuan:* "${leave.reason}"`,
    emp ? `• *Estimasi Sisa Kuota Cuti Tahunan:* ${emp.remainingLeaveDays} hari` : '',
    ``,
    `📝 *Catatan Admin HRD:*`,
    `${adminNotes?.trim() ? adminNotes.trim() : defaultNote}`,
    ``,
    `Detail status pengajuan dapat dilihat langsung pada menu *Cuti & Izin* di *Portal Karyawan ${companyName}*.`,
    ``,
    `Salam,`,
    `*Admin HRD ${companyName}*`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function getLeaveStatusWhatsAppUrl(
  emp: Employee | undefined,
  leave: LeaveRequest,
  status: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan',
  adminNotes?: string,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const msg = buildLeaveStatusWaMessage(emp, leave, status, adminNotes, companyName);
  return generateWhatsAppUrl(emp?.phone, msg);
}

/**
 * Template Pesan WhatsApp Status Klaim Lembur (Disetujui / Ditolak)
 */
export function buildOvertimeStatusWaMessage(
  emp: Employee | undefined,
  overtime: OvertimeRequest,
  status: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan',
  adminNotes?: string,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const empName = emp?.fullName || 'Karyawan';
  const empNik = emp?.nik ? ` (${emp.nik})` : '';
  const statusIcon =
    status === 'Disetujui' ? '✅ *DISETUJUI*' : status === 'Ditolak' ? '❌ *DITOLAK*' : '⏳ *MENUNGGU PERSETUJUAN*';
  const mins = overtime.minutes || Math.round((overtime.hours || 0) * 60);

  const defaultNote =
    status === 'Disetujui'
      ? 'Klaim lembur Anda telah diverifikasi dan otomatis ditambahkan ke komponen penghasilan Slip Gaji periode berjalan.'
      : 'Klaim lembur belum dapat disetujui. Silakan hubungi Admin HRD apabila memerlukan klarifikasi jam kerja lembur.';

  return [
    `*NOTIFIKASI VERIFIKASI KLAIM LEMBUR*`,
    `*${companyName.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Halo *${empName}*${empNik},`,
    `Berikut adalah status klaim lembur kerja Anda:`,
    ``,
    `• *Status Klaim:* ${statusIcon}`,
    `• *Tanggal Lembur:* ${formatIndoDate(overtime.date)}`,
    `• *Durasi Lembur:* ${formatOvertimeMinutes(mins)}${
      overtime.startTime && overtime.endTime ? ` (${overtime.startTime} - ${overtime.endTime} WIB)` : ''
    }`,
    `• *Nominal Kompensasi Lembur:* ${formatRupiah(overtime.calculatedPay)}`,
    `• *Rincian Tugas:* "${overtime.taskDescription}"`,
    ``,
    `📝 *Catatan Admin HRD:*`,
    `${adminNotes?.trim() ? adminNotes.trim() : defaultNote}`,
    ``,
    `Salam,`,
    `*Admin HRD & Finance ${companyName}*`,
  ].join('\n');
}

export function getOvertimeStatusWhatsAppUrl(
  emp: Employee | undefined,
  overtime: OvertimeRequest,
  status: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan',
  adminNotes?: string,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const msg = buildOvertimeStatusWaMessage(emp, overtime, status, adminNotes, companyName);
  return generateWhatsAppUrl(emp?.phone, msg);
}

/**
 * Template Pesan WhatsApp Status Pengajuan Kasbon & Pinjaman Karyawan
 */
export function buildCashAdvanceStatusWaMessage(
  emp: Employee | undefined,
  advance: CashAdvance,
  status: CashAdvance['status'],
  adminNotes?: string,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const empName = emp?.fullName || advance.employeeName;
  const empNik = emp?.nik || advance.employeeNik;

  const statusLabel =
    status === 'approved'
      ? '✅ *DISETUJUI (MENUNGGU PENCAIRAN)*'
      : status === 'disbursed'
      ? '💸 *DANA TELAH DICAIRKAN*'
      : status === 'rejected'
      ? '❌ *DITOLAK*'
      : status === 'paid'
      ? '🎉 *LUNAS*'
      : '⏳ *MENUNGGU PERSETUJUAN*';

  const noteText =
    adminNotes?.trim() ||
    (status === 'rejected'
      ? advance.rejectionReason || 'Permohonan kasbon belum dapat disetujui sesuai kebijakan plafon perusahaan.'
      : status === 'disbursed'
      ? advance.notes ||
        `Dana kasbon telah ditransfer (${
          advance.disbursementMethod || 'Transfer Bank'
        }${advance.disbursementReference ? ` • Ref: ${advance.disbursementReference}` : ''}). Pemotongan cicilan dilakukan otomatis melalui Slip Gaji.`
      : status === 'approved'
      ? 'Permohonan kasbon Anda telah disetujui oleh HRD/Manajemen dan segera diproses pencairannya oleh tim Finance.'
      : 'Permohonan kasbon sedang ditinjau oleh Admin HRD & Finance.');

  return [
    `*NOTIFIKASI PENGAJUAN KASBON & PINJAMAN*`,
    `*${companyName.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Halo *${empName}* (${empNik}),`,
    `Berikut informasi terbaru mengenai pengajuan Kasbon Karyawan Anda:`,
    ``,
    `• *ID Pengajuan:* ${advance.id}`,
    `• *Status Kasbon:* ${statusLabel}`,
    `• *Tanggal Pengajuan:* ${formatIndoDate(advance.createdAt)}`,
    `• *Nominal Pinjaman:* ${formatRupiah(advance.amount)}`,
    `• *Tenor & Cicilan:* ${advance.tenorMonths} Bulan (@ ${formatRupiah(
      advance.monthlyInstallment
    )}/bulan)`,
    `• *Keperluan:* "${advance.reason}"`,
    ``,
    `📝 *Catatan Admin / Finance:*`,
    `${noteText}`,
    ``,
    `Anda dapat memantau jadwal angsuran dan sisa saldo kasbon secara transparan di *Portal Karyawan ${companyName}* (menu *Kasbon*).`,
    ``,
    `Salam,`,
    `*HRD & Finance ${companyName}*`,
  ].join('\n');
}

export function getCashAdvanceStatusWhatsAppUrl(
  emp: Employee | undefined,
  advance: CashAdvance,
  status: CashAdvance['status'],
  adminNotes?: string,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const msg = buildCashAdvanceStatusWaMessage(emp, advance, status, adminNotes, companyName);
  return generateWhatsAppUrl(emp?.phone, msg);
}

/**
 * Template Pesan WhatsApp Pengingat Masa Aktif Kontrak Kerja PKWT (H-30 / Akan Berakhir)
 */
export function buildContractReminderWaMessage(
  emp: Employee,
  daysRemaining: number | null,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const endDateFormatted = emp.contractEndDate
    ? formatIndoDate(emp.contractEndDate)
    : 'Segera Berakhir';
  const startDateFormatted = emp.contractStartDate
    ? formatIndoDate(emp.contractStartDate)
    : formatIndoDate(emp.joinDate);

  const urgencyLine =
    daysRemaining !== null && daysRemaining < 0
      ? `⚠️ *Telah Berakhir (${Math.abs(daysRemaining)} hari yang lalu)*`
      : daysRemaining === 0
      ? `⚠️ *Berakhir Hari Ini*`
      : `⏳ *Sisa ${daysRemaining ?? 30} Hari Lagi (H-${daysRemaining ?? 30})*`;

  return [
    `*PEMBERITAHUAN MASA AKTIF KONTRAK KERJA (PKWT)*`,
    `*${companyName.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Halo *${emp.fullName}* (${emp.nik}),`,
    `Semoga Anda selalu dalam keadaan sehat dan semangat bekerja.`,
    ``,
    `Melalui pesan ini, Tim HRD *${companyName}* mengingatkan bahwa masa aktif Perjanjian Kerja Waktu Tertentu (*${emp.employmentStatus}*) Anda akan segera memasuki masa evaluasi dengan rincian:`,
    ``,
    `• *Nama Karyawan:* ${emp.fullName}`,
    `• *Jabatan / Divisi:* ${emp.role} — ${emp.department}`,
    `• *No. Dokumen Kontrak:* ${emp.contractDocumentNumber || 'PKWT Standar HRD'}`,
    `• *Tanggal Mulai Kontrak:* ${startDateFormatted}`,
    `• *Tanggal Berakhir Kontrak:* *${endDateFormatted}*`,
    `• *Status Masa Aktif:* ${urgencyLine}`,
    ``,
    `📌 *Agenda Evaluasi & Perpanjangan Kontrak:*`,
    `Mohon kesediaannya untuk mengikuti sesi evaluasi kinerja dan konfirmasi perpanjangan kontrak kerja bersama HRD & Kepala Divisi *${emp.department}* sebelum tanggal berakhirnya kontrak.`,
    ``,
    `Anda juga dapat memeriksa detail masa aktif serta mengunduh dokumen kontrak kerja Anda melalui *Portal Karyawan ${companyName}* pada menu *Profil Saya*.`,
    ``,
    `Terima kasih atas kerja sama dan kontribusi Anda.`,
    `Salam hangat,`,
    `*Departemen HRD ${companyName}*`,
  ].join('\n');
}

export function getContractReminderWhatsAppUrl(
  emp: Employee,
  daysRemaining: number | null,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const msg = buildContractReminderWaMessage(emp, daysRemaining, companyName);
  return generateWhatsAppUrl(emp.phone, msg);
}

export function getContractReminderEmailUrl(
  emp: Employee,
  daysRemaining: number | null,
  companyName: string = DEFAULT_COMPANY_NAME
): string {
  const subject = `[Pengingat HRD] Evaluasi & Masa Berakhir Kontrak Kerja PKWT - ${emp.fullName} (${emp.nik})`;
  const body = buildContractReminderWaMessage(emp, daysRemaining, companyName).replace(/\*/g, '');
  return generateMailtoUrl(emp.email, subject, body);
}
