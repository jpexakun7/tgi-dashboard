import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, PayrollRecord, CompanyConfig, PayrollSignatoriesConfig } from '../types';
import { formatRupiah, formatIndoDate, getPayrollSignatoriesConfig } from './formatters';

export interface ExportPayrollOptions {
  period?: string;
  departmentFilter?: string;
  searchFilter?: string;
  signatories?: PayrollSignatoriesConfig;
}

/**
 * Ekspor Data Payroll Lengkap ke format CSV (Excel-Compatible UTF-8)
 */
export function exportPayrollToCSV(
  payrolls: PayrollRecord[],
  employees: Employee[],
  companyConfig: CompanyConfig,
  options?: ExportPayrollOptions
): void {
  const currentPeriod = options?.period || companyConfig.currentPayrollPeriod;
  const fileName = `Laporan_Payroll_TGI_${currentPeriod.replace(/\s+/g, '_')}.csv`;

  const headers = [
    'No',
    'No Referensi Slip',
    'NIK',
    'Nama Karyawan',
    'Departemen',
    'Jabatan',
    'Status Kerja',
    'Status PTKP',
    'Gaji Pokok (Rp)',
    'Tunj. Jabatan (Rp)',
    'Tunj. Transport (Rp)',
    'Tunj. Makan (Rp)',
    'Tunj. Komunikasi (Rp)',
    'Total Tunjangan (Rp)',
    'Upah Lembur (Rp)',
    'Bonus / Insentif (Rp)',
    'Total Gaji Kotor (Rp)',
    'Pot. Keterlambatan (Rp)',
    'BPJS Kesehatan 1% (Rp)',
    'BPJS JHT 2% (Rp)',
    'BPJS JP 1% (Rp)',
    'PPh 21 TER (Rp)',
    'Pot. Kasbon (Rp)',
    'Pot. Lainnya (Rp)',
    'Total Potongan (Rp)',
    'Gaji Bersih / THP (Rp)',
    'Status Pembayaran',
    'Bank Tujuan',
    'Nomor Rekening',
    'Atas Nama Rekening',
  ];

  let totalBaseSalary = 0;
  let totalAllowances = 0;
  let totalOvertime = 0;
  let totalBonus = 0;
  let totalGross = 0;
  let totalLate = 0;
  let totalBpjsKes = 0;
  let totalBpjsJht = 0;
  let totalBpjsJp = 0;
  let totalPph21 = 0;
  let totalKasbon = 0;
  let totalOtherDeductions = 0;
  let totalDeductions = 0;
  let totalTakeHomePay = 0;

  const rows = payrolls.map((record, index) => {
    const emp = employees.find((e) => e.id === record.employeeId);
    const sumAllowances =
      record.allowancePosition +
      record.allowanceTransport +
      record.allowanceMeal +
      record.allowanceCommunication;

    totalBaseSalary += record.baseSalary;
    totalAllowances += sumAllowances;
    totalOvertime += record.overtimePay;
    totalBonus += record.bonus;
    totalGross += record.totalGrossSalary;
    totalLate += record.lateDeduction || 0;
    totalBpjsKes += record.bpjsKesehatanEmployee || 0;
    totalBpjsJht += record.bpjsJhtEmployee || 0;
    totalBpjsJp += record.bpjsJpEmployee || 0;
    totalPph21 += record.pph21TER || 0;
    totalKasbon += record.cashAdvanceDeduction || 0;
    totalOtherDeductions += record.otherDeductions || 0;
    totalDeductions += record.totalDeductions;
    totalTakeHomePay += record.takeHomePay;

    return [
      index + 1,
      `"${record.referenceNumber}"`,
      `"'${emp?.nik || ''}"`,
      `"${(emp?.fullName || '').replace(/"/g, '""')}"`,
      `"${emp?.department || ''}"`,
      `"${emp?.role || ''}"`,
      `"${emp?.employmentStatus || ''}"`,
      `"${emp?.ptkpStatus || ''}"`,
      record.baseSalary,
      record.allowancePosition,
      record.allowanceTransport,
      record.allowanceMeal,
      record.allowanceCommunication,
      sumAllowances,
      record.overtimePay,
      record.bonus,
      record.totalGrossSalary,
      record.lateDeduction || 0,
      record.bpjsKesehatanEmployee || 0,
      record.bpjsJhtEmployee || 0,
      record.bpjsJpEmployee || 0,
      record.pph21TER || 0,
      record.cashAdvanceDeduction || 0,
      record.otherDeductions || 0,
      record.totalDeductions,
      record.takeHomePay,
      `"${record.paymentStatus}"`,
      `"${emp?.bankName || ''}"`,
      `"'${emp?.bankAccountNumber || ''}"`,
      `"${(emp?.bankAccountHolder || emp?.fullName || '').replace(/"/g, '""')}"`,
    ];
  });

  // Baris Total Ringkasan
  const totalRow = [
    'TOTAL',
    `"SEMUA (${payrolls.length} KARYAWAN)"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    totalBaseSalary,
    '""',
    '""',
    '""',
    '""',
    totalAllowances,
    totalOvertime,
    totalBonus,
    totalGross,
    totalLate,
    totalBpjsKes,
    totalBpjsJht,
    totalBpjsJp,
    totalPph21,
    totalKasbon,
    totalOtherDeductions,
    totalDeductions,
    totalTakeHomePay,
    '""',
    '""',
    '""',
    '""',
  ];

  // Tambahkan Metadata Perusahaan di Atas File CSV
  const metaLines = [
    `"LAPORAN REKAPITULASI PENGGAJIAN KARYAWAN (PAYROLL)"`,
    `"Perusahaan: ${companyConfig.companyName}"`,
    `"Periode: ${currentPeriod}"`,
    `"Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}"`,
    `"Bank Pencairan: ${companyConfig.disbursementBank} (${companyConfig.disbursementAccount})"`,
    `""`,
  ];

  const csvRows = [
    ...metaLines,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
    totalRow.join(','),
  ];

  // UTF-8 BOM (\uFEFF) untuk memastikan aksen dan simbol terbuka dengan sempurna di Excel
  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Ekspor Data Payroll Resmi ke format Dokumen PDF (A4 Landscape)
 */
export function exportPayrollToPDF(
  payrolls: PayrollRecord[],
  employees: Employee[],
  companyConfig: CompanyConfig,
  options?: ExportPayrollOptions
): void {
  const currentPeriod = options?.period || companyConfig.currentPayrollPeriod;
  const fileName = `Laporan_Payroll_TGI_${currentPeriod.replace(/\s+/g, '_')}.pdf`;

  // Inisialisasi dokumen jsPDF (Landscape, Milimeter, Ukuran A4)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Header Banner & Identitas Perusahaan
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Logo TGI Badge
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.roundedRect(14, 5, 14, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TGI', 21, 14, { align: 'center' });

  // Teks Kop
  doc.setFontSize(14);
  doc.text(companyConfig.companyName.toUpperCase(), 32, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(
    'LAPORAN RESMI REKAPITULASI PENGGAJIAN KARYAWAN BULANAN (PAYROLL DISBURSEMENT REPORT)',
    32,
    17
  );

  // Periode & Tanggal di Pojok Kanan Atas
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153); // Emerald 400
  doc.text(`Periode: ${currentPeriod}`, pageWidth - 14, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} | Cut-off Tgl ${companyConfig.cutOffEndDay}`,
    pageWidth - 14,
    17,
    { align: 'right' }
  );

  // 2. Ringkasan Eksekutif (Metrics Card)
  const totalBaseSalary = payrolls.reduce((a, b) => a + b.baseSalary, 0);
  const totalGross = payrolls.reduce((a, b) => a + b.totalGrossSalary, 0);
  const totalPph21 = payrolls.reduce((a, b) => a + b.pph21TER, 0);
  const totalDeductions = payrolls.reduce((a, b) => a + b.totalDeductions, 0);
  const totalTakeHomePay = payrolls.reduce((a, b) => a + b.takeHomePay, 0);

  // Background Ringkasan
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(14, 28, pageWidth - 28, 17, 2, 2, 'FD');

  const cardWidth = (pageWidth - 28) / 5;
  const metrics = [
    { label: 'Jumlah Karyawan', value: `${payrolls.length} Staf`, sub: '100% Terverifikasi' },
    { label: 'Total Gaji Pokok', value: formatRupiah(totalBaseSalary), sub: 'Plafon Dasar' },
    { label: 'Total Gaji Kotor (Gross)', value: formatRupiah(totalGross), sub: 'Termasuk Tunj & Lembur' },
    { label: 'Total Potongan & Pajak', value: formatRupiah(totalDeductions), sub: `PPh 21: ${formatRupiah(totalPph21)}` },
    { label: 'Total Gaji Bersih (THP)', value: formatRupiah(totalTakeHomePay), sub: 'Siap Dicairkan', highlight: true },
  ];

  metrics.forEach((m, idx) => {
    const x = 14 + idx * cardWidth + 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(m.label.toUpperCase(), x, 33);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    if (m.highlight) {
      doc.setTextColor(5, 150, 105); // Emerald 600
    } else {
      doc.setTextColor(15, 23, 42); // Slate 900
    }
    doc.text(m.value, x, 39);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(m.sub, x, 43);
  });

  // 3. Tabel Payroll Detail dengan autoTable
  const tableHeaders = [
    [
      'No',
      'NIK',
      'Nama Karyawan',
      'Departemen',
      'Gaji Pokok',
      'Tunjangan',
      'Lembur+Bonus',
      'Gaji Kotor',
      'PPh 21 TER',
      'Total Pot.',
      'Gaji Bersih (THP)',
      'Status',
      'Bank & Rekening',
    ],
  ];

  const tableData = payrolls.map((record, index) => {
    const emp = employees.find((e) => e.id === record.employeeId);
    const sumAllowances =
      record.allowancePosition +
      record.allowanceTransport +
      record.allowanceMeal +
      record.allowanceCommunication;
    const sumOvertimeBonus = record.overtimePay + record.bonus;

    return [
      index + 1,
      emp?.nik || '-',
      emp?.fullName || '-',
      emp?.department || '-',
      formatRupiah(record.baseSalary),
      formatRupiah(sumAllowances),
      formatRupiah(sumOvertimeBonus),
      formatRupiah(record.totalGrossSalary),
      formatRupiah(record.pph21TER),
      `(${formatRupiah(record.totalDeductions)})`,
      formatRupiah(record.takeHomePay),
      record.paymentStatus,
      `${emp?.bankName || 'BCA'} ${emp?.bankAccountNumber || ''}`,
    ];
  });

  // Tambahkan baris total di akhir tabel
  tableData.push([
    '',
    'TOTAL',
    `Seluruh Staf (${payrolls.length})`,
    '-',
    formatRupiah(totalBaseSalary),
    formatRupiah(
      payrolls.reduce(
        (a, b) =>
          a +
          b.allowancePosition +
          b.allowanceTransport +
          b.allowanceMeal +
          b.allowanceCommunication,
        0
      )
    ),
    formatRupiah(payrolls.reduce((a, b) => a + b.overtimePay + b.bonus, 0)),
    formatRupiah(totalGross),
    formatRupiah(totalPph21),
    `(${formatRupiah(totalDeductions)})`,
    formatRupiah(totalTakeHomePay),
    'LUNAS',
    `${companyConfig.disbursementBank}`,
  ]);

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: 48,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 }, // No
      1: { halign: 'center', cellWidth: 18 }, // NIK
      2: { fontStyle: 'bold', cellWidth: 32 }, // Nama
      3: { cellWidth: 26 }, // Departemen
      4: { halign: 'right', cellWidth: 20 }, // Gaji Pokok
      5: { halign: 'right', cellWidth: 19 }, // Tunjangan
      6: { halign: 'right', cellWidth: 19 }, // Lembur+Bonus
      7: { halign: 'right', cellWidth: 21, fontStyle: 'bold' }, // Gaji Kotor
      8: { halign: 'right', cellWidth: 17, textColor: [180, 83, 9] }, // PPh 21
      9: { halign: 'right', cellWidth: 20, textColor: [225, 29, 72] }, // Potongan
      10: {
        halign: 'right',
        cellWidth: 23,
        fontStyle: 'bold',
        textColor: [5, 150, 105],
      }, // Gaji Bersih
      11: { halign: 'center', cellWidth: 16 }, // Status
      12: { cellWidth: 27, fontSize: 6.5 }, // Bank
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Baris terakhir adalah baris TOTAL
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        if (data.column.index === 10) {
          data.cell.styles.textColor = [5, 150, 105];
        }
      }
    },
  });

  // 4. Kolom Pengesahan Tanda Tangan Resmi (Dinamis dari Konfigurasi Penandatangan)
  const sigConfig = options?.signatories || getPayrollSignatoriesConfig(companyConfig);
  const dateText =
    sigConfig.customDateText && sigConfig.customDateText.trim()
      ? sigConfig.customDateText.trim()
      : new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
  const cityAndDate = `${sigConfig.city || 'Jakarta'}, ${dateText}`;

  // Ambil posisi Y terakhir dari tabel
  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  // Jika posisi terlalu dekat dengan batas bawah, buat halaman baru
  let signY = finalY + 8;
  if (signY + 42 > pageHeight) {
    doc.addPage();
    signY = 20;
  }

  const signColWidth = (pageWidth - 28) / 3;
  const signatures = [
    {
      title: sigConfig.preparedBy.headerLabel || 'Disiapkan Oleh,',
      topSubtitle: sigConfig.preparedBy.topSubtitle || 'Staff HR & Payroll Admin',
      name: sigConfig.preparedBy.name || '( .................................... )',
      role: sigConfig.preparedBy.jobTitle || 'HR Department',
      signatureDataUrl: sigConfig.preparedBy.signatureDataUrl,
      stampDataUrl:
        sigConfig.preparedBy.stampDataUrl || sigConfig.companyStampDataUrl,
      showStamp: Boolean(sigConfig.preparedBy.showStamp),
      date: cityAndDate,
    },
    {
      title: sigConfig.verifiedBy.headerLabel || 'Diperiksa & Diverifikasi,',
      topSubtitle: sigConfig.verifiedBy.topSubtitle || 'Finance & Accounting Lead',
      name: sigConfig.verifiedBy.name || '( .................................... )',
      role: sigConfig.verifiedBy.jobTitle || 'Finance Department',
      signatureDataUrl: sigConfig.verifiedBy.signatureDataUrl,
      stampDataUrl:
        sigConfig.verifiedBy.stampDataUrl || sigConfig.companyStampDataUrl,
      showStamp: Boolean(sigConfig.verifiedBy.showStamp),
      date: cityAndDate,
    },
    {
      title: sigConfig.approvedBy.headerLabel || 'Disetujui Oleh,',
      topSubtitle: sigConfig.approvedBy.topSubtitle || 'Direktur Utama',
      name: sigConfig.approvedBy.name || '( .................................... )',
      role: sigConfig.approvedBy.jobTitle || 'Direktur Utama',
      signatureDataUrl: sigConfig.approvedBy.signatureDataUrl,
      stampDataUrl:
        sigConfig.approvedBy.stampDataUrl || sigConfig.companyStampDataUrl,
      showStamp: Boolean(sigConfig.approvedBy.showStamp),
      date: cityAndDate,
    },
  ];

  signatures.forEach((sig, idx) => {
    const x = 14 + idx * signColWidth;
    const centerX = x + signColWidth / 2;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(sig.date, centerX, signY, { align: 'center' });
    doc.text(sig.title, centerX, signY + 4, { align: 'center' });

    if (sig.topSubtitle) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(sig.topSubtitle, centerX, signY + 7.5, { align: 'center' });
    }

    // Gambar Stempel Perusahaan (jika diaktifkan pada kolom ini)
    if (sig.showStamp && sig.stampDataUrl) {
      try {
        const format = sig.stampDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(sig.stampDataUrl, format, centerX - 22, signY + 7, 20, 20);
      } catch (err) {
        console.warn('Gagal menyematkan gambar stempel ke PDF:', err);
      }
    }

    // Gambar Tanda Tangan Digital (jika diunggah/dibuat)
    if (sig.signatureDataUrl) {
      try {
        const format = sig.signatureDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(sig.signatureDataUrl, format, centerX - 18, signY + 8.5, 36, 15);
      } catch (err) {
        console.warn('Gagal menyematkan gambar tanda tangan ke PDF:', err);
      }
    }

    // Garis tanda tangan
    doc.setDrawColor(148, 163, 184);
    doc.line(x + 15, signY + 25, x + signColWidth - 15, signY + 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.name, centerX, signY + 29, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.role, centerX, signY + 33, { align: 'center' });
  });

  // 5. Footer Nomor Halaman
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dokumen Resmi PT Tas Grosir Import • Diunduh melalui TGI Dashboard Penggajian & HR`,
      14,
      pageHeight - 6
    );
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - 14,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // Unduh dokumen PDF secara otomatis
  doc.save(fileName);
}
