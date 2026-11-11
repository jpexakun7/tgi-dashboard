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
  EmploymentType,
  PartTimeWorkLog,
  PartTimeWeeklyPayout,
} from '../types';
import {
  normalizeEmploymentType,
  isEmployeePartTime,
  calculateActualWorkHoursFromClock,
} from '../utils/formatters';

const EMP_EMPLOYMENT_META_STORAGE_KEY = 'tgi_emp_employment_meta_v2';
const PARTTIME_OVERRIDES_STORAGE_KEY = 'tgi_parttime_overrides';

export interface PersistedEmploymentMeta {
  employmentType: EmploymentType;
  employment_type?: EmploymentType;
  status?: string;
  employmentStatus?: string;
  hourlyRate?: number;
  hourly_rate?: number;
  overtimeRate?: number;
  overtime_rate?: number;
  updatedAt: string;
}

export function getSavedEmploymentMetaMap(): Record<string, PersistedEmploymentMeta> {
  try {
    const merged: Record<string, PersistedEmploymentMeta> = {};
    const rawLegacy = localStorage.getItem(EMP_EMPLOYMENT_META_STORAGE_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      if (parsed && typeof parsed === 'object') Object.assign(merged, parsed);
    }
    const rawOverrides = localStorage.getItem(PARTTIME_OVERRIDES_STORAGE_KEY);
    if (rawOverrides) {
      const parsedOverrides = JSON.parse(rawOverrides);
      if (parsedOverrides && typeof parsedOverrides === 'object') {
        for (const [k, v] of Object.entries(parsedOverrides)) {
          if (v && typeof v === 'object') {
            const item = v as any;
            const normType =
              normalizeEmploymentType(item.employment_type || item.employmentType || item.status) ||
              'Part-Time';
            merged[k] = {
              employmentType: normType,
              employment_type: normType,
              status: item.status || (normType === 'Part-Time' ? 'Part-Time' : undefined),
              employmentStatus:
                item.employmentStatus ||
                item.status ||
                (normType === 'Part-Time' ? 'Part-Time' : undefined),
              hourlyRate: Number(item.hourly_rate ?? item.hourlyRate) || undefined,
              hourly_rate: Number(item.hourly_rate ?? item.hourlyRate) || undefined,
              overtimeRate: Number(item.overtime_rate ?? item.overtimeRate) || undefined,
              overtime_rate: Number(item.overtime_rate ?? item.overtimeRate) || undefined,
              updatedAt: item.updatedAt || new Date().toISOString(),
            };
          }
        }
      }
    }
    return merged;
  } catch {
    return {};
  }
}

export function getEmployeeEmploymentMetaLocal(
  id?: string,
  nik?: string
): PersistedEmploymentMeta | null {
  const map = getSavedEmploymentMetaMap();
  if (id && map[id]) return map[id];
  if (nik && map[`nik:${nik.trim().toLowerCase()}`]) {
    return map[`nik:${nik.trim().toLowerCase()}`];
  }
  // Also check tgi_employees_data backup in localStorage
  try {
    const rawEmps = localStorage.getItem('tgi_employees_data');
    if (rawEmps) {
      const list = JSON.parse(rawEmps);
      if (Array.isArray(list)) {
        const found = list.find(
          (e: any) =>
            (id && e?.id === id) ||
            (nik && String(e?.nik || '').trim().toLowerCase() === nik.trim().toLowerCase())
        );
        const normType = normalizeEmploymentType(
          found?.employmentType ||
            found?.employment_type ||
            found?.employmentStatus ||
            found?.status
        );
        if (found && normType) {
          return {
            employmentType: normType,
            employment_type: normType,
            status: normType === 'Part-Time' ? 'Part-Time' : found.employmentStatus,
            employmentStatus: normType === 'Part-Time' ? 'Part-Time' : found.employmentStatus,
            hourlyRate: Number(found.hourlyRate ?? found.hourly_rate) || undefined,
            hourly_rate: Number(found.hourlyRate ?? found.hourly_rate) || undefined,
            overtimeRate: Number(found.overtimeRate ?? found.overtime_rate) || undefined,
            overtime_rate: Number(found.overtimeRate ?? found.overtime_rate) || undefined,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveEmployeeEmploymentMetaLocal(emp: Partial<Employee>): void {
  if (!emp?.id && !emp?.nik) return;
  const isPt =
    normalizeEmploymentType(emp.employmentType) === 'Part-Time' ||
    normalizeEmploymentType(emp.employment_type) === 'Part-Time' ||
    normalizeEmploymentType(emp.employmentStatus) === 'Part-Time' ||
    normalizeEmploymentType((emp as any).status) === 'Part-Time';
  const resolvedType: EmploymentType = isPt
    ? 'Part-Time'
    : normalizeEmploymentType(emp.employmentType || emp.employment_type) ||
      (emp.employmentStatus === 'PKWTT (Tetap)' ? 'Full-Time' : 'Contract');
  const resolvedStatus = isPt
    ? 'Part-Time'
    : emp.employmentStatus || (emp as any).status || 'PKWT (Kontrak)';
  const hRate = Math.max(0, Math.round(Number(emp.hourlyRate ?? emp.hourly_rate) || 0));
  const oRate = Math.max(0, Math.round(Number(emp.overtimeRate ?? emp.overtime_rate) || 0));

  try {
    const map = getSavedEmploymentMetaMap();
    const entry: PersistedEmploymentMeta = {
      employmentType: resolvedType,
      employment_type: resolvedType,
      status: resolvedStatus,
      employmentStatus: resolvedStatus,
      hourlyRate: hRate > 0 ? hRate : undefined,
      hourly_rate: hRate > 0 ? hRate : undefined,
      overtimeRate: oRate > 0 ? oRate : undefined,
      overtime_rate: oRate > 0 ? oRate : undefined,
      updatedAt: new Date().toISOString(),
    };
    if (emp.id) map[emp.id] = entry;
    if (emp.nik) map[`nik:${emp.nik.trim().toLowerCase()}`] = entry;
    localStorage.setItem(EMP_EMPLOYMENT_META_STORAGE_KEY, JSON.stringify(map));

    // Also persist to 'tgi_parttime_overrides' key as requested
    const rawOverrides = localStorage.getItem(PARTTIME_OVERRIDES_STORAGE_KEY);
    const overrides: Record<string, any> = rawOverrides ? JSON.parse(rawOverrides) : {};
    const overridePayload = {
      employment_type: resolvedType,
      employmentType: resolvedType,
      status: resolvedStatus,
      employmentStatus: resolvedStatus,
      hourly_rate: hRate > 0 ? hRate : undefined,
      hourlyRate: hRate > 0 ? hRate : undefined,
      overtime_rate: oRate > 0 ? oRate : undefined,
      overtimeRate: oRate > 0 ? oRate : undefined,
      updatedAt: new Date().toISOString(),
    };
    if (emp.id) overrides[emp.id] = overridePayload;
    if (emp.nik) overrides[`nik:${emp.nik.trim().toLowerCase()}`] = overridePayload;
    localStorage.setItem(PARTTIME_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));

    // Also update 'tgi_employees_data' in localStorage so employee state is never reset on reload or pull
    const rawEmps = localStorage.getItem('tgi_employees_data');
    if (rawEmps) {
      const parsedEmps = JSON.parse(rawEmps);
      if (Array.isArray(parsedEmps)) {
        let updated = false;
        const nextEmps = parsedEmps.map((item: any) => {
          if (!item) return item;
          const matchId = Boolean(emp.id && item.id === emp.id);
          const matchNik = Boolean(
            emp.nik &&
              item.nik &&
              String(item.nik).trim().toLowerCase() === emp.nik.trim().toLowerCase()
          );
          if (!matchId && !matchNik) return item;
          updated = true;
          const nextHourly = hRate > 0 ? hRate : Number(item.hourlyRate ?? item.hourly_rate) || 0;
          const nextOt =
            oRate > 0
              ? oRate
              : Number(item.overtimeRate ?? item.overtime_rate) || Math.round(nextHourly * 1.5);
          return {
            ...item,
            employmentType: resolvedType,
            employment_type: resolvedType,
            employmentStatus: resolvedStatus,
            status: resolvedStatus,
            hourlyRate: nextHourly > 0 ? nextHourly : item.hourlyRate,
            hourly_rate: nextHourly > 0 ? nextHourly : item.hourly_rate,
            overtimeRate: nextOt > 0 ? nextOt : item.overtimeRate,
            overtime_rate: nextOt > 0 ? nextOt : item.overtime_rate,
          };
        });
        if (updated) {
          localStorage.setItem('tgi_employees_data', JSON.stringify(nextEmps));
        }
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function applyPartTimeOverridesToEmployees(employees: Employee[]): Employee[] {
  if (!Array.isArray(employees)) return [];
  try {
    const metaMap = getSavedEmploymentMetaMap();
    const rawEmps = localStorage.getItem('tgi_employees_data');
    const savedList: any[] = rawEmps ? JSON.parse(rawEmps) : [];
    const savedById = new Map<string, any>();
    const savedByNik = new Map<string, any>();
    if (Array.isArray(savedList)) {
      for (const item of savedList) {
        if (item?.id) savedById.set(String(item.id), item);
        if (item?.nik) savedByNik.set(String(item.nik).trim().toLowerCase(), item);
      }
    }

    const rawOverrides = localStorage.getItem(PARTTIME_OVERRIDES_STORAGE_KEY);
    const overrides: Record<string, any> = rawOverrides ? JSON.parse(rawOverrides) : {};
    let overridesChanged = false;

    const merged = employees.map((emp) => {
      if (!emp) return emp;
      const nikKey = emp.nik ? `nik:${emp.nik.trim().toLowerCase()}` : '';
      const meta = metaMap[emp.id] || (nikKey ? metaMap[nikKey] : undefined);
      const savedEmp =
        savedById.get(emp.id) ||
        (emp.nik ? savedByNik.get(emp.nik.trim().toLowerCase()) : undefined);

      const isPt =
        normalizeEmploymentType(emp.employmentType) === 'Part-Time' ||
        normalizeEmploymentType(emp.employment_type) === 'Part-Time' ||
        normalizeEmploymentType(emp.employmentStatus) === 'Part-Time' ||
        normalizeEmploymentType(emp.status) === 'Part-Time' ||
        normalizeEmploymentType(meta?.employmentType) === 'Part-Time' ||
        normalizeEmploymentType(meta?.status) === 'Part-Time' ||
        normalizeEmploymentType(savedEmp?.employmentType) === 'Part-Time' ||
        normalizeEmploymentType(savedEmp?.employment_type) === 'Part-Time' ||
        normalizeEmploymentType(savedEmp?.employmentStatus) === 'Part-Time' ||
        normalizeEmploymentType(savedEmp?.status) === 'Part-Time';

      if (!isPt) return emp;

      const resolvedHourly =
        Number(emp.hourlyRate ?? emp.hourly_rate) ||
        Number(meta?.hourlyRate ?? meta?.hourly_rate) ||
        Number(savedEmp?.hourlyRate ?? savedEmp?.hourly_rate) ||
        0;
      const resolvedOvertime =
        Number(emp.overtimeRate ?? emp.overtime_rate) ||
        Number(meta?.overtimeRate ?? meta?.overtime_rate) ||
        Number(savedEmp?.overtimeRate ?? savedEmp?.overtime_rate) ||
        Math.round(resolvedHourly * 1.5);

      const overrideEntry = {
        employment_type: 'Part-Time' as const,
        employmentType: 'Part-Time' as const,
        status: 'Part-Time',
        employmentStatus: 'Part-Time',
        hourly_rate: resolvedHourly > 0 ? resolvedHourly : undefined,
        hourlyRate: resolvedHourly > 0 ? resolvedHourly : undefined,
        overtime_rate: resolvedOvertime > 0 ? resolvedOvertime : undefined,
        overtimeRate: resolvedOvertime > 0 ? resolvedOvertime : undefined,
        updatedAt: meta?.updatedAt || new Date().toISOString(),
      };
      if (emp.id && !overrides[emp.id]) {
        overrides[emp.id] = overrideEntry;
        overridesChanged = true;
      }
      if (nikKey && !overrides[nikKey]) {
        overrides[nikKey] = overrideEntry;
        overridesChanged = true;
      }

      return {
        ...emp,
        employmentType: 'Part-Time' as const,
        employment_type: 'Part-Time' as const,
        employmentStatus: 'Part-Time' as const,
        status: 'Part-Time',
        hourlyRate: resolvedHourly > 0 ? resolvedHourly : emp.hourlyRate,
        hourly_rate: resolvedHourly > 0 ? resolvedHourly : emp.hourly_rate,
        overtimeRate: resolvedOvertime > 0 ? resolvedOvertime : emp.overtimeRate,
        overtime_rate: resolvedOvertime > 0 ? resolvedOvertime : emp.overtime_rate,
      };
    });

    if (overridesChanged) {
      localStorage.setItem(PARTTIME_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    }
    return merged;
  } catch {
    return employees;
  }
}

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
  saveEmployeeEmploymentMetaLocal(emp);
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
  const explicitOvertimeRate = Number(emp.overtimeRate ?? emp.overtime_rate) || 0;
  const resolvedOvertimeRate =
    explicitOvertimeRate > 0 ? Math.round(explicitOvertimeRate) : Math.round(resolvedHourlyRate * 1.5);
  const isPartTimeStatus =
    normalizeEmploymentType(emp.employmentType) === 'Part-Time' ||
    normalizeEmploymentType(emp.employment_type) === 'Part-Time' ||
    normalizeEmploymentType(emp.employmentStatus) === 'Part-Time' ||
    normalizeEmploymentType(emp.status) === 'Part-Time';
  const resolvedEmploymentType: EmploymentType = isPartTimeStatus
    ? 'Part-Time'
    : normalizeEmploymentType(emp.employmentType || emp.employment_type) ||
      (emp.employmentStatus === 'PKWTT (Tetap)' ? 'Full-Time' : 'Contract');
  const resolvedEmploymentStatus = isPartTimeStatus
    ? 'Part-Time'
    : emp.employmentStatus || 'PKWT (Kontrak)';
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
    employment_status: resolvedEmploymentStatus,
    join_date: emp.joinDate || new Date().toISOString().split('T')[0],
    base_salary: Number(emp.baseSalary) || resolvedDailySalary * 25,
    allowances: {
      position: Number(rawAllowances.position) || 0,
      transport: Number(rawAllowances.transport) || 0,
      meal: Number(rawAllowances.meal) || 0,
      communication: Number(rawAllowances.communication) || 0,
      _hourlyRate: resolvedHourlyRate,
      _overtimeRate: resolvedOvertimeRate,
      _dailySalary: resolvedDailySalary,
      _employmentType: resolvedEmploymentType,
      _employmentStatus: resolvedEmploymentStatus,
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

  const localMeta = getEmployeeEmploymentMetaLocal(row.id, row.nik);
  const allowanceEmpType = normalizeEmploymentType(
    rawAllowances._employmentType || rawAllowances._employmentStatus
  );
  const rowEmpType = normalizeEmploymentType(
    row.employment_type ?? row.employmentType ?? row.employment_status ?? row.status
  );

  // JANGAN menimpa employment_type kembali menjadi 'Full-Time' atau status ke 'PKWT' jika di local state / allowances / DB nilainya sudah 'Part-Time'
  const isLockedPartTime =
    localMeta?.employmentType === 'Part-Time' ||
    localMeta?.status === 'Part-Time' ||
    allowanceEmpType === 'Part-Time' ||
    rowEmpType === 'Part-Time';

  const resolvedEmploymentType: EmploymentType = isLockedPartTime
    ? 'Part-Time'
    : localMeta?.employmentType ||
      allowanceEmpType ||
      rowEmpType ||
      (row.employment_status === 'PKWTT (Tetap)' ? 'Full-Time' : 'Contract');

  const resolvedEmploymentStatus = isLockedPartTime
    ? 'Part-Time'
    : (row.employment_status as any) || 'PKWT (Kontrak)';

  const baseSalary = Number(row.base_salary) || 0;
  const rawDaily =
    Number(row.daily_salary ?? rawAllowances._dailySalary) ||
    (baseSalary > 0 ? Math.round(baseSalary / 25) : 0);
  const hourlyRate =
    Number(row.hourly_rate ?? rawAllowances._hourlyRate ?? localMeta?.hourlyRate) ||
    (rawDaily > 0 ? Math.round(rawDaily / 9) : 0);
  const overtimeRate =
    Number(row.overtime_rate ?? rawAllowances._overtimeRate ?? localMeta?.overtimeRate) ||
    Math.round(hourlyRate * 1.5);
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
    employmentStatus: resolvedEmploymentStatus,
    status: resolvedEmploymentStatus,
    employmentType: resolvedEmploymentType,
    employment_type: resolvedEmploymentType,
    joinDate: row.join_date || new Date().toISOString().split('T')[0],
    baseSalary: baseSalary || dailySalary * 25,
    hourlyRate,
    hourly_rate: hourlyRate,
    overtimeRate,
    overtime_rate: overtimeRate,
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
  saveEmployeeEmploymentMetaLocal(emp);
  const isHost = Boolean(emp.is_host === true || emp.isLiveStreamHost === true);
  const isCoHost = Boolean(emp.is_co_host === true || emp.isCoHostLiveStream === true);
  const hostPct = Number(emp.host_commission_pct ?? emp.salesCommissionPercentage) || 0;
  const hostPcs = Number(emp.host_commission_per_pcs ?? emp.salesCommissionPerPcs) || 0;
  const coHostPct = Number(emp.co_host_commission_pct ?? emp.coHostCommissionPercentage) || 0;
  const coHostPcs = Number(emp.co_host_commission_per_pcs ?? emp.coHostCommissionPerPcs) || 0;
  const isPt =
    normalizeEmploymentType(emp.employmentType) === 'Part-Time' ||
    normalizeEmploymentType(emp.employment_type) === 'Part-Time' ||
    normalizeEmploymentType(emp.employmentStatus) === 'Part-Time' ||
    normalizeEmploymentType(emp.status) === 'Part-Time';
  const empType: EmploymentType = isPt
    ? 'Part-Time'
    : normalizeEmploymentType(emp.employmentType || emp.employment_type) ||
      (emp.employmentStatus === 'PKWTT (Tetap)' ? 'Full-Time' : 'Contract');
  const empStatus = isPt ? 'Part-Time' : emp.employmentStatus || 'PKWT (Kontrak)';
  const hourlyVal = Math.max(0, Math.round(Number(emp.hourlyRate ?? emp.hourly_rate) || 0));
  const overtimeVal =
    Math.max(0, Math.round(Number(emp.overtimeRate ?? emp.overtime_rate) || 0)) ||
    Math.round(hourlyVal * 1.5);

  const liveColumnsPayload = {
    is_host: isHost,
    is_co_host: isCoHost,
    host_commission_pct: hostPct,
    host_commission_per_pcs: hostPcs,
    co_host_commission_pct: coHostPct,
    co_host_commission_per_pcs: coHostPcs,
  };

  const partTimePayload = {
    ...liveColumnsPayload,
    employment_type: empType,
    hourly_rate: hourlyVal,
  };

  const extendedPayload = {
    ...partTimePayload,
    overtime_rate: overtimeVal,
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tgi_employee_live_updated', {
        detail: {
          ...emp,
          employmentStatus: empStatus,
          status: empStatus,
          employmentType: empType,
          employment_type: empType,
          hourlyRate: hourlyVal,
          hourly_rate: hourlyVal,
          overtimeRate: overtimeVal,
          overtime_rate: overtimeVal,
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

  // Also ensure allowances JSONB and employment_status in `employees` table are updated with _employmentType, _hourlyRate, _overtimeRate
  const fullDbRow = employeeToDb({
    ...emp,
    employmentStatus: empStatus as any,
    status: empStatus,
    employmentType: empType,
    employment_type: empType,
    hourlyRate: hourlyVal,
    hourly_rate: hourlyVal,
    overtimeRate: overtimeVal,
    overtime_rate: overtimeVal,
  });

  const [empUpdateRes, tgiUpsertRes] = await Promise.allSettled([
    supabase
      .from('employees')
      .update({
        ...extendedPayload,
        employment_status: empStatus,
        allowances: fullDbRow.allowances,
      })
      .eq('id', emp.id),
    supabase.from('tgi_employees').upsert(
      {
        id: emp.id,
        nik: emp.nik || null,
        full_name: emp.fullName || '',
        ...extendedPayload,
        status: empStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    ),
  ]);

  if (empUpdateRes.status === 'fulfilled' && empUpdateRes.value.error) {
    const retryPt = await supabase
      .from('employees')
      .update({ ...partTimePayload, allowances: fullDbRow.allowances })
      .eq('id', emp.id);
    if (retryPt.error) {
      await supabase
        .from('employees')
        .update({ employment_status: empStatus, allowances: fullDbRow.allowances })
        .eq('id', emp.id);
    }
  }
  if (tgiUpsertRes.status === 'fulfilled' && tgiUpsertRes.value.error) {
    const retryTgiPt = await supabase.from('tgi_employees').upsert(
      {
        id: emp.id,
        nik: emp.nik || null,
        full_name: emp.fullName || '',
        ...partTimePayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (retryTgiPt.error) {
      await supabase.from('tgi_employees').upsert(
        {
          id: emp.id,
          nik: emp.nik || null,
          full_name: emp.fullName || '',
          ...liveColumnsPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }
  }
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

    const filteredEmps = applyPartTimeOverridesToEmployees(
      allMapped.filter((emp) => !deletedIds.has(emp.id))
    );
    try {
      if (filteredEmps.length > 0) {
        localStorage.setItem('tgi_employees_data', JSON.stringify(filteredEmps));
      }
    } catch {
      // ignore storage errors
    }
    return filteredEmps;
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
  const hasIn = Boolean(att.checkIn && att.checkIn.trim() !== '' && att.checkIn !== '-');
  const hasOut = Boolean(att.checkOut && att.checkOut.trim() !== '' && att.checkOut !== '-');
  const computedWorkHours =
    hasIn && hasOut
      ? calculateActualWorkHoursFromClock(att.checkIn, att.checkOut)
      : hasIn && !hasOut
      ? 0
      : Math.max(0, Number(att.workHours) || 0);

  return {
    id: att.id,
    employee_id: att.employeeId,
    date: att.date,
    check_in: att.checkIn || '',
    check_out: att.checkOut || '',
    status: att.status || 'Hadir Tepat Waktu',
    work_hours: computedWorkHours,
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
  const checkInStr = row.check_in || '';
  const checkOutStr = row.check_out || '';
  const hasIn = Boolean(checkInStr && checkInStr.trim() !== '' && checkInStr !== '-');
  const hasOut = Boolean(checkOutStr && checkOutStr.trim() !== '' && checkOutStr !== '-');
  const computedWorkHours =
    hasIn && hasOut
      ? calculateActualWorkHoursFromClock(checkInStr, checkOutStr)
      : hasIn && !hasOut
      ? 0
      : Math.max(0, Number(row.work_hours) || 0);

  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    checkIn: checkInStr,
    checkOut: checkOutStr,
    status: row.status || 'Hadir Tepat Waktu',
    workHours: computedWorkHours,
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

// ============================================================================
// PART-TIME WEEKLY PAYROLL & SUNDAY PAYOUT SERVICES (SUPABASE + LOCAL SYNC)
// ============================================================================
export const PART_TIME_LOGS_STORAGE_KEY = 'tgi_part_time_work_logs';
export const PART_TIME_PAYOUTS_STORAGE_KEY = 'tgi_part_time_weekly_payouts';

function isEmployeePkwttOrNonPartTimeLocal(employeeId?: string, nik?: string): boolean {
  if (!employeeId && !nik) return false;
  try {
    const meta = getEmployeeEmploymentMetaLocal(employeeId, nik);
    if (meta) {
      if (meta.employmentType === 'Part-Time' || meta.status === 'Part-Time') {
        return false;
      }
      if (
        meta.employmentType === 'Full-Time' ||
        meta.employmentType === 'Contract' ||
        String(meta.status || '').toUpperCase().includes('PKWTT')
      ) {
        return true;
      }
    }
    const rawEmps = localStorage.getItem('tgi_employees_data');
    if (rawEmps) {
      const list = JSON.parse(rawEmps);
      if (Array.isArray(list)) {
        const found = list.find(
          (e: any) =>
            (employeeId && e?.id === employeeId) ||
            (nik && String(e?.nik || '').trim().toLowerCase() === nik.trim().toLowerCase())
        );
        if (found) {
          return !isEmployeePartTime(found);
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export function getSavedPartTimeLogs(): PartTimeWorkLog[] {
  try {
    const raw = localStorage.getItem(PART_TIME_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(dbToPartTimeLog)
      .filter((log) => !isEmployeePkwttOrNonPartTimeLocal(log.employeeId, log.employeeNik));
  } catch {
    return [];
  }
}

export function savePartTimeLogsLocal(logs: PartTimeWorkLog[]): void {
  try {
    localStorage.setItem(PART_TIME_LOGS_STORAGE_KEY, JSON.stringify(logs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tgi_part_time_updated'));
    }
  } catch {
    // ignore storage errors
  }
}

export function getSavedPartTimePayouts(): PartTimeWeeklyPayout[] {
  try {
    const raw = localStorage.getItem(PART_TIME_PAYOUTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePartTimePayoutsLocal(payouts: PartTimeWeeklyPayout[]): void {
  try {
    localStorage.setItem(PART_TIME_PAYOUTS_STORAGE_KEY, JSON.stringify(payouts));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tgi_part_time_updated'));
    }
  } catch {
    // ignore storage errors
  }
}

export function partTimeLogToDb(log: PartTimeWorkLog) {
  const clockIn = log.clockIn || log.clock_in || '';
  const clockOut = log.clockOut || log.clock_out || '';
  const hasIn = Boolean(clockIn && clockIn.trim() !== '' && clockIn !== '-');
  const hasOut = Boolean(clockOut && clockOut.trim() !== '' && clockOut !== '-');

  let normalHrs = 0;
  let otHrs = 0;
  let totalHrs = 0;

  if (hasIn && !hasOut) {
    // Jika clock_out belum diisi (baru Clock-In), actualHours = 0 dan daily_wage = 0
    normalHrs = 0;
    otHrs = 0;
    totalHrs = 0;
  } else if (hasIn && hasOut) {
    const actualHours = calculateActualWorkHoursFromClock(clockIn, clockOut);
    normalHrs = Number(Math.min(8, actualHours).toFixed(2));
    otHrs = Number(Math.max(0, actualHours - 8).toFixed(2));
    totalHrs = actualHours;
  } else {
    const hrs = Math.max(0, Number(log.hoursWorked ?? log.hours_worked) || 0);
    normalHrs =
      log.normalHours !== undefined || log.normal_hours !== undefined
        ? Math.max(0, Number(log.normalHours ?? log.normal_hours) || 0)
        : Math.min(8, hrs);
    otHrs =
      log.overtimeHours !== undefined || log.overtime_hours !== undefined
        ? Math.max(0, Number(log.overtimeHours ?? log.overtime_hours) || 0)
        : Math.max(0, Number((hrs - normalHrs).toFixed(2)));
    totalHrs = hrs > 0 ? hrs : Number((normalHrs + otHrs).toFixed(2));
  }

  const rate = Math.max(
    0,
    Math.round(Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) || 0)
  );
  const otRate =
    Math.max(0, Math.round(Number(log.overtimeRate ?? log.overtime_rate) || 0)) ||
    Math.round(rate * 1.5);
  const wage = Math.round(normalHrs * rate + otHrs * otRate);

  const payload: Record<string, any> = {
    employee_id: log.employeeId || log.employee_id || '',
    employee_name: log.employeeName || log.employee_name || '',
    employee_nik: log.employeeNik || null,
    department: log.department || 'Operasional',
    work_date: log.date || log.work_date || new Date().toISOString().split('T')[0],
    clock_in: clockIn || null,
    clock_out: clockOut || null,
    normal_hours: normalHrs,
    overtime_hours: otHrs,
    hours_worked: totalHrs,
    hourly_rate: rate,
    overtime_rate: otRate,
    daily_wage: wage,
    source: log.source || 'portal',
    notes: log.notes || null,
    status: log.status === 'Paid' ? 'Paid' : 'Unpaid',
    paid_at: log.paidAt || log.paid_at || null,
    weekly_payout_id: log.weeklyPayoutId || log.weekly_payout_id || null,
  };

  if (log.id && UUID_REGEX.test(log.id)) {
    payload.id = log.id;
  }

  return payload;
}

export function dbToPartTimeLog(row: any): PartTimeWorkLog {
  const clockIn = row?.clock_in || row?.clockIn || '';
  const clockOut = row?.clock_out || row?.clockOut || '';
  const hasIn = Boolean(clockIn && String(clockIn).trim() !== '' && clockIn !== '-');
  const hasOut = Boolean(clockOut && String(clockOut).trim() !== '' && clockOut !== '-');

  let normalHrs = 0;
  let otHrs = 0;
  let totalHrs = 0;

  if (hasIn && !hasOut) {
    normalHrs = 0;
    otHrs = 0;
    totalHrs = 0;
  } else if (hasIn && hasOut) {
    const actualHours = calculateActualWorkHoursFromClock(String(clockIn), String(clockOut));
    normalHrs = Number(Math.min(8, actualHours).toFixed(2));
    otHrs = Number(Math.max(0, actualHours - 8).toFixed(2));
    totalHrs = actualHours;
  } else {
    const hrs = Math.max(0, Number(row?.hours_worked ?? row?.hoursWorked) || 0);
    normalHrs =
      row?.normal_hours !== undefined || row?.normalHours !== undefined
        ? Math.max(0, Number(row?.normal_hours ?? row?.normalHours) || 0)
        : Math.min(8, hrs);
    otHrs =
      row?.overtime_hours !== undefined || row?.overtimeHours !== undefined
        ? Math.max(0, Number(row?.overtime_hours ?? row?.overtimeHours) || 0)
        : Math.max(0, Number((hrs - normalHrs).toFixed(2)));
    totalHrs = hrs > 0 ? hrs : Number((normalHrs + otHrs).toFixed(2));
  }

  const rate = Math.max(
    0,
    Math.round(Number(row?.hourly_rate ?? row?.hourlyRate ?? row?.hourlyRateSnapshot) || 0)
  );
  const otRate =
    Math.max(0, Math.round(Number(row?.overtime_rate ?? row?.overtimeRate) || 0)) ||
    Math.round(rate * 1.5);
  const wage = Math.round(normalHrs * rate + otHrs * otRate);
  const dateStr =
    typeof row?.work_date === 'string'
      ? row.work_date.slice(0, 10)
      : typeof row?.date === 'string'
      ? row.date.slice(0, 10)
      : new Date().toISOString().split('T')[0];

  return {
    id: String(row?.id || generateSessionUuid()),
    employeeId: String(row?.employee_id || row?.employeeId || ''),
    employee_id: String(row?.employee_id || row?.employeeId || ''),
    employeeName: String(row?.employee_name || row?.employeeName || ''),
    employee_name: String(row?.employee_name || row?.employeeName || ''),
    employeeNik: row?.employee_nik || row?.employeeNik || undefined,
    department: row?.department || 'Operasional',
    role: row?.role || undefined,
    date: dateStr,
    work_date: dateStr,
    clockIn: clockIn || undefined,
    clock_in: clockIn || undefined,
    clockOut: clockOut || undefined,
    clock_out: clockOut || undefined,
    normalHours: normalHrs,
    normal_hours: normalHrs,
    overtimeHours: otHrs,
    overtime_hours: otHrs,
    hoursWorked: totalHrs,
    hours_worked: totalHrs,
    hourlyRate: rate,
    hourlyRateSnapshot: rate,
    hourly_rate: rate,
    overtimeRate: otRate,
    overtime_rate: otRate,
    dailyWage: wage,
    daily_wage: wage,
    source: row?.source || undefined,
    notes: row?.notes || undefined,
    status: row?.status === 'Paid' ? 'Paid' : 'Unpaid',
    paidAt: row?.paid_at || row?.paidAt || undefined,
    paid_at: row?.paid_at || row?.paidAt || undefined,
    weeklyPayoutId: row?.weekly_payout_id || row?.weeklyPayoutId || undefined,
    weekly_payout_id: row?.weekly_payout_id || row?.weeklyPayoutId || undefined,
    createdAt: row?.created_at || row?.createdAt || new Date().toISOString(),
    created_at: row?.created_at || row?.createdAt || new Date().toISOString(),
  };
}

export function partTimePayoutToDb(payout: PartTimeWeeklyPayout) {
  const grossVal = Math.max(
    0,
    Math.round(Number(payout.grossPay ?? payout.grossSalary ?? payout.gross_pay) || 0)
  );
  return {
    id: payout.id,
    reference_number: payout.referenceNumber || `PT-SUN-${Date.now().toString().slice(-6)}`,
    employee_id: payout.employeeId,
    employee_name: payout.employeeName,
    employee_nik: payout.employeeNik || null,
    department: payout.department || 'Operasional',
    role: payout.role || 'Part-Time Staff',
    bank_name: payout.bankName || 'BCA',
    bank_account_number: payout.bankAccountNumber || '',
    bank_account_holder: payout.bankAccountHolder || payout.employeeName,
    week_start_date: payout.weekStartDate,
    week_end_date: payout.weekEndDate,
    payout_date: payout.sundayPayoutDate || payout.payoutDate || payout.weekEndDate,
    total_days_worked: Math.max(0, Math.round(Number(payout.totalDaysWorked) || 0)),
    total_hours_worked: Math.max(0, Number(payout.totalHoursWorked) || 0),
    hourly_rate: Math.max(0, Math.round(Number(payout.hourlyRate) || 0)),
    gross_salary: grossVal,
    net_payout: Math.max(0, Math.round(Number(payout.netPayout ?? grossVal) || 0)),
    status: payout.status === 'Paid' ? 'Paid' : 'Unpaid',
    paid_at: payout.paidAt || new Date().toISOString(),
    paid_by: payout.paidBy || 'Admin HR & Finance',
    payment_method: payout.paymentMethod || 'Transfer Bank',
    notes: payout.notes || null,
    log_ids: Array.isArray(payout.logIds) ? payout.logIds : [],
    created_at: payout.createdAt || new Date().toISOString(),
  };
}

export function dbToPartTimePayout(row: any): PartTimeWeeklyPayout {
  const grossVal = Math.max(
    0,
    Math.round(Number(row?.gross_salary ?? row?.grossSalary ?? row?.gross_pay ?? row?.grossPay) || 0)
  );
  const pDate = String(
    row?.payout_date || row?.payoutDate || row?.sunday_payout_date || row?.sundayPayoutDate || ''
  ).slice(0, 10);
  return {
    id: String(row?.id || `pt-pay-${Date.now()}`),
    referenceNumber: String(row?.reference_number || row?.referenceNumber || 'PT-SUN-001'),
    employeeId: String(row?.employee_id || row?.employeeId || ''),
    employeeName: String(row?.employee_name || row?.employeeName || ''),
    employeeNik: String(row?.employee_nik || row?.employeeNik || '-'),
    department: String(row?.department || 'Operasional'),
    role: String(row?.role || 'Part-Time Staff'),
    bankName: String(row?.bank_name || row?.bankName || 'BCA'),
    bankAccountNumber: String(row?.bank_account_number || row?.bankAccountNumber || '-'),
    bankAccountHolder: String(
      row?.bank_account_holder || row?.bankAccountHolder || row?.employee_name || '-'
    ),
    weekStartDate: String(row?.week_start_date || row?.weekStartDate || '').slice(0, 10),
    weekEndDate: String(row?.week_end_date || row?.weekEndDate || '').slice(0, 10),
    sundayPayoutDate: pDate,
    payoutDate: pDate,
    totalDaysWorked: Math.max(
      0,
      Math.round(Number(row?.total_days_worked ?? row?.totalDaysWorked) || 0)
    ),
    normalHoursWorked: Number(row?.normal_hours_worked ?? row?.normalHoursWorked) || undefined,
    overtimeHoursWorked: Number(row?.overtime_hours_worked ?? row?.overtimeHoursWorked) || undefined,
    totalHoursWorked: Math.max(
      0,
      Number(row?.total_hours_worked ?? row?.totalHoursWorked) || 0
    ),
    hourlyRate: Math.max(0, Math.round(Number(row?.hourly_rate ?? row?.hourlyRate) || 0)),
    overtimeRate: Number(row?.overtime_rate ?? row?.overtimeRate) || undefined,
    grossPay: grossVal,
    gross_pay: grossVal,
    grossSalary: grossVal,
    netPayout: Math.max(0, Math.round(Number(row?.net_payout ?? row?.netPayout ?? grossVal) || 0)),
    status: row?.status === 'Unpaid' ? 'Unpaid' : 'Paid',
    paidAt: row?.paid_at || row?.paidAt || undefined,
    paidBy: row?.paid_by || row?.paidBy || 'Admin HR & Finance',
    paymentMethod:
      row?.payment_method === 'Tunai / Kas Operasional'
        ? 'Tunai / Kas Operasional'
        : 'Transfer Bank',
    notes: row?.notes || undefined,
    logIds: Array.isArray(row?.log_ids)
      ? row.log_ids
      : Array.isArray(row?.logIds)
      ? row.logIds
      : [],
    createdAt: row?.created_at || row?.createdAt || new Date().toISOString(),
  };
}

export async function fetchPartTimeLogsFromSupabase(): Promise<PartTimeWorkLog[]> {
  const localLogs = getSavedPartTimeLogs();
  try {
    const [res1, res2] = await Promise.allSettled([
      supabase.from('tgi_parttime_logs').select('*').order('work_date', { ascending: false }),
      supabase.from('tgi_part_time_logs').select('*').order('work_date', { ascending: false }),
    ]);

    const rows1 =
      res1.status === 'fulfilled' && !res1.value.error && Array.isArray(res1.value.data)
        ? res1.value.data
        : [];
    const rows2 =
      res2.status === 'fulfilled' && !res2.value.error && Array.isArray(res2.value.data)
        ? res2.value.data
        : [];

    const dbLogs = [...rows1, ...rows2].map(dbToPartTimeLog);
    const mergedMap = new Map<string, PartTimeWorkLog>();
    // Deduplicate by (employeeId + date), preserving clockIn/clockOut if present in localLogs
    // and strictly excluding PKWTT (Karyawan Tetap) / non-Part-Time employees
    for (const item of [...dbLogs, ...localLogs]) {
      if (!item?.id) continue;
      if (isEmployeePkwttOrNonPartTimeLocal(item.employeeId, item.employeeNik)) continue;
      const key = `${item.employeeId}_${item.date}`;
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, item);
      } else {
        const mergedClockIn = existing.clockIn || item.clockIn;
        const mergedClockOut = existing.clockOut || item.clockOut;
        const normalized = dbToPartTimeLog({
          ...existing,
          ...item,
          id: existing.id,
          clock_in: mergedClockIn,
          clock_out: mergedClockOut,
          status: existing.status === 'Paid' || item.status === 'Paid' ? 'Paid' : 'Unpaid',
        });
        mergedMap.set(key, normalized);
      }
    }
    const merged = Array.from(mergedMap.values()).sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
    savePartTimeLogsLocal(merged);
    return merged;
  } catch {
    return localLogs;
  }
}

export async function upsertPartTimeLogToSupabase(log: PartTimeWorkLog): Promise<boolean> {
  // Guard: never record Part-Time logs or overwrite status for PKWTT (Karyawan Tetap) / non-Part-Time employees
  if (isEmployeePkwttOrNonPartTimeLocal(log?.employeeId || log?.employee_id, log?.employeeNik)) {
    return false;
  }
  // Ensure 'tgi_parttime_overrides' and 'tgi_employees_data' are updated for this Part-Time employee without resetting contract info
  if (log?.employeeId || log?.employeeNik) {
    saveEmployeeEmploymentMetaLocal({
      id: log.employeeId || log.employee_id,
      nik: log.employeeNik,
      employmentType: 'Part-Time',
      employment_type: 'Part-Time',
      employmentStatus: 'Part-Time',
      status: 'Part-Time',
      hourlyRate: Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) || undefined,
      hourly_rate: Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) || undefined,
      overtimeRate: Number(log.overtimeRate ?? log.overtime_rate) || undefined,
      overtime_rate: Number(log.overtimeRate ?? log.overtime_rate) || undefined,
    });
  }
  const normalizedLog: PartTimeWorkLog = dbToPartTimeLog({
    ...log,
    id: log.id && UUID_REGEX.test(log.id) ? log.id : generateSessionUuid(),
  });
  const current = getSavedPartTimeLogs();
  const next = [
    normalizedLog,
    ...current.filter(
      (item) =>
        item.id !== normalizedLog.id &&
        !(item.employeeId === normalizedLog.employeeId && item.date === normalizedLog.date)
    ),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  savePartTimeLogsLocal(next);

  try {
    const fullPayload = partTimeLogToDb(normalizedLog);
    const basePayload = {
      id: fullPayload.id,
      employee_id: fullPayload.employee_id,
      employee_name: fullPayload.employee_name,
      employee_nik: fullPayload.employee_nik,
      department: fullPayload.department,
      work_date: fullPayload.work_date,
      hours_worked: fullPayload.hours_worked,
      hourly_rate: fullPayload.hourly_rate,
      daily_wage: fullPayload.daily_wage,
      notes: fullPayload.notes,
      status: fullPayload.status,
      paid_at: fullPayload.paid_at,
      weekly_payout_id: fullPayload.weekly_payout_id,
    };

    const [r1, r2] = await Promise.allSettled([
      supabase.from('tgi_parttime_logs').upsert(fullPayload, { onConflict: 'id' }),
      supabase.from('tgi_part_time_logs').upsert(fullPayload, { onConflict: 'id' }),
    ]);

    if (r2.status === 'fulfilled' && r2.value.error) {
      await supabase.from('tgi_part_time_logs').upsert(basePayload, { onConflict: 'id' });
    }
    if (r1.status === 'fulfilled' && r1.value.error) {
      await supabase.from('tgi_parttime_logs').upsert(basePayload, { onConflict: 'id' });
    }
    return true;
  } catch (err) {
    console.warn('Supabase upsert parttime logs error:', err);
    return false;
  }
}

export async function deletePartTimeLogFromSupabase(logId: string): Promise<boolean> {
  if (!logId) return false;
  const current = getSavedPartTimeLogs();
  savePartTimeLogsLocal(current.filter((item) => item.id !== logId));

  try {
    await Promise.allSettled([
      supabase.from('tgi_parttime_logs').delete().eq('id', logId),
      supabase.from('tgi_part_time_logs').delete().eq('id', logId),
    ]);
    return true;
  } catch (err) {
    console.warn('Supabase delete parttime logs error:', err);
    return false;
  }
}

export async function fetchPartTimeWeeklyPayoutsFromSupabase(): Promise<PartTimeWeeklyPayout[]> {
  const localPayouts = getSavedPartTimePayouts();
  try {
    const { data, error } = await supabase
      .from('tgi_part_time_weekly_payouts')
      .select('*')
      .order('payout_date', { ascending: false });

    if (error || !Array.isArray(data)) {
      return localPayouts;
    }

    const dbPayouts = data.map(dbToPartTimePayout);
    const mergedMap = new Map<string, PartTimeWeeklyPayout>();
    for (const item of [...dbPayouts, ...localPayouts]) {
      if (item?.id) mergedMap.set(item.id, item);
    }
    const merged = Array.from(mergedMap.values()).sort((a, b) =>
      (b.payoutDate || '').localeCompare(a.payoutDate || '')
    );
    savePartTimePayoutsLocal(merged);
    return merged;
  } catch {
    return localPayouts;
  }
}

export async function markPartTimeLogsPaidInSupabase(
  logIds: string[],
  payout: PartTimeWeeklyPayout
): Promise<boolean> {
  const paidIso = payout.paidAt || new Date().toISOString();
  const idSet = new Set(logIds);

  // Update local storage logs & payouts immediately
  const currentLogs = getSavedPartTimeLogs();
  const updatedLogs = currentLogs.map((l) =>
    idSet.has(l.id)
      ? {
          ...l,
          status: 'Paid' as const,
          paidAt: paidIso,
          paid_at: paidIso,
          weeklyPayoutId: payout.id,
          weekly_payout_id: payout.id,
        }
      : l
  );
  savePartTimeLogsLocal(updatedLogs);

  const currentPayouts = getSavedPartTimePayouts();
  const updatedPayouts = [
    payout,
    ...currentPayouts.filter((p) => p.id !== payout.id),
  ];
  savePartTimePayoutsLocal(updatedPayouts);

  try {
    await Promise.allSettled([
      logIds.length > 0
        ? supabase
            .from('tgi_parttime_logs')
            .update({
              status: 'Paid',
              paid_at: paidIso,
              weekly_payout_id: payout.id,
            })
            .in('id', logIds)
        : Promise.resolve(),
      logIds.length > 0
        ? supabase
            .from('tgi_part_time_logs')
            .update({
              status: 'Paid',
              paid_at: paidIso,
              weekly_payout_id: payout.id,
            })
            .in('id', logIds)
        : Promise.resolve(),
      supabase
        .from('tgi_part_time_weekly_payouts')
        .upsert(partTimePayoutToDb(payout), { onConflict: 'id' }),
    ]);
    return true;
  } catch (err) {
    console.warn('Supabase markPartTimeLogsPaidInSupabase error:', err);
    return false;
  }
}

export async function resetPartTimeLogsPaidInSupabase(
  logIds: string[],
  employeeId?: string,
  weekStartDate?: string,
  weekEndDate?: string
): Promise<boolean> {
  const idSet = new Set(logIds);
  const currentLogs = getSavedPartTimeLogs();
  const updatedLogs = currentLogs.map((l) => {
    const matchByRange =
      employeeId &&
      l.employeeId === employeeId &&
      (!weekStartDate || l.date >= weekStartDate) &&
      (!weekEndDate || l.date <= weekEndDate);
    if (idSet.has(l.id) || matchByRange) {
      return dbToPartTimeLog({
        ...l,
        status: 'Unpaid',
        paidAt: undefined,
        paid_at: undefined,
        weeklyPayoutId: undefined,
        weekly_payout_id: undefined,
      });
    }
    return l;
  });
  savePartTimeLogsLocal(updatedLogs);

  const currentPayouts = getSavedPartTimePayouts();
  const removedPayoutIds: string[] = [];
  const remainingPayouts = currentPayouts.filter((p) => {
    const hasOverlapLog = Array.isArray(p.logIds) && p.logIds.some((lid) => idSet.has(lid));
    const matchWeek =
      employeeId &&
      p.employeeId === employeeId &&
      (!weekStartDate || p.weekStartDate === weekStartDate);
    if (hasOverlapLog || matchWeek) {
      removedPayoutIds.push(p.id);
      return false;
    }
    return true;
  });
  savePartTimePayoutsLocal(remainingPayouts);

  try {
    await Promise.allSettled([
      logIds.length > 0
        ? supabase
            .from('tgi_parttime_logs')
            .update({
              status: 'Unpaid',
              paid_at: null,
              weekly_payout_id: null,
            })
            .in('id', logIds)
        : Promise.resolve(),
      logIds.length > 0
        ? supabase
            .from('tgi_part_time_logs')
            .update({
              status: 'Unpaid',
              paid_at: null,
              weekly_payout_id: null,
            })
            .in('id', logIds)
        : Promise.resolve(),
      removedPayoutIds.length > 0
        ? supabase.from('tgi_part_time_weekly_payouts').delete().in('id', removedPayoutIds)
        : Promise.resolve(),
    ]);
    return true;
  } catch (err) {
    console.warn('Supabase resetPartTimeLogsPaidInSupabase error:', err);
    return false;
  }
}





