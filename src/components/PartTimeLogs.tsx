import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';
import { Employee, PartTimeWorkLog, AttendanceRecord } from '../types';
import {
  formatRupiah,
  formatIndoDate,
  getEmployeeHourlyRate,
  getEmployeeStandardDailyHours,
  getApprovedOvertimeHoursForEmployeeDate,
  calculateCappedDailyWorkHours,
  STANDARD_WORK_HOURS_PER_DAY,
  isEmployeePartTime,
  getJakartaDateString,
  getJakartaIsoTimestamp,
  addDaysToDateString,
  getDayOfWeekFromDateString,
} from '../utils/formatters';
import {
  generateSessionUuid,
  upsertPartTimeLogToSupabase,
  deletePartTimeLogFromSupabase,
  syncEmployeeLiveColumnsToSupabase,
  applyPartTimeOverridesToEmployees,
  saveEmployeeEmploymentMetaLocal,
} from '../services/supabaseService';

interface PartTimeLogsProps {
  employees: Employee[];
  logs: PartTimeWorkLog[];
  attendances?: AttendanceRecord[];
  onSaveLog: (log: PartTimeWorkLog) => void;
  onDeleteLog: (id: string) => void;
  onResetLogPaid?: (log: PartTimeWorkLog) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  onPullWeeklyAttendance?: () => Promise<void> | void;
  selectedWeekStart?: string;
  selectedWeekEnd?: string;
  onChangeDateRange?: (start: string, end: string) => void;
}

export function formatRoleAndDepartment(
  role?: string,
  department?: string,
  separator: 'paren' | 'bullet' = 'bullet'
): string {
  const rawRole = (role || '').trim();
  const cleanRole = rawRole.replace(/\s*\(([^)]+)\)\s*$/, (_, inner) => {
    const base = rawRole.replace(/\s*\([^)]+\)\s*$/, '').trim();
    return base.toLowerCase() === String(inner).trim().toLowerCase() ? '' : ` (${inner})`;
  });
  const cleanDept = (department || '')
    .trim()
    .replace(/^\((.+)\)$/, '$1')
    .trim();
  if (cleanRole && cleanDept) {
    if (
      cleanRole.toLowerCase() === cleanDept.toLowerCase() ||
      cleanRole.toLowerCase().includes(`(${cleanDept.toLowerCase()})`)
    ) {
      return cleanRole;
    }
    return separator === 'paren' ? `${cleanRole} (${cleanDept})` : `${cleanRole} • ${cleanDept}`;
  }
  return cleanRole || cleanDept || 'Part-Time';
}

/**
 * Helper to compute the 6-day operational cycle (Monday to Saturday) containing a reference date
 * Strictly synchronized to Asia/Jakarta (WIB) without UTC midnight shift bugs.
 */
export function getOperationalSixDayRange(referenceDate: Date | string = new Date()): {
  startDate: string;
  endDate: string;
  sundayPayoutDate: string;
} {
  const refDateStr =
    typeof referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(referenceDate.trim())
      ? referenceDate.trim().slice(0, 10)
      : getJakartaDateString(referenceDate instanceof Date ? referenceDate : new Date());
  const day = getDayOfWeekFromDateString(refDateStr); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const startDate = addDaysToDateString(refDateStr, diffToMonday);
  const endDate = addDaysToDateString(startDate, 5); // 6 operational days: Mon..Sat
  const sundayPayoutDate = addDaysToDateString(startDate, 6); // Sunday Payout

  return {
    startDate,
    endDate,
    sundayPayoutDate,
  };
}

export function computeHoursFromClockInOut(
  clockIn?: string,
  clockOut?: string,
  standardNormalHours = STANDARD_WORK_HOURS_PER_DAY,
  approvedOvertimeHours = 0,
  attendanceDate?: string
): { totalHours: number; normalHours: number; overtimeHours: number } {
  const capped = calculateCappedDailyWorkHours(
    clockIn,
    clockOut,
    0,
    standardNormalHours,
    approvedOvertimeHours,
    attendanceDate
  );
  const normalHours = capped.cappedWorkHours;
  const overtimeHours = capped.overtimeHours;
  const totalHours = Number((normalHours + overtimeHours).toFixed(2));
  return { totalHours, normalHours, overtimeHours };
}

export const PartTimeLogs: React.FC<PartTimeLogsProps> = ({
  employees,
  logs,
  onSaveLog,
  onDeleteLog,
  onResetLogPaid,
  onUpdateEmployee,
  onPullWeeklyAttendance,
  selectedWeekStart,
  selectedWeekEnd,
  onChangeDateRange,
}) => {
  const defaultRange = useMemo(() => getOperationalSixDayRange(new Date()), []);
  const [filterStartDate, setFilterStartDate] = useState<string>(
    selectedWeekStart || defaultRange.startDate
  );
  const [filterEndDate, setFilterEndDate] = useState<string>(
    selectedWeekEnd || defaultRange.endDate
  );
  const [filterAllDates, setFilterAllDates] = useState<boolean>(false);
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Unpaid' | 'Paid'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllEmployeesInPicker, setShowAllEmployeesInPicker] = useState<boolean>(false);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState<boolean>(false);

  // Sync external date range when changed by parent
  useEffect(() => {
    if (selectedWeekStart) setFilterStartDate(selectedWeekStart);
    if (selectedWeekEnd) setFilterEndDate(selectedWeekEnd);
  }, [selectedWeekStart, selectedWeekEnd]);

  const safeEmployees = useMemo(
    () =>
      applyPartTimeOverridesToEmployees(
        Array.isArray(employees) ? employees.filter((e) => e && e.isActive !== false) : []
      ),
    [employees]
  );

  const partTimeEmployees = useMemo(
    () => safeEmployees.filter((e) => isEmployeePartTime(e)),
    [safeEmployees]
  );

  const selectableEmployees = useMemo(() => {
    if (showAllEmployeesInPicker || partTimeEmployees.length === 0) {
      return safeEmployees;
    }
    return partTimeEmployees;
  }, [showAllEmployeesInPicker, partTimeEmployees, safeEmployees]);

  // Form state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [workDate, setWorkDate] = useState<string>(() => getJakartaDateString());
  const [clockInInput, setClockInInput] = useState<string>('08:00');
  const [clockOutInput, setClockOutInput] = useState<string>('16:00');
  const [normalHours, setNormalHours] = useState<number>(8);
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [hourlyRateInput, setHourlyRateInput] = useState<number>(25000);
  const [overtimeRateInput, setOvertimeRateInput] = useState<number>(37500);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-select first part-time employee
  useEffect(() => {
    if (!selectedEmployeeId && selectableEmployees.length > 0) {
      const firstEmp = selectableEmployees[0];
      const empStd = getEmployeeStandardDailyHours(firstEmp);
      const hRate = getEmployeeHourlyRate(firstEmp, empStd, 25);
      const otRate =
        Number(firstEmp.overtimeRate ?? firstEmp.overtime_rate) || Math.round(hRate * 1.5);
      setSelectedEmployeeId(firstEmp.id);
      setNormalHours(empStd);
      setHourlyRateInput(hRate);
      setOvertimeRateInput(otRate);
    }
  }, [selectableEmployees, selectedEmployeeId]);

  const selectedEmployee = useMemo(
    () => safeEmployees.find((e) => e.id === selectedEmployeeId) || null,
    [safeEmployees, selectedEmployeeId]
  );

  const selectedEmpStdHours = useMemo(
    () => getEmployeeStandardDailyHours(selectedEmployee),
    [selectedEmployee]
  );

  const handleEmployeeSelectChange = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = safeEmployees.find((e) => e.id === empId);
    if (emp) {
      const empStd = getEmployeeStandardDailyHours(emp);
      const hRate = getEmployeeHourlyRate(emp, empStd, 25);
      const otRate = Number(emp.overtimeRate ?? emp.overtime_rate) || Math.round(hRate * 1.5);
      setHourlyRateInput(hRate);
      setOvertimeRateInput(otRate);
      const approvedOt = getApprovedOvertimeHoursForEmployeeDate(emp.id, workDate);
      const computed = computeHoursFromClockInOut(
        clockInInput,
        clockOutInput,
        empStd,
        approvedOt,
        workDate
      );
      if (computed.totalHours > 0) {
        setNormalHours(computed.normalHours);
        setOvertimeHours(computed.overtimeHours);
      }
    }
  };

  const handleClockChange = (newIn: string, newOut: string) => {
    setClockInInput(newIn);
    setClockOutInput(newOut);
    const approvedOt = getApprovedOvertimeHoursForEmployeeDate(selectedEmployeeId, workDate);
    const computed = computeHoursFromClockInOut(
      newIn,
      newOut,
      selectedEmpStdHours,
      approvedOt,
      workDate
    );
    if (computed.totalHours > 0) {
      setNormalHours(computed.normalHours);
      setOvertimeHours(computed.overtimeHours);
    }
  };

  const totalHoursWorked = useMemo(
    () => Math.round(((Number(normalHours) || 0) + (Number(overtimeHours) || 0)) * 100) / 100,
    [normalHours, overtimeHours]
  );

  // Rumus: Total Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)
  const calculatedDailyWage = useMemo(() => {
    const normPay = (Number(normalHours) || 0) * (Number(hourlyRateInput) || 0);
    const otPay = (Number(overtimeHours) || 0) * (Number(overtimeRateInput) || 0);
    return Math.round(normPay + otPay);
  }, [normalHours, overtimeHours, hourlyRateInput, overtimeRateInput]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleResetForm = () => {
    setEditingLogId(null);
    setWorkDate(getJakartaDateString());
    setClockInInput('09:00');
    setClockOutInput('18:00');
    setNormalHours(selectedEmpStdHours);
    setOvertimeHours(0);
    if (selectedEmployee) {
      const hRate = getEmployeeHourlyRate(selectedEmployee, selectedEmpStdHours, 25);
      const otRate =
        Number(selectedEmployee.overtimeRate ?? selectedEmployee.overtime_rate) ||
        Math.round(hRate * 1.5);
      setHourlyRateInput(hRate);
      setOvertimeRateInput(otRate);
    }
    setNotes('');
  };

  const handleEditClick = (log: PartTimeWorkLog) => {
    setEditingLogId(log.id);
    setSelectedEmployeeId(log.employeeId);
    setWorkDate(log.date);
    setClockInInput(log.clockIn || log.clock_in || '08:00');
    setClockOutInput(log.clockOut || log.clock_out || '16:00');
    const hrs = Number(log.hoursWorked) || 0;
    const norm =
      log.normalHours !== undefined || log.normal_hours !== undefined
        ? Number(log.normalHours ?? log.normal_hours) || 0
        : hrs;
    const ot =
      log.overtimeHours !== undefined || log.overtime_hours !== undefined
        ? Number(log.overtimeHours ?? log.overtime_hours) || 0
        : Math.max(0, hrs - norm);
    setNormalHours(norm);
    setOvertimeHours(ot);
    const hRate = Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) || 0;
    const otRate = Number(log.overtimeRate ?? log.overtime_rate) || Math.round(hRate * 1.5);
    setHourlyRateInput(hRate);
    setOvertimeRateInput(otRate);
    setNotes(log.notes || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showToast('Pilih karyawan Part-Time terlebih dahulu!');
      return;
    }
    if (!workDate) {
      showToast('Pilih tanggal kerja!');
      return;
    }
    if (totalHoursWorked <= 0) {
      showToast('Jumlah jam kerja harus lebih dari 0 jam!');
      return;
    }

    setIsSaving(true);
    try {
      const resolvedRate = Math.max(0, Math.round(Number(hourlyRateInput) || 0));
      const resolvedOtRate =
        Math.max(0, Math.round(Number(overtimeRateInput) || 0)) || Math.round(resolvedRate * 1.5);
      const empStd = getEmployeeStandardDailyHours(selectedEmployee);
      const approvedOtForDate = getApprovedOvertimeHoursForEmployeeDate(
        selectedEmployee.id,
        workDate
      );
      const resolvedNorm = Number(
        Math.min(empStd, Math.max(0, Number(normalHours) || 0)).toFixed(2)
      );
      const rawOtInput = Math.max(0, Number(overtimeHours) || 0);
      // Kunci lembur wajib approval Admin: kelebihan jam kerja hanya boleh dihitung lembur jika ada di overtime_requests ('Disetujui')
      const resolvedOt =
        approvedOtForDate > 0
          ? Number(Math.min(rawOtInput || approvedOtForDate, approvedOtForDate).toFixed(2))
          : 0;
      const resolvedHours = Math.round((resolvedNorm + resolvedOt) * 100) / 100;
      const totalWage = Math.round(resolvedNorm * resolvedRate + resolvedOt * resolvedOtRate);

      // Always persist Part-Time employee status & rates into 'tgi_parttime_overrides' and 'tgi_employees_data'
      const updatedEmp: Employee = {
        ...selectedEmployee,
        employmentType: 'Part-Time',
        employment_type: 'Part-Time',
        employmentStatus: 'Part-Time',
        status: 'Part-Time',
        hourlyRate: resolvedRate,
        hourly_rate: resolvedRate,
        overtimeRate: resolvedOtRate,
        overtime_rate: resolvedOtRate,
        dailySalary: Math.round(resolvedRate * empStd),
        daily_salary: Math.round(resolvedRate * empStd),
      };
      saveEmployeeEmploymentMetaLocal(updatedEmp);
      if (
        onUpdateEmployee &&
        (selectedEmployee.employmentType !== 'Part-Time' ||
          selectedEmployee.hourlyRate !== resolvedRate ||
          selectedEmployee.overtimeRate !== resolvedOtRate)
      ) {
        onUpdateEmployee(updatedEmp);
        syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
      }

      const existingLog = editingLogId ? logs.find((l) => l.id === editingLogId) : undefined;

      const newLog: PartTimeWorkLog = {
        id: editingLogId || generateSessionUuid(),
        employeeId: selectedEmployee.id,
        employee_id: selectedEmployee.id,
        employeeName: selectedEmployee.fullName,
        employee_name: selectedEmployee.fullName,
        employeeNik: selectedEmployee.nik,
        department: selectedEmployee.department,
        role: selectedEmployee.role,
        date: workDate,
        work_date: workDate,
        clockIn: clockInInput,
        clock_in: clockInInput,
        clockOut: clockOutInput,
        clock_out: clockOutInput,
        normalHours: resolvedNorm,
        normal_hours: resolvedNorm,
        overtimeHours: resolvedOt,
        overtime_hours: resolvedOt,
        hoursWorked: resolvedHours,
        hours_worked: resolvedHours,
        hourlyRate: resolvedRate,
        hourlyRateSnapshot: resolvedRate,
        hourly_rate: resolvedRate,
        overtimeRate: resolvedOtRate,
        overtime_rate: resolvedOtRate,
        dailyWage: totalWage,
        daily_wage: totalWage,
        source: existingLog?.source || 'admin',
        notes: notes.trim() || 'Shift Operasional Part-Time',
        status: existingLog?.status || 'Unpaid',
        paidAt: existingLog?.paidAt,
        paid_at: existingLog?.paid_at,
        payoutPeriod: existingLog?.payoutPeriod,
        payout_period: existingLog?.payout_period,
        createdAt: existingLog?.createdAt || getJakartaIsoTimestamp(),
      };

      onSaveLog(newLog);
      await upsertPartTimeLogToSupabase(newLog);

      showToast(
        editingLogId
          ? `Catatan jam kerja ${selectedEmployee.fullName} (${workDate}) berhasil diperbarui!`
          : `Jam kerja ${selectedEmployee.fullName} (${resolvedNorm}j normal + ${resolvedOt}j lembur • ${formatRupiah(totalWage)}) berhasil dicatat!`
      );
      handleResetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (log: PartTimeWorkLog) => {
    onDeleteLog(log.id);
    await deletePartTimeLogFromSupabase(log.id);
    showToast(`Catatan jam kerja ${log.employeeName} tanggal ${log.date} dihapus.`);
  };

  const applyQuickWeekRange = (offsetWeeks: number) => {
    const todayWib = getJakartaDateString();
    const targetRefDate = addDaysToDateString(todayWib, offsetWeeks * 7);
    const range = getOperationalSixDayRange(targetRefDate);
    setFilterAllDates(false);
    setFilterStartDate(range.startDate);
    setFilterEndDate(range.endDate);
    if (onChangeDateRange) {
      onChangeDateRange(range.startDate, range.endDate);
    }
  };

  const handlePullAttendanceClick = async () => {
    if (!onPullWeeklyAttendance) return;
    setIsSyncingAttendance(true);
    try {
      await onPullWeeklyAttendance();
      showToast('Data absensi Part-Time dari Portal Karyawan & Supabase berhasil ditarik!');
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  // Filtered daily logs (recalculating exact duration from clock_in & clock_out when present)
  const filteredLogs = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    return safeLogs
      .map((rawLog) => {
        const hasIn = Boolean(
          rawLog.clockIn && rawLog.clockIn.trim() !== '' && rawLog.clockIn !== '-'
        );
        const hasOut = Boolean(
          rawLog.clockOut && rawLog.clockOut.trim() !== '' && rawLog.clockOut !== '-'
        );
        const hRate = Number(rawLog.hourlyRate ?? rawLog.hourlyRateSnapshot ?? rawLog.hourly_rate) || 0;
        const otRate = Number(rawLog.overtimeRate ?? rawLog.overtime_rate) || Math.round(hRate * 1.5);

        const emp = safeEmployees.find((e) => e.id === rawLog.employeeId);
        const empStd = getEmployeeStandardDailyHours(emp);
        const approvedOt = getApprovedOvertimeHoursForEmployeeDate(rawLog.employeeId, rawLog.date);

        if (hasIn && (!hasOut || rawLog.clockIn?.trim() === rawLog.clockOut?.trim())) {
          const computedMissing = computeHoursFromClockInOut(
            rawLog.clockIn,
            rawLog.clockOut,
            empStd,
            approvedOt,
            rawLog.date
          );
          const wageMissing = Math.round(computedMissing.normalHours * hRate);
          return {
            ...rawLog,
            normalHours: computedMissing.normalHours,
            normal_hours: computedMissing.normalHours,
            overtimeHours: 0,
            overtime_hours: 0,
            hoursWorked: computedMissing.normalHours,
            hours_worked: computedMissing.normalHours,
            dailyWage: wageMissing,
            daily_wage: wageMissing,
          };
        }
        if (hasIn && hasOut) {
          const computed = computeHoursFromClockInOut(
            rawLog.clockIn,
            rawLog.clockOut,
            empStd,
            approvedOt,
            rawLog.date
          );
          const otH = computed.overtimeHours;
          const totalH = Number((computed.normalHours + otH).toFixed(2));
          const wage = Math.round(computed.normalHours * hRate + otH * otRate);
          return {
            ...rawLog,
            normalHours: computed.normalHours,
            normal_hours: computed.normalHours,
            overtimeHours: otH,
            overtime_hours: otH,
            hoursWorked: totalH,
            hours_worked: totalH,
            dailyWage: wage,
            daily_wage: wage,
          };
        }
        return rawLog;
      })
      .filter((log) => {
        const emp = safeEmployees.find((e) => e.id === log.employeeId);
        if (emp && !isEmployeePartTime(emp)) return false;
        if (!filterAllDates) {
          if (filterStartDate && log.date < filterStartDate) return false;
          if (filterEndDate && log.date > filterEndDate) return false;
        }
        if (selectedEmpFilter !== 'ALL' && log.employeeId !== selectedEmpFilter) {
          return false;
        }
        if (statusFilter !== 'ALL' && log.status !== statusFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (log.employeeName || '').toLowerCase().includes(q);
          const matchNotes = (log.notes || '').toLowerCase().includes(q);
          const matchDept = (log.department || '').toLowerCase().includes(q);
          if (!matchName && !matchNotes && !matchDept) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    logs,
    safeEmployees,
    filterAllDates,
    filterStartDate,
    filterEndDate,
    selectedEmpFilter,
    statusFilter,
    searchQuery,
  ]);

  const summaryStats = useMemo(() => {
    let totalNormalHours = 0;
    let totalOvertimeHours = 0;
    let totalHours = 0;
    let totalGross = 0;
    let unpaidGross = 0;
    let paidGross = 0;
    filteredLogs.forEach((l) => {
      const emp = safeEmployees.find((e) => e.id === l.employeeId);
      const empStd = getEmployeeStandardDailyHours(emp);
      const approvedOt = getApprovedOvertimeHoursForEmployeeDate(l.employeeId, l.date);
      const h = Math.max(0, Number(l.hoursWorked) || 0);
      const normH =
        l.normalHours !== undefined || l.normal_hours !== undefined
          ? Math.min(empStd, Math.max(0, Number(l.normalHours ?? l.normal_hours) || 0))
          : Math.min(empStd, h);
      const rawOtH =
        l.overtimeHours !== undefined || l.overtime_hours !== undefined
          ? Math.max(0, Number(l.overtimeHours ?? l.overtime_hours) || 0)
          : 0;
      const otH = approvedOt > 0 ? Math.min(rawOtH || approvedOt, approvedOt) : 0;
      const hRate = Number(l.hourlyRate ?? l.hourlyRateSnapshot ?? l.hourly_rate) || 0;
      const otRate = Number(l.overtimeRate ?? l.overtime_rate) || Math.round(hRate * 1.5);
      const w = Math.round(normH * hRate + otH * otRate);
      totalNormalHours += normH;
      totalOvertimeHours += otH;
      totalHours += h;
      totalGross += w;
      if (l.status === 'Paid') {
        paidGross += w;
      } else {
        unpaidGross += w;
      }
    });
    return {
      totalRecords: filteredLogs.length,
      totalNormalHours: Math.round(totalNormalHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      totalGross,
      unpaidGross,
      paidGross,
    };
  }, [filteredLogs]);

  return (
    <div className="space-y-5">
      {Boolean(toastMessage) && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Form Input Jam Kerja & Lembur Harian Part-Time */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 px-5 py-3.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {editingLogId
                  ? 'Edit Catatan Jam Kerja & Lembur Harian Part-Time'
                  : 'Form Pencatatan Jam Kerja & Lembur Harian Part-Time'}
              </h3>
              <p className="text-[11px] text-orange-100">
                Rumus Otomatis: <strong>Total Gaji Kotor = (Jam Normal × hourly_rate) + (Jam Lembur × overtime_rate)</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {Boolean(onPullWeeklyAttendance) && (
              <button
                type="button"
                disabled={isSyncingAttendance}
                onClick={handlePullAttendanceClick}
                className="px-3 py-1.5 rounded-xl bg-white text-orange-900 hover:bg-orange-50 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                <span>Tarik Data Absensi Minggu Ini</span>
              </button>
            )}
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-[10px] font-bold">
              Part-Time: {partTimeEmployees.length} Orang
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Pilih Karyawan Part-Time */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Pilih Karyawan Part-Time *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAllEmployeesInPicker(!showAllEmployeesInPicker)}
                  className="text-[10px] font-semibold text-orange-700 hover:underline cursor-pointer"
                >
                  {showAllEmployeesInPicker
                    ? 'Hanya Part-Time'
                    : `+ Semua Karyawan (${safeEmployees.length})`}
                </button>
              </div>
              <select
                value={selectedEmployeeId}
                onChange={(e) => handleEmployeeSelectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
              >
                {selectableEmployees.map((emp) => {
                  const isPt =
                    emp.employmentType === 'Part-Time' || emp.employment_type === 'Part-Time';
                  const rate = getEmployeeHourlyRate(emp, STANDARD_WORK_HOURS_PER_DAY, 25);
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({isPt ? 'Part-Time' : emp.employmentType || 'Reguler'} •{' '}
                      {formatRupiah(rate)}/jam)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Tanggal Kerja */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Kerja *
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
              />
            </div>

            {/* Clock-In & Clock-Out */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jam Masuk &amp; Keluar
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="time"
                  value={clockInInput}
                  onChange={(e) => handleClockChange(e.target.value, clockOutInput)}
                  className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                />
                <input
                  type="time"
                  value={clockOutInput}
                  onChange={(e) => handleClockChange(clockInInput, e.target.value)}
                  className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Jam Normal */}
            <div>
              <label className="block text-xs font-bold text-orange-900 mb-1">
                Jam Normal *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step="0.01"
                  value={normalHours}
                  onChange={(e) => setNormalHours(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full pl-3 pr-10 py-2 text-xs bg-orange-50 border border-orange-300 rounded-xl font-bold text-orange-950"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-700">
                  Jam
                </span>
              </div>
            </div>

            {/* Jam Lembur */}
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1">
                Jam Lembur (OT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step="0.01"
                  value={overtimeHours}
                  onChange={(e) => setOvertimeHours(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full pl-3 pr-10 py-2 text-xs bg-indigo-50 border border-indigo-300 rounded-xl font-bold text-indigo-950"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-700">
                  Jam
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100 items-end">
            {/* Tarif Normal & Tarif Lembur */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tarif Normal / Jam (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={hourlyRateInput}
                  onChange={(e) => setHourlyRateInput(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-800 mb-1">
                  Tarif Lembur / Jam (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={overtimeRateInput}
                  onChange={(e) => setOvertimeRateInput(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs bg-indigo-50/60 border border-indigo-200 rounded-xl font-bold text-indigo-950"
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Catatan Shift / Tugas Harian
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Shift Gudang & Packing Tas Import..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2">
              {Boolean(editingLogId) && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingLogId
                    ? 'Simpan Perubahan'
                    : `Catat (${totalHoursWorked}j = ${formatRupiah(calculatedDailyWage)})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter Rentang Tanggal Operasional (6 Hari Kerja) & Tabel Rekap Harian */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span>Tabel Rekap Harian Part-Time (Terhubung Otomatis dengan Absensi Portal)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Menampilkan data absensi Clock-In &amp; Clock-Out dari Portal Karyawan Part-Time maupun input Admin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => applyQuickWeekRange(0)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors ${
                !filterAllDates && filterStartDate === defaultRange.startDate
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
              }`}
            >
              Siklus Minggu Ini (6 Hari)
            </button>
            <button
              type="button"
              onClick={() => applyQuickWeekRange(-1)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            >
              Minggu Lalu
            </button>
            <button
              type="button"
              onClick={() => setFilterAllDates(!filterAllDates)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors ${
                filterAllDates
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {filterAllDates ? 'Menampilkan Semua Tanggal' : 'Tampilkan Semua Tanggal'}
            </button>
          </div>
        </div>

        {/* Baris Kontrol Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Mulai Tanggal (Senin)
            </label>
            <input
              type="date"
              disabled={filterAllDates}
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                if (onChangeDateRange) onChangeDateRange(e.target.value, filterEndDate);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Sampai Tanggal (Sabtu - 6 Hari)
            </label>
            <input
              type="date"
              disabled={filterAllDates}
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                if (onChangeDateRange) onChangeDateRange(filterStartDate, e.target.value);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Filter Karyawan Part-Time
            </label>
            <select
              value={selectedEmpFilter}
              onChange={(e) => setSelectedEmpFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="ALL">Semua Karyawan Part-Time</option>
              {selectableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Status Pembayaran Minggu
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'Unpaid' | 'Paid')}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="ALL">Semua Status (Unpaid &amp; Paid)</option>
              <option value="Unpaid">Belum Dibayar (Unpaid)</option>
              <option value="Paid">Sudah Dibayar (Paid - Sunday Payout)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Cari Nama / Catatan
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari catatan / nama..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Ringkasan Cepat Periode Terfilter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              Total Log Harian
            </span>
            <span className="text-base font-extrabold text-slate-900">
              {summaryStats.totalRecords} Hari Kerja
            </span>
          </div>
          <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
            <span className="text-[10px] font-bold text-orange-800 uppercase block">
              Jam Normal + Jam Lembur
            </span>
            <span className="text-base font-extrabold text-orange-950">
              {summaryStats.totalNormalHours}j Normal + {summaryStats.totalOvertimeHours}j OT
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">
              Belum Dibayar (Unpaid)
            </span>
            <span className="text-base font-extrabold text-amber-950">
              {formatRupiah(summaryStats.unpaidGross)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">
              Sudah Dibayar (Sunday Payout)
            </span>
            <span className="text-base font-extrabold text-emerald-950">
              {formatRupiah(summaryStats.paidGross)}
            </span>
          </div>
        </div>

        {/* Tabel Rekap Harian */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Tanggal &amp; Jam Absen</th>
                <th className="py-3 px-4">Karyawan Part-Time</th>
                <th className="py-3 px-4 text-center">Jam Normal</th>
                <th className="py-3 px-4 text-center">Jam Lembur</th>
                <th className="py-3 px-4 text-right">Tarif Normal &amp; OT</th>
                <th className="py-3 px-4 text-right">Total Gaji Kotor Harian</th>
                <th className="py-3 px-4">Sumber / Catatan</th>
                <th className="py-3 px-4 text-center">Status Payout</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const hrs = Number(log.hoursWorked) || 0;
                const normH =
                  log.normalHours !== undefined || log.normal_hours !== undefined
                    ? Number(log.normalHours ?? log.normal_hours) || 0
                    : hrs;
                const otH =
                  log.overtimeHours !== undefined || log.overtime_hours !== undefined
                    ? Number(log.overtimeHours ?? log.overtime_hours) || 0
                    : Math.max(0, hrs - normH);
                const hRate =
                  Number(log.hourlyRate ?? log.hourlyRateSnapshot ?? log.hourly_rate) || 0;
                const otRate =
                  Number(log.overtimeRate ?? log.overtime_rate) || Math.round(hRate * 1.5);
                const dailyTotal =
                  Math.round(normH * hRate + otH * otRate) ||
                  Number(log.dailyWage) ||
                  Math.round(hrs * hRate);

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {formatIndoDate(log.date)}
                      <span className="block text-[10px] text-emerald-700 font-bold">
                        {Boolean(log.clockIn || log.clock_in)
                          ? `${log.clockIn || log.clock_in} – ${log.clockOut || log.clock_out || 'Aktif'} WIB`
                          : log.date}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{log.employeeName}</span>
                      <span className="text-[10px] text-slate-500">
                        {formatRoleAndDepartment(log.role || 'Part-Time', log.department || 'Operasional', 'bullet')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-900 border border-orange-200 font-extrabold text-xs">
                        {normH} Jam
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {Boolean(otH > 0) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-extrabold text-xs">
                          +{otH} Jam OT
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">0 Jam</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      <span className="block font-semibold text-slate-900">
                        Normal: {formatRupiah(hRate)}/j
                      </span>
                      <span className="block text-[10px] text-indigo-700">
                        Lembur: {formatRupiah(otRate)}/j
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className="font-extrabold text-slate-900 text-xs block">
                        {formatRupiah(dailyTotal)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({normH}×{formatRupiah(hRate)})
                        {Boolean(otH > 0) ? ` + (${otH}×${formatRupiah(otRate)})` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase mb-0.5 ${
                          log.source === 'portal' || log.source === 'attendance_sync'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.source === 'portal' || log.source === 'attendance_sync'
                          ? 'Absensi Portal'
                          : 'Input Admin'}
                      </span>
                      <span className="block truncate text-[11px]">{log.notes || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {log.status === 'Paid' ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Paid (Sunday Payout)</span>
                          </span>
                          {Boolean(onResetLogPaid) && (
                            <button
                              type="button"
                              onClick={() => onResetLogPaid?.(log)}
                              className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                            >
                              Reset Status / Hitung Ulang
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Unpaid (Belum Cair)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditClick(log)}
                          title="Edit Jam Kerja"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(log)}
                          title="Hapus Catatan"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Clock className="w-7 h-7 text-slate-300" />
                      <p className="font-bold text-slate-700 text-xs">
                        Belum ada catatan jam kerja harian Part-Time pada rentang tanggal ini
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Klik tombol &ldquo;Tarik Data Absensi Minggu Ini&rdquo; atau gunakan form di atas.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
