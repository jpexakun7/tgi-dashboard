import React, { useState, useMemo, useRef } from 'react';
import {
  User,
  WalletCards,
  CalendarDays,
  Clock,
  Receipt,
  Download,
  Printer,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  Building,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Shield,
  Lock,
  FileText,
  Upload,
  ArrowRight,
  ChevronDown,
  Info,
  Calendar,
  Check,
  Percent,
  FileCheck2,
  DollarSign,
  Briefcase,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Save,
  Users,
  Boxes,
  Wrench,
  ShieldCheck,
  Award,
  Star,
  ThumbsUp,
  Bell,
  Sparkles,
  HandCoins,
  Banknote,
  CalendarCheck2,
  Camera,
  Home,
  LayoutGrid,
  LogOut,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import {
  Employee,
  PayrollRecord,
  LeaveRequest,
  OvertimeRequest,
  ReimbursementClaim,
  CompanyConfig,
  ReimbursementCategory,
  CompanyAsset,
  PerformanceReview,
  AppNotification,
  CashAdvance,
  CashAdvanceTenorMonths,
  CashAdvanceInstallment,
  AttendanceRecord,
  PartTimeWorkLog,
  EmployeeBonus,
  EmployeeAdjustment,
  PayrollDeductionRecord,
  ThrPayoutRecord,
} from '../types';
import {
  formatCurrency,
  formatIDR,
  formatRupiah,
  formatIndoDate,
  normalizePeriodToYearMonth,
  doesEmployeeMatchPayrollDeduction,
  getOvertimeRatePerMinute,
  calculateOvertimePayByMinutes,
  getOvertimeMinutes,
  formatOvertimeMinutes,
  calculateMinutesBetweenTimes,
  getEmployeeShift,
  evaluateAttendanceAgainstShift,
  deduplicateDailyAttendances,
  calculateEmployeeAttendancePenalty,
  getAttendancePenaltyPolicy,
  formatNpwpInput,
  getNpwpStatusInfo,
  getContractValidityInfo,
  getEmployeeDailySalary,
  getEmployeeHourlyRate,
  getEmployeeStandardDailyHours,
   getApprovedOvertimeHoursForEmployeeDate,
  STANDARD_WORK_HOURS_PER_DAY,
  calculateCappedDailyWorkHours,
  calculateEmployeeLiveSalesCommission,
  doesEmployeeMatchBonus,
  getEmployeeBonusesForPeriod,
  formatYearMonthToIndo,
  getPayrollSignatoriesConfig,
  isEmployeePartTime,
  getJakartaDateString,
  getJakartaYearMonth,
  getJakartaTimeString,
  getJakartaFullDateTimeLabel,
} from '../utils/formatters';
import { OfficialPayslipDocument, computeOfficialPayslipData } from './PayslipModal';
import { formatWhatsAppPhone } from '../utils/notificationHelper';
import {
  getEmployeeEffectivePin,
  fetchEmployeeByIdFromSupabase,
  fetchLivestreamSessionsFromSupabase,
  generateSessionUuid,
  upsertPartTimeLogToSupabase,
  fetchPartTimeLogsFromSupabase,
  getSavedEmployeeBonuses,
  fetchEmployeeBonuses,
  markBonusAsRead,
  getSavedEmployeeAdjustments,
  fetchEmployeeAdjustments,
  getSavedPayrollDeductions,
  fetchPayrollDeductions,
  getSavedThrPayouts,
  fetchThrPayoutsFromSupabase,
} from '../services/supabaseService';
import {
  verifyEmployeeLoginSecure,
  updateEmployeePinSecure,
  sanitizeSafeText,
  validateNikKtp16Digits,
  isAdminSessionVerified,
} from '../services/authSecurityService';
import { supabase } from '../lib/supabase';
import { validateImageFile, compressImage, compressVideoFrame } from '../utils/imageUtils';
import { LiveFaceGpsAttendanceScanner } from './LiveFaceGpsAttendanceScanner';
import { LiveStreamSalesRecord } from '../types';
import { computeHoursFromClockInOut, getOperationalSixDayRange } from './PartTimeLogs';

interface EmployeePortalViewProps {
  currentEmployee: Employee;
  allEmployees: Employee[];
  payrollRecord?: PayrollRecord | null;
  allPayrolls: PayrollRecord[];
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  reimbursements: ReimbursementClaim[];
  assets?: CompanyAsset[];
  reviews?: PerformanceReview[];
  companyConfig: CompanyConfig;
  onApplyLeave: (req: LeaveRequest) => void;
  onApplyOvertime: (req: OvertimeRequest) => void;
  onApplyReimbursement: (claim: ReimbursementClaim) => void;
  onUpdateProfile: (emp: Employee) => void;
  onOpenPayslip: (record: PayrollRecord) => void;
  onSwitchToAdminMode?: () => void;
  onSelectEmployee?: (empId: string) => void;
  onReportAssetIssue?: (assetId: string, notes: string) => void;
  notifications?: AppNotification[];
  activePortalTabOverride?: 'home' | 'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile' | 'live_commission' | 'my_bonuses' | null;
  onOpenNotifications?: () => void;
  isAdminUnlocked?: boolean;
  onRequestAdminAccess?: () => void;
  onLockAdmin?: () => void;
  attendances?: AttendanceRecord[];
  onAddAttendance?: (att: AttendanceRecord) => void;
  partTimeLogs?: PartTimeWorkLog[];
  onSavePartTimeLog?: (log: PartTimeWorkLog) => void;
  cashAdvances?: CashAdvance[];
  onApplyCashAdvance?: (
    advanceData: Omit<
      CashAdvance,
      'id' | 'createdAt' | 'status' | 'totalPaid' | 'remainingBalance' | 'installments'
    >
  ) => void;
  employeeBonuses?: EmployeeBonus[];
  employeeAdjustments?: EmployeeAdjustment[];
  payrollDeductions?: PayrollDeductionRecord[];
  thrPayouts?: ThrPayoutRecord[];
  onMarkBonusAsRead?: (bonusId: string) => void;
}

const LEAVE_TYPES: LeaveRequest['type'][] = [
  'Cuti Tahunan',
  'Cuti Sakit',
  'Cuti Khusus (Menikah/Duka)',
  'Cuti Melahirkan',
  'Izin Pribadi',
];

const REIMBURSEMENT_CATEGORIES: ReimbursementCategory[] = [
  'Transport & Bensin',
  'Parkir & Tol',
  'Makan Lembur & Konsumsi',
  'Operasional Toko & Gudang',
  'Pengiriman & Ekspedisi',
  'Medis & Rawat Jalan',
  'Perlengkapan Kantor (ATK)',
  'Komunikasi & Pulsa',
  'Lain-lain',
];

export const EmployeePortalView: React.FC<EmployeePortalViewProps> = ({
  currentEmployee,
  allEmployees,
  payrollRecord,
  allPayrolls,
  leaveRequests,
  overtimeRequests,
  reimbursements,
  assets = [],
  reviews = [],
  companyConfig,
  onApplyLeave,
  onApplyOvertime,
  onApplyReimbursement,
  onUpdateProfile,
  onOpenPayslip,
  onSwitchToAdminMode,
  onSelectEmployee,
  onReportAssetIssue,
  notifications = [],
  activePortalTabOverride,
  onOpenNotifications,
  isAdminUnlocked = false,
  onRequestAdminAccess,
  onLockAdmin,
  attendances = [],
  onAddAttendance,
  partTimeLogs = [],
  onSavePartTimeLog,
  cashAdvances = [],
  onApplyCashAdvance,
  employeeBonuses = [],
  employeeAdjustments = [],
  payrollDeductions = [],
  thrPayouts = [],
  onMarkBonusAsRead,
}) => {
  const [activePortalTab, setActivePortalTab] = useState<'home' | 'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile' | 'live_commission' | 'my_bonuses'>('home');
  const [isMobileMenuSheetOpen, setIsMobileMenuSheetOpen] = useState(false);
  const [isSwitchProfileModalOpen, setIsSwitchProfileModalOpen] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [pendingSwitchEmp, setPendingSwitchEmp] = useState<Employee | null>(null);
  const [switchPinInput, setSwitchPinInput] = useState('');
  const [switchPinError, setSwitchPinError] = useState<string | null>(null);
  const [clockInNotes, setClockInNotes] = useState('');
  const [attendanceNotice, setAttendanceNotice] = useState<string | null>(null);
  const [previewAttendanceRecord, setPreviewAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [localCapturedAttendances, setLocalCapturedAttendances] = useState<AttendanceRecord[]>([]);
  const [syncedDbPartTimeLogs, setSyncedDbPartTimeLogs] = useState<PartTimeWorkLog[]>([]);
  const [syncedEmployeeBonuses, setSyncedEmployeeBonuses] = useState<EmployeeBonus[]>(() =>
    getSavedEmployeeBonuses()
  );
  const [syncedEmployeeAdjustments, setSyncedEmployeeAdjustments] = useState<EmployeeAdjustment[]>(
    () => getSavedEmployeeAdjustments()
  );
  const [syncedPayrollDeductions, setSyncedPayrollDeductions] = useState<PayrollDeductionRecord[]>(
    () => getSavedPayrollDeductions()
  );
  const [syncedThrPayouts, setSyncedThrPayouts] = useState<ThrPayoutRecord[]>(
    () => getSavedThrPayouts()
  );

  // Kasbon (Cash Advance) Form State
  const [isCashAdvanceModalOpen, setIsCashAdvanceModalOpen] = useState(false);
  const [cashAdvanceAmount, setCashAdvanceAmount] = useState<number>(1500000);
  const [cashAdvanceTenor, setCashAdvanceTenor] = useState<CashAdvanceTenorMonths>(3);
  const [cashAdvanceReason, setCashAdvanceReason] = useState('');
  const [cashAdvanceError, setCashAdvanceError] = useState<string | null>(null);
  const [cashAdvanceSuccessMsg, setCashAdvanceSuccessMsg] = useState<string | null>(null);

  // Real-time synced profile & live sessions from Supabase / Admin Role Updates
  const [liveSyncedEmployee, setLiveSyncedEmployee] = useState<Partial<Employee> | null>(null);
  const [liveSyncedSessions, setLiveSyncedSessions] = useState<LiveStreamSalesRecord[]>([]);

  React.useEffect(() => {
    setLiveSyncedEmployee(null);
    setLiveSyncedSessions([]);
    setLocalCapturedAttendances([]);
    setSyncedEmployeeBonuses(getSavedEmployeeBonuses());
    setSyncedEmployeeAdjustments(getSavedEmployeeAdjustments());
    setSyncedPayrollDeductions(getSavedPayrollDeductions());
    setSyncedThrPayouts(getSavedThrPayouts());
  }, [currentEmployee.id]);

  React.useEffect(() => {
    if (!currentEmployee?.id) return;
    let isMounted = true;

    const refreshLiveRoleAndSessions = async () => {
      const [dbEmp, dbSessions, dbBonuses, dbAdjustments, dbDeductions, dbThr] = await Promise.all([
        fetchEmployeeByIdFromSupabase(currentEmployee.id),
        fetchLivestreamSessionsFromSupabase(
          currentEmployee.id,
          companyConfig.currentPayrollPeriod
        ),
        fetchEmployeeBonuses(),
        fetchEmployeeAdjustments(),
        fetchPayrollDeductions(),
        fetchThrPayoutsFromSupabase(),
      ]);
      if (!isMounted) return;
      if (dbEmp) {
        setLiveSyncedEmployee(dbEmp);
      }
      if (Array.isArray(dbSessions)) {
        setLiveSyncedSessions(dbSessions);
      }
      if (Array.isArray(dbBonuses)) {
        setSyncedEmployeeBonuses(dbBonuses);
      }
      if (Array.isArray(dbAdjustments)) {
        setSyncedEmployeeAdjustments(dbAdjustments);
      }
      if (Array.isArray(dbDeductions)) {
        setSyncedPayrollDeductions(dbDeductions);
      }
      if (Array.isArray(dbThr)) {
        setSyncedThrPayouts(dbThr);
      }
    };

    refreshLiveRoleAndSessions();

    const handleLiveUpdated = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv?.detail?.id === currentEmployee.id) {
        setLiveSyncedEmployee((prev) => ({ ...(prev || {}), ...customEv.detail }));
      }
      refreshLiveRoleAndSessions();
    };

    const handleBonusesUpdated = () => {
      setSyncedEmployeeBonuses(getSavedEmployeeBonuses());
    };

    const handleAdjustmentsUpdated = () => {
      setSyncedEmployeeAdjustments(getSavedEmployeeAdjustments());
    };

    const handleDeductionsUpdated = () => {
      setSyncedPayrollDeductions(getSavedPayrollDeductions());
    };

    const handleThrUpdated = () => {
      setSyncedThrPayouts(getSavedThrPayouts());
    };

    const handleStorageOrFocus = () => {
      setSyncedEmployeeBonuses(getSavedEmployeeBonuses());
      setSyncedEmployeeAdjustments(getSavedEmployeeAdjustments());
      setSyncedPayrollDeductions(getSavedPayrollDeductions());
      setSyncedThrPayouts(getSavedThrPayouts());
      refreshLiveRoleAndSessions();
    };

    window.addEventListener('tgi_employee_live_updated', handleLiveUpdated);
    window.addEventListener('tgi_livestream_sessions_updated', handleLiveUpdated);
    window.addEventListener('tgi_employee_bonuses_updated', handleBonusesUpdated);
    window.addEventListener('tgi_employee_adjustments_updated', handleAdjustmentsUpdated);
    window.addEventListener('tgi_payroll_deductions_updated', handleDeductionsUpdated);
    window.addEventListener('tgi_thr_payouts_updated', handleThrUpdated);
    window.addEventListener('storage', handleStorageOrFocus);
    window.addEventListener('focus', handleStorageOrFocus);

    const channel = supabase
      .channel(`tgi-portal-live-${currentEmployee.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees', filter: `id=eq.${currentEmployee.id}` },
        () => refreshLiveRoleAndSessions()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tgi_employees', filter: `id=eq.${currentEmployee.id}` },
        () => refreshLiveRoleAndSessions()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tgi_livestream_sessions',
          filter: `employee_id=eq.${currentEmployee.id}`,
        },
        () => refreshLiveRoleAndSessions()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tgi_thr_payouts',
        },
        () => refreshLiveRoleAndSessions()
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener('tgi_employee_live_updated', handleLiveUpdated);
      window.removeEventListener('tgi_livestream_sessions_updated', handleLiveUpdated);
      window.removeEventListener('tgi_employee_bonuses_updated', handleBonusesUpdated);
      window.removeEventListener('tgi_employee_adjustments_updated', handleAdjustmentsUpdated);
      window.removeEventListener('tgi_payroll_deductions_updated', handleDeductionsUpdated);
      window.removeEventListener('tgi_thr_payouts_updated', handleThrUpdated);
      window.removeEventListener('storage', handleStorageOrFocus);
      window.removeEventListener('focus', handleStorageOrFocus);
      supabase.removeChannel(channel);
    };
  }, [currentEmployee.id, companyConfig.currentPayrollPeriod]);

  const effectivePortalEmployee = useMemo<Employee>(() => {
    const mergedLogsMap = new Map<string, LiveStreamSalesRecord>();
    const propLogs = Array.isArray(currentEmployee.liveStreamSalesLogs)
      ? currentEmployee.liveStreamSalesLogs
      : [];
    const syncedEmpLogs = Array.isArray(liveSyncedEmployee?.liveStreamSalesLogs)
      ? liveSyncedEmployee!.liveStreamSalesLogs!
      : [];
    for (const s of [...liveSyncedSessions, ...syncedEmpLogs, ...propLogs]) {
      if (s?.id) mergedLogsMap.set(s.id, s);
    }

    const resolvedHost = Boolean(
      liveSyncedEmployee?.is_host ??
        liveSyncedEmployee?.isLiveStreamHost ??
        currentEmployee.is_host ??
        currentEmployee.isLiveStreamHost
    );
    const resolvedCoHost = Boolean(
      liveSyncedEmployee?.is_co_host ??
        liveSyncedEmployee?.isCoHostLiveStream ??
        currentEmployee.is_co_host ??
        currentEmployee.isCoHostLiveStream
    );

    return {
      ...currentEmployee,
      ...(liveSyncedEmployee || {}),
      id: currentEmployee.id,
      isLiveStreamHost: resolvedHost,
      is_host: resolvedHost,
      isCoHostLiveStream: resolvedCoHost,
      is_co_host: resolvedCoHost,
      salesCommissionPercentage:
        Number(
          liveSyncedEmployee?.salesCommissionPercentage ??
            liveSyncedEmployee?.host_commission_pct ??
            currentEmployee.salesCommissionPercentage ??
            currentEmployee.host_commission_pct
        ) || 0,
      salesCommissionPerPcs:
        Number(
          liveSyncedEmployee?.salesCommissionPerPcs ??
            liveSyncedEmployee?.host_commission_per_pcs ??
            currentEmployee.salesCommissionPerPcs ??
            currentEmployee.host_commission_per_pcs
        ) || 0,
      coHostCommissionPercentage:
        Number(
          liveSyncedEmployee?.coHostCommissionPercentage ??
            liveSyncedEmployee?.co_host_commission_pct ??
            currentEmployee.coHostCommissionPercentage ??
            currentEmployee.co_host_commission_pct
        ) || 0,
      coHostCommissionPerPcs:
        Number(
          liveSyncedEmployee?.coHostCommissionPerPcs ??
            liveSyncedEmployee?.co_host_commission_per_pcs ??
            currentEmployee.coHostCommissionPerPcs ??
            currentEmployee.co_host_commission_per_pcs
        ) || 0,
      liveStreamSalesLogs: Array.from(mergedLogsMap.values()),
    };
  }, [currentEmployee, liveSyncedEmployee, liveSyncedSessions]);

  // Validasi Peran (Role) Live Streaming Karyawan: is_host (Host Live Stream) & is_co_host (Co-Host Live Stream)
  const is_host = Boolean(
    effectivePortalEmployee.is_host === true || effectivePortalEmployee.isLiveStreamHost === true
  );
  const is_co_host = Boolean(
    effectivePortalEmployee.is_co_host === true ||
      effectivePortalEmployee.isCoHostLiveStream === true
  );
  const canAccessLiveCommissionPanel = is_host === true || is_co_host === true;

  // Sync tab if commanded by notification navigation (dan cegah akses tab live_commission bagi non-Host/Co-Host)
  React.useEffect(() => {
    if (activePortalTabOverride) {
      if (activePortalTabOverride === 'live_commission' && !canAccessLiveCommissionPanel) {
        setActivePortalTab('home');
      } else {
        setActivePortalTab(activePortalTabOverride);
      }
    }
  }, [activePortalTabOverride, canAccessLiveCommissionPanel]);

  React.useEffect(() => {
    if (!canAccessLiveCommissionPanel && activePortalTab === 'live_commission') {
      setActivePortalTab('home');
    }
  }, [canAccessLiveCommissionPanel, activePortalTab]);

  // Personal Attendances & Shift Schedule
  const myShift = useMemo(
    () => getEmployeeShift(currentEmployee, companyConfig.workShifts),
    [currentEmployee, companyConfig.workShifts]
  );

  const [useCustomClockTime, setUseCustomClockTime] = useState(false);
  const [customClockInTime, setCustomClockInTime] = useState(myShift.checkInTime);
  const [customClockOutTime, setCustomClockOutTime] = useState(myShift.checkOutTime);

  // Pastikan mode simulasi jam manual selalu nonaktif jika bukan Admin yang membuka kunci
  React.useEffect(() => {
    if (!isAdminUnlocked && useCustomClockTime) {
      setUseCustomClockTime(false);
    }
  }, [isAdminUnlocked, useCustomClockTime]);

  const isAdminSimulationActive = isAdminUnlocked && useCustomClockTime;

  React.useEffect(() => {
    setCustomClockInTime(myShift.checkInTime);
    setCustomClockOutTime(myShift.checkOutTime);
  }, [myShift.id, myShift.checkInTime, myShift.checkOutTime]);

  const penaltyPolicy = useMemo(
    () => getAttendancePenaltyPolicy(companyConfig.attendancePenaltyPolicy),
    [companyConfig.attendancePenaltyPolicy]
  );

  // Deteksi Karyawan Part-Time (`employment_type === 'Part-Time'`) & Pengaturan Tarif Normal + Lembur
  const isPartTimeEmployee = useMemo(
    () => isEmployeePartTime(effectivePortalEmployee),
    [effectivePortalEmployee]
  );

  const myStandardDailyHours = useMemo(
    () => getEmployeeStandardDailyHours(effectivePortalEmployee, STANDARD_WORK_HOURS_PER_DAY),
    [effectivePortalEmployee]
  );

  const myPartTimeHourlyRate = useMemo(() => {
    return (
      Number(effectivePortalEmployee.hourlyRate ?? effectivePortalEmployee.hourly_rate) ||
      getEmployeeHourlyRate(effectivePortalEmployee, myStandardDailyHours, 25)
    );
  }, [effectivePortalEmployee, myStandardDailyHours]);

  const myPartTimeOvertimeRate = useMemo(() => {
    return (
      Number(effectivePortalEmployee.overtimeRate ?? effectivePortalEmployee.overtime_rate) ||
      Math.round(myPartTimeHourlyRate * 1.5)
    );
  }, [effectivePortalEmployee, myPartTimeHourlyRate]);

  // Fetch & sync `tgi_parttime_logs` from Supabase for this employee
  React.useEffect(() => {
    if (!currentEmployee?.id || !isPartTimeEmployee) return;
    let mounted = true;
    const loadPtLogs = async () => {
      const dbLogs = await fetchPartTimeLogsFromSupabase();
      if (mounted && Array.isArray(dbLogs)) {
        setSyncedDbPartTimeLogs(dbLogs.filter((l) => l.employeeId === currentEmployee.id));
      }
    };
    loadPtLogs();
    const handlePtUpdated = () => {
      loadPtLogs();
    };
    window.addEventListener('tgi_part_time_logs_updated', handlePtUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('tgi_part_time_logs_updated', handlePtUpdated);
    };
  }, [currentEmployee.id, isPartTimeEmployee]);

  const myPartTimeLogs = useMemo<PartTimeWorkLog[]>(() => {
    const map = new Map<string, PartTimeWorkLog>();
    const propList = Array.isArray(partTimeLogs)
      ? partTimeLogs.filter((l) => l && l.employeeId === currentEmployee.id)
      : [];
    for (const l of [...syncedDbPartTimeLogs, ...propList]) {
      if (l?.date) {
        map.set(`${l.employeeId}_${l.date}`, l);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [partTimeLogs, syncedDbPartTimeLogs, currentEmployee.id]);

  // Gabungkan presensi Kamera & GPS (lokal real-time + prop attendances) serta log Part-Time jika ada
  const myAttendances = useMemo(() => {
    const byDate = new Map<string, AttendanceRecord>();
    const propAtts = attendances.filter((a) => a.employeeId === currentEmployee.id);

    // 1. Jika Part-Time memiliki log historis di tgi_parttime_logs yang belum ada di attendances, jembatani sebagai fallback
    if (isPartTimeEmployee) {
      for (const ptLog of myPartTimeLogs) {
        const cIn = (ptLog.clockIn || ptLog.clock_in || '').trim();
        const cOut = (ptLog.clockOut || ptLog.clock_out || '').trim();
        if (!ptLog.date || !cIn || cIn === '-') continue;
        const capped = calculateCappedDailyWorkHours(
          cIn,
          cOut,
          Number(ptLog.hoursWorked ?? ptLog.hours_worked) || 0,
          myStandardDailyHours
        );
        byDate.set(ptLog.date, {
          id: `att-pt-${ptLog.id}`,
          employeeId: currentEmployee.id,
          date: ptLog.date,
          checkIn: cIn,
          checkOut: cOut && cOut !== '-' ? cOut : '',
          status: 'Hadir Tepat Waktu',
          lateMinutes: 0,
          workHours: capped.cappedWorkHours,
          shiftId: myShift.id,
          shiftName: myShift.name,
          scheduledCheckIn: myShift.checkInTime,
          scheduledCheckOut: myShift.checkOutTime,
          locationAddress: myShift.location || companyConfig.address,
          notes: ptLog.notes || 'Presensi Part-Time',
        });
      }
    }

    // 2. Timpa dengan catatan presensi Kamera & GPS dari prop attendances (prioritas utama lengkap dengan foto wajah & koordinat GPS)
    for (const att of propAtts) {
      if (!att?.date) continue;
      const prev = byDate.get(att.date);
      byDate.set(att.date, prev ? { ...prev, ...att } : att);
    }

    // 3. Timpa dengan jepretan Kamera & GPS terbaru pada sesi ini (optimistic real-time update)
    for (const localAtt of localCapturedAttendances) {
      if (!localAtt?.date || localAtt.employeeId !== currentEmployee.id) continue;
      const prev = byDate.get(localAtt.date);
      byDate.set(
        localAtt.date,
        prev
          ? {
              ...prev,
              ...localAtt,
              checkIn: localAtt.checkIn || prev.checkIn,
              checkOut: localAtt.checkOut || prev.checkOut,
              facePhotoSnapshot: localAtt.facePhotoSnapshot || prev.facePhotoSnapshot,
              checkOutPhotoSnapshot:
                localAtt.checkOutPhotoSnapshot || prev.checkOutPhotoSnapshot,
              locationCoords: localAtt.locationCoords || prev.locationCoords,
              locationAddress: localAtt.locationAddress || prev.locationAddress,
              checkOutLocationCoords:
                localAtt.checkOutLocationCoords || prev.checkOutLocationCoords,
              checkOutLocationAddress:
                localAtt.checkOutLocationAddress || prev.checkOutLocationAddress,
            }
          : localAtt
      );
    }

    return deduplicateDailyAttendances(
      Array.from(byDate.values()),
      [effectivePortalEmployee],
      companyConfig.workShifts,
      penaltyPolicy
    );
  }, [
    attendances,
    localCapturedAttendances,
    myPartTimeLogs,
    isPartTimeEmployee,
    currentEmployee.id,
    effectivePortalEmployee,
    myShift,
    companyConfig.address,
    companyConfig.workShifts,
    penaltyPolicy,
  ]);

  const myPenaltySummary = useMemo(
    () =>
      calculateEmployeeAttendancePenalty(
        effectivePortalEmployee,
        myAttendances,
        companyConfig.workShifts,
        penaltyPolicy
      ),
    [effectivePortalEmployee, myAttendances, companyConfig.workShifts, penaltyPolicy]
  );

  // Real-time ticking clock in Asia/Jakarta (WIB)
  const [portalWibNow, setPortalWibNow] = useState<Date>(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => {
      setPortalWibNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const portalLiveClockLabel = useMemo(
    () => getJakartaFullDateTimeLabel(portalWibNow, true),
    [portalWibNow]
  );

  const todayDateStr = useMemo(() => getJakartaDateString(portalWibNow), [portalWibNow]);
  const todayAttendance = useMemo(() => {
    return myAttendances.find((a) => a.date === todayDateStr);
  }, [myAttendances, todayDateStr]);

  const todayPartTimeLog = useMemo(() => {
    return myPartTimeLogs.find((l) => l.date === todayDateStr) || null;
  }, [myPartTimeLogs, todayDateStr]);

  // Helper: Catat atau perbarui baris `tgi_parttime_logs` secara otomatis saat karyawan Part-Time melakukan Absen Kamera Wajah & GPS
  const syncPartTimeAttendanceRecord = async (params: {
    date: string;
    clockIn: string;
    clockOut?: string;
    notes?: string;
  }) => {
    const cleanIn = (
      params.clockIn ||
      todayAttendance?.checkIn ||
      todayPartTimeLog?.clockIn ||
      ''
    ).trim();
    const cleanOut = (
      params.clockOut !== undefined
        ? params.clockOut
        : todayAttendance?.checkOut || todayPartTimeLog?.clockOut || ''
    ).trim();

    const hasValidIn = Boolean(cleanIn && cleanIn !== '-' && cleanIn.includes(':'));
    const hasValidOut = Boolean(
      cleanOut && cleanOut !== '-' && cleanOut.includes(':') && cleanIn !== cleanOut
    );

    const approvedOtForDate = getApprovedOvertimeHoursForEmployeeDate(
      currentEmployee.id,
      params.date,
      myOvertimeRequests
    );

    const computed =
      hasValidIn && hasValidOut
        ? computeHoursFromClockInOut(
            cleanIn,
            cleanOut,
            myStandardDailyHours,
            approvedOtForDate,
            params.date
          )
        : {
            totalHours: 0,
            normalHours: 0,
            overtimeHours: 0,
          };

    const dailyWage = Math.round(
      computed.normalHours * myPartTimeHourlyRate +
        computed.overtimeHours * myPartTimeOvertimeRate
    );

    const logEntry: PartTimeWorkLog = {
      id: todayPartTimeLog?.id || generateSessionUuid(),
      employeeId: currentEmployee.id,
      employee_id: currentEmployee.id,
      employeeName: currentEmployee.fullName,
      employee_name: currentEmployee.fullName,
      date: params.date,
      clockIn: cleanIn,
      clock_in: cleanIn,
      clockOut: hasValidOut ? cleanOut : '',
      clock_out: hasValidOut ? cleanOut : '',
      normalHours: computed.normalHours,
      normal_hours: computed.normalHours,
      overtimeHours: computed.overtimeHours,
      overtime_hours: computed.overtimeHours,
      hoursWorked: computed.totalHours,
      hours_worked: computed.totalHours,
      hourlyRateSnapshot: myPartTimeHourlyRate,
      hourlyRate: myPartTimeHourlyRate,
      hourly_rate: myPartTimeHourlyRate,
      overtimeRate: myPartTimeOvertimeRate,
      overtime_rate: myPartTimeOvertimeRate,
      dailyWage,
      daily_wage: dailyWage,
      notes:
        params.notes ||
        todayPartTimeLog?.notes ||
        `Absen Kamera Wajah & GPS Part-Time (${cleanIn}${hasValidOut ? ` - ${cleanOut}` : ''})`,
      source: 'portal',
      status: todayPartTimeLog?.status === 'Paid' ? 'Paid' : 'Unpaid',
    };

    onSavePartTimeLog?.(logEntry);
    setSyncedDbPartTimeLogs((prev) => [
      logEntry,
      ...prev.filter((l) => l.id !== logEntry.id && l.date !== logEntry.date),
    ]);
    await upsertPartTimeLogToSupabase(logEntry);
    return logEntry;
  };

  const shiftEvalPreview = useMemo(() => {
    const nowStr = getJakartaTimeString(portalWibNow, false);
    const targetIn = isAdminSimulationActive ? customClockInTime : todayAttendance?.checkIn || nowStr;
    const targetOut = isAdminSimulationActive ? customClockOutTime : todayAttendance?.checkOut || myShift.checkOutTime;
    const effectiveGrace = penaltyPolicy.useShiftGracePeriod
      ? myShift.gracePeriodMinutes
      : penaltyPolicy.gracePeriodMinutes;
    return evaluateAttendanceAgainstShift(
      targetIn,
      targetOut,
      myShift,
      effectiveGrace,
      myStandardDailyHours
    );
  }, [
    portalWibNow,
    isAdminSimulationActive,
    customClockInTime,
    customClockOutTime,
    todayAttendance,
    myShift,
    penaltyPolicy,
    myStandardDailyHours,
  ]);

  // Count unread performance / bonus notifications for this employee
  const unreadKpiNotifs = useMemo(() => {
    return notifications.filter(
      (n) =>
        !n.isRead &&
        ((n.recipientType === 'employee' && n.recipientEmployeeId === currentEmployee.id) || n.recipientType === 'all')
    );
  }, [notifications, currentEmployee.id]);

  // Filter personal data
  const myReviews = useMemo(
    () => reviews.filter((r) => r.employeeId === currentEmployee.id),
    [reviews, currentEmployee.id]
  );

  const myLeaveRequests = useMemo(
    () => leaveRequests.filter((l) => l.employeeId === currentEmployee.id),
    [leaveRequests, currentEmployee.id]
  );

  const myOvertimeRequests = useMemo(
    () => overtimeRequests.filter((o) => o.employeeId === currentEmployee.id),
    [overtimeRequests, currentEmployee.id]
  );

  const myReimbursements = useMemo(
    () => reimbursements.filter((r) => r.employeeId === currentEmployee.id),
    [reimbursements, currentEmployee.id]
  );

  const myAssets = useMemo(
    () => assets.filter((a) => a.assignedToEmployeeId === currentEmployee.id),
    [assets, currentEmployee.id]
  );

  const myCashAdvances = useMemo(
    () => cashAdvances.filter((ca) => ca.employeeId === currentEmployee.id),
    [cashAdvances, currentEmployee.id]
  );

  const activeCashAdvanceBalance = useMemo(
    () =>
      myCashAdvances
        .filter((ca) => ca.status === 'disbursed' || ca.status === 'approved')
        .reduce((sum, ca) => sum + ca.remainingBalance, 0),
    [myCashAdvances]
  );

  const maxCashAdvancePlafon = currentEmployee.baseSalary;

  const handleSubmitCashAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    setCashAdvanceError(null);

    if (cashAdvanceAmount <= 0) {
      setCashAdvanceError('Nominal pengajuan kasbon harus lebih dari Rp 0.');
      return;
    }
    if (cashAdvanceAmount > maxCashAdvancePlafon) {
      setCashAdvanceError(
        `Nominal kasbon melebihi plafon maksimum gaji pokok Anda (${formatRupiah(maxCashAdvancePlafon)}).`
      );
      return;
    }
    if (!cashAdvanceReason.trim()) {
      setCashAdvanceError('Mohon isi alasan atau keperluan pengajuan kasbon.');
      return;
    }

    if (onApplyCashAdvance) {
      onApplyCashAdvance({
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.fullName,
        employeeNik: currentEmployee.nik,
        department: currentEmployee.department,
        position: currentEmployee.role,
        baseSalary: currentEmployee.baseSalary,
        maxAllowedAmount: maxCashAdvancePlafon,
        amount: cashAdvanceAmount,
        reason: cashAdvanceReason.trim(),
        tenorMonths: cashAdvanceTenor,
        monthlyInstallment: Math.round(cashAdvanceAmount / cashAdvanceTenor),
      });
    }

    setIsCashAdvanceModalOpen(false);
    setCashAdvanceReason('');
    setCashAdvanceSuccessMsg(
      `Pengajuan kasbon sebesar ${formatRupiah(cashAdvanceAmount)} (Tenor ${cashAdvanceTenor} bulan) berhasil dikirim ke Panel Admin HR & Finance!`
    );
    setTimeout(() => setCashAdvanceSuccessMsg(null), 5000);
  };

  // Leave Form State (with Evidence Photo Upload)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState(() => ({
    type: 'Cuti Tahunan' as LeaveRequest['type'],
    startDate: getJakartaDateString(),
    endDate: getJakartaDateString(),
    reason: '',
    attachmentUrl: '',
    attachmentName: '',
  }));
  const [isCompressingLeavePhoto, setIsCompressingLeavePhoto] = useState(false);

  const handleUploadLeaveAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLeaveError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setLeaveError(validation.error || 'Format gambar bukti tidak didukung.');
      return;
    }
    try {
      setIsCompressingLeavePhoto(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      setLeaveForm((prev) => ({
        ...prev,
        attachmentUrl: compressedDataUrl,
        attachmentName: file.name || 'Bukti_Cuti_Izin.jpg',
      }));
    } catch (err: any) {
      setLeaveError(err?.message || 'Gagal mengompresi gambar bukti cuti/izin.');
    } finally {
      setIsCompressingLeavePhoto(false);
    }
  };

  // Calculate days for leave form
  const calculatedLeaveDays = useMemo(() => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 1;
    const start = new Date(`${leaveForm.startDate}T00:00:00+07:00`);
    const end = new Date(`${leaveForm.endDate}T00:00:00+07:00`);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [leaveForm.startDate, leaveForm.endDate]);

  // Overtime Form State (Hitungan Per Menit)
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState(() => ({
    date: getJakartaDateString(),
    minutes: 90,
    startTime: '17:30',
    endTime: '19:00',
    taskDescription: '',
  }));

  const myOvertimeRatePerMinute = useMemo(() => {
    return getOvertimeRatePerMinute(currentEmployee, companyConfig.defaultOvertimeMultiplier || 1.5);
  }, [currentEmployee, companyConfig.defaultOvertimeMultiplier]);

  // Calculate estimated overtime pay per minute: ((Base Salary + Position Allowance) / 173 / 60) * 1.5 * minutes
  const estimatedOvertimePay = useMemo(() => {
    return calculateOvertimePayByMinutes(
      currentEmployee,
      overtimeForm.minutes || 0,
      companyConfig.defaultOvertimeMultiplier || 1.5
    );
  }, [currentEmployee, overtimeForm.minutes, companyConfig.defaultOvertimeMultiplier]);

  const handleOvertimeTimeRangeChange = (newStart: string, newEnd: string) => {
    const diffMins = calculateMinutesBetweenTimes(newStart, newEnd);
    setOvertimeForm((prev) => ({
      ...prev,
      startTime: newStart,
      endTime: newEnd,
      minutes: diffMins > 0 ? diffMins : prev.minutes,
    }));
  };

  // Reimbursement Form State
  const [isReimbursementModalOpen, setIsReimbursementModalOpen] = useState(false);
  const [reimbursementForm, setReimbursementForm] = useState<{
    category: ReimbursementCategory;
    amount: number;
    description: string;
    receiptFileName: string;
    paymentMethod: 'Transfer Bank' | 'Kas Kecil (Petty Cash)';
    receiptPhotoUrl: string;
  }>({
    category: 'Transport & Bensin',
    amount: 150000,
    description: '',
    receiptFileName: '',
    paymentMethod: 'Transfer Bank',
    receiptPhotoUrl: '',
  });

  // Claims sub-tab: 'overtime' | 'reimbursement'
  const [claimsSubTab, setClaimsSubTab] = useState<'overtime' | 'reimbursement'>('overtime');

  // Profile Edit State (Tanpa Foto KTP, Cukup NIK KTP 16 Digit + Nomor NPWP)
  const [profileForm, setProfileForm] = useState({
    phone: currentEmployee.phone,
    email: currentEmployee.email,
    googleEmail: currentEmployee.googleEmail || currentEmployee.email,
    address: currentEmployee.address || '',
    bankName: currentEmployee.bankName,
    bankAccountNumber: currentEmployee.bankAccountNumber,
    bankAccountHolder: currentEmployee.bankAccountHolder,
    emergencyName: currentEmployee.emergencyContact?.name || '',
    emergencyRelation: currentEmployee.emergencyContact?.relation || '',
    emergencyPhone: currentEmployee.emergencyContact?.phone || '',
    avatarUrl: currentEmployee.avatarUrl || '',
    ktpNumber: currentEmployee.ktpNumber || '',
    npwp: currentEmployee.npwp || '',
  });

  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);
  const [profileUploadBanner, setProfileUploadBanner] = useState<string | null>(null);
  const [profileUploadError, setProfileUploadError] = useState<string | null>(null);
  const [isProcessingProfilePhoto, setIsProcessingProfilePhoto] = useState(false);
  const [previewDocumentModal, setPreviewDocumentModal] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    downloadFileName?: string;
  } | null>(null);

  // Camera state for Profile Photo inside Panel Profil & Bank
  const [activeDocCameraMode, setActiveDocCameraMode] = useState<'profile' | null>(null);
  const docCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const docCameraStreamRef = useRef<MediaStream | null>(null);

  const stopDocCamera = () => {
    if (docCameraStreamRef.current) {
      docCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      docCameraStreamRef.current = null;
    }
    setActiveDocCameraMode(null);
  };

  React.useEffect(() => {
    return () => {
      stopDocCamera();
    };
  }, []);

  const startDocCamera = async (_mode: 'profile' = 'profile') => {
    setProfileUploadError(null);
    stopDocCamera();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setProfileUploadError('Browser perangkat Anda tidak mendukung akses kamera langsung.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
      });
      docCameraStreamRef.current = stream;
      setActiveDocCameraMode('profile');
      setTimeout(() => {
        if (docCameraVideoRef.current) {
          docCameraVideoRef.current.srcObject = stream;
          docCameraVideoRef.current.play().catch(console.error);
        }
      }, 120);
    } catch (err) {
      console.error('Camera access error:', err);
      setProfileUploadError(
        'Gagal membuka kamera. Pastikan izin kamera telah diaktifkan atau gunakan tombol Upload File Gambar.'
      );
      setActiveDocCameraMode(null);
    }
  };

  const captureDocCameraPhoto = () => {
    if (!docCameraVideoRef.current || !activeDocCameraMode) return;
    const video = docCameraVideoRef.current;

    // Otomatis kompres gambar kamera maksimal lebar 800px, format JPEG kualitas 0.8
    const dataUrl = compressVideoFrame(video, 800, 800, 0.8, true);
    if (!dataUrl) return;

    const nowTimestamp = getJakartaFullDateTimeLabel(new Date(), false).compactLabel;

    const cleanNikKtp = (profileForm.ktpNumber || '').replace(/\D/g, '').trim();
    const validNikKtp = /^\d{16}$/.test(cleanNikKtp) ? cleanNikKtp : currentEmployee.ktpNumber;

    setProfileForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
    const updatedEmp: Employee = {
      ...currentEmployee,
      phone: profileForm.phone,
      email: profileForm.email,
      googleEmail: profileForm.googleEmail,
      address: profileForm.address,
      bankName: profileForm.bankName,
      bankAccountNumber: profileForm.bankAccountNumber,
      bankAccountHolder: profileForm.bankAccountHolder,
      avatarUrl: dataUrl,
      facePhotoUrl: dataUrl,
      profilePhotoUpdatedAt: nowTimestamp,
      ktpNumber: validNikKtp,
      npwp: profileForm.npwp.trim() || currentEmployee.npwp,
      emergencyContact: {
        name: profileForm.emergencyName,
        relation: profileForm.emergencyRelation,
        phone: profileForm.emergencyPhone,
      },
    };
    onUpdateProfile(updatedEmp);
    setProfileUploadBanner(
      'Foto Profil (JPEG 800px) berhasil dijepret & langsung terintegrasi real-time ke Header, Direktori Admin & Log Presensi!'
    );

    stopDocCamera();
    setTimeout(() => setProfileUploadBanner(null), 5000);
  };

  const handleUploadProfilePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setProfileUploadError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setProfileUploadError(validation.error || 'Format gambar tidak didukung.');
      return;
    }

    try {
      setIsProcessingProfilePhoto(true);
      // Kompresi otomatis maksimal lebar 800px, format JPEG kualitas 0.8
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      const nowTimestamp = getJakartaFullDateTimeLabel(new Date(), false).compactLabel;

      setProfileForm((prev) => ({ ...prev, avatarUrl: compressedDataUrl }));

      const cleanNikKtp = (profileForm.ktpNumber || '').replace(/\D/g, '').trim();
      const validNikKtp = /^\d{16}$/.test(cleanNikKtp) ? cleanNikKtp : currentEmployee.ktpNumber;

      const updatedEmp: Employee = {
        ...currentEmployee,
        phone: profileForm.phone,
        email: profileForm.email,
        googleEmail: profileForm.googleEmail,
        address: profileForm.address,
        bankName: profileForm.bankName,
        bankAccountNumber: profileForm.bankAccountNumber,
        bankAccountHolder: profileForm.bankAccountHolder,
        avatarUrl: compressedDataUrl,
        facePhotoUrl: compressedDataUrl,
        profilePhotoUpdatedAt: nowTimestamp,
        ktpNumber: validNikKtp,
        npwp: profileForm.npwp.trim() || currentEmployee.npwp,
        emergencyContact: {
          name: profileForm.emergencyName,
          relation: profileForm.emergencyRelation,
          phone: profileForm.emergencyPhone,
        },
      };

      onUpdateProfile(updatedEmp);
      setProfileUploadBanner(
        'Foto Profil (terkompresi maks. 800px JPEG 0.8) berhasil diunggah & langsung terupdate di Header, Portal Karyawan, Direktori Admin & Log Presensi!'
      );
      setTimeout(() => setProfileUploadBanner(null), 5000);
    } catch (err: any) {
      setProfileUploadError(err?.message || 'Gagal memproses gambar Foto Profil.');
    } finally {
      setIsProcessingProfilePhoto(false);
    }
  };

  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [reportedAssetNotice, setReportedAssetNotice] = useState<string | null>(null);

  // Sync profileForm if currentEmployee changes
  React.useEffect(() => {
    setProfileForm({
      phone: currentEmployee.phone,
      email: currentEmployee.email,
      googleEmail: currentEmployee.googleEmail || currentEmployee.email,
      address: currentEmployee.address || '',
      bankName: currentEmployee.bankName,
      bankAccountNumber: currentEmployee.bankAccountNumber,
      bankAccountHolder: currentEmployee.bankAccountHolder,
      emergencyName: currentEmployee.emergencyContact?.name || '',
      emergencyRelation: currentEmployee.emergencyContact?.relation || '',
      emergencyPhone: currentEmployee.emergencyContact?.phone || '',
      avatarUrl: currentEmployee.avatarUrl || '',
      ktpNumber: currentEmployee.ktpNumber || '',
      npwp: currentEmployee.npwp || '',
    });
    setProfileSuccessMsg(false);
  }, [currentEmployee]);

  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Leave Submit Handler (Supports Evidence Photo Attachment)
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError(null);
    if (!leaveForm.reason.trim()) {
      setLeaveError('Mohon isi alasan atau keperluan cuti.');
      return;
    }

    if (leaveForm.type === 'Cuti Tahunan' && calculatedLeaveDays > currentEmployee.remainingLeaveDays) {
      setLeaveError(
        `Sisa jatah cuti tahunan Anda hanya ${currentEmployee.remainingLeaveDays} hari. Permohonan Anda sebanyak ${calculatedLeaveDays} hari melebihi batas kuota yang tersedia.`
      );
      return;
    }

    const nowTimestamp = getJakartaFullDateTimeLabel(new Date(), false).compactLabel;
    const todayWib = getJakartaDateString();

    const newReq: LeaveRequest = {
      id: `leave-${Date.now().toString().slice(-6)}`,
      employeeId: currentEmployee.id,
      type: leaveForm.type,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      totalDays: calculatedLeaveDays,
      reason: leaveForm.reason.trim(),
      status: 'Menunggu Persetujuan',
      appliedAt: todayWib,
      attachmentUrl: leaveForm.attachmentUrl || undefined,
      attachmentName: leaveForm.attachmentName || undefined,
      attachmentUploadedAt: leaveForm.attachmentUrl ? nowTimestamp : undefined,
    };

    onApplyLeave(newReq);
    setIsLeaveModalOpen(false);
    setLeaveError(null);
    setLeaveForm({
      type: 'Cuti Tahunan',
      startDate: todayWib,
      endDate: todayWib,
      reason: '',
      attachmentUrl: '',
      attachmentName: '',
    });
  };

  // Overtime Submit Handler (Hitungan Per Menit)
  const handleSubmitOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeForm.taskDescription.trim()) return;

    const validMinutes = Math.max(1, Math.round(Number(overtimeForm.minutes) || 0));

    const newReq: OvertimeRequest = {
      id: `ot-${Date.now().toString().slice(-6)}`,
      employeeId: currentEmployee.id,
      date: overtimeForm.date,
      hours: Number((validMinutes / 60).toFixed(2)),
      minutes: validMinutes,
      startTime: overtimeForm.startTime || undefined,
      endTime: overtimeForm.endTime || undefined,
      ratePerMinute: myOvertimeRatePerMinute,
      taskDescription: overtimeForm.taskDescription.trim(),
      calculatedPay: estimatedOvertimePay,
      status: 'Menunggu Persetujuan',
    };

    onApplyOvertime(newReq);
    setIsOvertimeModalOpen(false);
    setOvertimeForm({
      date: getJakartaDateString(),
      minutes: 90,
      startTime: '17:30',
      endTime: '19:00',
      taskDescription: '',
    });
  };

  // Reimbursement Submit Handler
  const handleSubmitReimbursement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimbursementForm.description.trim() || reimbursementForm.amount <= 0) return;

    const randomNum = Math.floor(100 + Math.random() * 900);
    const todayWib = getJakartaDateString();
    const currentYm = getJakartaYearMonth();
    const nowTimeWib = getJakartaTimeString(new Date(), false);
    const newClaim: ReimbursementClaim = {
      id: `rmb-${Date.now().toString().slice(-6)}`,
      claimNumber: `RMB-${currentYm}-${randomNum}`,
      employeeId: currentEmployee.id,
      date: todayWib,
      category: reimbursementForm.category,
      amount: Number(reimbursementForm.amount),
      description: reimbursementForm.description.trim(),
      receiptNumber: `RCP-${Date.now().toString().slice(-6)}`,
      receiptFileName: reimbursementForm.receiptFileName || 'Struk_Nota_Pengeluaran.jpg',
      receiptFileType: 'image',
      receiptPhotoUrl:
        reimbursementForm.receiptPhotoUrl ||
        'https://images.unsplash.com/photo-1554415707-9e4466bfe0dc?auto=format&fit=crop&w=600&h=800&q=80',
      status: 'Menunggu Persetujuan',
      appliedAt: `${todayWib} ${nowTimeWib} WIB`,
      paymentMethod: reimbursementForm.paymentMethod,
    };

    onApplyReimbursement(newClaim);
    setIsReimbursementModalOpen(false);
    setReimbursementForm({
      category: 'Transport & Bensin',
      amount: 150000,
      description: '',
      receiptFileName: '',
      paymentMethod: 'Transfer Bank',
      receiptPhotoUrl: '',
    });
  };

  const isCurrentKtpNumberValid = /^\d{16}$/.test((currentEmployee.ktpNumber || '').trim());
  const isFormKtpNumberValid = /^\d{16}$/.test((profileForm.ktpNumber || '').replace(/\D/g, '').trim());
  const npwpInfo = useMemo(
    () => getNpwpStatusInfo(profileForm.npwp, profileForm.ktpNumber),
    [profileForm.npwp, profileForm.ktpNumber]
  );
  const myContractInfo = useMemo(() => getContractValidityInfo(currentEmployee), [currentEmployee]);
  const formNpwpStatus = npwpInfo;
  const contractValidity = myContractInfo;
  const isCompressingLeaveAttachment = isCompressingLeavePhoto;
  const formatDateID = formatIndoDate;

  // Self-Service Password / Kata Sandi Mandiri State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const handleSelfChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    const cleanCurrentPassword = passwordForm.currentPassword.trim();
    if (!cleanCurrentPassword) {
      setPasswordChangeError('Mohon masukkan Kata Sandi / PIN saat ini.');
      return;
    }
    const cleanNewPassword = passwordForm.newPassword.trim();
    if (cleanNewPassword.length < 6) {
      setPasswordChangeError('Kata Sandi / PIN baru wajib minimal 6 karakter/digit demi keamanan akun.');
      return;
    }
    if (cleanNewPassword !== passwordForm.confirmPassword.trim()) {
      setPasswordChangeError('Konfirmasi Kata Sandi / PIN baru tidak cocok. Silakan periksa kembali.');
      return;
    }
    if (cleanNewPassword === cleanCurrentPassword) {
      setPasswordChangeError('Kata Sandi / PIN baru harus berbeda dari Kata Sandi saat ini.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const verifyRes = await verifyEmployeeLoginSecure(
        currentEmployee.nik || currentEmployee.id,
        cleanCurrentPassword
      );
      const fallbackPin = getEmployeeEffectivePin(currentEmployee);
      const isPinVerified =
        verifyRes.authenticated ||
        (fallbackPin && fallbackPin !== '••••' && cleanCurrentPassword === fallbackPin);

      if (!isPinVerified) {
        setPasswordChangeError('Kata Sandi / PIN saat ini tidak sesuai dengan kredensial akun Anda.');
        setIsUpdatingPassword(false);
        return;
      }

      let supabaseAuthUpdated = false;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const { error: authErr } = await supabase.auth.updateUser({
            password: cleanNewPassword,
          });
          if (authErr) {
            throw new Error(authErr.message);
          }
          supabaseAuthUpdated = true;
        }
      } catch (authUpdateErr: any) {
        console.warn('Supabase Auth session update note:', authUpdateErr?.message);
      }

      await updateEmployeePinSecure(currentEmployee.id, cleanNewPassword);

      const updatedEmployee: Employee = {
        ...currentEmployee,
        accessPin: '••••',
      };
      onUpdateProfile(updatedEmployee);

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordChangeSuccess(
        supabaseAuthUpdated
          ? 'Kata Sandi berhasil dienkripsi (SHA-256 / Bcrypt) dan diperbarui di Supabase Auth!'
          : 'Kata Sandi / PIN Akses berhasil dienkripsi (SHA-256) dan disinkronkan secara aman ke database Supabase!'
      );
      setTimeout(() => setPasswordChangeSuccess(null), 6000);
    } catch (err: any) {
      setPasswordChangeError(err?.message || 'Gagal memperbarui kata sandi. Silakan coba lagi.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Profile Save Handler with strict 16-digit NIK KTP validation, HTML/Script sanitization & NPWP integration
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileUploadError(null);

    const cleanedNikKtp = (profileForm.ktpNumber || '').replace(/\D/g, '').trim();
    if (!validateNikKtp16Digits(cleanedNikKtp)) {
      setProfileUploadError(
        `Validasi Gagal: Kolom 'Nomor NIK KTP (16 Digit)' wajib diisi tepat 16 digit angka (saat ini terisi ${cleanedNikKtp.length} digit). Mohon lengkapi NIK KTP Anda sebelum menyimpan perubahan profil.`
      );
      return;
    }

    const cleanedNpwpDigits = (profileForm.npwp || '').replace(/\D/g, '');
    if (cleanedNpwpDigits.length > 0 && cleanedNpwpDigits.length !== 15 && cleanedNpwpDigits.length !== 16) {
      setProfileUploadError(
        `Validasi NPWP: Nomor NPWP harus terdiri dari 15 digit atau 16 digit angka (Pemadanan NIK-NPWP). Saat ini terisi ${cleanedNpwpDigits.length} digit.`
      );
      return;
    }

    const finalNpwp =
      cleanedNpwpDigits.length === 16
        ? cleanedNpwpDigits
        : cleanedNpwpDigits.length === 15
        ? formatNpwpInput(cleanedNpwpDigits)
        : sanitizeSafeText(profileForm.npwp, 30) || currentEmployee.npwp;

    const updated: Employee = {
      ...currentEmployee,
      phone: sanitizeSafeText(profileForm.phone, 30),
      email: sanitizeSafeText(profileForm.email, 120),
      googleEmail: sanitizeSafeText(profileForm.googleEmail, 120),
      address: sanitizeSafeText(profileForm.address, 300),
      bankName: profileForm.bankName,
      bankAccountNumber: (profileForm.bankAccountNumber || '').replace(/[^\d-]/g, '').slice(0, 30),
      bankAccountHolder: sanitizeSafeText(profileForm.bankAccountHolder, 120),
      avatarUrl: profileForm.avatarUrl || currentEmployee.avatarUrl,
      facePhotoUrl: profileForm.avatarUrl || currentEmployee.facePhotoUrl || currentEmployee.avatarUrl,
      ktpNumber: cleanedNikKtp,
      npwp: finalNpwp,
      emergencyContact: {
        name: sanitizeSafeText(profileForm.emergencyName, 120),
        relation: sanitizeSafeText(profileForm.emergencyRelation, 60),
        phone: sanitizeSafeText(profileForm.emergencyPhone, 30),
      },
    };

    onUpdateProfile(updated);
    setProfileSuccessMsg(true);
    setProfileUploadBanner(
      `Profil, Rekening Bank, NIK KTP (${cleanedNikKtp}) & NPWP (${finalNpwp}) berhasil disimpan dan langsung tersinkronisasi ke Panel Admin HR & Pajak PPh 21!`
    );
    setTimeout(() => {
      setProfileSuccessMsg(false);
      setProfileUploadBanner(null);
    }, 4500);
  };

  // Simulated File Upload for Reimbursement
  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReimbursementForm((prev) => ({
        ...prev,
        receiptFileName: file.name,
        receiptPhotoUrl: 'https://images.unsplash.com/photo-1554415707-9e4466bfe0dc?auto=format&fit=crop&w=600&h=800&q=80',
      }));
    }
  };

  // Calculate current employee hourly rate, daily salary (standard_daily_hours || 9), and real-time monthly gross/THP
  // Jam Kerja Normal dibatasi maksimal sesuai employee.standard_daily_hours || 9 jam/hari dan 0 jam jika belum Clock-Out / Clock-In === Clock-Out
  const currentPay = payrollRecord || allPayrolls.find((p) => p.employeeId === currentEmployee.id);
  const myHourlyRate = isPartTimeEmployee
    ? myPartTimeHourlyRate
    : currentPay?.hourlyRate ||
      getEmployeeHourlyRate(effectivePortalEmployee, myStandardDailyHours, 25);
  const myDailySalary = Math.round(myHourlyRate * myStandardDailyHours);

  const myDailyWorkBreakdown = useMemo(() => {
    const rawList =
      myPenaltySummary.dailyWorkBreakdown && myPenaltySummary.dailyWorkBreakdown.length > 0
        ? myPenaltySummary.dailyWorkBreakdown
        : currentPay?.dailyWorkBreakdown || [];

    return rawList.map((item) => {
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
        myStandardDailyHours
      );
      return {
        ...item,
        workHours: cappedRes.cappedWorkHours,
        rawDurationHours: cappedRes.rawDurationHours,
        isCappedToMax: cappedRes.isCappedToMax,
        isMissingClockOut: cappedRes.isMissingClockOut,
        dailyWage: Math.round(cappedRes.cappedWorkHours * myHourlyRate),
      };
    });
  }, [
    myPenaltySummary.dailyWorkBreakdown,
    currentPay?.dailyWorkBreakdown,
    myHourlyRate,
    myStandardDailyHours,
  ]);

  const myPresentDaysCount = useMemo(() => {
    if (myDailyWorkBreakdown.length > 0) {
      return myDailyWorkBreakdown.filter(
        (d) =>
          d.status !== 'Alpa' &&
          d.status !== 'Sakit' &&
          d.status !== 'Izin' &&
          d.status !== 'Cuti'
      ).length;
    }
    return currentPay?.presentDaysCount !== undefined
      ? currentPay.presentDaysCount
      : myPenaltySummary.presentDaysCount;
  }, [myDailyWorkBreakdown, currentPay?.presentDaysCount, myPenaltySummary.presentDaysCount]);

  const myTotalActualWorkHours = useMemo(() => {
    if (myDailyWorkBreakdown.length > 0) {
      return Number(
        myDailyWorkBreakdown
          .reduce((sum, item) => sum + (Number(item.workHours) || 0), 0)
          .toFixed(2)
      );
    }
    const rawTotal =
      currentPay?.totalActualWorkHours !== undefined
        ? Number(currentPay.totalActualWorkHours)
        : myPenaltySummary.totalActualWorkHours;
    return Number(
      Math.max(0, Math.min(myPresentDaysCount * myStandardDailyHours, rawTotal)).toFixed(2)
    );
  }, [
    myDailyWorkBreakdown,
    currentPay?.totalActualWorkHours,
    myPenaltySummary.totalActualWorkHours,
    myPresentDaysCount,
    myStandardDailyHours,
  ]);

  // Gaji Pokok selalu 100% sinkron: Total Jam Kerja Aktual (Maks. myStandardDailyHours Jam/Hari) × Tarif Per Jam
  const baseSal = Math.round(myTotalActualWorkHours * myHourlyRate);
  const posAllow = currentEmployee.allowances?.position || 0;
  const transAllow = currentEmployee.allowances?.transport || 0;
  const mealAllow = currentEmployee.allowances?.meal || 0;
  const commAllow = currentEmployee.allowances?.communication || 0;
  const totalAllow = posAllow + transAllow + mealAllow + commAllow;

  const myLiveSalesSummary = useMemo(
    () =>
      calculateEmployeeLiveSalesCommission(
        effectivePortalEmployee,
        companyConfig.currentPayrollPeriod
      ),
    [effectivePortalEmployee, companyConfig.currentPayrollPeriod]
  );

  const allCombinedBonuses = useMemo(() => {
    const map = new Map<string, EmployeeBonus>();
    for (const b of [...syncedEmployeeBonuses, ...employeeBonuses]) {
      if (b?.id) map.set(b.id, b);
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.date_awarded || '').localeCompare(a.date_awarded || '')
    );
  }, [syncedEmployeeBonuses, employeeBonuses]);

  const myBonuses = useMemo(
    () => allCombinedBonuses.filter((b) => doesEmployeeMatchBonus(b, currentEmployee)),
    [allCombinedBonuses, currentEmployee]
  );

  const myUnreadBonuses = useMemo(
    () => myBonuses.filter((b) => !b.is_read),
    [myBonuses]
  );

  const myPeriodBonusSummary = useMemo(
    () =>
      getEmployeeBonusesForPeriod(
        allCombinedBonuses,
        currentEmployee,
        currentPay?.period || companyConfig.currentPayrollPeriod
      ),
    [allCombinedBonuses, currentEmployee, currentPay?.period, companyConfig.currentPayrollPeriod]
  );

  const handleMarkBonusRead = async (bonusId: string) => {
    await markBonusAsRead(bonusId);
    setSyncedEmployeeBonuses(getSavedEmployeeBonuses());
    onMarkBonusAsRead?.(bonusId);
  };

  // Kelebihan jam kerja di atas 9 jam/hari HANYA dihitung sebagai Lembur jika ada Pengajuan Lembur berstatus "Disetujui"
  const myApprovedOvertimeRequests = useMemo(
    () => myOvertimeRequests.filter((o) => o.status === 'Disetujui'),
    [myOvertimeRequests]
  );
  const approvedOvertimeMinutes = useMemo(
    () => myApprovedOvertimeRequests.reduce((sum, o) => sum + getOvertimeMinutes(o), 0),
    [myApprovedOvertimeRequests]
  );
  const approvedOvertimePay = useMemo(
    () =>
      myApprovedOvertimeRequests.reduce(
        (sum, o) =>
          sum +
          (Math.max(0, Math.round(Number(o.calculatedPay) || 0)) ||
            calculateOvertimePayByMinutes(currentEmployee, getOvertimeMinutes(o), 1.5)),
        0
      ),
    [myApprovedOvertimeRequests, currentEmployee]
  );

  const overtimeMinutes = approvedOvertimeMinutes;
  const overtimePay = approvedOvertimePay;
  const bonusPay = Number(currentPay?.bonus) || 0;
  const additionalBonusPay = Math.max(0, Number(myPeriodBonusSummary.totalAmount) || 0);
  const rawCommissionPay = Math.max(
    Number(currentPay?.salesCommission) || 0,
    Number(myLiveSalesSummary.totalCommission) || 0
  );
  const salesCommissionPay =
    canAccessLiveCommissionPanel || rawCommissionPay > 0 ? rawCommissionPay : 0;

  const allCombinedAdjustments = useMemo(() => {
    const map = new Map<string, EmployeeAdjustment>();
    for (const a of [...syncedEmployeeAdjustments, ...employeeAdjustments]) {
      if (a?.id) map.set(a.id, a);
    }
    return Array.from(map.values());
  }, [syncedEmployeeAdjustments, employeeAdjustments]);

  const allCombinedDeductions = useMemo(() => {
    const map = new Map<string, PayrollDeductionRecord>();
    for (const d of [...syncedPayrollDeductions, ...payrollDeductions]) {
      if (d?.id) map.set(d.id, d);
    }
    return Array.from(map.values());
  }, [syncedPayrollDeductions, payrollDeductions]);

  const allCombinedThrPayouts = useMemo(() => {
    const map = new Map<string, ThrPayoutRecord>();
    for (const t of [...syncedThrPayouts, ...thrPayouts]) {
      if (t?.id) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [syncedThrPayouts, thrPayouts]);

  const myPeriodDeduction = useMemo(() => {
    const targetPeriodYm =
      normalizePeriodToYearMonth(currentPay?.period || companyConfig.currentPayrollPeriod) ||
      getJakartaYearMonth();
    return (
      allCombinedDeductions.find(
        (d) =>
          normalizePeriodToYearMonth(d.period_month) === targetPeriodYm &&
          doesEmployeeMatchPayrollDeduction(d, effectivePortalEmployee)
      ) || null
    );
  }, [
    allCombinedDeductions,
    currentPay?.period,
    companyConfig.currentPayrollPeriod,
    effectivePortalEmployee,
  ]);

  const manualBpjsTk = myPeriodDeduction
    ? Math.max(0, Math.round(Number(myPeriodDeduction.bpjs_tk_manual) || 0))
    : Math.max(0, Math.round(Number(currentPay?.bpjs_tk_manual) || 0));
  const manualBpjsKesehatan = myPeriodDeduction
    ? Math.max(0, Math.round(Number(myPeriodDeduction.bpjs_kesehatan_manual) || 0))
    : Math.max(0, Math.round(Number(currentPay?.bpjs_kesehatan_manual) || 0));
  const manualPph21 = myPeriodDeduction
    ? Math.max(0, Math.round(Number(myPeriodDeduction.pph21_manual) || 0))
    : Math.max(0, Math.round(Number(currentPay?.pph21_manual) || 0));

  const fallbackPayRecord: PayrollRecord = useMemo(
    () => ({
      id: currentPay?.id || `pay-portal-${effectivePortalEmployee.id}`,
      employeeId: effectivePortalEmployee.id,
      period: currentPay?.period || companyConfig.currentPayrollPeriod,
      createdAt: currentPay?.createdAt || getJakartaDateString(),
      baseSalary: baseSal,
      dailySalary: myDailySalary,
      hourlyRate: myHourlyRate,
      standardWorkHoursPerDay: myStandardDailyHours,
      totalActualWorkHours: myTotalActualWorkHours,
      presentDaysCount: myPresentDaysCount,
      standardWorkingDays: currentPay?.standardWorkingDays || 25,
      dailyWorkBreakdown: myDailyWorkBreakdown,
      allowancePosition: posAllow,
      allowanceTransport: transAllow,
      allowanceMeal: mealAllow,
      allowanceCommunication: commAllow,
      overtimeMinutes,
      overtimeRatePerMinute: myOvertimeRatePerMinute,
      overtimePay,
      salesCommission: salesCommissionPay,
      salesCommissionNotes: currentPay?.salesCommissionNotes || myLiveSalesSummary.notes,
      bonus: bonusPay,
      totalGrossSalary:
        (Number(baseSal) || 0) +
        (Number(totalAllow) || 0) +
        overtimePay +
        bonusPay +
        salesCommissionPay +
        additionalBonusPay,
      bpjsKesehatanEmployer: 0,
      bpjsKesehatanEmployee: manualBpjsKesehatan,
      bpjsJhtEmployer: 0,
      bpjsJhtEmployee: manualBpjsTk,
      bpjsJpEmployer: 0,
      bpjsJpEmployee: 0,
      bpjsJkkEmployer: 0,
      bpjsJkmEmployer: 0,
      pph21TER: manualPph21,
      bpjs_tk_manual: manualBpjsTk,
      bpjs_kesehatan_manual: manualBpjsKesehatan,
      pph21_manual: manualPph21,
      lateDeduction: currentPay?.lateDeduction ?? myPenaltySummary.totalDeductionAmount,
      lateFrequency: currentPay?.lateFrequency ?? myPenaltySummary.lateFrequency,
      totalLateMinutes: currentPay?.totalLateMinutes ?? myPenaltySummary.totalLateMinutes,
      alphaDaysCount: currentPay?.alphaDaysCount ?? myPenaltySummary.alphaDaysCount,
      alphaPenaltyAmount: currentPay?.alphaPenaltyAmount ?? myPenaltySummary.alphaPenaltyAmount,
      attendanceDeductionNotes:
        currentPay?.attendanceDeductionNotes || myPenaltySummary.deductionNotes,
      cashAdvanceDeduction: currentPay?.cashAdvanceDeduction || 0,
      cashAdvanceNotes: currentPay?.cashAdvanceNotes,
      otherDeductions: currentPay?.otherDeductions || 0,
      totalDeductions: currentPay?.totalDeductions || 0,
      takeHomePay: currentPay?.takeHomePay || 0,
      paymentStatus: currentPay?.paymentStatus || 'Draft',
      paymentDate: currentPay?.paymentDate,
      referenceNumber:
        currentPay?.referenceNumber || `TGI/PAY/${effectivePortalEmployee.nik || 'EMP'}`,
    }),
    [
      currentPay,
      effectivePortalEmployee.id,
      effectivePortalEmployee.nik,
      companyConfig.currentPayrollPeriod,
      baseSal,
      myDailySalary,
      myHourlyRate,
      myStandardDailyHours,
      myTotalActualWorkHours,
      myPresentDaysCount,
      myDailyWorkBreakdown,
      posAllow,
      transAllow,
      mealAllow,
      commAllow,
      totalAllow,
      overtimeMinutes,
      myOvertimeRatePerMinute,
      overtimePay,
      salesCommissionPay,
      myLiveSalesSummary.notes,
      bonusPay,
      additionalBonusPay,
      myPenaltySummary,
      manualBpjsTk,
      manualBpjsKesehatan,
      manualPph21,
    ]
  );

  const portalSignatories = useMemo(
    () => getPayrollSignatoriesConfig(companyConfig),
    [companyConfig]
  );

  const officialPayslipData = useMemo(
    () =>
      computeOfficialPayslipData({
        payroll: fallbackPayRecord,
        employee: effectivePortalEmployee,
        companyConfig,
        employeeBonuses: allCombinedBonuses,
        employeeAdjustments: allCombinedAdjustments,
        payrollDeductions: allCombinedDeductions,
        thrPayouts: allCombinedThrPayouts,
        cashAdvances: myCashAdvances,
        leaveRequests: myLeaveRequests,
        overtimeRequests: myOvertimeRequests,
        signatories: portalSignatories,
      }),
    [
      fallbackPayRecord,
      effectivePortalEmployee,
      companyConfig,
      allCombinedBonuses,
      allCombinedAdjustments,
      allCombinedDeductions,
      allCombinedThrPayouts,
      myCashAdvances,
      myLeaveRequests,
      myOvertimeRequests,
      portalSignatories,
    ]
  );

  const grossSalary =
    officialPayslipData.subtotalGajiTetap + officialPayslipData.subtotalGajiTidakTetap;
  const totalDeduct = officialPayslipData.subtotalPengurangan;
  const takeHomePay = officialPayslipData.jumlahBersih;
  const effectivePayRecord: PayrollRecord = {
    ...fallbackPayRecord,
    salesCommission: salesCommissionPay,
    salesCommissionNotes: fallbackPayRecord.salesCommissionNotes,
    thrAmount: officialPayslipData.thrShowInPayslip ? officialPayslipData.thrAmount : 0,
    thrShowInPayslip: officialPayslipData.thrShowInPayslip,
    thrHolidayName: officialPayslipData.thrHolidayName,
    thrTenureLabel: officialPayslipData.thrTenureLabel,
    thrProportionFormula: officialPayslipData.thrProportionFormula,
    thrPaymentStatus: officialPayslipData.thrPaymentStatus,
    totalGrossSalary: grossSalary,
    totalDeductions: totalDeduct,
    takeHomePay,
  };

  const portalTabLabels: Record<typeof activePortalTab, string> = {
    home: 'Beranda Ringkasan Karyawan',
    attendance: 'Kamera Absen Wajah & GPS HP',
    payroll: 'Gaji & Slip Gaji Pribadi',
    my_bonuses: 'Bonus & Apresiasi Saya',
    live_commission: 'Komisi Live Host & Co-Host',
    leave: 'Pengajuan Cuti & Izin',
    claims: 'Klaim Lembur & Reimbursement',
    cash_advance: 'Pengajuan Kasbon & Cicilan',
    assets: 'Inventaris & Aset Kantor Saya',
    performance: 'Rapor Kinerja & KPI',
    profile: 'Profil & Rekening Bank',
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-6 animate-in fade-in-50 max-w-full overflow-x-hidden">
      {/* Top Banner: Employee Mode Active & Back to Admin Switcher */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <img
              src={currentEmployee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
              alt={currentEmployee.fullName}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-3 ring-white/30 shadow-md shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 backdrop-blur-xs text-white border border-white/20">
                  Portal Karyawan
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-slate-900/50 text-emerald-100 border border-emerald-400/35 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-300" />
                  <span>{portalLiveClockLabel.compactLabel}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-400/30 text-emerald-100 border border-emerald-300/30">
                  {currentEmployee.employmentStatus}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold bg-amber-300 text-slate-950 border border-amber-200 shadow-2xs">
                  Tarif Gaji: {formatRupiah(myHourlyRate)} / jam (Std {myStandardDailyHours} Jam/Hari)
                </span>
                {canAccessLiveCommissionPanel && (
                  <button
                    type="button"
                    onClick={() => setActivePortalTab('live_commission')}
                    className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold bg-pink-500 hover:bg-pink-400 text-white border border-pink-300 shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Video className="w-3 h-3" />
                    <span>
                      {is_co_host && !is_host
                        ? `Co-Host Live (${currentEmployee.coHostCommissionPercentage || 0}% Omset${
                            (currentEmployee.coHostCommissionPerPcs || 0) > 0
                              ? ` + ${formatRupiah(currentEmployee.coHostCommissionPerPcs || 0)}/pcs`
                              : ''
                          })`
                        : `Host Live (${currentEmployee.salesCommissionPercentage || 0}% Omset${
                            (currentEmployee.salesCommissionPerPcs || 0) > 0
                              ? ` + ${formatRupiah(currentEmployee.salesCommissionPerPcs || 0)}/pcs`
                              : ''
                          })`}{' '}
                      • Komisi: {formatRupiah(salesCommissionPay)}
                    </span>
                  </button>
                )}
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-white mt-1 truncate">
                Halo, {currentEmployee.fullName}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5 truncate">
                NIK: <span className="font-mono font-bold">{currentEmployee.nik}</span>
                {currentEmployee.ktpNumber ? (
                  <>
                    {' '}
                    • NIK KTP: <span className="font-mono font-bold">{currentEmployee.ktpNumber}</span>
                  </>
                ) : null}{' '}
                •{' '}
                {(currentEmployee.role || '').trim().toLowerCase() ===
                (currentEmployee.department || '').trim().toLowerCase()
                  ? currentEmployee.role
                  : `${currentEmployee.role} (${currentEmployee.department})`}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivePortalTab('attendance');
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-emerald-900 hover:bg-emerald-50 shadow-sm cursor-pointer transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {Boolean(todayAttendance?.checkIn)
                      ? `Absen Wajah & GPS HP (${todayAttendance?.checkIn}${
                          todayAttendance?.checkOut ? ` – ${todayAttendance.checkOut}` : ''
                        })`
                      : 'Absen Foto Wajah & GPS HP Sekarang'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePortalTab('profile')}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isCurrentKtpNumberValid
                      ? 'bg-emerald-900/45 text-emerald-100 border-emerald-400/40 hover:bg-emerald-900/65'
                      : 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 shadow-sm'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isCurrentKtpNumberValid
                      ? `NIK KTP: ${currentEmployee.ktpNumber} • NPWP: ${currentEmployee.npwp || '-'}`
                      : '⚠️ Lengkapi NIK KTP (16 Digit) & NPWP'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePortalTab('profile')}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                    myContractInfo.isPermanent
                      ? 'bg-indigo-500/30 text-indigo-50 border-indigo-300/50 hover:bg-indigo-500/40'
                      : myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 7
                      ? 'bg-rose-500 text-white border-rose-300 hover:bg-rose-600'
                      : myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 30
                      ? 'bg-amber-400 text-slate-950 border-amber-200 hover:bg-amber-300'
                      : 'bg-emerald-500/35 text-emerald-50 border-emerald-300/60 hover:bg-emerald-500/45'
                  }`}
                  title="Indikator Kontrak PKWT: Hijau (> 30 hari), Kuning (≤ 30 hari), Merah (≤ 7 hari)"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      myContractInfo.isPermanent
                        ? 'bg-indigo-300'
                        : myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 7
                        ? 'bg-white animate-ping'
                        : myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 30
                        ? 'bg-slate-950'
                        : 'bg-emerald-300'
                    }`}
                  />
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>{myContractInfo.badgeText}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Switchers: Sesi Login Ketat — Hapus total fitur Admin Preview / Switch Karyawan jika sesi yang aktif bukan sesi Admin resmi terverifikasi */}
          {!Boolean(isAdminUnlocked && isAdminSessionVerified() && onSwitchToAdminMode) ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="inline-flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2 bg-emerald-950/45 border border-emerald-400/35 rounded-xl text-emerald-100 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="font-semibold text-white truncate max-w-[165px]">
                    Sesi Terkunci: {currentEmployee.fullName}
                  </span>
                  <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {currentEmployee.nik}
                  </span>
                </div>
              </div>

              {onLockAdmin && (
                <button
                  type="button"
                  onClick={onLockAdmin}
                  className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-400/40 rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Keluar Sesi Login Portal Karyawan (Logout)"
                >
                  <LogOut className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Keluar Sesi (Logout)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Quick Employee Selector for Verified Official Admin Only */}
              {isAdminSessionVerified() && onSelectEmployee && allEmployees.length > 1 && (
                <div className="relative">
                  <select
                    value={currentEmployee.id}
                    onChange={(e) => {
                      if (isAdminSessionVerified()) {
                        onSelectEmployee(e.target.value);
                      }
                    }}
                    className="w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl text-white focus:outline-hidden cursor-pointer"
                    title="Admin Preview: Simulasi Karyawan (Khusus Sesi Admin Resmi)"
                  >
                    {allEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="text-slate-800 bg-white">
                        Admin Preview: {emp.fullName} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Back to Admin Panel Button */}
              <button
                type="button"
                onClick={() => {
                  if (isAdminSessionVerified() && onSwitchToAdminMode) {
                    onSwitchToAdminMode();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
              >
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kembali ke Panel Admin</span>
              </button>

              {onLockAdmin && (
                <button
                  type="button"
                  onClick={onLockAdmin}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-950/40 hover:bg-rose-900/40 text-white rounded-xl border border-white/20 transition-all cursor-pointer"
                  title="Kunci Akses Admin dan Kembali ke Mode Karyawan Biasa"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="hidden sm:inline">Kunci</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Warning Banner if Employee has not completed 16-digit NIK KTP */}
      {!isCurrentKtpNumberValid && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 border border-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  Peringatan Wajib Lengkapi Identitas
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-950">
                  Nomor NIK KTP (16 Digit) Anda Belum Lengkap!
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Harap segera lengkapi <strong>Nomor NIK KTP (16 Digit)</strong> dan{' '}
                <strong>Nomor NPWP (15/16 Digit)</strong> di tab{' '}
                <strong>Profil &amp; Bank</strong> untuk kelengkapan administrasi HR dan pelaporan Pajak PPh 21 TER.
              </p>
            </div>
          </div>
          {activePortalTab !== 'profile' && (
            <button
              type="button"
              onClick={() => setActivePortalTab('profile')}
              className="min-h-[38px] px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Lengkapi NIK KTP &amp; NPWP</span>
            </button>
          )}
        </div>
      )}

      {/* Global Contract Expiring / Expired Warning Banner */}
      {myContractInfo.warningMessage && (
        <div
          className={`rounded-2xl p-4 border-2 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in ${
            myContractInfo.status === 'expired' ||
            (myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 7)
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 border ${
                myContractInfo.status === 'expired' ||
                (myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 7)
                  ? 'bg-rose-100 text-rose-700 border-rose-300'
                  : 'bg-amber-100 text-amber-700 border-amber-300'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    myContractInfo.status === 'expired' ||
                    (myContractInfo.daysRemaining !== null && myContractInfo.daysRemaining <= 7)
                      ? 'bg-rose-200 text-rose-900'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {myContractInfo.badgeText}
                </span>
                <span className="text-xs sm:text-sm font-bold">
                  Status Kontrak Kerja ({currentEmployee.employmentStatus})
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-90">{myContractInfo.warningMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentEmployee.contractDocumentUrl && (
              <button
                type="button"
                onClick={() =>
                  setPreviewDocumentModal({
                    title: `Dokumen Kontrak Kerja — ${currentEmployee.fullName}`,
                    subtitle: `${currentEmployee.employmentStatus} • No: ${
                      currentEmployee.contractDocumentNumber || '-'
                    }`,
                    imageUrl: currentEmployee.contractDocumentUrl!,
                    downloadFileName:
                      currentEmployee.contractDocumentName ||
                      `Kontrak_${currentEmployee.nik}.jpg`,
                  })
                }
                className="min-h-[38px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lihat Dokumen Kontrak</span>
              </button>
            )}
            {activePortalTab !== 'profile' && (
              <button
                type="button"
                onClick={() => setActivePortalTab('profile')}
                className="min-h-[38px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Detail Kontrak</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unread Performance / Payroll Notification Alert Banner */}
      {unreadKpiNotifs.length > 0 && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full text-violet-100">
                  Notifikasi Kinerja ({unreadKpiNotifs.length})
                </span>
                <span className="text-xs text-violet-100 font-semibold truncate max-w-xs sm:max-w-md">
                  {unreadKpiNotifs[0].title}
                </span>
              </div>
              <p className="text-xs text-violet-100/90 mt-1 max-w-2xl line-clamp-1">
                {unreadKpiNotifs[0].message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadKpiNotifs[0].actionUrl === 'rapor_kinerja' ? (
              <button
                onClick={() => setActivePortalTab('performance')}
                className="px-3.5 py-1.5 bg-white text-violet-900 rounded-xl text-xs font-bold hover:bg-violet-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-violet-700" />
                <span>Buka Rapor Kinerja</span>
              </button>
            ) : (
              <button
                onClick={() => setActivePortalTab('payroll')}
                className="px-3.5 py-1.5 bg-white text-emerald-900 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cek Bonus Slip Gaji</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unread Employee Bonus Alert / Notification Banner */}
      {myUnreadBonuses.length > 0 && (
        <div className="space-y-2.5">
          {myUnreadBonuses.map((bonus) => (
            <div
              key={bonus.id}
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl p-4 text-white shadow-lg border border-emerald-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="p-2.5 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs border border-white/25">
                  <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 px-2 py-0.5 rounded-md">
                      Bonus &amp; Apresiasi Baru ({formatYearMonthToIndo(bonus.period_month)})
                    </span>
                    <span className="text-[11px] text-emerald-100 font-medium">
                      Diberikan: {formatIndoDate(bonus.date_awarded)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-extrabold text-white mt-1">
                    Selamat! Anda menerima bonus sebesar {formatRupiah(bonus.amount)} - {bonus.reason_note}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('my_bonuses')}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Lihat Riwayat Bonus
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkBonusRead(bonus.id)}
                  className="px-3.5 py-1.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-extrabold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tandai Sudah Dibaca</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Active Section Header Bar (<768px) — Replaces Horizontal Scroll Tabs on Phones */}
      <div className="md:hidden bg-white rounded-2xl px-3.5 py-2.5 border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">
            {portalTabLabels[activePortalTab]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer shrink-0"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
          <span>Semua Menu</span>
        </button>
      </div>

      {/* Desktop Navigation Sub-Tabs (≥768px) */}
      <div className="hidden md:flex bg-white rounded-2xl p-2 border border-slate-200 shadow-xs items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActivePortalTab('home')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'home'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Home className="w-4 h-4" />
          Beranda
        </button>

        <button
          onClick={() => setActivePortalTab('attendance')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Camera className="w-4 h-4" />
          Kamera Absen & GPS
          {todayAttendance ? (
            <span className="w-2 h-2 rounded-full bg-emerald-300 ring-1 ring-white" title="Sudah Absen Hari Ini" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Belum Absen Hari Ini" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('payroll')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'payroll'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <WalletCards className="w-4 h-4" />
          Slip Gaji Pribadi
        </button>

        <button
          onClick={() => setActivePortalTab('my_bonuses')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'my_bonuses'
              ? 'bg-emerald-600 text-white shadow-xs'
              : myUnreadBonuses.length > 0
              ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Bonus Saya ({myBonuses.length})</span>
          {myUnreadBonuses.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400 text-slate-950">
              {myUnreadBonuses.length} Baru
            </span>
          )}
        </button>

        {canAccessLiveCommissionPanel && (
          <button
            onClick={() => setActivePortalTab('live_commission')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
              activePortalTab === 'live_commission'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-pink-700 bg-pink-50/70 hover:bg-pink-100 border border-pink-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Komisi Live Host &amp; Co-Host</span>
            {salesCommissionPay > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-pink-600 text-white">
                +{formatRupiah(salesCommissionPay)}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActivePortalTab('leave')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'leave'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Cuti & Izin
          {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('claims')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'claims'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Lembur & Klaim
        </button>

        <button
          onClick={() => setActivePortalTab('cash_advance')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'cash_advance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          <span>Kasbon ({myCashAdvances.length})</span>
          {myCashAdvances.some((c) => c.status === 'pending' || c.status === 'approved') && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('assets')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'assets'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Aset ({myAssets.length})
        </button>

        <button
          onClick={() => setActivePortalTab('performance')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'performance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Rapor KPI ({myReviews.length})</span>
          {unreadKpiNotifs.some(n => n.category === 'PERFORMANCE_REVIEW') && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-white animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          Profil & Bank
        </button>
      </div>

      {/* TAB 0: BERANDA RINGKASAN KARYAWAN (HOME) */}
      {activePortalTab === 'home' && (
        <div className="space-y-5">
          {/* Card 1: Quick Live Face & GPS Attendance Action Card */}
          <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 text-white border border-slate-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Geofence Radius ≤ 25m Kantor & Anti-Fake GPS</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  {todayAttendance?.checkIn
                    ? `Presensi Hari Ini Tercatat (${todayAttendance.checkIn}${
                        todayAttendance.checkOut ? ` – ${todayAttendance.checkOut}` : ''
                      } WIB)`
                    : 'Anda Belum Absen Masuk Hari Ini'}
                </h3>
                <p className="text-xs text-slate-300">
                  Jadwal Shift: <strong className="text-emerald-400">{myShift.name}</strong> (
                  <span className="font-mono tabular-nums">
                    {myShift.checkInTime} – {myShift.checkOutTime} WIB
                  </span>
                  ) • Toleransi {myShift.gracePeriodMinutes} menit
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('attendance')}
                  className="min-h-[46px] px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer transition-all"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>
                    {todayAttendance?.checkIn
                      ? todayAttendance?.checkOut
                        ? 'Lihat Bukti Absen & Kamera'
                        : 'Buka Kamera & Absen Pulang'
                      : 'Buka Kamera & Absen Masuk'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3-Card Summary Row: Slip Gaji, Sisa Cuti, & Klaim Lembur Per Menit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Take Home Pay Summary */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                    Take Home Pay (Gaji Bersih)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20">
                    {companyConfig.currentPayrollPeriod}
                  </span>
                </div>
                <div className="text-2xl font-extrabold mt-2 tabular-nums tracking-tight">
                  {formatCurrency(takeHomePay)}
                </div>
                <p className="text-[11px] text-emerald-50 font-semibold mt-1">
                  {myTotalActualWorkHours} Jam Kerja Riil ({myPresentDaysCount} Hari) × {formatRupiah(myHourlyRate)}/jam
                </p>
                <p className="text-[11px] text-emerald-100 mt-0.5">
                  Rekening: {currentEmployee.bankName} ({currentEmployee.bankAccountNumber})
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('payroll')}
                  className="flex-1 min-h-[38px] py-2 px-3 rounded-xl bg-white text-emerald-900 text-xs font-bold hover:bg-emerald-50 transition-colors cursor-pointer text-center"
                >
                  Rincian Gaji
                </button>
                {Boolean(effectivePayRecord) && (
                  <button
                    type="button"
                    onClick={() => onOpenPayslip(effectivePayRecord)}
                    className="min-h-[38px] py-2 px-3 rounded-xl bg-emerald-900/50 hover:bg-emerald-900/70 text-white border border-white/25 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* Leave Balance Summary */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Sisa Cuti Tahunan
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {currentEmployee.remainingLeaveDays}{' '}
                    <span className="text-xs font-normal text-slate-500">Hari Tersisa</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length} pengajuan menunggu HR
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('leave')}
                  className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Ajukan Cuti / Izin Baru →
                </button>
              </div>
            </div>

            {/* Overtime Per Minute & Claims Summary */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Lembur Per Menit & Klaim
                  </span>
                  <div className="text-xl font-extrabold text-indigo-700 mt-1 tabular-nums">
                    {formatRupiah(myOvertimeRatePerMinute)}{' '}
                    <span className="text-xs font-normal text-slate-500">/ menit</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Total Lembur Disetujui:{' '}
                    <strong className="text-emerald-700">
                      {formatRupiah(
                        myOvertimeRequests
                          .filter((o) => o.status === 'Disetujui')
                          .reduce((acc, o) => acc + o.calculatedPay, 0)
                      )}
                    </strong>
                  </p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('claims')}
                  className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Ajukan Klaim Lembur / Biaya →
                </button>
              </div>
            </div>
          </div>

          {/* Kartu Ringkasan Komisi Live Host & Co-Host (HANYA tampil jika is_host === true ATAU is_co_host === true) */}
          {canAccessLiveCommissionPanel && (
            <div className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-700 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold">
                    <Video className="w-3.5 h-3.5" />
                    <span>
                      {is_host && is_co_host
                        ? 'Host & Co-Host Live Stream'
                        : is_co_host
                        ? 'Co-Host Live Stream'
                        : 'Host Live Stream'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/30 border border-white/25 text-amber-200 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Read-Only</span>
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-extrabold">
                  Komisi Live Host &amp; Co-Host ({companyConfig.currentPayrollPeriod}): +{formatRupiah(salesCommissionPay)}
                </h4>
                <p className="text-xs text-pink-100">
                  Total Omset: <strong>{formatRupiah(myLiveSalesSummary.totalOmset)}</strong> • Tas Terjual:{' '}
                  <strong>{myLiveSalesSummary.totalPcs.toLocaleString('id-ID')} Pcs</strong> ({myLiveSalesSummary.sessionsCount} Sesi Terverifikasi Admin)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePortalTab('live_commission')}
                className="px-4 py-2.5 rounded-xl bg-white text-pink-800 hover:bg-pink-50 text-xs font-extrabold shrink-0 cursor-pointer shadow-xs"
              >
                Lihat Rekap Komisi Live →
              </button>
            </div>
          )}

          {/* Native-App Quick Menu Grid (Great for Mobile Thumb Access) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3">
              Menu Layanan Mandiri Karyawan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                {
                  id: 'attendance' as const,
                  label: 'Kamera Absen',
                  sub: 'Wajah & GPS ≤25m',
                  icon: Camera,
                  color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                },
                {
                  id: 'payroll' as const,
                  label: 'Slip Gaji PDF',
                  sub: companyConfig.currentPayrollPeriod,
                  icon: WalletCards,
                  color: 'bg-teal-50 text-teal-700 border-teal-200',
                },
                ...(canAccessLiveCommissionPanel
                  ? [
                      {
                        id: 'live_commission' as const,
                        label: 'Komisi Live Host & Co-Host',
                        sub:
                          salesCommissionPay > 0
                            ? `+${formatRupiah(salesCommissionPay)}`
                            : is_co_host && !is_host
                            ? `Co-Host ${currentEmployee.coHostCommissionPercentage || 0}% Omset`
                            : `Host ${currentEmployee.salesCommissionPercentage || 0}% Omset`,
                        icon: Video,
                        color: 'bg-pink-50 text-pink-700 border-pink-200',
                      },
                    ]
                  : []),
                {
                  id: 'leave' as const,
                  label: 'Cuti & Izin',
                  sub: `Sisa ${currentEmployee.remainingLeaveDays} Hari`,
                  icon: CalendarDays,
                  color: 'bg-blue-50 text-blue-700 border-blue-200',
                },
                {
                  id: 'claims' as const,
                  label: 'Lembur & Klaim',
                  sub: `${formatRupiah(myOvertimeRatePerMinute)}/mnt`,
                  icon: Clock,
                  color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                },
                {
                  id: 'cash_advance' as const,
                  label: 'Kasbon Gaji',
                  sub: `${myCashAdvances.length} Pinjaman`,
                  icon: HandCoins,
                  color: 'bg-amber-50 text-amber-700 border-amber-200',
                },
                {
                  id: 'assets' as const,
                  label: 'Aset Kantor',
                  sub: `${myAssets.length} Inventaris`,
                  icon: Boxes,
                  color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                },
                {
                  id: 'performance' as const,
                  label: 'Rapor KPI',
                  sub: `${myReviews.length} Evaluasi`,
                  icon: Award,
                  color: 'bg-violet-50 text-violet-700 border-violet-200',
                },
                {
                  id: 'profile' as const,
                  label: 'Profil & Bank',
                  sub: currentEmployee.bankName,
                  icon: User,
                  color: 'bg-slate-100 text-slate-700 border-slate-200',
                },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePortalTab(item.id)}
                    className="min-h-[68px] p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all flex items-center gap-3 text-left cursor-pointer group"
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 ${item.color}`}>
                      <IconComp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: GAJI & SLIP GAJI */}
      {activePortalTab === 'payroll' && (
        <div className="space-y-6">
          {/* Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Take Home Pay */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                    Gaji Bersih (Take Home Pay)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                    {companyConfig.currentPayrollPeriod}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
                  {formatCurrency(takeHomePay)}
                </h2>
                <p className="text-xs text-emerald-100 mt-1">
                  Ditransfer ke {currentEmployee.bankName} (No: {currentEmployee.bankAccountNumber})
                </p>
              </div>

              {effectivePayRecord && (
                <div className="mt-4 pt-3 border-t border-white/20">
                  <button
                    onClick={() => onOpenPayslip(effectivePayRecord)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    Unduh PDF / Cetak Slip Gaji Pribadi
                  </button>
                </div>
              )}
            </div>

            {/* Total Penghasilan Bruto */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Penghasilan Bruto
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {formatRupiah(myHourlyRate)} / jam
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(grossSalary)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Gaji Jam Kerja Riil ({myTotalActualWorkHours} Jam) + Tunjangan + Lembur &amp; Bonus
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Gaji Pokok ({myTotalActualWorkHours} Jam × {formatRupiah(myHourlyRate)}/jam):</span>
                <span className="font-bold text-emerald-700">{formatCurrency(baseSal)}</span>
              </div>
            </div>

            {/* Total Potongan Resmi */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                  Total Potongan Wajib
                </span>
                <h3 className="text-2xl font-bold text-rose-700 mt-1">
                  - {formatCurrency(totalDeduct)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Potongan Absensi, Kasbon &amp; Pajak/BPJS (Input Manual Admin)
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Jadwal Pencairan:</span>
                <span className="font-semibold text-emerald-600">
                  Tgl {companyConfig.payrollDisbursementDay} {companyConfig.currentPayrollPeriod.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>

          {/* Dokumen Resmi SLIP GAJI KARYAWAN (Template Tas Grosir Import) */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  SLIP GAJI KARYAWAN — {officialPayslipData.periodCutOffLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format resmi Slip Gaji Tas Grosir Import (mendukung Cetak &amp; Simpan PDF ukuran A4)
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Boolean(canAccessLiveCommissionPanel) && (
                  <button
                    type="button"
                    onClick={() => setActivePortalTab('live_commission')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 transition-colors cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-pink-600" />
                    <span>Rekap Komisi Live</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenPayslip(effectivePayRecord)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Save as PDF (A4)</span>
                </button>
              </div>
            </div>

            {/* Embed Official Slip Gaji Template */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl p-3 sm:p-6 bg-white">
              <OfficialPayslipDocument
                data={officialPayslipData}
                companyConfig={companyConfig}
                signatories={portalSignatories}
              />
            </div>

            {/* Rincian Transparan Gaji Harian & Bulanan Berbasis Jam Kerja Riil */}
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Transparansi Kalkulasi Gaji Per Jam &amp; Jam Kerja Harian Riil</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Jam kerja standar adalah <strong>{myStandardDailyHours} jam/hari</strong>. Gaji Harian dihitung dari <strong>Jam Kerja Aktual Hari Tersebut × Tarif Per Jam ({formatRupiah(myHourlyRate)}/jam)</strong>.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-extrabold shrink-0">
                  Tarif Anda: {formatRupiah(myHourlyRate)} / jam
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">Tarif Gaji Per Jam</span>
                  <span className="font-extrabold text-emerald-700 text-sm block mt-0.5">
                    {formatRupiah(myHourlyRate)} / jam
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">Gaji Harian ({myStandardDailyHours} Jam)</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">
                    {formatRupiah(myDailySalary)} / hari
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">Akumulasi Jam Kerja Riil</span>
                  <span className="font-extrabold text-indigo-700 text-sm block mt-0.5">
                    {myTotalActualWorkHours} Jam ({myPresentDaysCount} Hari)
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">Total Gaji Jam Kerja</span>
                  <span className="font-extrabold text-emerald-800 text-sm block mt-0.5">
                    {formatRupiah(baseSal)}
                  </span>
                </div>
              </div>

              {myDailyWorkBreakdown.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-xl border border-emerald-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-emerald-900/5 text-slate-700 font-bold border-b border-emerald-200">
                      <tr>
                        <th className="py-2.5 px-3">Tanggal Masuk</th>
                        <th className="py-2.5 px-3">Jam Masuk – Pulang</th>
                        <th className="py-2.5 px-3">Jam Kerja Aktual</th>
                        <th className="py-2.5 px-3">Tarif Per Jam</th>
                        <th className="py-2.5 px-3 text-right">Total Gaji Harian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myDailyWorkBreakdown.map((item) => {
                        const isNotClockedOut = Boolean(
                          item.isMissingClockOut ||
                            !item.checkOut ||
                            item.checkOut === '-' ||
                            (item.checkIn && item.checkIn !== '-' && item.checkIn === item.checkOut)
                        );
                        const isCapped = Boolean(
                          item.isCappedToMax ||
                            (Number(item.rawDurationHours) || 0) > myStandardDailyHours
                        );
                        return (
                          <tr key={item.date} className="hover:bg-emerald-50/40">
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {formatIndoDate(item.date)}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              <span>
                                {item.checkIn || '-'} – {item.checkOut || '-'} WIB
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono font-bold text-[11px]">
                                  {item.workHours} Jam
                                </span>
                                {Boolean(isCapped) && (
                                  <span
                                    className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]"
                                    title={`Durasi presensi aktual ${item.rawDurationHours} Jam dibatasi maksimal ${myStandardDailyHours} Jam/Hari kerja normal`}
                                  >
                                    Maks. {myStandardDailyHours} Jam/Hari
                                    {Boolean(item.rawDurationHours && item.rawDurationHours > myStandardDailyHours)
                                      ? ` (Aktual ${item.rawDurationHours}j)`
                                      : ''}
                                  </span>
                                )}
                                {Boolean(isNotClockedOut && item.status !== 'Alpa' && item.status !== 'Sakit' && item.status !== 'Izin' && item.status !== 'Cuti') && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px]">
                                    Belum Clock-Out
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              × {formatRupiah(myHourlyRate)}/jam
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-800">
                              {formatRupiah(item.dailyWage)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-emerald-50/90 font-bold text-slate-900 border-t border-emerald-200">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3">
                          Total Akumulasi ({myPresentDaysCount} Hari Kehadiran)
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-800">
                          {myTotalActualWorkHours} Jam
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          × {formatRupiah(myHourlyRate)}/jam
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-800 text-sm">
                          {formatRupiah(baseSal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs text-slate-500 text-center">
                  Belum ada log jam kerja hadir pada periode ini. Gaji harian dan bulanan akan otomatis bertambah sesuai jam kerja aktual saat Anda melakukan presensi.
                </div>
              )}
            </div>

            {/* Legal Information Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                Rekening pencairan: <strong>{currentEmployee.bankName}</strong> ({currentEmployee.bankAccountNumber} a.n {currentEmployee.bankAccountHolder})
              </span>
              <span className="text-slate-400">
                Plafon BPJS Kesehatan Cap: {formatCurrency(companyConfig.bpjsKesehatanMaxCap)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB PRESENSI & ABSENSI MANDIRI (MENGIKUTI JADWAL SHIFT) */}
      {activePortalTab === 'attendance' && (
        <div className="space-y-6">
          {Boolean(attendanceNotice) && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{attendanceNotice}</span>
            </div>
          )}

          {/* Active Shift Schedule Banner for Employee */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span className="font-bold text-emerald-700">{myShift.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>Jadwal Kerja Aktif Anda</span>
                  {myShift.location && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{myShift.location}</span>
                    </>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {myShift.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hari Kerja: <strong>{myShift.workDays.join(', ')}</strong> · Istirahat:{' '}
                  <strong>{myShift.breakDurationMinutes} Menit</strong>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs shrink-0">
                <div>
                  <span className="text-slate-500 block text-[10px]">Jam Masuk Shift</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {myShift.checkInTime} WIB
                  </span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-500 block text-[10px]">Jam Pulang Shift</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {myShift.checkOutTime} WIB
                  </span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-500 block text-[10px]">Batas Tepat Waktu</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {shiftEvalPreview.maxAllowedCheckIn} WIB
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    (Toleransi {myShift.gracePeriodMinutes} mnt)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clock In / Clock Out Action Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Presensi Mengikuti Jadwal {myShift.name} ({myShift.checkInTime} – {myShift.checkOutTime} WIB)</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  Presensi Kehadiran Hari Ini ({formatIndoDate(todayDateStr)})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status tepat waktu atau terlambat dihitung otomatis berdasarkan jam masuk shift Anda ({myShift.checkInTime} WIB + toleransi {myShift.gracePeriodMinutes} menit).
                </p>
              </div>

              <div className="flex items-center gap-2">
                {todayAttendance ? (
                  <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <span className="text-slate-500 block text-[10px]">Status Hari Ini:</span>
                    <span className="font-bold text-emerald-800">
                      {todayAttendance.status} ({todayAttendance.checkIn}
                      {todayAttendance.checkOut ? ` - ${todayAttendance.checkOut}` : ''})
                    </span>
                  </div>
                ) : (
                  <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                    <span className="text-amber-700 font-bold">Belum Absen Masuk Hari Ini</span>
                  </div>
                )}
              </div>
            </div>

            {/* Real-Time Clock Enforcement & Admin-Locked Simulation Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              {isAdminUnlocked ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomClockTime}
                        onChange={(e) => setUseCustomClockTime(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>[Khusus Admin] Gunakan Simulasi Jam Absen Manual Mengikuti Shift</span>
                    </label>

                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                      {isAdminSimulationActive
                        ? 'Mode Uji Admin Aktif: Simulasi jam masuk & pulang'
                        : 'Mode Jam Real-Time Perangkat Aktif'}
                    </span>
                  </div>

                  {isAdminSimulationActive && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80 items-end">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Simulasi Jam Masuk (Check-In)
                        </label>
                        <input
                          type="time"
                          value={customClockInTime}
                          onChange={(e) => setCustomClockInTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Simulasi Jam Pulang (Check-Out)
                        </label>
                        <input
                          type="time"
                          value={customClockOutTime}
                          onChange={(e) => setCustomClockOutTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomClockInTime(myShift.checkInTime);
                            setCustomClockOutTime(myShift.checkOutTime);
                          }}
                          className="px-2.5 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Sesuai Shift ({myShift.checkInTime} - {myShift.checkOutTime})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const [h, m] = myShift.checkInTime.split(':').map(Number);
                            const lateTotal = ((h || 9) * 60 + (m || 0) + (myShift.gracePeriodMinutes || 5) + 15) % (24 * 60);
                            const lateStr = `${String(Math.floor(lateTotal / 60)).padStart(2, '0')}:${String(lateTotal % 60).padStart(2, '0')}`;
                            setCustomClockInTime(lateStr);
                          }}
                          className="px-2.5 py-2 bg-white hover:bg-amber-50 text-amber-700 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Tes Terlambat
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Jam Absen Real-Time Terkunci Otomatis (Anti-Manipulasi Jam Masuk/Pulang)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Waktu absen dikunci mengikuti jam server & perangkat real-time
                  </span>
                </div>
              )}

              {/* Live Shift Comparison Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Evaluasi terhadap {myShift.code}:</span>
                  <span
                    className={`font-bold ${
                      shiftEvalPreview.lateMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {shiftEvalPreview.status}
                    {shiftEvalPreview.lateMinutes > 0
                      ? ` (Terlambat ${shiftEvalPreview.lateMinutes} Menit dari jadwal ${myShift.checkInTime})`
                      : ` (Sesuai jadwal masuk ${myShift.checkInTime})`}
                  </span>
                </div>
                <span className="font-mono text-slate-600">
                  Estimasi Durasi: <strong>{shiftEvalPreview.workHours} Jam</strong>
                </span>
              </div>
            </div>

              {/* Live Camera & Real-Time Phone GPS Attendance Scanner */}
              <LiveFaceGpsAttendanceScanner
                currentEmployee={currentEmployee}
                activeShift={myShift}
                todayAttendance={todayAttendance}
                todayDateStr={todayDateStr}
                useCustomClockTime={isAdminSimulationActive}
                customClockInTime={customClockInTime}
                customClockOutTime={customClockOutTime}
                clockInNotes={clockInNotes}
                overtimeRequests={myOvertimeRequests}
                onChangeNotes={setClockInNotes}
                onSubmitAttendance={(record, mode) => {
                  // Optimistic real-time update agar tabel riwayat presensi, durasi jam kerja aktual (sesuai target harian 5/6/9 jam), dan Slip Gaji langsung terupdate seketika
                  setLocalCapturedAttendances((prev) => {
                    const existingIdx = prev.findIndex(
                      (a) => a.employeeId === record.employeeId && a.date === record.date
                    );
                    if (existingIdx >= 0) {
                      const prevRec = prev[existingIdx];
                      const merged: AttendanceRecord = {
                        ...prevRec,
                        ...record,
                        checkIn: record.checkIn || prevRec.checkIn,
                        checkOut: record.checkOut || prevRec.checkOut,
                        facePhotoSnapshot: record.facePhotoSnapshot || prevRec.facePhotoSnapshot,
                        photoIn: record.photoIn || record.facePhotoSnapshot || prevRec.photoIn || prevRec.facePhotoSnapshot,
                        checkOutPhotoSnapshot:
                          record.checkOutPhotoSnapshot || prevRec.checkOutPhotoSnapshot,
                        photoOut: record.photoOut || record.checkOutPhotoSnapshot || prevRec.photoOut || prevRec.checkOutPhotoSnapshot,
                        facePhotoOut: record.facePhotoOut || record.checkOutPhotoSnapshot || prevRec.facePhotoOut || prevRec.checkOutPhotoSnapshot,
                        locationCoords: record.locationCoords || prevRec.locationCoords,
                        locationAddress: record.locationAddress || prevRec.locationAddress,
                        checkOutLocationCoords:
                          record.checkOutLocationCoords || prevRec.checkOutLocationCoords,
                        checkOutLocationAddress:
                          record.checkOutLocationAddress || prevRec.checkOutLocationAddress,
                        checkOutDistanceMeters:
                          record.checkOutDistanceMeters ?? prevRec.checkOutDistanceMeters,
                      };
                      const next = [...prev];
                      next[existingIdx] = merged;
                      return next;
                    }
                    return [record, ...prev];
                  });

                  onAddAttendance?.(record);

                  // Jika karyawan berstatus Part-Time, otomatis catat & sinkronkan juga ke tabel tgi_parttime_logs
                  if (isPartTimeEmployee) {
                    const resolvedIn =
                      record.checkIn ||
                      todayAttendance?.checkIn ||
                      todayPartTimeLog?.clockIn ||
                      '';
                    const resolvedOut =
                      mode === 'check_out'
                        ? record.checkOut || ''
                        : record.checkOut || todayAttendance?.checkOut || '';
                    syncPartTimeAttendanceRecord({
                      date: record.date || todayDateStr,
                      clockIn: resolvedIn,
                      clockOut: resolvedOut,
                      notes:
                        record.notes ||
                        `Absen Kamera Wajah & GPS Part-Time (${resolvedIn}${
                          resolvedOut ? ` - ${resolvedOut}` : ''
                        })`,
                    });
                  }

                  if (mode === 'check_in') {
                    setAttendanceNotice(
                      `Berhasil Absen Masuk dengan Foto Wajah & GPS HP pukul ${record.checkIn} WIB (${
                        record.checkInFullTimestamp || ''
                      }) di ${record.locationAddress || myShift.location} → Status: ${record.status}${
                        record.lateMinutes > 0 ? ` (Terlambat ${record.lateMinutes} menit)` : ''
                      }${isPartTimeEmployee ? ' • Tersinkron ke Log Presensi & Slip Gaji Part-Time!' : '!'}`
                    );
                  } else {
                    setAttendanceNotice(
                      `Berhasil Absen Pulang dengan Foto Wajah & GPS HP pukul ${record.checkOut} WIB (${
                        record.checkOutFullTimestamp || ''
                      }) • Jam Kerja Aktual: ${record.workHours} Jam (Maks. ${myStandardDailyHours} Jam/Hari)${
                        isPartTimeEmployee ? ' • Tersinkron ke Log Presensi & Slip Gaji Part-Time!' : '!'
                      }`
                    );
                  }
                  setTimeout(() => setAttendanceNotice(null), 7000);
                }}
              />
            </div>

          {/* Personal Attendance History Table (Mobile Cards + Desktop Table) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Riwayat Presensi, Foto Wajah & Titik Lokasi GPS Saya
                </h3>
                <p className="text-xs text-slate-500">
                  Total {myAttendances.length} catatan kehadiran tercatat beserta bukti foto wajah real-time & koordinat GPS HP
                </p>
              </div>
            </div>

            {myAttendances.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada riwayat presensi untuk akun Anda. Silakan klik tombol <strong>Jepret Foto Wajah & Absen Masuk</strong> pada kamera di atas.
              </div>
            ) : (
              <>
                {/* Mobile Card View (<768px) — Zero Horizontal Scroll */}
                <div className="md:hidden divide-y divide-slate-100">
                  {myAttendances.map((att) => {
                    const schedIn = att.scheduledCheckIn || myShift.checkInTime;
                    const schedOut = att.scheduledCheckOut || myShift.checkOutTime;
                    const shiftLabel = att.shiftName || myShift.name;
                    const photoToShow = att.facePhotoSnapshot || att.checkOutPhotoSnapshot;
                    return (
                      <div key={att.id} className="p-4 space-y-3 hover:bg-slate-50/70">
                        {/* Top Row: Date + Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block">
                              {formatIndoDate(att.date)}
                            </span>
                            {att.checkInFullTimestamp && (
                              <span className="text-[10px] font-mono text-emerald-700 block mt-0.5 tabular-nums">
                                {att.checkInFullTimestamp}
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              att.status === 'Hadir Tepat Waktu'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : att.status === 'Terlambat'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {att.status}
                            {att.lateMinutes > 0 ? ` (${att.lateMinutes} mnt)` : ''}
                          </span>
                        </div>

                        {/* Middle Row: Photo Thumbnail + CheckIn/Out Times */}
                        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                          {photoToShow ? (
                            <button
                              type="button"
                              onClick={() => setPreviewAttendanceRecord(att)}
                              className="relative shrink-0 cursor-pointer group"
                            >
                              <img
                                src={photoToShow}
                                alt="Foto Absen"
                                className="w-14 h-14 rounded-xl object-cover border border-emerald-300 shadow-2xs"
                              />
                              <span className="absolute bottom-0.5 right-0.5 bg-emerald-600 text-white text-[9px] font-bold px-1 rounded">
                                Foto
                              </span>
                            </button>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-200/70 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                              No Foto
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1 text-xs">
                            <div className="font-semibold text-slate-800 truncate">
                              {shiftLabel}{' '}
                              <span className="text-[10px] font-mono text-slate-500">
                                ({schedIn}–{schedOut})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums">
                              <span className="text-emerald-700 font-bold">
                                Masuk: {att.checkIn || '-'}
                              </span>
                              <span className="text-indigo-700 font-bold">
                                Pulang: {att.checkOut || '-'} ({att.workHours}j)
                              </span>
                            </div>
                            {photoToShow && (
                              <button
                                type="button"
                                onClick={() => setPreviewAttendanceRecord(att)}
                                className="text-[11px] font-bold text-emerald-700 underline cursor-pointer"
                              >
                                Lihat Bukti Foto & Watermark GPS →
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: GPS Location & Distance */}
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="font-medium text-slate-800 break-words">
                              {att.locationAddress || att.notes || '-'}
                            </span>
                          </div>
                          {att.locationCoords && (
                            <div className="pl-5 text-[10px] font-mono text-slate-500 tabular-nums break-all">
                              GPS: {att.locationCoords.latitude.toFixed(6)},{' '}
                              {att.locationCoords.longitude.toFixed(6)}
                              {att.distanceMeters !== undefined ? ` (${att.distanceMeters}m ≤ 25m)` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (≥768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                        <th className="py-3 px-4">Tanggal & Jam Real-Time</th>
                        <th className="py-3 px-4">Bukti Foto Wajah</th>
                        <th className="py-3 px-4">Jadwal Shift</th>
                        <th className="py-3 px-4">Jam Masuk / Pulang</th>
                        <th className="py-3 px-4">Status Evaluasi Shift</th>
                        <th className="py-3 px-4">Detail Lokasi GPS HP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myAttendances.map((att) => {
                        const schedIn = att.scheduledCheckIn || myShift.checkInTime;
                        const schedOut = att.scheduledCheckOut || myShift.checkOutTime;
                        const shiftLabel = att.shiftName || myShift.name;
                        const photoToShow = att.facePhotoSnapshot || att.checkOutPhotoSnapshot;
                        return (
                          <tr key={att.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 block">
                                {formatIndoDate(att.date)}
                              </span>
                              {att.checkInFullTimestamp && (
                                <span className="text-[10px] font-mono text-emerald-700 block mt-0.5 tabular-nums">
                                  {att.checkInFullTimestamp}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {photoToShow ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttendanceRecord(att)}
                                  className="flex items-center gap-2 group cursor-pointer text-left"
                                >
                                  <img
                                    src={photoToShow}
                                    alt="Foto Absen"
                                    className="w-12 h-10 rounded-lg object-cover border border-emerald-300 shadow-2xs group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                                  />
                                  <div>
                                    <span className="text-[11px] font-bold text-emerald-700 group-hover:underline block">
                                      Lihat Foto & GPS
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      Watermark Real-Time
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  Tanpa Foto
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-800 block">{shiftLabel}</span>
                              <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                                Jadwal: {schedIn} - {schedOut} WIB
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums">
                              <span className="text-emerald-700 font-bold">
                                Masuk: {att.checkIn || '-'}
                              </span>
                              <span className="block text-indigo-700 font-bold text-[11px]">
                                Pulang: {att.checkOut || '-'} ({att.workHours} jam)
                              </span>
                              <span className="block text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 mt-0.5">
                                Gaji Hari Ini: {formatRupiah(Math.round((Number(att.workHours) || 0) * myHourlyRate))}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  att.status === 'Hadir Tepat Waktu'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : att.status === 'Terlambat'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {att.status}
                                {att.lateMinutes > 0 ? ` (${att.lateMinutes} mnt)` : ''}
                              </span>
                              {(att.earlyLeaveMinutes || 0) > 0 && (
                                <span className="block text-[10px] text-rose-600 font-medium mt-0.5">
                                  Pulang cepat {att.earlyLeaveMinutes} mnt
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <div className="text-[11px] font-medium text-slate-800 line-clamp-2">
                                {att.locationAddress || att.notes || '-'}
                              </div>
                              {att.locationCoords && (
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5 tabular-nums">
                                  GPS: {att.locationCoords.latitude.toFixed(6)},{' '}
                                  {att.locationCoords.longitude.toFixed(6)}
                                  {att.distanceMeters !== undefined ? ` (${att.distanceMeters}m ≤ 25m)` : ''}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Modal Detail Foto Wajah & Lokasi GPS dari Tabel Riwayat */}
          {previewAttendanceRecord && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200">
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Bukti Foto Wajah & Lokasi GPS Real-Time ({formatIndoDate(previewAttendanceRecord.date)})</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {currentEmployee.fullName} ({currentEmployee.nik}) • {previewAttendanceRecord.shiftName || myShift.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewAttendanceRecord(null)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {previewAttendanceRecord.facePhotoSnapshot && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-emerald-800 block">
                          Foto Absen Masuk ({previewAttendanceRecord.checkIn} WIB)
                        </span>
                        <img
                          src={previewAttendanceRecord.facePhotoSnapshot}
                          alt="Foto Absen Masuk"
                          className="w-full rounded-xl border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                    {previewAttendanceRecord.checkOutPhotoSnapshot && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-indigo-800 block">
                          Foto Absen Pulang ({previewAttendanceRecord.checkOut} WIB)
                        </span>
                        <img
                          src={previewAttendanceRecord.checkOutPhotoSnapshot}
                          alt="Foto Absen Pulang"
                          className="w-full rounded-xl border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-slate-500">Waktu Real-Time Tercatat:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {previewAttendanceRecord.checkInFullTimestamp || `${previewAttendanceRecord.date} • ${previewAttendanceRecord.checkIn} WIB`}
                      </span>
                    </div>
                    {previewAttendanceRecord.locationCoords && (
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-slate-500">Titik Koordinat GPS HP:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          Lat {previewAttendanceRecord.locationCoords.latitude.toFixed(6)}°, Long{' '}
                          {previewAttendanceRecord.locationCoords.longitude.toFixed(6)}°
                          {previewAttendanceRecord.distanceMeters !== undefined
                            ? ` (Jarak: ${previewAttendanceRecord.distanceMeters}m / Maks 25m)`
                            : ''}
                        </span>
                      </div>
                    )}
                    <div className="pt-1 border-t border-slate-200/80">
                      <span className="text-slate-500 block mb-0.5">Detail Alamat Lokasi GPS HP:</span>
                      <span className="font-semibold text-slate-900 block">
                        {previewAttendanceRecord.locationAddress || previewAttendanceRecord.notes || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENGAJUAN CUTI & IZIN MANDIRI */}
      {activePortalTab === 'leave' && (
        <div className="space-y-6">
          {/* Quota & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sisa Cuti Tahunan</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {currentEmployee.remainingLeaveDays} <span className="text-sm font-normal text-slate-400">Hari</span>
                </h3>
                <p className="text-xs text-emerald-600 mt-0.5">Dari hak 12 hari/tahun</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuti Terpakai</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
                  {Math.max(0, 12 - currentEmployee.remainingLeaveDays)}{' '}
                  <span className="text-sm font-normal text-slate-400">Hari</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Tahun berjalan 2026</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menunggu Persetujuan</p>
                <h3 className="text-2xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length}{' '}
                  <span className="text-sm font-normal text-slate-400">Pengajuan</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Sedang ditinjau HR</p>
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Riwayat Pengajuan Cuti & Izin</h3>
                <p className="text-xs text-slate-500">
                  Pantau status persetujuan cuti Anda secara langsung oleh tim HRD
                </p>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors w-full sm:w-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Buat Pengajuan Cuti Baru
              </button>
            </div>

            {/* Ringkasan Visual Status Pengajuan Cuti & Izin (Menunggu, Disetujui, Ditolak) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl">
              <div className="flex items-center justify-between p-3 bg-amber-50/90 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-300">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-900 block">Menunggu Review</span>
                    <span className="text-[10px] text-amber-700">Sedang ditinjau HRD</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-200/80 text-amber-950 border border-amber-300">
                  {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length} Pengajuan
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-900 block">Disetujui HRD</span>
                    <span className="text-[10px] text-emerald-700">Izin/Cuti resmi tercatat</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-200/80 text-emerald-950 border border-emerald-300">
                  {myLeaveRequests.filter((l) => l.status === 'Disetujui').length} Pengajuan
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-rose-50/90 border border-rose-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-300">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-rose-900 block">Ditolak</span>
                    <span className="text-[10px] text-rose-700">Tidak disetujui HRD</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-200/80 text-rose-950 border border-rose-300">
                  {myLeaveRequests.filter((l) => l.status === 'Ditolak').length} Pengajuan
                </span>
              </div>
            </div>

            {/* Mobile Card View for Leave Requests (<768px) */}
            <div className="md:hidden divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {myLeaveRequests.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Belum ada riwayat pengajuan cuti. Klik tombol di atas untuk mengajukan.
                </div>
              ) : (
                myLeaveRequests.map((leave) => (
                  <div key={leave.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{leave.type}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {leave.startDate} s/d {leave.endDate} ({leave.totalDays} Hari)
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                          leave.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : leave.status === 'Ditolak'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {leave.status === 'Disetujui' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        ) : leave.status === 'Ditolak' ? (
                          <X className="w-3 h-3 text-rose-700" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-700" />
                        )}
                        <span>{leave.status}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {leave.reason}
                    </p>
                    {leave.attachmentUrl && (
                      <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200/80 rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold text-indigo-900 truncate max-w-[180px]">
                          📎 {leave.attachmentName || 'Bukti Pendukung Cuti/Izin'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDocumentModal({
                              title: `Bukti Cuti / Izin — ${leave.type}`,
                              subtitle: `${currentEmployee.fullName} • ${leave.startDate} s/d ${leave.endDate}`,
                              imageUrl: leave.attachmentUrl!,
                              downloadFileName: leave.attachmentName || `Bukti-Cuti-${leave.id}.jpg`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Lihat Bukti</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Diajukan: {leave.appliedAt}</span>
                      <span>Reviewer: {leave.approvedBy || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Leave History Table (≥768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-3">Tgl Diajukan</th>
                    <th className="py-3 px-3">Jenis Cuti</th>
                    <th className="py-3 px-3">Rentang Tanggal</th>
                    <th className="py-3 px-3">Durasi</th>
                    <th className="py-3 px-3">Alasan / Keperluan</th>
                    <th className="py-3 px-3">Bukti / Lampiran</th>
                    <th className="py-3 px-3">Status Persetujuan</th>
                    <th className="py-3 px-3">Ditinjau Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLeaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada riwayat pengajuan cuti. Klik tombol di atas untuk mengajukan.
                      </td>
                    </tr>
                  ) : (
                    myLeaveRequests.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">{leave.appliedAt}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800">{leave.type}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {leave.startDate} s/d {leave.endDate}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-800">
                          {leave.totalDays} Hari
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={leave.reason}>
                          {leave.reason}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {leave.attachmentUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDocumentModal({
                                  title: `Bukti Cuti / Izin — ${leave.type}`,
                                  subtitle: `${currentEmployee.fullName} • ${leave.startDate} s/d ${leave.endDate}`,
                                  imageUrl: leave.attachmentUrl!,
                                  downloadFileName: leave.attachmentName || `Bukti-Cuti-${leave.id}.jpg`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Lihat Bukti</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tanpa Lampiran</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              leave.status === 'Disetujui'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : leave.status === 'Ditolak'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {leave.status === 'Disetujui' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            ) : leave.status === 'Ditolak' ? (
                              <X className="w-3 h-3 text-rose-700" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-700" />
                            )}
                            <span>{leave.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                          {leave.approvedBy || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KLAIM LEMBUR & REIMBURSEMENT */}
      {activePortalTab === 'claims' && (
        <div className="space-y-6">
          {/* Sub-Tabs: Lembur vs Reimbursement */}
          <div className="flex bg-slate-100 p-1 rounded-xl max-w-md border border-slate-200">
            <button
              onClick={() => setClaimsSubTab('overtime')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                claimsSubTab === 'overtime'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Klaim Lembur Per Menit ({myOvertimeRequests.length})
            </button>
            <button
              onClick={() => setClaimsSubTab('reimbursement')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                claimsSubTab === 'reimbursement'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Klaim Reimbursement ({myReimbursements.length})
            </button>
          </div>

          {/* SUB-TAB: LEMBUR PER MENIT */}
          {claimsSubTab === 'overtime' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Riwayat Pengajuan Lembur (Hitungan Per Menit)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Setiap menit lembur dihitung proporsional ({formatRupiah(myOvertimeRatePerMinute)}/menit) dan otomatis masuk ke slip gaji setelah disetujui HRD
                  </p>
                </div>
                <button
                  onClick={() => setIsOvertimeModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Ajukan Lembur (Per Menit)
                </button>
              </div>

              {/* Ringkasan Status Pengajuan Klaim Lembur (Menunggu, Disetujui, Ditolak) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 bg-amber-50/90 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-300">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-amber-900 block">Menunggu Persetujuan</span>
                      <span className="text-[10px] text-amber-700">Verifikasi jam lembur HR</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-200/80 text-amber-950 border border-amber-300">
                    {myOvertimeRequests.filter((o) => o.status === 'Menunggu Persetujuan').length} Klaim
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-900 block">Disetujui</span>
                      <span className="text-[10px] text-emerald-700">Masuk ke Slip Gaji</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-200/80 text-emerald-950 border border-emerald-300">
                    {myOvertimeRequests.filter((o) => o.status === 'Disetujui').length} Klaim
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-rose-50/90 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-300">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-rose-900 block">Ditolak</span>
                      <span className="text-[10px] text-rose-700">Tidak disetujui HRD</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-200/80 text-rose-950 border border-rose-300">
                    {myOvertimeRequests.filter((o) => o.status === 'Ditolak').length} Klaim
                  </span>
                </div>
              </div>

              {/* Info Ringkasan Tarif Lembur Per Menit Karyawan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs">
                <div>
                  <span className="text-indigo-700 block text-[11px]">Tarif Lembur Anda / Menit:</span>
                  <span className="font-mono font-extrabold text-indigo-950 text-sm">
                    {formatRupiah(myOvertimeRatePerMinute)} / menit
                  </span>
                </div>
                <div>
                  <span className="text-indigo-700 block text-[11px]">Total Durasi Disetujui:</span>
                  <span className="font-bold text-indigo-950 text-sm">
                    {formatOvertimeMinutes(
                      myOvertimeRequests
                        .filter((o) => o.status === 'Disetujui')
                        .reduce((acc, o) => acc + getOvertimeMinutes(o), 0)
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-700 block text-[11px]">Total Upah Lembur Disetujui:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatRupiah(
                      myOvertimeRequests
                        .filter((o) => o.status === 'Disetujui')
                        .reduce((acc, o) => acc + o.calculatedPay, 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-3">Tanggal & Jam</th>
                      <th className="py-3 px-3">Durasi (Menit)</th>
                      <th className="py-3 px-3">Tarif / Menit</th>
                      <th className="py-3 px-3">Uraian Tugas Lembur</th>
                      <th className="py-3 px-3">Total Upah Lembur</th>
                      <th className="py-3 px-3">Status Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myOvertimeRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada pengajuan lembur yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      myOvertimeRequests.map((ot) => {
                        const mins = getOvertimeMinutes(ot);
                        const ratePerMin = ot.ratePerMinute || myOvertimeRatePerMinute;
                        return (
                          <tr key={ot.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium">
                              <span className="block">{ot.date}</span>
                              {ot.startTime && ot.endTime && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {ot.startTime} - {ot.endTime} WIB
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-bold text-indigo-700 block">{mins} Menit</span>
                              <span className="text-[10px] text-slate-400">{formatOvertimeMinutes(mins)}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600">
                              {formatRupiah(ratePerMin)}/mnt
                            </td>
                            <td className="py-3 px-3 max-w-sm truncate text-slate-700" title={ot.taskDescription}>
                              {ot.taskDescription}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-bold text-emerald-700 block">
                                {formatCurrency(ot.calculatedPay)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {mins} mnt × {formatRupiah(ratePerMin)}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  ot.status === 'Disetujui'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : ot.status === 'Ditolak'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {ot.status === 'Disetujui' ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                ) : ot.status === 'Ditolak' ? (
                                  <X className="w-3 h-3 text-rose-700" />
                                ) : (
                                  <Clock className="w-3 h-3 text-amber-700" />
                                )}
                                <span>{ot.status}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB: REIMBURSEMENT */}
          {claimsSubTab === 'reimbursement' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Riwayat Klaim Reimbursement Pribadi</h3>
                  <p className="text-xs text-slate-500">
                    Penggantian biaya operasional kantor, bensin/tol, atau keperluan dinas luar
                  </p>
                </div>
                <button
                  onClick={() => setIsReimbursementModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Ajukan Klaim Baru
                </button>
              </div>

              {/* Ringkasan Status Pengajuan Klaim Reimbursement (Menunggu, Disetujui/Dibayarkan, Ditolak) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 bg-amber-50/90 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-300">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-amber-900 block">Menunggu Persetujuan</span>
                      <span className="text-[10px] text-amber-700">Verifikasi nota Finance</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-200/80 text-amber-950 border border-amber-300">
                    {myReimbursements.filter((r) => r.status === 'Menunggu Persetujuan').length} Klaim
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-900 block">Disetujui / Dibayarkan</span>
                      <span className="text-[10px] text-emerald-700">Klaim terverifikasi</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-200/80 text-emerald-950 border border-emerald-300">
                    {
                      myReimbursements.filter(
                        (r) => r.status === 'Disetujui' || r.status === 'Dibayarkan'
                      ).length
                    }{' '}
                    Klaim
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-rose-50/90 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-300">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-rose-900 block">Ditolak</span>
                      <span className="text-[10px] text-rose-700">Nota tidak valid</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-200/80 text-rose-950 border border-rose-300">
                    {myReimbursements.filter((r) => r.status === 'Ditolak').length} Klaim
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-3">No Klaim</th>
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3">Nominal Klaim</th>
                      <th className="py-3 px-3">Keterangan</th>
                      <th className="py-3 px-3">Pencairan</th>
                      <th className="py-3 px-3">Bukti Nota</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myReimbursements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Belum ada pengajuan klaim reimbursement.
                        </td>
                      </tr>
                    ) : (
                      myReimbursements.map((rmb) => (
                        <tr key={rmb.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                            {rmb.claimNumber}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-500">{rmb.date}</td>
                          <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-700">{rmb.category}</td>
                          <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">
                            {formatCurrency(rmb.amount)}
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={rmb.description}>
                            {rmb.description}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                            {rmb.paymentMethod || 'Transfer'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {rmb.receiptPhotoUrl ? (
                              <button
                                onClick={() => setPreviewReceiptUrl(rmb.receiptPhotoUrl || null)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] underline flex items-center gap-1"
                              >
                                Lihat Nota
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                rmb.status === 'Dibayarkan' || rmb.status === 'Disetujui'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : rmb.status === 'Ditolak'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {rmb.status === 'Dibayarkan' || rmb.status === 'Disetujui' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              ) : rmb.status === 'Ditolak' ? (
                                <X className="w-3 h-3 text-rose-700" />
                              ) : (
                                <Clock className="w-3 h-3 text-amber-700" />
                              )}
                              <span>{rmb.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PENGAJUAN KASBON & CICILAN POTONG GAJI */}
      {activePortalTab === 'cash_advance' && (
        <div className="space-y-6 animate-in fade-in-50">
          {cashAdvanceSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{cashAdvanceSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setCashAdvanceSuccessMsg(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-100">
                  Plafon Maksimum Kasbon Anda
                </span>
                <h3 className="text-2xl font-extrabold mt-1">
                  {formatRupiah(maxCashAdvancePlafon)}
                </h3>
                <p className="text-xs text-amber-100 mt-1">
                  Maksimal 100% dari Gaji Pokok ({currentEmployee.role})
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setCashAdvanceAmount(Math.min(1500000, maxCashAdvancePlafon));
                    setCashAdvanceTenor(3);
                    setCashAdvanceReason('');
                    setCashAdvanceError(null);
                    setIsCashAdvanceModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-white text-amber-900 hover:bg-amber-50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-700" />
                  <span>Ajukan Pinjaman Kasbon Baru</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sisa Pinjaman Kasbon Berjalan
                </span>
                <h3 className="text-2xl font-bold text-indigo-700 mt-1">
                  {formatRupiah(activeCashAdvanceBalance)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Total pokok kasbon aktif yang sedang dicicil melalui potong gaji
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Status Pengajuan Aktif:</span>
                <span className="font-bold text-indigo-700">
                  {myCashAdvances.filter((c) => c.status === 'disbursed' || c.status === 'pending' || c.status === 'approved').length} Kasbon
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Potongan Cicilan Bulan Ini ({companyConfig.currentPayrollPeriod})
                </span>
                <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                  {formatRupiah(
                    myCashAdvances
                      .filter((c) => c.status === 'disbursed')
                      .reduce((sum, c) => {
                        const inst = c.installments.find(
                          (i) => i.period === companyConfig.currentPayrollPeriod
                        );
                        return sum + (inst ? inst.amount : 0);
                      }, 0)
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Otomatis terhubung dengan slip gaji bulanan Anda
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Rekening Pencairan:</span>
                <span className="font-mono font-bold text-slate-800">
                  {currentEmployee.bankName} - {currentEmployee.bankAccountNumber}
                </span>
              </div>
            </div>
          </div>

          {/* List of Employee Cash Advances & Installments */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-amber-600" />
                  <span>Riwayat Pengajuan Kasbon & Jadwal Cicilan Potong Gaji</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Terhubung langsung secara real-time dengan Panel Kasbon Admin HR & Finance Tas Grosir Import.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCashAdvanceAmount(Math.min(1500000, maxCashAdvancePlafon));
                  setCashAdvanceTenor(3);
                  setCashAdvanceReason('');
                  setCashAdvanceError(null);
                  setIsCashAdvanceModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Ajukan Kasbon Baru</span>
              </button>
            </div>

            {/* Ringkasan Status Pengajuan Kasbon (Menunggu, Disetujui/Aktif/Lunas, Ditolak) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl">
              <div className="flex items-center justify-between p-3 bg-amber-50/90 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-300">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-900 block">Menunggu Review</span>
                    <span className="text-[10px] text-amber-700">Verifikasi HR &amp; Finance</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-200/80 text-amber-950 border border-amber-300">
                  {myCashAdvances.filter((c) => c.status === 'pending').length} Kasbon
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-900 block">Disetujui / Dicairkan</span>
                    <span className="text-[10px] text-emerald-700">Aktif atau Lunas</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-200/80 text-emerald-950 border border-emerald-300">
                  {
                    myCashAdvances.filter(
                      (c) => c.status === 'approved' || c.status === 'disbursed' || c.status === 'paid'
                    ).length
                  }{' '}
                  Kasbon
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-rose-50/90 border border-rose-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-300">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-rose-900 block">Ditolak</span>
                    <span className="text-[10px] text-rose-700">Tidak disetujui Finance</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-200/80 text-rose-950 border border-rose-300">
                  {myCashAdvances.filter((c) => c.status === 'rejected').length} Kasbon
                </span>
              </div>
            </div>

            {myCashAdvances.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <HandCoins className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  Belum Ada Riwayat Pengajuan Kasbon
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Anda dapat mengajukan fasilitas pinjaman kasbon darurat karyawan dengan cicilan potong gaji otomatis hingga 12 bulan tanpa bunga.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myCashAdvances.map((ca) => {
                  const statusInfo =
                    ca.status === 'pending'
                      ? {
                          label: 'Menunggu Persetujuan HR/Finance',
                          cls: 'bg-amber-100 text-amber-900 border-amber-300',
                          isApproved: false,
                          isRejected: false,
                        }
                      : ca.status === 'approved'
                      ? {
                          label: 'Disetujui HRD (Menunggu Pencairan Transfer)',
                          cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                          isApproved: true,
                          isRejected: false,
                        }
                      : ca.status === 'disbursed'
                      ? {
                          label: 'Disetujui & Aktif Dicairkan (Sedang Dicicil)',
                          cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                          isApproved: true,
                          isRejected: false,
                        }
                      : ca.status === 'paid'
                      ? {
                          label: 'Disetujui & Lunas',
                          cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                          isApproved: true,
                          isRejected: false,
                        }
                      : {
                          label: 'Ditolak',
                          cls: 'bg-rose-100 text-rose-800 border-rose-300',
                          isApproved: false,
                          isRejected: true,
                        };

                  return (
                    <div
                      key={ca.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 space-y-4 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              #{ca.id.toUpperCase()}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.cls}`}
                            >
                              {statusInfo.isApproved ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              ) : statusInfo.isRejected ? (
                                <X className="w-3 h-3 text-rose-700" />
                              ) : (
                                <Clock className="w-3 h-3 text-amber-700" />
                              )}
                              <span>{statusInfo.label}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                              • Diajukan: {formatIndoDate(ca.createdAt.slice(0, 10))}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium mt-1.5">
                            <strong>Keperluan:</strong> &ldquo;{ca.reason}&rdquo;
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Nominal Pinjaman Kasbon
                          </span>
                          <span className="text-lg font-black text-slate-900">
                            {formatRupiah(ca.amount)}
                          </span>
                          <span className="text-[11px] text-amber-700 font-semibold block">
                            Tenor {ca.tenorMonths} Bulan ({formatRupiah(ca.monthlyInstallment)} / bln)
                          </span>
                        </div>
                      </div>

                      {/* Progress & Balance Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">Sudah Terpotong Gaji:</span>
                          <span className="font-bold text-emerald-700 text-sm">
                            {formatRupiah(ca.totalPaid)}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">Sisa Pokok Kasbon:</span>
                          <span className="font-bold text-indigo-700 text-sm">
                            {formatRupiah(ca.remainingBalance)}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">Info Pencairan / Otorisasi:</span>
                          <span className="font-semibold text-slate-800 text-[11px] block truncate">
                            {ca.disbursedAt
                              ? `${ca.disbursementMethod || 'Transfer'} (${ca.disbursementReference || '-'})`
                              : ca.approvedBy
                              ? `Disetujui oleh ${ca.approvedBy}`
                              : ca.rejectionReason
                              ? `Alasan ditolak: ${ca.rejectionReason}`
                              : 'Menunggu verifikasi Admin HR'}
                          </span>
                        </div>
                      </div>

                      {/* Installments Schedule Table */}
                      {ca.installments && ca.installments.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[11px] font-bold text-slate-600 block mb-2">
                            Jadwal Angsuran Potong Gaji ({ca.installments.length}x Cicilan):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {ca.installments.map((inst) => (
                              <div
                                key={inst.installmentNumber}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                                  inst.status === 'deducted'
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-[11px]">
                                    Cicilan ke-{inst.installmentNumber} ({inst.period})
                                  </div>
                                  <div className="font-mono font-bold text-xs">
                                    {formatRupiah(inst.amount)}
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    inst.status === 'deducted'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {inst.status === 'deducted' ? 'Lunas' : 'Terjadwal'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN KASBON BARU (PORTAL KARYAWAN) */}
      {isCashAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Form Pengajuan Kasbon Karyawan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Otomatis terkirim ke Panel Kasbon Admin HR & Finance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCashAdvanceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCashAdvance} className="space-y-4 text-xs">
              {cashAdvanceError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{cashAdvanceError}</span>
                </div>
              )}

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 block">
                    Pemohon Kasbon: <strong>{currentEmployee.fullName}</strong> ({currentEmployee.nik})
                  </span>
                  <span className="text-[11px] text-amber-900 font-bold">
                    Plafon Maksimum Kasbon: {formatRupiah(maxCashAdvancePlafon)}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800">
                  Bunga 0%
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Pinjaman Kasbon (Rp) *
                </label>
                <input
                  type="number"
                  min={100000}
                  max={maxCashAdvancePlafon}
                  step={50000}
                  required
                  value={cashAdvanceAmount}
                  onChange={(e) => setCashAdvanceAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-extrabold text-slate-900 focus:outline-hidden focus:border-amber-600"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[500000, 1000000, 2000000, 3000000, Math.round(maxCashAdvancePlafon * 0.5)]
                    .filter((v, idx, arr) => v <= maxCashAdvancePlafon && arr.indexOf(v) === idx)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashAdvanceAmount(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          cashAdvanceAmount === preset
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        {formatRupiah(preset)}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Pilih Tenor Cicilan Potong Gaji *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([1, 3, 6, 12] as CashAdvanceTenorMonths[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCashAdvanceTenor(t)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        cashAdvanceTenor === t
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t} Bulan
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-indigo-800 block">
                    Estimasi Potongan Gaji per Bulan ({cashAdvanceTenor}x Cicilan):
                  </span>
                  <span className="text-[10px] text-indigo-600">
                    Mulai periode payroll {companyConfig.currentPayrollPeriod}
                  </span>
                </div>
                <span className="text-base font-black text-indigo-900">
                  {formatRupiah(Math.round(cashAdvanceAmount / cashAdvanceTenor))} / bln
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan / Keperluan Pengajuan Kasbon *
                </label>
                <textarea
                  rows={3}
                  required
                  value={cashAdvanceReason}
                  onChange={(e) => setCashAdvanceReason(e.target.value)}
                  placeholder="Jelaskan keperluan pengajuan kasbon (contoh: Biaya pengobatan keluarga, perbaikan kendaraan kerja, biaya pendidikan anak, dll)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCashAdvanceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <HandCoins className="w-4 h-4" />
                  <span>Kirim Pengajuan Kasbon</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: ASET KANTOR & INVENTARIS SAYA */}
      {activePortalTab === 'assets' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Aset Dipegang
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                  {myAssets.length} <span className="text-sm font-normal text-slate-400">Unit</span>
                </h3>
                <p className="text-xs text-teal-600 mt-0.5">Tanggung jawab dinas aktif</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valuasi Fasilitas Kantor
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  {formatRupiah(myAssets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0))}
                </h3>
                <p className="text-xs text-emerald-600 mt-0.5">Inventaris Tas Grosir Import</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Kondisi Fasilitas
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  {myAssets.filter((a) => a.condition === 'Baik').length} / {myAssets.length}{' '}
                  <span className="text-xs font-normal text-slate-400">Normal</span>
                </h3>
                <p className="text-xs text-indigo-600 mt-0.5">Siap menunjang kerja</p>
              </div>
            </div>
          </div>

          {/* List of Held Assets */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Daftar Fasilitas & Aset Kantor yang Sedang Anda Pegang
                </h3>
                <p className="text-xs text-slate-500">
                  Harap jaga dan rawat inventaris perusahaan yang diamanahkan kepada Anda dengan sebaik-baiknya
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-teal-50 text-teal-800 rounded-lg border border-teal-200 self-start sm:self-auto">
                {myAssets.length} Aset Terdaftar atas Nama Anda
              </span>
            </div>

            {myAssets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Boxes className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700 text-sm">
                  Saat ini tidak ada aset atau fasilitas kantor yang tercatat atas nama Anda.
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Jika Anda telah menerima laptop, scanner barcode, atau fasilitas operasional lain dari HR/Operasional, hubungi admin untuk verifikasi penugasan aset.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 shadow-xs space-y-3 relative group hover:border-teal-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                          {asset.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                          {asset.name}
                        </h4>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">{asset.assetCode}</span>
                          {asset.serialNumber && <span>• SN: {asset.serialNumber}</span>}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          asset.condition === 'Baik'
                            ? 'bg-emerald-100 text-emerald-800'
                            : asset.condition === 'Perlu Perbaikan'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {asset.condition}
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tanggal Diserahkan:</span>
                        <span className="font-semibold text-slate-800">{asset.assignedDate || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Nilai Aset Resmi:</span>
                        <span className="font-semibold text-slate-800">{formatRupiah(asset.purchaseCost)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Masa Garansi:</span>
                        <span className="text-slate-700">{asset.warrantyExpiry || 'Tidak tercatat'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Lokasi Penempatan:</span>
                        <span className="text-slate-700 truncate block">{asset.location || 'Kantor / Gudang TGI'}</span>
                      </div>
                    </div>

                    {asset.handoverConditionNotes && (
                      <div className="p-2.5 bg-slate-100/80 rounded-xl text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700 block text-[10px] uppercase">
                          Catatan Serah Terima:
                        </span>
                        <p className="mt-0.5 italic">{asset.handoverConditionNotes}</p>
                      </div>
                    )}

                    {asset.specifications && (
                      <p className="text-[11px] text-slate-500">
                        <strong>Spesifikasi:</strong> {asset.specifications}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Terdaftar resmi di HR & IT TGI
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onReportAssetIssue) {
                            onReportAssetIssue(
                              asset.id,
                              `Laporan kendala pada aset ${asset.name} (${asset.assetCode})`
                            );
                          }
                          setReportedAssetNotice(
                            `Laporan kendala inventaris ${asset.name} (${asset.assetCode}) telah diteruskan ke tim IT & HR Tas Grosir Import.`
                          );
                          setTimeout(() => setReportedAssetNotice(null), 5000);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Laporkan Kendala</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reportedAssetNotice && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{reportedAssetNotice}</span>
                </span>
                <button
                  onClick={() => setReportedAssetNotice(null)}
                  className="text-indigo-500 hover:text-indigo-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: RAPOR PENILAIAN KINERJA & KPI PRIBADI */}
      {activePortalTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  Rapor Penilaian Kinerja & Evaluasi KPI Pribadi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hasil penilaian berkala dari atasan/manajemen Tas Grosir Import beserta catatan feedback pembinaan dan insentif bonus.
                </p>
              </div>

              {myReviews.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                    {myReviews.length} Periode Evaluasi
                  </span>
                </div>
              )}
            </div>

            {myReviews.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">Belum Ada Catatan Penilaian Kinerja</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Atasan atau tim HRD belum merilis lembar evaluasi berkala untuk akun Anda pada periode saat ini.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {myReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 shadow-xs space-y-4"
                  >
                    {/* Header Review */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            Periode Evaluasi: {rev.period}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                            {rev.periodType}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Dinilai oleh: <strong>{rev.reviewerName}</strong> ({rev.reviewerRole}) • Tgl: {formatIndoDate(rev.reviewDate)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">SKOR AKHIR</span>
                          <span className="text-2xl font-black text-slate-900 leading-tight">
                            {rev.finalScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                          </span>
                        </div>
                        <div className="pl-3 border-l border-slate-200 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                            rev.grade === 'A+' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            rev.grade === 'A' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                            rev.grade === 'B+' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            rev.grade === 'B' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            Grade {rev.grade}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Komponen Penilaian */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>KPI (Bobot 40%)</span>
                          <span className="font-bold text-indigo-700">{rev.kpiScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.kpiScore)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>Kedisiplinan (20%)</span>
                          <span className="font-bold text-teal-700">{rev.disciplineScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.disciplineScore)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>Kerjasama Tim (20%)</span>
                          <span className="font-bold text-blue-700">{rev.teamworkScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.teamworkScore)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>Inisiatif (20%)</span>
                          <span className="font-bold text-purple-700">{rev.initiativeScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.initiativeScore)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Feedback & Catatan Tertulis Atasan */}
                    <div className="space-y-2.5 text-xs">
                      {rev.strengthsNotes && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                          <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
                            Kelebihan & Prestasi Anda
                          </span>
                          <p className="text-slate-700 mt-1 text-[11px] leading-relaxed">
                            {rev.strengthsNotes}
                          </p>
                        </div>
                      )}

                      {rev.improvementsNotes && (
                        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                            Area yang Perlu Ditingkatkan
                          </span>
                          <p className="text-slate-700 mt-1 text-[11px] leading-relaxed">
                            {rev.improvementsNotes}
                          </p>
                        </div>
                      )}

                      {rev.generalFeedback && (
                        <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
                          <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
                            <Star className="w-3.5 h-3.5 text-indigo-700" />
                            Pesan & Ulasan Keseluruhan dari Atasan
                          </span>
                          <p className="text-slate-700 mt-1 text-[11px] leading-relaxed italic">
                            &ldquo;{rev.generalFeedback}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bonus Insentif Kinerja Terintegrasi */}
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-900 block">
                          Bonus Insentif Kinerja untuk Periode Ini:
                        </span>
                        <span className="text-base font-extrabold text-emerald-800">
                          {formatRupiah(rev.recommendedBonus)}
                        </span>
                      </div>
                      <div>
                        {rev.isBonusAppliedToPayroll ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-full font-bold text-xs shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Telah Dicairkan / Disinkronkan ke Slip Gaji ({rev.payrollPeriodApplied || rev.period})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-semibold text-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Menunggu Jadwal Pencairan Payroll
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PROFIL & DATA REKENING PRIBADI */}
      {activePortalTab === 'profile' && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Profil, Identitas Resmi (NIK KTP &amp; NPWP), Kontrak Kerja &amp; Rekening Bank
              </h3>
              <p className="text-xs text-slate-500">
                Kelola Photo Profil, Nomor NIK KTP (16 Digit), Nomor NPWP (terintegrasi Pajak PPh 21 Admin HR), dokumen kontrak kerja, dan rekening gaji
              </p>
            </div>
            {profileSuccessMsg && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Data berhasil diperbarui &amp; tersinkronisasi ke Admin!
              </span>
            )}
          </div>

          {profileUploadBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{profileUploadBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileUploadBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {profileUploadError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{profileUploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileUploadError(null)}
                className="text-rose-700 hover:text-rose-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* SEKSI 1: PHOTO PROFIL & IDENTITAS PAJAK (NIK KTP 16 DIGIT + NPWP) */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/70 via-white to-indigo-50/50 rounded-2xl border border-emerald-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-900">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Photo Profil, Nomor NIK KTP (16 Digit) &amp; Nomor NPWP Pajak
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                      Sinkron Otomatis ke Portal Admin HR &amp; PPh 21
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Unggah Photo Profil Anda dan lengkapi Nomor NIK KTP 16 digit beserta Nomor NPWP (mendukung format 15/16 digit &amp; pemadanan NIK-NPWP Coretax DJP).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    NIK KTP: {isFormKtpNumberValid ? 'Valid (16 Digit)' : 'Belum Lengkap'} • NPWP:{' '}
                    {formNpwpStatus.isValid ? 'Terdaftar' : 'Belum Diisi'}
                  </span>
                </div>
              </div>

              {/* Live Camera Viewfinder when taking Photo Profil */}
              {activeDocCameraMode === 'profile' && (
                <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 border border-slate-700 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold">
                        Kamera Aktif: Ambil Photo Profil Wajah
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={stopDocCamera}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Tutup Kamera
                    </button>
                  </div>

                  <div className="relative mx-auto overflow-hidden rounded-xl bg-black border-2 border-emerald-500/60 flex items-center justify-center w-full max-w-[260px] aspect-square">
                    <video
                      ref={docCameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-full pointer-events-none" />
                  </div>

                  <div className="flex items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={captureDocCameraPhoto}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Jepret &amp; Simpan Photo Profil</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopDocCamera}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Grid 2 Kartu: 1. Photo Profil & 2. Identitas NIK KTP 16 Digit + NPWP */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ITEM 1: UPLOAD PHOTO PROFIL */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                          Photo Profil Karyawan
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Digunakan di Portal Karyawan, Verifikasi Wajah &amp; Data Karyawan Admin HR
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      ✓ Terintegrasi Admin
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div className="relative group shrink-0">
                      <img
                        src={
                          profileForm.avatarUrl ||
                          currentEmployee.avatarUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                        }
                        alt={currentEmployee.fullName}
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: `Photo Profil — ${currentEmployee.fullName}`,
                            subtitle: `NIK: ${currentEmployee.nik} • Terintegrasi dengan Portal Admin HR`,
                            imageUrl:
                              profileForm.avatarUrl ||
                              currentEmployee.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
                            downloadFileName: `Foto-Profil-${currentEmployee.nik}.jpg`,
                          })
                        }
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-2 ring-emerald-500 shadow-md cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: `Photo Profil — ${currentEmployee.fullName}`,
                            subtitle: `NIK: ${currentEmployee.nik} • Terintegrasi dengan Portal Admin HR`,
                            imageUrl:
                              profileForm.avatarUrl ||
                              currentEmployee.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
                            downloadFileName: `Foto-Profil-${currentEmployee.nik}.jpg`,
                          })
                        }
                        className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-slate-900/75 text-white hover:bg-slate-900 cursor-pointer"
                        title="Lihat Photo Profil"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                      <div className="text-xs font-bold text-slate-800">
                        {currentEmployee.fullName} ({currentEmployee.nik})
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {currentEmployee.profilePhotoUpdatedAt
                          ? `Terakhir diperbarui: ${currentEmployee.profilePhotoUpdatedAt}`
                          : 'Format JPG, PNG, atau WebP (Otomatis dikompresi maks. 800px & disinkronkan ke Admin)'}
                      </p>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <label className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isProcessingProfilePhoto ? 'Mengunggah...' : 'Upload Photo Profil'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            onChange={handleUploadProfilePhotoFile}
                            disabled={isProcessingProfilePhoto}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            activeDocCameraMode === 'profile'
                              ? stopDocCamera()
                              : startDocCamera('profile')
                          }
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {activeDocCameraMode === 'profile' ? 'Tutup Kamera' : 'Kamera Selfie'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ITEM 2: IDENTITAS RESMI NIK KTP (16 DIGIT) & NOMOR NPWP PAJAK PPH 21 */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                          Nomor NIK KTP (16 Digit) &amp; Nomor NPWP Pajak
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Tanpa perlu unggah foto KTP — cukup isi NIK 16 digit &amp; NPWP untuk kalkulasi PPh 21 TER
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isFormKtpNumberValid
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {isFormKtpNumberValid ? '✓ NIK 16 Digit Valid' : 'Wajib 16 Digit'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3.5">
                    {/* Input Wajib Isi (Required): Nomor NIK KTP (16 Digit) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <span>Nomor NIK KTP (16 Digit)</span>
                          <span className="text-rose-600 font-extrabold">* (Wajib Diisi)</span>
                        </label>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            isFormKtpNumberValid
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {(profileForm.ktpNumber || '').length}/16 Digit Angka
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          minLength={16}
                          maxLength={16}
                          pattern="\d{16}"
                          value={profileForm.ktpNumber}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 16);
                            setProfileForm({
                              ...profileForm,
                              ktpNumber: digitsOnly,
                            });
                            if (profileUploadError && digitsOnly.length === 16) {
                              setProfileUploadError(null);
                            }
                          }}
                          placeholder="Ketik 16 digit angka NIK sesuai KTP (Contoh: 3171012345670001)"
                          className={`flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border rounded-xl focus:outline-hidden ${
                            isFormKtpNumberValid
                              ? 'border-emerald-400 text-slate-900 focus:ring-2 focus:ring-emerald-500/20'
                              : 'border-amber-400 text-slate-900 focus:ring-2 focus:ring-rose-500/20'
                          }`}
                        />
                        {isFormKtpNumberValid &&
                          profileForm.ktpNumber !== currentEmployee.ktpNumber && (
                            <button
                              type="button"
                              onClick={() => {
                                const cleaned = profileForm.ktpNumber.replace(/\D/g, '').trim();
                                if (!/^\d{16}$/.test(cleaned)) return;
                                onUpdateProfile({
                                  ...currentEmployee,
                                  ktpNumber: cleaned,
                                });
                                setProfileUploadBanner(
                                  `Nomor NIK KTP (${cleaned}) berhasil disimpan & disinkronkan ke Panel Admin HR!`
                                );
                                setTimeout(() => setProfileUploadBanner(null), 4500);
                              }}
                              className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan NIK</span>
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Input Nomor NPWP (15/16 Digit atau Pemadanan NIK-NPWP) */}
                    <div className="pt-2.5 border-t border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>Nomor NPWP (15 / 16 Digit)</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold">
                            PPh 21 TER 2026
                          </span>
                        </label>
                        {isFormKtpNumberValid && (
                          <button
                            type="button"
                            onClick={() => {
                              const nikDigits = profileForm.ktpNumber.replace(/\D/g, '').slice(0, 16);
                              setProfileForm((prev) => ({
                                ...prev,
                                npwp: nikDigits,
                              }));
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            Samakan NPWP = NIK KTP 16 Digit (Coretax DJP)
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={profileForm.npwp}
                          onChange={(e) => {
                            const formatted = formatNpwpInput(e.target.value);
                            setProfileForm({
                              ...profileForm,
                              npwp: formatted,
                            });
                          }}
                          placeholder="Contoh: 12.345.678.9-012.000 atau 16 digit NIK KTP"
                          className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-indigo-500 text-slate-900"
                        />
                        {profileForm.npwp.trim() !== (currentEmployee.npwp || '').trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanedNpwp = profileForm.npwp.trim();
                              onUpdateProfile({
                                ...currentEmployee,
                                ktpNumber: isFormKtpNumberValid
                                  ? profileForm.ktpNumber.replace(/\D/g, '')
                                  : currentEmployee.ktpNumber,
                                npwp: cleanedNpwp,
                              });
                              setProfileUploadBanner(
                                `Nomor NPWP (${cleanedNpwp || 'Kosong'}) berhasil diperbarui & terintegrasi ke tabel Data Karyawan dan Pajak PPh 21 Admin HR!`
                              );
                              setTimeout(() => setProfileUploadBanner(null), 4500);
                            }}
                            className="min-h-[36px] px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Update NPWP</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-semibold ${
                            formNpwpStatus.isValid ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          Status Pajak: {formNpwpStatus.label}
                        </span>
                        <span className="text-slate-400">PTKP: {currentEmployee.ptkpStatus}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEKSI 2: MASA AKTIF KONTRAK KERJA & DOKUMEN KONTRAK KERJA (PKWT / PKWTT) */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        Masa Aktif Kontrak &amp; Dokumen Kontrak Kerja ({currentEmployee.employmentStatus})
                      </h4>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          contractValidity.isPermanent
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 7
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 30
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            contractValidity.isPermanent
                              ? 'bg-indigo-600'
                              : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 7
                              ? 'bg-rose-600 animate-ping'
                              : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 30
                              ? 'bg-amber-600'
                              : 'bg-emerald-600'
                          }`}
                        />
                        <span>{contractValidity.badgeText}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Dikelola oleh Admin HRD Tas Grosir Import • Tersinkronisasi langsung dari menu Data Karyawan
                    </p>
                  </div>
                </div>

                {currentEmployee.contractDocumentUrl ? (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDocumentModal({
                          title: `Dokumen Kontrak Kerja — ${currentEmployee.fullName}`,
                          subtitle: `${
                            currentEmployee.contractDocumentNumber || currentEmployee.employmentStatus
                          } • Masa Berlaku: ${currentEmployee.contractStartDate || currentEmployee.joinDate} s/d ${
                            currentEmployee.contractEndDate || 'Tetap (PKWTT)'
                          }`,
                          imageUrl: currentEmployee.contractDocumentUrl!,
                          downloadFileName:
                            currentEmployee.contractDocumentName ||
                            `Kontrak-Kerja-${currentEmployee.nik}.jpg`,
                        })
                      }
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Dokumen Kontrak</span>
                    </button>
                    <a
                      href={currentEmployee.contractDocumentUrl}
                      download={
                        currentEmployee.contractDocumentName ||
                        `Kontrak-Kerja-${currentEmployee.nik}.jpg`
                      }
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Unduh Kontrak</span>
                    </a>
                  </div>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold">
                    Dokumen fisik/digital belum diunggah oleh Admin HR
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Status Perjanjian Kerja</span>
                  <span className="font-extrabold text-slate-900 mt-0.5 block">
                    {currentEmployee.employmentStatus}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {currentEmployee.contractDocumentNumber || 'No. SK / Kontrak Standar HR'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Tanggal Mulai Kontrak</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {currentEmployee.contractStartDate
                      ? formatDateID(currentEmployee.contractStartDate)
                      : formatDateID(currentEmployee.joinDate)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Tgl Bergabung: {formatDateID(currentEmployee.joinDate)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Tanggal Berakhir Kontrak</span>
                  <span
                    className={`font-bold mt-0.5 block ${
                      contractValidity.isPermanent
                        ? 'text-indigo-700'
                        : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 7
                        ? 'text-rose-700'
                        : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 30
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {contractValidity.isPermanent
                      ? 'Tidak Terbatas (Karyawan Tetap)'
                      : currentEmployee.contractEndDate
                      ? formatDateID(currentEmployee.contractEndDate)
                      : 'Belum Ditentukan HR'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentEmployee.contractUpdatedAt
                      ? `Diperbarui HR: ${currentEmployee.contractUpdatedAt}`
                      : 'Terdaftar di Master Data HR'}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    contractValidity.isPermanent
                      ? 'bg-indigo-50/70 border-indigo-200'
                      : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 7
                      ? 'bg-rose-50 border-rose-300'
                      : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 30
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-emerald-50/80 border-emerald-300'
                  }`}
                >
                  <span className="text-[11px] text-slate-600 block">Indikator Masa Aktif Kontrak</span>
                  <span
                    className={`font-extrabold mt-0.5 block ${
                      contractValidity.isPermanent
                        ? 'text-indigo-800'
                        : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 7
                        ? 'text-rose-800'
                        : contractValidity.daysRemaining !== null && contractValidity.daysRemaining <= 30
                        ? 'text-amber-900'
                        : 'text-emerald-800'
                    }`}
                  >
                    {contractValidity.badgeText}
                  </span>
                  {!contractValidity.isPermanent && contractValidity.daysRemaining !== null && (
                    <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
                      <div
                        className={`h-full rounded-full ${
                          contractValidity.daysRemaining <= 7
                            ? 'bg-rose-600'
                            : contractValidity.daysRemaining <= 30
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${contractValidity.progressPercent}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[9px] font-bold text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Hijau &gt;30 hr
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Kuning ≤30 hr
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Merah ≤7 hr
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Read-Only Employment Master Data */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Data Kepegawaian Resmi &amp; Identitas Terdaftar (Sinkronisasi Admin HR)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor Induk Karyawan:</span>
                  <span className="font-mono font-bold text-slate-800">{currentEmployee.nik}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor NIK KTP (16 Digit):</span>
                  {currentEmployee.ktpNumber && /^\d{16}$/.test(currentEmployee.ktpNumber) ? (
                    <span className="font-mono font-bold text-indigo-700">
                      {currentEmployee.ktpNumber}
                    </span>
                  ) : (
                    <span className="font-semibold text-rose-600">Belum dilengkapi</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Departemen:</span>
                  <span className="font-semibold text-slate-800">{currentEmployee.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Posisi / Jabatan:</span>
                  <span className="font-semibold text-slate-800">{currentEmployee.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status Ikatan Kerja:</span>
                  <span className="font-semibold text-emerald-700">{currentEmployee.employmentStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor NPWP Terdaftar:</span>
                  <span className="font-mono font-bold text-slate-800">{currentEmployee.npwp || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">No. BPJS Kesehatan:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.bpjsKesehatanNo || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">No. BPJS Ketenagakerjaan:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.bpjsKetenagakerjaanNo || '-'}</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-emerald-800 font-semibold block text-[10px]">Tarif Gaji Per Jam:</span>
                  <span className="font-extrabold text-emerald-700 text-xs">
                    {formatRupiah(myHourlyRate)} / jam
                  </span>
                </div>
                <div className="p-2 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                  <span className="text-slate-600 font-semibold block text-[10px]">Gaji Harian (Std {myStandardDailyHours} Jam):</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatRupiah(myDailySalary)} / hari
                  </span>
                </div>
              </div>
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Kontak & Domisili */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    Informasi Kontak WhatsApp &amp; Email Notifikasi
                  </h4>
                  {(profileForm.phone !== currentEmployee.phone ||
                    profileForm.email !== currentEmployee.email) && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated: Employee = {
                          ...currentEmployee,
                          phone: profileForm.phone.trim(),
                          email: profileForm.email.trim(),
                        };
                        onUpdateProfile(updated);
                        setProfileUploadBanner(
                          `Nomor WhatsApp (${
                            formatWhatsAppPhone(profileForm.phone) || '-'
                          }) & Email (${
                            profileForm.email
                          }) berhasil disimpan dan disinkronkan ke Supabase!`
                        );
                        setTimeout(() => setProfileUploadBanner(null), 4500);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Simpan WA &amp; Email</span>
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-slate-600">
                      Nomor Telepon / WhatsApp Aktif
                    </label>
                    <span className="text-[10px] font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      Format WA: {formatWhatsAppPhone(profileForm.phone) ? `+${formatWhatsAppPhone(profileForm.phone)}` : 'Belum diisi'}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="Contoh: 0812-3456-7890 (Otomatis diformat ke 628...)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Digunakan untuk menerima notifikasi Slip Gaji, Persetujuan Cuti/Kasbon &amp; Kontrak via WhatsApp
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Alamat Email (Penerima Slip Gaji Resmi)
                  </label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="nama@tasgrosirimport.co.id"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Akun Google Terhubung (SSO)</label>
                  <input
                    type="email"
                    value={profileForm.googleEmail}
                    onChange={(e) => setProfileForm({ ...profileForm, googleEmail: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Alamat Tempat Tinggal (Domisili)</label>
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Rekening Bank & Kontak Darurat */}
              <div className="space-y-3.5">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Rekening Bank Penerima Gaji
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Nama Bank</label>
                    <select
                      value={profileForm.bankName}
                      onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value as any })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                    >
                      <option value="BCA">BCA (Bank Central Asia)</option>
                      <option value="Mandiri">Bank Mandiri</option>
                      <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                      <option value="BNI">Bank Negara Indonesia (BNI)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      required
                      value={profileForm.bankAccountNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Nama Pemilik Rekening (Sesuai Buku Tabungan)</label>
                  <input
                    type="text"
                    required
                    value={profileForm.bankAccountHolder}
                    onChange={(e) => setProfileForm({ ...profileForm, bankAccountHolder: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    Kontak Darurat (Emergency Contact)
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Nama Kontak Darurat</label>
                      <input
                        type="text"
                        value={profileForm.emergencyName}
                        onChange={(e) => setProfileForm({ ...profileForm, emergencyName: e.target.value })}
                        placeholder="Contoh: Rina (Istri)"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Hubungan</label>
                      <input
                        type="text"
                        value={profileForm.emergencyRelation}
                        onChange={(e) => setProfileForm({ ...profileForm, emergencyRelation: e.target.value })}
                        placeholder="Pasangan / Orang Tua"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">No. Telp Darurat</label>
                    <input
                      type="text"
                      value={profileForm.emergencyPhone}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyPhone: e.target.value })}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan Perubahan Data Profil
              </button>
            </div>
          </form>

          {/* SEKSI 3: MENU UBAH PASSWORD / KATA SANDI MANDIRI (SUPABASE AUTH & PIN PORTAL) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">
                      Ubah Kata Sandi / Password Mandiri
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Tersinkronisasi ke Supabase Auth
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Perbarui password/PIN akses akun Portal Karyawan Anda secara mandiri dan aman tanpa perlu menunggu Admin HR.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswordText((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
              >
                {showPasswordText ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                    <span>Sembunyikan Karakter</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Tampilkan Karakter</span>
                  </>
                )}
              </button>
            </div>

            {passwordChangeSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordChangeSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordChangeSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {passwordChangeError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passwordChangeError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordChangeError(null)}
                  className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSelfChangePassword} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Kata Sandi / PIN Saat Ini <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      required
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      placeholder="Masukkan password saat ini"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Verifikasi kredensial aktif Anda ({currentEmployee.nik})
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Kata Sandi / PIN Baru <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      placeholder="Minimal 6 karakter / angka"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Minimal 6 karakter (kombinasi angka/huruf didukung)
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      placeholder="Ulangi kata sandi baru"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pastikan sama persis dengan Kata Sandi Baru
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Perubahan password langsung berlaku untuk login Portal Karyawan berikutnya dan disinkronkan ke Supabase.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>
                    {isUpdatingPassword ? 'Memperbarui Kata Sandi...' : 'Perbarui Kata Sandi Mandiri'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN CUTI */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Form Pengajuan Cuti & Izin</h3>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-3.5 text-xs">
              {leaveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-xs">{leaveError}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Cuti / Izin *</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {leaveForm.type === 'Cuti Tahunan' && (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Sisa jatah cuti tahunan Anda: <strong>{currentEmployee.remainingLeaveDays} hari</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600">Total Durasi Hari Kerja:</span>
                <span className="font-bold text-slate-900 text-sm">{calculatedLeaveDays} Hari</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan / Keperluan Cuti *</label>
                <textarea
                  required
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Jelaskan alasan pengajuan cuti secara singkat dan jelas..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              {/* Upload Gambar Bukti Pendukung (Surat Dokter / Bukti Izin - Kompresi Otomatis) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">
                    Upload Gambar Bukti Pendukung (Surat Dokter / Bukti Izin)
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600">
                    Kompresi Otomatis JPEG
                  </span>
                </div>

                {leaveForm.attachmentUrl ? (
                  <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={leaveForm.attachmentUrl}
                        alt="Preview Bukti Cuti"
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: 'Pratinjau Bukti Cuti & Izin',
                            subtitle: leaveForm.attachmentName || 'Bukti Pendukung',
                            imageUrl: leaveForm.attachmentUrl,
                            downloadFileName: leaveForm.attachmentName || 'Bukti-Cuti.jpg',
                          })
                        }
                        className="w-12 h-12 rounded-lg object-cover border border-indigo-300 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {leaveForm.attachmentName || 'Bukti-Cuti-Izin.jpg'}
                        </p>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          ✓ Gambar telah dikompresi &amp; siap dikirim ke Admin HR
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: 'Pratinjau Bukti Cuti & Izin',
                            subtitle: leaveForm.attachmentName || 'Bukti Pendukung',
                            imageUrl: leaveForm.attachmentUrl,
                            downloadFileName: leaveForm.attachmentName || 'Bukti-Cuti.jpg',
                          })
                        }
                        className="p-1.5 rounded-lg bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                        title="Perbesar Bukti"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLeaveForm((prev) => ({
                            ...prev,
                            attachmentUrl: '',
                            attachmentName: '',
                          }))
                        }
                        className="p-1.5 rounded-lg bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                        title="Hapus Gambar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-slate-700">
                      {isCompressingLeaveAttachment
                        ? 'Mengompresi gambar bukti...'
                        : 'Klik untuk pilih / foto Surat Dokter atau Bukti Izin'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Format JPG, PNG, WebP (Otomatis dikompresi maks. 800px agar ringan)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleUploadLeaveAttachment}
                      disabled={isCompressingLeaveAttachment}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCompressingLeaveAttachment}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  Kirim Permohonan Cuti
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN LEMBUR (HITUNGAN PER MENIT) */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Form Pengajuan Lembur (Hitungan Per Menit)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pilih jam mulai & selesai atau ketik langsung durasi menit lembur Anda
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOvertimeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOvertime} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Lembur *</label>
                  <input
                    type="date"
                    required
                    value={overtimeForm.date}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={overtimeForm.startTime}
                    onChange={(e) => handleOvertimeTimeRangeChange(e.target.value, overtimeForm.endTime)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={overtimeForm.endTime}
                    onChange={(e) => handleOvertimeTimeRangeChange(overtimeForm.startTime, e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Jumlah Durasi Lembur (Menit) *
                  </label>
                  <span className="text-[11px] font-bold text-indigo-600">
                    Setara: {formatOvertimeMinutes(overtimeForm.minutes)}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={720}
                  step={1}
                  required
                  value={overtimeForm.minutes}
                  onChange={(e) =>
                    setOvertimeForm({ ...overtimeForm, minutes: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono font-bold text-sm text-slate-900"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[15, 30, 45, 60, 90, 120, 150, 180, 240].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOvertimeForm({ ...overtimeForm, minutes: preset })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        overtimeForm.minutes === preset
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {preset} Menit
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Tarif Lembur Anda per Menit:</span>
                  <span className="font-mono font-bold">{formatCurrency(myOvertimeRatePerMinute)} / menit</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Rumus Kalkulasi:</span>
                  <span className="font-mono font-semibold">
                    {overtimeForm.minutes} menit × {formatCurrency(myOvertimeRatePerMinute)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-indigo-200/80 flex items-center justify-between">
                  <span className="font-bold text-indigo-950">Estimasi Kompensasi Lembur:</span>
                  <span className="font-black text-indigo-900 text-sm">
                    {formatCurrency(estimatedOvertimePay)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian Tugas Lembur *</label>
                <textarea
                  required
                  rows={3}
                  value={overtimeForm.taskDescription}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, taskDescription: e.target.value })}
                  placeholder="Jelaskan pekerjaan atau target operasional yang diselesaikan saat lembur..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Kirim Klaim Lembur ({overtimeForm.minutes} Menit)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN REIMBURSEMENT */}
      {isReimbursementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Form Pengajuan Reimbursement</h3>
              </div>
              <button
                onClick={() => setIsReimbursementModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReimbursement} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Biaya *</label>
                  <select
                    value={reimbursementForm.category}
                    onChange={(e) => setReimbursementForm({ ...reimbursementForm, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  >
                    {REIMBURSEMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal Biaya (Rp) *</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={reimbursementForm.amount}
                    onChange={(e) => setReimbursementForm({ ...reimbursementForm, amount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Pencairan Pilihan</label>
                <select
                  value={reimbursementForm.paymentMethod}
                  onChange={(e) => setReimbursementForm({ ...reimbursementForm, paymentMethod: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                >
                  <option value="Transfer Bank">Transfer ke Rekening Gaji ({currentEmployee.bankName})</option>
                  <option value="Kas Kecil (Petty Cash)">Kas Kecil Tunai (Petty Cash Kantor)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Pengeluaran *</label>
                <textarea
                  required
                  rows={2}
                  value={reimbursementForm.description}
                  onChange={(e) => setReimbursementForm({ ...reimbursementForm, description: e.target.value })}
                  placeholder="Contoh: Bensin & e-toll pengantaran pesanan tas reseller Mangga Dua..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lampiran Foto Nota / Struk Bukti *</label>
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-600 font-medium">
                    {reimbursementForm.receiptFileName || 'Klik untuk pilih foto struk / nota'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.xlsx,.csv"
                    onChange={handleSimulatedFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReimbursementModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  Kirim Klaim Reimbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW NOTA */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Bukti Kwitansi / Struk Klaim</h4>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={previewReceiptUrl}
                alt="Nota Klaim"
                className="w-full h-80 object-cover"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW PHOTO PROFIL & DOKUMEN KTP */}
      {previewDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewDocumentModal.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{previewDocumentModal.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocumentModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center max-h-[65vh]">
              <img
                src={previewDocumentModal.imageUrl}
                alt={previewDocumentModal.title}
                className="w-full max-h-[62vh] object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Tersinkronisasi dengan Portal Admin HR
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewDocumentModal.imageUrl}
                  download={previewDocumentModal.downloadFileName || 'Dokumen-Karyawan.jpg'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDocumentModal(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  Tutup Pratinjau
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilih Identitas / Ganti Akun Karyawan (Dilindungi PIN per Akun) */}
      {isSwitchProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Ganti Akun Portal Karyawan (Verifikasi PIN)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Setiap akun karyawan dilindungi PIN khusus agar privasi slip gaji tetap aman
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSwitchProfileModalOpen(false);
                  setPendingSwitchEmp(null);
                  setSwitchPinInput('');
                  setSwitchPinError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pendingSwitchEmp ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const verifyRes = await verifyEmployeeLoginSecure(
                    pendingSwitchEmp.nik || pendingSwitchEmp.id,
                    switchPinInput.trim()
                  );
                  const expected = getEmployeeEffectivePin(pendingSwitchEmp, '');
                  const isAllowed =
                    Boolean(isAdminUnlocked && onSelectEmployee) &&
                    (verifyRes.authenticated ||
                      (expected && expected !== '••••' && switchPinInput.trim() === expected));
                  if (isAllowed && onSelectEmployee) {
                    onSelectEmployee(pendingSwitchEmp.id);
                    setIsSwitchProfileModalOpen(false);
                    setPendingSwitchEmp(null);
                    setSwitchPinInput('');
                    setSwitchPinError(null);
                  } else {
                    setSwitchPinError(
                      `PIN salah untuk akun ${pendingSwitchEmp.fullName} (${pendingSwitchEmp.nik})!`
                    );
                  }
                }}
                className="space-y-3"
              >
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-950">
                      {pendingSwitchEmp.fullName}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono">
                      {pendingSwitchEmp.nik} • {pendingSwitchEmp.department}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSwitchEmp(null);
                      setSwitchPinInput('');
                      setSwitchPinError(null);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Ubah Pilihan
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Masukkan PIN / Password Akun {pendingSwitchEmp.fullName}:
                  </label>
                  <input
                    type="password"
                    value={switchPinInput}
                    onChange={(e) => {
                      setSwitchPinInput(e.target.value);
                      setSwitchPinError(null);
                    }}
                    placeholder="Masukkan PIN khusus akun karyawan ini"
                    autoFocus
                    maxLength={12}
                    className="w-full px-3 py-2.5 text-center font-mono text-base font-bold tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                {switchPinError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                    {switchPinError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSwitchEmp(null);
                      setSwitchPinInput('');
                      setSwitchPinError(null);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                  >
                    Verifikasi & Buka Akun
                  </button>
                </div>
              </form>
            ) : (
              <>
                <input
                  type="text"
                  value={profileSearchQuery}
                  onChange={(e) => setProfileSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NIK Anda..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                  {allEmployees
                    .filter(
                      (e) =>
                        e.fullName.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
                        e.nik.toLowerCase().includes(profileSearchQuery.toLowerCase())
                    )
                    .map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          if (emp.id === currentEmployee.id) {
                            setIsSwitchProfileModalOpen(false);
                            return;
                          }
                          setPendingSwitchEmp(emp);
                          setSwitchPinInput('');
                          setSwitchPinError(null);
                        }}
                        className={`w-full p-3 text-left flex items-center justify-between hover:bg-emerald-50 transition-colors cursor-pointer ${
                          emp.id === currentEmployee.id ? 'bg-emerald-50/70' : ''
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{emp.fullName}</div>
                          <div className="text-[11px] text-slate-500">
                            {emp.nik} •{' '}
                            {(emp.role || '').trim().toLowerCase() ===
                            (emp.department || '').trim().toLowerCase()
                              ? emp.role
                              : `${emp.role} (${emp.department})`}
                          </div>
                        </div>
                        {emp.id === currentEmployee.id ? (
                          <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
                            🔒 Perlu PIN
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: MODUL TRANSPARANSI KOMISI PENJUALAN HOST & CO-HOST LIVE STREAMING (READ-ONLY — HANYA JIKA is_host === true ATAU is_co_host === true) */}
      {canAccessLiveCommissionPanel && activePortalTab === 'live_commission' && (() => {
        const pctRate = Math.max(0, Number(currentEmployee.salesCommissionPercentage) || 0);
        const pcsRate = Math.max(0, Number(currentEmployee.salesCommissionPerPcs) || 0);
        const coHostPctRate = Math.max(0, Number(currentEmployee.coHostCommissionPercentage) || 0);
        const coHostPcsRate = Math.max(0, Number(currentEmployee.coHostCommissionPerPcs) || 0);

        return (
          <div className="space-y-6 animate-in fade-in">
            {/* Banner Header Host & Co-Host Live Streaming (Read-Only Transparency) */}
            <div className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-700 rounded-2xl p-5 text-white shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold">
                      <Video className="w-3.5 h-3.5" />
                      <span>Komisi Live Host &amp; Co-Host</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/35 border border-white/25 text-amber-200 text-[11px] font-extrabold">
                      <Lock className="w-3 h-3" />
                      <span>Mode Lihat Saja (Read-Only)</span>
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold">
                    Rekap Omset, Tas Terjual (Pcs) &amp; Rincian Komisi Live Streaming Anda
                  </h2>
                  <p className="text-xs text-pink-100">
                    Data sesi live streaming, nilai omset penjualan, jumlah tas yang terjual (pcs), dan tarif komisi (% Omset &amp; Rp/Pcs) diinput serta diverifikasi langsung oleh <strong>Admin HR / Finance</strong>. Rincian di bawah ini ditampilkan secara real-time untuk transparansi komponen <strong>&ldquo;Insentif / Komisi Penjualan&rdquo;</strong> pada Slip Gaji periode <strong>{companyConfig.currentPayrollPeriod}</strong>.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
                  <div className="bg-white/15 backdrop-blur-xs border border-white/25 rounded-xl p-3 text-xs">
                    <span className="text-pink-100 block text-[10px] uppercase font-bold">
                      Tarif Komisi Host Utama
                    </span>
                    <span className="text-base font-extrabold block mt-0.5">
                      {pctRate}% Omset
                      {pcsRate > 0 ? ` + ${formatRupiah(pcsRate)}/pcs` : ''}
                    </span>
                    <span className="text-[10px] text-pink-100 block mt-0.5">
                      Status Host: {is_host ? 'Aktif Terdaftar' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="bg-violet-950/40 backdrop-blur-xs border border-violet-300/40 rounded-xl p-3 text-xs">
                    <span className="text-violet-200 block text-[10px] uppercase font-bold">
                      Tarif Komisi Co-Host
                    </span>
                    <span className="text-base font-extrabold text-white block mt-0.5">
                      {coHostPctRate}% Omset
                      {coHostPcsRate > 0 ? ` + ${formatRupiah(coHostPcsRate)}/pcs` : ''}
                    </span>
                    <span className="text-[10px] text-violet-200 block mt-0.5">
                      Status Co-Host: {is_co_host ? 'Aktif Terdaftar' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Total Omset &amp; Tas Terjual ({companyConfig.currentPayrollPeriod})
                </span>
                <span className="text-xl font-extrabold text-slate-900 block mt-1 font-mono">
                  {formatRupiah(myLiveSalesSummary.totalOmset)}
                </span>
                <span className="text-[11px] text-indigo-700 font-bold block mt-1">
                  Total Tas Terjual: {myLiveSalesSummary.totalPcs.toLocaleString('id-ID')} Pcs ({myLiveSalesSummary.sessionsCount} Sesi)
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Komisi Sesi Host Utama
                </span>
                <span className="text-xl font-extrabold text-pink-700 block mt-1 font-mono">
                  {formatRupiah(myLiveSalesSummary.hostCommissionAmount)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Omset: {formatRupiah(myLiveSalesSummary.hostOmset)} • {myLiveSalesSummary.hostPcs.toLocaleString('id-ID')} Pcs ({pctRate}%
                  {pcsRate > 0 ? ` + ${formatRupiah(pcsRate)}/pcs` : ''})
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-violet-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-violet-600 block">
                  Komisi Sesi Co-Host ({coHostPctRate}%{coHostPcsRate > 0 ? ` + ${formatRupiah(coHostPcsRate)}/pcs` : ''})
                </span>
                <span className="text-xl font-extrabold text-violet-700 block mt-1 font-mono">
                  {formatRupiah(myLiveSalesSummary.coHostCommissionAmount)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Omset: {formatRupiah(myLiveSalesSummary.coHostOmset)} • {myLiveSalesSummary.coHostPcs.toLocaleString('id-ID')} Pcs ({myLiveSalesSummary.coHostSessionsCount} sesi)
                </span>
              </div>

              <div className="bg-gradient-to-br from-pink-600 via-fuchsia-600 to-violet-700 p-4 rounded-2xl text-white shadow-sm">
                <span className="text-[11px] font-bold uppercase text-pink-100 block">
                  Total Insentif / Komisi Penjualan
                </span>
                <span className="text-2xl font-extrabold block mt-1 font-mono">
                  +{formatRupiah(salesCommissionPay)}
                </span>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-pink-100">Otomatis Masuk Slip Gaji</span>
                  <button
                    type="button"
                    onClick={() => setActivePortalTab('payroll')}
                    className="underline font-bold text-white cursor-pointer"
                  >
                    Cek Slip →
                  </button>
                </div>
              </div>
            </div>

            {/* Banner Kebijakan Kendali Penuh Admin (Terkunci / Read-Only di Portal Karyawan) */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-amber-950 text-xs sm:text-sm">
                      Akses Read-Only (Input Omset &amp; Tas Terjual Dikendalikan Admin)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 font-bold text-[10px]">
                      Terverifikasi Sistem Payroll
                    </span>
                  </div>
                  <p className="text-amber-900 leading-relaxed">
                    Untuk menjaga akurasi audit penggajian, <strong>Host &amp; Co-Host hanya dapat melihat (Read-Only) rekap omset, jumlah tas terjual, dan rincian komisi</strong>. Seluruh pencatatan nilai omset penjualan sesi live, jumlah tas terjual (pcs), serta pengaturan persentase komisi (% Omset) dan tarif per pcs (Rp/Pcs) dilakukan terpusat oleh <strong>Admin di Modul Penggajian atau Detail Karyawan</strong>.
                  </p>
                </div>
              </div>
              {isAdminUnlocked && (
                <button
                  type="button"
                  onClick={onSwitchToAdminMode}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
                >
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Kelola Omset di Panel Admin</span>
                </button>
              )}
            </div>

            {/* Tabel Riwayat Sesi Live Streaming (Read-Only) */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Rincian Sesi Live Streaming, Jumlah Tas Terjual &amp; Komisi Terverifikasi ({companyConfig.currentPayrollPeriod})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daftar sesi live streaming (Host &amp; Co-Host) dari TikTok Shop / Shopee Live yang telah diinput oleh Admin untuk perhitungan Insentif / Komisi Penjualan bulan ini
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start sm:self-center">
                  {myLiveSalesSummary.sessionsCount} Sesi Terverifikasi
                </span>
              </div>

              {myLiveSalesSummary.filteredLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  Belum ada data omset penjualan &amp; jumlah tas terjual live streaming yang diinput oleh Admin pada periode <strong>{companyConfig.currentPayrollPeriod}</strong>. Data sesi live dan rincian komisi Anda akan otomatis tampil secara real-time di halaman ini segera setelah diinput oleh Admin HR / Finance.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Tanggal &amp; Platform</th>
                        <th className="py-3 px-4">Peran &amp; Judul Sesi</th>
                        <th className="py-3 px-4 text-right">Omset Sesi Live (IDR)</th>
                        <th className="py-3 px-4 text-right">Jumlah Tas Terjual (Pcs)</th>
                        <th className="py-3 px-4 text-right">Rincian Komisi</th>
                        <th className="py-3 px-4 text-center">Status Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myLiveSalesSummary.filteredLogs.map((log) => {
                        const isCoHostRow =
                          log.sessionRole === 'Co-Host' ||
                          (!log.sessionRole &&
                            currentEmployee.isCoHostLiveStream &&
                            !currentEmployee.isLiveStreamHost);
                        const effectiveRowPct = isCoHostRow
                          ? coHostPctRate > 0
                            ? coHostPctRate
                            : Number(log.commissionPercentageSnapshot) || 0
                          : pctRate > 0
                          ? pctRate
                          : Number(log.commissionPercentageSnapshot) || 0;
                        const effectiveRowPcsRate = isCoHostRow
                          ? coHostPcsRate > 0
                            ? coHostPcsRate
                            : Number(log.commissionPerPcsSnapshot) || 0
                          : pcsRate > 0
                          ? pcsRate
                          : Number(log.commissionPerPcsSnapshot) || 0;
                        const rowComm = Math.round(
                          ((Number(log.omsetAmount) || 0) * effectiveRowPct) / 100 +
                            (Number(log.pcsSold) || 0) * effectiveRowPcsRate
                        );
                        return (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 block">
                                {formatIndoDate(log.date)}
                              </span>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-bold">
                                {log.platform}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                    isCoHostRow
                                      ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                      : 'bg-pink-100 text-pink-800 border border-pink-200'
                                  }`}
                                >
                                  {isCoHostRow
                                    ? `Co-Host (${effectiveRowPct}%${effectiveRowPcsRate > 0 ? ` + ${formatRupiah(effectiveRowPcsRate)}/pcs` : ''})`
                                    : `Host (${effectiveRowPct}%${effectiveRowPcsRate > 0 ? ` + ${formatRupiah(effectiveRowPcsRate)}/pcs` : ''})`}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {log.sessionTitle}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block">
                                Durasi Live: {log.durationHours} jam
                                {log.notes ? ` • Catatan: ${log.notes}` : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatRupiah(log.omsetAmount)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-indigo-800">
                              {log.pcsSold.toLocaleString('id-ID')} Pcs
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-extrabold ${
                                isCoHostRow ? 'text-violet-700' : 'text-pink-700'
                              }`}
                            >
                              +{formatRupiah(rowComm)}
                              <span className="block text-[10px] font-normal text-slate-500">
                                {effectiveRowPct}% × {formatRupiah(log.omsetAmount)}
                                {effectiveRowPcsRate > 0 && log.pcsSold > 0
                                  ? ` + ${log.pcsSold} Pcs × ${formatRupiah(effectiveRowPcsRate)}`
                                  : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Diinput Admin</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                      <tr>
                        <td colSpan={2} className="py-3 px-4">
                          Total Rekap Periode {companyConfig.currentPayrollPeriod} ({myLiveSalesSummary.sessionsCount} Sesi)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-900">
                          {formatRupiah(myLiveSalesSummary.totalOmset)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-800">
                          {myLiveSalesSummary.totalPcs.toLocaleString('id-ID')} Pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-pink-700 text-sm">
                          +{formatRupiah(salesCommissionPay)}
                        </td>
                        <td className="py-3 px-4 text-center text-[10px] text-emerald-700">
                          Sinkron Slip Gaji
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB BONUS SAYA (RIWAYAT BONUS & APRESIASI KARYAWAN) */}
      {activePortalTab === 'my_bonuses' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-emerald-600/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Panel Bonus &amp; Apresiasi Karyawan</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold">
                  Riwayat Bonus Saya — {currentEmployee.fullName} ({currentEmployee.nik})
                </h2>
                <p className="text-xs text-emerald-100/80">
                  Seluruh bonus apresiasi yang diberikan oleh HR / Finance otomatis ditambahkan ke Slip Gaji pada periode bulan terkait.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-xs rounded-xl px-4 py-3 border border-white/15 shrink-0">
                <span className="text-[11px] text-emerald-200 uppercase font-bold block">
                  Total Akumulasi Bonus Diterima
                </span>
                <span className="text-xl font-extrabold text-white font-mono mt-0.5 block">
                  {formatRupiah(
                    myBonuses.reduce((sum, b) => sum + Math.max(0, Number(b.amount) || 0), 0)
                  )}
                </span>
                <span className="text-[11px] text-emerald-200/80">
                  {myBonuses.length} pencatatan bonus • {myUnreadBonuses.length} belum dibaca
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Riwayat Penerimaan Bonus &amp; Catatan Apresiasi
                </h3>
                <p className="text-xs text-slate-500">
                  Rincian tanggal pemberian, nominal bonus, serta catatan pencapaian pekerjaan Anda.
                </p>
              </div>
              {effectivePayRecord && (
                <button
                  type="button"
                  onClick={() => onOpenPayslip(effectivePayRecord)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <WalletCards className="w-3.5 h-3.5" />
                  <span>Cek di Slip Gaji</span>
                </button>
              )}
            </div>

            {myBonuses.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">
                  Belum ada riwayat bonus tambahan untuk akun Anda.
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Setiap bonus pencapaian yang dikirimkan oleh HR / Finance akan langsung muncul di sini dan di Slip Gaji Anda.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {myBonuses.map((bonus) => (
                  <div
                    key={bonus.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      bonus.is_read ? 'bg-white hover:bg-slate-50/70' : 'bg-emerald-50/60'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          Periode Gaji: {formatYearMonthToIndo(bonus.period_month)} ({bonus.period_month})
                        </span>
                        <span className="text-xs text-slate-500">
                          Diberikan pada {formatIndoDate(bonus.date_awarded)}
                        </span>
                        {!bonus.is_read ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                            Baru • Belum Dibaca
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                            ✓ Sudah Dibaca
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        Catatan Apresiasi: &ldquo;{bonus.reason_note}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Nominal Bonus
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-emerald-700 font-mono">
                          +{formatRupiah(bonus.amount)}
                        </span>
                      </div>

                      {!bonus.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkBonusRead(bonus.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tandai Sudah Dibaca</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet Drawer for Secondary Employee Portal Menus (<768px) */}
      {isMobileMenuSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center md:hidden animate-in fade-in">
          <div className="bg-white w-full rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  Menu Lengkap Portal Karyawan
                </h4>
                <p className="text-[11px] text-slate-500">
                  Pilih fitur layanan mandiri {currentEmployee.fullName} ({currentEmployee.nik})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuSheetOpen(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: 'home' as const,
                  label: 'Beranda Utama',
                  desc: 'Ringkasan & Pintasan',
                  icon: Home,
                  badge: '',
                },
                {
                  id: 'attendance' as const,
                  label: 'Kamera Absen',
                  desc: 'Foto Wajah & GPS ≤25m',
                  icon: Camera,
                  badge: todayAttendance ? 'Sudah Absen' : 'Wajib Absen',
                },
                {
                  id: 'payroll' as const,
                  label: 'Slip Gaji Pribadi',
                  desc: companyConfig.currentPayrollPeriod,
                  icon: WalletCards,
                  badge: 'PDF',
                },
                {
                  id: 'my_bonuses' as const,
                  label: 'Bonus Saya',
                  desc: 'Riwayat & Apresiasi',
                  icon: Sparkles,
                  badge: myUnreadBonuses.length > 0 ? `${myUnreadBonuses.length} Baru` : `${myBonuses.length}`,
                },
                ...(canAccessLiveCommissionPanel
                  ? [
                      {
                        id: 'live_commission' as const,
                        label: 'Komisi Live Host & Co-Host',
                        desc: 'TikTok Shop & Shopee Live (Read-Only)',
                        icon: Video,
                        badge: salesCommissionPay > 0 ? `+${formatRupiah(salesCommissionPay)}` : '',
                      },
                    ]
                  : []),
                {
                  id: 'leave' as const,
                  label: 'Cuti & Izin',
                  desc: `Sisa ${currentEmployee.remainingLeaveDays} Hari`,
                  icon: CalendarDays,
                  badge: '',
                },
                {
                  id: 'claims' as const,
                  label: 'Lembur & Klaim',
                  desc: 'Hitungan Per Menit',
                  icon: Clock,
                  badge: `${myOvertimeRequests.length}`,
                },
                {
                  id: 'cash_advance' as const,
                  label: 'Kasbon & Cicilan',
                  desc: 'Potong Gaji Otomatis',
                  icon: HandCoins,
                  badge: `${myCashAdvances.length}`,
                },
                {
                  id: 'assets' as const,
                  label: 'Aset Kantor Saya',
                  desc: 'Inventaris & Laporan',
                  icon: Boxes,
                  badge: `${myAssets.length}`,
                },
                {
                  id: 'performance' as const,
                  label: 'Rapor Kinerja KPI',
                  desc: 'Skor & Bonus Kinerja',
                  icon: Award,
                  badge: `${myReviews.length}`,
                },
                {
                  id: 'profile' as const,
                  label: 'Profil & Rekening',
                  desc: currentEmployee.bankName,
                  icon: User,
                  badge: '',
                },
              ].map((item) => {
                const IconComp = item.icon;
                const isActive = activePortalTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActivePortalTab(item.id);
                      setIsMobileMenuSheetOpen(false);
                    }}
                    className={`min-h-[64px] p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <IconComp
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isActive ? 'text-white' : 'text-emerald-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isActive ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              {Boolean(isAdminUnlocked && onSwitchToAdminMode) ? (
                <>
                  {onSelectEmployee && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuSheetOpen(false);
                        setIsSwitchProfileModalOpen(true);
                      }}
                      className="flex-1 min-h-[42px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Simulasi Karyawan Lain
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuSheetOpen(false);
                      onSwitchToAdminMode?.();
                    }}
                    className="flex-1 min-h-[42px] py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                    <span>Kembali ke Panel Admin</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Sesi Terkunci: <strong>{currentEmployee.nik}</strong>
                    </span>
                  </div>
                  {onLockAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuSheetOpen(false);
                        onLockAdmin();
                      }}
                      className="min-h-[42px] py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Keluar Sesi (Logout)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Native-Style Mobile Bottom Navigation Bar (<768px, md:hidden) */}
      <nav
        aria-label="Navigasi Bawah Portal Karyawan"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] px-2 pb-1.5 pt-1"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('home');
              setIsMobileMenuSheetOpen(false);
            }}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
              activePortalTab === 'home'
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Home</span>
          </button>

          {/* 2. Slip Gaji */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('payroll');
              setIsMobileMenuSheetOpen(false);
            }}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
              activePortalTab === 'payroll'
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <WalletCards className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Slip Gaji</span>
          </button>

          {/* 3. Kamera Absen (Prominent Center One-Handed Thumb Action) */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('attendance');
              setIsMobileMenuSheetOpen(false);
            }}
            className="flex flex-col items-center justify-center cursor-pointer group -mt-4"
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 relative ${
                activePortalTab === 'attendance'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white ring-4 ring-emerald-100 shadow-emerald-600/35'
                  : 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white ring-4 ring-white shadow-emerald-600/25'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                  todayAttendance ? 'bg-emerald-300' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </div>
            <span
              className={`text-[10px] mt-1 leading-tight ${
                activePortalTab === 'attendance'
                  ? 'text-emerald-700 font-extrabold'
                  : 'text-slate-700 font-bold'
              }`}
            >
              Kamera Absen
            </span>
          </button>

          {/* 4. Cuti/Izin */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('leave');
              setIsMobileMenuSheetOpen(false);
            }}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer relative ${
              activePortalTab === 'leave'
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <div className="relative">
              <CalendarDays className="w-5 h-5" />
              {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
              )}
            </div>
            <span className="text-[10px] leading-tight">Cuti/Izin</span>
          </button>

          {/* 5. Lainnya (Opens Full Portal Menu Sheet) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuSheetOpen((prev) => !prev)}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
              isMobileMenuSheetOpen ||
              ['claims', 'cash_advance', 'assets', 'performance', 'profile'].includes(activePortalTab)
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Lainnya</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

