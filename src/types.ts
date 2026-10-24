export type Department = 
  | 'Teknologi & IT'
  | 'Keuangan & Akuntansi'
  | 'Operasional'
  | 'Human Resources & GA'
  | 'Pemasaran & Bisnis'
  | 'Layanan Pelanggan';

export type EmploymentStatus = 'PKWTT (Tetap)' | 'PKWT (Kontrak)' | 'Probation' | 'Internship';

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
  joinDate: string;
  baseSalary: number; // Gaji Pokok
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

export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string; // e.g. "Oktober 2026"
  createdAt: string;
  baseSalary: number;
  allowancePosition: number;
  allowanceTransport: number;
  allowanceMeal: number;
  allowanceCommunication: number;
  overtimePay: number;
  overtimeMinutes?: number; // Total durasi lembur dalam menit
  overtimeRatePerMinute?: number; // Tarif lembur per menit
  bonus: number;
  totalGrossSalary: number;
  
  // Deductions (Potongan)
  lateDeduction: number;
  bpjsKesehatanEmployee: number; // 1%
  bpjsKesehatanEmployer: number; // 4%
  bpjsJhtEmployee: number; // 2%
  bpjsJhtEmployer: number; // 3.7%
  bpjsJpEmployee: number; // 1%
  bpjsJpEmployer: number; // 2%
  bpjsJkkEmployer: number; // 0.24% - 1.74%
  bpjsJkmEmployer: number; // 0.3%
  pph21TER: number; // Pajak Penghasilan TER
  otherDeductions: number;
  cashAdvanceDeduction?: number; // Potongan cicilan kasbon bulan berjalan
  cashAdvanceNotes?: string; // e.g. "Angsuran ke-1 dari 3 (Sisa Rp 2.000.000)"

  totalDeductions: number;
  takeHomePay: number; // Gaji Bersih
  paymentStatus: 'Lunas' | 'Menunggu Transfer' | 'Draft';
  paymentDate?: string;
  referenceNumber: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Hadir Tepat Waktu' | 'Terlambat' | 'Izin' | 'Sakit' | 'Cuti' | 'Alpa';
  workHours: number;
  lateMinutes: number;
  notes?: string;
  faceScanVerified?: boolean;
  faceConfidence?: number; // e.g. 98.6
  facePhotoSnapshot?: string; // Captured snapshot during scan (Check-In)
  checkOutPhotoSnapshot?: string; // Captured snapshot during scan (Check-Out)
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
  isInOfficeRadius?: boolean;
  distanceMeters?: number;
  shiftId?: string;
  shiftName?: string;
  scheduledCheckIn?: string; // Jam masuk sesuai jadwal shift (contoh: '09:00')
  scheduledCheckOut?: string; // Jam pulang sesuai jadwal shift (contoh: '17:30')
  earlyLeaveMinutes?: number; // Pulang lebih cepat dalam menit
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
  installments: CashAdvanceInstallment[];
}


