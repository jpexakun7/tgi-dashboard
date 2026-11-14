export type Department = string;

export type EmploymentStatus = 'PKWTT (Tetap)' | 'PKWT (Kontrak)' | 'Part-Time' | 'Probation' | 'Internship';

export type EmploymentType = 'Full-Time' | 'Contract' | 'Part-Time';

export type PTKPStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3';

export interface Employee {
  id: string;
  nik: string; // Nomor Induk Karyawan
  fullName: string;
  email: string;
  googleEmail?: string; // Akun Google yang terhubung
  phone: string;
  avatarUrl: string;
  facePhotoUrl?: string; // Foto referensi wajah untuk verifikasi face recognition
  ktpPhotoUrl?: string; // Foto / Scan KTP Karyawan dari Portal Karyawan / Admin
  ktpNumber?: string; // Nomor NIK KTP (16 Digit)
  ktpUploadedAt?: string; // Timestamp unggah KTP terakhir
  profilePhotoUpdatedAt?: string; // Timestamp update Foto Profil terakhir
  contractStartDate?: string; // Tanggal Mulai Kontrak Kerja (PKWT / PKWTT)
  contractEndDate?: string; // Tanggal Berakhir Kontrak Kerja (PKWT / Probation)
  contractDocumentNumber?: string; // Nomor Dokumen Surat Perjanjian Kerja
  contractDocumentUrl?: string; // File / Foto Dokumen Kontrak Kerja (Base64 JPEG / PDF Data URL)
  contractDocumentName?: string; // Nama File Dokumen Kontrak Kerja
  contractUpdatedAt?: string; // Waktu terakhir dokumen/masa kontrak diperbarui
  role: string;
  department: Department;
  employmentStatus: EmploymentStatus;
  status?: string; // Alias status kontrak / kepegawaian
  employmentType?: EmploymentType; // Tipe Karyawan: Full-Time | Contract | Part-Time
  employment_type?: EmploymentType; // Alias kolom Supabase employment_type
  joinDate: string;
  baseSalary: number; // Gaji Pokok Bulanan (Acuan / Total)
  hourlyRate?: number; // Tarif Gaji Per Jam (hourly_rate)
  hourly_rate?: number; // Alias kolom Supabase hourly_rate
  overtimeRate?: number; // Tarif Lembur Per Jam Part-Time (overtime_rate)
  overtime_rate?: number; // Alias kolom Supabase overtime_rate
  standard_daily_hours?: number; // Standar Jam Kerja Harian per karyawan (default: 9 jam/hari, bisa diisi 6 jam/hari atau angka manual)
  standardDailyHours?: number; // Alias camelCase untuk standard_daily_hours
  dailySalary?: number; // Gaji Per Hari (daily_salary = standard_daily_hours × hourly_rate)
  daily_salary?: number; // Alias kolom Supabase daily_salary
  allowances: {
    position: number; // Tunjangan Jabatan
    transport: number; // Tunjangan Transport
    meal: number; // Tunjangan Makan
    communication: number; // Tunjangan Komunikasi
  };
  bankName: 'BCA' | 'Mandiri' | 'BRI' | 'BNI';
  bankAccountNumber: string;
  bankAccountHolder: string;
  npwp: string;
  ptkpStatus: PTKPStatus;
  bpjsKesehatanNo: string;
  bpjsKetenagakerjaanNo: string;
  remainingLeaveDays: number; // Sisa cuti
  isActive: boolean;
  approvalStatus: 'approved' | 'pending' | 'rejected'; // Status ACC Admin
  approvalNotes?: string;
  approvalDate?: string;
  registrationDate?: string;
  address?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  birthDate?: string;
  birthPlace?: string;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  accessPin?: string; // PIN / Password khusus untuk login Portal Karyawan per akun
  shiftId?: string; // ID jadwal shift kerja yang diikuti karyawan (contoh: 'shift-pagi-reguler')
  isLiveStreamHost?: boolean; // Penanda apakah karyawan adalah Host Live Streaming (TikTok Shop / Shopee Live)
  is_host?: boolean; // Alias flag Host Live Stream (is_host)
  salesCommissionPercentage?: number; // Persentase Komisi Penjualan Live Streaming (contoh: 2.5 untuk 2.5% dari omset)
  host_commission_pct?: number; // Alias kolom SQL host_commission_pct DECIMAL(5,2)
  salesCommissionPerPcs?: number; // Nominal Komisi Penjualan Host per Pcs Tas terjual (contoh: Rp 2.000 / pcs)
  host_commission_per_pcs?: number; // Alias kolom SQL host_commission_per_pcs DECIMAL(10,2)
  isCoHostLiveStream?: boolean; // Penanda apakah karyawan adalah Co-Host Live Streaming
  is_co_host?: boolean; // Alias flag Co-Host Live Stream (is_co_host)
  coHostCommissionPercentage?: number; // Persentase Komisi Co-Host Live Streaming (%) dari omset sesi live yang diikuti
  co_host_commission_pct?: number; // Alias kolom SQL co_host_commission_pct DECIMAL(5,2)
  coHostCommissionPerPcs?: number; // Nominal Komisi Co-Host per Pcs Tas terjual (contoh: Rp 1.000 / pcs)
  co_host_commission_per_pcs?: number; // Alias kolom SQL co_host_commission_per_pcs DECIMAL(10,2)
  liveStreamSalesLogs?: LiveStreamSalesRecord[]; // Riwayat pencatatan omset live streaming yang tersinkronisasi
}

export type LiveStreamPlatform =
  | 'TikTok Shop Live'
  | 'Shopee Live'
  | 'Tokopedia Play'
  | 'Instagram / FB Live'
  | 'Semua Platform'
  | 'Lainnya';

export interface LiveStreamSalesRecord {
  id: string;
  employeeId: string;
  employee_id?: string;
  employeeName?: string;
  employee_name?: string;
  employeeNik?: string;
  date: string; // YYYY-MM-DD
  session_date?: string; // Alias kolom SQL session_date DATE
  period: string; // Contoh: "Oktober 2026"
  platform: LiveStreamPlatform;
  sessionRole?: 'Host' | 'Co-Host'; // Peran pada sesi live: Host Utama atau Co-Host Pendamping
  role_type?: 'host' | 'co_host'; // Alias kolom SQL role_type ('host' | 'co_host')
  hostCompanionName?: string; // Opsional: Nama Host Utama yang didampingi saat bertugas sebagai Co-Host
  sessionTitle: string; // Contoh: "Sesi Live Pagi - Promo Tas Selempang Import"
  durationHours: number; // Durasi live dalam jam
  omsetAmount: number; // Total Omset / GMV Penjualan Live (IDR)
  omset?: number; // Alias kolom SQL omset DECIMAL(15,2)
  pcsSold: number; // Jumlah Pcs Produk Terjual
  pcs_sold?: number; // Alias kolom SQL pcs_sold INTEGER
  commissionPercentageSnapshot: number; // % komisi saat sesi direkam
  commission_pct_used?: number; // Alias kolom SQL commission_pct_used DECIMAL(5,2)
  commissionPerPcsSnapshot: number; // Rp/pcs komisi saat sesi direkam
  commission_per_pcs_used?: number; // Alias kolom SQL commission_per_pcs_used DECIMAL(10,2)
  calculatedCommission: number; // Total komisi otomatis sesi ini (IDR)
  total_commission?: number; // Alias kolom SQL total_commission DECIMAL(12,2)
  notes?: string;
  status: 'Terverifikasi' | 'Menunggu Verifikasi' | 'Ditolak';
  createdAt: string;
  created_at?: string;
}

export interface WorkShift {
  id: string;
  code: string; // e.g. 'SHF-01', 'SHF-02'
  name: string; // e.g. 'Shift Reguler Pagi (Kantor Pusat)'
  checkInTime: string; // Jam masuk kerja manual (HH:mm), contoh '09:00'
  checkOutTime: string; // Jam pulang kerja manual (HH:mm), contoh '17:30'
  gracePeriodMinutes: number; // Toleransi keterlambatan dalam menit (misal: 5, 10, 15 menit)
  breakDurationMinutes: number; // Durasi istirahat dalam menit (misal: 60 menit)
  workDays: string[]; // Hari kerja aktif, misal ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
  colorTheme: 'emerald' | 'indigo' | 'amber' | 'purple' | 'rose' | 'teal';
  location?: string;
  isDefault?: boolean;
  isActive: boolean;
  description?: string;
}

export interface DecemberPPh21ReconciliationResult {
  annualGrossIncome: number; // Bruto setahun (termasuk premi BPJS Kes + JKK + JKM pemberi kerja)
  biayaJabatanAnnual: number; // 5% x Bruto setahun, maks Rp 6.000.000 / tahun
  bpjsEmployeeAnnualDeduction: number; // Iuran JHT (2%) + JP (1%) yang dibayar karyawan setahun
  netIncomeAnnual: number; // Penghasilan Neto Setahun
  ptkpAnnual: number; // PTKP Setahun sesuai status (TK/0 = 54jt, dst)
  pkpAnnual: number; // Penghasilan Kena Pajak (PKP) dibulatkan ke bawah ribuan penuh
  annualPph21Pasal17: number; // Total PPh 21 Terutang Setahun (Tarif Progresif Pasal 17)
  terAlreadyPaidJanToNov: number; // Akumulasi PPh 21 TER yang telah dipotong Masa Jan - Nov
  decemberPph21Payable: number; // PPh 21 Masa Desember (Kurang / Lebih Bayar)
}

export interface DailyWorkWageItem {
  date: string;
  checkIn: string;
  checkOut: string;
  workHours: number; // Jam kerja normal aktual setelah dibatasi maksimal 9 jam/hari (0 jika belum Clock-Out)
  rawDurationHours?: number; // Durasi mentah (clockOut - clockIn) sebelum dibatasi maksimal 9 jam
  isCappedToMax?: boolean; // true apabila durasi aktual > batas maksimal jam kerja harian (9 jam)
  isMissingClockOut?: boolean; // true apabila belum Clock-Out atau Jam Masuk === Jam Pulang
  dailyWage: number;
  status: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string; // e.g. "Oktober 2026"
  createdAt: string;
  baseSalary: number; // Total Gaji Pokok Bulanan = Akumulasi Jam Kerja Riil × Tarif Gaji Per Jam
  hourlyRate?: number; // Tarif Gaji Per Jam (hourly_rate)
  totalActualWorkHours?: number; // Akumulasi jam kerja riil seluruh hari masuk
  standardWorkHoursPerDay?: number; // Standar jam kerja per hari (9 jam)
  dailyWorkBreakdown?: DailyWorkWageItem[]; // Rincian gaji harian = Jam Kerja Aktual Hari Tersebut × Tarif Per Jam
  dailySalary?: number; // Tarif Gaji Per Hari (9 jam × hourly_rate)
  presentDaysCount?: number; // Jumlah Hari Hadir Aktual pada periode ini
  standardWorkingDays?: number; // Standar hari kerja (misal: 25 hari)
  allowancePosition: number;
  allowanceTransport: number;
  allowanceMeal: number;
  allowanceCommunication: number;
  overtimePay: number;
  overtimeMinutes?: number; // Total durasi lembur dalam menit
  overtimeRatePerMinute?: number; // Tarif lembur dasar per menit (1x)
  overtimeFirstHourMinutes?: number; // Menit lembur jam pertama (1.5x sesuai UU Ketenagakerjaan)
  overtimeSubsequentMinutes?: number; // Menit lembur jam ke-2 dst (2.0x sesuai UU Ketenagakerjaan)
  overtimeFirstHourPay?: number; // Nominal upah lembur jam pertama (1.5x)
  overtimeSubsequentPay?: number; // Nominal upah lembur jam ke-2 dst (2.0x)
  bonus: number;
  salesCommission?: number; // Insentif / Komisi Penjualan Host & Co-Host Live Streaming (otomatis dari omset/% atau pcs)
  totalLiveSalesOmset?: number; // Total akumulasi omset penjualan live streaming bulan ini
  totalLiveSalesPcs?: number; // Total akumulasi pcs terjual bulan ini
  liveSalesSessionsCount?: number; // Jumlah sesi live streaming bulan ini
  salesCommissionPercentage?: number; // Persentase komisi penjualan Host (%)
  coHostCommissionPercentage?: number; // Persentase komisi penjualan Co-Host (%)
  coHostCommissionPerPcs?: number; // Tarif komisi Co-Host per Pcs Tas Terjual (IDR)
  coHostCommissionAmount?: number; // Nominal komisi dari sesi Co-Host Live Streaming
  salesCommissionPerPcs?: number; // Tarif komisi Host per Pcs Tas Terjual (IDR)
  salesCommissionNotes?: string; // Ringkasan perhitungan komisi penjualan pada slip gaji
  totalGrossSalary: number;
  employerBpjsTaxableAllowance?: number; // Komponen Premi BPJS Kes (4%) + JKK (0.24%) + JKM (0.3%) penambah DPP PPh 21
  taxableGrossSalary?: number; // Penghasilan Bruto Pajak (DPP PPh 21 TER = totalGrossSalary + employerBpjsTaxableAllowance)
  
  // Deductions (Potongan)
  lateDeduction: number; // Total gabungan denda keterlambatan + potongan alpha/absen
  originalLateDeduction?: number; // Nominal denda asli sebelum diberi dispensasi
  isLateFeeWaived?: boolean; // Status dispensasi / pembebasan denda keterlambatan per karyawan
  waiverReason?: string; // Catatan alasan dispensasi (misal: Tugas Luar / Dispensasi HR)
  lateFrequency?: number; // Jumlah hari/kejadian terlambat (contoh: 4x)
  totalLateMinutes?: number; // Total akumulasi menit terlambat (contoh: 210 mnt)
  latePenaltyAmount?: number; // Nominal denda keterlambatan saja
  alphaDaysCount?: number; // Jumlah hari Alpha / Mangkir tanpa keterangan
  alphaPenaltyAmount?: number; // Nominal potongan Alpha / Mangkir saja
  attendanceDeductionNotes?: string; // Contoh: "Potongan Terlambat 4x / 210 mnt: -Rp 100.000"
  bpjsKesehatanEmployee: number; // 1%
  bpjsKesehatanEmployer: number; // 4%
  bpjsJhtEmployee: number; // 2%
  bpjsJhtEmployer: number; // 3.7%
  bpjsJpEmployee: number; // 1%
  bpjsJpEmployer: number; // 2%
  bpjsJkkEmployer: number; // 0.24% - 1.74%
  bpjsJkmEmployer: number; // 0.3%
  pph21TER: number; // Pajak Penghasilan TER (atau PPh 21 Rekonsiliasi Pasal 17 pada masa Desember)
  isDecemberReconciliation?: boolean; // Menandakan masa pajak terakhir (Desember) dengan rekonsiliasi Pasal 17
  annualPph21Summary?: DecemberPPh21ReconciliationResult;
  otherDeductions: number;
  tunjanganKerajinan?: number;
  tunjanganKedisiplinan?: number;
  kesalahanCount?: number;
  kesalahanRate?: number;
  catatanKesalahan?: string;
  tanpaKeteranganHari?: number;
  tanpaKeteranganRate?: number;
  izinJamMenit?: number;
  izinJamRate?: number;
  izinHariJumlah?: number;
  izinHariRate?: number;
  sakitHariJumlah?: number;
  sakitHariRate?: number;
  sisaKasbonLalu?: number;
  cicilanKasbonBulanIni?: number;
  sisaKasbonDepan?: number;
  bpjs_tk_manual?: number;
  bpjs_kesehatan_manual?: number;
  pph21_manual?: number;
  catatanPotongan?: string;
  cashAdvanceDeduction?: number; // Potongan cicilan kasbon bulan berjalan
  cashAdvanceNotes?: string; // e.g. "Angsuran ke-1 dari 3 (Sisa Rp 2.000.000)"
  thrAmount?: number; // Nominal THR (hanya dihitung jika show_in_payslip = true)
  thrBasisAmount?: number; // Dasar perhitungan upah THR
  thrShowInPayslip?: boolean; // Wajib true dari ceklis Admin agar tampil & dihitung di Slip Gaji
  thrHolidayName?: string; // Nama Hari Raya (misal: Hari Raya Idul Fitri 2026)
  thrTenureLabel?: string; // Masa kerja otomatis (misal: 1 Tahun 4 Bulan)
  thrProportionFormula?: string; // Rumus proporsional (misal: 100% (12/12 Bulan))
  thrPaymentStatus?: 'Belum Cair' | 'Sudah Dibayar';

  totalDeductions: number;
  takeHomePay: number; // Gaji Bersih
  paymentStatus: 'Lunas' | 'Menunggu Transfer' | 'Draft';
  paymentDate?: string;
  referenceNumber: string;
  isLocked?: boolean; // Apakah perhitungan THP periode ini sudah dikunci / difinalisasi
  lockedAt?: string; // Waktu finalisasi kunci payroll
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Hadir Tepat Waktu' | 'Terlambat' | 'Izin' | 'Sakit' | 'Cuti' | 'Alpa';
  workHours: number;
  overtimeHours?: number; // Approved overtime hours above target daily hours (0 unless approved by Admin)
  lateMinutes: number;
  notes?: string;
  faceScanVerified?: boolean;
  faceConfidence?: number; // e.g. 98.6
  facePhotoSnapshot?: string; // Captured snapshot during scan (Check-In)
  photoIn?: string; // Alias for Check-In face selfie proof
  checkOutPhotoSnapshot?: string; // Captured snapshot during scan (Check-Out)
  photoOut?: string; // Alias for Check-Out face selfie proof
  facePhotoOut?: string; // Alias for Check-Out face selfie proof
  checkInFullTimestamp?: string; // Real-time full date & time string on Check-In
  checkOutFullTimestamp?: string; // Real-time full date & time string on Check-Out
  locationCoords?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  locationAddress?: string;
  checkOutLocationCoords?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  checkOutLocationAddress?: string;
  checkOutDistanceMeters?: number;
  isInOfficeRadius?: boolean;
  distanceMeters?: number;
  shiftId?: string;
  shiftName?: string;
  scheduledCheckIn?: string; // Jam masuk sesuai jadwal shift (contoh: '09:00')
  scheduledCheckOut?: string; // Jam pulang sesuai jadwal shift (contoh: '17:30')
  earlyLeaveMinutes?: number; // Pulang lebih cepat dalam menit
  isManualStatus?: boolean; // Status diatur manual oleh Admin HR
  updated_at?: string;
}

export interface GoogleUserAccount {
  email: string;
  name: string;
  picture: string;
  sub?: string;
}

export type GoogleAdminRole =
  | 'Super Admin'
  | 'HR & Payroll Admin'
  | 'Finance & Reimbursement'
  | 'Operations Manager'
  | 'Viewer / Auditor';

export interface GoogleAdminAccount {
  id: string;
  email: string;
  name: string;
  role: GoogleAdminRole;
  avatarUrl: string;
  addedAt: string;
  status: 'active' | 'suspended';
  phone?: string;
  notes?: string;
  department?: string;
  accessPin?: string; // PIN / Password khusus per akun Admin HR / Finance
}

export interface GoogleAdminUser {
  id?: string;
  email: string;
  name: string;
  picture: string;
  role: GoogleAdminRole | 'admin' | 'unauthorized';
  sub?: string;
  lastLogin: string;
  phone?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'Cuti Tahunan' | 'Cuti Melahirkan' | 'Cuti Sakit' | 'Cuti Khusus (Menikah/Duka)' | 'Izin Pribadi';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak';
  appliedAt: string;
  approvedBy?: string;
  attachmentUrl?: string; // Foto / Gambar Bukti Pendukung Cuti & Izin (Surat Dokter, Bukti Izin, dll)
  attachmentName?: string; // Nama file gambar bukti
  attachmentUploadedAt?: string; // Timestamp unggah bukti
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  minutes?: number; // Total durasi lembur dalam menit (hitungan per menit)
  startTime?: string; // Jam mulai lembur (contoh: '17:30')
  endTime?: string; // Jam selesai lembur (contoh: '19:45')
  ratePerMinute?: number; // Tarif lembur per menit (IDR/menit)
  taskDescription: string;
  calculatedPay: number;
  status: 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak';
}

export type DashboardModule =
  | 'overview'
  | 'employees'
  | 'payroll'
  | 'part_time_payroll'
  | 'thr_management'
  | 'payroll_adjustments'
  | 'payroll_deductions'
  | 'bonus_management'
  | 'attendance'
  | 'work_shifts'
  | 'leave'
  | 'overtime'
  | 'reimbursement'
  | 'cash_advance'
  | 'assets'
  | 'performance_review'
  | 'tax_bpjs'
  | 'kpi_performance'
  | 'reports'
  | 'audit_logs'
  | 'roles_management'
  | 'settings';

export type AssetCategory =
  | 'Elektronik & Laptop'
  | 'Peralatan Gudang & Barcode'
  | 'Perangkat Kasir & POS'
  | 'Printer & Scanner Resi'
  | 'Kendaraan Operasional'
  | 'Fasilitas & Kantor'
  | 'Seragam & Perlengkapan Kerja';

export type AssetCondition = 'Baik' | 'Perlu Perbaikan' | 'Rusak';

export type AssetStatus = 'Tersedia' | 'Dipinjamkan' | 'Dalam Perbaikan' | 'Dihapuskan / Rusak Berat';

export interface AssetHistoryLog {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  action:
    | 'Pengadaan Baru'
    | 'Penyerahan / Pinjam'
    | 'Pengembalian'
    | 'Mulai Perbaikan'
    | 'Selesai Perbaikan'
    | 'Penggantian / Rusak'
    | 'Penghapusan Aset';
  employeeId?: string;
  employeeNik?: string;
  employeeName?: string;
  employeeDepartment?: string;
  date: string;
  condition: AssetCondition;
  notes?: string;
  adminName: string;
}

export interface CompanyAsset {
  id: string;
  assetCode: string; // e.g. TGI-AST-001
  serialNumber?: string;
  name: string; // e.g. MacBook Pro M3 / Barcode Scanner Zebra
  category: AssetCategory;
  condition: AssetCondition;
  purchaseDate: string;
  purchaseCost: number;
  status: AssetStatus;
  warrantyExpiry?: string;
  location?: string;
  assignedToEmployeeId?: string | null;
  assignedToEmployeeName?: string | null;
  assignedToEmployeeNik?: string | null;
  assignedDate?: string | null;
  handoverConditionNotes?: string | null;
  photoUrl?: string;
  specifications?: string;
}

export type ActivityActionType =
  | 'SALARY_UPDATE'
  | 'PAYROLL_RUN'
  | 'EMPLOYEE_DELETE'
  | 'EMPLOYEE_CREATE'
  | 'EMPLOYEE_UPDATE'
  | 'ROLE_PERMISSION_UPDATE'
  | 'ADMIN_CREATE'
  | 'ADMIN_UPDATE'
  | 'ADMIN_DELETE'
  | 'LEAVE_STATUS_UPDATE'
  | 'OVERTIME_STATUS_UPDATE'
  | 'REIMBURSEMENT_STATUS_UPDATE'
  | 'ASSET_CREATE'
  | 'ASSET_UPDATE'
  | 'ASSET_ASSIGN'
  | 'ASSET_RETURN'
  | 'ASSET_DELETE'
  | 'COMPANY_SETTINGS_UPDATE'
  | 'PERFORMANCE_REVIEW_CREATE'
  | 'PERFORMANCE_REVIEW_UPDATE'
  | 'PERFORMANCE_REVIEW_DELETE'
  | 'PERFORMANCE_BONUS_APPLY'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_READ'
  | 'CASH_ADVANCE_CREATE'
  | 'CASH_ADVANCE_APPROVE'
  | 'CASH_ADVANCE_DISBURSE'
  | 'CASH_ADVANCE_DEDUCT'
  | 'CASH_ADVANCE_REJECT'
  | 'ROLE_UPDATED'
  | 'SETTINGS_MODIFIED'
  | 'USER_ACCESS_CHANGED'
  | 'LOGIN_ACTIVITY'
  | 'MANUAL_AUDIT_NOTE'
  | 'SHIFT_SCHEDULE_UPDATE'
  | 'EMPLOYEE_SHIFT_ASSIGN';

export type ActivitySeverity = 'info' | 'warning' | 'danger' | 'success';

export type ActivityCategory =
  | 'Gaji & Payroll'
  | 'Data Karyawan'
  | 'Hak Akses & Admin'
  | 'Persetujuan & Klaim'
  | 'Inventaris & Aset'
  | 'Penilaian & KPI'
  | 'Kasbon & Keuangan'
  | 'Notifikasi Sistem'
  | 'Pengaturan Sistem'
  | 'Autentikasi';

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  formattedTime?: string;
  adminEmail: string;
  adminName: string;
  adminRole: GoogleAdminRole | string;
  actionType: ActivityActionType;
  actionCategory: ActivityCategory;
  description: string;
  targetId?: string;
  targetName?: string;
  oldValue?: string;
  newValue?: string;
  severity: ActivitySeverity;
  ipAddress?: string;
  device?: string;
  notes?: string;
}

export interface RolePermissionConfig {
  role: GoogleAdminRole;
  isAllowedToLogin: boolean;
  allowedModules: DashboardModule[];
  canApproveLeave: boolean;
  canApproveOvertime: boolean;
  canApproveReimbursement: boolean;
  canEditEmployees: boolean;
  canRunPayroll: boolean;
  canEditCompanySettings: boolean;
  description: string;
}

export interface GoogleAuthSettings {
  googleClientId?: string;
  enableRealGoogleSignIn: boolean;
  allowedDomains: string[];
  allowedRolesForLogin: GoogleAdminRole[];
  defaultNewUserRole: GoogleAdminRole | 'blocked';
  autoWhitelistNewUsers: boolean;
}

export type LatePenaltyScheme = 'flat_per_incident' | 'per_minute' | 'daily_allowance_cut';
export type AlphaPenaltyScheme = 'proportional_25' | 'fixed_amount';

export interface AttendancePenaltyPolicy {
  enabled: boolean;
  gracePeriodMinutes: number; // Default: 15 menit
  useShiftGracePeriod: boolean; // Jika false, gunakan gracePeriodMinutes global (default 15 mnt)
  latePenaltyScheme: LatePenaltyScheme; // 'flat_per_incident' | 'per_minute' | 'daily_allowance_cut'
  flatLatePenaltyAmount: number; // Default: Rp 25.000 / kejadian terlambat
  perMinutePenaltyAmount: number; // Default: Rp 1.000 / menit terlambat
  dailyAllowanceCutPercentage: number; // Default: 100% dari Tunjangan Makan & Transport harian
  alphaPenaltyScheme: AlphaPenaltyScheme; // 'proportional_25' (1/25 x Gaji Pokok) | 'fixed_amount'
  alphaWorkingDaysDivisor: number; // Default: 25 hari kerja
  fixedAlphaPenaltyAmount: number; // Default: Rp 150.000 / hari Alpha
}

export interface SignatoryItemConfig {
  headerLabel: string; // e.g. "Disiapkan Oleh," / "Diperiksa & Diverifikasi," / "Disetujui Oleh,"
  topSubtitle: string; // e.g. "Staff HR & Payroll Admin" / "Finance & Accounting Lead" / "Direktur Utama"
  name: string; // Nama lengkap & gelar penandatangan (diisi manual oleh Admin)
  jobTitle: string; // e.g. "HR Department" / "Finance Department" / "Direktur Utama"
  signatureDataUrl?: string; // Base64 PNG/JPEG tanda tangan digital
  stampDataUrl?: string; // Base64 PNG/JPEG stempel pada kolom penandatangan ini
  showStamp?: boolean; // Tampilkan stempel pada kolom penandatangan ini
}

export interface PayrollSignatoriesConfig {
  city: string; // Default: "Jakarta"
  customDateText?: string; // Jika kosong, otomatis tanggal hari ini
  companyStampDataUrl?: string; // Gambar stempel perusahaan utama (Base64 PNG/JPEG)
  showAllThreeOnPayslip?: boolean; // Tampilkan ketiga penandatangan pada Slip Gaji
  preparedBy: SignatoryItemConfig;
  verifiedBy: SignatoryItemConfig;
  approvedBy: SignatoryItemConfig;
}

export interface CompanyConfig {
  companyName: string;
  brandName: string;
  address: string;
  phone: string;
  npwpCompany: string;
  currentPayrollPeriod: string;
  cutOffStartDay: number;
  cutOffEndDay: number;
  payrollDisbursementDay: number;
  bpjsKesehatanMaxCap: number; // Max cap IDR 12.000.000
  bpjsJpMaxCap: number; // Plafon iuran JP 2026 IDR 10.600.000
  disbursementBank: 'BCA Bisnis' | 'Mandiri Cash Management' | 'BNI Direct';
  disbursementAccount: string;
  adminGoogleEmail?: string;
  allowedGoogleAdmins?: GoogleAdminAccount[];
  googleAuthSettings?: GoogleAuthSettings;
  rolePermissions?: Record<GoogleAdminRole, RolePermissionConfig>;
  maxCashAdvancePercentage?: number;
  standardWorkHoursPerDay?: number;
  standardWorkDaysPerWeek?: number;
  defaultOvertimeMultiplier?: number;
  defaultOvertimeRatePerHour?: number;
  defaultOvertimeRatePerMinute?: number;
  workShifts?: WorkShift[];
  attendancePenaltyPolicy?: AttendancePenaltyPolicy;
  lockedPayrollPeriods?: string[]; // Daftar periode bulan payroll yang sudah dikunci / difinalisasi
  waivedLateEmployeeIds?: Record<string, string[]>; // Map periode -> array employeeId yang diberi dispensasi denda
  payrollSignatories?: PayrollSignatoriesConfig;
  securitySettings?: {
    adminPin?: string;
    requirePinForAdminMode?: boolean;
    webAccessPin?: string;
    requirePinForWebAccess?: boolean;
    defaultEmployeePin?: string;
  };
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export type SystemModuleKey =
  | 'employees'
  | 'payroll'
  | 'leave_overtime'
  | 'cash_advance'
  | 'kpi_performance'
  | 'audit_trail'
  | 'system_settings';

export interface GranularRolePermission {
  roleId: string;
  roleName: string;
  description: string;
  badgeColor: string;
  userCount: number;
  isCustom?: boolean;
  modulePermissions: Record<SystemModuleKey, ModulePermission>;
}

export interface UserAccountAccess {
  id: string;
  name: string;
  nik: string;
  email: string;
  roleId: string;
  roleName: string;
  additionalRoles?: string[];
  department: string;
  status: 'active' | 'inactive';
  avatarUrl?: string;
  lastLogin?: string;
  passwordLastChanged?: string;
}

export type KpiStatus = 'exceeded' | 'on_track' | 'needs_attention' | 'critical';

export type ReimbursementCategory =
  | 'Transport & Bensin'
  | 'Parkir & Tol'
  | 'Makan Lembur & Konsumsi'
  | 'Operasional Toko & Gudang'
  | 'Pengiriman & Ekspedisi'
  | 'Medis & Rawat Jalan'
  | 'Perlengkapan Kantor (ATK)'
  | 'Promosi & Iklan'
  | 'Komunikasi & Pulsa'
  | 'Lain-lain';

export type ReimbursementStatus = 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak' | 'Dibayarkan';

export interface ReimbursementClaim {
  id: string;
  claimNumber: string;
  employeeId: string;
  date: string;
  category: ReimbursementCategory;
  amount: number;
  description: string;
  receiptNumber?: string;
  receiptPhotoUrl?: string;
  receiptFileName?: string;
  receiptFileType?: 'image' | 'excel' | 'pdf' | 'document';
  status: ReimbursementStatus;
  appliedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  paymentMethod?: 'Transfer Bank' | 'Payroll Bersama Gaji' | 'Kas Kecil (Petty Cash)';
  disbursedAt?: string;
}

export interface KpiMetric {
  id: string;
  name: string;
  category: string;
  target: string;
  actual: string;
  achievementRate: number; // e.g. 104 (%)
  unit: string;
  status: KpiStatus;
  weight: number; // Bobot persentase
  notes?: string;
}

export interface DepartmentKpiData {
  department: Department;
  leadName: string;
  leadRole: string;
  leadAvatar: string;
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  status: KpiStatus;
  quarter: string; // e.g. "Q4 2026"
  metrics: KpiMetric[];
  trend: { quarter: string; score: number }[];
  keyStrengths: string[];
  areasOfImprovement: string[];
}

export type ReviewPeriodType = 'Bulanan' | 'Kuartalan';

export interface PerformanceRatingGrade {
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  label: string;
  minScore: number;
  bonusPercentageOfBase: number; // e.g. 20, 15, 10, 5, 0 (%)
  badgeColor: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  employeeDepartment: Department;
  employeeRole: string;
  periodType: ReviewPeriodType;
  period: string; // e.g. "Oktober 2026" or "Q4 2026"
  reviewDate: string;
  reviewerId?: string;
  reviewerName: string;
  reviewerRole: string;

  // 4 Aspek Penilaian Utama (Skala 1 - 100):
  kpiScore: number; // Kinerja Utama (KPI) - Bobot 40%
  disciplineScore: number; // Kedisiplinan & Presensi - Bobot 20%
  teamworkScore: number; // Kerjasama Tim & Komunikasi - Bobot 20%
  initiativeScore: number; // Inisiatif & Problem Solving - Bobot 20%

  // Kalkulasi Skor Akhir
  finalScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';

  // Catatan & Feedback Tertulis Atasan
  strengthsNotes: string; // Kelebihan & Prestasi
  improvementsNotes: string; // Area Peningkatan
  generalFeedback: string; // Ulasan & Arahan Keseluruhan

  // Integrasi Payroll & Bonus Insentif
  recommendedBonus: number; // Nilai bonus insentif (IDR)
  isBonusAppliedToPayroll?: boolean; // Apakah sudah disinkronkan ke payroll
  payrollPeriodApplied?: string; // Periode payroll saat diterapkan
}

export type NotificationRecipientType = 'admin' | 'employee' | 'all';

export type NotificationCategory =
  | 'PERFORMANCE_REVIEW'
  | 'PAYROLL_BONUS'
  | 'DEADLINE_REMINDER'
  | 'PERIOD_OPENED'
  | 'CASH_ADVANCE'
  | 'SYSTEM';

export type NotificationPriority = 'normal' | 'high' | 'urgent';

export interface AppNotification {
  id: string;
  recipientType: NotificationRecipientType;
  recipientEmployeeId?: string; // Target specific employee ID (e.g. 'emp-01')
  recipientName?: string; // Target employee name or 'Semua Atasan / HRD'
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  createdAt: string; // ISO string
  isRead: boolean;
  readAt?: string;
  actionUrl?: string; // Target route/tab e.g. 'performance_review', 'rapor_kinerja', 'payroll'
  actionLabel?: string; // e.g. 'Buka Rapor Kinerja', 'Cek Slip Gaji'
  relatedReviewId?: string;
  metadata?: {
    period?: string;
    department?: string;
    grade?: string;
    finalScore?: number;
    bonusAmount?: number;
    deadlineDate?: string;
    senderName?: string;
    cashAdvanceId?: string;
    cashAdvanceAmount?: number;
  };
}

// ==========================================
// KASBON & CICILAN POTONGAN GAJI (CASH ADVANCE)
// ==========================================
export type CashAdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'rejected' | 'paid';
export type CashAdvanceTenorMonths = 1 | 3 | 6 | 12;

export interface CashAdvanceInstallment {
  installmentNumber: number; // 1, 2, 3...
  totalInstallments: number; // e.g. 3
  period: string; // e.g. "Oktober 2026", "November 2026"
  amount: number; // Nominal potongan cicilan per bulan
  status: 'scheduled' | 'deducted' | 'waived';
  deductedAt?: string;
  payrollRecordId?: string;
}

export interface CashAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  department: string;
  position: string;
  baseSalary: number; // Gaji pokok saat pengajuan
  maxAllowedAmount: number; // Plafon maksimum kasbon (100% dari gaji pokok)
  amount: number; // Nominal pinjaman yang diajukan
  reason: string; // Alasan keperluan darurat
  tenorMonths: CashAdvanceTenorMonths; // 1, 3, 6, atau 12 Bulan
  monthlyInstallment: number; // Nominal cicilan bulanan
  totalPaid: number; // Total nominal yang sudah terpotong
  remainingBalance: number; // Sisa pokok kasbon yang belum lunas
  status: CashAdvanceStatus; // pending | approved | disbursed | rejected | paid
  createdAt: string; // Tanggal pengajuan
  approvedAt?: string;
  approvedBy?: string;
  disbursedAt?: string;
  disbursedBy?: string;
  disbursementMethod?: 'Bank Transfer' | 'Tunai / Petty Cash';
  disbursementReference?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  notes?: string;
  installments: CashAdvanceInstallment[];
}

// ==========================================
// PART-TIME WEEKLY PAYROLL & SUNDAY PAYOUT
// ==========================================
export type PartTimeLogStatus = 'Unpaid' | 'Paid';

export interface PartTimeWorkLog {
  id: string;
  employeeId: string;
  employee_id?: string;
  employeeName: string;
  employee_name?: string;
  employeeNik?: string;
  department?: string;
  role?: string;
  date: string; // YYYY-MM-DD
  work_date?: string;
  clockIn?: string; // HH:mm (Jam Masuk Absensi Portal Part-Time)
  clock_in?: string;
  clockOut?: string; // HH:mm (Jam Keluar Absensi Portal Part-Time)
  clock_out?: string;
  normalHours?: number; // Jam Kerja Normal
  normal_hours?: number;
  overtimeHours?: number; // Jam Kerja Lembur
  overtime_hours?: number;
  hoursWorked: number; // Total Jam Kerja Harian (normalHours + overtimeHours)
  hours_worked?: number;
  hourlyRate?: number; // Tarif Normal per Jam (Rp)
  hourlyRateSnapshot?: number; // Tarif per Jam (Rp) saat dicatat
  hourly_rate?: number;
  overtimeRate?: number; // Tarif Lembur per Jam (Rp)
  overtime_rate?: number;
  dailyWage: number; // (normalHours × hourlyRate) + (overtimeHours × overtimeRate)
  daily_wage?: number;
  source?: 'portal' | 'admin' | 'attendance_sync';
  notes?: string;
  status: PartTimeLogStatus; // 'Unpaid' | 'Paid'
  paidAt?: string;
  paid_at?: string;
  payoutPeriod?: string;
  payout_period?: string;
  weeklyPayoutId?: string;
  weekly_payout_id?: string;
  createdAt?: string;
  created_at?: string;
}

export interface PartTimeWeeklyPayout {
  id: string;
  referenceNumber?: string; // Contoh: "PT-SUN-20261108-001"
  employeeId: string;
  employee_id?: string;
  employeeName: string;
  employee_name?: string;
  employeeNik?: string;
  department?: string;
  role?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  weekStartDate: string; // YYYY-MM-DD (Awal Siklus 6 Hari Kerja)
  week_start_date?: string;
  weekEndDate: string; // YYYY-MM-DD (Akhir Siklus 6 Hari Kerja)
  week_end_date?: string;
  sundayPayoutDate?: string; // YYYY-MM-DD (Minggu / Sunday Payout)
  sunday_payout_date?: string;
  payoutDate?: string; // YYYY-MM-DD (Minggu / Sunday Payout)
  totalDaysWorked: number;
  total_days_worked?: number;
  normalHoursWorked?: number;
  normal_hours_worked?: number;
  overtimeHoursWorked?: number;
  overtime_hours_worked?: number;
  totalHoursWorked: number;
  total_hours_worked?: number;
  hourlyRate: number;
  hourly_rate?: number;
  overtimeRate?: number;
  overtime_rate?: number;
  normalPay?: number;
  normal_pay?: number;
  overtimePay?: number;
  overtime_pay?: number;
  grossPay?: number; // (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
  gross_pay?: number;
  grossSalary?: number;
  netPayout?: number;
  status: 'Unpaid' | 'Paid';
  paidAt?: string;
  paid_at?: string;
  paidBy?: string;
  paymentMethod?: 'Transfer Bank' | 'Tunai / Kas Operasional';
  notes?: string;
  logIds: string[];
  createdAt?: string;
}

export interface EmployeeBonus {
  id: string;
  employee_id: string;
  employee_nik: string;
  employee_name: string;
  amount: number;
  reason_note: string; // Catatan pencapaian/pekerjaan
  period_month: string; // Format YYYY-MM
  date_awarded: string; // ISO date string
  is_read: boolean;
  department?: string;
  role?: string;
}

export interface EmployeeAdjustment {
  id: string;
  employee_id: string;
  employee_nik: string;
  employee_name: string;
  period_month: string; // Format YYYY-MM, default periode aktif
  tunjangan_kerajinan: number; // Nominal Rp, default 0
  tunjangan_kedisiplinan: number; // Nominal Rp, default 0
  kesalahan_count: number; // Jumlah kesalahan dalam bulan tersebut, default 0
  kesalahan_rate: number; // Tarif denda per kesalahan dalam Rp, misal default Rp 10.000
  catatan_kesalahan: string; // Opsional, keterangan detail kesalahan
  updated_at: string; // ISO date string
  department?: string;
  role?: string;
}

export interface PayrollDeductionRecord {
  id: string;
  employee_id: string;
  employee_nik: string;
  employee_name: string;
  period_month: string; // Format YYYY-MM, default periode aktif
  tanpa_keterangan_hari: number; // Jumlah hari alpa/tanpa keterangan, default 0
  tanpa_keterangan_rate: number; // Tarif potongan per hari, otomatis dari gaji harian namun bisa diedit manual
  izin_jam_menit: number; // Total menit izin jam, default 0
  izin_jam_rate: number; // Tarif potongan per menit, otomatis dari tarif per jam / 60 namun bisa diedit manual
  izin_hari_jumlah: number; // Jumlah hari izin tidak dibayar, default 0
  izin_hari_rate: number; // Tarif potongan per hari, otomatis dari gaji harian namun bisa diedit manual
  sisa_kasbon_lalu: number; // Input 1: Sisa Kasbon bulan lalu dalam Rp, default 0
  cicilan_kasbon_bulan_ini: number; // Input 2: Cicilan Kasbon bulan ini yang dipotong dari gaji dalam Rp, default 0
  sisa_kasbon_depan: number; // Otomatis dihitung: Math.max(0, sisa_kasbon_lalu - cicilan_kasbon_bulan_ini)
  bpjs_tk_manual: number; // Nominal Rp potongan BPJS Ketenagakerjaan (default 0)
  bpjs_kesehatan_manual: number; // Nominal Rp potongan BPJS Kesehatan (default 0)
  pph21_manual: number; // Nominal Rp potongan PPh 21 (default 0)
  catatan_potongan: string; // Opsional
  updated_at: string; // ISO date string
  department?: string;
  role?: string;
  employment_status?: string;
}

export type ThrEligibilityStatus =
  | 'Berhak Penuh (100%)'
  | 'Berhak Proporsional'
  | 'Belum Berhak THR';

export type ThrPaymentStatus = 'Belum Cair' | 'Sudah Dibayar';

export interface ThrPayoutRecord {
  id: string;
  employee_id: string;
  employee_nik: string;
  employee_name: string;
  department: string;
  role: string;
  employment_type: string; // 'PKWTT (Tetap)' | 'PKWT (Kontrak)' | 'Part-Time'
  join_date: string; // YYYY-MM-DD
  thr_year: number; // e.g. 2026
  holiday_name: string; // e.g. 'Hari Raya Idul Fitri' | 'Hari Raya Natal'
  holiday_date: string; // YYYY-MM-DD
  period_month: string; // Format YYYY-MM
  tenure_months: number; // Jumlah bulan masa kerja
  tenure_days: number; // Total hari masa kerja
  tenure_label: string; // e.g. "1 Tahun 6 Bulan" atau "5 Bulan (152 Hari)"
  eligibility_status: ThrEligibilityStatus;
  proportion_formula: string; // e.g. "100% × (Gaji Pokok + Tunj. Tetap)" atau "(5/12) × Upah Dasar"
  base_salary_component: number; // Gaji Pokok
  fixed_allowance_component: number; // Tunjangan Tetap (Jabatan)
  parttime_avg_monthly_wage: number; // Rata-rata pendapatan bulanan Part-Time
  calculation_basis_amount: number; // Dasar perhitungan upah THR
  calculated_thr_amount: number; // Nominal THR terhitung otomatis sesuai Permenaker No. 6/2016
  manual_adjustment_amount: number; // Penyesuaian / bonus tambahan manual (Rp, default 0)
  total_thr_amount: number; // Total THR akhir = Math.max(0, calculated_thr_amount + manual_adjustment_amount)
  show_in_payslip: boolean; // WAJIB default false; hanya muncul & dihitung di Slip Gaji jika dicentang Admin
  payment_status: ThrPaymentStatus; // 'Belum Cair' | 'Sudah Dibayar'
  paid_at?: string;
  paid_by?: string;
  payment_method?: 'Transfer Bank' | 'Bersama Gaji Bulanan' | 'Tunai / Kas Operasional';
  reference_number?: string;
  notes?: string;
  created_at?: string;
  updated_at: string;
}


