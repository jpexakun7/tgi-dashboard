import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  Printer,
  Download,
  FileText,
  Users,
  Wallet,
  X,
  Building2,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  Employee,
  PartTimeWorkLog,
  PartTimeWeeklyPayout,
  AttendanceRecord,
  EmployeeBonus,
  ThrPayoutRecord,
  CompanyConfig,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  getEmployeeHourlyRate,
  getEmployeeStandardDailyHours,
  getApprovedOvertimeHoursForEmployeeDate,
  STANDARD_WORK_HOURS_PER_DAY,
  isEmployeePartTime,
  getEmployeeBonusesForPeriod,
  getActiveEmployeeThrForPayslip,
  addDaysToDateString,
  getJakartaDateString,
  getJakartaIsoTimestamp,
  getWeeklyCycleRangeForDate,
  getSelectableWeeklyCycles,
  getEmployeeShift,
  calculateEmployeeAttendancePenalty,
  getEmployeePayrollDeductionForPeriod,
  getPayrollSignatoriesConfig,
  generateOfficialCompanyStampDataUrl,
  generateStylizedSignatureDataUrl,
} from '../utils/formatters';
import {
  PartTimeLogs,
  getOperationalSixDayRange,
  computeHoursFromClockInOut,
  formatRoleAndDepartment,
} from './PartTimeLogs';
import {
  generateSessionUuid,
  markPartTimeLogsPaidInSupabase,
  resetPartTimeLogsPaidInSupabase,
  upsertPartTimeLogToSupabase,
  applyPartTimeOverridesToEmployees,
  saveEmployeeEmploymentMetaLocal,
  getSavedEmployeeBonuses,
  getSavedThrPayouts,
  getSavedPayrollDeductions,
} from '../services/supabaseService';

interface PartTimePayrollSummaryProps {
  employees: Employee[];
  logs: PartTimeWorkLog[];
  payouts: PartTimeWeeklyPayout[];
  attendances?: AttendanceRecord[];
  companyConfig?: CompanyConfig;
  onUpdateCompanyConfig?: (nextConfig: CompanyConfig) => void;
  onSaveLog: (log: PartTimeWorkLog) => void;
  onDeleteLog: (id: string) => void;
  onMarkLogsPaid: (logIds: string[], payout: PartTimeWeeklyPayout) => void;
  onResetLogsPaid?: (
    logIds: string[],
    employeeId: string,
    weekStartDate: string,
    weekEndDate: string
  ) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  onPullWeeklyAttendance?: () => Promise<void> | void;
}

interface EmployeeWeeklySummaryRow {
  employee: Employee;
  hourlyRate: number;
  overtimeRate: number;
  weekLogs: PartTimeWorkLog[];
  unpaidLogs: PartTimeWorkLog[];
  paidLogs: PartTimeWorkLog[];
  totalDaysWorked: number;
  normalHoursWorked: number;
  overtimeHoursWorked: number;
  totalHoursWorked: number;
  unpaidNormalHours: number;
  unpaidOvertimeHours: number;
  unpaidHours: number;
  paidHours: number;
  normalPay: number;
  overtimePay: number;
  bonusPay: number;
  bonusNotes: string;
  thrPay: number;
  thrNotes: string;
  thrShowInPayslip: boolean;
  grossPay: number;
  lateMinutesTotal: number;
  latePenaltyDeduction: number;
  kasbonDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  coveredDeductionAmount: number;
  uncoveredDeductionDeficit: number;
  netTakeHomePay: number;
  missingClockOutLogs: PartTimeWorkLog[];
  unpaidGrossPay: number;
  paidGrossPay: number;
  isFullyPaid: boolean;
}

export const PartTimePayrollSummary: React.FC<PartTimePayrollSummaryProps> = ({
  employees,
  logs,
  payouts,
  attendances = [],
  companyConfig,
  onUpdateCompanyConfig,
  onSaveLog,
  onDeleteLog,
  onMarkLogsPaid,
  onResetLogsPaid,
  onUpdateEmployee,
  onPullWeeklyAttendance,
}) => {
  const defaultWeek = useMemo(() => getOperationalSixDayRange(new Date()), []);
  const [weekStart, setWeekStart] = useState<string>(defaultWeek.startDate);
  const [weekEnd, setWeekEnd] = useState<string>(defaultWeek.endDate);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'logs' | 'expenses'>('summary');
  const [processingEmpId, setProcessingEmpId] = useState<string | null>(null);
  const [isBulkPaying, setIsBulkPaying] = useState<boolean>(false);
  const [isPullingAttendance, setIsPullingAttendance] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewingSlipRow, setViewingSlipRow] = useState<EmployeeWeeklySummaryRow | null>(null);
  const [payoutConfirmModal, setPayoutConfirmModal] = useState<{
    mode: 'single' | 'bulk';
    row?: EmployeeWeeklySummaryRow;
    actualPayoutDate: string;
    paymentMethod: 'Transfer Bank' | 'Tunai / Kas Operasional';
    notes: string;
  } | null>(null);
  const [employeeBonuses, setEmployeeBonuses] = useState<EmployeeBonus[]>(() =>
    getSavedEmployeeBonuses()
  );
  const [thrPayouts, setThrPayouts] = useState<ThrPayoutRecord[]>(() =>
    getSavedThrPayouts()
  );
  const [payrollDeductions, setPayrollDeductions] = useState(() =>
    getSavedPayrollDeductions()
  );

  // Compute default end-of-cycle payout date (next day after weekEnd or weekEnd) in WIB without UTC shift
  const defaultCyclePayoutDate = useMemo(() => {
    if (!weekEnd || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd.trim())) {
      return defaultWeek.sundayPayoutDate;
    }
    return addDaysToDateString(weekEnd.trim(), 1);
  }, [weekEnd, defaultWeek.sundayPayoutDate]);

  const cycleStorageKey = `${weekStart}__${weekEnd}`;

  // Tanggal Rencana Pencairan Fleksibel (bisa diubah manual oleh Admin kapan saja)
  const [plannedPayoutDate, setPlannedPayoutDate] = useState<string>(() => {
    try {
      const fromConfig = companyConfig?.partTimePlannedPayoutDates?.[`${defaultWeek.startDate}__${defaultWeek.endDate}`];
      if (fromConfig && /^\d{4}-\d{2}-\d{2}$/.test(fromConfig)) return fromConfig;
      const raw = localStorage.getItem('tgi_pt_planned_payout_dates');
      if (raw) {
        const parsed = JSON.parse(raw);
        const saved = parsed?.[`${defaultWeek.startDate}__${defaultWeek.endDate}`];
        if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
      }
    } catch {
      // ignore
    }
    return defaultWeek.sundayPayoutDate;
  });

  useEffect(() => {
    try {
      const fromConfig = companyConfig?.partTimePlannedPayoutDates?.[cycleStorageKey];
      if (fromConfig && /^\d{4}-\d{2}-\d{2}$/.test(fromConfig)) {
        setPlannedPayoutDate(fromConfig);
        return;
      }
      const raw = localStorage.getItem('tgi_pt_planned_payout_dates');
      if (raw) {
        const parsed = JSON.parse(raw);
        const saved = parsed?.[cycleStorageKey];
        if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
          setPlannedPayoutDate(saved);
          return;
        }
      }
    } catch {
      // ignore
    }
    setPlannedPayoutDate(defaultCyclePayoutDate);
  }, [cycleStorageKey, defaultCyclePayoutDate, companyConfig?.partTimePlannedPayoutDates]);

  const handleChangePlannedPayoutDate = (newDate: string) => {
    const cleanDate = newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate.trim()) ? newDate.trim() : defaultCyclePayoutDate;
    setPlannedPayoutDate(cleanDate);
    try {
      const raw = localStorage.getItem('tgi_pt_planned_payout_dates');
      const parsed = raw ? JSON.parse(raw) : {};
      const nextMap = { ...(parsed || {}), [cycleStorageKey]: cleanDate };
      localStorage.setItem('tgi_pt_planned_payout_dates', JSON.stringify(nextMap));
      window.dispatchEvent(new CustomEvent('tgi_pt_planned_payout_updated'));
      if (companyConfig && onUpdateCompanyConfig) {
        onUpdateCompanyConfig({
          ...companyConfig,
          partTimePlannedPayoutDates: {
            ...(companyConfig.partTimePlannedPayoutDates || {}),
            [cycleStorageKey]: cleanDate,
          },
        });
      }
    } catch {
      // ignore
    }
  };

  // Alias sundayPayoutDate -> plannedPayoutDate agar kompatibel dengan variabel yang ada
  const sundayPayoutDate = plannedPayoutDate;

  useEffect(() => {
    const syncBonuses = () => setEmployeeBonuses(getSavedEmployeeBonuses());
    const syncThr = () => setThrPayouts(getSavedThrPayouts());
    const syncDeductions = () => setPayrollDeductions(getSavedPayrollDeductions());
    window.addEventListener('tgi_employee_bonuses_updated', syncBonuses);
    window.addEventListener('tgi_thr_payouts_updated', syncThr);
    window.addEventListener('tgi_payroll_deductions_updated', syncDeductions);
    return () => {
      window.removeEventListener('tgi_employee_bonuses_updated', syncBonuses);
      window.removeEventListener('tgi_thr_payouts_updated', syncThr);
      window.removeEventListener('tgi_payroll_deductions_updated', syncDeductions);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const safeEmployees = useMemo(
    () =>
      applyPartTimeOverridesToEmployees(
        Array.isArray(employees) ? employees.filter((e) => e && e.isActive !== false) : []
      ),
    [employees]
  );

  const safeRawLogs = useMemo(() => (Array.isArray(logs) ? logs : []), [logs]);
  const safeAttendances = useMemo(
    () => (Array.isArray(attendances) ? attendances : []),
    [attendances]
  );
  const safePayouts = useMemo(() => (Array.isArray(payouts) ? payouts : []), [payouts]);

  // Merge explicit Part-Time logs (`tgi_parttime_logs`) with any Part-Time employee's portal attendance (`attendances`)
  const safeLogs = useMemo<PartTimeWorkLog[]>(() => {
    const mergedMap = new Map<string, PartTimeWorkLog>();
    const empById = new Map<string, Employee>();
    safeEmployees.forEach((e) => empById.set(e.id, e));

    // Index portal attendances by employeeId_date so even old 8-hour logs without clock_in/clock_out in tgi_parttime_logs get corrected from attendances
    const attByKey = new Map<string, AttendanceRecord>();
    for (const att of safeAttendances) {
      if (att?.employeeId && att?.date && !['Sakit', 'Izin', 'Cuti', 'Alpa'].includes(att.status)) {
        attByKey.set(`${att.employeeId}_${att.date}`, att);
      }
    }

    // 1. Add all explicit PartTimeWorkLogs first (normalizing duration from clockIn & clockOut or matching attendance)
    // Strictly exclude any PKWTT (Karyawan Tetap) or non-Part-Time employees
    for (const log of safeRawLogs) {
      if (!log?.id) continue;
      const emp = empById.get(log.employeeId);
      if (emp && !isEmployeePartTime(emp)) continue;
      if (safeEmployees.length > 0 && !emp) continue;
      const key = `${log.employeeId}_${log.date}`;
      const matchedAtt = attByKey.get(key);
      const empStd = getEmployeeStandardDailyHours(emp);
      const approvedOt = getApprovedOvertimeHoursForEmployeeDate(log.employeeId, log.date);
      const hrRate =
        Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) ||
        (emp ? Number(emp.hourlyRate ?? emp.hourly_rate) || getEmployeeHourlyRate(emp, empStd, 25) : 0);
      const otRate =
        Number(log.overtimeRate ?? log.overtime_rate) ||
        (emp ? Number(emp.overtimeRate ?? emp.overtime_rate) : 0) ||
        Math.round(hrRate * 1.5);

      const resolvedIn =
        log.clockIn && log.clockIn.trim() !== '' && log.clockIn !== '-'
          ? log.clockIn.trim()
          : matchedAtt?.checkIn && matchedAtt.checkIn.trim() !== '' && matchedAtt.checkIn !== '-'
          ? matchedAtt.checkIn.trim()
          : '';
      const resolvedOut =
        log.clockOut && log.clockOut.trim() !== '' && log.clockOut !== '-'
          ? log.clockOut.trim()
          : matchedAtt?.checkOut && matchedAtt.checkOut.trim() !== '' && matchedAtt.checkOut !== '-'
          ? matchedAtt.checkOut.trim()
          : '';

      const hasIn = Boolean(resolvedIn);
      const hasOut = Boolean(resolvedOut);

      if (hasIn && (!hasOut || resolvedIn === resolvedOut)) {
        const computedMissing = computeHoursFromClockInOut(
          resolvedIn,
          resolvedOut,
          empStd,
          approvedOt,
          log.date
        );
        const wageMissing = Math.round(computedMissing.normalHours * hrRate);
        mergedMap.set(key, {
          ...log,
          clockIn: resolvedIn,
          clock_in: resolvedIn,
          clockOut: '',
          clock_out: '',
          normalHours: computedMissing.normalHours,
          normal_hours: computedMissing.normalHours,
          overtimeHours: 0,
          overtime_hours: 0,
          hoursWorked: computedMissing.normalHours,
          hours_worked: computedMissing.normalHours,
          hourlyRate: hrRate,
          hourlyRateSnapshot: hrRate,
          hourly_rate: hrRate,
          overtimeRate: otRate,
          overtime_rate: otRate,
          dailyWage: wageMissing,
          daily_wage: wageMissing,
        });
      } else if (hasIn && hasOut) {
        const computed = computeHoursFromClockInOut(
          resolvedIn,
          resolvedOut,
          empStd,
          approvedOt,
          log.date
        );
        const otH = computed.overtimeHours;
        const totalH = Number((computed.normalHours + otH).toFixed(2));
        const wage = Math.round(computed.normalHours * hrRate + otH * otRate);
        mergedMap.set(key, {
          ...log,
          clockIn: resolvedIn,
          clock_in: resolvedIn,
          clockOut: resolvedOut,
          clock_out: resolvedOut,
          normalHours: computed.normalHours,
          normal_hours: computed.normalHours,
          overtimeHours: otH,
          overtime_hours: otH,
          hoursWorked: totalH,
          hours_worked: totalH,
          hourlyRate: hrRate,
          hourlyRateSnapshot: hrRate,
          hourly_rate: hrRate,
          overtimeRate: otRate,
          overtime_rate: otRate,
          dailyWage: wage,
          daily_wage: wage,
        });
      } else {
        mergedMap.set(key, log);
      }
    }

    // 2. Automatically bridge any portal AttendanceRecord for Part-Time employees
    for (const att of safeAttendances) {
      if (!att?.employeeId || !att?.date) continue;
      const emp = empById.get(att.employeeId);
      if (!emp) continue;
      if (!isEmployeePartTime(emp)) continue;

      const key = `${att.employeeId}_${att.date}`;
      const existingLog = mergedMap.get(key);
      // Skip non-present attendance statuses
      if (['Sakit', 'Izin', 'Cuti', 'Alpa'].includes(att.status)) continue;

      const empStd = getEmployeeStandardDailyHours(emp);
      const approvedOt = getApprovedOvertimeHoursForEmployeeDate(emp.id, att.date);

      const clockIn =
        att.checkIn && att.checkIn.trim() !== '' && att.checkIn !== '-'
          ? att.checkIn
          : existingLog?.clockIn || '';
      const clockOut =
        att.checkOut && att.checkOut.trim() !== '' && att.checkOut !== '-'
          ? att.checkOut
          : existingLog?.clockOut || '';

      const computed = clockIn
        ? computeHoursFromClockInOut(clockIn, clockOut, empStd, approvedOt, att.date)
        : { totalHours: 0, normalHours: 0, overtimeHours: 0 };

      const hrRate =
        Number(emp.hourlyRate ?? emp.hourly_rate) || getEmployeeHourlyRate(emp, empStd, 25);
      const otRate =
        Number(emp.overtimeRate ?? emp.overtime_rate) || Math.round(hrRate * 1.5);
      const wage = Math.round(computed.normalHours * hrRate + computed.overtimeHours * otRate);

      if (!existingLog || existingLog.status !== 'Paid') {
        mergedMap.set(key, {
          id: existingLog?.id || `pt-att-${att.id}`,
          employeeId: emp.id,
          employee_id: emp.id,
          employeeName: emp.fullName,
          employee_name: emp.fullName,
          date: att.date,
          clockIn,
          clock_in: clockIn,
          clockOut,
          clock_out: clockOut,
          normalHours: computed.normalHours,
          normal_hours: computed.normalHours,
          overtimeHours: computed.overtimeHours,
          overtime_hours: computed.overtimeHours,
          hoursWorked: computed.totalHours,
          hours_worked: computed.totalHours,
          hourlyRateSnapshot: hrRate,
          hourlyRate: hrRate,
          hourly_rate: hrRate,
          overtimeRate: otRate,
          overtime_rate: otRate,
          dailyWage: wage,
          daily_wage: wage,
          notes:
            existingLog?.notes ||
            att.notes ||
            'Sinkronisasi otomatis absensi Portal Karyawan Part-Time',
          source: existingLog?.source || 'portal',
          status: existingLog?.status === 'Paid' ? 'Paid' : 'Unpaid',
        });
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [safeRawLogs, safeAttendances, safeEmployees]);

  // Strictly include ONLY employees with Part-Time status; PKWTT (Karyawan Tetap) & Contract employees are excluded
  const relevantPartTimeEmployees = useMemo(() => {
    return safeEmployees.filter((e) => isEmployeePartTime(e));
  }, [safeEmployees]);

  // Build weekly summary rows per Part-Time employee with formula:
  // Total Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
  const weeklySummaryRows = useMemo<EmployeeWeeklySummaryRow[]>(() => {
    return relevantPartTimeEmployees.map((emp) => {
      const empStd = getEmployeeStandardDailyHours(emp);
      const hourlyRate =
        Number(emp.hourlyRate ?? emp.hourly_rate) || getEmployeeHourlyRate(emp, empStd, 25);
      const overtimeRate =
        Number(emp.overtimeRate ?? emp.overtime_rate) || Math.round(hourlyRate * 1.5);

      const empWeekLogs = safeLogs
        .filter(
          (l) =>
            l.employeeId === emp.id &&
            (!weekStart || l.date >= weekStart) &&
            (!weekEnd || l.date <= weekEnd)
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      const resolveLogBreakdown = (l: PartTimeWorkLog) => {
        const hasIn = Boolean(l.clockIn && l.clockIn.trim() !== '' && l.clockIn !== '-');
        const hasOut = Boolean(l.clockOut && l.clockOut.trim() !== '' && l.clockOut !== '-');
        const approvedOt = getApprovedOvertimeHoursForEmployeeDate(emp.id, l.date);
        if (hasIn && (!hasOut || l.clockIn?.trim() === l.clockOut?.trim())) {
          const computedMissing = computeHoursFromClockInOut(
            l.clockIn,
            l.clockOut,
            empStd,
            approvedOt,
            l.date
          );
          return {
            normH: computedMissing.normalHours,
            otH: 0,
            totalH: computedMissing.normalHours,
          };
        }
        if (hasIn && hasOut) {
          const computed = computeHoursFromClockInOut(
            l.clockIn,
            l.clockOut,
            empStd,
            approvedOt,
            l.date
          );
          return {
            normH: computed.normalHours,
            otH: computed.overtimeHours,
            totalH: computed.totalHours,
          };
        }
        const totalH = Math.max(0, Number(l.hoursWorked ?? l.hours_worked) || 0);
        const normH =
          l.normalHours !== undefined || l.normal_hours !== undefined
            ? Math.min(empStd, Math.max(0, Number(l.normalHours ?? l.normal_hours) || 0))
            : Math.min(empStd, totalH);
        const rawOtH =
          l.overtimeHours !== undefined || l.overtime_hours !== undefined
            ? Math.max(0, Number(l.overtimeHours ?? l.overtime_hours) || 0)
            : 0;
        const otH = approvedOt > 0 ? Math.min(rawOtH || approvedOt, approvedOt) : 0;
        return { normH, otH, totalH: Math.round((normH + otH) * 100) / 100 };
      };

      const unpaidLogs = empWeekLogs.filter((l) => l.status !== 'Paid');
      const paidLogs = empWeekLogs.filter((l) => l.status === 'Paid');

      const uniqueDates = new Set(
        empWeekLogs.filter((l) => resolveLogBreakdown(l).totalH > 0).map((l) => l.date)
      );
      const totalDaysWorked = uniqueDates.size;

      let normalHoursWorked = 0;
      let overtimeHoursWorked = 0;
      empWeekLogs.forEach((l) => {
        const b = resolveLogBreakdown(l);
        normalHoursWorked += b.normH;
        overtimeHoursWorked += b.otH;
      });
      normalHoursWorked = Math.round(normalHoursWorked * 100) / 100;
      overtimeHoursWorked = Math.round(overtimeHoursWorked * 100) / 100;
      const totalHoursWorked = Math.round((normalHoursWorked + overtimeHoursWorked) * 100) / 100;

      let unpaidNormalHours = 0;
      let unpaidOvertimeHours = 0;
      unpaidLogs.forEach((l) => {
        const b = resolveLogBreakdown(l);
        unpaidNormalHours += b.normH;
        unpaidOvertimeHours += b.otH;
      });
      unpaidNormalHours = Math.round(unpaidNormalHours * 100) / 100;
      unpaidOvertimeHours = Math.round(unpaidOvertimeHours * 100) / 100;
      const unpaidHours = Math.round((unpaidNormalHours + unpaidOvertimeHours) * 100) / 100;

      let paidNormalHours = 0;
      let paidOvertimeHours = 0;
      paidLogs.forEach((l) => {
        const b = resolveLogBreakdown(l);
        paidNormalHours += b.normH;
        paidOvertimeHours += b.otH;
      });
      const paidHours = Math.round((paidNormalHours + paidOvertimeHours) * 100) / 100;

      // Rumus Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate) + Bonus Tambahan + THR (jika dicentang Admin)
      // Pastikan siklus mingguan (Senin-Sabtu) saat transisi cut-off tgl 25/26 tetap utuh tanpa terpotong paksa
      const normalPay = Math.round(normalHoursWorked * hourlyRate);
      const overtimePay = Math.round(overtimeHoursWorked * overtimeRate);
      const payoutYm = (sundayPayoutDate || weekEnd || weekStart || '').slice(0, 7);
      const startYm = (weekStart || '').slice(0, 7);
      const primaryBonusSummary = getEmployeeBonusesForPeriod(
        employeeBonuses,
        emp,
        payoutYm,
        false
      );
      const fallbackBonusSummary =
        primaryBonusSummary.totalAmount === 0 && startYm && startYm !== payoutYm
          ? getEmployeeBonusesForPeriod(employeeBonuses, emp, startYm, false)
          : primaryBonusSummary;
      const bonusPay = Math.max(0, Math.round(Number(fallbackBonusSummary.totalAmount) || 0));
      const bonusNotes = fallbackBonusSummary.combinedNotes || '';

      // THR hanya muncul dan dihitung jika Admin mencentang show_in_payslip = true
      const activeThr =
        getActiveEmployeeThrForPayslip(thrPayouts, emp, payoutYm) ||
        (startYm !== payoutYm ? getActiveEmployeeThrForPayslip(thrPayouts, emp, startYm) : null);
      const thrShowInPayslip = Boolean(
        activeThr && activeThr.show_in_payslip === true && activeThr.total_thr_amount > 0
      );
      const thrPay =
        thrShowInPayslip && activeThr
          ? Math.max(0, Math.round(Number(activeThr.total_thr_amount) || 0))
          : 0;
      const thrNotes =
        thrShowInPayslip && activeThr
          ? `${activeThr.holiday_name} (${activeThr.tenure_label} • ${activeThr.proportion_formula})`
          : '';

      const grossPay = normalPay + overtimePay + bonusPay + thrPay;

      // Evaluasi denda keterlambatan (dengan batas wajar shift) & potongan kasbon/absensi pada minggu ini
      const weekRangePeriod = `${weekStart}__${weekEnd}`;
      const attPenalty = calculateEmployeeAttendancePenalty(
        emp,
        safeAttendances,
        undefined,
        undefined,
        weekRangePeriod
      );
      const lateMinutesTotal = Math.max(0, Math.round(attPenalty.totalLateMinutes || 0));
      const latePenaltyDeduction = Math.max(0, Math.round(attPenalty.latePenaltyAmount || 0));

      const dedRecord = getEmployeePayrollDeductionForPeriod(
        payrollDeductions,
        emp,
        payoutYm,
        false
      );
      const kasbonDeduction = dedRecord
        ? Math.max(0, Math.round(Number(dedRecord.cicilan_kasbon_bulan_ini) || 0))
        : 0;
      const otherDeduction = dedRecord
        ? Math.max(
            0,
            Math.round(
              (Number(dedRecord.tanpa_keterangan_hari) || 0) *
                (Number(dedRecord.tanpa_keterangan_rate) || 0) +
                (Number(dedRecord.izin_jam_menit) || 0) * (Number(dedRecord.izin_jam_rate) || 0) +
                (Number(dedRecord.izin_hari_jumlah) || 0) * (Number(dedRecord.izin_hari_rate) || 0)
            )
          )
        : 0;

      const totalDeductions = latePenaltyDeduction + kasbonDeduction + otherDeduction;
      // Proteksi Take Home Pay Non-Negatif: minimal Rp 0 (tidak pernah minus)
      const netTakeHomePay = Math.max(0, grossPay - totalDeductions);
      const coveredDeductionAmount = Math.min(grossPay, totalDeductions);
      const uncoveredDeductionDeficit = Math.max(0, totalDeductions - grossPay);

      // Deteksi log kerja Part-Time yang memiliki Clock-In namun belum memiliki Clock-Out
      const missingClockOutLogs = empWeekLogs.filter((l) => {
        const cIn = (l.clockIn || l.clock_in || '').trim();
        const cOut = (l.clockOut || l.clock_out || '').trim();
        return Boolean(cIn && cIn !== '-') && (!cOut || cOut === '-' || cOut === cIn);
      });

      const baseUnpaidWage =
        Math.round(unpaidNormalHours * hourlyRate) +
        Math.round(unpaidOvertimeHours * overtimeRate);
      const rawUnpaidGrossPay =
        unpaidLogs.length > 0
          ? baseUnpaidWage + bonusPay + thrPay
          : baseUnpaidWage +
            (thrShowInPayslip && activeThr?.payment_status !== 'Sudah Dibayar' ? thrPay : 0);
      const unpaidGrossPay = Math.max(0, rawUnpaidGrossPay - (unpaidLogs.length > 0 ? totalDeductions : 0));
      const paidGrossPay =
        Math.round(paidNormalHours * hourlyRate) +
        Math.round(paidOvertimeHours * overtimeRate) +
        (unpaidLogs.length === 0 && paidLogs.length > 0 ? bonusPay : 0) +
        (thrShowInPayslip && activeThr?.payment_status === 'Sudah Dibayar' ? thrPay : 0);

      const isFullyPaid =
        empWeekLogs.length > 0 &&
        unpaidLogs.length === 0 &&
        totalHoursWorked > 0 &&
        grossPay > 0;

      return {
        employee: emp,
        hourlyRate,
        overtimeRate,
        weekLogs: empWeekLogs,
        unpaidLogs,
        paidLogs,
        totalDaysWorked,
        normalHoursWorked,
        overtimeHoursWorked,
        totalHoursWorked,
        unpaidNormalHours,
        unpaidOvertimeHours,
        unpaidHours,
        paidHours,
        normalPay,
        overtimePay,
        bonusPay,
        bonusNotes,
        thrPay,
        thrNotes,
        thrShowInPayslip,
        grossPay,
        lateMinutesTotal,
        latePenaltyDeduction,
        kasbonDeduction,
        otherDeduction,
        totalDeductions,
        coveredDeductionAmount,
        uncoveredDeductionDeficit,
        netTakeHomePay,
        missingClockOutLogs,
        unpaidGrossPay,
        paidGrossPay,
        isFullyPaid,
      };
    });
  }, [
    relevantPartTimeEmployees,
    safeLogs,
    safeAttendances,
    weekStart,
    weekEnd,
    sundayPayoutDate,
    employeeBonuses,
    thrPayouts,
    payrollDeductions,
  ]);

  // KPI Aggregate Totals for the Weekly Cycle
  const aggregateTotals = useMemo(() => {
    let totalNormalHours = 0;
    let totalOvertimeHours = 0;
    let totalHours = 0;
    let totalGross = 0;
    let totalUnpaid = 0;
    let totalPaid = 0;
    let unpaidEmployeeCount = 0;

    weeklySummaryRows.forEach((row) => {
      totalNormalHours += row.normalHoursWorked;
      totalOvertimeHours += row.overtimeHoursWorked;
      totalHours += row.totalHoursWorked;
      totalGross += row.grossPay;
      totalUnpaid += row.unpaidGrossPay;
      totalPaid += row.paidGrossPay;
      if (row.unpaidLogs.length > 0) {
        unpaidEmployeeCount += 1;
      }
    });

    return {
      partTimeCount: weeklySummaryRows.length,
      totalNormalHours: Math.round(totalNormalHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      totalGross,
      totalUnpaid,
      totalPaid,
      unpaidEmployeeCount,
    };
  }, [weeklySummaryRows]);

  // Daftar siklus mingguan (Senin-Sabtu) yang tersedia di dropdown tanpa terpotong di tgl 25/26
  const selectableWeeklyCycles = useMemo(
    () => getSelectableWeeklyCycles(weekStart, safeLogs, safePayouts, 10, 2),
    [weekStart, safeLogs, safePayouts]
  );

  const activeWeeklyCycleInfo = useMemo(
    () => getWeeklyCycleRangeForDate(weekStart),
    [weekStart]
  );

  const handleSelectWeekCycle = (mondayStartStr: string) => {
    const cycle = getWeeklyCycleRangeForDate(mondayStartStr);
    setWeekStart(cycle.startDate);
    setWeekEnd(cycle.endDate);
  };

  // Aksi Cepat Admin: Lengkapi Clock-Out otomatis sesuai jadwal shift / target jam kerja karyawan Part-Time
  const handleQuickCompletePartTimeClockOut = async (
    emp: Employee,
    logsToFix: PartTimeWorkLog[]
  ) => {
    if (!logsToFix || logsToFix.length === 0) return;
    setProcessingEmpId(emp.id);
    try {
      const empShift = getEmployeeShift(emp);
      const empStd = getEmployeeStandardDailyHours(emp, STANDARD_WORK_HOURS_PER_DAY, empShift);
      const hrRate =
        Number(emp.hourlyRate ?? emp.hourly_rate) || getEmployeeHourlyRate(emp, empStd, 25);
      const otRate =
        Number(emp.overtimeRate ?? emp.overtime_rate) || Math.round(hrRate * 1.5);

      for (const l of logsToFix) {
        const cIn = (l.clockIn || l.clock_in || empShift.checkInTime || '09:00').trim();
        const [inH, inM] = cIn.split(':').map(Number);
        let autoOut = empShift.checkOutTime || '17:30';
        if (!isNaN(inH) && !isNaN(inM)) {
          const totalOutMins = (inH * 60 + inM + Math.round(empStd * 60)) % (24 * 60);
          autoOut = `${String(Math.floor(totalOutMins / 60)).padStart(2, '0')}:${String(
            totalOutMins % 60
          ).padStart(2, '0')}`;
        }
        const approvedOt = getApprovedOvertimeHoursForEmployeeDate(emp.id, l.date);
        const computed = computeHoursFromClockInOut(cIn, autoOut, empStd, approvedOt, l.date);
        const wage = Math.round(computed.normalHours * hrRate + computed.overtimeHours * otRate);

        const updatedLog: PartTimeWorkLog = {
          ...l,
          id: l.id.startsWith('pt-att-') ? generateSessionUuid() : l.id,
          clockIn: cIn,
          clock_in: cIn,
          clockOut: autoOut,
          clock_out: autoOut,
          normalHours: computed.normalHours,
          normal_hours: computed.normalHours,
          overtimeHours: computed.overtimeHours,
          overtime_hours: computed.overtimeHours,
          hoursWorked: computed.totalHours,
          hours_worked: computed.totalHours,
          hourlyRate: hrRate,
          hourlyRateSnapshot: hrRate,
          hourly_rate: hrRate,
          overtimeRate: otRate,
          overtime_rate: otRate,
          dailyWage: wage,
          daily_wage: wage,
          notes: `${l.notes ? `${l.notes} • ` : ''}Clock-Out dilengkapi Admin (${autoOut} WIB)`,
        };
        onSaveLog(updatedLog);
        await upsertPartTimeLogToSupabase(updatedLog);
      }
      showToast(
        `Clock-Out ${logsToFix.length} hari kerja untuk ${emp.fullName} berhasil dilengkapi sesuai target jam kerja (${empStd} jam/hari)!`
      );
    } catch (err: any) {
      showToast(
        err?.message ||
          `Gagal melengkapi Clock-Out untuk ${emp.fullName}. Periksa koneksi internet/Supabase.`
      );
    } finally {
      setProcessingEmpId(null);
    }
  };

  const handleShiftWeek = (offsetWeeks: number) => {
    const baseDateStr =
      weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart.trim())
        ? weekStart.trim()
        : getJakartaDateString();
    const shiftedDateStr = addDaysToDateString(baseDateStr, offsetWeeks * 7);
    const range = getOperationalSixDayRange(shiftedDateStr);
    setWeekStart(range.startDate);
    setWeekEnd(range.endDate);
  };

  // Action: Pull / Refresh Weekly Attendance Data from Portal Karyawan & Supabase
  // Overwrites any stale 8-hour logs that actually have clock_in & clock_out (unless status === 'Paid')
  const handlePullAttendance = async () => {
    setIsPullingAttendance(true);
    try {
      // Preserve all current Part-Time employees in 'tgi_parttime_overrides' and 'tgi_employees_data' before pulling
      safeEmployees.forEach((emp) => {
        if (isEmployeePartTime(emp)) {
          saveEmployeeEmploymentMetaLocal(emp);
        }
      });
      if (onPullWeeklyAttendance) {
        await onPullWeeklyAttendance();
      }
      // Re-apply Part-Time overrides after pulling so state is never reset
      applyPartTimeOverridesToEmployees(safeEmployees);
      // Persist any bridged portal attendance logs and force-recalculate unpaid logs with clockIn & clockOut
      // Strictly process ONLY Part-Time employees (excluding PKWTT)
      for (const l of safeLogs) {
        if (l.status === 'Paid') continue;
        const emp = safeEmployees.find((e) => e.id === l.employeeId);
        if (!emp || !isEmployeePartTime(emp)) continue;
        const empStd = getEmployeeStandardDailyHours(emp);
        const approvedOt = getApprovedOvertimeHoursForEmployeeDate(emp.id, l.date);
        const hasIn = Boolean(l.clockIn && l.clockIn.trim() !== '' && l.clockIn !== '-');
        const hasOut = Boolean(l.clockOut && l.clockOut.trim() !== '' && l.clockOut !== '-');
        if (l.id.startsWith('pt-att-') || (hasIn && hasOut)) {
          const computed =
            hasIn && hasOut
              ? computeHoursFromClockInOut(l.clockIn, l.clockOut, empStd, approvedOt, l.date)
              : {
                  totalHours: Math.min(empStd, Number(l.hoursWorked ?? l.hours_worked) || 0),
                  normalHours: Math.min(empStd, Number(l.normalHours ?? l.normal_hours) || 0),
                  overtimeHours: approvedOt > 0 ? Math.min(Number(l.overtimeHours ?? l.overtime_hours) || 0, approvedOt) : 0,
                };
          const hrRate = Number(l.hourlyRate ?? l.hourlyRateSnapshot ?? l.hourly_rate) || 0;
          const otRate = Number(l.overtimeRate ?? l.overtime_rate) || Math.round(hrRate * 1.5);
          const wage = Math.round(computed.normalHours * hrRate + computed.overtimeHours * otRate);

          const persistedLog: PartTimeWorkLog = {
            ...l,
            id: l.id.startsWith('pt-att-') ? generateSessionUuid() : l.id,
            normalHours: computed.normalHours,
            normal_hours: computed.normalHours,
            overtimeHours: computed.overtimeHours,
            overtime_hours: computed.overtimeHours,
            hoursWorked: computed.totalHours,
            hours_worked: computed.totalHours,
            dailyWage: wage,
            daily_wage: wage,
          };
          onSaveLog(persistedLog);
          await upsertPartTimeLogToSupabase(persistedLog);
        }
      }
      showToast(
        `Berhasil menarik & mengoreksi durasi absensi Portal Karyawan Part-Time untuk siklus ${weekStart} s/d ${weekEnd}!`
      );
    } catch (err: any) {
      showToast(
        err?.message || 'Gagal menarik data absensi mingguan dari Supabase. Menggunakan data lokal.'
      );
    } finally {
      setIsPullingAttendance(false);
    }
  };

  // Action: Reset Status Paid / Hitung Ulang (membatalkan status Lunas & menghitung ulang durasi asli clock_out - clock_in)
  const handleResetEmployeePaid = async (row: EmployeeWeeklySummaryRow) => {
    setProcessingEmpId(row.employee.id);
    try {
      const logIds = row.weekLogs.map((l) => l.id);
      if (onResetLogsPaid) {
        onResetLogsPaid(logIds, row.employee.id, weekStart, weekEnd);
      }
      await resetPartTimeLogsPaidInSupabase(logIds, row.employee.id, weekStart, weekEnd);

      const empStd = getEmployeeStandardDailyHours(row.employee);
      // Hitung ulang paksa setiap log pada minggu ini dari clockIn & clockOut asli
      for (const l of row.weekLogs) {
        const hasIn = Boolean(l.clockIn && l.clockIn.trim() !== '' && l.clockIn !== '-');
        const hasOut = Boolean(l.clockOut && l.clockOut.trim() !== '' && l.clockOut !== '-');
        const approvedOt = getApprovedOvertimeHoursForEmployeeDate(row.employee.id, l.date);
        const computed =
          hasIn && hasOut
            ? computeHoursFromClockInOut(l.clockIn, l.clockOut, empStd, approvedOt, l.date)
            : hasIn && !hasOut
            ? computeHoursFromClockInOut(l.clockIn, l.clockOut, empStd, approvedOt, l.date)
            : {
                totalHours: Math.min(empStd, Number(l.hoursWorked ?? l.hours_worked) || 0),
                normalHours: Math.min(empStd, Number(l.normalHours ?? l.normal_hours) || 0),
                overtimeHours: approvedOt > 0 ? Math.min(Number(l.overtimeHours ?? l.overtime_hours) || 0, approvedOt) : 0,
              };
        const wage = Math.round(
          computed.normalHours * row.hourlyRate + computed.overtimeHours * row.overtimeRate
        );
        const recalculatedLog: PartTimeWorkLog = {
          ...l,
          id: l.id.startsWith('pt-att-') ? generateSessionUuid() : l.id,
          normalHours: computed.normalHours,
          normal_hours: computed.normalHours,
          overtimeHours: computed.overtimeHours,
          overtime_hours: computed.overtimeHours,
          hoursWorked: computed.totalHours,
          hours_worked: computed.totalHours,
          dailyWage: wage,
          daily_wage: wage,
          status: 'Unpaid',
          paidAt: undefined,
          paid_at: undefined,
          payoutPeriod: undefined,
          payout_period: undefined,
        };
        onSaveLog(recalculatedLog);
        await upsertPartTimeLogToSupabase(recalculatedLog);
      }

      showToast(
        `Status Paid ${row.employee.fullName} berhasil di-reset ke Unpaid & durasi jam kerja telah dihitung ulang dari jam masuk/keluar asli.`
      );
    } catch (err: any) {
      showToast(
        err?.message || `Gagal mereset status Paid untuk ${row.employee.fullName}.`
      );
    } finally {
      setProcessingEmpId(null);
    }
  };

  // Action: Open Confirmation Modal before marking as Paid (Flexible Payout) for a single Part-Time employee
  const handleMarkEmployeePaid = (row: EmployeeWeeklySummaryRow) => {
    if (row.totalHoursWorked <= 0 || row.grossPay <= 0 || row.unpaidGrossPay <= 0 || row.unpaidLogs.length === 0) {
      showToast(`Belum ada tagihan gaji untuk ${row.employee.fullName} (Total Rp 0).`);
      return;
    }
    const defaultActualDate = getJakartaDateString() || plannedPayoutDate;
    setPayoutConfirmModal({
      mode: 'single',
      row,
      actualPayoutDate: defaultActualDate,
      paymentMethod: 'Transfer Bank',
      notes: `Flexible Payout Part-Time (${weekStart} s/d ${weekEnd})`,
    });
  };

  // Action: Execute single employee Flexible Payout with chosen actualPayoutDate
  const executeSingleEmployeePaid = async (
    row: EmployeeWeeklySummaryRow,
    actualDate: string,
    paymentMethod: string,
    customNotes: string
  ) => {
    const chosenDate =
      actualDate && /^\d{4}-\d{2}-\d{2}$/.test(actualDate.trim())
        ? actualDate.trim()
        : plannedPayoutDate;

    setProcessingEmpId(row.employee.id);
    try {
      const logIds = row.unpaidLogs.map((l) => l.id);
      const nowIso = getJakartaIsoTimestamp();
      const paidIsoWithDate =
        chosenDate === getJakartaDateString()
          ? nowIso
          : `${chosenDate}T${nowIso.split('T')[1] || '12:00:00+07:00'}`;
      const normalPayPart = Math.round(row.unpaidNormalHours * row.hourlyRate);
      const overtimePayPart = Math.round(row.unpaidOvertimeHours * row.overtimeRate);

      const payoutRecord: PartTimeWeeklyPayout = {
        id: generateSessionUuid(),
        employeeId: row.employee.id,
        employee_id: row.employee.id,
        employeeName: row.employee.fullName,
        employee_name: row.employee.fullName,
        department: row.employee.department,
        role: row.employee.role,
        weekStartDate: weekStart,
        week_start_date: weekStart,
        weekEndDate: weekEnd,
        week_end_date: weekEnd,
        sundayPayoutDate: chosenDate,
        sunday_payout_date: chosenDate,
        payoutDate: chosenDate,
        normalHoursWorked: row.unpaidNormalHours,
        normal_hours_worked: row.unpaidNormalHours,
        overtimeHoursWorked: row.unpaidOvertimeHours,
        overtime_hours_worked: row.unpaidOvertimeHours,
        totalHoursWorked: row.unpaidHours,
        total_hours_worked: row.unpaidHours,
        totalDaysWorked: new Set(row.unpaidLogs.map((l) => l.date)).size,
        total_days_worked: new Set(row.unpaidLogs.map((l) => l.date)).size,
        hourlyRate: row.hourlyRate,
        hourly_rate: row.hourlyRate,
        overtimeRate: row.overtimeRate,
        overtime_rate: row.overtimeRate,
        normalPay: normalPayPart,
        normal_pay: normalPayPart,
        overtimePay: overtimePayPart,
        overtime_pay: overtimePayPart,
        grossPay: row.unpaidGrossPay,
        gross_pay: row.unpaidGrossPay,
        bankName: row.employee.bankName,
        bankAccountNumber: row.employee.bankAccountNumber,
        bankAccountHolder: row.employee.bankAccountHolder,
        status: 'Paid',
        paidAt: paidIsoWithDate,
        paid_at: paidIsoWithDate,
        logIds,
        notes: `${customNotes ? customNotes.trim() + ' • ' : ''}Tanggal Cair Aktual: ${formatIndoDate(chosenDate)} (${paymentMethod}) • Normal ${row.unpaidNormalHours}j × ${formatRupiah(row.hourlyRate)} + Lembur ${row.unpaidOvertimeHours}j × ${formatRupiah(row.overtimeRate)}`,
      };

      // Simpan juga tanggal rencana pencairan siklus ini agar sinkron
      handleChangePlannedPayoutDate(chosenDate);

      onMarkLogsPaid(logIds, payoutRecord);
      await markPartTimeLogsPaidInSupabase(logIds, payoutRecord);

      showToast(
        `Pencairan Gaji Part-Time berhasil! Gaji ${row.employee.fullName} sebesar ${formatRupiah(
          row.unpaidGrossPay
        )} telah ditandai Paid pada Tanggal Pencairan ${formatIndoDate(chosenDate)} & masuk Laporan Pengeluaran Mingguan.`
      );
    } catch (err: any) {
      showToast(
        err?.message || `Gagal menyimpan pencairan gaji untuk ${row.employee.fullName}.`
      );
    } finally {
      setProcessingEmpId(null);
    }
  };

  // Action: Open Confirmation Modal for Bulk Mark All Unpaid Part-Time Employees as Paid (Flexible Payout)
  const handleBulkMarkPaid = () => {
    const unpaidRows = weeklySummaryRows.filter(
      (r) => r.unpaidLogs.length > 0 && r.totalHoursWorked > 0 && r.unpaidGrossPay > 0
    );
    if (unpaidRows.length === 0) {
      showToast('Tidak ada tagihan jam kerja Part-Time (> Rp 0) yang belum dibayar pada siklus minggu ini.');
      return;
    }
    const defaultActualDate = getJakartaDateString() || plannedPayoutDate;
    setPayoutConfirmModal({
      mode: 'bulk',
      actualPayoutDate: defaultActualDate,
      paymentMethod: 'Transfer Bank',
      notes: `Bulk Flexible Payout Part-Time (${weekStart} s/d ${weekEnd})`,
    });
  };

  const executeBulkMarkPaid = async (
    actualDate: string,
    paymentMethod: string,
    customNotes: string
  ) => {
    const unpaidRows = weeklySummaryRows.filter(
      (r) => r.unpaidLogs.length > 0 && r.totalHoursWorked > 0 && r.unpaidGrossPay > 0
    );
    if (unpaidRows.length === 0) return;

    const chosenDate =
      actualDate && /^\d{4}-\d{2}-\d{2}$/.test(actualDate.trim())
        ? actualDate.trim()
        : plannedPayoutDate;

    setIsBulkPaying(true);
    try {
      const nowIso = getJakartaIsoTimestamp();
      const paidIsoWithDate =
        chosenDate === getJakartaDateString()
          ? nowIso
          : `${chosenDate}T${nowIso.split('T')[1] || '12:00:00+07:00'}`;

      for (const row of unpaidRows) {
        const logIds = row.unpaidLogs.map((l) => l.id);
        const normalPayPart = Math.round(row.unpaidNormalHours * row.hourlyRate);
        const overtimePayPart = Math.round(row.unpaidOvertimeHours * row.overtimeRate);

        const payoutRecord: PartTimeWeeklyPayout = {
          id: generateSessionUuid(),
          employeeId: row.employee.id,
          employee_id: row.employee.id,
          employeeName: row.employee.fullName,
          employee_name: row.employee.fullName,
          department: row.employee.department,
          role: row.employee.role,
          weekStartDate: weekStart,
          week_start_date: weekStart,
          weekEndDate: weekEnd,
          week_end_date: weekEnd,
          sundayPayoutDate: chosenDate,
          sunday_payout_date: chosenDate,
          payoutDate: chosenDate,
          normalHoursWorked: row.unpaidNormalHours,
          normal_hours_worked: row.unpaidNormalHours,
          overtimeHoursWorked: row.unpaidOvertimeHours,
          overtime_hours_worked: row.unpaidOvertimeHours,
          totalHoursWorked: row.unpaidHours,
          total_hours_worked: row.unpaidHours,
          totalDaysWorked: new Set(row.unpaidLogs.map((l) => l.date)).size,
          total_days_worked: new Set(row.unpaidLogs.map((l) => l.date)).size,
          hourlyRate: row.hourlyRate,
          hourly_rate: row.hourlyRate,
          overtimeRate: row.overtimeRate,
          overtime_rate: row.overtimeRate,
          normalPay: normalPayPart,
          normal_pay: normalPayPart,
          overtimePay: overtimePayPart,
          overtime_pay: overtimePayPart,
          grossPay: row.unpaidGrossPay,
          gross_pay: row.unpaidGrossPay,
          bankName: row.employee.bankName,
          bankAccountNumber: row.employee.bankAccountNumber,
          bankAccountHolder: row.employee.bankAccountHolder,
          status: 'Paid',
          paidAt: paidIsoWithDate,
          paid_at: paidIsoWithDate,
          logIds,
          notes: `${customNotes ? customNotes.trim() + ' • ' : ''}Tanggal Cair Aktual: ${formatIndoDate(chosenDate)} (${paymentMethod})`,
        };
        onMarkLogsPaid(logIds, payoutRecord);
        await markPartTimeLogsPaidInSupabase(logIds, payoutRecord);
      }

      handleChangePlannedPayoutDate(chosenDate);

      showToast(
        `Flexible Payout Massal selesai! ${unpaidRows.length} karyawan Part-Time telah ditandai Paid pada Tanggal Pencairan ${formatIndoDate(chosenDate)} dan tercatat ke Laporan Pengeluaran Mingguan.`
      );
    } catch (err: any) {
      showToast(
        err?.message || 'Gagal memproses Flexible Payout Massal. Periksa koneksi jaringan.'
      );
    } finally {
      setIsBulkPaying(false);
    }
  };

  const handleExportWeeklyCSV = () => {
    const headers = [
      'NIK',
      'Nama Karyawan Part-Time',
      'Departemen',
      'Siklus Mulai (Senin)',
      'Siklus Akhir (Sabtu)',
      'Jadwal Pencairan (Flexible Payout)',
      'Hari Kerja',
      'Jam Normal',
      'Jam Lembur',
      'Total Jam Kerja',
      'Tarif Normal / Jam (Rp)',
      'Tarif Lembur / Jam (Rp)',
      'Gaji Kotor Mingguan (Rp)',
      'Status Pembayaran',
      'Bank & No Rekening',
    ];

    const rows = weeklySummaryRows.map((r) => [
      r.employee.nik,
      `"${r.employee.fullName}"`,
      `"${r.employee.department}"`,
      weekStart,
      weekEnd,
      plannedPayoutDate,
      r.totalDaysWorked,
      r.normalHoursWorked,
      r.overtimeHoursWorked,
      r.totalHoursWorked,
      r.hourlyRate,
      r.overtimeRate,
      r.grossPay,
      r.isFullyPaid ? 'Paid (Flexible Payout)' : r.totalHoursWorked > 0 ? 'Unpaid' : 'Belum Ada Jam',
      `"${r.employee.bankName} ${r.employee.bankAccountNumber} a/n ${r.employee.bankAccountHolder}"`,
    ]);

    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((line) => line.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `TGI_PartTime_FlexiblePayout_${weekStart}_sd_${weekEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {Boolean(toastMessage) && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-orange-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-[11px] font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>MODUL PAYROLL PART-TIME MINGGUAN &amp; FLEXIBLE PAYOUT</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Payroll Part-Time (Mingguan) — Jadwal Cair Fleksibel
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Terhubung otomatis dengan absensi Clock-In &amp; Clock-Out Portal Karyawan Part-Time pada siklus operasional (Senin–Sabtu / Rentang Kustom) dengan rumus:{' '}
              <span className="text-orange-300 font-semibold">
                Total Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
              </span>{' '}
              untuk pencairan kapan saja (<strong>Flexible Payout / Jadwal Cair Fleksibel</strong>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPullingAttendance}
              onClick={handlePullAttendance}
              className="px-3.5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold shadow-md shadow-orange-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPullingAttendance ? 'animate-spin' : ''}`} />
              <span>
                {isPullingAttendance
                  ? 'Menarik Data Absensi...'
                  : 'Tarik Data Absensi Minggu Ini'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportWeeklyCSV}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-orange-300" />
              <span>Ekspor CSV Mingguan</span>
            </button>

            {Boolean(aggregateTotals.totalUnpaid > 0) && (
              <button
                type="button"
                disabled={isBulkPaying}
                onClick={handleBulkMarkPaid}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isBulkPaying
                    ? 'Memproses Pencairan...'
                    : `Tandai Semua Sudah Dibayar (${formatRupiah(aggregateTotals.totalUnpaid)})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Pemilih Siklus Mingguan (Senin–Sabtu / Kustom) & Date Picker Tanggal Rencana Pencairan Fleksibel */}
        <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-orange-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-400" />
                Pilih Periode Minggu (Senin–Sabtu):
              </span>
              <select
                value={activeWeeklyCycleInfo.startDate}
                onChange={(e) => handleSelectWeekCycle(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-orange-400/50 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
              >
                {selectableWeeklyCycles.map((cyc) => (
                  <option key={cyc.startDate} value={cyc.startDate} className="bg-slate-900 text-white">
                    {cyc.startDate === defaultWeek.startDate ? '★ [Minggu Berjalan] ' : ''}
                    {cyc.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleShiftWeek(-1)}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 cursor-pointer"
              >
                ← Minggu Lalu
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeekStart(defaultWeek.startDate);
                  setWeekEnd(defaultWeek.endDate);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-orange-500/30 hover:bg-orange-500/40 border border-orange-400/40 text-[11px] font-bold text-orange-200 cursor-pointer"
              >
                Minggu Ini
              </button>
              <button
                type="button"
                onClick={() => handleShiftWeek(1)}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 cursor-pointer"
              >
                Minggu Depan →
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeWeeklyCycleInfo.isCrossCutoff2526 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
                  ✓ Siklus Mingguan Utuh Lintas Cut-Off Tgl 25/26 (Senin–Sabtu Menyatu)
                </span>
              )}
              <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs font-bold">
                <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Tanggal Rencana Pencairan (Flexible Payout):</span>
                <input
                  type="date"
                  value={plannedPayoutDate}
                  onChange={(e) => handleChangePlannedPayoutDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-emerald-400/60 text-emerald-200 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  title="Ubah manual Tanggal Rencana Pencairan gaji Part-Time kapan saja"
                />
                <span className="text-[11px] text-emerald-300 font-semibold">
                  ({formatIndoDate(plannedPayoutDate)})
                </span>
                <button
                  type="button"
                  onClick={() => handleChangePlannedPayoutDate(getJakartaDateString())}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-300/40 text-[10px] font-extrabold text-white cursor-pointer"
                  title="Set Tanggal Rencana Pencairan ke Hari Ini"
                >
                  Hari Ini
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <span>Rentang Tanggal Kustom:</span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => {
                const cycle = getWeeklyCycleRangeForDate(e.target.value);
                setWeekStart(cycle.startDate);
                setWeekEnd(cycle.endDate);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-[11px] font-semibold"
              title="Memilih tanggal mana pun akan otomatis mengunci siklus Senin s/d Sabtu pada minggu tersebut"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-[11px] font-semibold"
            />
            <span className="text-orange-200/90 italic">
              *Perhitungan Part-Time Mingguan mengikuti siklus Senin–Sabtu (atau rentang kustom) tanpa terpotong di tanggal 25/26, dengan tanggal gajian bebas diatur manual kapan saja.
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">
              Karyawan Part-Time Aktif
            </span>
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {aggregateTotals.partTimeCount} Orang
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {aggregateTotals.unpaidEmployeeCount} karyawan menunggu pencairan gaji
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">
              Total Akumulasi Jam (6 Hari)
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {aggregateTotals.totalHours} Jam
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Normal: <strong>{aggregateTotals.totalNormalHours}j</strong> • Lembur:{' '}
            <strong className="text-indigo-700">{aggregateTotals.totalOvertimeHours}j</strong>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase">
              Siap Dicairkan (Unpaid)
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-2">
            {formatRupiah(aggregateTotals.totalUnpaid)}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            Rencana Cair: {formatIndoDate(plannedPayoutDate)} (Fleksibel)
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">
              Sudah Dibayar (Flexible Payout)
            </span>
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-900 mt-2">
            {formatRupiah(aggregateTotals.totalPaid)}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            Tercatat di Laporan Pengeluaran Mingguan
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('summary')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === 'summary'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Wallet className="w-4 h-4 text-orange-400" />
          <span>1. Rekap Gaji Mingguan &amp; Flexible Payout</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === 'logs'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>2. Pencatatan Jam Kerja Harian Part-Time ({safeLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('expenses')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === 'expenses'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>3. Laporan Pengeluaran Gaji Mingguan ({safePayouts.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: REKAP GAJI MINGGUAN & FLEXIBLE PAYOUT */}
      {activeSubTab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Akumulasi Gaji Mingguan Karyawan Part-Time (Siklus {weekStart} s/d {weekEnd})
              </h3>
              <p className="text-xs text-slate-500">
                Rumus Otomatis:{' '}
                <strong>
                  Total Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
                </strong>
                . Jadwal rencana cair saat ini: <strong className="text-emerald-700">{formatIndoDate(plannedPayoutDate)}</strong> (bebas diubah kapan saja).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isPullingAttendance}
                onClick={handlePullAttendance}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isPullingAttendance ? 'animate-spin' : ''}`} />
                <span>Tarik Data Absensi Minggu Ini</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('logs')}
                className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>+ Input Jam Kerja Harian</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <th className="py-3.5 px-4">Karyawan Part-Time</th>
                  <th className="py-3.5 px-4 text-center">Hari Kerja (Siklus 6 Hari)</th>
                  <th className="py-3.5 px-4 text-center">Jam Normal &amp; Lembur</th>
                  <th className="py-3.5 px-4 text-right">Tarif Normal &amp; Lembur / Jam</th>
                  <th className="py-3.5 px-4 text-right">Total Gaji Kotor Mingguan</th>
                  <th className="py-3.5 px-4">Rekening Pencairan</th>
                  <th className="py-3.5 px-4 text-center">Status Pencairan (Flexible Payout)</th>
                  <th className="py-3.5 px-4 text-center">Aksi Pencairan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeklySummaryRows.map((row) => {
                  const isProcessing = processingEmpId === row.employee.id;
                  return (
                    <tr key={row.employee.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={row.employee.avatarUrl}
                            alt={row.employee.fullName}
                            className="w-9 h-9 rounded-full object-cover border border-orange-300 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {row.employee.fullName}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {row.employee.nik} •{' '}
                              {formatRoleAndDepartment(
                                row.employee.role,
                                row.employee.department,
                                'paren'
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {row.totalDaysWorked} / 6 Hari
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[11px]">
                            Normal: {row.normalHoursWorked}j
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold text-[11px]">
                            Lembur: {row.overtimeHoursWorked}j
                          </span>
                        </div>
                        <span className="block text-[10px] text-slate-500 mt-1 font-semibold">
                          Total: {row.totalHoursWorked} Jam
                          {row.unpaidHours > 0 && row.paidHours > 0
                            ? ` (Belum cair: ${row.unpaidHours}j)`
                            : ''}
                        </span>
                        {row.missingClockOutLogs.length > 0 && (
                          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold">
                            ⚠️ {row.missingClockOutLogs.length} Hari Belum Clock-Out
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                        <span className="font-bold text-slate-800 block">
                          Normal: {formatRupiah(row.hourlyRate)}/jam
                        </span>
                        <span className="font-semibold text-indigo-700 block">
                          Lembur: {formatRupiah(row.overtimeRate)}/jam
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-extrabold text-sm text-slate-900 block">
                          {formatRupiah(row.netTakeHomePay)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Bruto {formatRupiah(row.grossPay)}
                          {row.totalDeductions > 0
                            ? ` • Potongan -${formatRupiah(row.totalDeductions)}`
                            : ` (Normal ${formatRupiah(row.normalPay)} + Lembur ${formatRupiah(row.overtimePay)})`}
                        </span>
                        {row.uncoveredDeductionDeficit > 0 && (
                          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">
                            Proteksi THP Rp 0 • Selisih Potongan: {formatRupiah(row.uncoveredDeductionDeficit)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {row.employee.bankName} - {row.employee.bankAccountNumber || '-'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          a/n {row.employee.bankAccountHolder || row.employee.fullName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {row.isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Paid (Flexible Payout)</span>
                          </span>
                        ) : row.totalHoursWorked === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                            Belum Ada Jam Kerja
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Unpaid ({formatRupiah(row.unpaidGrossPay)})</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {row.totalHoursWorked <= 0 || row.grossPay <= 0 ? (
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                              <button
                                type="button"
                                disabled
                                className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-400 text-[11px] font-bold flex items-center gap-1 cursor-not-allowed"
                                title="Tidak dapat mencairkan gaji Rp 0"
                              >
                                <span>Belum Ada Tagihan</span>
                              </button>
                              {Boolean(row.paidLogs.length > 0) && (
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleResetEmployeePaid(row)}
                                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Batalkan status Paid & hitung ulang durasi asli dari Clock-In & Clock-Out"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Reset Status / Hitung Ulang</span>
                                </button>
                              )}
                            </div>
                          ) : row.isFullyPaid ? (
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                              <span className="text-[11px] font-bold text-emerald-700 px-1.5">
                                ✓ Lunas Minggu Ini
                              </span>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleResetEmployeePaid(row)}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Batalkan status Paid & hitung ulang durasi asli dari Clock-In & Clock-Out"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Reset Status / Hitung Ulang</span>
                              </button>
                            </div>
                          ) : row.unpaidGrossPay <= 0 || row.unpaidLogs.length === 0 ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-400 text-[11px] font-bold flex items-center gap-1 cursor-not-allowed"
                              title="Tidak dapat mencairkan gaji Rp 0"
                            >
                              <span>Belum Ada Tagihan</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleMarkEmployeePaid(row)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Tandai Sudah Dibayar (Sunday Payout) & Masuk Laporan Pengeluaran Mingguan"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {isProcessing ? 'Memproses...' : 'Tandai Sudah Dibayar'}
                              </span>
                            </button>
                          )}

                          {row.missingClockOutLogs.length > 0 && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() =>
                                handleQuickCompletePartTimeClockOut(
                                  row.employee,
                                  row.missingClockOutLogs
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title={`Terdapat ${row.missingClockOutLogs.length} log belum Clock-Out. Klik untuk melengkapi otomatis sesuai jadwal shift.`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                ⚡ Lengkapi Clock-Out ({row.missingClockOutLogs.length})
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewingSlipRow(row)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="Lihat & Cetak Slip Gaji Mingguan Part-Time (Sunday Payout)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {weeklySummaryRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <Users className="w-8 h-8 text-orange-400" />
                        <p className="font-bold text-slate-800 text-sm">
                          Belum ada karyawan dengan tipe Part-Time
                        </p>
                        <p className="text-xs text-slate-500">
                          Ubah Tipe Karyawan menjadi <strong>Part-Time</strong> pada menu Data Karyawan, atau langsung catat jam kerja harian di tab <strong>Pencatatan Jam Kerja Harian Part-Time</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab('logs')}
                          className="mt-1 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Catat Jam Kerja Part-Time Sekarang
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: MODUL PENCATATAN JAM KERJA HARIAN PART-TIME */}
      {activeSubTab === 'logs' && (
        <PartTimeLogs
          employees={employees}
          logs={safeLogs}
          onSaveLog={onSaveLog}
          onDeleteLog={onDeleteLog}
          onResetLogPaid={async (log) => {
            if (onResetLogsPaid) {
              onResetLogsPaid([log.id], log.employeeId, weekStart, weekEnd);
            }
            await resetPartTimeLogsPaidInSupabase([log.id], log.employeeId, weekStart, weekEnd);
            const hasIn = Boolean(log.clockIn && log.clockIn.trim() !== '' && log.clockIn !== '-');
            const hasOut = Boolean(log.clockOut && log.clockOut.trim() !== '' && log.clockOut !== '-');
            const computed =
              hasIn && hasOut
                ? computeHoursFromClockInOut(log.clockIn, log.clockOut, STANDARD_WORK_HOURS_PER_DAY)
                : { totalHours: 0, normalHours: 0, overtimeHours: 0 };
            const hrRate = Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) || 0;
            const otRate = Number(log.overtimeRate ?? log.overtime_rate) || Math.round(hrRate * 1.5);
            const updated: PartTimeWorkLog = {
              ...log,
              normalHours: computed.normalHours,
              normal_hours: computed.normalHours,
              overtimeHours: computed.overtimeHours,
              overtime_hours: computed.overtimeHours,
              hoursWorked: computed.totalHours,
              hours_worked: computed.totalHours,
              dailyWage: Math.round(computed.normalHours * hrRate + computed.overtimeHours * otRate),
              daily_wage: Math.round(computed.normalHours * hrRate + computed.overtimeHours * otRate),
              status: 'Unpaid',
              paidAt: undefined,
              paid_at: undefined,
            };
            onSaveLog(updated);
            await upsertPartTimeLogToSupabase(updated);
            showToast(`Status Paid log tanggal ${log.date} berhasil di-reset & dihitung ulang.`);
          }}
          onUpdateEmployee={onUpdateEmployee}
          onPullWeeklyAttendance={handlePullAttendance}
          selectedWeekStart={weekStart}
          selectedWeekEnd={weekEnd}
          onChangeDateRange={(start, end) => {
            setWeekStart(start);
            setWeekEnd(end);
          }}
        />
      )}

      {/* SUB-TAB 3: LAPORAN PENGELUARAN GAJI MINGGUAN (FLEXIBLE PAYOUT EXPENSE REPORT) */}
      {activeSubTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Laporan Pengeluaran Gaji Mingguan Part-Time (Flexible Payout Expense Report)
              </h3>
              <p className="text-xs text-slate-500">
                Rekam jejak seluruh pencairan gaji mingguan karyawan Part-Time beserta Tanggal Aktual Pembayaran yang telah ditandai <strong>Paid</strong>.
              </p>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold">
              Total Pengeluaran Tercatat:{' '}
              {formatRupiah(
                safePayouts.reduce((sum, p) => sum + (Number(p.grossPay) || 0), 0)
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Tanggal Pencairan Aktual</th>
                  <th className="py-3 px-4">Karyawan Part-Time</th>
                  <th className="py-3 px-4">Periode Kerja (6 Hari)</th>
                  <th className="py-3 px-4 text-center">Jam Normal &amp; Lembur</th>
                  <th className="py-3 px-4 text-right">Tarif Normal &amp; Lembur</th>
                  <th className="py-3 px-4 text-right">Total Dicairkan</th>
                  <th className="py-3 px-4">Rekening Tujuan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safePayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {formatIndoDate(p.sundayPayoutDate || p.payoutDate || p.weekEndDate || '')}
                      <span className="block text-[10px] text-slate-400">
                        Dibayar: {p.paidAt ? new Date(p.paidAt).toLocaleString('id-ID') : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{p.employeeName}</span>
                      <span className="text-[10px] text-slate-500">
                        {formatRoleAndDepartment(p.role || 'Part-Time', p.department || 'Operasional', 'bullet')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {p.weekStartDate} s/d {p.weekEndDate}
                      <span className="block text-[10px] text-slate-400">
                        {p.totalDaysWorked} hari kerja aktif
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-orange-800">
                      {p.totalHoursWorked} Jam
                      {Boolean(p.normalHoursWorked !== undefined || p.overtimeHoursWorked !== undefined) && (
                        <span className="block text-[10px] text-slate-500 font-normal">
                          Normal {Number(p.normalHoursWorked ?? p.totalHoursWorked) || 0}j • Lembur{' '}
                          {Number(p.overtimeHoursWorked) || 0}j
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 text-[11px]">
                      <span className="block">{formatRupiah(Number(p.hourlyRate) || 0)}/jam</span>
                      {Boolean(Number(p.overtimeRate) > 0) && (
                        <span className="block text-[10px] text-indigo-700">
                          OT: {formatRupiah(Number(p.overtimeRate) || 0)}/jam
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                      {formatRupiah(Number(p.grossPay ?? p.grossSalary ?? p.gross_pay) || 0)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.bankName || 'BCA'} - {p.bankAccountNumber || '-'}
                      <span className="block text-[10px] text-slate-400">
                        a/n {p.bankAccountHolder || p.employeeName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Paid</span>
                      </span>
                    </td>
                  </tr>
                ))}
                {safePayouts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Belum ada histori pengeluaran Sunday Payout yang ditandai selesai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI TANGGAL AKTUAL PEMBAYARAN (FLEXIBLE PAYOUT) */}
      {Boolean(payoutConfirmModal) && payoutConfirmModal && (() => {
        const unpaidRowsForBulk = weeklySummaryRows.filter(
          (r) => r.unpaidLogs.length > 0 && r.totalHoursWorked > 0 && r.unpaidGrossPay > 0
        );
        const totalAmountToPay =
          payoutConfirmModal.mode === 'single' && payoutConfirmModal.row
            ? payoutConfirmModal.row.unpaidGrossPay
            : unpaidRowsForBulk.reduce((s, r) => s + r.unpaidGrossPay, 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {payoutConfirmModal.mode === 'single'
                        ? 'Konfirmasi Tanggal Pencairan Gaji Part-Time'
                        : `Konfirmasi Pencairan Massal (${unpaidRowsForBulk.length} Karyawan)`}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Jadwal Cair Fleksibel (Flexible Payout) • Siklus {weekStart} s/d {weekEnd}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayoutConfirmModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                {payoutConfirmModal.mode === 'single' && payoutConfirmModal.row ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-semibold">Karyawan:</span>
                      <span className="font-extrabold text-slate-900">
                        {payoutConfirmModal.row.employee.fullName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-semibold">Rekening Tujuan:</span>
                      <span className="font-bold text-slate-800">
                        {payoutConfirmModal.row.employee.bankName} •{' '}
                        {payoutConfirmModal.row.employee.bankAccountNumber || '-'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">Jumlah Penerima:</span>
                    <span className="font-extrabold text-slate-900">
                      {unpaidRowsForBulk.length} Karyawan Part-Time
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/70">
                  <span className="text-emerald-900 font-bold">Total Nominal Dicairkan:</span>
                  <span className="font-mono text-sm font-extrabold text-emerald-800">
                    {formatRupiah(totalAmountToPay)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Aktual Pembayaran / Pencairan Gaji
                  </label>
                  <input
                    type="date"
                    value={payoutConfirmModal.actualPayoutDate}
                    onChange={(e) =>
                      setPayoutConfirmModal((prev) =>
                        prev ? { ...prev, actualPayoutDate: e.target.value } : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPayoutConfirmModal((prev) =>
                          prev ? { ...prev, actualPayoutDate: getJakartaDateString() } : null
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                    >
                      Hari Ini ({formatIndoDate(getJakartaDateString())})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPayoutConfirmModal((prev) =>
                          prev ? { ...prev, actualPayoutDate: plannedPayoutDate } : null
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-bold cursor-pointer"
                    >
                      Sesuai Rencana ({formatIndoDate(plannedPayoutDate)})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={payoutConfirmModal.paymentMethod}
                    onChange={(e) =>
                      setPayoutConfirmModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              paymentMethod: e.target.value as
                                | 'Transfer Bank'
                                | 'Tunai / Kas Operasional',
                            }
                          : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai / Kas Operasional">Tunai / Kas Operasional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Catatan Pencairan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={payoutConfirmModal.notes}
                    onChange={(e) =>
                      setPayoutConfirmModal((prev) =>
                        prev ? { ...prev, notes: e.target.value } : null
                      )
                    }
                    placeholder="Contoh: Pencairan gaji mingguan Part-Time"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutConfirmModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const modalData = payoutConfirmModal;
                    setPayoutConfirmModal(null);
                    if (modalData.mode === 'single' && modalData.row) {
                      await executeSingleEmployeePaid(
                        modalData.row,
                        modalData.actualPayoutDate,
                        modalData.paymentMethod,
                        modalData.notes
                      );
                    } else if (modalData.mode === 'bulk') {
                      await executeBulkMarkPaid(
                        modalData.actualPayoutDate,
                        modalData.paymentMethod,
                        modalData.notes
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan &amp; Tandai Sudah Dibayar</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL SLIP GAJI MINGGUAN PART-TIME (FLEXIBLE PAYOUT SLIP) */}
      {Boolean(viewingSlipRow) && viewingSlipRow && (() => {
        const matchedPayout = safePayouts.find(
          (p) =>
            (p.employeeId === viewingSlipRow.employee.id ||
              p.employee_id === viewingSlipRow.employee.id) &&
            (p.weekStartDate === weekStart || p.week_start_date === weekStart) &&
            (p.weekEndDate === weekEnd || p.week_end_date === weekEnd)
        );
        const resolvedSlipPayoutDate =
          matchedPayout?.payoutDate ||
          matchedPayout?.sundayPayoutDate ||
          matchedPayout?.sunday_payout_date ||
          plannedPayoutDate;

        const ptSignatories = getPayrollSignatoriesConfig();
        const ptAccountingName =
          ptSignatories.preparedBy?.name && ptSignatories.preparedBy.name.trim()
            ? ptSignatories.preparedBy.name.trim()
            : 'Siti Rahma Ramadany, S.KM';
        const ptStampUrl =
          ptSignatories.preparedBy?.stampDataUrl ||
          ptSignatories.companyStampDataUrl ||
          generateOfficialCompanyStampDataUrl('PT LUPYTA MAJU PERKASA');
        const ptSignatureUrl =
          ptSignatories.preparedBy?.signatureDataUrl ||
          generateStylizedSignatureDataUrl(ptAccountingName, '#0f172a');
        const ptCity = ptSignatories.city?.trim() || 'Tangerang';

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-slate-400 print:rounded-none">
              {/* Kop Surat Resmi PT Lupyta Maju Perkasa (Statis / Non-Editable) */}
              <div
                contentEditable={false}
                suppressContentEditableWarning
                tabIndex={-1}
                aria-readonly="true"
                className="w-full border-b-2 border-slate-900 pb-2.5 mb-3 print:pb-2 print:mb-2.5 select-none pointer-events-none"
              >
                <div className="w-full overflow-hidden bg-white select-none pointer-events-none">
                  <img
                    src="/assets/aistudio/kop_surat_lupyta_clean.png"
                    alt="Kop Surat Resmi PT Lupyta Maju Perkasa"
                    draggable={false}
                    className="w-full h-auto object-contain block select-none pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-600 text-white print:hidden">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="inline-flex items-center px-3 py-0.5 rounded-full bg-orange-600 text-white print:bg-orange-100 print:text-orange-950 print:border print:border-orange-600 text-[10px] font-black tracking-wider uppercase mb-1">
                      SLIP GAJI PART-TIME (MINGGUAN)
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Periode Mingguan: {formatIndoDate(weekStart)} – {formatIndoDate(weekEnd)}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tas Grosir Import • Tanggal Pencairan: <strong>{formatIndoDate(resolvedSlipPayoutDate)}</strong> (Flexible Payout)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingSlipRow(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer print:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Nama Karyawan Part-Time
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {viewingSlipRow.employee.fullName}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {viewingSlipRow.employee.nik} •{' '}
                      {formatRoleAndDepartment(
                        viewingSlipRow.employee.role,
                        viewingSlipRow.employee.department,
                        'paren'
                      )}
                    </span>
                    <span className="block text-[10px] text-orange-800 font-semibold mt-0.5">
                      Status: Part-Time (Mingguan) • Normal: {formatRupiah(viewingSlipRow.hourlyRate)}/jam
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Tanggal Pencairan (Flexible Payout)
                    </span>
                    <span className="font-bold text-orange-700 text-sm">
                      {formatIndoDate(resolvedSlipPayoutDate)}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Status: {viewingSlipRow.isFullyPaid ? 'LUNAS (PAID)' : 'BELUM CAIR (UNPAID)'}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Total Kerja: {viewingSlipRow.normalHoursWorked} Jam ({viewingSlipRow.totalDaysWorked} Hari Kerja)
                    </span>
                  </div>
                </div>

                {/* Tabel Rincian Harian */}
                <div>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <h4 className="font-bold text-slate-800">
                      Rincian Jam Masuk &amp; Jam Kerja Per Hari (Senin, {formatIndoDate(weekStart)} – Sabtu, {formatIndoDate(weekEnd)}):
                    </h4>
                    {viewingSlipRow.missingClockOutLogs.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold">
                        ⚠️ {viewingSlipRow.missingClockOutLogs.length} Hari Belum Clock-Out
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                          <th className="py-2 px-3">Tanggal &amp; Jam Masuk–Pulang</th>
                          <th className="py-2 px-3 text-center">Jam Kerja</th>
                          <th className="py-2 px-3 text-center">Jam Lembur</th>
                          <th className="py-2 px-3 text-right">Subtotal Harian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingSlipRow.weekLogs.map((l) => {
                          const cIn = String(l.clockIn || l.clock_in || '').trim();
                          const cOut = String(l.clockOut || l.clock_out || '').trim();
                          const isMissingOut = Boolean(
                            cIn &&
                              cIn !== '-' &&
                              (!cOut ||
                                cOut === '-' ||
                                cOut.toLowerCase().includes('belum') ||
                                cIn === cOut)
                          );
                          const totalH = Math.max(0, Number(l.hoursWorked ?? l.hours_worked) || 0);
                          const normH =
                            l.normalHours !== undefined || l.normal_hours !== undefined
                              ? Math.min(
                                  STANDARD_WORK_HOURS_PER_DAY,
                                  Math.max(0, Number(l.normalHours ?? l.normal_hours) || 0)
                                )
                              : Math.min(STANDARD_WORK_HOURS_PER_DAY, totalH);
                          const otH =
                            l.overtimeHours !== undefined || l.overtime_hours !== undefined
                              ? Math.max(0, Number(l.overtimeHours ?? l.overtime_hours) || 0)
                              : 0;
                          const rowHrRate = Math.max(
                            0,
                            Number(l.hourlyRate ?? l.hourlyRateSnapshot ?? l.hourly_rate) ||
                              viewingSlipRow.hourlyRate
                          );
                          const rowOtRate = Math.max(
                            0,
                            Number(l.overtimeRate ?? l.overtime_rate) || viewingSlipRow.overtimeRate
                          );
                          const rowWage =
                            Math.round(normH * rowHrRate) + Math.round(otH * rowOtRate);

                          return (
                            <tr
                              key={l.id}
                              className={isMissingOut ? 'bg-rose-50/50 print:bg-white' : ''}
                            >
                              <td className="py-2 px-3 font-mono">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{formatIndoDate(l.date)}</span>
                                  {isMissingOut && (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[9px] font-bold">
                                      ⚠️ Belum Clock-Out
                                    </span>
                                  )}
                                </div>
                                {Boolean(cIn) && (
                                  <span className="block text-[10px] text-slate-500">
                                    {cIn} –{' '}
                                    {isMissingOut ? (
                                      <strong className="text-rose-700">Belum Clock-Out</strong>
                                    ) : (
                                      `${cOut} WIB`
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-emerald-800">
                                {normH} Jam
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-indigo-800">
                                {otH} Jam
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                {formatRupiah(rowWage)}
                              </td>
                            </tr>
                          );
                        })}
                        {viewingSlipRow.weekLogs.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">
                              Belum ada log jam kerja pada siklus minggu ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total Gaji Kotor Mingguan */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-800 font-semibold">
                    <span>
                      Upah Kerja ({viewingSlipRow.normalHoursWorked} Jam ×{' '}
                      {formatRupiah(viewingSlipRow.hourlyRate)}/jam • {viewingSlipRow.totalDaysWorked} Hari Kerja)
                    </span>
                    <span className="font-mono font-bold">
                      {formatRupiah(viewingSlipRow.normalPay)}
                    </span>
                  </div>
                  {viewingSlipRow.overtimeHoursWorked > 0 && (
                    <div className="flex items-center justify-between text-xs text-indigo-800">
                      <span>
                        Upah Jam Lembur ({viewingSlipRow.overtimeHoursWorked} Jam ×{' '}
                        {formatRupiah(viewingSlipRow.overtimeRate)}/jam)
                      </span>
                      <span className="font-mono font-bold">
                        {formatRupiah(viewingSlipRow.overtimePay)}
                      </span>
                    </div>
                  )}
                  {viewingSlipRow.bonusPay > 0 && (
                    <div className="flex items-start justify-between text-xs text-emerald-800 pt-1 border-t border-orange-200/60">
                      <div>
                        <span className="font-bold block">
                          Bonus Tambahan / Apresiasi
                        </span>
                        {Boolean(viewingSlipRow.bonusNotes) && (
                          <span className="text-[10px] text-emerald-700 block">
                            Catatan: {viewingSlipRow.bonusNotes}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-emerald-700">
                        +{formatRupiah(viewingSlipRow.bonusPay)}
                      </span>
                    </div>
                  )}
                  {viewingSlipRow.thrShowInPayslip && viewingSlipRow.thrPay > 0 && (
                    <div className="flex items-start justify-between text-xs text-emerald-900 pt-1 border-t border-orange-200/60">
                      <div>
                        <span className="font-extrabold block">
                          Tunjangan Hari Raya (THR)
                        </span>
                        {Boolean(viewingSlipRow.thrNotes) && (
                          <span className="text-[10px] text-emerald-700 block">
                            {viewingSlipRow.thrNotes}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-extrabold text-emerald-700">
                        +{formatRupiah(viewingSlipRow.thrPay)}
                      </span>
                    </div>
                  )}
                  {viewingSlipRow.totalDeductions > 0 && (
                    <div className="pt-2 border-t border-orange-200/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-700 font-semibold">
                        <span>Subtotal Penghasilan Bruto Mingguan</span>
                        <span className="font-mono font-bold">{formatRupiah(viewingSlipRow.grossPay)}</span>
                      </div>
                      {viewingSlipRow.latePenaltyDeduction > 0 && (
                        <div className="flex items-center justify-between text-rose-700">
                          <span>
                            Potongan Keterlambatan ({viewingSlipRow.lateMinutesTotal} menit — batas wajar shift)
                          </span>
                          <span className="font-mono font-bold">
                            -{formatRupiah(viewingSlipRow.latePenaltyDeduction)}
                          </span>
                        </div>
                      )}
                      {viewingSlipRow.kasbonDeduction > 0 && (
                        <div className="flex items-center justify-between text-rose-700">
                          <span>Potongan Cicilan Kasbon</span>
                          <span className="font-mono font-bold">
                            -{formatRupiah(viewingSlipRow.kasbonDeduction)}
                          </span>
                        </div>
                      )}
                      {viewingSlipRow.otherDeduction > 0 && (
                        <div className="flex items-center justify-between text-rose-700">
                          <span>Potongan Absensi / Izin Lainnya</span>
                          <span className="font-mono font-bold">
                            -{formatRupiah(viewingSlipRow.otherDeduction)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-rose-800 font-bold pt-1 border-t border-orange-200/50">
                        <span>Total Potongan Periode Ini</span>
                        <span className="font-mono">-{formatRupiah(viewingSlipRow.totalDeductions)}</span>
                      </div>
                    </div>
                  )}

                  {viewingSlipRow.uncoveredDeductionDeficit > 0 && (
                    <div className="p-3 rounded-xl bg-amber-100/90 border-2 border-amber-400 text-amber-950 space-y-1.5">
                      <p className="text-[11px] font-black uppercase tracking-wide text-amber-900">
                        ⚠️ Catatan Rincian Potongan &amp; Proteksi Take Home Pay Non-Negatif
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Total potongan (<strong>{formatRupiah(viewingSlipRow.totalDeductions)}</strong>) melebihi
                        Penghasilan Bruto Mingguan (<strong>{formatRupiah(viewingSlipRow.grossPay)}</strong>).
                        Take Home Pay ditetapkan minimal <strong>Rp 0 (tidak minus)</strong>. Selisih potongan
                        yang belum tertutup sebesar{' '}
                        <strong className="text-rose-700 underline">
                          {formatRupiah(viewingSlipRow.uncoveredDeductionDeficit)}
                        </strong>{' '}
                        dicatat sebagai sisa kewajiban periode berikutnya.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-orange-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-orange-950 block">
                        TOTAL TAKE HOME PAY BERSIH MINGGUAN (NON-NEGATIF)
                      </span>
                      <span className="text-[11px] text-orange-800">
                        Upah Kerja ({viewingSlipRow.normalHoursWorked} Jam × {formatRupiah(viewingSlipRow.hourlyRate)})
                        {viewingSlipRow.overtimeHoursWorked > 0 ? ' + Lembur' : ''}
                        {viewingSlipRow.bonusPay > 0 ? ' + Bonus Apresiasi' : ''}
                        {viewingSlipRow.thrShowInPayslip && viewingSlipRow.thrPay > 0 ? ' + THR' : ''}
                        {viewingSlipRow.totalDeductions > 0 ? ' − Potongan' : ''}
                      </span>
                    </div>
                    <span className="text-lg font-extrabold text-orange-900 font-mono">
                      {formatRupiah(viewingSlipRow.netTakeHomePay)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Rekening Transfer: <strong>{viewingSlipRow.employee.bankName}</strong> • No. Rek:{' '}
                  <strong>{viewingSlipRow.employee.bankAccountNumber || '-'}</strong> a/n{' '}
                  <strong>
                    {viewingSlipRow.employee.bankAccountHolder || viewingSlipRow.employee.fullName}
                  </strong>
                </div>

                {/* Area Tanda Tangan & Stempel Menumpuk di Atas Tanda Tangan (Prepared by Accounting) */}
                <div className="pt-4 mt-2 border-t border-slate-300 grid grid-cols-2 gap-6 text-center text-xs break-inside-avoid">
                  <div className="flex flex-col justify-between min-h-[125px]">
                    <span className="font-semibold text-slate-800">Karyawan Part-Time,</span>
                    <div className="h-20" />
                    <div className="border-t border-slate-800 pt-1.5 mx-auto w-44 max-w-full">
                      <p className="font-bold text-slate-950 truncate">
                        {viewingSlipRow.employee.fullName}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between min-h-[125px]">
                    <div>
                      <div className="text-[11px] text-slate-600 mb-0.5">
                        {ptCity}, {formatIndoDate(resolvedSlipPayoutDate)}
                      </div>
                      <span className="font-semibold text-slate-800">Prepared by Accounting,</span>
                    </div>
                    <div className="relative h-24 w-48 max-w-full mx-auto flex items-end justify-center my-0.5 select-none">
                      {Boolean(ptSignatureUrl) && (
                        <img
                          src={ptSignatureUrl}
                          alt={ptAccountingName}
                          className="max-h-[70px] max-w-[160px] object-contain relative z-10 mb-1 pointer-events-none select-none"
                        />
                      )}
                      {Boolean(ptStampUrl) && (
                        <img
                          src={ptStampUrl}
                          alt="Stempel Resmi Perusahaan"
                          className="payslip-stamp-overlay absolute left-1/2 -translate-x-[68%] -bottom-1.5 w-[104px] h-[104px] print:w-[104px] print:h-[104px] object-contain opacity-[0.92] contrast-125 saturate-[1.2] mix-blend-multiply -rotate-[8deg] pointer-events-none select-none z-20"
                        />
                      )}
                    </div>
                    <div className="border-t border-slate-800 pt-1.5 mx-auto w-48 max-w-full relative z-30">
                      <p className="font-bold text-slate-950 truncate">{ptAccountingName}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Unduh PDF Slip Mingguan (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSlipRow(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
