import React, { useState, useMemo } from 'react';
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
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  getEmployeeHourlyRate,
  STANDARD_WORK_HOURS_PER_DAY,
  isEmployeePartTime,
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
} from '../services/supabaseService';

interface PartTimePayrollSummaryProps {
  employees: Employee[];
  logs: PartTimeWorkLog[];
  payouts: PartTimeWeeklyPayout[];
  attendances?: AttendanceRecord[];
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
  grossPay: number;
  unpaidGrossPay: number;
  paidGrossPay: number;
  isFullyPaid: boolean;
}

export const PartTimePayrollSummary: React.FC<PartTimePayrollSummaryProps> = ({
  employees,
  logs,
  payouts,
  attendances = [],
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Compute Sunday Payout date from weekEnd (or next day after weekEnd)
  const sundayPayoutDate = useMemo(() => {
    if (!weekEnd) return defaultWeek.sundayPayoutDate;
    const d = new Date(weekEnd);
    if (Number.isNaN(d.getTime())) return defaultWeek.sundayPayoutDate;
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [weekEnd, defaultWeek.sundayPayoutDate]);

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
      const hrRate =
        Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) ||
        (emp
          ? Number(emp.hourlyRate ?? emp.hourly_rate) ||
            getEmployeeHourlyRate(emp, STANDARD_WORK_HOURS_PER_DAY, 25)
          : 0);
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

      if (hasIn && !hasOut) {
        mergedMap.set(key, {
          ...log,
          clockIn: resolvedIn,
          clock_in: resolvedIn,
          clockOut: '',
          clock_out: '',
          normalHours: 0,
          normal_hours: 0,
          overtimeHours: 0,
          overtime_hours: 0,
          hoursWorked: 0,
          hours_worked: 0,
          hourlyRate: hrRate,
          hourlyRateSnapshot: hrRate,
          hourly_rate: hrRate,
          overtimeRate: otRate,
          overtime_rate: otRate,
          dailyWage: 0,
          daily_wage: 0,
        });
      } else if (hasIn && hasOut) {
        const computed = computeHoursFromClockInOut(resolvedIn, resolvedOut, 8);
        const wage = Math.round(computed.normalHours * hrRate + computed.overtimeHours * otRate);
        mergedMap.set(key, {
          ...log,
          clockIn: resolvedIn,
          clock_in: resolvedIn,
          clockOut: resolvedOut,
          clock_out: resolvedOut,
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

      const clockIn =
        att.checkIn && att.checkIn.trim() !== '' && att.checkIn !== '-'
          ? att.checkIn
          : existingLog?.clockIn || '';
      const clockOut =
        att.checkOut && att.checkOut.trim() !== '' && att.checkOut !== '-'
          ? att.checkOut
          : existingLog?.clockOut || '';

      const hasClockOut = Boolean(clockOut && clockOut.trim() !== '' && clockOut !== '-');
      const computed =
        clockIn && hasClockOut
          ? computeHoursFromClockInOut(clockIn, clockOut, 8)
          : { totalHours: 0, normalHours: 0, overtimeHours: 0 };

      const hrRate =
        Number(emp.hourlyRate ?? emp.hourly_rate) ||
        getEmployeeHourlyRate(emp, STANDARD_WORK_HOURS_PER_DAY, 25);
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
      const hourlyRate =
        Number(emp.hourlyRate ?? emp.hourly_rate) ||
        getEmployeeHourlyRate(emp, STANDARD_WORK_HOURS_PER_DAY, 25);
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
        if (hasIn && !hasOut) {
          return { normH: 0, otH: 0, totalH: 0 };
        }
        if (hasIn && hasOut) {
          const computed = computeHoursFromClockInOut(l.clockIn, l.clockOut, 8);
          return {
            normH: computed.normalHours,
            otH: computed.overtimeHours,
            totalH: computed.totalHours,
          };
        }
        const totalH = Math.max(0, Number(l.hoursWorked ?? l.hours_worked) || 0);
        const normH =
          l.normalHours !== undefined || l.normal_hours !== undefined
            ? Math.max(0, Number(l.normalHours ?? l.normal_hours) || 0)
            : Math.min(8, totalH);
        const otH =
          l.overtimeHours !== undefined || l.overtime_hours !== undefined
            ? Math.max(0, Number(l.overtimeHours ?? l.overtime_hours) || 0)
            : Math.max(0, Math.round((totalH - normH) * 100) / 100);
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

      // Rumus Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
      const normalPay = Math.round(normalHoursWorked * hourlyRate);
      const overtimePay = Math.round(overtimeHoursWorked * overtimeRate);
      const grossPay = normalPay + overtimePay;

      const unpaidGrossPay =
        Math.round(unpaidNormalHours * hourlyRate) +
        Math.round(unpaidOvertimeHours * overtimeRate);
      const paidGrossPay =
        Math.round(paidNormalHours * hourlyRate) +
        Math.round(paidOvertimeHours * overtimeRate);

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
        grossPay,
        unpaidGrossPay,
        paidGrossPay,
        isFullyPaid,
      };
    });
  }, [relevantPartTimeEmployees, safeLogs, weekStart, weekEnd]);

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

  const handleShiftWeek = (offsetWeeks: number) => {
    const base = weekStart ? new Date(weekStart) : new Date();
    base.setDate(base.getDate() + offsetWeeks * 7);
    const range = getOperationalSixDayRange(base);
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
        const hasIn = Boolean(l.clockIn && l.clockIn.trim() !== '' && l.clockIn !== '-');
        const hasOut = Boolean(l.clockOut && l.clockOut.trim() !== '' && l.clockOut !== '-');
        if (l.id.startsWith('pt-att-') || (hasIn && hasOut)) {
          const computed =
            hasIn && hasOut
              ? computeHoursFromClockInOut(l.clockIn, l.clockOut, 8)
              : {
                  totalHours: Number(l.hoursWorked ?? l.hours_worked) || 0,
                  normalHours: Number(l.normalHours ?? l.normal_hours) || 0,
                  overtimeHours: Number(l.overtimeHours ?? l.overtime_hours) || 0,
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

      // Hitung ulang paksa setiap log pada minggu ini dari clockIn & clockOut asli
      for (const l of row.weekLogs) {
        const hasIn = Boolean(l.clockIn && l.clockIn.trim() !== '' && l.clockIn !== '-');
        const hasOut = Boolean(l.clockOut && l.clockOut.trim() !== '' && l.clockOut !== '-');
        const computed =
          hasIn && hasOut
            ? computeHoursFromClockInOut(l.clockIn, l.clockOut, 8)
            : hasIn && !hasOut
            ? { totalHours: 0, normalHours: 0, overtimeHours: 0 }
            : {
                totalHours: Number(l.hoursWorked ?? l.hours_worked) || 0,
                normalHours: Number(l.normalHours ?? l.normal_hours) || 0,
                overtimeHours: Number(l.overtimeHours ?? l.overtime_hours) || 0,
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
    } finally {
      setProcessingEmpId(null);
    }
  };

  // Action: Mark as Paid (Sunday Payout) for a single Part-Time employee
  const handleMarkEmployeePaid = async (row: EmployeeWeeklySummaryRow) => {
    if (row.totalHoursWorked <= 0 || row.grossPay <= 0 || row.unpaidGrossPay <= 0 || row.unpaidLogs.length === 0) {
      showToast(`Belum ada tagihan gaji untuk ${row.employee.fullName} (Total Rp 0).`);
      return;
    }

    setProcessingEmpId(row.employee.id);
    try {
      const logIds = row.unpaidLogs.map((l) => l.id);
      const nowIso = new Date().toISOString();
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
        sundayPayoutDate,
        sunday_payout_date: sundayPayoutDate,
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
        paidAt: nowIso,
        paid_at: nowIso,
        logIds,
        notes: `Sunday Payout Part-Time (${weekStart} s/d ${weekEnd}) • Normal ${row.unpaidNormalHours}j × ${formatRupiah(row.hourlyRate)} + Lembur ${row.unpaidOvertimeHours}j × ${formatRupiah(row.overtimeRate)}`,
      };

      onMarkLogsPaid(logIds, payoutRecord);
      await markPartTimeLogsPaidInSupabase(logIds, payoutRecord);

      showToast(
        `Sunday Payout berhasil! Gaji mingguan ${row.employee.fullName} sebesar ${formatRupiah(
          row.unpaidGrossPay
        )} (${row.unpaidNormalHours}j normal + ${row.unpaidOvertimeHours}j lembur) telah ditandai Paid & masuk Laporan Pengeluaran Mingguan.`
      );
    } finally {
      setProcessingEmpId(null);
    }
  };

  // Action: Bulk Mark All Unpaid Part-Time Employees as Paid (Sunday Payout)
  const handleBulkMarkPaid = async () => {
    const unpaidRows = weeklySummaryRows.filter(
      (r) => r.unpaidLogs.length > 0 && r.totalHoursWorked > 0 && r.unpaidGrossPay > 0
    );
    if (unpaidRows.length === 0) {
      showToast('Tidak ada tagihan jam kerja Part-Time (> Rp 0) yang belum dibayar pada siklus minggu ini.');
      return;
    }

    setIsBulkPaying(true);
    try {
      for (const row of unpaidRows) {
        const logIds = row.unpaidLogs.map((l) => l.id);
        const nowIso = new Date().toISOString();
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
          sundayPayoutDate,
          sunday_payout_date: sundayPayoutDate,
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
          paidAt: nowIso,
          paid_at: nowIso,
          logIds,
          notes: `Bulk Sunday Payout Part-Time (${weekStart} s/d ${weekEnd})`,
        };
        onMarkLogsPaid(logIds, payoutRecord);
        await markPartTimeLogsPaidInSupabase(logIds, payoutRecord);
      }
      showToast(
        `Sunday Payout Massal selesai! ${unpaidRows.length} karyawan Part-Time telah ditandai Paid dan tercatat ke Laporan Pengeluaran Mingguan.`
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
      'Jadwal Sunday Payout',
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
      sundayPayoutDate,
      r.totalDaysWorked,
      r.normalHoursWorked,
      r.overtimeHoursWorked,
      r.totalHoursWorked,
      r.hourlyRate,
      r.overtimeRate,
      r.grossPay,
      r.isFullyPaid ? 'Paid (Sunday Payout)' : r.totalHoursWorked > 0 ? 'Unpaid' : 'Belum Ada Jam',
      `"${r.employee.bankName} ${r.employee.bankAccountNumber} a/n ${r.employee.bankAccountHolder}"`,
    ]);

    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((line) => line.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `TGI_PartTime_SundayPayout_${weekStart}_sd_${weekEnd}.csv`);
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
              <span>MODUL PAYROLL PART-TIME MINGGUAN &amp; SUNDAY PAYOUT</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Payroll Part-Time (Minggu) — Tas Grosir Import
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Terhubung otomatis dengan absensi Clock-In &amp; Clock-Out Portal Karyawan Part-Time pada siklus operasional 6 hari (Senin–Sabtu) dengan rumus:{' '}
              <span className="text-orange-300 font-semibold">
                Total Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
              </span>{' '}
              untuk pencairan setiap hari Minggu (<strong>Sunday Payout</strong>).
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
                    ? 'Memproses Sunday Payout...'
                    : `Tandai Semua Sudah Dibayar (${formatRupiah(aggregateTotals.totalUnpaid)})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Pemilih Siklus Mingguan (6 Hari Operasional + Hari Minggu Payout) */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-orange-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange-400" />
              Siklus Kerja 6 Hari (Senin–Sabtu):
            </span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold"
            />
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

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Jadwal Pencairan Minggu (Sunday Payout): {formatIndoDate(sundayPayoutDate)}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            {aggregateTotals.unpaidEmployeeCount} karyawan menunggu Sunday Payout
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
              Siap Cair Hari Minggu (Unpaid)
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-2">
            {formatRupiah(aggregateTotals.totalUnpaid)}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            Klik &ldquo;Tandai Sudah Dibayar&rdquo; saat cair
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">
              Sudah Dibayar (Sunday Payout)
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
          <span>1. Rekap Gaji Mingguan &amp; Sunday Payout</span>
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

      {/* SUB-TAB 1: REKAP GAJI MINGGUAN & SUNDAY PAYOUT */}
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
                . Klik &ldquo;Tarik Data Absensi Minggu Ini&rdquo; sebelum mengeksekusi Sunday Payout.
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
                  <th className="py-3.5 px-4 text-center">Status Sunday Payout</th>
                  <th className="py-3.5 px-4 text-center">Aksi Sunday Payout</th>
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
                          {formatRupiah(row.grossPay)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Normal {formatRupiah(row.normalPay)} + Lembur {formatRupiah(row.overtimePay)}
                        </span>
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
                            <span>Paid (Sunday Payout)</span>
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
                ? computeHoursFromClockInOut(log.clockIn, log.clockOut, 8)
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

      {/* SUB-TAB 3: LAPORAN PENGELUARAN GAJI MINGGUAN (SUNDAY PAYOUT EXPENSE REPORT) */}
      {activeSubTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Laporan Pengeluaran Gaji Mingguan Part-Time (Sunday Payout Expense Report)
              </h3>
              <p className="text-xs text-slate-500">
                Rekam jejak seluruh pencairan gaji mingguan karyawan Part-Time yang telah ditandai <strong>Paid</strong>.
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
                  <th className="py-3 px-4">Tanggal Sunday Payout</th>
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

      {/* MODAL SLIP GAJI MINGGUAN PART-TIME (SUNDAY PAYOUT SLIP) */}
      {Boolean(viewingSlipRow) && viewingSlipRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-600 text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    SLIP GAJI MINGGUAN PART-TIME (SUNDAY PAYOUT)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tas Grosir Import • Siklus Kerja 6 Hari ({weekStart} s/d {weekEnd})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSlipRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
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
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Normal: {formatRupiah(viewingSlipRow.hourlyRate)}/jam • Lembur:{' '}
                    {formatRupiah(viewingSlipRow.overtimeRate)}/jam
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Jadwal Pencairan Minggu
                  </span>
                  <span className="font-bold text-orange-700 text-sm">
                    {formatIndoDate(sundayPayoutDate)}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Status: {viewingSlipRow.isFullyPaid ? 'LUNAS (PAID)' : 'BELUM CAIR (UNPAID)'}
                  </span>
                </div>
              </div>

              {/* Tabel Rincian Harian */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">
                  Rincian Jam Kerja Harian (Siklus 6 Hari Operasional):
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                        <th className="py-2 px-3">Tanggal &amp; Jam</th>
                        <th className="py-2 px-3 text-center">Jam Normal</th>
                        <th className="py-2 px-3 text-center">Jam Lembur</th>
                        <th className="py-2 px-3 text-right">Subtotal Harian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingSlipRow.weekLogs.map((l) => {
                        const totalH = Math.max(0, Number(l.hoursWorked ?? l.hours_worked) || 0);
                        const normH =
                          l.normalHours !== undefined || l.normal_hours !== undefined
                            ? Math.max(0, Number(l.normalHours ?? l.normal_hours) || 0)
                            : Math.min(8, totalH);
                        const otH =
                          l.overtimeHours !== undefined || l.overtime_hours !== undefined
                            ? Math.max(0, Number(l.overtimeHours ?? l.overtime_hours) || 0)
                            : Math.max(0, Math.round((totalH - normH) * 100) / 100);
                        const rowHrRate =
                          Number(l.hourlyRate ?? l.hourlyRateSnapshot ?? l.hourly_rate) ||
                          viewingSlipRow.hourlyRate;
                        const rowOtRate =
                          Number(l.overtimeRate ?? l.overtime_rate) || viewingSlipRow.overtimeRate;
                        const rowWage =
                          Math.round(normH * rowHrRate) + Math.round(otH * rowOtRate);

                        return (
                          <tr key={l.id}>
                            <td className="py-2 px-3 font-mono">
                              {l.date}
                              {Boolean(l.clockIn || l.clock_in) && (
                                <span className="block text-[10px] text-slate-400">
                                  {l.clockIn || l.clock_in} – {l.clockOut || l.clock_out || '-'} WIB
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
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>
                    Upah Jam Normal ({viewingSlipRow.normalHoursWorked} Jam ×{' '}
                    {formatRupiah(viewingSlipRow.hourlyRate)}/jam)
                  </span>
                  <span className="font-mono font-bold">
                    {formatRupiah(viewingSlipRow.normalPay)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-800">
                  <span>
                    Upah Jam Lembur ({viewingSlipRow.overtimeHoursWorked} Jam ×{' '}
                    {formatRupiah(viewingSlipRow.overtimeRate)}/jam)
                  </span>
                  <span className="font-mono font-bold">
                    {formatRupiah(viewingSlipRow.overtimePay)}
                  </span>
                </div>
                <div className="pt-2 border-t border-orange-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-orange-950 block">
                      TOTAL GAJI KOTOR MINGGUAN (TAKE HOME PAY)
                    </span>
                    <span className="text-[11px] text-orange-800">
                      (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
                    </span>
                  </div>
                  <span className="text-lg font-extrabold text-orange-900 font-mono">
                    {formatRupiah(viewingSlipRow.grossPay)}
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
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Slip Mingguan</span>
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
      )}
    </div>
  );
};
