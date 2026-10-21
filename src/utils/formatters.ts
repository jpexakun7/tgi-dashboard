import { Employee, PayrollRecord, PTKPStatus } from '../types';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export const formatCurrency = formatRupiah;
export const formatIDR = formatRupiah;

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}

export function formatIndoDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

// Terbilang Rupiah untuk Slip Gaji Resmi
export function terbilang(angka: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
    'Sepuluh', 'Sebelas'
  ];

  const n = Math.floor(Math.abs(angka));

  if (n < 12) {
    return bilangan[n];
  } else if (n < 20) {
    return terbilang(n - 10) + ' Belas';
  } else if (n < 100) {
    return terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10);
  } else if (n < 200) {
    return 'Seratus ' + terbilang(n - 100);
  } else if (n < 1000) {
    return terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100);
  } else if (n < 2000) {
    return 'Seribu ' + terbilang(n - 1000);
  } else if (n < 1000000) {
    return terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000);
  } else if (n < 1000000000) {
    return terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000);
  } else if (n < 1000000000000) {
    return terbilang(Math.floor(n / 1000000000)) + ' Miliar ' + terbilang(n % 1000000000);
  }
  return n.toString();
}

export function terbilangRupiah(amount: number): string {
  if (amount === 0) return 'Nol Rupiah';
  const clean = terbilang(amount).replace(/\s+/g, ' ').trim();
  return `${clean} Rupiah`;
}

// Penentuan Kategori TER (Tarif Efektif Rata-Rata) Ketentuan Terbaru 2026 (Coretax DJP & PP 58/PMK 168)
export function getTERCategory(ptkp: PTKPStatus): 'A' | 'B' | 'C' {
  // Kategori A: TK/0, TK/1, K/0
  if (ptkp === 'TK/0' || ptkp === 'TK/1' || ptkp === 'K/0') return 'A';
  // Kategori B: TK/2, TK/3, K/1, K/2
  if (ptkp === 'TK/2' || ptkp === 'TK/3' || ptkp === 'K/1' || ptkp === 'K/2') return 'B';
  // Kategori C: K/3
  return 'C';
}

// Tarif TER Bulanan berdasarkan Bruto Penghasilan (Ketentuan Terbaru 2026 - Sistem Coretax DJP)
export function getTERRate(category: 'A' | 'B' | 'C', grossMonthly: number): number {
  if (category === 'A') {
    if (grossMonthly <= 5400000) return 0.00;
    if (grossMonthly <= 5650000) return 0.0025;
    if (grossMonthly <= 5950000) return 0.005;
    if (grossMonthly <= 6300000) return 0.0075;
    if (grossMonthly <= 6750000) return 0.01;
    if (grossMonthly <= 7500000) return 0.0125;
    if (grossMonthly <= 8550000) return 0.015;
    if (grossMonthly <= 9650000) return 0.0175;
    if (grossMonthly <= 10050000) return 0.02;
    if (grossMonthly <= 10350000) return 0.0225;
    if (grossMonthly <= 10700000) return 0.025;
    if (grossMonthly <= 11050000) return 0.03;
    if (grossMonthly <= 11600000) return 0.035;
    if (grossMonthly <= 12500000) return 0.04;
    if (grossMonthly <= 13750000) return 0.05;
    if (grossMonthly <= 15100000) return 0.06;
    if (grossMonthly <= 16950000) return 0.07;
    if (grossMonthly <= 19750000) return 0.08;
    if (grossMonthly <= 24150000) return 0.09;
    if (grossMonthly <= 26450000) return 0.10;
    if (grossMonthly <= 28000000) return 0.11;
    if (grossMonthly <= 30050000) return 0.12;
    if (grossMonthly <= 32400000) return 0.13;
    if (grossMonthly <= 35400000) return 0.14;
    if (grossMonthly <= 39100000) return 0.15;
    if (grossMonthly <= 43850000) return 0.16;
    if (grossMonthly <= 47800000) return 0.17;
    if (grossMonthly <= 51400000) return 0.18;
    if (grossMonthly <= 56300000) return 0.19;
    return 0.20;
  } else if (category === 'B') {
    if (grossMonthly <= 6200000) return 0.00;
    if (grossMonthly <= 6500000) return 0.0025;
    if (grossMonthly <= 6850000) return 0.005;
    if (grossMonthly <= 7300000) return 0.0075;
    if (grossMonthly <= 9200000) return 0.01;
    if (grossMonthly <= 10750000) return 0.015;
    if (grossMonthly <= 11250000) return 0.02;
    if (grossMonthly <= 11600000) return 0.025;
    if (grossMonthly <= 12600000) return 0.03;
    if (grossMonthly <= 13600000) return 0.04;
    if (grossMonthly <= 14950000) return 0.05;
    if (grossMonthly <= 16400000) return 0.06;
    if (grossMonthly <= 18450000) return 0.07;
    if (grossMonthly <= 21850000) return 0.08;
    if (grossMonthly <= 26000000) return 0.09;
    if (grossMonthly <= 27700000) return 0.10;
    if (grossMonthly <= 29350000) return 0.11;
    if (grossMonthly <= 31450000) return 0.12;
    if (grossMonthly <= 33950000) return 0.13;
    if (grossMonthly <= 37100000) return 0.14;
    if (grossMonthly <= 41100000) return 0.15;
    if (grossMonthly <= 45800000) return 0.16;
    return 0.18;
  } else {
    // Kategori C
    if (grossMonthly <= 6600000) return 0.00;
    if (grossMonthly <= 6950000) return 0.0025;
    if (grossMonthly <= 7350000) return 0.005;
    if (grossMonthly <= 7800000) return 0.0075;
    if (grossMonthly <= 8850000) return 0.01;
    if (grossMonthly <= 9800000) return 0.0125;
    if (grossMonthly <= 10950000) return 0.015;
    if (grossMonthly <= 11200000) return 0.0175;
    if (grossMonthly <= 12050000) return 0.02;
    if (grossMonthly <= 12950000) return 0.03;
    if (grossMonthly <= 14150000) return 0.04;
    if (grossMonthly <= 15550000) return 0.05;
    if (grossMonthly <= 17050000) return 0.06;
    if (grossMonthly <= 19500000) return 0.07;
    if (grossMonthly <= 22700000) return 0.08;
    if (grossMonthly <= 26600000) return 0.09;
    return 0.11;
  }
}

// Hitung Payroll Karyawan Lengkap sesuai Regulasi Indonesia
export function calculatePayroll(
  employee: Employee,
  period: string,
  overtimeHours: number = 0,
  bonus: number = 0,
  lateMinutes: number = 0,
  cashAdvanceDeduction: number = 0,
  cashAdvanceNotes?: string
): PayrollRecord {
  const baseSalary = Number(employee.baseSalary) || 0;
  const allowances = employee.allowances || { position: 0, transport: 0, meal: 0, communication: 0 };
  const position = Number(allowances.position) || 0;
  const transport = Number(allowances.transport) || 0;
  const meal = Number(allowances.meal) || 0;
  const communication = Number(allowances.communication) || 0;

  // Lembur Kemenaker: 1/173 x Gaji Sebulan (Gaji Pokok + Tunjangan Tetap)
  const hourlyRate = (baseSalary + position) / 173;
  const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);

  const totalGrossSalary = baseSalary + position + transport + meal + communication + overtimePay + bonus;

  // Denda Keterlambatan: Rp 2.000 / menit terlambat (kebijakan perusahaan)
  const lateDeduction = lateMinutes > 15 ? Math.round((lateMinutes - 15) * 2000) : 0;

  // BPJS Kesehatan: Max batas atas Rp 12.000.000
  const bpjsKesBase = Math.min(baseSalary + position, 12000000);
  const bpjsKesehatanEmployee = Math.round(bpjsKesBase * 0.01); // 1% potong gaji
  const bpjsKesehatanEmployer = Math.round(bpjsKesBase * 0.04); // 4% ditanggung perusahaan

  // BPJS Ketenagakerjaan: JHT (Jaminan Hari Tua)
  const bpjsJhtBase = baseSalary + position;
  const bpjsJhtEmployee = Math.round(bpjsJhtBase * 0.02); // 2% potong gaji
  const bpjsJhtEmployer = Math.round(bpjsJhtBase * 0.037); // 3.7% perusahaan

  // BPJS Ketenagakerjaan: JP (Jaminan Pensiun) - Plafon 2026: Rp 10.600.000
  const bpjsJpBase = Math.min(baseSalary + position, 10600000);
  const bpjsJpEmployee = Math.round(bpjsJpBase * 0.01); // 1% potong gaji
  const bpjsJpEmployer = Math.round(bpjsJpBase * 0.02); // 2% perusahaan

  // JKK & JKM (Ditanggung perusahaan seluruhnya)
  const bpjsJkkEmployer = Math.round(bpjsJhtBase * 0.0024); // 0.24% risiko rendah
  const bpjsJkmEmployer = Math.round(bpjsJhtBase * 0.003);  // 0.3%

  // PPh 21 TER Ketentuan Terbaru 2026 (Sistem Coretax DJP)
  const category = getTERCategory(employee.ptkpStatus);
  const terRate = getTERRate(category, totalGrossSalary);
  const pph21TER = Math.round(totalGrossSalary * terRate);

  const totalDeductions =
    lateDeduction +
    bpjsKesehatanEmployee +
    bpjsJhtEmployee +
    bpjsJpEmployee +
    pph21TER +
    (cashAdvanceDeduction || 0);
  const takeHomePay = Math.max(0, totalGrossSalary - totalDeductions);

  const cleanPeriod = period.replace(/\s+/g, '').toUpperCase();
  const referenceNumber = `TGI-PAY-${cleanPeriod}-${employee.nik}`;

  return {
    id: `pay-${employee.id}-${Date.now()}`,
    employeeId: employee.id,
    period,
    createdAt: new Date().toISOString(),
    baseSalary,
    allowancePosition: position,
    allowanceTransport: transport,
    allowanceMeal: meal,
    allowanceCommunication: communication,
    overtimePay,
    bonus,
    totalGrossSalary,
    lateDeduction,
    bpjsKesehatanEmployee,
    bpjsKesehatanEmployer,
    bpjsJhtEmployee,
    bpjsJhtEmployer,
    bpjsJpEmployee,
    bpjsJpEmployer,
    bpjsJkkEmployer,
    bpjsJkmEmployer,
    pph21TER,
    otherDeductions: 0,
    cashAdvanceDeduction: cashAdvanceDeduction || 0,
    cashAdvanceNotes,
    totalDeductions,
    takeHomePay,
    paymentStatus: 'Lunas',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber,
  };
}
