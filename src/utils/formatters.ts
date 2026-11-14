import {
  Employee,
  EmploymentType,
  PayrollRecord,
  PTKPStatus,
  WorkShift,
  AttendanceRecord,
  AttendancePenaltyPolicy,
  SignatoryItemConfig,
  PayrollSignatoriesConfig,
  CompanyConfig,
  DecemberPPh21ReconciliationResult,
  DailyWorkWageItem,
  LiveStreamSalesRecord,
  EmployeeBonus,
  EmployeeAdjustment,
  PayrollDeductionRecord,
  LeaveRequest,
  OvertimeRequest,
  ThrPayoutRecord,
  ThrEligibilityStatus,
  PartTimeWorkLog,
} from '../types';

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

export const JAKARTA_TIMEZONE = 'Asia/Jakarta';

const INDO_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTH_NAMES_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const INDO_MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export interface JakartaDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  seconds: number; // 0-59
  dayOfWeek: number; // 0 (Minggu) - 6 (Sabtu)
  yearStr: string;
  monthStr: string;
  dayStr: string;
  hoursStr: string;
  minutesStr: string;
  secondsStr: string;
}

/**
 * Mengambil komponen waktu lokal Indonesia Barat (WIB / Asia/Jakarta / UTC+7) secara akurat
 * tanpa terpengaruh timezone lokal browser/server.
 */
export function getJakartaDateParts(date: Date = new Date()): JakartaDateParts {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: JAKARTA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(safeDate);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = p.value;
      }
    }
    const year = parseInt(map.year || '2026', 10);
    const month = parseInt(map.month || '1', 10);
    const day = parseInt(map.day || '1', 10);
    let hours = parseInt(map.hour || '0', 10);
    if (hours === 24) hours = 0;
    const minutes = parseInt(map.minute || '0', 10);
    const seconds = parseInt(map.second || '0', 10);

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek =
      weekdayMap[map.weekday] !== undefined
        ? weekdayMap[map.weekday]
        : new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();

    return {
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      dayOfWeek,
      yearStr: String(year).padStart(4, '0'),
      monthStr: String(month).padStart(2, '0'),
      dayStr: String(day).padStart(2, '0'),
      hoursStr: String(hours).padStart(2, '0'),
      minutesStr: String(minutes).padStart(2, '0'),
      secondsStr: String(seconds).padStart(2, '0'),
    };
  } catch {
    // Fallback eksplisit ke UTC+7 (WIB)
    const wibMs = safeDate.getTime() + 7 * 60 * 60 * 1000;
    const wibDate = new Date(wibMs);
    const year = wibDate.getUTCFullYear();
    const month = wibDate.getUTCMonth() + 1;
    const day = wibDate.getUTCDate();
    const hours = wibDate.getUTCHours();
    const minutes = wibDate.getUTCMinutes();
    const seconds = wibDate.getUTCSeconds();
    const dayOfWeek = wibDate.getUTCDay();
    return {
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      dayOfWeek,
      yearStr: String(year).padStart(4, '0'),
      monthStr: String(month).padStart(2, '0'),
      dayStr: String(day).padStart(2, '0'),
      hoursStr: String(hours).padStart(2, '0'),
      minutesStr: String(minutes).padStart(2, '0'),
      secondsStr: String(seconds).padStart(2, '0'),
    };
  }
}

/**
 * Mengembalikan string tanggal YYYY-MM-DD sesuai waktu lokal Indonesia (WIB / Asia/Jakarta).
 * Menggantikan `new Date().toISOString().split('T')[0]` agar tidak mundur 1 hari antara pukul 00:00 - 06:59 WIB.
 */
export function getJakartaDateString(date: Date = new Date()): string {
  const { yearStr, monthStr, dayStr } = getJakartaDateParts(date);
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Mengembalikan string periode tahun-bulan YYYY-MM sesuai waktu lokal Indonesia (WIB / Asia/Jakarta).
 */
export function getJakartaYearMonth(date: Date = new Date()): string {
  const { yearStr, monthStr } = getJakartaDateParts(date);
  return `${yearStr}-${monthStr}`;
}

/**
 * Mengembalikan string jam HH:mm atau HH:mm:ss sesuai waktu lokal Indonesia (WIB / Asia/Jakarta).
 */
export function getJakartaTimeString(
  date: Date = new Date(),
  includeSeconds: boolean = false
): string {
  const { hoursStr, minutesStr, secondsStr } = getJakartaDateParts(date);
  return includeSeconds ? `${hoursStr}:${minutesStr}:${secondsStr}` : `${hoursStr}:${minutesStr}`;
}

/**
 * Mengembalikan ISO-8601 Timestamp dengan offset eksplisit +07:00 (WIB / Asia/Jakarta)
 * agar sinkron saat disimpan ke Supabase.
 */
export function getJakartaIsoTimestamp(date: Date = new Date()): string {
  const { yearStr, monthStr, dayStr, hoursStr, minutesStr, secondsStr } = getJakartaDateParts(date);
  return `${yearStr}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}:${secondsStr}+07:00`;
}

/**
 * Mengembalikan format lengkap Hari, Tanggal & Jam WIB untuk tampilan jam digital real-time.
 */
export function getJakartaFullDateTimeLabel(
  date: Date = new Date(),
  includeSeconds: boolean = true
): {
  dayName: string;
  fullDayDate: string;
  shortDayDate: string;
  timeOnly: string;
  timeWithZone: string;
  compactLabel: string;
} {
  const p = getJakartaDateParts(date);
  const dayName = INDO_DAY_NAMES[p.dayOfWeek] || 'Senin';
  const monthFull = INDO_MONTH_NAMES_FULL[p.month - 1] || 'Januari';
  const monthShort = INDO_MONTH_NAMES_SHORT[p.month - 1] || 'Jan';
  const fullDayDate = `${dayName}, ${p.day} ${monthFull} ${p.year}`;
  const shortDayDate = `${dayName}, ${p.day} ${monthShort} ${p.year}`;
  const timeOnly = includeSeconds
    ? `${p.hoursStr}:${p.minutesStr}:${p.secondsStr}`
    : `${p.hoursStr}:${p.minutesStr}`;
  const timeWithZone = `${timeOnly} WIB`;
  const compactLabel = `${shortDayDate} • ${timeWithZone}`;
  return {
    dayName,
    fullDayDate,
    shortDayDate,
    timeOnly,
    timeWithZone,
    compactLabel,
  };
}

/**
 * Menambah/mengurangi hari pada string tanggal YYYY-MM-DD secara aman tanpa bug pergeseran UTC.
 */
export function addDaysToDateString(dateStr: string, offsetDays: number): string {
  const clean = (dateStr || '').trim().slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const baseParts = match
    ? {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
      }
    : getJakartaDateParts();

  const utcNoon = new Date(
    Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day + offsetDays, 12, 0, 0)
  );
  const y = String(utcNoon.getUTCFullYear()).padStart(4, '0');
  const m = String(utcNoon.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcNoon.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mengembalikan indeks hari (0 = Minggu .. 6 = Sabtu) dari string YYYY-MM-DD secara konsisten di zona WIB.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const clean = (dateStr || '').trim().slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return getJakartaDateParts().dayOfWeek;
  }
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

/**
 * Mengembalikan nama Periode Gaji real-time saat ini sesuai WIB (contoh: "November 2026").
 */
export function getCurrentRealTimePayrollPeriod(date: Date = new Date()): string {
  const { year, month } = getJakartaDateParts(date);
  const monthName = INDO_MONTH_NAMES_FULL[month - 1] || 'Januari';
  return `${monthName} ${year}`;
}

/**
 * Menghasilkan daftar pilihan Periode Gaji secara dinamis di sekitar bulan berjalan (WIB).
 */
export function getDynamicAvailablePayrollPeriods(
  date: Date = new Date(),
  monthsBack: number = 4,
  monthsForward: number = 3
): string[] {
  const { year, month } = getJakartaDateParts(date);
  const result: string[] = [];
  for (let offset = -monthsBack; offset <= monthsForward; offset++) {
    const dt = new Date(Date.UTC(year, month - 1 + offset, 15, 12, 0, 0));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const mName = INDO_MONTH_NAMES_FULL[m] || 'Januari';
    result.push(`${mName} ${y}`);
  }
  return result;
}

export function formatIndoDate(dateString: string): string {
  try {
    if (!dateString) return '-';
    const trimmed = dateString.trim();
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      const mName = INDO_MONTH_NAMES_FULL[m - 1];
      if (mName && d >= 1 && d <= 31) {
        return `${d} ${mName} ${y}`;
      }
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatAccountingRupiah(amount?: number | null): string {
  const num = Number(amount);
  if (!num || isNaN(num) || Math.round(num) <= 0) {
    return 'Rp -';
  }
  return `Rp ${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(num))}`;
}

// Terbilang Rupiah untuk Slip Gaji Resmi
export function terbilang(angka: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
    'Sepuluh', 'Sebelas'
  ];

  const n = Math.floor(Math.abs(Number(angka) || 0));

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
  } else if (n < 1000000000000000) {
    return terbilang(Math.floor(n / 1000000000000)) + ' Triliun ' + terbilang(n % 1000000000000);
  }
  return n.toString();
}

export function terbilangRupiah(angka: number): string {
  const safeNum = Math.round(Number(angka) || 0);
  if (safeNum <= 0) return 'Nol Rupiah';
  const clean = terbilang(safeNum).replace(/\s+/g, ' ').trim();
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

// Nilai PTKP Tahunan sesuai UU HPP & PMK 168/2023
export function getPTKPAnnualAmount(ptkp: PTKPStatus): number {
  switch (ptkp) {
    case 'TK/0':
      return 54000000;
    case 'TK/1':
    case 'K/0':
      return 58500000;
    case 'TK/2':
    case 'K/1':
      return 63000000;
    case 'TK/3':
    case 'K/2':
      return 67500000;
    case 'K/3':
      return 72000000;
    default:
      return 54000000;
  }
}

// Perhitungan Tarif Progresif Pasal 17 UU HPP atas Penghasilan Kena Pajak (PKP) Tahunan
export function calculatePasal17AnnualTax(pkpAnnual: number): number {
  const pkp = Math.max(0, Math.floor(pkpAnnual / 1000) * 1000);
  if (pkp <= 0) return 0;

  let remaining = pkp;
  let totalTax = 0;

  // Lapis 1: 0 s.d Rp 60.000.000 -> 5%
  const layer1 = Math.min(remaining, 60000000);
  totalTax += layer1 * 0.05;
  remaining -= layer1;
  if (remaining <= 0) return Math.round(totalTax);

  // Lapis 2: > Rp 60.000.000 s.d Rp 250.000.000 (190.000.000) -> 15%
  const layer2 = Math.min(remaining, 190000000);
  totalTax += layer2 * 0.15;
  remaining -= layer2;
  if (remaining <= 0) return Math.round(totalTax);

  // Lapis 3: > Rp 250.000.000 s.d Rp 500.000.000 (250.000.000) -> 25%
  const layer3 = Math.min(remaining, 250000000);
  totalTax += layer3 * 0.25;
  remaining -= layer3;
  if (remaining <= 0) return Math.round(totalTax);

  // Lapis 4: > Rp 500.000.000 s.d Rp 5.000.000.000 (4.500.000.000) -> 30%
  const layer4 = Math.min(remaining, 4500000000);
  totalTax += layer4 * 0.30;
  remaining -= layer4;
  if (remaining <= 0) return Math.round(totalTax);

  // Lapis 5: > Rp 5.000.000.000 -> 35%
  totalTax += remaining * 0.35;
  return Math.round(totalTax);
}

/**
 * Kalkulasi Rekonsiliasi PPh 21 Masa Pajak Terakhir (Desember - Form 1721-A1)
 * Menghitung PPh 21 Setahun dengan Tarif Pasal 17 dikurangi akumulasi PPh 21 TER Jan-Nov.
 */
export function calculateDecemberPPh21Reconciliation(params: {
  monthlyTaxableGross: number;
  bpjsJhtEmployeeMonthly: number;
  bpjsJpEmployeeMonthly: number;
  ptkpStatus: PTKPStatus;
  monthsWorked?: number;
  terAlreadyPaidJanToNov?: number;
}): DecemberPPh21ReconciliationResult {
  const monthsWorked = Math.min(12, Math.max(1, params.monthsWorked || 12));
  const annualGrossIncome = Math.round(params.monthlyTaxableGross * monthsWorked);

  // Biaya Jabatan: 5% dari Penghasilan Bruto, maksimal Rp 500.000/bulan atau Rp 6.000.000/tahun
  const maxBiayaJabatan = monthsWorked * 500000;
  const biayaJabatanAnnual = Math.min(Math.round(annualGrossIncome * 0.05), maxBiayaJabatan);

  // Pengurang Iuran Pensiun/JHT yang dibayar karyawan sendiri (JHT 2% + JP 1%)
  const bpjsEmployeeAnnualDeduction = Math.round(
    (params.bpjsJhtEmployeeMonthly + params.bpjsJpEmployeeMonthly) * monthsWorked
  );

  const netIncomeAnnual = Math.max(
    0,
    annualGrossIncome - biayaJabatanAnnual - bpjsEmployeeAnnualDeduction
  );
  const ptkpAnnual = getPTKPAnnualAmount(params.ptkpStatus);
  const pkpAnnual = Math.max(0, Math.floor((netIncomeAnnual - ptkpAnnual) / 1000) * 1000);
  const annualPph21Pasal17 = calculatePasal17AnnualTax(pkpAnnual);

  const category = getTERCategory(params.ptkpStatus);
  const defaultMonthlyTer = Math.round(
    params.monthlyTaxableGross * getTERRate(category, params.monthlyTaxableGross)
  );
  const terAlreadyPaidJanToNov =
    params.terAlreadyPaidJanToNov !== undefined
      ? Math.max(0, Math.round(params.terAlreadyPaidJanToNov))
      : defaultMonthlyTer * Math.max(0, monthsWorked - 1);

  const decemberPph21Payable = Math.max(0, annualPph21Pasal17 - terAlreadyPaidJanToNov);

  return {
    annualGrossIncome,
    biayaJabatanAnnual,
    bpjsEmployeeAnnualDeduction,
    netIncomeAnnual,
    ptkpAnnual,
    pkpAnnual,
    annualPph21Pasal17,
    terAlreadyPaidJanToNov,
    decemberPph21Payable,
  };
}

// Standar Jam Kerja Harian Default Tas Grosir Import = 9 Jam / Hari
export const STANDARD_WORK_HOURS_PER_DAY = 9;

// Hitung target durasi jam kerja dari konfigurasi Jadwal & Shift Kerja (mendukung shift pendek 5 jam, 6 jam, maupun full shift 9 jam)
export function getShiftTargetHours(
  shift?: Partial<WorkShift> | null
): number | undefined {
  if (!shift || !shift.checkInTime || !shift.checkOutTime) return undefined;
  const [sh, sm] = shift.checkInTime.split(':').map(Number);
  const [eh, em] = shift.checkOutTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return undefined;
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) {
    endMins += 24 * 60;
  }
  const rawSpanHours = Number(((endMins - startMins) / 60).toFixed(2));
  const breakMins = Math.max(0, Number(shift.breakDurationMinutes) || 0);
  const netHours = Number(((endMins - startMins - breakMins) / 60).toFixed(2));
  // Jika shift pendek (misal 5 jam atau 6 jam), gunakan durasi shift tersebut secara dinamis
  if (rawSpanHours > 0 && rawSpanHours <= 7) {
    return netHours > 0 ? netHours : rawSpanHours;
  }
  if (netHours > 0 && netHours <= 6.5) {
    return netHours;
  }
  return undefined;
}

// Ambil Standar Jam Kerja Harian per Karyawan atau Shift (5 jam, 6 jam, 9 jam, dll. - tidak dipukul rata 9 jam)
export function getEmployeeStandardDailyHours(
  employee?: Partial<Employee> | null,
  fallbackHours: number = STANDARD_WORK_HOURS_PER_DAY,
  shift?: Partial<WorkShift> | null
): number {
  const raw = Number(
    employee?.standard_daily_hours ??
      employee?.standardDailyHours ??
      (employee as any)?.allowances?._standardDailyHours
  );
  if (!isNaN(raw) && raw > 0 && raw <= 24) {
    return Number(raw.toFixed(2));
  }
  const shiftHours = getShiftTargetHours(shift);
  if (shiftHours !== undefined && shiftHours > 0 && shiftHours <= 24) {
    return shiftHours;
  }
  const fb = Number(fallbackHours);
  return !isNaN(fb) && fb > 0 && fb <= 24 ? Number(fb.toFixed(2)) : STANDARD_WORK_HOURS_PER_DAY;
}

// Ambil total jam lembur yang TELAH DISETUJUI Admin (status === 'Disetujui') untuk employee_id & date tertentu
export function getApprovedOvertimeHoursForEmployeeDate(
  employeeId?: string | null,
  date?: string | null,
  overtimeRequests?: OvertimeRequest[] | null
): number {
  if (!employeeId || !date) return 0;
  const cleanEmpId = String(employeeId).trim();
  const cleanDate = String(date).trim();
  if (!cleanEmpId || !cleanDate) return 0;

  let list: OvertimeRequest[] = Array.isArray(overtimeRequests) ? overtimeRequests : [];
  if (list.length === 0 && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('tgi_overtime_requests_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }
    } catch {
      // Ignore storage parse error
    }
  }

  let approvedMinutes = 0;
  for (const req of list) {
    if (!req) continue;
    const reqEmpId = String(req.employeeId || (req as any).employee_id || '').trim();
    const reqDate = String(req.date || '').trim();
    if (reqEmpId === cleanEmpId && reqDate === cleanDate && req.status === 'Disetujui') {
      const mins =
        typeof req.minutes === 'number' && !isNaN(req.minutes) && req.minutes > 0
          ? req.minutes
          : (Number(req.hours) || 0) * 60;
      approvedMinutes += Math.max(0, mins);
    }
  }

  return Number((approvedMinutes / 60).toFixed(2));
}

// Ambil Tarif Gaji Per Jam (hourly_rate) Karyawan (otomatis fallback ke dailySalary / stdHours atau baseSalary / (25 hari × stdHours))
export function getEmployeeHourlyRate(
  employee?: Partial<Employee> | null,
  standardWorkHoursPerDay: number = STANDARD_WORK_HOURS_PER_DAY,
  standardWorkingDays: number = 25
): number {
  if (!employee) return 0;
  const hoursPerDay = getEmployeeStandardDailyHours(employee, standardWorkHoursPerDay);
  const explicitHourly = Number(employee.hourlyRate ?? employee.hourly_rate);
  if (!isNaN(explicitHourly) && explicitHourly > 0) {
    return Math.round(explicitHourly);
  }
  const explicitDaily = Number(employee.dailySalary ?? employee.daily_salary);
  if (!isNaN(explicitDaily) && explicitDaily > 0) {
    return Math.round(explicitDaily / hoursPerDay);
  }
  const divisorDays = Math.max(1, Math.round(standardWorkingDays || 25));
  const monthlyBase = Number(employee.baseSalary) || 0;
  return monthlyBase > 0 ? Math.round(monthlyBase / (divisorDays * hoursPerDay)) : 0;
}

// Ambil Tarif Gaji Per Hari (daily_salary = (employee.standard_daily_hours || 9) × Tarif Gaji Per Jam)
export function getEmployeeDailySalary(
  employee?: Partial<Employee> | null,
  standardWorkingDays: number = 25,
  standardWorkHoursPerDay: number = STANDARD_WORK_HOURS_PER_DAY
): number {
  if (!employee) return 0;
  const hoursPerDay = getEmployeeStandardDailyHours(employee, standardWorkHoursPerDay);
  const explicitHourly = Number(employee.hourlyRate ?? employee.hourly_rate);
  if (!isNaN(explicitHourly) && explicitHourly > 0) {
    return Math.round(explicitHourly * hoursPerDay);
  }
  const explicitDaily = Number(employee.dailySalary ?? employee.daily_salary);
  if (!isNaN(explicitDaily) && explicitDaily > 0) {
    return Math.round(explicitDaily);
  }
  const divisor = Math.max(1, Math.round(standardWorkingDays || 25));
  const monthlyBase = Number(employee.baseSalary) || 0;
  return monthlyBase > 0 ? Math.round(monthlyBase / divisor) : 0;
}

export interface LiveSalesCommissionSummary {
  isLiveStreamHost: boolean;
  isCoHostLiveStream: boolean;
  commissionPercentage: number;
  coHostCommissionPercentage: number;
  commissionPerPcs: number;
  coHostCommissionPerPcs: number;
  sessionsCount: number;
  hostSessionsCount: number;
  coHostSessionsCount: number;
  totalDurationHours: number;
  totalOmset: number;
  hostOmset: number;
  coHostOmset: number;
  totalPcs: number;
  hostPcs: number;
  coHostPcs: number;
  commissionFromPercentage: number;
  commissionFromPcs: number;
  hostCommissionAmount: number;
  coHostCommissionAmount: number;
  totalCommission: number;
  commissionNotes: string;
  notes: string;
  records: LiveStreamSalesRecord[];
  filteredLogs: LiveStreamSalesRecord[];
}

// Hitung Otomatis Insentif / Komisi Penjualan Host & Co-Host Live Streaming (TikTok Shop / Shopee Live)
// Mendukung % Omset dan Tarif per Pcs (Rp/Pcs Tas Terjual) secara terpisah & fleksibel untuk Host maupun Co-Host
export function calculateEmployeeLiveSalesCommission(
  employee?: Partial<Employee> | null,
  period?: string,
  extraLogs?: LiveStreamSalesRecord[]
): LiveSalesCommissionSummary {
  if (!employee) {
    return {
      isLiveStreamHost: false,
      isCoHostLiveStream: false,
      commissionPercentage: 0,
      coHostCommissionPercentage: 0,
      commissionPerPcs: 0,
      coHostCommissionPerPcs: 0,
      sessionsCount: 0,
      hostSessionsCount: 0,
      coHostSessionsCount: 0,
      totalDurationHours: 0,
      totalOmset: 0,
      hostOmset: 0,
      coHostOmset: 0,
      totalPcs: 0,
      hostPcs: 0,
      coHostPcs: 0,
      commissionFromPercentage: 0,
      commissionFromPcs: 0,
      hostCommissionAmount: 0,
      coHostCommissionAmount: 0,
      totalCommission: 0,
      commissionNotes: '',
      notes: '',
      records: [],
      filteredLogs: [],
    };
  }

  const commissionPercentage = Math.max(
    0,
    Number(employee.salesCommissionPercentage ?? employee.host_commission_pct) || 0
  );
  const coHostCommissionPercentage = Math.max(
    0,
    Number(employee.coHostCommissionPercentage ?? employee.co_host_commission_pct) || 0
  );
  const commissionPerPcs = Math.max(
    0,
    Number(employee.salesCommissionPerPcs ?? employee.host_commission_per_pcs) || 0
  );
  const coHostCommissionPerPcs = Math.max(
    0,
    Number(employee.coHostCommissionPerPcs ?? employee.co_host_commission_per_pcs) || 0
  );
  const roleIsCoHost = /co[\s-]*host/i.test(employee.role || '');

  const rawLogs = [
    ...(Array.isArray(employee.liveStreamSalesLogs) ? employee.liveStreamSalesLogs : []),
    ...(Array.isArray(extraLogs)
      ? extraLogs.filter((l) => (l.employeeId || l.employee_id) === employee.id)
      : []),
  ];

  // Deduplicate by id
  const uniqueMap = new Map<string, LiveStreamSalesRecord>();
  for (const log of rawLogs) {
    if (!log || !log.id) continue;
    uniqueMap.set(log.id, log);
  }
  const allLogs = Array.from(uniqueMap.values()).filter((l) => l.status !== 'Ditolak');

  // Filter by period if logs exist for that period; otherwise if logs don't have period mismatch, include them
  const strictPeriodLogs = period
    ? allLogs.filter(
        (l) =>
          !l?.period ||
          String(l.period).trim().toLowerCase() === String(period).trim().toLowerCase()
      )
    : allLogs;
  const matchingLogs = strictPeriodLogs.length > 0 ? strictPeriodLogs : allLogs;

  let totalOmset = 0;
  let hostOmset = 0;
  let coHostOmset = 0;
  let totalPcs = 0;
  let hostPcs = 0;
  let coHostPcs = 0;
  let totalDurationHours = 0;
  let commissionFromPercentage = 0;
  let commissionFromPcs = 0;
  let hostCommissionAmount = 0;
  let coHostCommissionAmount = 0;
  let hostSessionsCount = 0;
  let coHostSessionsCount = 0;
  let totalCommission = 0;

  const isEmpHost = Boolean(employee.isLiveStreamHost || employee.is_host);
  const isEmpCoHost = Boolean(employee.isCoHostLiveStream || employee.is_co_host);

  const defaultSessionRole: 'Host' | 'Co-Host' =
    (isEmpCoHost ||
      coHostCommissionPercentage > 0 ||
      coHostCommissionPerPcs > 0 ||
      roleIsCoHost) &&
    !isEmpHost
      ? 'Co-Host'
      : 'Host';

  const updatedRecords = matchingLogs.map((rec) => {
    const omset = Math.max(0, Number(rec.omsetAmount ?? rec.omset) || 0);
    const pcs = Math.max(0, Math.round(Number(rec.pcsSold ?? rec.pcs_sold) || 0));
    const hrs = Math.max(0, Number(rec.durationHours) || 0);
    const resolvedRole: 'Host' | 'Co-Host' =
      rec.sessionRole ||
      (rec.role_type === 'co_host'
        ? 'Co-Host'
        : rec.role_type === 'host'
        ? 'Host'
        : defaultSessionRole);

    const snapPct = Math.max(
      0,
      Number(rec.commissionPercentageSnapshot ?? rec.commission_pct_used) || 0
    );
    const snapPerPcs = Math.max(
      0,
      Number(rec.commissionPerPcsSnapshot ?? rec.commission_per_pcs_used) || 0
    );

    const effectivePct =
      snapPct > 0
        ? snapPct
        : resolvedRole === 'Co-Host'
        ? coHostCommissionPercentage > 0
          ? coHostCommissionPercentage
          : commissionPercentage
        : commissionPercentage > 0
        ? commissionPercentage
        : coHostCommissionPercentage > 0 && !isEmpHost
        ? coHostCommissionPercentage
        : 0;

    const effectivePerPcs =
      snapPerPcs > 0
        ? snapPerPcs
        : resolvedRole === 'Co-Host'
        ? coHostCommissionPerPcs > 0
          ? coHostCommissionPerPcs
          : commissionPerPcs
        : commissionPerPcs > 0
        ? commissionPerPcs
        : coHostCommissionPerPcs > 0 && !isEmpHost
        ? coHostCommissionPerPcs
        : 0;

    const rowPctComm = Math.round((omset * effectivePct) / 100);
    const rowPcsComm = Math.round(pcs * effectivePerPcs);

    const calcComm =
      effectivePct > 0 || effectivePerPcs > 0
        ? rowPctComm + rowPcsComm
        : Math.max(
            0,
            Math.round(Number(rec.calculatedCommission ?? rec.total_commission) || 0)
          );

    totalOmset += omset;
    totalPcs += pcs;
    totalDurationHours = Number((totalDurationHours + hrs).toFixed(1));
    commissionFromPercentage += rowPctComm;
    commissionFromPcs += rowPcsComm;
    totalCommission += calcComm;

    if (resolvedRole === 'Co-Host') {
      coHostSessionsCount += 1;
      coHostOmset += omset;
      coHostPcs += pcs;
      coHostCommissionAmount += calcComm;
    } else {
      hostSessionsCount += 1;
      hostOmset += omset;
      hostPcs += pcs;
      hostCommissionAmount += calcComm;
    }

    const resolvedDate = rec.date || rec.session_date || getJakartaDateString();

    return {
      ...rec,
      date: resolvedDate,
      session_date: resolvedDate,
      sessionRole: resolvedRole,
      role_type: (resolvedRole === 'Co-Host' ? 'co_host' : 'host') as 'host' | 'co_host',
      omsetAmount: omset,
      omset,
      pcsSold: pcs,
      pcs_sold: pcs,
      commissionPercentageSnapshot: effectivePct,
      commission_pct_used: effectivePct,
      commissionPerPcsSnapshot: effectivePerPcs,
      commission_per_pcs_used: effectivePerPcs,
      calculatedCommission: calcComm,
      total_commission: calcComm,
    };
  });

  const isCoHostLiveStream = Boolean(
    employee.isCoHostLiveStream ||
      coHostCommissionPercentage > 0 ||
      coHostCommissionPerPcs > 0 ||
      roleIsCoHost ||
      coHostSessionsCount > 0
  );

  const isLiveStreamHost = Boolean(
    employee.isLiveStreamHost ||
      commissionPercentage > 0 ||
      commissionPerPcs > 0 ||
      hostSessionsCount > 0
  );

  const noteParts: string[] = [];
  if (hostSessionsCount > 0) {
    const hostDetails: string[] = [];
    if (hostOmset > 0) {
      hostDetails.push(
        `Omset ${formatRupiah(hostOmset)}${commissionPercentage > 0 ? ` × ${commissionPercentage}%` : ''}`
      );
    }
    if (hostPcs > 0) {
      hostDetails.push(
        `${hostPcs.toLocaleString('id-ID')} Tas${
          commissionPerPcs > 0 ? ` × ${formatRupiah(commissionPerPcs)}/pcs` : ''
        }`
      );
    }
    noteParts.push(`Host ${hostSessionsCount} Sesi (${hostDetails.join(' + ')})`);
  }
  if (coHostSessionsCount > 0) {
    const coHostDetails: string[] = [];
    if (coHostOmset > 0) {
      coHostDetails.push(
        `Omset ${formatRupiah(coHostOmset)}${
          coHostCommissionPercentage > 0 ? ` × ${coHostCommissionPercentage}%` : ''
        }`
      );
    }
    if (coHostPcs > 0) {
      const coPcsRate = coHostCommissionPerPcs > 0 ? coHostCommissionPerPcs : commissionPerPcs;
      coHostDetails.push(
        `${coHostPcs.toLocaleString('id-ID')} Tas${
          coPcsRate > 0 ? ` × ${formatRupiah(coPcsRate)}/pcs` : ''
        }`
      );
    }
    noteParts.push(`Co-Host ${coHostSessionsCount} Sesi (${coHostDetails.join(' + ')})`);
  }

  const schemeParts: string[] = [];
  if (isLiveStreamHost && (commissionPercentage > 0 || commissionPerPcs > 0)) {
    schemeParts.push(
      `Host: ${commissionPercentage > 0 ? `${commissionPercentage}% Omset` : ''}${
        commissionPercentage > 0 && commissionPerPcs > 0 ? ' + ' : ''
      }${commissionPerPcs > 0 ? `${formatRupiah(commissionPerPcs)}/pcs` : ''}`
    );
  }
  if (isCoHostLiveStream && (coHostCommissionPercentage > 0 || coHostCommissionPerPcs > 0)) {
    schemeParts.push(
      `Co-Host: ${coHostCommissionPercentage > 0 ? `${coHostCommissionPercentage}% Omset` : ''}${
        coHostCommissionPercentage > 0 && coHostCommissionPerPcs > 0 ? ' + ' : ''
      }${coHostCommissionPerPcs > 0 ? `${formatRupiah(coHostCommissionPerPcs)}/pcs` : ''}`
    );
  }

  const commissionNotes =
    updatedRecords.length > 0
      ? noteParts.join(' • ')
      : schemeParts.length > 0
      ? `Skema Live (${schemeParts.join(' | ')})`
      : '';

  const sortedRecords = updatedRecords.sort((a, b) => b.date.localeCompare(a.date));

  return {
    isLiveStreamHost,
    isCoHostLiveStream,
    commissionPercentage,
    coHostCommissionPercentage,
    commissionPerPcs,
    coHostCommissionPerPcs,
    sessionsCount: sortedRecords.length,
    hostSessionsCount,
    coHostSessionsCount,
    totalDurationHours,
    totalOmset,
    hostOmset,
    coHostOmset,
    totalPcs,
    hostPcs,
    coHostPcs,
    commissionFromPercentage,
    commissionFromPcs,
    hostCommissionAmount,
    coHostCommissionAmount,
    totalCommission,
    commissionNotes,
    notes: commissionNotes,
    records: sortedRecords,
    filteredLogs: sortedRecords,
  };
}

// Hitung Tarif Dasar Upah Lembur Per Menit (1x = (Gaji Pokok + Tunjangan Tetap) / 173 / 60)
export function getBaseOvertimeRatePerMinute(
  employee?: Partial<Employee> | null,
  customBaseRatePerMinute?: number
): number {
  if (customBaseRatePerMinute && customBaseRatePerMinute > 0) {
    return customBaseRatePerMinute;
  }
  const dailyRate = getEmployeeDailySalary(employee, 25, STANDARD_WORK_HOURS_PER_DAY);
  const baseSalary = Number(employee?.baseSalary) || (dailyRate > 0 ? dailyRate * 25 : 5000000);
  const position = Number(employee?.allowances?.position) || 0;
  return (baseSalary + position) / 173 / 60;
}

// Hitung Tarif Lembur Per Menit dengan Multiplier tertentu (default 1.5x untuk jam pertama)
export function getOvertimeRatePerMinute(
  employee?: Partial<Employee> | null,
  multiplier: number = 1.5,
  customRatePerMinute?: number
): number {
  if (customRatePerMinute && customRatePerMinute > 0) {
    return Math.round(customRatePerMinute);
  }
  const perMinuteBase = getBaseOvertimeRatePerMinute(employee);
  return Math.max(100, Math.round(perMinuteBase * multiplier));
}

export interface OvertimeTierBreakdown {
  totalMinutes: number;
  firstHourMinutes: number; // Maksimal 60 menit pertama (1.5x)
  subsequentMinutes: number; // Menit setelah jam pertama (2.0x)
  baseRatePerMinute: number; // (Gaji Pokok + Tunj. Jabatan) / 173 / 60
  firstHourRatePerMinute: number; // 1.5x
  subsequentRatePerMinute: number; // 2.0x
  firstHourPay: number;
  subsequentPay: number;
  totalOvertimePay: number;
}

/**
 * Perhitungan Lembur Sesuai UU Ketenagakerjaan & PP No. 35 Tahun 2021:
 * - Jam ke-1 (60 menit pertama): 1.5x upah sejam ((Gaji Pokok + Tunjangan Tetap) / 173)
 * - Jam ke-2 dan berikutnya (menit > 60): 2.0x upah sejam
 */
export function calculateOvertimeBreakdown(
  employee?: Partial<Employee> | null,
  totalMinutes: number = 0,
  customRatePerMinute?: number
): OvertimeTierBreakdown {
  const cleanMinutes = Math.max(0, Math.round(totalMinutes || 0));
  const firstHourMinutes = Math.min(60, cleanMinutes);
  const subsequentMinutes = Math.max(0, cleanMinutes - 60);

  const baseRatePerMinute =
    customRatePerMinute && customRatePerMinute > 0
      ? customRatePerMinute / 1.5
      : getBaseOvertimeRatePerMinute(employee);

  const firstHourRatePerMinute = Math.round(baseRatePerMinute * 1.5);
  const subsequentRatePerMinute = Math.round(baseRatePerMinute * 2.0);

  const firstHourPay = Math.round(firstHourMinutes * baseRatePerMinute * 1.5);
  const subsequentPay = Math.round(subsequentMinutes * baseRatePerMinute * 2.0);
  const totalOvertimePay = firstHourPay + subsequentPay;

  return {
    totalMinutes: cleanMinutes,
    firstHourMinutes,
    subsequentMinutes,
    baseRatePerMinute: Math.round(baseRatePerMinute),
    firstHourRatePerMinute,
    subsequentRatePerMinute,
    firstHourPay,
    subsequentPay,
    totalOvertimePay,
  };
}

// Hitung Total Upah Lembur Berdasarkan Durasi Menit sesuai UU Ketenagakerjaan (Jam ke-1: 1.5x, Jam berikutnya: 2x)
export function calculateOvertimePayByMinutes(
  employee?: Partial<Employee> | null,
  totalMinutes: number = 0,
  _multiplier: number = 1.5,
  customRatePerMinute?: number
): number {
  const breakdown = calculateOvertimeBreakdown(employee, totalMinutes, customRatePerMinute);
  return breakdown.totalOvertimePay;
}

// Ambil durasi menit dari objek OvertimeRequest (mendukung data lama berbasis jam maupun data baru berbasis menit)
export function getOvertimeMinutes(ot: { minutes?: number; hours?: number }): number {
  if (typeof ot.minutes === 'number' && !isNaN(ot.minutes) && ot.minutes > 0) {
    return Math.round(ot.minutes);
  }
  return Math.round((Number(ot.hours) || 0) * 60);
}

// Format durasi menit menjadi teks yang mudah dibaca, misal: "135 Menit (2 Jam 15 Menit)"
export function formatOvertimeMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes || 0));
  if (mins < 60) {
    return `${mins} Menit`;
  }
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) {
    return `${mins} Menit (${hrs} Jam)`;
  }
  return `${mins} Menit (${hrs} Jam ${rem} Mnt)`;
}

// Hitung selisih menit antara Jam Mulai (HH:mm) dan Jam Selesai (HH:mm)
export function calculateMinutesBetweenTimes(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) {
    // Melewati tengah malam
    endMins += 24 * 60;
  }
  return Math.max(0, endMins - startMins);
}

// Normalisasi Tipe Karyawan ('Full-Time' | 'Contract' | 'Part-Time') secara case-insensitive & trim
export function normalizeEmploymentType(val?: string | null): EmploymentType | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const cleaned = val.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (cleaned === 'part-time' || cleaned === 'parttime' || cleaned.includes('part-time')) {
    return 'Part-Time';
  }
  // Periksa PKWTT / Tetap / Full-Time terlebih dahulu sebelum PKWT (karena string 'pkwtt' mengandung 'pkwt')
  if (
    cleaned === 'full-time' ||
    cleaned === 'fulltime' ||
    cleaned.includes('pkwtt') ||
    cleaned.includes('tetap')
  ) {
    return 'Full-Time';
  }
  if (cleaned === 'contract' || cleaned.includes('kontrak') || cleaned.includes('pkwt')) {
    return 'Contract';
  }
  return undefined;
}

// Cek apakah karyawan berstatus Part-Time secara akurat (case-insensitive & trim) dan BUKAN PKWTT (Tetap)
export function isEmployeePartTime(emp?: Partial<Employee> | null): boolean {
  if (!emp) return false;
  const typeNorm = normalizeEmploymentType(emp.employmentType || emp.employment_type);
  const statusNorm = normalizeEmploymentType(emp.employmentStatus || (emp as any).status);
  return typeNorm === 'Part-Time' || statusNorm === 'Part-Time';
}

// Hitung durasi kerja REAL dan PRESISI berdasarkan selisih clock_out dikurangi clock_in:
// const diffInMinutes = (clockOutTime - clockInTime) / (1000 * 60);
// const actualHours = Number((diffInMinutes / 60).toFixed(2));
export function calculateActualWorkHoursFromClock(
  clockIn?: string | null,
  clockOut?: string | null
): number {
  if (!clockIn || !clockOut) return 0;
  const cleanIn = clockIn.trim();
  const cleanOut = clockOut.trim();
  if (!cleanIn || !cleanOut || cleanIn === '-' || cleanOut === '-' || cleanIn === cleanOut) {
    return 0;
  }

  const inParts = cleanIn.split(':').map(Number);
  const outParts = cleanOut.split(':').map(Number);
  if (
    inParts.length < 2 ||
    outParts.length < 2 ||
    isNaN(inParts[0]) ||
    isNaN(inParts[1]) ||
    isNaN(outParts[0]) ||
    isNaN(outParts[1])
  ) {
    return 0;
  }

  const refDate = new Date(2026, 0, 1);
  const clockInTime = new Date(refDate);
  clockInTime.setHours(inParts[0], inParts[1], inParts[2] || 0, 0);

  const clockOutTime = new Date(refDate);
  clockOutTime.setHours(outParts[0], outParts[1], outParts[2] || 0, 0);

  if (clockOutTime.getTime() < clockInTime.getTime()) {
    clockOutTime.setDate(clockOutTime.getDate() + 1);
  }

  const diffInMinutes = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60);
  if (diffInMinutes <= 0) return 0;
  const actualHours = Number((diffInMinutes / 60).toFixed(2));
  return Math.max(0, actualHours);
}

export interface CappedDailyWorkHoursResult {
  rawDurationHours: number; // Durasi mentah dari clockOut - clockIn
  cappedWorkHours: number; // Jam kerja normal setelah dibatasi maksimal target jam harian (5/6/9 jam)
  excessHours: number; // Kelebihan jam di atas batas maksimal target jam harian
  overtimeHours: number; // Jam lembur diakui (0 secara default kecuali ada pengajuan lembur 'Disetujui')
  isCappedToMax: boolean; // true jika rawDurationHours > maxNormalHoursPerDay atau lupa clock-out lewat 23:59
  isMissingClockOut: boolean; // true jika belum Clock-Out pada hari berjalan
  isCrossMidnightOrForgotClockOut?: boolean; // true jika melewati 23:59 atau lupa clock-out di hari sebelumnya
}

// Hitung jam kerja normal harian dengan batas maksimal dinamis sesuai target jam kerja karyawan/shift (5, 6, atau 9 jam/hari):
// - Jika durasi aktual < target jam harian (misal 4 jam dari target 6 jam) -> dihitung 4 jam aktual, overtimeHours = 0
// - Jika durasi aktual > target jam harian (misal > 5, 6, atau 9 jam) -> dibatasi maksimal sebesar target jam harian, overtimeHours = 0 secara default
// - Kelebihan jam kerja HANYA dihitung sebagai overtimeHours jika approvedOvertimeHours > 0 (status 'Disetujui' di overtime_requests)
// - Penanganan Lupa Clock-Out (lewat pukul 23:59 / pergantian hari): otomatis dibatasi maksimal sebesar target jam harian karyawan (5/6/9 jam)
export function calculateCappedDailyWorkHours(
  clockIn?: string | null,
  clockOut?: string | null,
  fallbackWorkHours: number = 0,
  maxNormalHoursPerDay: number = STANDARD_WORK_HOURS_PER_DAY,
  approvedOvertimeHours: number = 0,
  attendanceDate?: string | null
): CappedDailyWorkHoursResult {
  const maxCap = Math.max(1, Number(maxNormalHoursPerDay) || STANDARD_WORK_HOURS_PER_DAY);
  const cleanApprovedOt = Math.max(0, Number(approvedOvertimeHours) || 0);
  const cleanIn = (clockIn || '').trim();
  const cleanOut = (clockOut || '').trim();
  const hasClockIn = Boolean(cleanIn && cleanIn !== '-' && cleanIn.includes(':'));
  const hasClockOut = Boolean(cleanOut && cleanOut !== '-' && cleanOut.includes(':'));

  // Cek apakah sesi absensi sudah melewati pergantian hari (lewat pukul 23:59 WIB) tanpa Clock-Out
  const todayIso = getJakartaDateString();
  const isPastDaySession = Boolean(
    attendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(attendanceDate.trim()) && attendanceDate.trim() < todayIso
  );

  if (hasClockIn && (!hasClockOut || cleanIn === cleanOut)) {
    // Penanganan Lupa Clock-Out yang telah melewati pukul 23:59 (hari sebelumnya):
    // Otomatis batasi jam kerja maksimal sebesar target jam kerja harian karyawan (5, 6, atau 9 jam sesuai profil/shift)
    if (isPastDaySession) {
      return {
        rawDurationHours: maxCap,
        cappedWorkHours: maxCap,
        excessHours: 0,
        overtimeHours: 0,
        isCappedToMax: true,
        isMissingClockOut: false,
        isCrossMidnightOrForgotClockOut: true,
      };
    }
    return {
      rawDurationHours: 0,
      cappedWorkHours: 0,
      excessHours: 0,
      overtimeHours: 0,
      isCappedToMax: false,
      isMissingClockOut: true,
      isCrossMidnightOrForgotClockOut: false,
    };
  }

  if (hasClockIn && hasClockOut) {
    const inParts = cleanIn.split(':').map(Number);
    const outParts = cleanOut.split(':').map(Number);
    const inMins = (inParts[0] || 0) * 60 + (inParts[1] || 0);
    const outMins = (outParts[0] || 0) * 60 + (outParts[1] || 0);
    const crossedMidnight = outMins < inMins && inMins < 18 * 60; // Sesi reguler melewati 23:59

    const raw = calculateActualWorkHoursFromClock(cleanIn, cleanOut);
    if (raw <= 0) {
      return {
        rawDurationHours: 0,
        cappedWorkHours: 0,
        excessHours: 0,
        overtimeHours: 0,
        isCappedToMax: false,
        isMissingClockOut: true,
        isCrossMidnightOrForgotClockOut: false,
      };
    }

    // Jika melewati 23:59 (lupa clock-out tepat waktu) tanpa lembur disetujui, batasi ke target jam harian (5/6/9 jam)
    const capped = Number(Math.min(maxCap, raw).toFixed(2));
    const excess = Number(Math.max(0, raw - maxCap).toFixed(2));
    const recognizedOvertime =
      cleanApprovedOt > 0 ? Number(Math.min(excess, cleanApprovedOt).toFixed(2)) : 0;

    return {
      rawDurationHours: raw,
      cappedWorkHours: capped,
      excessHours: excess,
      overtimeHours: recognizedOvertime,
      isCappedToMax: raw > maxCap || crossedMidnight,
      isMissingClockOut: false,
      isCrossMidnightOrForgotClockOut: crossedMidnight,
    };
  }

  const fallbackRaw = Math.max(0, Number(fallbackWorkHours) || 0);
  const cappedFallback = Number(Math.min(maxCap, fallbackRaw).toFixed(2));
  const excessFallback = Number(Math.max(0, fallbackRaw - maxCap).toFixed(2));
  const recognizedFallbackOt =
    cleanApprovedOt > 0 ? Number(Math.min(excessFallback, cleanApprovedOt).toFixed(2)) : 0;
  return {
    rawDurationHours: fallbackRaw,
    cappedWorkHours: cappedFallback,
    excessHours: excessFallback,
    overtimeHours: recognizedFallbackOt,
    isCappedToMax: fallbackRaw > maxCap,
    isMissingClockOut: fallbackRaw <= 0,
    isCrossMidnightOrForgotClockOut: false,
  };
}

// Daftar Shift Default apabila belum dikonfigurasi
export const DEFAULT_WORK_SHIFTS: WorkShift[] = [
  {
    id: 'shift-pagi-reguler',
    code: 'SHF-01',
    name: 'Shift Reguler Pagi (Kantor Pusat)',
    checkInTime: '09:00',
    checkOutTime: '17:30',
    gracePeriodMinutes: 5,
    breakDurationMinutes: 60,
    workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
    colorTheme: 'emerald',
    location: 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
    isDefault: true,
    isActive: true,
    description: 'Jadwal standar staf manajemen, IT, HRD, dan keuangan kantor pusat.',
  },
  {
    id: 'shift-pagi-gudang',
    code: 'SHF-02',
    name: 'Shift Pagi Gudang & Logistik',
    checkInTime: '08:00',
    checkOutTime: '16:30',
    gracePeriodMinutes: 10,
    breakDurationMinutes: 60,
    workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    colorTheme: 'teal',
    location: 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
    isDefault: false,
    isActive: true,
    description: 'Jadwal operasional pagi tim gudang, QC tas, dan logistik pengiriman.',
  },
  {
    id: 'shift-siang-toko',
    code: 'SHF-03',
    name: 'Shift Siang / Sore (Toko & Live)',
    checkInTime: '13:00',
    checkOutTime: '21:30',
    gracePeriodMinutes: 10,
    breakDurationMinutes: 60,
    workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    colorTheme: 'indigo',
    location: 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
    isDefault: false,
    isActive: true,
    description: 'Jadwal shift siang-malam untuk host live streaming, CS, dan kasir toko.',
  },
  {
    id: 'shift-malam-ekspedisi',
    code: 'SHF-04',
    name: 'Shift Malam (Ekspedisi & Bongkar Muat)',
    checkInTime: '21:00',
    checkOutTime: '05:00',
    gracePeriodMinutes: 15,
    breakDurationMinutes: 60,
    workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    colorTheme: 'purple',
    location: 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
    isDefault: false,
    isActive: true,
    description: 'Jadwal shift malam khusus tim bongkar muat kontainer import dan ekspedisi.',
  },
];

// Ambil jadwal shift kerja karyawan yang berlaku (mendukung pencocokan berdasarkan ID maupun Kode Shift seperti SHF-01)
export function getEmployeeShift(
  employee?: Partial<Employee> | null,
  shifts?: WorkShift[]
): WorkShift {
  const list = shifts && shifts.length > 0 ? shifts : DEFAULT_WORK_SHIFTS;
  if (employee?.shiftId) {
    const matched = list.find(
      (s) => s.id === employee.shiftId || s.code === employee.shiftId
    );
    if (matched) return matched;
  }
  return list.find((s) => s.isDefault) || list[0] || DEFAULT_WORK_SHIFTS[0];
}

// Aturan Denda Keterlambatan & Potongan Absen Default (Bisa Dikustomisasi Admin)
export const DEFAULT_ATTENDANCE_PENALTY_POLICY: AttendancePenaltyPolicy = {
  enabled: true,
  gracePeriodMinutes: 15, // Default toleransi keterlambatan 15 menit
  useShiftGracePeriod: false, // Default mengikuti gracePeriodMinutes di panel aturan denda (15 menit)
  latePenaltyScheme: 'flat_per_incident', // 'flat_per_incident' | 'per_minute' | 'daily_allowance_cut'
  flatLatePenaltyAmount: 25000, // Rp 25.000 / kejadian terlambat
  perMinutePenaltyAmount: 1000, // Rp 1.000 / menit terlambat
  dailyAllowanceCutPercentage: 100, // Potong 100% tunjangan makan/transport harian
  alphaPenaltyScheme: 'proportional_25', // 'proportional_25' (1/25 x Gaji Pokok) | 'fixed_amount'
  alphaWorkingDaysDivisor: 25, // Pembagi proporsional 25 hari kerja
  fixedAlphaPenaltyAmount: 150000, // Rp 150.000 / hari Alpha
};

export function getAttendancePenaltyPolicy(
  custom?: Partial<AttendancePenaltyPolicy> | null
): AttendancePenaltyPolicy {
  return {
    ...DEFAULT_ATTENDANCE_PENALTY_POLICY,
    ...(custom || {}),
    enabled: custom?.enabled !== undefined ? Boolean(custom.enabled) : true,
    gracePeriodMinutes:
      custom?.gracePeriodMinutes !== undefined
        ? Math.max(0, Number(custom.gracePeriodMinutes) || 0)
        : DEFAULT_ATTENDANCE_PENALTY_POLICY.gracePeriodMinutes,
    useShiftGracePeriod:
      custom?.useShiftGracePeriod !== undefined ? Boolean(custom.useShiftGracePeriod) : false,
    latePenaltyScheme: custom?.latePenaltyScheme || DEFAULT_ATTENDANCE_PENALTY_POLICY.latePenaltyScheme,
    flatLatePenaltyAmount:
      custom?.flatLatePenaltyAmount !== undefined
        ? Math.max(0, Number(custom.flatLatePenaltyAmount) || 0)
        : DEFAULT_ATTENDANCE_PENALTY_POLICY.flatLatePenaltyAmount,
    perMinutePenaltyAmount:
      custom?.perMinutePenaltyAmount !== undefined
        ? Math.max(0, Number(custom.perMinutePenaltyAmount) || 0)
        : DEFAULT_ATTENDANCE_PENALTY_POLICY.perMinutePenaltyAmount,
    dailyAllowanceCutPercentage:
      custom?.dailyAllowanceCutPercentage !== undefined
        ? Math.min(100, Math.max(0, Number(custom.dailyAllowanceCutPercentage) || 0))
        : DEFAULT_ATTENDANCE_PENALTY_POLICY.dailyAllowanceCutPercentage,
    alphaPenaltyScheme:
      custom?.alphaPenaltyScheme || DEFAULT_ATTENDANCE_PENALTY_POLICY.alphaPenaltyScheme,
    alphaWorkingDaysDivisor:
      custom?.alphaWorkingDaysDivisor !== undefined
        ? Math.max(1, Number(custom.alphaWorkingDaysDivisor) || 25)
        : DEFAULT_ATTENDANCE_PENALTY_POLICY.alphaWorkingDaysDivisor,
    fixedAlphaPenaltyAmount:
      custom?.fixedAlphaPenaltyAmount !== undefined
        ? Math.max(0, Number(custom.fixedAlphaPenaltyAmount) || 0)
        : DEFAULT_ATTENDANCE_PENALTY_POLICY.fixedAlphaPenaltyAmount,
  };
}

// Evaluasi jam masuk & pulang terhadap jadwal shift yang ditentukan
// Menghitung otomatis Durasi Terlambat (Menit) berdasarkan selisih Jam Masuk karyawan dengan Jam Masuk Shift
// Contoh: Shift 08:00, masuk 09:48 = terlambat 108 menit
export function evaluateAttendanceAgainstShift(
  checkIn: string,
  checkOut: string,
  shift: WorkShift,
  overrideGracePeriodMinutes?: number,
  maxNormalHoursPerDay: number = STANDARD_WORK_HOURS_PER_DAY
): {
  status: 'Hadir Tepat Waktu' | 'Terlambat';
  lateMinutes: number;
  rawLateMinutes: number;
  earlyLeaveMinutes: number;
  workHours: number;
  maxAllowedCheckIn: string;
} {
  const [sh, sm] = (shift.checkInTime || '09:00').split(':').map(Number);
  const [eh, em] = (shift.checkOutTime || '17:30').split(':').map(Number);
  const scheduledStart = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
  let scheduledEnd = (isNaN(eh) ? 17 : eh) * 60 + (isNaN(em) ? 30 : em);
  if (scheduledEnd <= scheduledStart) {
    scheduledEnd += 24 * 60;
  }

  const grace =
    overrideGracePeriodMinutes !== undefined
      ? Math.max(0, Number(overrideGracePeriodMinutes) || 0)
      : Math.max(0, Number(shift.gracePeriodMinutes) || 0);
  const maxAllowedTotal = (scheduledStart + grace) % (24 * 60);
  const maxAllowedCheckIn = `${String(Math.floor(maxAllowedTotal / 60)).padStart(2, '0')}:${String(
    maxAllowedTotal % 60
  ).padStart(2, '0')}`;

  // Parse actual checkIn
  const [ch, cm] = (checkIn || '').split(':').map(Number);
  let rawLateMinutes = 0;
  let lateMinutes = 0;
  if (!isNaN(ch) && !isNaN(cm)) {
    let actualStart = ch * 60 + cm;
    // Handle overnight shift where scheduledStart is e.g. 21:00 and actualStart is 00:30
    if (scheduledStart >= 18 * 60 && actualStart < 6 * 60) {
      actualStart += 24 * 60;
    }
    if (actualStart > scheduledStart) {
      rawLateMinutes = actualStart - scheduledStart;
    }
    if (actualStart > scheduledStart + grace) {
      lateMinutes = actualStart - scheduledStart;
    }
  }

  // Parse actual checkOut — Hitung durasi kerja REAL dan PRESISI dari clockOut - clockIn (tanpa fallback 8/9 jam jika belum Clock-Out)
  const cleanCheckOut = (checkOut || '').trim();
  const [outH, outM] = cleanCheckOut.split(':').map(Number);
  let earlyLeaveMinutes = 0;
  let workHours = 0;
  const resolvedMaxNormalHours = Math.max(
    1,
    Number(maxNormalHoursPerDay) || STANDARD_WORK_HOURS_PER_DAY
  );

  if (
    cleanCheckOut !== '' &&
    cleanCheckOut !== '-' &&
    cleanCheckOut !== (checkIn || '').trim() &&
    !isNaN(ch) &&
    !isNaN(cm) &&
    !isNaN(outH) &&
    !isNaN(outM)
  ) {
    const cappedRes = calculateCappedDailyWorkHours(
      checkIn,
      cleanCheckOut,
      0,
      resolvedMaxNormalHours
    );
    workHours = cappedRes.cappedWorkHours;

    // Check early leave against scheduledEnd
    let normalizedOut = outH * 60 + outM;
    if (scheduledEnd > 24 * 60 && normalizedOut < 12 * 60) {
      normalizedOut += 24 * 60;
    }
    if (normalizedOut < scheduledEnd) {
      earlyLeaveMinutes = Math.max(0, scheduledEnd - normalizedOut);
    }
  } else {
    // Jika clock_out belum diisi (baru Clock-In) atau sama dengan clock_in, actualHours = 0
    workHours = 0;
  }

  const status: 'Hadir Tepat Waktu' | 'Terlambat' =
    lateMinutes > 0 ? 'Terlambat' : 'Hadir Tepat Waktu';

  return {
    status,
    lateMinutes,
    rawLateMinutes,
    earlyLeaveMinutes,
    workHours,
    maxAllowedCheckIn,
  };
}

// Helper konversi jam HH:mm ke menit untuk pengurutan log masuk pertama
function parseTimeToMins(t?: string): number {
  if (!t || t === '-') return 99999;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 99999;
  return h * 60 + m;
}

// Deduplikasi & Akurasi Presensi Harian:
// Hanya mengambil 1 log masuk pertama per karyawan per tanggal (menggabungkan jam pulang terbaru pada hari yang sama)
// serta menghitung ulang Durasi Terlambat (Menit) berdasarkan selisih Jam Masuk dengan Jam Masuk Shift.
export function deduplicateDailyAttendances(
  attendances: AttendanceRecord[],
  employees?: Employee[],
  shifts?: WorkShift[],
  penaltyPolicy?: Partial<AttendancePenaltyPolicy> | null
): AttendanceRecord[] {
  if (!Array.isArray(attendances) || attendances.length === 0) return [];
  const policy = getAttendancePenaltyPolicy(penaltyPolicy);
  const empMap = new Map<string, Employee>();
  (employees || []).forEach((e) => empMap.set(e.id, e));

  const grouped = new Map<string, AttendanceRecord[]>();
  for (const att of attendances) {
    if (!att || !att.employeeId || !att.date) continue;
    const key = `${att.employeeId}__${att.date}`;
    const list = grouped.get(key) || [];
    list.push(att);
    grouped.set(key, list);
  }

  const deduplicated: AttendanceRecord[] = [];

  grouped.forEach((recordsOnSameDay) => {
    // Sort by earliest valid checkIn time so we strictly take the 1st check-in log of that date
    const sorted = [...recordsOnSameDay].sort(
      (a, b) => parseTimeToMins(a.checkIn) - parseTimeToMins(b.checkIn)
    );
    const primary = sorted[0];

    // Merge latest valid checkOut from any record on the same day
    let mergedCheckOut = primary.checkOut;
    let mergedCheckOutPhoto = primary.checkOutPhotoSnapshot || primary.facePhotoOut || primary.photoOut;
    let mergedCheckOutTimestamp = primary.checkOutFullTimestamp;
    let mergedCheckOutCoords = primary.checkOutLocationCoords;
    let mergedCheckOutAddress = primary.checkOutLocationAddress;
    let mergedCheckOutDistance = primary.checkOutDistanceMeters;
    let mergedPhotoIn = primary.facePhotoSnapshot || primary.photoIn;

    for (const r of sorted) {
      if (r.facePhotoSnapshot || r.photoIn) {
        mergedPhotoIn = r.facePhotoSnapshot || r.photoIn || mergedPhotoIn;
      }
      if (r.checkOut && r.checkOut !== '-' && r.checkOut.trim() !== '') {
        mergedCheckOut = r.checkOut;
        mergedCheckOutPhoto =
          r.checkOutPhotoSnapshot || r.facePhotoOut || r.photoOut || mergedCheckOutPhoto;
        mergedCheckOutTimestamp = r.checkOutFullTimestamp || mergedCheckOutTimestamp;
        mergedCheckOutCoords = r.checkOutLocationCoords || mergedCheckOutCoords;
        mergedCheckOutAddress = r.checkOutLocationAddress || mergedCheckOutAddress;
        if (r.checkOutDistanceMeters !== undefined) {
          mergedCheckOutDistance = r.checkOutDistanceMeters;
        }
      }
    }

    const emp = empMap.get(primary.employeeId);
    const empShift = getEmployeeShift(emp, shifts);
    const empStdHours = getEmployeeStandardDailyHours(emp, STANDARD_WORK_HOURS_PER_DAY, empShift);
    const approvedOtHours = getApprovedOvertimeHoursForEmployeeDate(
      primary.employeeId,
      primary.date
    );
    const scheduledIn = empShift.checkInTime || primary.scheduledCheckIn || '09:00';
    const scheduledOut = empShift.checkOutTime || primary.scheduledCheckOut || '17:30';
    const effectiveShift: WorkShift = {
      ...empShift,
      checkInTime: scheduledIn,
      checkOutTime: scheduledOut,
    };

    const isNonPresentStatus =
      primary.status === 'Sakit' ||
      primary.status === 'Izin' ||
      primary.status === 'Cuti' ||
      primary.status === 'Alpa';

    const hasValidCheckIn =
      !isNonPresentStatus &&
      Boolean(primary.checkIn && primary.checkIn !== '-' && primary.checkIn.includes(':'));

    if (hasValidCheckIn) {
      const effectiveGrace = policy.useShiftGracePeriod
        ? empShift.gracePeriodMinutes
        : policy.gracePeriodMinutes;
      const evalRes = evaluateAttendanceAgainstShift(
        primary.checkIn,
        mergedCheckOut,
        effectiveShift,
        effectiveGrace,
        empStdHours
      );

      // Penanganan Lupa Clock-Out (melewati pukul 23:59 / hari sebelumnya tanpa Clock-Out):
      // Otomatis batasi jam kerja maksimal sebesar target jam kerja harian karyawan (5, 6, atau 9 jam sesuai profil/shift)
      const cappedRes = calculateCappedDailyWorkHours(
        primary.checkIn,
        mergedCheckOut,
        evalRes.workHours,
        empStdHours,
        approvedOtHours,
        primary.date
      );
      const resolvedWorkHours =
        evalRes.workHours > 0 ? evalRes.workHours : cappedRes.cappedWorkHours;

      const finalStatus = primary.isManualStatus ? primary.status : evalRes.status;
      const finalLateMins = primary.isManualStatus
        ? primary.status === 'Hadir Tepat Waktu'
          ? 0
          : primary.lateMinutes > 0
          ? primary.lateMinutes
          : Math.max(1, evalRes.rawLateMinutes || evalRes.lateMinutes)
        : evalRes.lateMinutes;

      deduplicated.push({
        ...primary,
        facePhotoSnapshot: mergedPhotoIn,
        photoIn: mergedPhotoIn,
        checkOut: mergedCheckOut,
        checkOutPhotoSnapshot: mergedCheckOutPhoto,
        photoOut: mergedCheckOutPhoto,
        facePhotoOut: mergedCheckOutPhoto,
        checkOutFullTimestamp: mergedCheckOutTimestamp,
        checkOutLocationCoords: mergedCheckOutCoords,
        checkOutLocationAddress: mergedCheckOutAddress,
        checkOutDistanceMeters: mergedCheckOutDistance,
        scheduledCheckIn: scheduledIn,
        scheduledCheckOut: scheduledOut,
        shiftId: empShift.id || primary.shiftId,
        shiftName: empShift.name || primary.shiftName,
        lateMinutes: finalLateMins,
        earlyLeaveMinutes: evalRes.earlyLeaveMinutes,
        workHours: resolvedWorkHours,
        overtimeHours: cappedRes.overtimeHours,
        status: finalStatus,
      });
    } else {
      const cappedNonShift = calculateCappedDailyWorkHours(
        primary.checkIn,
        mergedCheckOut,
        primary.workHours,
        empStdHours,
        approvedOtHours,
        primary.date
      );
      deduplicated.push({
        ...primary,
        facePhotoSnapshot: mergedPhotoIn,
        photoIn: mergedPhotoIn,
        checkOut: isNonPresentStatus ? '-' : mergedCheckOut,
        checkOutPhotoSnapshot: mergedCheckOutPhoto,
        photoOut: mergedCheckOutPhoto,
        facePhotoOut: mergedCheckOutPhoto,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        workHours: isNonPresentStatus ? 0 : cappedNonShift.cappedWorkHours,
        overtimeHours: isNonPresentStatus ? 0 : cappedNonShift.overtimeHours,
      });
    }
  });

  // Sort deduplicated records by date descending, then checkIn descending
  return deduplicated.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return parseTimeToMins(b.checkIn) - parseTimeToMins(a.checkIn);
  });
}

// Ambil 1 log presensi terbaru per karyawan aktif untuk ringkasan "Kehadiran Hari Ini" di Dashboard
// (Mencegah terhitung ganda seperti 7/4 hadir jika karyawan punya log di beberapa hari atau absen 2x)
export function getTodayDeduplicatedAttendances(
  attendances: AttendanceRecord[],
  activeEmployees: Employee[],
  shifts?: WorkShift[],
  penaltyPolicy?: Partial<AttendancePenaltyPolicy> | null
): AttendanceRecord[] {
  const activeIdSet = new Set(activeEmployees.map((e) => e.id));
  const dedupedAll = deduplicateDailyAttendances(
    attendances.filter((a) => activeIdSet.has(a.employeeId)),
    activeEmployees,
    shifts,
    penaltyPolicy
  );

  if (dedupedAll.length === 0) return [];

  const todayIso = getJakartaDateString();
  const hasTodayLogs = dedupedAll.some((a) => a.date === todayIso);
  if (hasTodayLogs) {
    return dedupedAll.filter((a) => a.date === todayIso);
  }

  // Fallback: take at most 1 latest attendance log per active employee
  const latestPerEmployee = new Map<string, AttendanceRecord>();
  for (const att of dedupedAll) {
    if (!latestPerEmployee.has(att.employeeId)) {
      latestPerEmployee.set(att.employeeId, att);
    }
  }
  return Array.from(latestPerEmployee.values());
}

export interface EmployeeAttendancePenaltySummary {
  employeeId: string;
  hourlyRate: number; // Tarif Gaji Per Jam (hourly_rate)
  standardWorkHoursPerDay: number; // Standar 9 jam / hari
  totalActualWorkHours: number; // Akumulasi jam kerja riil seluruh hari masuk
  dailyWorkBreakdown: DailyWorkWageItem[]; // Rincian gaji harian = Jam Kerja Aktual Hari Tersebut × Tarif Per Jam
  presentDaysCount: number;
  onTimeDaysCount: number;
  lateFrequency: number; // Berapa kali/hari terlambat melewati toleransi
  totalLateMinutes: number; // Total durasi terlambat (menit)
  latePenaltyAmount: number; // Nominal denda terlambat (Rp)
  alphaDaysCount: number; // Jumlah hari Alpha / Mangkir
  alphaPenaltyAmount: number; // Nominal potongan Alpha (Rp)
  sickOrLeaveDaysCount: number; // Jumlah hari Sakit / Izin / Cuti
  totalDeductionAmount: number; // Total gabungan denda keterlambatan
  deductionNotes: string;
  deduplicatedRecords: AttendanceRecord[];
}

// Hitung otomatis Akumulasi Jam Kerja Riil, Gaji Harian Per Jam, Frekuensi Terlambat, Alpha, dan Nominal Potongan per Karyawan
export function calculateEmployeeAttendancePenalty(
  employee: Employee,
  attendances: AttendanceRecord[],
  shifts?: WorkShift[],
  penaltyPolicy?: Partial<AttendancePenaltyPolicy> | null
): EmployeeAttendancePenaltySummary {
  const policy = getAttendancePenaltyPolicy(penaltyPolicy);
  const empAttendances = (attendances || []).filter((a) => a.employeeId === employee.id);
  const deduped = deduplicateDailyAttendances(empAttendances, [employee], shifts, policy);

  const divisor = Math.max(1, policy.alphaWorkingDaysDivisor || 25);
  const standardWorkHoursPerDay = getEmployeeStandardDailyHours(employee);
  const hourlyRate = getEmployeeHourlyRate(employee, standardWorkHoursPerDay, divisor);
  const dailySalary = Math.round(hourlyRate * standardWorkHoursPerDay);

  let presentDaysCount = 0;
  let onTimeDaysCount = 0;
  let totalActualWorkHours = 0;
  let lateFrequency = 0;
  let totalLateMinutes = 0;
  let alphaDaysCount = 0;
  let sickOrLeaveDaysCount = 0;
  const dailyWorkBreakdown: DailyWorkWageItem[] = [];

  for (const rec of deduped) {
    if (rec.status === 'Alpa') {
      // Alpha / Tanpa Keterangan: 0 jam kerja aktual
      alphaDaysCount += 1;
      dailyWorkBreakdown.push({
        date: rec.date,
        checkIn: rec.checkIn || '-',
        checkOut: rec.checkOut || '-',
        workHours: 0,
        dailyWage: 0,
        status: rec.status,
      });
    } else if (rec.status === 'Sakit' || rec.status === 'Izin' || rec.status === 'Cuti') {
      sickOrLeaveDaysCount += 1;
      dailyWorkBreakdown.push({
        date: rec.date,
        checkIn: rec.checkIn || '-',
        checkOut: rec.checkOut || '-',
        workHours: 0,
        dailyWage: 0,
        status: rec.status,
      });
    } else if (rec.status === 'Terlambat' || rec.lateMinutes > 0) {
      presentDaysCount += 1;
      lateFrequency += 1;
      totalLateMinutes += Math.max(0, Math.round(rec.lateMinutes || 0));
      const cappedRes = calculateCappedDailyWorkHours(
        rec.checkIn,
        rec.checkOut,
        rec.workHours,
        standardWorkHoursPerDay,
        rec.overtimeHours || 0,
        rec.date
      );
      const actualHours = cappedRes.cappedWorkHours;
      totalActualWorkHours = Number((totalActualWorkHours + actualHours).toFixed(2));
      dailyWorkBreakdown.push({
        date: rec.date,
        checkIn: rec.checkIn || '-',
        checkOut: rec.checkOut || '-',
        workHours: actualHours,
        rawDurationHours: cappedRes.rawDurationHours,
        isCappedToMax: cappedRes.isCappedToMax,
        isMissingClockOut: cappedRes.isMissingClockOut,
        dailyWage: Math.round(actualHours * hourlyRate),
        status: rec.status,
      });
    } else if (rec.status === 'Hadir Tepat Waktu') {
      presentDaysCount += 1;
      onTimeDaysCount += 1;
      const cappedRes = calculateCappedDailyWorkHours(
        rec.checkIn,
        rec.checkOut,
        rec.workHours,
        standardWorkHoursPerDay,
        rec.overtimeHours || 0,
        rec.date
      );
      const actualHours = cappedRes.cappedWorkHours;
      totalActualWorkHours = Number((totalActualWorkHours + actualHours).toFixed(2));
      dailyWorkBreakdown.push({
        date: rec.date,
        checkIn: rec.checkIn || '-',
        checkOut: rec.checkOut || '-',
        workHours: actualHours,
        rawDurationHours: cappedRes.rawDurationHours,
        isCappedToMax: cappedRes.isCappedToMax,
        isMissingClockOut: cappedRes.isMissingClockOut,
        dailyWage: Math.round(actualHours * hourlyRate),
        status: rec.status,
      });
    }
  }

  let latePenaltyAmount = 0;
  let alphaPenaltyAmount = 0;

  if (policy.enabled) {
    // 1. Kalkulasi Denda Keterlambatan sesuai Skema Admin
    if (lateFrequency > 0 && totalLateMinutes > 0) {
      if (policy.latePenaltyScheme === 'flat_per_incident') {
        latePenaltyAmount = Math.round(lateFrequency * policy.flatLatePenaltyAmount);
      } else if (policy.latePenaltyScheme === 'per_minute') {
        latePenaltyAmount = Math.round(totalLateMinutes * policy.perMinutePenaltyAmount);
      } else if (policy.latePenaltyScheme === 'daily_allowance_cut') {
        const mealAndTransport =
          (Number(employee.allowances?.meal) || 0) + (Number(employee.allowances?.transport) || 0);
        const dailyAllowance =
          mealAndTransport > 0 ? Math.round(mealAndTransport / divisor) : 50000;
        const cutPerIncident = Math.round(
          dailyAllowance * (policy.dailyAllowanceCutPercentage / 100)
        );
        latePenaltyAmount = Math.round(lateFrequency * cutPerIncident);
      }
    }

    // 2. Kalkulasi Nilai Hari Alpha / Tanpa Keterangan (9 Jam × Tarif Per Jam)
    if (alphaDaysCount > 0) {
      if (policy.alphaPenaltyScheme === 'proportional_25') {
        alphaPenaltyAmount = Math.round(alphaDaysCount * dailySalary);
      } else {
        alphaPenaltyAmount = Math.round(alphaDaysCount * (dailySalary || policy.fixedAlphaPenaltyAmount));
      }
    }
  } else if (alphaDaysCount > 0) {
    alphaPenaltyAmount = Math.round(alphaDaysCount * dailySalary);
  }

  // Karena Gaji Pokok dihitung real-time = Akumulasi Jam Kerja Riil × Tarif Gaji Per Jam,
  // hari Alpha (0 jam kerja) sudah otomatis tidak dibayar.
  // Denda tambahan yang memotong dari Gaji Kotor adalah denda keterlambatan (latePenaltyAmount).
  const totalDeductionAmount = latePenaltyAmount;

  let deductionNotes = `Akumulasi ${totalActualWorkHours} Jam Kerja (${presentDaysCount} Hari) × ${formatRupiah(
    hourlyRate
  )}/jam`;
  if (lateFrequency > 0 && alphaDaysCount > 0) {
    deductionNotes = `Terlambat ${lateFrequency}x / ${totalLateMinutes} mnt (-${formatRupiah(
      latePenaltyAmount
    )}) • Alpha ${alphaDaysCount} Hari (0 Jam) otomatis dipotong (-${formatRupiah(
      alphaPenaltyAmount
    )})`;
  } else if (lateFrequency > 0) {
    deductionNotes = `Potongan Terlambat ${lateFrequency}x / ${totalLateMinutes} mnt: -${formatRupiah(
      latePenaltyAmount
    )}`;
  } else if (alphaDaysCount > 0) {
    deductionNotes = `Alpha ${alphaDaysCount} Hari (0 Jam Kerja) otomatis dipotong/diabaikan (-${formatRupiah(
      alphaPenaltyAmount
    )})`;
  }

  return {
    employeeId: employee.id,
    hourlyRate,
    standardWorkHoursPerDay,
    totalActualWorkHours,
    dailyWorkBreakdown,
    presentDaysCount,
    onTimeDaysCount,
    lateFrequency,
    totalLateMinutes,
    latePenaltyAmount,
    alphaDaysCount,
    alphaPenaltyAmount,
    sickOrLeaveDaysCount,
    totalDeductionAmount,
    deductionNotes,
    deduplicatedRecords: deduped,
  };
}

export interface PayrollAttendancePenaltyMeta {
  hourlyRate?: number;
  totalActualWorkHours?: number;
  standardWorkHoursPerDay?: number;
  dailyWorkBreakdown?: DailyWorkWageItem[];
  presentDaysCount?: number;
  dailySalary?: number;
  lateFrequency?: number;
  totalLateMinutes?: number;
  latePenaltyAmount?: number;
  alphaDaysCount?: number;
  alphaPenaltyAmount?: number;
  attendanceDeductionNotes?: string;
  customLateDeduction?: number;
  isLateFeeWaived?: boolean;
  originalLateDeduction?: number;
  waiverReason?: string;
  isLocked?: boolean;
  lockedAt?: string;
  penaltyPolicy?: Partial<AttendancePenaltyPolicy> | null;
  employeeAdjustment?: EmployeeAdjustment | null;
  payrollDeduction?: PayrollDeductionRecord | null;
  thrPayout?: ThrPayoutRecord | null;
  leaveRequests?: LeaveRequest[];
}

// Hitung Payroll Karyawan Lengkap berbasis Gaji Per Jam (Total Gaji Pokok = Akumulasi Jam Kerja Riil × Tarif Gaji Per Jam)
export function calculatePayroll(
  employee: Employee,
  period: string,
  overtimeMinutes: number = 0,
  bonus: number = 0,
  lateMinutes: number = 0,
  cashAdvanceDeduction: number = 0,
  cashAdvanceNotes?: string,
  attendancePenaltyMeta?: PayrollAttendancePenaltyMeta
): PayrollRecord {
  const policy = getAttendancePenaltyPolicy(attendancePenaltyMeta?.penaltyPolicy);
  const standardWorkingDays = Math.max(1, policy.alphaWorkingDaysDivisor || 25);
  const standardWorkHoursPerDay = getEmployeeStandardDailyHours(
    employee,
    attendancePenaltyMeta?.standardWorkHoursPerDay || STANDARD_WORK_HOURS_PER_DAY
  );

  const hourlyRate =
    attendancePenaltyMeta?.hourlyRate !== undefined && attendancePenaltyMeta.hourlyRate > 0
      ? Math.round(attendancePenaltyMeta.hourlyRate)
      : getEmployeeHourlyRate(employee, standardWorkHoursPerDay, standardWorkingDays);

  const dailySalary = Math.round(hourlyRate * standardWorkHoursPerDay);

  const resolvedAlphaDays = Math.max(0, Math.round(attendancePenaltyMeta?.alphaDaysCount || 0));
  const hasExplicitPresentDays = attendancePenaltyMeta?.presentDaysCount !== undefined;
  const resolvedPresentDays = hasExplicitPresentDays
    ? Math.max(0, Math.round(attendancePenaltyMeta!.presentDaysCount!))
    : Math.max(0, standardWorkingDays - resolvedAlphaDays);

  // Normalisasi rincian jam kerja harian agar setiap hari dibatasi maksimal 9 jam (standardWorkHoursPerDay)
  // dan 0 jam jika belum Clock-Out atau Clock-In === Clock-Out
  const rawBreakdown = Array.isArray(attendancePenaltyMeta?.dailyWorkBreakdown)
    ? attendancePenaltyMeta!.dailyWorkBreakdown!
    : [];
  const normalizedDailyBreakdown: DailyWorkWageItem[] = rawBreakdown.map((item) => {
    const isNonPresent =
      item.status === 'Alpa' ||
      item.status === 'Sakit' ||
      item.status === 'Izin' ||
      item.status === 'Cuti';
    if (isNonPresent) {
      return {
        ...item,
        workHours: 0,
        rawDurationHours: 0,
        isCappedToMax: false,
        isMissingClockOut: false,
        dailyWage: 0,
      };
    }
    const cappedRes = calculateCappedDailyWorkHours(
      item.checkIn,
      item.checkOut,
      item.workHours,
      standardWorkHoursPerDay
    );
    return {
      ...item,
      workHours: cappedRes.cappedWorkHours,
      rawDurationHours: cappedRes.rawDurationHours,
      isCappedToMax: cappedRes.isCappedToMax,
      isMissingClockOut: cappedRes.isMissingClockOut,
      dailyWage: Math.round(cappedRes.cappedWorkHours * hourlyRate),
    };
  });

  const sumFromNormalizedBreakdown =
    normalizedDailyBreakdown.length > 0
      ? Number(
          normalizedDailyBreakdown
            .reduce((sum, item) => sum + (Number(item.workHours) || 0), 0)
            .toFixed(2)
        )
      : undefined;

  const resolvedActualWorkHours =
    sumFromNormalizedBreakdown !== undefined
      ? sumFromNormalizedBreakdown
      : attendancePenaltyMeta?.totalActualWorkHours !== undefined
      ? Math.max(
          0,
          Math.min(
            resolvedPresentDays * standardWorkHoursPerDay,
            Number(attendancePenaltyMeta.totalActualWorkHours)
          )
        )
      : Number((resolvedPresentDays * standardWorkHoursPerDay).toFixed(2));

  // Kalkulasi Real-Time Gaji Pokok Bulanan = Akumulasi Jam Kerja Riil (Maks 9 Jam/Hari) × Tarif Gaji Per Jam
  const baseSalary = Math.round(resolvedActualWorkHours * hourlyRate);

  const allowances = employee.allowances || {
    position: 0,
    transport: 0,
    meal: 0,
    communication: 0,
  };
  const position = Number(allowances.position) || 0;
  const rawTransport = Number(allowances.transport) || 0;
  const rawMeal = Number(allowances.meal) || 0;
  const rawCommunication = Number(allowances.communication) || 0;

  const adj = attendancePenaltyMeta?.employeeAdjustment || null;
  const hasExplicitKerajinan =
    adj !== null &&
    adj.tunjangan_kerajinan !== undefined &&
    !isNaN(Number(adj.tunjangan_kerajinan));
  const hasExplicitKedisiplinan =
    adj !== null &&
    adj.tunjangan_kedisiplinan !== undefined &&
    !isNaN(Number(adj.tunjangan_kedisiplinan));

  const tunjanganKerajinan = hasExplicitKerajinan
    ? Math.max(0, Math.round(Number(adj!.tunjangan_kerajinan) || 0))
    : rawTransport + rawCommunication;
  const tunjanganKedisiplinan = hasExplicitKedisiplinan
    ? Math.max(0, Math.round(Number(adj!.tunjangan_kedisiplinan) || 0))
    : rawMeal;

  const transport = hasExplicitKerajinan ? tunjanganKerajinan : rawTransport;
  const communication = hasExplicitKerajinan ? 0 : rawCommunication;
  const meal = hasExplicitKedisiplinan ? tunjanganKedisiplinan : rawMeal;

  // Hitungan Lembur Sesuai UU Ketenagakerjaan (PP 35/2021):
  // Jam ke-1 (60 menit pertama) = 1.5x, Jam ke-2 dst (menit > 60) = 2.0x dari (Gaji Pokok + Tunjangan Jabatan) / 173
  const normalizedMinutes = Math.max(0, Math.round(overtimeMinutes));
  const otBreakdown = calculateOvertimeBreakdown(employee, normalizedMinutes);
  const overtimeRatePerMinute = otBreakdown.firstHourRatePerMinute;
  const overtimePay = otBreakdown.totalOvertimePay;

  // Hitungan Otomatis Insentif / Komisi Penjualan Host Live Streaming (TikTok Shop / Shopee Live)
  const liveSalesSummary = calculateEmployeeLiveSalesCommission(employee, period);
  const salesCommission = liveSalesSummary.totalCommission;

  // Tunjangan Hari Raya (THR) - HANYA dihitung jika show_in_payslip === true dari ceklis Admin
  const thrRec = attendancePenaltyMeta?.thrPayout || null;
  const thrShowInPayslip = Boolean(thrRec && thrRec.show_in_payslip === true && Number(thrRec.total_thr_amount) > 0);
  const thrAmount = thrShowInPayslip
    ? Math.max(0, Math.round(Number(thrRec!.total_thr_amount) || 0))
    : 0;
  const thrBasisAmount = thrShowInPayslip
    ? Math.max(0, Math.round(Number(thrRec!.calculation_basis_amount) || 0))
    : 0;

  const totalGrossSalary =
    baseSalary +
    position +
    tunjanganKerajinan +
    tunjanganKedisiplinan +
    overtimePay +
    bonus +
    salesCommission +
    thrAmount;

  // Denda Keterlambatan & Potongan Absen (Otomatis dari Rekap Presensi atau Parameter)
  const resolvedTotalLateMins =
    attendancePenaltyMeta?.totalLateMinutes !== undefined
      ? Math.max(0, Math.round(attendancePenaltyMeta.totalLateMinutes))
      : Math.max(0, Math.round(lateMinutes));
  const resolvedLateFreq =
    attendancePenaltyMeta?.lateFrequency !== undefined
      ? Math.max(0, Math.round(attendancePenaltyMeta.lateFrequency))
      : resolvedTotalLateMins > policy.gracePeriodMinutes
      ? 1
      : 0;

  let latePenaltyAmount = 0;
  let alphaPenaltyAmount = Math.round(resolvedAlphaDays * dailySalary);
  let lateDeduction = 0;

  if (attendancePenaltyMeta?.customLateDeduction !== undefined) {
    lateDeduction = Math.max(0, Math.round(attendancePenaltyMeta.customLateDeduction));
    latePenaltyAmount =
      attendancePenaltyMeta.latePenaltyAmount !== undefined
        ? attendancePenaltyMeta.latePenaltyAmount
        : lateDeduction;
    alphaPenaltyAmount =
      attendancePenaltyMeta.alphaPenaltyAmount !== undefined
        ? attendancePenaltyMeta.alphaPenaltyAmount
        : Math.round(resolvedAlphaDays * dailySalary);
  } else if (policy.enabled) {
    if (resolvedLateFreq > 0 && resolvedTotalLateMins > 0) {
      if (policy.latePenaltyScheme === 'flat_per_incident') {
        latePenaltyAmount = Math.round(resolvedLateFreq * policy.flatLatePenaltyAmount);
      } else if (policy.latePenaltyScheme === 'per_minute') {
        latePenaltyAmount = Math.round(resolvedTotalLateMins * policy.perMinutePenaltyAmount);
      } else if (policy.latePenaltyScheme === 'daily_allowance_cut') {
        const divisor = Math.max(1, policy.alphaWorkingDaysDivisor || 25);
        const dailyAllow =
          meal + transport > 0 ? Math.round((meal + transport) / divisor) : 50000;
        const cutPerDay = Math.round(dailyAllow * (policy.dailyAllowanceCutPercentage / 100));
        latePenaltyAmount = Math.round(resolvedLateFreq * cutPerDay);
      }
    }

    if (resolvedAlphaDays > 0) {
      alphaPenaltyAmount = Math.round(resolvedAlphaDays * dailySalary);
    }

    // Alpha sudah otomatis dikurangi melalui jam kerja riil (0 jam pada hari Alpha),
    // sehingga lateDeduction hanya mengambil denda keterlambatan agar tidak terpotong ganda.
    lateDeduction = latePenaltyAmount;
  }

  const originalLateDeduction =
    attendancePenaltyMeta?.originalLateDeduction !== undefined
      ? attendancePenaltyMeta.originalLateDeduction
      : lateDeduction;
  const isLateFeeWaived = Boolean(attendancePenaltyMeta?.isLateFeeWaived);
  const waiverReason = attendancePenaltyMeta?.waiverReason;

  if (isLateFeeWaived) {
    lateDeduction = 0;
    latePenaltyAmount = 0;
  }

  let attendanceDeductionNotes = attendancePenaltyMeta?.attendanceDeductionNotes;
  if (isLateFeeWaived) {
    attendanceDeductionNotes =
      originalLateDeduction > 0
        ? `Dispensasi Denda Absensi (${waiverReason || 'Tugas Luar / Kebijakan HR'}): Rp 0 (Bebas Denda Semula -${formatRupiah(
            originalLateDeduction
          )})`
        : `Dispensasi Denda Absensi Aktif (${waiverReason || 'Tugas Luar / Kebijakan HR'}): Rp 0`;
  } else if (!attendanceDeductionNotes) {
    if (resolvedLateFreq > 0 && resolvedAlphaDays > 0) {
      attendanceDeductionNotes = `Terlambat ${resolvedLateFreq}x / ${resolvedTotalLateMins} mnt (-${formatRupiah(
        latePenaltyAmount
      )}) • Alpha ${resolvedAlphaDays} Hari (0 Jam) dipotong (-${formatRupiah(
        alphaPenaltyAmount
      )})`;
    } else if (resolvedLateFreq > 0 && lateDeduction > 0) {
      attendanceDeductionNotes = `Potongan Terlambat ${resolvedLateFreq}x / ${resolvedTotalLateMins} mnt: -${formatRupiah(
        lateDeduction
      )}`;
    } else if (resolvedAlphaDays > 0) {
      attendanceDeductionNotes = `Alpha ${resolvedAlphaDays} Hari (0 Jam Kerja) otomatis dipotong/diabaikan (-${formatRupiah(
        alphaPenaltyAmount
      )})`;
    } else {
      attendanceDeductionNotes = `Gaji Per Jam Real-Time: ${resolvedActualWorkHours} Jam (${resolvedPresentDays} Hari) × ${formatRupiah(
        hourlyRate
      )}/jam`;
    }
  }

  const dedRec = attendancePenaltyMeta?.payrollDeduction || null;
  const bpjsTkManual = dedRec
    ? Math.max(0, Math.round(Number(dedRec.bpjs_tk_manual) || 0))
    : 0;
  const bpjsKesehatanManual = dedRec
    ? Math.max(0, Math.round(Number(dedRec.bpjs_kesehatan_manual) || 0))
    : 0;
  const pph21Manual = dedRec
    ? Math.max(0, Math.round(Number(dedRec.pph21_manual) || 0))
    : 0;

  // Potongan BPJS & PPh 21: MATIKAN rumus persentase otomatis (Default Rp 0).
  // Hanya gunakan nilai input manual dari Panel "Potongan Absensi & Kasbon" (payrollDeduction).
  const bpjsKesehatanEmployee = bpjsKesehatanManual;
  const bpjsKesehatanEmployer = 0;

  const bpjsJhtEmployee = bpjsTkManual;
  const bpjsJhtEmployer = 0;

  const bpjsJpEmployee = 0;
  const bpjsJpEmployer = 0;

  const bpjsJkkEmployer = 0;
  const bpjsJkmEmployer = 0;

  const employerBpjsTaxableAllowance = 0;
  const taxableGrossSalary = totalGrossSalary;

  const isDecemberReconciliation = (period || '').trim().toLowerCase().startsWith('desember');
  const pph21TER = pph21Manual;
  const annualPph21Summary: DecemberPPh21ReconciliationResult | undefined = undefined;

  const kesalahanCount = adj ? Math.max(0, Math.round(Number(adj.kesalahan_count) || 0)) : 0;
  const kesalahanRate =
    adj && adj.kesalahan_rate !== undefined
      ? Math.max(0, Math.round(Number(adj.kesalahan_rate) || 0))
      : 10000;
  const kesalahanDeduction = Math.round(kesalahanCount * kesalahanRate);
  const catatanKesalahan = adj?.catatan_kesalahan || '';

  const tanpaKeteranganHari = dedRec
    ? Math.max(0, Number(dedRec.tanpa_keterangan_hari) || 0)
    : resolvedAlphaDays;
  const tanpaKeteranganRate =
    dedRec && dedRec.tanpa_keterangan_rate > 0
      ? Math.max(0, Math.round(Number(dedRec.tanpa_keterangan_rate) || 0))
      : dailySalary;
  const manualAlphaDeduction = dedRec
    ? Math.round(tanpaKeteranganHari * tanpaKeteranganRate)
    : isLateFeeWaived
    ? 0
    : alphaPenaltyAmount;

  const izinJamMenit = dedRec ? Math.max(0, Math.round(Number(dedRec.izin_jam_menit) || 0)) : 0;
  const izinJamRate =
    dedRec && dedRec.izin_jam_rate > 0
      ? Math.max(0, Math.round(Number(dedRec.izin_jam_rate) || 0))
      : Math.max(0, Math.round(hourlyRate / 60));
  const izinJamDeduction = Math.round(izinJamMenit * izinJamRate);

  const izinHariJumlah = dedRec ? Math.max(0, Number(dedRec.izin_hari_jumlah) || 0) : 0;
  const izinHariRate =
    dedRec && dedRec.izin_hari_rate > 0
      ? Math.max(0, Math.round(Number(dedRec.izin_hari_rate) || 0))
      : dailySalary;
  const izinHariDeduction = Math.round(izinHariJumlah * izinHariRate);

  const sickSummary = getApprovedSickLeaveSummaryForPeriod(
    attendancePenaltyMeta?.leaveRequests || [],
    employee,
    period,
    dailySalary
  );
  const sakitHariJumlah = sickSummary.sickDays;
  const sakitHariRate = sickSummary.sickRatePerDay;
  const sakitDeduction = sickSummary.sickDeductionTotal;

  const sisaKasbonLalu = dedRec
    ? Math.max(0, Math.round(Number(dedRec.sisa_kasbon_lalu) || 0))
    : Math.max(0, Math.round(Number(cashAdvanceDeduction) || 0));
  const rawCicilanKasbon = dedRec
    ? Math.max(0, Math.round(Number(dedRec.cicilan_kasbon_bulan_ini) || 0))
    : Math.max(0, Math.round(Number(cashAdvanceDeduction) || 0));
  const cicilanKasbonBulanIni =
    sisaKasbonLalu > 0 ? Math.min(sisaKasbonLalu, rawCicilanKasbon) : rawCicilanKasbon;
  const sisaKasbonDepan = Math.max(0, sisaKasbonLalu - cicilanKasbonBulanIni);
  const catatanPotongan = dedRec?.catatan_potongan || '';

  const otherDeductions =
    kesalahanDeduction + izinJamDeduction + izinHariDeduction + sakitDeduction;

  const totalDeductions =
    lateDeduction +
    manualAlphaDeduction +
    otherDeductions +
    bpjsKesehatanEmployee +
    bpjsJhtEmployee +
    bpjsJpEmployee +
    pph21TER +
    cicilanKasbonBulanIni;
  const takeHomePay = Math.max(0, totalGrossSalary - totalDeductions);

  const cleanPeriod = period.replace(/\s+/g, '').toUpperCase();
  const referenceNumber = `TGI-PAY-${cleanPeriod}-${employee.nik}`;

  return {
    id: `pay-${employee.id}-${Date.now()}`,
    employeeId: employee.id,
    period,
    createdAt: getJakartaIsoTimestamp(),
    hourlyRate,
    totalActualWorkHours: resolvedActualWorkHours,
    standardWorkHoursPerDay,
    dailyWorkBreakdown: normalizedDailyBreakdown,
    dailySalary,
    presentDaysCount: resolvedPresentDays,
    standardWorkingDays,
    baseSalary,
    allowancePosition: position,
    allowanceTransport: transport,
    allowanceMeal: meal,
    allowanceCommunication: communication,
    overtimePay,
    overtimeMinutes: normalizedMinutes,
    overtimeRatePerMinute,
    overtimeFirstHourMinutes: otBreakdown.firstHourMinutes,
    overtimeSubsequentMinutes: otBreakdown.subsequentMinutes,
    overtimeFirstHourPay: otBreakdown.firstHourPay,
    overtimeSubsequentPay: otBreakdown.subsequentPay,
    bonus,
    salesCommission,
    totalLiveSalesOmset: liveSalesSummary.totalOmset,
    totalLiveSalesPcs: liveSalesSummary.totalPcs,
    liveSalesSessionsCount: liveSalesSummary.sessionsCount,
    salesCommissionPercentage: liveSalesSummary.commissionPercentage,
    coHostCommissionPercentage: liveSalesSummary.coHostCommissionPercentage,
    coHostCommissionPerPcs: liveSalesSummary.coHostCommissionPerPcs,
    coHostCommissionAmount: liveSalesSummary.coHostCommissionAmount,
    salesCommissionPerPcs: liveSalesSummary.commissionPerPcs,
    salesCommissionNotes: liveSalesSummary.commissionNotes,
    totalGrossSalary,
    employerBpjsTaxableAllowance,
    taxableGrossSalary,
    lateDeduction,
    originalLateDeduction,
    isLateFeeWaived,
    waiverReason,
    lateFrequency: resolvedLateFreq,
    totalLateMinutes: resolvedTotalLateMins,
    latePenaltyAmount,
    alphaDaysCount: resolvedAlphaDays,
    alphaPenaltyAmount,
    attendanceDeductionNotes,
    bpjsKesehatanEmployee,
    bpjsKesehatanEmployer,
    bpjsJhtEmployee,
    bpjsJhtEmployer,
    bpjsJpEmployee,
    bpjsJpEmployer,
    bpjsJkkEmployer,
    bpjsJkmEmployer,
    pph21TER,
    isDecemberReconciliation,
    annualPph21Summary,
    otherDeductions,
    tunjanganKerajinan,
    tunjanganKedisiplinan,
    kesalahanCount,
    kesalahanRate,
    catatanKesalahan,
    tanpaKeteranganHari,
    tanpaKeteranganRate,
    izinJamMenit,
    izinJamRate,
    izinHariJumlah,
    izinHariRate,
    sakitHariJumlah,
    sakitHariRate,
    sisaKasbonLalu,
    cicilanKasbonBulanIni,
    sisaKasbonDepan,
    bpjs_tk_manual: bpjsTkManual,
    bpjs_kesehatan_manual: bpjsKesehatanManual,
    pph21_manual: pph21Manual,
    catatanPotongan,
    cashAdvanceDeduction: cicilanKasbonBulanIni,
    cashAdvanceNotes,
    thrAmount,
    thrBasisAmount,
    thrShowInPayslip,
    thrHolidayName: thrShowInPayslip ? thrRec?.holiday_name : undefined,
    thrTenureLabel: thrShowInPayslip ? thrRec?.tenure_label : undefined,
    thrProportionFormula: thrShowInPayslip ? thrRec?.proportion_formula : undefined,
    thrPaymentStatus: thrShowInPayslip ? thrRec?.payment_status : undefined,
    totalDeductions,
    takeHomePay,
    // Status awal saat digenerate adalah Draft (harus melalui tahap Verifikasi / Pembayaran sebelum Lunas)
    paymentStatus: 'Draft',
    paymentDate: undefined,
    referenceNumber,
    isLocked: attendancePenaltyMeta?.isLocked,
    lockedAt: attendancePenaltyMeta?.lockedAt,
  };
}

// Helper format input NPWP (mendukung NPWP 15 digit berformat XX.XXX.XXX.X-XXX.XXX maupun NPWP 16 digit / Pemadanan NIK-NPWP Coretax DJP)
export function formatNpwpInput(rawInput: string): string {
  const digits = (rawInput || '').replace(/\D/g, '').slice(0, 16);
  if (digits.length === 16) {
    // Format NPWP 16 Digit / Pemadanan NIK-NPWP Coretax DJP 2026
    return digits;
  }
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 15)}`;
}

export function getNpwpStatusInfo(npwp?: string, ktpNumber?: string): {
  isValid: boolean;
  digitCount: number;
  isNikMatched: boolean;
  displayLabel: string;
  label: string;
} {
  const digits = (npwp || '').replace(/\D/g, '');
  const ktpDigits = (ktpNumber || '').replace(/\D/g, '');
  const isZeroPlaceholder = /^0+$/.test(digits);
  const isValid = !isZeroPlaceholder && (digits.length === 15 || digits.length === 16);
  const isNikMatched = digits.length === 16 && ktpDigits.length === 16 && digits === ktpDigits;

  let displayLabel = 'Belum Dilengkapi';
  if (isNikMatched) {
    displayLabel = 'NPWP 16 Digit (Padan NIK KTP)';
  } else if (digits.length === 16 && !isZeroPlaceholder) {
    displayLabel = 'NPWP 16 Digit (Coretax DJP)';
  } else if (digits.length === 15 && !isZeroPlaceholder) {
    displayLabel = 'NPWP 15 Digit Terdaftar';
  }

  return {
    isValid,
    digitCount: isZeroPlaceholder ? 0 : digits.length,
    isNikMatched,
    displayLabel,
    label: displayLabel,
  };
}

// Evaluasi Masa Aktif Kontrak Kerja (PKWT / PKWTT / Probation) & Indikator Sisa Hari
export function getContractValidityInfo(employee?: Partial<Employee> | null): {
  isPermanent: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  startDate: string;
  endDate: string;
  remainingDays: number | null;
  daysRemaining: number | null;
  totalDurationDays: number | null;
  progressPercent: number;
  status: 'permanent' | 'active' | 'expiring_soon' | 'expired' | 'unset';
  badgeText: string;
  shortBadgeText: string;
  badgeClass: string;
  warningMessage: string | null;
} {
  const empStatus = employee?.employmentStatus || 'PKWT (Kontrak)';
  const startDate = employee?.contractStartDate || employee?.joinDate || '';
  const endDate = employee?.contractEndDate || '';
  const isPermanent = empStatus === 'PKWTT (Tetap)' && !endDate;

  if (isPermanent) {
    return {
      isPermanent: true,
      isExpired: false,
      isExpiringSoon: false,
      startDate,
      endDate: '',
      remainingDays: null,
      daysRemaining: null,
      totalDurationDays: null,
      progressPercent: 100,
      status: 'permanent',
      badgeText: 'Aktif Permanen (PKWTT / Karyawan Tetap)',
      shortBadgeText: 'PKWTT Permanen',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      warningMessage: null,
    };
  }

  if (!endDate) {
    return {
      isPermanent: false,
      isExpired: false,
      isExpiringSoon: false,
      startDate,
      endDate: '',
      remainingDays: null,
      daysRemaining: null,
      totalDurationDays: null,
      progressPercent: 0,
      status: 'unset',
      badgeText: 'Tanggal Berakhir Kontrak Belum Diatur',
      shortBadgeText: 'Belum Diatur',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
      warningMessage:
        'Masa berakhir kontrak kerja belum diatur oleh Admin HR. Hubungi HRD untuk pembaruan periode kontrak.',
    };
  }

  const todayWibStr = getJakartaDateString();
  const today = new Date(`${todayWibStr}T00:00:00+07:00`);
  const endObj = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim()) ? `${endDate.trim()}T00:00:00+07:00` : endDate
  );
  const startObj = startDate
    ? new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())
          ? `${startDate.trim()}T00:00:00+07:00`
          : startDate
      )
    : new Date(today);

  if (isNaN(endObj.getTime())) {
    return {
      isPermanent: false,
      isExpired: false,
      isExpiringSoon: false,
      startDate,
      endDate,
      remainingDays: null,
      daysRemaining: null,
      totalDurationDays: null,
      progressPercent: 0,
      status: 'unset',
      badgeText: 'Format Tanggal Kontrak Tidak Valid',
      shortBadgeText: 'Belum Valid',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
      warningMessage: null,
    };
  }

  const diffMs = endObj.getTime() - today.getTime();
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const totalMs = Math.max(1, endObj.getTime() - startObj.getTime());
  const totalDurationDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, totalDurationDays - Math.max(0, remainingDays));
  const progressPercent = Math.min(100, Math.max(5, Math.round((elapsedDays / totalDurationDays) * 100)));

  if (remainingDays < 0) {
    const expiredDays = Math.abs(remainingDays);
    return {
      isPermanent: false,
      isExpired: true,
      isExpiringSoon: false,
      startDate,
      endDate,
      remainingDays,
      daysRemaining: remainingDays,
      totalDurationDays,
      progressPercent: 100,
      status: 'expired',
      badgeText: `Kontrak Telah Berakhir (${expiredDays} Hari Lalu)`,
      shortBadgeText: `Habis (${expiredDays} hr lalu)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      warningMessage: `Masa aktif kontrak kerja telah berakhir pada ${formatIndoDate(endDate)} (${expiredDays} hari yang lalu). Harap segera proses pembaruan atau perpanjangan PKWT/PKWTT.`,
    };
  }

  if (remainingDays <= 7) {
    return {
      isPermanent: false,
      isExpired: false,
      isExpiringSoon: true,
      startDate,
      endDate,
      remainingDays,
      daysRemaining: remainingDays,
      totalDurationDays,
      progressPercent,
      status: 'expiring_soon',
      badgeText: `Kritis: Sisa ${remainingDays} Hari`,
      shortBadgeText: `🚨 Sisa ${remainingDays} Hari`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      warningMessage: `PERINGATAN KRITIS KONTRAK (≤ 7 Hari): Kontrak kerja PKWT akan berakhir dalam ${remainingDays} hari pada ${formatIndoDate(endDate)}. Segera hubungi Admin HRD untuk proses perpanjangan kontrak kerja.`,
    };
  }

  if (remainingDays <= 30) {
    return {
      isPermanent: false,
      isExpired: false,
      isExpiringSoon: true,
      startDate,
      endDate,
      remainingDays,
      daysRemaining: remainingDays,
      totalDurationDays,
      progressPercent,
      status: 'expiring_soon',
      badgeText: `Segera Berakhir (Sisa ${remainingDays} Hari)`,
      shortBadgeText: `⚠️ Sisa ${remainingDays} Hari`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      warningMessage: `Peringatan Masa Kontrak (≤ 30 Hari): Kontrak kerja akan berakhir dalam ${remainingDays} hari pada ${formatIndoDate(endDate)}. Segera koordinasikan evaluasi atau perpanjangan kontrak kerja.`,
    };
  }

  return {
    isPermanent: false,
    isExpired: false,
    isExpiringSoon: false,
    startDate,
    endDate,
    remainingDays,
    daysRemaining: remainingDays,
    totalDurationDays,
    progressPercent,
    status: 'active',
    badgeText: `Kontrak Aktif (Sisa ${remainingDays} Hari)`,
    shortBadgeText: `✓ Sisa ${remainingDays} Hari`,
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    warningMessage: null,
  };
}

// Deteksi Rekening Bank Duplikat (>= 2 karyawan memiliki nomor rekening sama persis) atau Belum Valid (< 10 digit)
export interface BankAccountValidationResult {
  isInvalid: boolean;
  isDuplicate: boolean;
  isTooShort: boolean;
  digitCount: number;
  cleanAccountNumber: string;
  duplicateEmployeeNames: string[];
  badgeLabel: string;
  detailReason: string;
}

export function evaluateBankAccountValidity(
  employee?: Partial<Employee> | null,
  allEmployees: Employee[] = []
): BankAccountValidationResult {
  const cleanAccountNumber = (employee?.bankAccountNumber || '').replace(/\D/g, '');
  const digitCount = cleanAccountNumber.length;
  const isTooShort = digitCount < 10;

  const activeEmployees = allEmployees.filter((e) => e.isActive !== false);
  const matchingEmployees =
    digitCount > 0
      ? activeEmployees.filter(
          (e) => (e.bankAccountNumber || '').replace(/\D/g, '') === cleanAccountNumber
        )
      : [];

  const isDuplicate = matchingEmployees.length >= 2;
  const duplicateEmployeeNames = matchingEmployees
    .filter((e) => e.id !== employee?.id)
    .map((e) => e.fullName);

  const isInvalid = isDuplicate || isTooShort;
  const badgeLabel = 'Rekening Duplikat / Perlu Cek';

  let detailReason = 'Rekening Valid';
  if (isDuplicate && isTooShort) {
    detailReason = `Nomor rekening duplikat dengan ${duplicateEmployeeNames.join(', ')} & kurang dari 10 digit (${digitCount} digit)`;
  } else if (isDuplicate) {
    detailReason = `Nomor rekening (${cleanAccountNumber}) sama persis dengan: ${duplicateEmployeeNames.join(', ')}`;
  } else if (isTooShort) {
    detailReason =
      digitCount === 0
        ? 'Nomor rekening bank belum diisi'
        : `Nomor rekening kurang dari 10 digit (${digitCount} digit)`;
  }

  return {
    isInvalid,
    isDuplicate,
    isTooShort,
    digitCount,
    cleanAccountNumber,
    duplicateEmployeeNames,
    badgeLabel,
    detailReason,
  };
}

// Format Berita Transfer Bank singkat seperti "Gaji Nov 2026 Tas Grosir Import"
export function formatBankTransferRemark(period: string, companyShortName: string = 'Tas Grosir Import'): string {
  const monthShortMap: Record<string, string> = {
    januari: 'Jan',
    februari: 'Feb',
    maret: 'Mar',
    april: 'Apr',
    mei: 'Mei',
    juni: 'Jun',
    juli: 'Jul',
    agustus: 'Agu',
    september: 'Sep',
    oktober: 'Okt',
    november: 'Nov',
    desember: 'Des',
  };

  const wibNow = getJakartaDateParts();
  const fallbackPeriod = getCurrentRealTimePayrollPeriod();
  const parts = (period || fallbackPeriod).trim().split(/\s+/);
  const firstWord = (parts[0] || '').toLowerCase();
  const shortMonth = monthShortMap[firstWord] || parts[0] || INDO_MONTH_NAMES_SHORT[wibNow.month - 1] || 'Jan';
  const yearPart = parts.slice(1).join(' ') || wibNow.yearStr;

  return `Gaji ${shortMonth} ${yearPart} ${companyShortName}`.trim();
}

export const AVAILABLE_PAYROLL_PERIODS: string[] = getDynamicAvailablePayrollPeriods(new Date(), 4, 4);

export const PAYROLL_SIGNATORIES_STORAGE_KEY = 'tgi_payroll_signatories_config_v2';

export const DEFAULT_PAYROLL_SIGNATORIES: PayrollSignatoriesConfig = {
  city: 'Tangerang',
  customDateText: '',
  companyStampDataUrl: '',
  showAllThreeOnPayslip: false,
  preparedBy: {
    headerLabel: 'Prepared by Accounting,',
    topSubtitle: 'Accounting & Payroll Staff',
    name: 'Siti Rahma Ramadany, S.KM',
    jobTitle: 'Accounting & HR Department',
    signatureDataUrl: '',
    stampDataUrl: '',
    showStamp: false,
  },
  verifiedBy: {
    headerLabel: 'Diperiksa & Diverifikasi,',
    topSubtitle: 'Finance & Accounting Lead',
    name: '',
    jobTitle: 'Finance Department',
    signatureDataUrl: '',
    stampDataUrl: '',
    showStamp: false,
  },
  approvedBy: {
    headerLabel: 'Disetujui Oleh,',
    topSubtitle: 'Direktur Utama',
    name: '',
    jobTitle: 'Direktur Utama',
    signatureDataUrl: '',
    stampDataUrl: '',
    showStamp: true,
  },
};

const LEGACY_DUMMY_SIGNATORY_NAMES = new Set([
  'Siti Rahmawati, S.E.',
  'Siti Rahmawati',
  'Budi Santoso, M.Ak.',
  'Budi Santoso',
  'H. Hendra Wijaya',
  'Hendra Wijaya',
]);

export function getPayrollSignatoriesConfig(
  companyConfig?: Partial<CompanyConfig> | null
): PayrollSignatoriesConfig {
  let savedLocal: Partial<PayrollSignatoriesConfig> | null = null;
  try {
    const raw = localStorage.getItem(PAYROLL_SIGNATORIES_STORAGE_KEY);
    if (raw) {
      savedLocal = JSON.parse(raw);
    }
  } catch {
    // ignore storage errors
  }

  const base = savedLocal || companyConfig?.payrollSignatories || DEFAULT_PAYROLL_SIGNATORIES;

  const sanitizeName = (val?: string, fallbackName = '') => {
    if (!val) return fallbackName;
    const trimmed = val.trim();
    if (!trimmed || LEGACY_DUMMY_SIGNATORY_NAMES.has(trimmed)) {
      return fallbackName;
    }
    return trimmed;
  };

  const mergeItem = (
    item: Partial<SignatoryItemConfig> | undefined,
    fallback: SignatoryItemConfig
  ): SignatoryItemConfig => ({
    headerLabel: item?.headerLabel ?? fallback.headerLabel,
    topSubtitle: item?.topSubtitle ?? fallback.topSubtitle,
    name: sanitizeName(item?.name, fallback.name),
    jobTitle: item?.jobTitle ?? fallback.jobTitle,
    signatureDataUrl: item?.signatureDataUrl ?? fallback.signatureDataUrl ?? '',
    stampDataUrl: item?.stampDataUrl ?? fallback.stampDataUrl ?? '',
    showStamp: item?.showStamp ?? fallback.showStamp ?? false,
  });

  const resolvedCity =
    base.city && base.city.trim() && base.city.trim().toLowerCase() !== 'jakarta'
      ? base.city.trim()
      : DEFAULT_PAYROLL_SIGNATORIES.city;

  return {
    city: resolvedCity,
    customDateText: base.customDateText ?? DEFAULT_PAYROLL_SIGNATORIES.customDateText ?? '',
    companyStampDataUrl:
      base.companyStampDataUrl ?? DEFAULT_PAYROLL_SIGNATORIES.companyStampDataUrl ?? '',
    showAllThreeOnPayslip:
      base.showAllThreeOnPayslip ?? DEFAULT_PAYROLL_SIGNATORIES.showAllThreeOnPayslip ?? false,
    preparedBy: mergeItem(base.preparedBy, DEFAULT_PAYROLL_SIGNATORIES.preparedBy),
    verifiedBy: mergeItem(base.verifiedBy, DEFAULT_PAYROLL_SIGNATORIES.verifiedBy),
    approvedBy: mergeItem(base.approvedBy, DEFAULT_PAYROLL_SIGNATORIES.approvedBy),
  };
}

export function savePayrollSignatoriesConfig(config: PayrollSignatoriesConfig): void {
  try {
    localStorage.setItem(PAYROLL_SIGNATORIES_STORAGE_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tgi_signatories_updated', { detail: config }));
    }
  } catch (e) {
    console.error('Gagal menyimpan konfigurasi penandatangan ke localStorage:', e);
  }
}

/**
 * Generator Tanda Tangan Digital Otomatis (PNG Transparan) dari Nama Penandatangan
 */
export function generateStylizedSignatureDataUrl(
  fullName: string,
  inkColor: string = '#0f172a'
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ambil nama depan & tengah tanpa gelar untuk goresan tanda tangan yang natural
  const cleanName = (fullName || 'Tanda Tangan')
    .replace(/[,].*$/, '')
    .replace(/^(H\.|Hj\.|Ir\.|Dr\.|Drs\.)\s*/i, '')
    .trim();
  const words = cleanName.split(/\s+/);
  const displaySig =
    words.length >= 2
      ? `${words[0]} ${words[1]}`
      : words[0] || 'Signature';

  ctx.save();
  ctx.translate(45, 98);
  ctx.rotate(-0.08);
  ctx.font = 'italic bold 40px "Georgia", "Times New Roman", serif';
  ctx.fillStyle = inkColor;
  ctx.fillText(displaySig, 0, 0);

  // Tambahkan garis lengkung dekoratif khas tanda tangan eksekutif
  ctx.beginPath();
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.moveTo(-10, 14);
  ctx.quadraticCurveTo(110, -8, 250, 10);
  ctx.quadraticCurveTo(160, 26, 45, 22);
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Generator Stempel Resmi Perusahaan (PNG Transparan) untuk Tas Grosir Import
 */
export function generateOfficialCompanyStampDataUrl(
  companyName: string = 'TAS GROSIR IMPORT'
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 260;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = 130;
  const cy = 130;
  const stampColor = 'rgba(16, 185, 129, 0.85)'; // Emerald resmi

  // Lingkaran luar ganda
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.stroke();

  // Lingkaran dalam
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.stroke();

  // Pita tengah
  ctx.fillStyle = 'rgba(236, 253, 245, 0.92)';
  ctx.fillRect(cx - 104, cy - 18, 208, 36);
  ctx.strokeRect(cx - 104, cy - 18, 208, 36);

  // Teks Tengah
  ctx.fillStyle = 'rgba(6, 95, 70, 0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText('TGI OFFICIAL', cx, cy - 3);
  ctx.font = 'bold 9px Arial, sans-serif';
  ctx.fillText('VERIFIED PAYROLL & HRD', cx, cy + 10);

  // Teks Atas & Bawah
  ctx.font = 'bold 11px Arial, sans-serif';
  const shortComp = companyName.toUpperCase().slice(0, 24);
  ctx.fillText(shortComp, cx, cy - 78);
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillText('★ JAKARTA - INDONESIA ★', cx, cy + 80);

  return canvas.toDataURL('image/png');
}

const INDO_MONTH_NAME_TO_NUM: Record<string, string> = {
  januari: '01',
  jan: '01',
  februari: '02',
  feb: '02',
  maret: '03',
  mar: '03',
  april: '04',
  apr: '04',
  mei: '05',
  may: '05',
  juni: '06',
  jun: '06',
  juli: '07',
  jul: '07',
  agustus: '08',
  agu: '08',
  aug: '08',
  september: '09',
  sep: '09',
  oktober: '10',
  okt: '10',
  oct: '10',
  november: '11',
  nov: '11',
  desember: '12',
  des: '12',
  dec: '12',
};

const NUM_TO_INDO_MONTH_NAME: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

export function normalizePeriodToYearMonth(periodStr?: string | null): string {
  if (!periodStr || typeof periodStr !== 'string') return '';
  const trimmed = periodStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }
  const lower = trimmed.toLowerCase();
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : getJakartaDateParts().yearStr;
  for (const [mName, mNum] of Object.entries(INDO_MONTH_NAME_TO_NUM)) {
    if (lower.includes(mName)) {
      return `${year}-${mNum}`;
    }
  }
  return '';
}

export function formatYearMonthToIndo(yearMonth?: string | null): string {
  if (!yearMonth) return '-';
  const norm = normalizePeriodToYearMonth(yearMonth);
  if (!norm) return yearMonth;
  const [y, m] = norm.split('-');
  const monthLabel = NUM_TO_INDO_MONTH_NAME[m] || m;
  return `${monthLabel} ${y}`;
}

export function formatCutOffPeriodRange(
  periodStr?: string | null,
  cutOffStartDay: number = 26,
  cutOffEndDay: number = 25
): string {
  const currentYm = getJakartaYearMonth();
  const trimmed = (periodStr || '').trim();
  if (trimmed.includes('-') && /\d+\s+[A-Za-z]+\s*-\s*\d+\s+[A-Za-z]+/.test(trimmed)) {
    return trimmed;
  }
  const norm = normalizePeriodToYearMonth(trimmed) || currentYm;
  const [yearRaw, monthRaw] = norm.split('-');
  const wibNow = getJakartaDateParts();
  const parsedYear = parseInt(yearRaw, 10);
  const year = !isNaN(parsedYear) && parsedYear >= 2020 ? parsedYear : wibNow.year;
  const month = parseInt(monthRaw, 10) || wibNow.month;

  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthKey = String(prevMonthNum).padStart(2, '0');
  const currMonthKey = String(month).padStart(2, '0');

  const prevMonthName = NUM_TO_INDO_MONTH_NAME[prevMonthKey] || 'Oktober';
  const currMonthName = NUM_TO_INDO_MONTH_NAME[currMonthKey] || 'November';
  const startDay = Math.max(1, Math.min(28, Number(cutOffStartDay) || 26));
  const endDay = Math.max(1, Math.min(31, Number(cutOffEndDay) || 25));

  if (prevYear !== year) {
    return `${startDay} ${prevMonthName} ${prevYear} - ${endDay} ${currMonthName} ${year}`;
  }
  return `${startDay} ${prevMonthName} - ${endDay} ${currMonthName} ${year}`;
}

export function formatEndOfPeriodPrintDate(
  periodStr?: string | null,
  customDateText?: string | null
): string {
  if (customDateText && customDateText.trim() && !customDateText.includes('1900')) {
    return customDateText.trim();
  }
  const currentYm = getJakartaYearMonth();
  const wibNow = getJakartaDateParts();
  const norm = normalizePeriodToYearMonth(periodStr) || currentYm;
  const [yearRaw, monthRaw] = norm.split('-');
  const parsedYear = parseInt(yearRaw, 10);
  const year = !isNaN(parsedYear) && parsedYear >= 2020 ? parsedYear : wibNow.year;
  const month = parseInt(monthRaw, 10) || wibNow.month;
  const lastDay = new Date(year, month, 0).getDate();
  const monthKey = String(month).padStart(2, '0');
  const monthName = NUM_TO_INDO_MONTH_NAME[monthKey] || 'November';
  return `${lastDay} ${monthName} ${year}`;
}

export function doesEmployeeMatchBonus(
  bonus: EmployeeBonus,
  employee?: { id?: string; nik?: string; fullName?: string } | null
): boolean {
  if (!bonus || !employee) return false;
  if (employee.id && bonus.employee_id && String(bonus.employee_id).trim() === String(employee.id).trim()) {
    return true;
  }
  if (
    employee.nik &&
    bonus.employee_nik &&
    String(bonus.employee_nik).trim().toLowerCase() === String(employee.nik).trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function getEmployeeBonusesForPeriod(
  allBonuses: EmployeeBonus[],
  employee?: { id?: string; nik?: string; fullName?: string } | null,
  periodOrDate?: string | null,
  allowCurrentMonthFallback = true
): {
  bonuses: EmployeeBonus[];
  totalAmount: number;
  combinedNotes: string;
} {
  if (!Array.isArray(allBonuses) || !employee) {
    return { bonuses: [], totalAmount: 0, combinedNotes: '' };
  }

  const empBonuses = allBonuses.filter((b) => doesEmployeeMatchBonus(b, employee));
  if (empBonuses.length === 0) {
    return { bonuses: [], totalAmount: 0, combinedNotes: '' };
  }

  const targetYm = normalizePeriodToYearMonth(periodOrDate);
  let matched = targetYm
    ? empBonuses.filter((b) => normalizePeriodToYearMonth(b.period_month) === targetYm)
    : empBonuses;

  if (matched.length === 0 && allowCurrentMonthFallback) {
    const currentYm = getJakartaYearMonth();
    const currentMonthBonuses = empBonuses.filter(
      (b) => normalizePeriodToYearMonth(b.period_month) === currentYm
    );
    matched = currentMonthBonuses.length > 0 ? currentMonthBonuses : empBonuses;
  }

  const totalAmount = matched.reduce((sum, b) => sum + Math.max(0, Math.round(Number(b.amount) || 0)), 0);
  const combinedNotes = matched
    .map((b) => (b.reason_note || '').trim())
    .filter(Boolean)
    .join(' • ');

  return {
    bonuses: matched,
    totalAmount,
    combinedNotes,
  };
}

export function doesEmployeeMatchAdjustment(
  adj: EmployeeAdjustment | null | undefined,
  employee: Partial<Employee> | null | undefined
): boolean {
  if (!adj || !employee) return false;
  if (employee.id && adj.employee_id && adj.employee_id === employee.id) {
    return true;
  }
  const empNik = (employee.nik || '').trim().toLowerCase();
  const adjNik = (adj.employee_nik || '').trim().toLowerCase();
  if (empNik && adjNik && empNik === adjNik) {
    return true;
  }
  const empName = (employee.fullName || '').trim().toLowerCase();
  const adjName = (adj.employee_name || '').trim().toLowerCase();
  if (empName && adjName && empName === adjName) {
    return true;
  }
  return false;
}

export function getEmployeeAdjustmentForPeriod(
  allAdjustments: EmployeeAdjustment[] | null | undefined,
  employee: Partial<Employee> | null | undefined,
  periodOrDate?: string,
  allowCurrentMonthFallback: boolean = true
): EmployeeAdjustment | null {
  if (!Array.isArray(allAdjustments) || !employee) return null;

  const empAdjustments = allAdjustments
    .filter((a) => doesEmployeeMatchAdjustment(a, employee))
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  if (empAdjustments.length === 0) return null;

  const targetYm = normalizePeriodToYearMonth(periodOrDate);
  if (targetYm) {
    const exactMatch = empAdjustments.find(
      (a) => normalizePeriodToYearMonth(a.period_month) === targetYm
    );
    if (exactMatch) return exactMatch;
  }

  if (allowCurrentMonthFallback) {
    const currentYm = getJakartaYearMonth();
    const currentMonthMatch = empAdjustments.find(
      (a) => normalizePeriodToYearMonth(a.period_month) === currentYm
    );
    if (currentMonthMatch) return currentMonthMatch;
    return empAdjustments[0];
  }

  return null;
}

export function doesEmployeeMatchPayrollDeduction(
  ded: PayrollDeductionRecord | null | undefined,
  employee: Partial<Employee> | null | undefined
): boolean {
  if (!ded || !employee) return false;
  if (employee.id && ded.employee_id && ded.employee_id === employee.id) {
    return true;
  }
  const empNik = (employee.nik || '').trim().toLowerCase();
  const dedNik = (ded.employee_nik || '').trim().toLowerCase();
  if (empNik && dedNik && empNik === dedNik) {
    return true;
  }
  const empName = (employee.fullName || '').trim().toLowerCase();
  const dedName = (ded.employee_name || '').trim().toLowerCase();
  if (empName && dedName && empName === dedName) {
    return true;
  }
  return false;
}

export function getEmployeePayrollDeductionForPeriod(
  allDeductions: PayrollDeductionRecord[] | null | undefined,
  employee: Partial<Employee> | null | undefined,
  periodOrDate?: string,
  allowCurrentMonthFallback: boolean = true
): PayrollDeductionRecord | null {
  if (!Array.isArray(allDeductions) || !employee) return null;

  const empDeductions = allDeductions
    .filter((d) => doesEmployeeMatchPayrollDeduction(d, employee))
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  if (empDeductions.length === 0) return null;

  const targetYm = normalizePeriodToYearMonth(periodOrDate);
  if (targetYm) {
    const exactMatch = empDeductions.find(
      (d) => normalizePeriodToYearMonth(d.period_month) === targetYm
    );
    if (exactMatch) return exactMatch;
  }

  if (allowCurrentMonthFallback) {
    const currentYm = getJakartaYearMonth();
    const currentMonthMatch = empDeductions.find(
      (d) => normalizePeriodToYearMonth(d.period_month) === currentYm
    );
    if (currentMonthMatch) return currentMonthMatch;
    return empDeductions[0];
  }

  return null;
}

export function getApprovedSickLeaveSummaryForPeriod(
  allLeaves: LeaveRequest[] | null | undefined,
  employee: Partial<Employee> | null | undefined,
  periodOrDate?: string,
  dailySalaryRate: number = 0
): {
  sickDays: number;
  sickRatePerDay: number;
  sickDeductionTotal: number;
  sickNotes: string;
} {
  if (!Array.isArray(allLeaves) || !employee) {
    return {
      sickDays: 0,
      sickRatePerDay: 0,
      sickDeductionTotal: 0,
      sickNotes: '',
    };
  }

  const empSickLeaves = allLeaves.filter(
    (l) =>
      l &&
      l.employeeId === employee.id &&
      l.status === 'Disetujui' &&
      (l.type === 'Cuti Sakit' || (l.type || '').toLowerCase().includes('sakit'))
  );

  if (empSickLeaves.length === 0) {
    return {
      sickDays: 0,
      sickRatePerDay: 0,
      sickDeductionTotal: 0,
      sickNotes: '',
    };
  }

  const targetYm = normalizePeriodToYearMonth(periodOrDate);
  const periodMatched = targetYm
    ? empSickLeaves.filter((l) => {
        const startYm = normalizePeriodToYearMonth(l.startDate);
        const endYm = normalizePeriodToYearMonth(l.endDate);
        return startYm === targetYm || endYm === targetYm;
      })
    : empSickLeaves;

  const effectiveList = periodMatched.length > 0 ? periodMatched : empSickLeaves;

  let sickDays = 0;
  let unpaidSickDays = 0;
  const notesArr: string[] = [];

  for (const item of effectiveList) {
    const days = Math.max(0, Number(item.totalDays) || 0);
    sickDays += days;
    const reasonText = (item.reason || '').toLowerCase();
    // Jika ada keterangan sakit tanpa surat dokter / potong gaji, dihitung potong gaji harian; jika dengan surat dokter / normal maka Rp 0 (dibayar penuh)
    if (
      reasonText.includes('tanpa surat dokter') ||
      reasonText.includes('potong gaji') ||
      reasonText.includes('unpaid')
    ) {
      unpaidSickDays += days;
    }
    if (item.reason) {
      notesArr.push(item.reason.trim());
    }
  }

  const sickDeductionTotal =
    unpaidSickDays > 0 ? Math.round(unpaidSickDays * Math.max(0, dailySalaryRate)) : 0;
  const sickRatePerDay = sickDeductionTotal > 0 ? Math.max(0, Math.round(dailySalaryRate)) : 0;

  return {
    sickDays,
    sickRatePerDay,
    sickDeductionTotal,
    sickNotes: notesArr.join(' • '),
  };
}

// ============================================================================
// KALKULATOR THR OTOMATIS SESUAI PERMENAKER NO. 6/2016 & INTEGRASI SLIP GAJI
// ============================================================================

export const HOLIDAY_PRESETS_CONFIG: Array<{
  name: string;
  datesByYear: Record<number, string>;
  defaultMonthDay: string;
}> = [
  {
    name: 'Hari Raya Idul Fitri',
    datesByYear: {
      2025: '2025-03-31',
      2026: '2026-03-20',
      2027: '2027-03-10',
      2028: '2028-02-27',
    },
    defaultMonthDay: '03-20',
  },
  {
    name: 'Hari Raya Natal & Tahun Baru',
    datesByYear: {
      2025: '2025-12-25',
      2026: '2026-12-25',
      2027: '2027-12-25',
      2028: '2028-12-25',
    },
    defaultMonthDay: '12-25',
  },
  {
    name: 'Hari Raya Nyepi',
    datesByYear: {
      2025: '2025-03-29',
      2026: '2026-03-19',
      2027: '2027-03-08',
      2028: '2028-03-26',
    },
    defaultMonthDay: '03-19',
  },
  {
    name: 'Hari Raya Waisak',
    datesByYear: {
      2025: '2025-05-12',
      2026: '2026-05-31',
      2027: '2027-05-20',
      2028: '2028-05-09',
    },
    defaultMonthDay: '05-31',
  },
  {
    name: 'Tahun Baru Imlek',
    datesByYear: {
      2025: '2025-01-29',
      2026: '2026-02-17',
      2027: '2027-02-06',
      2028: '2028-01-26',
    },
    defaultMonthDay: '02-17',
  },
  {
    name: 'Hari Raya Keagamaan Lainnya',
    datesByYear: {},
    defaultMonthDay: '12-25',
  },
];

/**
 * Menghasilkan tanggal Hari Raya (YYYY-MM-DD) yang valid untuk Tahun & Jenis Hari Raya tertentu.
 * Jika tahun yang dipilih adalah tahun berjalan (WIB) dan tanggal preset sudah terlewat (< hari ini WIB)
 * pada kategori "Hari Raya Keagamaan Lainnya", maka otomatis disesuaikan ke tanggal valid >= hari ini.
 */
export function getHolidayDateForYearAndPreset(
  holidayName: string,
  targetYear: number,
  ensureFutureInCurrentYear: boolean = false
): string {
  const todayWib = getJakartaDateString();
  const currentWibYear = getJakartaDateParts().year;
  const preset =
    HOLIDAY_PRESETS_CONFIG.find((p) => p.name === holidayName) || HOLIDAY_PRESETS_CONFIG[0];

  const mapped = preset.datesByYear[targetYear] || `${targetYear}-${preset.defaultMonthDay}`;
  if (ensureFutureInCurrentYear && targetYear === currentWibYear && mapped < todayWib) {
    // Jika tanggal preset di tahun berjalan sudah lewat dari hari ini WIB, gunakan tanggal mendatang di tahun ini (misal 25 Desember) atau hari ini
    const dec25 = `${targetYear}-12-25`;
    return dec25 >= todayWib ? dec25 : todayWib;
  }
  return mapped;
}

/**
 * Menentukan default konfigurasi THR yang 100% real-time sesuai waktu lokal WIB (Asia/Jakarta):
 * - Memastikan default Tanggal Hari Raya selalu >= tanggal hari ini (WIB) dan tidak pernah jatuh ke masa lalu.
 * - Jika Idul Fitri tahun berjalan sudah lewat (misal saat ini November 2026 dan Idul Fitri Maret 2026 sudah lewat),
 *   otomatis mengarahkan ke Hari Raya terdekat yang akan datang (>= hari ini WIB) atau Idul Fitri tahun berikutnya.
 */
export function getDefaultUpcomingHolidayConfig(
  existingRecords?: ThrPayoutRecord[] | null,
  currentPayrollPeriod?: string | null
): {
  selectedYear: number;
  selectedHolidayName: string;
  selectedHolidayDate: string;
  selectedPeriodMonth: string;
} {
  const todayWib = getJakartaDateString();
  const currentYm = normalizePeriodToYearMonth(currentPayrollPeriod) || getJakartaYearMonth();
  const currentWibYear = getJakartaDateParts().year;

  // Cek apakah sudah ada data THR tersimpan dengan holiday_date >= todayWib
  if (Array.isArray(existingRecords) && existingRecords.length > 0) {
    const upcomingSaved = existingRecords.find(
      (r) => r && r.holiday_date && r.holiday_date.slice(0, 10) >= todayWib
    );
    if (upcomingSaved) {
      const yr = Number(upcomingSaved.thr_year) || Number(upcomingSaved.holiday_date.slice(0, 4)) || currentWibYear;
      return {
        selectedYear: yr,
        selectedHolidayName: upcomingSaved.holiday_name || 'Hari Raya Idul Fitri',
        selectedHolidayDate: upcomingSaved.holiday_date.slice(0, 10),
        selectedPeriodMonth: normalizePeriodToYearMonth(upcomingSaved.period_month) || currentYm,
      };
    }
  }

  // Cek apakah Idul Fitri tahun berjalan masih akan datang (>= todayWib)
  const idulFitriThisYear = getHolidayDateForYearAndPreset('Hari Raya Idul Fitri', currentWibYear);
  if (idulFitriThisYear >= todayWib) {
    return {
      selectedYear: currentWibYear,
      selectedHolidayName: 'Hari Raya Idul Fitri',
      selectedHolidayDate: idulFitriThisYear,
      selectedPeriodMonth: currentYm,
    };
  }

  // Jika Idul Fitri tahun berjalan sudah lewat, cek apakah Hari Raya Natal & Tahun Baru tahun berjalan masih >= todayWib
  const natalThisYear = getHolidayDateForYearAndPreset('Hari Raya Natal & Tahun Baru', currentWibYear);
  if (natalThisYear >= todayWib) {
    return {
      selectedYear: currentWibYear,
      selectedHolidayName: 'Hari Raya Natal & Tahun Baru',
      selectedHolidayDate: natalThisYear,
      selectedPeriodMonth: currentYm,
    };
  }

  // Jika akhir Desember sudah lewat, arahkan ke Idul Fitri tahun berikutnya
  const nextYear = currentWibYear + 1;
  const idulFitriNextYear = getHolidayDateForYearAndPreset('Hari Raya Idul Fitri', nextYear);
  return {
    selectedYear: nextYear,
    selectedHolidayName: 'Hari Raya Idul Fitri',
    selectedHolidayDate: idulFitriNextYear,
    selectedPeriodMonth: currentYm,
  };
}

export function doesEmployeeMatchThrPayout(
  thr: ThrPayoutRecord | null | undefined,
  employee: Partial<Employee> | null | undefined
): boolean {
  if (!thr || !employee) return false;
  if (employee.id && thr.employee_id && thr.employee_id === employee.id) {
    return true;
  }
  const empNik = (employee.nik || '').trim().toLowerCase();
  const thrNik = (thr.employee_nik || '').trim().toLowerCase();
  if (empNik && thrNik && empNik === thrNik) {
    return true;
  }
  const empName = (employee.fullName || '').trim().toLowerCase();
  const thrName = (thr.employee_name || '').trim().toLowerCase();
  if (empName && thrName && empName === thrName) {
    return true;
  }
  return false;
}

export function getEmployeeThrRecordForPeriod(
  allThrPayouts: ThrPayoutRecord[] | null | undefined,
  employee: Partial<Employee> | null | undefined,
  periodOrDate?: string,
  thrYear?: number
): ThrPayoutRecord | null {
  if (!Array.isArray(allThrPayouts) || !employee) return null;

  const empThrs = allThrPayouts
    .filter((t) => doesEmployeeMatchThrPayout(t, employee))
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  if (empThrs.length === 0) return null;

  if (thrYear) {
    const yearMatch = empThrs.find((t) => Number(t.thr_year) === Number(thrYear));
    if (yearMatch) return yearMatch;
  }

  const targetYm = normalizePeriodToYearMonth(periodOrDate);
  if (targetYm) {
    const exactMatch = empThrs.find(
      (t) => normalizePeriodToYearMonth(t.period_month) === targetYm
    );
    if (exactMatch) return exactMatch;

    const targetYear = Number(targetYm.slice(0, 4));
    if (!isNaN(targetYear) && targetYear > 2000) {
      const sameYearMatch = empThrs.find((t) => Number(t.thr_year) === targetYear);
      if (sameYearMatch) return sameYearMatch;
    }
  }

  return empThrs[0];
}

/**
 * Mengambil data THR karyawan HANYA JIKA Admin sudah mencentang checkbox
 * "Tampilkan & Cairkan di Slip Gaji" (show_in_payslip === true).
 * Jika show_in_payslip === false, fungsi ini wajib mengembalikan null agar THR
 * tidak muncul dan tidak dihitung di Slip Gaji maupun Portal Karyawan.
 */
export function getActiveEmployeeThrForPayslip(
  allThrPayouts: ThrPayoutRecord[] | null | undefined,
  employee: Partial<Employee> | null | undefined,
  periodOrDate?: string
): ThrPayoutRecord | null {
  const record = getEmployeeThrRecordForPeriod(allThrPayouts, employee, periodOrDate);
  if (!record) return null;
  if (record.show_in_payslip !== true) return null;
  if (Number(record.total_thr_amount) <= 0) return null;
  return record;
}

export function calculateEmployeeThrPermenaker(params: {
  employee: Employee;
  holidayDate: string; // YYYY-MM-DD
  holidayName?: string;
  thrYear?: number;
  periodMonth?: string; // YYYY-MM
  partTimeLogs?: PartTimeWorkLog[];
  attendances?: AttendanceRecord[];
  existingRecord?: Partial<ThrPayoutRecord> | null;
}): ThrPayoutRecord {
  const {
    employee,
    holidayDate,
    holidayName = 'Hari Raya Idul Fitri',
    thrYear,
    periodMonth,
    partTimeLogs = [],
    attendances = [],
    existingRecord,
  } = params;

  const cleanHolidayDate =
    holidayDate && /^\d{4}-\d{2}-\d{2}/.test(holidayDate.trim())
      ? holidayDate.trim().slice(0, 10)
      : getJakartaDateString();

  const resolvedYear =
    thrYear && !isNaN(Number(thrYear))
      ? Number(thrYear)
      : Number(cleanHolidayDate.slice(0, 4)) || getJakartaDateParts().year;

  const resolvedPeriodMonth =
    periodMonth && /^\d{4}-\d{2}$/.test(periodMonth.trim())
      ? periodMonth.trim()
      : normalizePeriodToYearMonth(periodMonth) || cleanHolidayDate.slice(0, 7);

  const rawJoinDate = (employee.joinDate || employee.contractStartDate || '').trim();
  const cleanJoinDate = /^\d{4}-\d{2}-\d{2}/.test(rawJoinDate)
    ? rawJoinDate.slice(0, 10)
    : `${resolvedYear - 1}-01-01`;

  const joinObj = new Date(`${cleanJoinDate}T00:00:00+07:00`);
  const holidayObj = new Date(`${cleanHolidayDate}T00:00:00+07:00`);
  const diffMs = holidayObj.getTime() - joinObj.getTime();
  const tenureDays = !isNaN(diffMs) && diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;

  let tenureMonths = 0;
  if (tenureDays >= 30) {
    let calMonths =
      (holidayObj.getFullYear() - joinObj.getFullYear()) * 12 +
      (holidayObj.getMonth() - joinObj.getMonth());
    if (holidayObj.getDate() < joinObj.getDate()) {
      calMonths -= 1;
    }
    const approxMonthsByDays = Math.floor(tenureDays / 30);
    tenureMonths = Math.max(1, calMonths, approxMonthsByDays >= 12 ? 12 : calMonths);
    if (tenureDays >= 365 && tenureMonths < 12) {
      tenureMonths = 12;
    }
  }

  let tenureLabel = '';
  if (tenureDays < 30) {
    tenureLabel = `< 1 Bulan (${tenureDays} Hari)`;
  } else if (tenureMonths >= 12) {
    const yrs = Math.floor(tenureMonths / 12);
    const remM = tenureMonths % 12;
    tenureLabel =
      remM > 0
        ? `${yrs} Tahun ${remM} Bulan (${tenureMonths} Bln)`
        : `${yrs} Tahun (${tenureMonths} Bulan)`;
  } else {
    tenureLabel = `${tenureMonths} Bulan (${tenureDays} Hari)`;
  }

  const isPartTime = isEmployeePartTime(employee);
  const stdDailyHours = getEmployeeStandardDailyHours(employee);
  const empHourlyRate = getEmployeeHourlyRate(employee, stdDailyHours, 25);

  let baseSalaryComponent = 0;
  let fixedAllowanceComponent = 0;
  let partTimeAvgMonthlyWage = 0;
  let calculationBasisAmount = 0;
  let eligibilityStatus: ThrEligibilityStatus = 'Belum Berhak THR';
  let proportionFormula = 'Masa Kerja < 1 Bulan (< 30 Hari) — Belum Berhak THR';
  let calculatedThrAmount = 0;

  if (!isPartTime) {
    // Karyawan Tetap (PKWTT) & Kontrak (PKWT): Dasar Upah = Gaji Pokok + Tunjangan Tetap (Jabatan)
    baseSalaryComponent =
      Math.max(0, Math.round(Number(employee.baseSalary) || 0)) ||
      Math.round(empHourlyRate * stdDailyHours * 25);
    fixedAllowanceComponent = Math.max(0, Math.round(Number(employee.allowances?.position) || 0));
    calculationBasisAmount = baseSalaryComponent + fixedAllowanceComponent;

    if (tenureDays < 30 || tenureMonths < 1) {
      eligibilityStatus = 'Belum Berhak THR';
      proportionFormula = 'Masa Kerja < 1 Bulan (< 30 Hari) — Rp 0';
      calculatedThrAmount = 0;
    } else if (tenureMonths >= 12) {
      eligibilityStatus = 'Berhak Penuh (100%)';
      proportionFormula = '100% × (Gaji Pokok + Tunjangan Tetap)';
      calculatedThrAmount = Math.round(calculationBasisAmount);
    } else {
      eligibilityStatus = 'Berhak Proporsional';
      proportionFormula = `(${tenureMonths} / 12 Bulan) × (Gaji Pokok + Tunj. Tetap)`;
      calculatedThrAmount = Math.round((tenureMonths / 12) * calculationBasisAmount);
    }
  } else {
    // Karyawan Part-Time / Harian Lepas:
    // Masa kerja >= 12 bulan: 1x rata-rata pendapatan bulanan dari riwayat payroll/absensi 12 bulan terakhir.
    // Masa kerja 1 s/d 11 bulan: (Jumlah Bulan Masa Kerja / 12) × Rata-rata Pendapatan Bulanan selama masa kerja.
    const windowMonths = tenureMonths >= 12 ? 12 : Math.max(1, tenureMonths);
    const windowStartObj = new Date(holidayObj);
    windowStartObj.setMonth(windowStartObj.getMonth() - windowMonths);
    const windowStartStr = getJakartaDateString(windowStartObj);

    const monthlyEarningsMap = new Map<string, number>();
    const recordedEmpDateKeys = new Set<string>();

    for (const log of partTimeLogs) {
      if (!log) continue;
      const logEmpId = log.employeeId || log.employee_id;
      if (logEmpId !== employee.id) continue;
      const dStr = (log.date || log.work_date || '').slice(0, 10);
      if (!dStr || dStr < windowStartStr || dStr > cleanHolidayDate) continue;
      const ym = dStr.slice(0, 7);
      const wage =
        Math.max(0, Math.round(Number(log.dailyWage ?? log.daily_wage) || 0)) ||
        Math.round(
          (Number(log.normalHours ?? log.normal_hours ?? log.hoursWorked) || 0) * empHourlyRate
        );
      if (wage > 0) {
        recordedEmpDateKeys.add(`${employee.id}_${dStr}`);
        monthlyEarningsMap.set(ym, (monthlyEarningsMap.get(ym) || 0) + wage);
      }
    }

    for (const att of attendances) {
      if (!att || att.employeeId !== employee.id) continue;
      const dStr = (att.date || '').slice(0, 10);
      if (!dStr || dStr < windowStartStr || dStr > cleanHolidayDate) continue;
      if (['Alpa', 'Sakit', 'Izin', 'Cuti'].includes(att.status)) continue;
      if (recordedEmpDateKeys.has(`${employee.id}_${dStr}`)) continue;
      const capped = calculateCappedDailyWorkHours(
        att.checkIn,
        att.checkOut,
        att.workHours,
        stdDailyHours,
        att.overtimeHours || 0,
        dStr
      );
      const wage = Math.round(capped.cappedWorkHours * empHourlyRate);
      if (wage > 0) {
        const ym = dStr.slice(0, 7);
        monthlyEarningsMap.set(ym, (monthlyEarningsMap.get(ym) || 0) + wage);
      }
    }

    if (monthlyEarningsMap.size > 0) {
      const totalLoggedEarnings = Array.from(monthlyEarningsMap.values()).reduce(
        (sum, val) => sum + val,
        0
      );
      partTimeAvgMonthlyWage = Math.round(totalLoggedEarnings / monthlyEarningsMap.size);
    } else {
      // Fallback estimasi bulanan jika riwayat log belum tersedia (24 hari kerja × jam standar harian × tarif per jam)
      partTimeAvgMonthlyWage =
        Math.max(0, Math.round(Number(employee.baseSalary) || 0)) ||
        Math.round(empHourlyRate * stdDailyHours * 24);
    }

    calculationBasisAmount = partTimeAvgMonthlyWage;

    if (tenureDays < 30 || tenureMonths < 1) {
      eligibilityStatus = 'Belum Berhak THR';
      proportionFormula = 'Masa Kerja < 1 Bulan (< 30 Hari) — Rp 0';
      calculatedThrAmount = 0;
    } else if (tenureMonths >= 12) {
      eligibilityStatus = 'Berhak Penuh (100%)';
      proportionFormula = '1x Rata-rata Pendapatan Bulanan (12 Bln Terakhir)';
      calculatedThrAmount = Math.round(partTimeAvgMonthlyWage);
    } else {
      eligibilityStatus = 'Berhak Proporsional';
      proportionFormula = `(${tenureMonths} / 12 Bulan) × Rata-rata Pendapatan Bulanan`;
      calculatedThrAmount = Math.round((tenureMonths / 12) * partTimeAvgMonthlyWage);
    }
  }

  const manualAdjustmentAmount =
    existingRecord?.manual_adjustment_amount !== undefined &&
    !isNaN(Number(existingRecord.manual_adjustment_amount))
      ? Math.round(Number(existingRecord.manual_adjustment_amount))
      : 0;

  const totalThrAmount = Math.max(0, Math.round(calculatedThrAmount + manualAdjustmentAmount));

  // WAJIB default false sampai Admin mencentang secara manual per karyawan
  const showInPayslip = Boolean(existingRecord?.show_in_payslip ?? false);
  const paymentStatus =
    existingRecord?.payment_status === 'Sudah Dibayar' ? 'Sudah Dibayar' : 'Belum Cair';

  const empTypeLabel = isPartTime
    ? 'Part-Time'
    : employee.employmentStatus || employee.status || 'PKWT (Kontrak)';

  const nowWibIso = getJakartaIsoTimestamp();

  return {
    id: existingRecord?.id || `thr-${resolvedYear}-${employee.id}`,
    employee_id: employee.id,
    employee_nik: employee.nik || '',
    employee_name: employee.fullName || '',
    department: employee.department || 'Operasional',
    role: employee.role || 'Staff',
    employment_type: empTypeLabel,
    join_date: cleanJoinDate,
    thr_year: resolvedYear,
    holiday_name: existingRecord?.holiday_name || holidayName,
    holiday_date: cleanHolidayDate,
    period_month: resolvedPeriodMonth,
    tenure_months: tenureMonths,
    tenure_days: tenureDays,
    tenure_label: tenureLabel,
    eligibility_status: eligibilityStatus,
    proportion_formula: proportionFormula,
    base_salary_component: baseSalaryComponent,
    fixed_allowance_component: fixedAllowanceComponent,
    parttime_avg_monthly_wage: partTimeAvgMonthlyWage,
    calculation_basis_amount: calculationBasisAmount,
    calculated_thr_amount: calculatedThrAmount,
    manual_adjustment_amount: manualAdjustmentAmount,
    total_thr_amount: totalThrAmount,
    show_in_payslip: showInPayslip,
    payment_status: paymentStatus,
    paid_at: existingRecord?.paid_at,
    paid_by: existingRecord?.paid_by,
    payment_method: existingRecord?.payment_method || 'Transfer Bank',
    reference_number:
      existingRecord?.reference_number ||
      `TGI-THR-${resolvedYear}-${(employee.nik || employee.id).replace(/\s+/g, '')}`,
    notes: existingRecord?.notes || '',
    created_at: existingRecord?.created_at || nowWibIso,
    updated_at: nowWibIso,
  };
}


