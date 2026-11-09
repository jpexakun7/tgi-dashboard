import { supabase } from '../lib/supabase';
import {
  Employee,
  CompanyAsset,
  PayrollRecord,
  AttendanceRecord,
  LeaveRequest,
  OvertimeRequest,
  ReimbursementClaim,
  LiveStreamSalesRecord,
  LiveStreamPlatform,
} from '../types';

export interface SupabaseSyncStatus {
  isConnected: boolean;
  isTablesCreated: boolean;
  statusText: string;
  lastSyncTime: Date | null;
  error?: string | null;
  tableDetails?: {
    employees: boolean;
    company_assets: boolean;
    payrolls: boolean;
    attendances: boolean;
    leave_requests: boolean;
    overtime_requests: boolean;
    reimbursements: boolean;
  };
}

export function getEmployeeEffectivePin(emp?: Partial<Employee> | null, fallbackDefault = ''): string {
  if (!emp) return fallbackDefault;
  if (emp.accessPin && emp.accessPin.trim().length > 0 && emp.accessPin !== '••••') {
    return emp.accessPin.trim();
  }
  return fallbackDefault;
}

export function employeeToDb(emp: Employee) {
  const effectivePin = getEmployeeEffectivePin(emp);
  const rawAllowances = emp.allowances || { position: 0, transport: 0, meal: 0, communication: 0 };
  const explicitHourly = Number(emp.hourlyRate ?? emp.hourly_rate) || 0;
  const explicitDaily = Number(emp.dailySalary ?? emp.daily_salary) || 0;
  const resolvedHourlyRate =
    explicitHourly > 0
      ? Math.round(explicitHourly)
      : explicitDaily > 0
      ? Math.round(explicitDaily / 9)
      : Math.round((Number(emp.baseSalary) || 0) / (25 * 9));
  const resolvedDailySalary =
    explicitDaily > 0 ? Math.round(explicitDaily) : resolvedHourlyRate * 9;
  return {
    id: emp.id,
    nik: emp.nik,
    full_name: emp.fullName,
    email: emp.email,
    google_email: emp.googleEmail || null,
    phone: emp.phone || null,
    avatar_url: emp.avatarUrl || null,
    face_photo_url: emp.facePhotoUrl || emp.avatarUrl || null,
    role: emp.role || 'Staff',
    gender: emp.gender || 'Laki-laki',
    department: emp.department || 'Operasional',
    employment_status: emp.employmentStatus || 'PKWT (Kontrak)',
    join_date: emp.joinDate || new Date().toISOString().split('T')[0],
    base_salary: Number(emp.baseSalary) || resolvedDailySalary * 25,
    allowances: {
      position: Number(rawAllowances.position) || 0,
      transport: Number(rawAllowances.transport) || 0,
      meal: Number(rawAllowances.meal) || 0,
      communication: Number(rawAllowances.communication) || 0,
      _hourlyRate: resolvedHourlyRate,
      _dailySalary: resolvedDailySalary,
      _isLiveStreamHost: Boolean(emp.isLiveStreamHost ?? emp.is_host),
      _salesCommissionPercentage:
        Number(emp.salesCommissionPercentage ?? emp.host_commission_pct) || 0,
      _salesCommissionPerPcs:
        Number(emp.salesCommissionPerPcs ?? emp.host_commission_per_pcs) || 0,
      _isCoHostLiveStream: Boolean(emp.isCoHostLiveStream ?? emp.is_co_host),
      _coHostCommissionPercentage:
        Number(emp.coHostCommissionPercentage ?? emp.co_host_commission_pct) || 0,
      _coHostCommissionPerPcs:
        Number(emp.coHostCommissionPerPcs ?? emp.co_host_commission_per_pcs) || 0,
      _liveStreamSalesLogs: Array.isArray(emp.liveStreamSalesLogs)
        ? emp.liveStreamSalesLogs
        : undefined,
      _accessPin: effectivePin,
      _ktpPhotoUrl: emp.ktpPhotoUrl || undefined,
      _ktpNumber: emp.ktpNumber || undefined,
      _ktpUploadedAt: emp.ktpUploadedAt || undefined,
      _profilePhotoUpdatedAt: emp.profilePhotoUpdatedAt || undefined,
      _contractStartDate: emp.contractStartDate || undefined,
      _contractEndDate: emp.contractEndDate || undefined,
      _contractDocumentNumber: emp.contractDocumentNumber || undefined,
      _contractDocumentUrl: emp.contractDocumentUrl || undefined,
      _contractDocumentName: emp.contractDocumentName || undefined,
      _contractUpdatedAt: emp.contractUpdatedAt || undefined,
      _birthDate: emp.birthDate || undefined,
      _birthPlace: emp.birthPlace || undefined,
      _shiftId: emp.shiftId || undefined,
      _address: emp.address || undefined,
      _phone: emp.phone || undefined,
      _email: emp.email || undefined,
      _emergencyContact: emp.emergencyContact || undefined,
      _workShifts: (() => {
        try {
          const rawCfg = localStorage.getItem('tgi_company_config');
          if (rawCfg) {
            const parsed = JSON.parse(rawCfg);
            if (Array.isArray(parsed?.workShifts) && parsed.workShifts.length > 0) {
              return parsed.workShifts;
            }
          }
        } catch {
          // ignore
        }
        return undefined;
      })(),
    },
    bank_name: emp.bankName || 'BCA',
    bank_account_number: emp.bankAccountNumber || '',
    bank_account_holder: emp.bankAccountHolder || emp.fullName,
    npwp: emp.npwp || '00.000.000.0-000.000',
    ptkp_status: emp.ptkpStatus || 'TK/0',
    bpjs_kesehatan_no: emp.bpjsKesehatanNo || '0001000000000',
    bpjs_ketenagakerjaan_no: emp.bpjsKetenagakerjaanNo || '00000000000',
    remaining_leave_days: Number(emp.remainingLeaveDays) ?? 12,
    is_active: emp.isActive ?? true,
    approval_status: emp.approvalStatus || 'approved',
    updated_at: new Date().toISOString(),
  };
}

export function dbToEmployee(row: any): Employee {
  const rawAllowances = row.allowances || {};
  if (Array.isArray(rawAllowances._workShifts) && rawAllowances._workShifts.length > 0) {
    try {
      const rawCfg = localStorage.getItem('tgi_company_config');
      if (!rawCfg) {
        localStorage.setItem('tgi_synced_work_shifts', JSON.stringify(rawAllowances._workShifts));
      }
    } catch {
      // ignore
    }
  }
  // Jangan ekspos PIN plaintext ke state React / DevTools; hanya tandai status terkonfigurasi
  const hasConfiguredPin = Boolean(
    row.access_pin_hash || row.access_pin || rawAllowances._accessPin
  );

  const baseSalary = Number(row.base_salary) || 0;
  const rawDaily =
    Number(row.daily_salary ?? rawAllowances._dailySalary) ||
    (baseSalary > 0 ? Math.round(baseSalary / 25) : 0);
  const hourlyRate =
    Number(row.hourly_rate ?? rawAllowances._hourlyRate) ||
    (rawDaily > 0 ? Math.round(rawDaily / 9) : 0);
  const dailySalary = rawDaily > 0 ? rawDaily : hourlyRate * 9;

  const isHostResolved = Boolean(
    row.is_host ?? row.is_live_stream_host ?? rawAllowances._isLiveStreamHost
  );
  const isCoHostResolved = Boolean(
    row.is_co_host ?? row.is_co_host_live_stream ?? rawAllowances._isCoHostLiveStream
  );

  const resolvedHostCommPct =
    Number(
      row.host_commission_pct ??
        row.sales_commission_percentage ??
        rawAllowances._salesCommissionPercentage
    ) || 0;
  const resolvedHostCommPerPcs =
    Number(
      row.host_commission_per_pcs ??
        row.sales_commission_per_pcs ??
        rawAllowances._salesCommissionPerPcs
    ) || 0;
  const resolvedCoHostCommPct =
    Number(
      row.co_host_commission_pct ??
        row.co_host_commission_percentage ??
        rawAllowances._coHostCommissionPercentage
    ) || 0;
  const resolvedCoHostCommPerPcs =
    Number(
      row.co_host_commission_per_pcs ??
        rawAllowances._coHostCommissionPerPcs
    ) || 0;

  return {
    id: row.id,
    nik: row.nik,
    fullName: row.full_name || '',
    email: row.email || rawAllowances._email || '',
    googleEmail: row.google_email || undefined,
    phone: row.phone || rawAllowances._phone || '',
    avatarUrl: row.avatar_url || '',
    facePhotoUrl: row.face_photo_url || row.avatar_url || undefined,
    ktpPhotoUrl: row.ktp_photo_url || rawAllowances._ktpPhotoUrl || undefined,
    ktpNumber: row.ktp_number || rawAllowances._ktpNumber || undefined,
    ktpUploadedAt: rawAllowances._ktpUploadedAt || undefined,
    profilePhotoUpdatedAt: rawAllowances._profilePhotoUpdatedAt || undefined,
    contractStartDate: row.contract_start_date || rawAllowances._contractStartDate || undefined,
    contractEndDate: row.contract_end_date || rawAllowances._contractEndDate || undefined,
    contractDocumentNumber:
      row.contract_document_number || rawAllowances._contractDocumentNumber || undefined,
    contractDocumentUrl:
      row.contract_document_url || rawAllowances._contractDocumentUrl || undefined,
    contractDocumentName:
      row.contract_document_name || rawAllowances._contractDocumentName || undefined,
    contractUpdatedAt: row.contract_updated_at || rawAllowances._contractUpdatedAt || undefined,
    birthDate: row.birth_date || rawAllowances._birthDate || undefined,
    birthPlace: row.birth_place || rawAllowances._birthPlace || undefined,
    shiftId: row.shift_id || rawAllowances._shiftId || 'SHF-01',
    isLiveStreamHost: isHostResolved,
    is_host: isHostResolved,
    salesCommissionPercentage: resolvedHostCommPct,
    host_commission_pct: resolvedHostCommPct,
    salesCommissionPerPcs: resolvedHostCommPerPcs,
    host_commission_per_pcs: resolvedHostCommPerPcs,
    isCoHostLiveStream: isCoHostResolved,
    is_co_host: isCoHostResolved,
    coHostCommissionPercentage: resolvedCoHostCommPct,
    co_host_commission_pct: resolvedCoHostCommPct,
    coHostCommissionPerPcs: resolvedCoHostCommPerPcs,
    co_host_commission_per_pcs: resolvedCoHostCommPerPcs,
    liveStreamSalesLogs: Array.isArray(rawAllowances._liveStreamSalesLogs)
      ? rawAllowances._liveStreamSalesLogs
      : [],
    address: row.address || rawAllowances._address || undefined,
    emergencyContact: rawAllowances._emergencyContact || undefined,
    role: row.role || 'Staff',
    gender: row.gender || 'Laki-laki',
    department: row.department || 'Operasional',
    employmentStatus: row.employment_status || 'PKWT (Kontrak)',
    joinDate: row.join_date || new Date().toISOString().split('T')[0],
    baseSalary: baseSalary || dailySalary * 25,
    hourlyRate,
    hourly_rate: hourlyRate,
    dailySalary,
    daily_salary: dailySalary,
    allowances: {
      position: Number(rawAllowances.position) || 0,
      transport: Number(rawAllowances.transport) || 0,
      meal: Number(rawAllowances.meal) || 0,
      communication: Number(rawAllowances.communication) || 0,
    },
    bankName: row.bank_name || 'BCA',
    bankAccountNumber: row.bank_account_number || '',
    bankAccountHolder: row.bank_account_holder || '',
    npwp: row.npwp || '00.000.000.0-000.000',
    ptkpStatus: row.ptkp_status || 'TK/0',
    bpjsKesehatanNo: row.bpjs_kesehatan_no || '0001000000000',
    bpjsKetenagakerjaanNo: row.bpjsKetenagakerjaanNo || row.bpjs_ketenagakerjaan_no || '00000000000',
    remainingLeaveDays: Number(row.remaining_leave_days) ?? 12,
    isActive: row.is_active ?? true,
    approvalStatus: row.approval_status || 'approved',
    accessPin: hasConfiguredPin ? '••••' : '',
  };
}

export function assetToDb(asset: CompanyAsset) {
  return {
    id: asset.id,
    asset_code: asset.assetCode,
    serial_number: asset.serialNumber || null,
    name: asset.name,
    category: asset.category,
    condition: asset.condition || 'Baik',
    purchase_date: asset.purchaseDate || null,
    purchase_cost: Number(asset.purchaseCost) || 0,
    status: asset.status || 'Tersedia',
    location: asset.location || null,
    assigned_to_employee_id: asset.assignedToEmployeeId || null,
    assigned_to_employee_name: asset.assignedToEmployeeName || null,
    assigned_to_employee_nik: asset.assignedToEmployeeNik || null,
    assigned_date: asset.assignedDate || null,
    handover_condition_notes: asset.handoverConditionNotes || null,
    photo_url: asset.photoUrl || null,
    specifications: asset.specifications || null,
    updated_at: new Date().toISOString(),
  };
}

export function dbToAsset(row: any): CompanyAsset {
  return {
    id: row.id,
    assetCode: row.asset_code,
    serialNumber: row.serial_number || undefined,
    name: row.name,
    category: row.category,
    condition: row.condition || 'Baik',
    purchaseDate: row.purchase_date || '',
    purchaseCost: Number(row.purchase_cost) || 0,
    status: row.status || 'Tersedia',
    location: row.location || undefined,
    assignedToEmployeeId: row.assigned_to_employee_id || null,
    assignedToEmployeeName: row.assigned_to_employee_name || null,
    assignedToEmployeeNik: row.assigned_to_employee_nik || null,
    assignedDate: row.assigned_date || null,
    handoverConditionNotes: row.handover_condition_notes || null,
    photoUrl: row.photo_url || undefined,
    specifications: row.specifications || undefined,
  };
}

export function payrollToDb(p: PayrollRecord) {
  return {
    id: p.id,
    employee_id: p.employeeId,
    period: p.period,
    base_salary: Number(p.baseSalary) || 0,
    allowance_position: Number(p.allowancePosition) || 0,
    allowance_transport: Number(p.allowanceTransport) || 0,
    allowance_meal: Number(p.allowanceMeal) || 0,
    allowance_communication: Number(p.allowanceCommunication) || 0,
    overtime_pay: Number(p.overtimePay) || 0,
    bonus: Number(p.bonus) || 0,
    total_gross_salary: Number(p.totalGrossSalary) || 0,
    late_deduction: Number(p.lateDeduction) || 0,
    bpjs_kesehatan_employee: Number(p.bpjsKesehatanEmployee) || 0,
    bpjs_kesehatan_employer: Number(p.bpjsKesehatanEmployer) || 0,
    bpjs_jht_employee: Number(p.bpjsJhtEmployee) || 0,
    bpjs_jht_employer: Number(p.bpjsJhtEmployer) || 0,
    bpjs_jp_employee: Number(p.bpjsJpEmployee) || 0,
    bpjs_jp_employer: Number(p.bpjsJpEmployer) || 0,
    bpjs_jkk_employer: Number(p.bpjsJkkEmployer) || 0,
    bpjs_jkm_employer: Number(p.bpjsJkmEmployer) || 0,
    pph21_ter: Number(p.pph21TER) || 0,
    cash_advance_deduction: Number(p.cashAdvanceDeduction) || 0,
    total_deductions: Number(p.totalDeductions) || 0,
    take_home_pay: Number(p.takeHomePay) || 0,
    payment_status: p.paymentStatus || 'Draft',
    payment_date: p.paymentDate || null,
    reference_number: p.referenceNumber || `PAY-${Date.now()}`,
  };
}

export function dbToPayroll(row: any): PayrollRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    period: row.period,
    createdAt: row.created_at || new Date().toISOString(),
    baseSalary: Number(row.base_salary) || 0,
    allowancePosition: Number(row.allowance_position) || 0,
    allowanceTransport: Number(row.allowance_transport) || 0,
    allowanceMeal: Number(row.allowance_meal) || 0,
    allowanceCommunication: Number(row.allowance_communication) || 0,
    overtimePay: Number(row.overtime_pay) || 0,
    bonus: Number(row.bonus) || 0,
    totalGrossSalary: Number(row.total_gross_salary) || 0,
    lateDeduction: Number(row.late_deduction) || 0,
    bpjsKesehatanEmployee: Number(row.bpjs_kesehatan_employee) || 0,
    bpjsKesehatanEmployer: Number(row.bpjs_kesehatan_employer) || 0,
    bpjsJhtEmployee: Number(row.bpjs_jht_employee) || 0,
    bpjsJhtEmployer: Number(row.bpjs_jht_employer) || 0,
    bpjsJpEmployee: Number(row.bpjs_jp_employee) || 0,
    bpjsJpEmployer: Number(row.bpjs_jp_employer) || 0,
    bpjsJkkEmployer: Number(row.bpjs_jkk_employer) || 0,
    bpjsJkmEmployer: Number(row.bpjs_jkm_employer) || 0,
    pph21TER: Number(row.pph21_ter) || 0,
    otherDeductions: 0,
    cashAdvanceDeduction: Number(row.cash_advance_deduction) || 0,
    totalDeductions: Number(row.total_deductions) || 0,
    takeHomePay: Number(row.take_home_pay) || 0,
    paymentStatus: row.payment_status || 'Draft',
    paymentDate: row.payment_date || undefined,
    referenceNumber: row.reference_number || `PAY-${row.id}`,
  };
}

export async function checkSupabaseStatus(): Promise<SupabaseSyncStatus> {
  try {
    const [empRes, astRes, payRes, attRes, lveRes, ovtRes, rmbRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('company_assets').select('id', { count: 'exact', head: true }),
      supabase.from('payrolls').select('id', { count: 'exact', head: true }),
      supabase.from('attendances').select('id', { count: 'exact', head: true }),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }),
      supabase.from('overtime_requests').select('id', { count: 'exact', head: true }),
      supabase.from('reimbursements').select('id', { count: 'exact', head: true }),
    ]);

    const isConnectionError =
      empRes.error &&
      !empRes.error.message?.includes('does not exist') &&
      empRes.error.code !== '42P01' &&
      empRes.error.code !== 'PGRST205';

    if (isConnectionError) {
      return {
        isConnected: false,
        isTablesCreated: false,
        statusText: 'Gagal Menghubungi Supabase',
        lastSyncTime: null,
        error: empRes.error?.message,
      };
    }

    const tableDetails = {
      employees: !empRes.error,
      company_assets: !astRes.error,
      payrolls: !payRes.error,
      attendances: !attRes.error,
      leave_requests: !lveRes.error,
      overtime_requests: !ovtRes.error,
      reimbursements: !rmbRes.error,
    };

    const isCoreCreated = tableDetails.employees;
    const allTablesCreated = Object.values(tableDetails).every(Boolean);

    return {
      isConnected: true,
      isTablesCreated: isCoreCreated,
      statusText: allTablesCreated
        ? 'Terhubung & 7 Tabel Aktif Sinkronisasi Real-time'
        : 'Terhubung ke Supabase (Sebagian Tabel Belum Dibuat)',
      lastSyncTime: new Date(),
      error: allTablesCreated
        ? null
        : 'Tabel Presensi, Cuti, Lembur, atau Reimbursement belum dibuat. Jalankan skrip SQL tambahan.',
      tableDetails,
    };
  } catch (err: any) {
    return {
      isConnected: false,
      isTablesCreated: false,
      statusText: 'Offline / Menggunakan Local Storage',
      lastSyncTime: null,
      error: err?.message || 'Koneksi gagal',
    };
  }
}

export const DELETED_EMPLOYEE_IDS_KEY = 'deleted_employee_ids';
export const EMPLOYEES_MODIFIED_KEY = 'tgi_employees_modified';
export const LEGACY_DUMMY_EMPLOYEE_IDS = [
  'emp-01',
  'emp-02',
  'emp-03',
  'emp-04',
  'emp-05',
  'emp-06',
  'emp-07',
  'emp-08',
  'emp-09',
  'emp-10',
];

export function getDeletedEmployeeIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_EMPLOYEE_IDS_KEY);
    if (!raw) return [...LEGACY_DUMMY_EMPLOYEE_IDS];
    const parsed = JSON.parse(raw);
    const stored = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    return Array.from(new Set([...LEGACY_DUMMY_EMPLOYEE_IDS, ...stored]));
  } catch {
    return [...LEGACY_DUMMY_EMPLOYEE_IDS];
  }
}

export function addDeletedEmployeeId(id: string): string[] {
  if (!id) return getDeletedEmployeeIds();
  try {
    const current = new Set(getDeletedEmployeeIds());
    current.add(id);
    const next = Array.from(current);
    localStorage.setItem(DELETED_EMPLOYEE_IDS_KEY, JSON.stringify(next));
    localStorage.setItem(EMPLOYEES_MODIFIED_KEY, 'true');
    return next;
  } catch {
    return [id];
  }
}

export function removeDeletedEmployeeId(id: string): void {
  if (!id) return;
  try {
    const next = getDeletedEmployeeIds().filter((item) => item !== id);
    localStorage.setItem(DELETED_EMPLOYEE_IDS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function markEmployeesModified(): void {
  try {
    localStorage.setItem(EMPLOYEES_MODIFIED_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function isEmployeesModified(): boolean {
  try {
    if (localStorage.getItem(EMPLOYEES_MODIFIED_KEY) === 'true') return true;
    if (getDeletedEmployeeIds().length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

export async function autoSeedSupabaseIfEmpty(
  mockEmployees: Employee[],
  mockAssets: CompanyAsset[],
  mockPayrolls: PayrollRecord[],
  forceManual = false
): Promise<{ seeded: boolean; message: string }> {
  try {
    // Guard: Never auto-seed or re-insert default dummy employees if the user has already modified or deleted employee data
    const deletedIds = new Set(getDeletedEmployeeIds());
    if (!forceManual && (isEmployeesModified() || deletedIds.size > 0)) {
      return {
        seeded: false,
        message: 'Auto-seed dimatikan karena data karyawan sudah pernah diubah atau dihapus.',
      };
    }

    const { count, error: empCountError } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true });

    if (empCountError) {
      return { seeded: false, message: empCountError.message };
    }

    if (count !== null && count > 0) {
      return { seeded: false, message: `Database telah berisi ${count} karyawan.` };
    }

    // Filter out any deleted employee IDs so they are never re-inserted
    const filteredMockEmployees = mockEmployees.filter((e) => !deletedIds.has(e.id));
    const filteredMockPayrolls = mockPayrolls.filter((p) => !deletedIds.has(p.employeeId));

    if (filteredMockEmployees.length === 0) {
      return {
        seeded: false,
        message: 'Tidak ada data karyawan untuk di-seed (seluruh data telah dihapus).',
      };
    }

    // Seed employees
    const mappedEmps = filteredMockEmployees.map(employeeToDb);
    const { error: seedEmpErr } = await supabase.from('employees').insert(mappedEmps);
    if (seedEmpErr) {
      return { seeded: false, message: seedEmpErr.message };
    }

    // Seed assets
    if (mockAssets.length > 0) {
      const mappedAssets = mockAssets.map(assetToDb);
      await supabase.from('company_assets').insert(mappedAssets);
    }

    // Seed payrolls
    if (filteredMockPayrolls.length > 0) {
      const mappedPayrolls = filteredMockPayrolls.map(payrollToDb);
      await supabase.from('payrolls').insert(mappedPayrolls);
    }

    return {
      seeded: true,
      message: `Berhasil mengunggah ${filteredMockEmployees.length} karyawan dan ${mockAssets.length} aset awal ke Supabase!`,
    };
  } catch (err: any) {
    return { seeded: false, message: err?.message || 'Gagal seeding' };
  }
}

export async function syncEmployeeLiveColumnsToSupabase(emp: Employee): Promise<void> {
  if (!emp?.id) return;
  const isHost = Boolean(emp.is_host === true || emp.isLiveStreamHost === true);
  const isCoHost = Boolean(emp.is_co_host === true || emp.isCoHostLiveStream === true);
  const hostPct = Number(emp.host_commission_pct ?? emp.salesCommissionPercentage) || 0;
  const hostPcs = Number(emp.host_commission_per_pcs ?? emp.salesCommissionPerPcs) || 0;
  const coHostPct = Number(emp.co_host_commission_pct ?? emp.coHostCommissionPercentage) || 0;
  const coHostPcs = Number(emp.co_host_commission_per_pcs ?? emp.coHostCommissionPerPcs) || 0;

  const liveColumnsPayload = {
    is_host: isHost,
    is_co_host: isCoHost,
    host_commission_pct: hostPct,
    host_commission_per_pcs: hostPcs,
    co_host_commission_pct: coHostPct,
    co_host_commission_per_pcs: coHostPcs,
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tgi_employee_live_updated', {
        detail: {
          ...emp,
          isLiveStreamHost: isHost,
          is_host: isHost,
          isCoHostLiveStream: isCoHost,
          is_co_host: isCoHost,
          salesCommissionPercentage: hostPct,
          host_commission_pct: hostPct,
          salesCommissionPerPcs: hostPcs,
          host_commission_per_pcs: hostPcs,
          coHostCommissionPercentage: coHostPct,
          co_host_commission_pct: coHostPct,
          coHostCommissionPerPcs: coHostPcs,
          co_host_commission_per_pcs: coHostPcs,
        },
      })
    );
  }

  await Promise.allSettled([
    supabase.from('employees').update(liveColumnsPayload).eq('id', emp.id),
    supabase.from('tgi_employees').upsert(
      {
        id: emp.id,
        nik: emp.nik || null,
        full_name: emp.fullName || '',
        ...liveColumnsPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    ),
  ]);
}

export async function fetchEmployeesFromSupabase(): Promise<Employee[] | null> {
  try {
    const [empRes, tgiEmpRes, liveSessionsRes] = await Promise.allSettled([
      supabase.from('employees').select('*').order('created_at', { ascending: false }),
      supabase.from('tgi_employees').select('*'),
      supabase
        .from('tgi_livestream_sessions')
        .select('*')
        .order('session_date', { ascending: false }),
    ]);

    if (
      empRes.status !== 'fulfilled' ||
      empRes.value.error ||
      !empRes.value.data
    ) {
      return null;
    }

    const tgiEmpMap = new Map<string, any>();
    const tgiEmpByNik = new Map<string, any>();
    const tgiEmpByName = new Map<string, any>();
    if (
      tgiEmpRes.status === 'fulfilled' &&
      !tgiEmpRes.value.error &&
      Array.isArray(tgiEmpRes.value.data)
    ) {
      for (const r of tgiEmpRes.value.data) {
        if (r?.id) tgiEmpMap.set(String(r.id), r);
        if (r?.nik) tgiEmpByNik.set(String(r.nik).trim().toLowerCase(), r);
        if (r?.full_name) tgiEmpByName.set(String(r.full_name).trim().toLowerCase(), r);
      }
    }

    const sessionsByEmp = new Map<string, LiveStreamSalesRecord[]>();
    const sessionsByName = new Map<string, LiveStreamSalesRecord[]>();
    if (
      liveSessionsRes.status === 'fulfilled' &&
      !liveSessionsRes.value.error &&
      Array.isArray(liveSessionsRes.value.data)
    ) {
      for (const sRow of liveSessionsRes.value.data) {
        const mappedSession = dbToLivestreamSession(sRow);
        if (mappedSession.employeeId) {
          const key = String(mappedSession.employeeId).trim();
          const list = sessionsByEmp.get(key) || [];
          list.push(mappedSession);
          sessionsByEmp.set(key, list);
        }
        if (mappedSession.employeeName) {
          const nameKey = String(mappedSession.employeeName).trim().toLowerCase();
          const list = sessionsByName.get(nameKey) || [];
          list.push(mappedSession);
          sessionsByName.set(nameKey, list);
        }
      }
    }

    const deletedIds = new Set(getDeletedEmployeeIds());
    const allMapped = empRes.value.data.map((row: any) => {
      const tgiRow =
        tgiEmpMap.get(String(row.id)) ||
        (row.nik ? tgiEmpByNik.get(String(row.nik).trim().toLowerCase()) : undefined) ||
        (row.full_name ? tgiEmpByName.get(String(row.full_name).trim().toLowerCase()) : undefined);
      const mergedRow = tgiRow ? { ...row, ...tgiRow, id: row.id, allowances: row.allowances } : row;
      const emp = dbToEmployee(mergedRow);
      const byIdSessions = sessionsByEmp.get(emp.id) || [];
      const byNikSessions = emp.nik ? sessionsByEmp.get(emp.nik) || [] : [];
      const byNameSessions = emp.fullName
        ? sessionsByName.get(emp.fullName.trim().toLowerCase()) || []
        : [];
      const tableSessions = [...byIdSessions, ...byNikSessions, ...byNameSessions];
      if (tableSessions.length > 0) {
        const mergedMap = new Map<string, LiveStreamSalesRecord>();
        for (const s of [...tableSessions, ...(emp.liveStreamSalesLogs || [])]) {
          if (s?.id) mergedMap.set(s.id, s);
        }
        emp.liveStreamSalesLogs = Array.from(mergedMap.values());
      }
      return emp;
    });

    // Purge any rows in Supabase that are marked in deleted_employee_ids so they never come back
    if (deletedIds.size > 0) {
      const lingeringDeleted = allMapped.filter((e) => deletedIds.has(e.id));
      if (lingeringDeleted.length > 0) {
        lingeringDeleted.forEach((emp) => {
          deleteEmployeeFromSupabase(emp.id);
        });
      }
    }

    return allMapped.filter((emp) => !deletedIds.has(emp.id));
  } catch {
    return null;
  }
}

export async function insertEmployeeToSupabase(emp: Employee): Promise<boolean> {
  try {
    removeDeletedEmployeeId(emp.id);
    markEmployeesModified();
    const row = employeeToDb(emp);
    const { error } = await supabase.from('employees').insert([row]);
    if (error) {
      console.warn('Supabase insert employee error (fallback to local):', error.message);
      return false;
    }
    syncEmployeeLiveColumnsToSupabase(emp).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Supabase insert employee error:', err);
    return false;
  }
}

export async function updateEmployeeInSupabase(emp: Employee): Promise<boolean> {
  try {
    markEmployeesModified();
    const row = employeeToDb(emp);
    const { error } = await supabase.from('employees').update(row).eq('id', emp.id);
    syncEmployeeLiveColumnsToSupabase(emp).catch(() => {});
    if (error) {
      console.warn('Supabase update employee error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase update employee error:', err);
    return false;
  }
}

export async function deleteEmployeeFromSupabase(id: string): Promise<boolean> {
  if (!id) return false;
  // Always record in deleted_employee_ids first so it never gets restored on page refresh
  addDeletedEmployeeId(id);

  try {
    // Delete dependent child records first so foreign key constraints never block DELETE FROM employees WHERE id = ...
    await Promise.allSettled([
      supabase.from('payrolls').delete().eq('employee_id', id),
      supabase.from('attendances').delete().eq('employee_id', id),
      supabase.from('leave_requests').delete().eq('employee_id', id),
      supabase.from('overtime_requests').delete().eq('employee_id', id),
      supabase.from('reimbursements').delete().eq('employee_id', id),
      supabase.from('tgi_livestream_sessions').delete().eq('employee_id', id),
      supabase.from('tgi_employees').delete().eq('id', id),
      supabase
        .from('company_assets')
        .update({
          assigned_to_employee_id: null,
          assigned_to_employee_name: null,
          assigned_to_employee_nik: null,
          status: 'Tersedia',
        })
        .eq('assigned_to_employee_id', id),
    ]);

    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete employee error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete employee error:', err);
    return false;
  }
}

export async function fetchAssetsFromSupabase(): Promise<CompanyAsset[] | null> {
  try {
    const { data, error } = await supabase
      .from('company_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;
    return data.map(dbToAsset);
  } catch {
    return null;
  }
}

export async function insertAssetToSupabase(asset: CompanyAsset): Promise<boolean> {
  try {
    const row = assetToDb(asset);
    const { error } = await supabase.from('company_assets').insert([row]);
    if (error) {
      console.warn('Supabase insert asset error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase insert asset error:', err);
    return false;
  }
}

export async function updateAssetInSupabase(asset: CompanyAsset): Promise<boolean> {
  try {
    const row = assetToDb(asset);
    const { error } = await supabase.from('company_assets').update(row).eq('id', asset.id);
    if (error) {
      console.warn('Supabase update asset error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase update asset error:', err);
    return false;
  }
}

export async function deleteAssetFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('company_assets').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete asset error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete asset error:', err);
    return false;
  }
}

export async function fetchPayrollsFromSupabase(): Promise<PayrollRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('payrolls')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;
    const deletedIds = new Set(getDeletedEmployeeIds());
    return data.map(dbToPayroll).filter((p) => !deletedIds.has(p.employeeId));
  } catch {
    return null;
  }
}

export async function upsertPayrollToSupabase(record: PayrollRecord): Promise<boolean> {
  try {
    const row = payrollToDb(record);
    const { error } = await supabase.from('payrolls').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert payroll error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsert payroll error:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// ATTENDANCES (Presensi)
// -----------------------------------------------------------------------------
export function attendanceToDb(att: AttendanceRecord) {
  return {
    id: att.id,
    employee_id: att.employeeId,
    date: att.date,
    check_in: att.checkIn || '',
    check_out: att.checkOut || '',
    status: att.status || 'Hadir Tepat Waktu',
    work_hours: Number(att.workHours) || 8,
    late_minutes: Number(att.lateMinutes) || 0,
    notes: att.notes || null,
    face_scan_verified: att.faceScanVerified ?? false,
    face_confidence: Number(att.faceConfidence) || 0,
    face_photo_snapshot: att.facePhotoSnapshot || null,
    location_coords: att.locationCoords || null,
    location_address: att.locationAddress || null,
    is_in_office_radius: att.isInOfficeRadius ?? true,
    distance_meters: Number(att.distanceMeters) || 0,
    updated_at: new Date().toISOString(),
  };
}

export function dbToAttendance(row: any): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    checkIn: row.check_in || '',
    checkOut: row.check_out || '',
    status: row.status || 'Hadir Tepat Waktu',
    workHours: Number(row.work_hours) || 8,
    lateMinutes: Number(row.late_minutes) || 0,
    notes: row.notes || undefined,
    faceScanVerified: Boolean(row.face_scan_verified),
    faceConfidence: Number(row.face_confidence) || 0,
    facePhotoSnapshot: row.face_photo_snapshot || undefined,
    locationCoords: row.location_coords || undefined,
    locationAddress: row.location_address || undefined,
    isInOfficeRadius: row.is_in_office_radius ?? true,
    distanceMeters: Number(row.distance_meters) || 0,
  };
}

const DELETED_ATTENDANCE_KEYS_STORAGE = 'tgi_deleted_attendance_keys';

export function getDeletedAttendanceKeys(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_ATTENDANCE_KEYS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function addDeletedAttendanceKey(id: string, employeeId?: string, date?: string): void {
  try {
    const current = new Set(getDeletedAttendanceKeys());
    if (id) current.add(id);
    if (employeeId && date) current.add(`${employeeId}__${date}`);
    localStorage.setItem(DELETED_ATTENDANCE_KEYS_STORAGE, JSON.stringify(Array.from(current)));
  } catch {
    // ignore storage errors
  }
}

export function removeDeletedAttendanceKey(id: string, employeeId?: string, date?: string): void {
  try {
    const current = new Set(getDeletedAttendanceKeys());
    if (id) current.delete(id);
    if (employeeId && date) current.delete(`${employeeId}__${date}`);
    localStorage.setItem(DELETED_ATTENDANCE_KEYS_STORAGE, JSON.stringify(Array.from(current)));
  } catch {
    // ignore storage errors
  }
}

export async function fetchAttendancesFromSupabase(): Promise<AttendanceRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .order('date', { ascending: false });

    if (error || !data) return null;
    const deletedIds = new Set(getDeletedEmployeeIds());
    const deletedAttKeys = new Set(getDeletedAttendanceKeys());
    return data
      .map(dbToAttendance)
      .filter(
        (a) =>
          !deletedIds.has(a.employeeId) &&
          !deletedAttKeys.has(a.id) &&
          !deletedAttKeys.has(`${a.employeeId}__${a.date}`)
      );
  } catch {
    return null;
  }
}

export async function upsertAttendanceToSupabase(att: AttendanceRecord): Promise<boolean> {
  try {
    removeDeletedAttendanceKey(att.id, att.employeeId, att.date);
    const row = attendanceToDb(att);
    const { error } = await supabase.from('attendances').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert attendance error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsert attendance error:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// LEAVE REQUESTS (Cuti & Izin + Bukti Gambar Pendukung)
// -----------------------------------------------------------------------------
const LEAVE_ATTACHMENTS_STORAGE_KEY = 'tgi_leave_attachments_map';

function saveLeaveAttachmentCache(
  id: string,
  meta?: { attachmentUrl?: string; attachmentName?: string; attachmentUploadedAt?: string }
) {
  try {
    if (!meta?.attachmentUrl) return;
    const raw = localStorage.getItem(LEAVE_ATTACHMENTS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = meta;
    localStorage.setItem(LEAVE_ATTACHMENTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function getLeaveAttachmentCache(id: string): {
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentUploadedAt?: string;
} {
  try {
    const raw = localStorage.getItem(LEAVE_ATTACHMENTS_STORAGE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw);
    return map[id] || {};
  } catch {
    return {};
  }
}

const LEAVE_ATTACHMENT_MARKER = '\n__TGI_LEAVE_ATTACHMENT__:';

export function leaveToDb(leave: LeaveRequest, includeAttachmentInReasonFallback = false) {
  let reasonField = leave.reason || '';
  if (includeAttachmentInReasonFallback && leave.attachmentUrl) {
    const payload = JSON.stringify({
      u: leave.attachmentUrl,
      n: leave.attachmentName || 'Bukti_Cuti_Izin.jpg',
      t: leave.attachmentUploadedAt || '',
    });
    reasonField = `${reasonField}${LEAVE_ATTACHMENT_MARKER}${payload}`;
  }
  return {
    id: leave.id,
    employee_id: leave.employeeId,
    type: leave.type,
    start_date: leave.startDate,
    end_date: leave.endDate,
    total_days: Number(leave.totalDays) || 1,
    reason: reasonField,
    status: leave.status || 'Menunggu Persetujuan',
    applied_at: leave.appliedAt || new Date().toISOString(),
    approved_by: leave.approvedBy || null,
    updated_at: new Date().toISOString(),
  };
}

export function dbToLeave(row: any): LeaveRequest {
  let cleanReason = row.reason || '';
  let embeddedUrl: string | undefined;
  let embeddedName: string | undefined;
  let embeddedTime: string | undefined;

  if (typeof cleanReason === 'string' && cleanReason.includes(LEAVE_ATTACHMENT_MARKER)) {
    const parts = cleanReason.split(LEAVE_ATTACHMENT_MARKER);
    cleanReason = parts[0] || '';
    try {
      const parsed = JSON.parse(parts[1] || '{}');
      embeddedUrl = parsed.u || undefined;
      embeddedName = parsed.n || undefined;
      embeddedTime = parsed.t || undefined;
    } catch {
      // ignore parse error
    }
  }

  const cached = getLeaveAttachmentCache(row.id);
  const attachmentUrl = row.attachment_url || embeddedUrl || cached.attachmentUrl || undefined;
  const attachmentName = row.attachment_name || embeddedName || cached.attachmentName || undefined;
  const attachmentUploadedAt =
    row.attachment_uploaded_at || embeddedTime || cached.attachmentUploadedAt || undefined;

  if (attachmentUrl) {
    saveLeaveAttachmentCache(row.id, { attachmentUrl, attachmentName, attachmentUploadedAt });
  }

  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type || 'Cuti Tahunan',
    startDate: row.start_date,
    endDate: row.end_date,
    totalDays: Number(row.total_days) || 1,
    reason: cleanReason,
    status: row.status || 'Menunggu Persetujuan',
    appliedAt: row.applied_at || new Date().toISOString(),
    approvedBy: row.approved_by || undefined,
    attachmentUrl,
    attachmentName,
    attachmentUploadedAt,
  };
}

export async function fetchLeaveRequestsFromSupabase(): Promise<LeaveRequest[] | null> {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('applied_at', { ascending: false });

    if (error || !data) return null;
    const deletedIds = new Set(getDeletedEmployeeIds());
    return data.map(dbToLeave).filter((l) => !deletedIds.has(l.employeeId));
  } catch {
    return null;
  }
}

export async function upsertLeaveRequestToSupabase(req: LeaveRequest): Promise<boolean> {
  try {
    if (req.attachmentUrl) {
      saveLeaveAttachmentCache(req.id, {
        attachmentUrl: req.attachmentUrl,
        attachmentName: req.attachmentName,
        attachmentUploadedAt: req.attachmentUploadedAt,
      });
    }
    // Use embedded attachment marker inside reason column so it works on all Supabase schemas without requiring manual DDL
    const row = leaveToDb(req, Boolean(req.attachmentUrl));
    const { error } = await supabase.from('leave_requests').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert leave request error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsert leave request error:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// OVERTIME REQUESTS (Klaim Lembur Per Menit)
// -----------------------------------------------------------------------------
export function overtimeToDb(ot: OvertimeRequest) {
  const totalMinutes =
    typeof ot.minutes === 'number' && ot.minutes > 0
      ? Math.round(ot.minutes)
      : Math.round((Number(ot.hours) || 1) * 60);
  const hoursDecimal = Number((totalMinutes / 60).toFixed(2));
  return {
    id: ot.id,
    employee_id: ot.employeeId,
    date: ot.date,
    hours: hoursDecimal,
    task_description: ot.taskDescription || '',
    calculated_pay: Number(ot.calculatedPay) || 0,
    status: ot.status || 'Menunggu Persetujuan',
    updated_at: new Date().toISOString(),
  };
}

export function dbToOvertime(row: any): OvertimeRequest {
  const hoursVal = Number(row.hours) || 1;
  const minutesVal =
    row.minutes !== undefined && Number(row.minutes) > 0
      ? Math.round(Number(row.minutes))
      : Math.round(hoursVal * 60);
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    hours: Number((minutesVal / 60).toFixed(2)),
    minutes: minutesVal,
    taskDescription: row.task_description || '',
    calculatedPay: Number(row.calculated_pay) || 0,
    status: row.status || 'Menunggu Persetujuan',
  };
}

export async function fetchOvertimeRequestsFromSupabase(): Promise<OvertimeRequest[] | null> {
  try {
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .order('date', { ascending: false });

    if (error || !data) return null;
    const deletedIds = new Set(getDeletedEmployeeIds());
    return data.map(dbToOvertime).filter((o) => !deletedIds.has(o.employeeId));
  } catch {
    return null;
  }
}

export async function upsertOvertimeRequestToSupabase(ot: OvertimeRequest): Promise<boolean> {
  try {
    const row = overtimeToDb(ot);
    const { error } = await supabase.from('overtime_requests').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert overtime request error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsert overtime request error:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// REIMBURSEMENTS (Klaim Biaya)
// -----------------------------------------------------------------------------
export function reimbursementToDb(claim: ReimbursementClaim) {
  return {
    id: claim.id,
    claim_number: claim.claimNumber,
    employee_id: claim.employeeId,
    date: claim.date,
    category: claim.category,
    amount: Number(claim.amount) || 0,
    description: claim.description || '',
    receipt_number: claim.receiptNumber || null,
    receipt_photo_url: claim.receiptPhotoUrl || null,
    receipt_file_name: claim.receiptFileName || null,
    receipt_file_type: claim.receiptFileType || 'image',
    status: claim.status || 'Menunggu Persetujuan',
    applied_at: claim.appliedAt || new Date().toISOString(),
    approved_at: claim.approvedAt || null,
    approved_by: claim.approvedBy || null,
    rejection_reason: claim.rejectionReason || null,
    payment_method: claim.paymentMethod || null,
    disbursed_at: claim.disbursedAt || null,
    updated_at: new Date().toISOString(),
  };
}

export function dbToReimbursement(row: any): ReimbursementClaim {
  return {
    id: row.id,
    claimNumber: row.claim_number,
    employeeId: row.employee_id,
    date: row.date,
    category: row.category,
    amount: Number(row.amount) || 0,
    description: row.description || '',
    receiptNumber: row.receipt_number || undefined,
    receiptPhotoUrl: row.receipt_photo_url || undefined,
    receiptFileName: row.receipt_file_name || undefined,
    receiptFileType: row.receipt_file_type || 'image',
    status: row.status || 'Menunggu Persetujuan',
    appliedAt: row.applied_at || new Date().toISOString(),
    approvedAt: row.approved_at || undefined,
    approvedBy: row.approved_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
    paymentMethod: row.payment_method || undefined,
    disbursedAt: row.disbursed_at || undefined,
  };
}

export async function fetchReimbursementsFromSupabase(): Promise<ReimbursementClaim[] | null> {
  try {
    const { data, error } = await supabase
      .from('reimbursements')
      .select('*')
      .order('applied_at', { ascending: false });

    if (error || !data) return null;
    const deletedIds = new Set(getDeletedEmployeeIds());
    return data.map(dbToReimbursement).filter((r) => !deletedIds.has(r.employeeId));
  } catch {
    return null;
  }
}

export async function upsertReimbursementToSupabase(claim: ReimbursementClaim): Promise<boolean> {
  try {
    const row = reimbursementToDb(claim);
    const { error } = await supabase.from('reimbursements').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert reimbursement error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsert reimbursement error:', err);
    return false;
  }
}

export async function deleteReimbursementFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('reimbursements').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete reimbursement error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete reimbursement error:', err);
    return false;
  }
}

export async function deleteAttendanceFromSupabase(
  id: string,
  employeeId?: string,
  date?: string
): Promise<boolean> {
  addDeletedAttendanceKey(id, employeeId, date);
  try {
    const { error } = await supabase.from('attendances').delete().eq('id', id);
    if (employeeId && date) {
      await supabase
        .from('attendances')
        .delete()
        .eq('employee_id', employeeId)
        .eq('date', date);
    }
    if (error) {
      console.warn('Supabase delete attendance error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete attendance error:', err);
    return false;
  }
}

export async function deleteLeaveRequestFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete leave request error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete leave request error:', err);
    return false;
  }
}

export async function deleteOvertimeRequestFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('overtime_requests').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete overtime request error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete overtime request error:', err);
    return false;
  }
}

export async function fetchEmployeeByIdFromSupabase(employeeId: string): Promise<Employee | null> {
  if (!employeeId) return null;
  try {
    const [empRes, tgiEmpRes, sessionsRes] = await Promise.allSettled([
      supabase.from('employees').select('*').eq('id', employeeId).single(),
      supabase.from('tgi_employees').select('*').eq('id', employeeId).single(),
      supabase
        .from('tgi_livestream_sessions')
        .select('*')
        .eq('employee_id', employeeId)
        .order('session_date', { ascending: false }),
    ]);

    const empRow =
      empRes.status === 'fulfilled' && !empRes.value.error ? empRes.value.data : null;
    const tgiRow =
      tgiEmpRes.status === 'fulfilled' && !tgiEmpRes.value.error ? tgiEmpRes.value.data : null;

    if (!empRow && !tgiRow) {
      return null;
    }

    const mergedRow = empRow && tgiRow
      ? { ...empRow, ...tgiRow, id: empRow.id, allowances: empRow.allowances }
      : empRow || tgiRow;
    const emp = dbToEmployee(mergedRow);

    if (
      sessionsRes.status === 'fulfilled' &&
      !sessionsRes.value.error &&
      Array.isArray(sessionsRes.value.data) &&
      sessionsRes.value.data.length > 0
    ) {
      const tableSessions = sessionsRes.value.data.map(dbToLivestreamSession);
      const mergedMap = new Map<string, LiveStreamSalesRecord>();
      for (const s of [...tableSessions, ...(emp.liveStreamSalesLogs || [])]) {
        if (s?.id) mergedMap.set(s.id, s);
      }
      emp.liveStreamSalesLogs = Array.from(mergedMap.values());
    }

    return emp;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// TGI LIVESTREAM SESSIONS (Tabel tgi_livestream_sessions & Migrasi SQL)
// -----------------------------------------------------------------------------
export const TGI_LIVESTREAM_SQL_MIGRATION = `-- Tambahan kolom role dan komisi pada tabel employees / profile
ALTER TABLE tgi_employees 
ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_co_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_commission_pct DECIMAL(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS host_commission_per_pcs DECIMAL(10,2) DEFAULT 2000.00,
ADD COLUMN IF NOT EXISTS co_host_commission_pct DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS co_host_commission_per_pcs DECIMAL(10,2) DEFAULT 1000.00;

-- Tambahan kolom yang sama pada tabel employees utama
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_co_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_commission_pct DECIMAL(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS host_commission_per_pcs DECIMAL(10,2) DEFAULT 2000.00,
ADD COLUMN IF NOT EXISTS co_host_commission_pct DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS co_host_commission_per_pcs DECIMAL(10,2) DEFAULT 1000.00;

-- Tabel riwayat sesi live streaming per karyawan per periode
CREATE TABLE IF NOT EXISTS tgi_livestream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    role_type TEXT CHECK (role_type IN ('host', 'co_host')) NOT NULL,
    platform TEXT DEFAULT 'TikTok Shop Live',
    session_date DATE NOT NULL,
    omset DECIMAL(15,2) DEFAULT 0.00,
    pcs_sold INTEGER DEFAULT 0,
    commission_pct_used DECIMAL(5,2) DEFAULT 0.00,
    commission_per_pcs_used DECIMAL(10,2) DEFAULT 0.00,
    total_commission DECIMAL(12,2) DEFAULT 0.00,
    period TEXT NOT NULL, -- Contoh: 'Oktober 2026'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateSessionUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function livestreamSessionToDb(rec: LiveStreamSalesRecord) {
  const isCoHost =
    rec.role_type === 'co_host' || rec.sessionRole === 'Co-Host';
  const roleType: 'host' | 'co_host' = isCoHost ? 'co_host' : 'host';
  const omsetVal = Number(rec.omsetAmount ?? rec.omset) || 0;
  const pcsVal = Math.round(Number(rec.pcsSold ?? rec.pcs_sold) || 0);
  const pctVal = Number(rec.commissionPercentageSnapshot ?? rec.commission_pct_used) || 0;
  const perPcsVal = Number(rec.commissionPerPcsSnapshot ?? rec.commission_per_pcs_used) || 0;
  const totalCommVal =
    Number(rec.calculatedCommission ?? rec.total_commission) ||
    Math.round((omsetVal * pctVal) / 100 + pcsVal * perPcsVal);

  const payload: Record<string, any> = {
    employee_id: rec.employeeId || rec.employee_id || '',
    employee_name: rec.employeeName || rec.employee_name || '',
    role_type: roleType,
    platform: rec.platform || 'TikTok Shop Live',
    session_date: rec.date || rec.session_date || new Date().toISOString().split('T')[0],
    omset: omsetVal,
    pcs_sold: pcsVal,
    commission_pct_used: pctVal,
    commission_per_pcs_used: perPcsVal,
    total_commission: totalCommVal,
    period: rec.period || 'Maret 2026',
    notes: rec.notes || rec.sessionTitle || null,
  };

  if (rec.id && UUID_REGEX.test(rec.id)) {
    payload.id = rec.id;
  }

  return payload;
}

export function dbToLivestreamSession(row: any): LiveStreamSalesRecord {
  const roleType: 'host' | 'co_host' =
    row.role_type === 'co_host' ? 'co_host' : 'host';
  const sessionRole: 'Host' | 'Co-Host' =
    roleType === 'co_host' ? 'Co-Host' : 'Host';
  const omsetVal = Number(row.omset ?? row.omset_amount) || 0;
  const pcsVal = Math.round(Number(row.pcs_sold) || 0);
  const pctVal = Number(row.commission_pct_used ?? row.commission_percentage_snapshot) || 0;
  const perPcsVal = Number(row.commission_per_pcs_used ?? row.commission_per_pcs_snapshot) || 0;
  const totalCommVal =
    Number(row.total_commission ?? row.calculated_commission) ||
    Math.round((omsetVal * pctVal) / 100 + pcsVal * perPcsVal);
  const dateStr =
    typeof row.session_date === 'string'
      ? row.session_date.slice(0, 10)
      : typeof row.date === 'string'
      ? row.date.slice(0, 10)
      : new Date().toISOString().split('T')[0];

  return {
    id: String(row.id || generateSessionUuid()),
    employeeId: String(row.employee_id || ''),
    employee_id: String(row.employee_id || ''),
    employeeName: row.employee_name || '',
    employee_name: row.employee_name || '',
    date: dateStr,
    session_date: dateStr,
    period: row.period || 'Maret 2026',
    platform: (row.platform as LiveStreamPlatform) || 'TikTok Shop Live',
    sessionRole,
    role_type: roleType,
    sessionTitle:
      row.notes || `Sesi ${sessionRole} ${row.platform || 'TikTok Shop Live'} (${dateStr})`,
    durationHours: Number(row.duration_hours) || 3,
    omsetAmount: omsetVal,
    omset: omsetVal,
    pcsSold: pcsVal,
    pcs_sold: pcsVal,
    commissionPercentageSnapshot: pctVal,
    commission_pct_used: pctVal,
    commissionPerPcsSnapshot: perPcsVal,
    commission_per_pcs_used: perPcsVal,
    calculatedCommission: totalCommVal,
    total_commission: totalCommVal,
    notes: row.notes || undefined,
    status: 'Terverifikasi',
    createdAt: row.created_at || new Date().toISOString(),
    created_at: row.created_at || new Date().toISOString(),
  };
}

export async function fetchLivestreamSessionsFromSupabase(
  employeeId?: string,
  period?: string
): Promise<LiveStreamSalesRecord[] | null> {
  try {
    let query = supabase
      .from('tgi_livestream_sessions')
      .select('*')
      .order('session_date', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data, error } = await query;
    if (error || !data) return null;
    const mapped = data.map(dbToLivestreamSession);
    if (period) {
      const strict = mapped.filter(
        (s) =>
          !s.period ||
          String(s.period).trim().toLowerCase() === String(period).trim().toLowerCase()
      );
      return strict.length > 0 ? strict : mapped;
    }
    return mapped;
  } catch {
    return null;
  }
}

export async function upsertLivestreamSessionToSupabase(
  rec: LiveStreamSalesRecord
): Promise<boolean> {
  try {
    const payload = livestreamSessionToDb(rec);
    let ok = false;
    if (payload.id) {
      const { error } = await supabase
        .from('tgi_livestream_sessions')
        .upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase upsert tgi_livestream_sessions error:', error.message);
      } else {
        ok = true;
      }
    } else {
      const { error } = await supabase.from('tgi_livestream_sessions').insert([payload]);
      if (error) {
        console.warn('Supabase insert tgi_livestream_sessions error:', error.message);
      } else {
        ok = true;
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tgi_livestream_sessions_updated', { detail: rec })
      );
    }
    return ok;
  } catch (err) {
    console.warn('Supabase upsert tgi_livestream_sessions error:', err);
    return false;
  }
}

export async function deleteLivestreamSessionFromSupabase(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const { error } = await supabase
      .from('tgi_livestream_sessions')
      .delete()
      .eq('id', sessionId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tgi_livestream_sessions_updated', { detail: { deletedId: sessionId } })
      );
    }
    if (error) {
      console.warn('Supabase delete tgi_livestream_sessions error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete tgi_livestream_sessions error:', err);
    return false;
  }
}



