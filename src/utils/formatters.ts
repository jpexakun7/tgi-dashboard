import {
  Employee,
  PayrollRecord,
  PTKPStatus,
  WorkShift,
  AttendanceRecord,
  AttendancePenaltyPolicy,
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

// Hitung Tarif Lembur Per Menit: ((Gaji Pokok + Tunjangan Jabatan) / 173 / 60) * Multiplier
export function getOvertimeRatePerMinute(
  employee?: Partial<Employee> | null,
  multiplier: number = 1.5,
  customRatePerMinute?: number
): number {
  if (customRatePerMinute && customRatePerMinute > 0) {
    return Math.round(customRatePerMinute);
  }
  const baseSalary = Number(employee?.baseSalary) || 5000000;
  const position = Number(employee?.allowances?.position) || 0;
  const perMinuteBase = (baseSalary + position) / 173 / 60;
  return Math.max(100, Math.round(perMinuteBase * multiplier));
}

// Hitung Total Upah Lembur Berdasarkan Durasi Menit
export function calculateOvertimePayByMinutes(
  employee?: Partial<Employee> | null,
  totalMinutes: number = 0,
  multiplier: number = 1.5,
  customRatePerMinute?: number
): number {
  const ratePerMin = getOvertimeRatePerMinute(employee, multiplier, customRatePerMinute);
  return Math.round(Math.max(0, totalMinutes) * ratePerMin);
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
  overrideGracePeriodMinutes?: number
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

  // Parse actual checkOut
  const [outH, outM] = (checkOut || '').split(':').map(Number);
  let earlyLeaveMinutes = 0;
  let workHours = 0;
  const breakMins = Math.max(0, Number(shift.breakDurationMinutes) || 0);

  if (!isNaN(ch) && !isNaN(cm) && !isNaN(outH) && !isNaN(outM)) {
    let actualStart = ch * 60 + cm;
    let actualEnd = outH * 60 + outM;
    if (actualEnd < actualStart) {
      actualEnd += 24 * 60;
    }
    const rawDurationMins = Math.max(0, actualEnd - actualStart);
    const netDurationMins =
      rawDurationMins > 240 ? Math.max(0, rawDurationMins - breakMins) : rawDurationMins;
    workHours = Number((netDurationMins / 60).toFixed(1));

    // Check early leave against scheduledEnd
    let normalizedOut = outH * 60 + outM;
    if (scheduledEnd > 24 * 60 && normalizedOut < 12 * 60) {
      normalizedOut += 24 * 60;
    }
    if (normalizedOut < scheduledEnd) {
      earlyLeaveMinutes = Math.max(0, scheduledEnd - normalizedOut);
    }
  } else {
    // Default scheduled work hours if checkOut not yet filled
    const scheduledRaw = Math.max(0, scheduledEnd - scheduledStart);
    const scheduledNet =
      scheduledRaw > 240 ? Math.max(0, scheduledRaw - breakMins) : scheduledRaw;
    workHours = Number((scheduledNet / 60).toFixed(1));
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
    let mergedCheckOutPhoto = primary.checkOutPhotoSnapshot;
    let mergedCheckOutTimestamp = primary.checkOutFullTimestamp;
    let mergedCheckOutCoords = primary.checkOutLocationCoords;
    let mergedCheckOutAddress = primary.checkOutLocationAddress;

    for (const r of sorted) {
      if (r.checkOut && r.checkOut !== '-' && r.checkOut.trim() !== '') {
        mergedCheckOut = r.checkOut;
        mergedCheckOutPhoto = r.checkOutPhotoSnapshot || mergedCheckOutPhoto;
        mergedCheckOutTimestamp = r.checkOutFullTimestamp || mergedCheckOutTimestamp;
        mergedCheckOutCoords = r.checkOutLocationCoords || mergedCheckOutCoords;
        mergedCheckOutAddress = r.checkOutLocationAddress || mergedCheckOutAddress;
      }
    }

    const emp = empMap.get(primary.employeeId);
    const empShift = getEmployeeShift(emp, shifts);
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
        effectiveGrace
      );

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
        checkOut: mergedCheckOut,
        checkOutPhotoSnapshot: mergedCheckOutPhoto,
        checkOutFullTimestamp: mergedCheckOutTimestamp,
        checkOutLocationCoords: mergedCheckOutCoords,
        checkOutLocationAddress: mergedCheckOutAddress,
        scheduledCheckIn: scheduledIn,
        scheduledCheckOut: scheduledOut,
        shiftId: empShift.id || primary.shiftId,
        shiftName: empShift.name || primary.shiftName,
        lateMinutes: finalLateMins,
        earlyLeaveMinutes: evalRes.earlyLeaveMinutes,
        workHours: evalRes.workHours,
        status: finalStatus,
      });
    } else {
      deduplicated.push({
        ...primary,
        checkOut: isNonPresentStatus ? '-' : mergedCheckOut,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        workHours: isNonPresentStatus ? 0 : primary.workHours || 0,
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

  const todayIso = new Date().toISOString().split('T')[0];
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
  presentDaysCount: number;
  onTimeDaysCount: number;
  lateFrequency: number; // Berapa kali/hari terlambat melewati toleransi
  totalLateMinutes: number; // Total durasi terlambat (menit)
  latePenaltyAmount: number; // Nominal denda terlambat (Rp)
  alphaDaysCount: number; // Jumlah hari Alpha / Mangkir
  alphaPenaltyAmount: number; // Nominal potongan Alpha (Rp)
  sickOrLeaveDaysCount: number; // Jumlah hari Sakit / Izin / Cuti
  totalDeductionAmount: number; // Total gabungan (latePenaltyAmount + alphaPenaltyAmount)
  deductionNotes: string; // Contoh: "Potongan Terlambat 4x / 210 mnt: -Rp 100.000"
  deduplicatedRecords: AttendanceRecord[];
}

// Hitung otomatis Frekuensi Terlambat, Total Menit Terlambat, Alpha, dan Nominal Potongan per Karyawan
export function calculateEmployeeAttendancePenalty(
  employee: Employee,
  attendances: AttendanceRecord[],
  shifts?: WorkShift[],
  penaltyPolicy?: Partial<AttendancePenaltyPolicy> | null
): EmployeeAttendancePenaltySummary {
  const policy = getAttendancePenaltyPolicy(penaltyPolicy);
  const empAttendances = (attendances || []).filter((a) => a.employeeId === employee.id);
  const deduped = deduplicateDailyAttendances(empAttendances, [employee], shifts, policy);

  let presentDaysCount = 0;
  let onTimeDaysCount = 0;
  let lateFrequency = 0;
  let totalLateMinutes = 0;
  let alphaDaysCount = 0;
  let sickOrLeaveDaysCount = 0;

  for (const rec of deduped) {
    if (rec.status === 'Alpa') {
      alphaDaysCount += 1;
    } else if (rec.status === 'Sakit' || rec.status === 'Izin' || rec.status === 'Cuti') {
      sickOrLeaveDaysCount += 1;
    } else if (rec.status === 'Terlambat' || rec.lateMinutes > 0) {
      presentDaysCount += 1;
      lateFrequency += 1;
      totalLateMinutes += Math.max(0, Math.round(rec.lateMinutes || 0));
    } else if (rec.status === 'Hadir Tepat Waktu') {
      presentDaysCount += 1;
      onTimeDaysCount += 1;
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
        const divisor = Math.max(1, policy.alphaWorkingDaysDivisor || 25);
        const dailyAllowance =
          mealAndTransport > 0 ? Math.round(mealAndTransport / divisor) : 50000;
        const cutPerIncident = Math.round(
          dailyAllowance * (policy.dailyAllowanceCutPercentage / 100)
        );
        latePenaltyAmount = Math.round(lateFrequency * cutPerIncident);
      }
    }

    // 2. Kalkulasi Potongan Alpha / Mangkir sesuai Skema Admin
    if (alphaDaysCount > 0) {
      if (policy.alphaPenaltyScheme === 'proportional_25') {
        const divisor = Math.max(1, policy.alphaWorkingDaysDivisor || 25);
        const perDayBase = Math.round((Number(employee.baseSalary) || 0) / divisor);
        alphaPenaltyAmount = Math.round(alphaDaysCount * perDayBase);
      } else {
        alphaPenaltyAmount = Math.round(alphaDaysCount * policy.fixedAlphaPenaltyAmount);
      }
    }
  }

  const totalDeductionAmount = latePenaltyAmount + alphaPenaltyAmount;

  let deductionNotes = 'Disiplin Penuh (0x Terlambat • 0 Alpha)';
  if (lateFrequency > 0 && alphaDaysCount > 0) {
    deductionNotes = `Potongan Terlambat ${lateFrequency}x / ${totalLateMinutes} mnt (-${formatRupiah(
      latePenaltyAmount
    )}) & Alpha ${alphaDaysCount}x (-${formatRupiah(alphaPenaltyAmount)})`;
  } else if (lateFrequency > 0) {
    deductionNotes = `Potongan Terlambat ${lateFrequency}x / ${totalLateMinutes} mnt: -${formatRupiah(
      latePenaltyAmount
    )}`;
  } else if (alphaDaysCount > 0) {
    deductionNotes = `Potongan Alpha / Mangkir ${alphaDaysCount}x: -${formatRupiah(
      alphaPenaltyAmount
    )}`;
  }

  return {
    employeeId: employee.id,
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
}

// Hitung Payroll Karyawan Lengkap sesuai Regulasi Indonesia (Lembur dihitung Per Menit & Potongan Terlambat/Absen Otomatis)
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
  const baseSalary = Number(employee.baseSalary) || 0;
  const allowances = employee.allowances || {
    position: 0,
    transport: 0,
    meal: 0,
    communication: 0,
  };
  const position = Number(allowances.position) || 0;
  const transport = Number(allowances.transport) || 0;
  const meal = Number(allowances.meal) || 0;
  const communication = Number(allowances.communication) || 0;

  // Hitungan Lembur Per Menit: ((Gaji Pokok + Tunjangan Jabatan) / 173 / 60) * 1.5 * Total Menit Lembur
  const overtimeRatePerMinute = getOvertimeRatePerMinute(employee, 1.5);
  const normalizedMinutes = Math.max(0, Math.round(overtimeMinutes));
  const overtimePay = Math.round(normalizedMinutes * overtimeRatePerMinute);

  const totalGrossSalary =
    baseSalary + position + transport + meal + communication + overtimePay + bonus;

  // Denda Keterlambatan & Potongan Absen (Otomatis dari Rekap Presensi atau Parameter)
  const policy = getAttendancePenaltyPolicy(attendancePenaltyMeta?.penaltyPolicy);
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
  const resolvedAlphaDays = Math.max(0, Math.round(attendancePenaltyMeta?.alphaDaysCount || 0));

  let latePenaltyAmount = 0;
  let alphaPenaltyAmount = 0;
  let lateDeduction = 0;

  if (attendancePenaltyMeta?.customLateDeduction !== undefined) {
    lateDeduction = Math.max(0, Math.round(attendancePenaltyMeta.customLateDeduction));
    latePenaltyAmount =
      attendancePenaltyMeta.latePenaltyAmount !== undefined
        ? attendancePenaltyMeta.latePenaltyAmount
        : lateDeduction;
    alphaPenaltyAmount = attendancePenaltyMeta.alphaPenaltyAmount || 0;
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
      if (policy.alphaPenaltyScheme === 'proportional_25') {
        const divisor = Math.max(1, policy.alphaWorkingDaysDivisor || 25);
        alphaPenaltyAmount = Math.round(resolvedAlphaDays * (baseSalary / divisor));
      } else {
        alphaPenaltyAmount = Math.round(resolvedAlphaDays * policy.fixedAlphaPenaltyAmount);
      }
    }

    lateDeduction = latePenaltyAmount + alphaPenaltyAmount;
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
    alphaPenaltyAmount = 0;
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
      attendanceDeductionNotes = `Potongan Terlambat ${resolvedLateFreq}x / ${resolvedTotalLateMins} mnt (-${formatRupiah(
        latePenaltyAmount
      )}) & Alpha ${resolvedAlphaDays}x (-${formatRupiah(alphaPenaltyAmount)})`;
    } else if (resolvedLateFreq > 0 && lateDeduction > 0) {
      attendanceDeductionNotes = `Potongan Terlambat ${resolvedLateFreq}x / ${resolvedTotalLateMins} mnt: -${formatRupiah(
        lateDeduction
      )}`;
    } else if (resolvedAlphaDays > 0 && lateDeduction > 0) {
      attendanceDeductionNotes = `Potongan Alpha / Mangkir ${resolvedAlphaDays}x: -${formatRupiah(
        alphaPenaltyAmount
      )}`;
    }
  }

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
  const bpjsJkmEmployer = Math.round(bpjsJhtBase * 0.003); // 0.3%

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
    overtimeMinutes: normalizedMinutes,
    overtimeRatePerMinute,
    bonus,
    totalGrossSalary,
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
    otherDeductions: 0,
    cashAdvanceDeduction: cashAdvanceDeduction || 0,
    cashAdvanceNotes,
    totalDeductions,
    takeHomePay,
    paymentStatus: 'Lunas',
    paymentDate: new Date().toISOString().split('T')[0],
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endObj = new Date(endDate);
  endObj.setHours(0, 0, 0, 0);
  const startObj = startDate ? new Date(startDate) : new Date(today);
  startObj.setHours(0, 0, 0, 0);

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

// Format Berita Transfer Bank singkat seperti "Gaji Okt 2026 PT TGI"
export function formatBankTransferRemark(period: string, companyShortName: string = 'PT TGI'): string {
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

  const parts = (period || 'Oktober 2026').trim().split(/\s+/);
  const firstWord = (parts[0] || '').toLowerCase();
  const shortMonth = monthShortMap[firstWord] || parts[0] || 'Okt';
  const yearPart = parts.slice(1).join(' ') || '2026';

  return `Gaji ${shortMonth} ${yearPart} ${companyShortName}`.trim();
}

export const AVAILABLE_PAYROLL_PERIODS: string[] = [
  'Agustus 2026',
  'September 2026',
  'Oktober 2026',
  'November 2026',
  'Desember 2026',
  'Januari 2027',
];



