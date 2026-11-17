import React, { useState, useEffect, useMemo } from 'react';
import {
  Employee,
  PayrollRecord,
  CompanyConfig,
  PayrollSignatoriesConfig,
  EmployeeBonus,
  EmployeeAdjustment,
  PayrollDeductionRecord,
  CashAdvance,
  LeaveRequest,
  OvertimeRequest,
  LiveStreamSalesRecord,
  DailyWorkWageItem,
  ThrPayoutRecord,
} from '../types';
import {
  formatRupiah,
  formatAccountingRupiah,
  terbilangRupiah,
  formatIndoDate,
  formatCutOffPeriodRange,
  formatEndOfPeriodPrintDate,
  getOvertimeRatePerMinute,
  getOvertimeMinutes,
  calculateOvertimePayByMinutes,
  calculateCappedDailyWorkHours,
  getPayrollSignatoriesConfig,
  savePayrollSignatoriesConfig,
  getEmployeeDailySalary,
  getEmployeeHourlyRate,
  getEmployeeStandardDailyHours,
  STANDARD_WORK_HOURS_PER_DAY,
  calculateEmployeeLiveSalesCommission,
  getEmployeeBonusesForPeriod,
  getEmployeeAdjustmentForPeriod,
  getEmployeePayrollDeductionForPeriod,
  getApprovedSickLeaveSummaryForPeriod,
  getApprovedUnpaidLeaveSummaryForPeriod,
  getActiveEmployeeThrForPayslip,
  generateOfficialCompanyStampDataUrl,
  generateStylizedSignatureDataUrl,
  isEmployeePartTime,
  normalizeEmploymentType,
  clampNonNegativeNumber,
  getWeeklyCycleRangeForDate,
  getJakartaDateString,
  filterOvertimeRequestsForPeriod,
  isPayrollPeriodPastCutoff,
} from '../utils/formatters';
import { getPayslipWhatsAppUrl, getPayslipEmailUrl } from '../utils/notificationHelper';
import {
  X,
  Printer,
  Download,
  MessageCircle,
  Mail,
  PenTool,
  Check,
  Lock,
} from 'lucide-react';
import { SignatoryConfigModal } from './SignatoryConfigModal';
import {
  fetchLivestreamSessionsFromSupabase,
  fetchEmployeeByIdFromSupabase,
  getSavedEmployeeBonuses,
  fetchEmployeeBonuses,
  getSavedEmployeeAdjustments,
  fetchEmployeeAdjustments,
  getSavedPayrollDeductions,
  fetchPayrollDeductions,
  getSavedThrPayouts,
  fetchThrPayoutsFromSupabase,
} from '../services/supabaseService';

export interface OfficialPayslipComputedData {
  effectiveEmployee: Employee;
  isPartTime: boolean;
  weeklyPeriodLabel: string;
  weeklyStartDate?: string;
  weeklyEndDate?: string;
  sundayPayoutDate?: string;
  periodCutOffLabel: string;
  printCityAndDate: string;
  workDaysCount: number;
  totalActualWorkHours: number;
  maxNormalHoursPerDay: number;
  hourlyRate: number;
  dailyWorkBreakdown: DailyWorkWageItem[];
  missingClockOutDaysCount: number;
  positionLines: string[];
  // 1. Gaji Tetap
  dailySalaryRate: number;
  gajiPokokTotal: number;
  tunjanganJabatanRate: number;
  tunjanganJabatanTotal: number;
  subtotalGajiTetap: number;
  // 2. Gaji Tidak Tetap
  tunjanganKerajinanRate: number;
  tunjanganKerajinanTotal: number;
  tunjanganKedisiplinanRate: number;
  tunjanganKedisiplinanTotal: number;
  overtimeHourlyRate: number;
  overtimeHoursQty: number;
  lemburJamTotal: number;
  overtimeDailyRate: number;
  overtimeDaysQty: number;
  lemburHariTotal: number;
  bonusItems: Array<{
    id: string;
    amount: number;
    qty: number;
    reason_note: string;
  }>;
  totalTambahanLainnya: number;
  liveOmsetAmount: number;
  liveCommissionPct: number;
  liveCommissionPerPcs: number;
  liveCommissionPcsNote: string;
  liveCommissionFormulaLabel: string;
  salesCommissionAmount: number;
  // Tunjangan Hari Raya (THR) - HANYA aktif jika show_in_payslip === true dari ceklis Admin
  thrShowInPayslip: boolean;
  thrAmount: number;
  thrBasisAmount: number;
  thrHolidayName: string;
  thrTenureLabel: string;
  thrProportionFormula: string;
  thrPaymentStatus: 'Belum Cair' | 'Sudah Dibayar';
  subtotalGajiTidakTetap: number;
  // 3. Pengurangan
  alphaDays: number;
  alphaRate: number;
  alphaDeductionTotal: number;
  izinJamMinutes: number;
  izinJamRate: number;
  izinJamDeduction: number;
  izinHariDays: number;
  izinHariRate: number;
  izinHariDeduction: number;
  sakitDays: number;
  sakitRate: number;
  sakitDeduction: number;
  lateRatePerMinute: number;
  totalLateMinutes: number;
  lateDeductionTotal: number;
  kesalahanRate: number;
  kesalahanQty: number;
  kesalahanTotal: number;
  catatanKesalahan?: string;
  catatanPotongan?: string;
  // Kasbon
  sisaKasbonBulanLalu: number;
  pembayaranKasbonBulanIni: number;
  sisaKasbonBulanDepan: number;
  // BPJS & PPh 21
  bpjsBaseSalary: number;
  bpjsTkPct: number;
  bpjsTkEmployeeTotal: number;
  bpjsKesPct: number;
  bpjsKesEmployeeTotal: number;
  pph21Total: number;
  subtotalPengurangan: number;
  // 4. Jumlah Bersih & Proteksi Take Home Pay Non-Negatif
  totalGrossIncome: number;
  coveredDeductionAmount: number;
  uncoveredDeductionDeficit: number;
  hasUncoveredDeductionDeficit: boolean;
  jumlahBersih: number;
  terbilangText: string;
}

function getLocalPartTimeBreakdownForEmployee(
  employeeId: string,
  maxNormalHoursPerDay: number,
  hourlyRate: number
): DailyWorkWageItem[] {
  if (!employeeId || typeof window === 'undefined') return [];
  try {
    const rawPt = localStorage.getItem('tgi_part_time_logs_data');
    if (rawPt) {
      const parsedPt = JSON.parse(rawPt);
      if (Array.isArray(parsedPt)) {
        const empPtLogs = parsedPt
          .filter((l: any) => l && (l.employeeId === employeeId || l.employee_id === employeeId) && l.date)
          .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
        if (empPtLogs.length > 0) {
          const latestDate = empPtLogs[empPtLogs.length - 1].date;
          const weekCycle = getWeeklyCycleRangeForDate(latestDate);
          const weekFiltered = empPtLogs.filter(
            (l: any) => l.date >= weekCycle.startDate && l.date <= weekCycle.endDate
          );
          const targetLogs = weekFiltered.length > 0 ? weekFiltered : empPtLogs.slice(-6);
          return targetLogs.map((l: any) => {
            const cIn = String(l.clockIn || l.clock_in || '-').trim();
            const cOut = String(l.clockOut || l.clock_out || '-').trim();
            const rawHours = clampNonNegativeNumber(
              l.normalHours ?? l.normal_hours ?? l.hoursWorked ?? l.hours_worked,
              0
            );
            const capped = calculateCappedDailyWorkHours(
              cIn,
              cOut,
              rawHours,
              maxNormalHoursPerDay,
              0,
              String(l.date).slice(0, 10)
            );
            const isMissingOut = Boolean(
              capped.isMissingClockOut ||
                !cOut ||
                cOut === '-' ||
                cOut.toLowerCase().includes('belum') ||
                (cIn && cIn !== '-' && cIn === cOut)
            );
            const finalHours =
              capped.cappedWorkHours > 0
                ? capped.cappedWorkHours
                : isMissingOut
                ? 0
                : Math.min(maxNormalHoursPerDay, Math.max(0, rawHours));
            return {
              date: String(l.date).slice(0, 10),
              checkIn: cIn,
              checkOut: isMissingOut ? 'Belum Clock-Out' : cOut,
              workHours: finalHours,
              rawDurationHours: capped.rawDurationHours || rawHours,
              isCappedToMax: capped.isCappedToMax,
              isMissingClockOut: isMissingOut,
              dailyWage: Math.round(finalHours * hourlyRate),
              status: 'Hadir Tepat Waktu',
            };
          });
        }
      }
    }
  } catch {
    // ignore fallback error
  }
  return [];
}

function getLocalCashAdvancesForEmployee(employeeId: string): CashAdvance[] {
  if (!employeeId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tgi_cash_advances_data');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c: CashAdvance) =>
        c &&
        c.employeeId === employeeId &&
        (c.status === 'disbursed' || c.status === 'approved' || c.status === 'paid')
    );
  } catch {
    return [];
  }
}

function getLocalLeavesForEmployee(employeeId: string): LeaveRequest[] {
  if (!employeeId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tgi_leave_requests_data');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l: LeaveRequest) => l && l.employeeId === employeeId && l.status === 'Disetujui'
    );
  } catch {
    return [];
  }
}

function getLocalOvertimeRequestsForEmployee(employeeId: string): OvertimeRequest[] {
  if (!employeeId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tgi_overtime_requests_data');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o: OvertimeRequest) => o && o.employeeId === employeeId);
  } catch {
    return [];
  }
}

export function computeOfficialPayslipData(params: {
  payroll: PayrollRecord;
  employee: Employee;
  companyConfig: CompanyConfig;
  employeeBonuses?: EmployeeBonus[];
  employeeAdjustments?: EmployeeAdjustment[];
  payrollDeductions?: PayrollDeductionRecord[];
  thrPayouts?: ThrPayoutRecord[];
  cashAdvances?: CashAdvance[];
  leaveRequests?: LeaveRequest[];
  overtimeRequests?: OvertimeRequest[];
  signatories?: PayrollSignatoriesConfig;
}): OfficialPayslipComputedData {
  const {
    payroll,
    employee,
    companyConfig,
    employeeBonuses = [],
    employeeAdjustments,
    payrollDeductions,
    thrPayouts,
    cashAdvances,
    leaveRequests,
    overtimeRequests,
    signatories,
  } = params;

  const isPartTime =
    isEmployeePartTime(employee) ||
    normalizeEmploymentType((payroll as any)?.employmentType || (payroll as any)?.employmentStatus) ===
      'Part-Time';
  const periodStr = payroll.period || companyConfig.currentPayrollPeriod || 'November 2026';

  // Multi-line Posisi / Jabatan dengan tanda "-"
  const rawRoleParts = (employee.role || '-')
    .split(/(?:\r?\n|\/|;|•|,)+/)
    .map((s) => s.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  const isHost = Boolean(employee.is_host || employee.isLiveStreamHost);
  const isCoHost = Boolean(employee.is_co_host || employee.isCoHostLiveStream);
  if (
    isHost &&
    !rawRoleParts.some((r) => r.toLowerCase().includes('host'))
  ) {
    rawRoleParts.push('Host Live Streaming');
  }
  if (
    isCoHost &&
    !rawRoleParts.some((r) => r.toLowerCase().includes('co-host') || r.toLowerCase().includes('co host'))
  ) {
    rawRoleParts.push('Co-Host Live Streaming');
  }
  const positionLines = rawRoleParts.length > 0 ? rawRoleParts : [employee.role || '-'];

  // 1. GAJI TETAP (Batas Maksimal Jam Kerja Normal = employee.standard_daily_hours || 9 Jam/Hari, Total Jam Kerja Aktual × Tarif Per Jam)
  const maxNormalHoursPerDay = Math.max(
    1,
    getEmployeeStandardDailyHours(
      employee,
      clampNonNegativeNumber(payroll.standardWorkHoursPerDay, STANDARD_WORK_HOURS_PER_DAY) ||
        STANDARD_WORK_HOURS_PER_DAY
    )
  );
  const stdWorkDaysDivisor = Math.max(
    1,
    clampNonNegativeNumber(payroll.standardWorkingDays, 25) || 25
  );
  const hourlyRate = Math.max(
    0,
    Math.round(
      clampNonNegativeNumber(payroll.hourlyRate, 0) ||
        getEmployeeHourlyRate(employee, maxNormalHoursPerDay, stdWorkDaysDivisor)
    )
  );
  const dailySalaryRate = Math.max(
    0,
    Math.round(
      hourlyRate * maxNormalHoursPerDay ||
        clampNonNegativeNumber(payroll.dailySalary, 0) ||
        getEmployeeDailySalary(employee, stdWorkDaysDivisor, maxNormalHoursPerDay)
    )
  );

  const rawBreakdownFromPayroll = Array.isArray(payroll.dailyWorkBreakdown)
    ? payroll.dailyWorkBreakdown
    : [];
  const rawBreakdown =
    rawBreakdownFromPayroll.length > 0
      ? rawBreakdownFromPayroll
      : isPartTime
      ? getLocalPartTimeBreakdownForEmployee(employee.id, maxNormalHoursPerDay, hourlyRate)
      : [];

  const dailyWorkBreakdown: DailyWorkWageItem[] = rawBreakdown
    .map((item) => {
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
      const cleanIn = String(item.checkIn || '').trim();
      const cleanOut = String(item.checkOut || '').trim();
      const cappedRes = calculateCappedDailyWorkHours(
        cleanIn,
        cleanOut,
        item.workHours,
        maxNormalHoursPerDay,
        0,
        item.date
      );
      const isMissingOut = Boolean(
        item.isMissingClockOut ||
          cappedRes.isMissingClockOut ||
          !cleanOut ||
          cleanOut === '-' ||
          cleanOut.toLowerCase().includes('belum') ||
          (cleanIn && cleanIn !== '-' && cleanIn === cleanOut)
      );
      const effectiveHours =
        cappedRes.cappedWorkHours > 0
          ? cappedRes.cappedWorkHours
          : isMissingOut
          ? 0
          : Math.min(maxNormalHoursPerDay, clampNonNegativeNumber(item.workHours, 0));
      return {
        ...item,
        checkIn: cleanIn || '-',
        checkOut: isMissingOut ? 'Belum Clock-Out' : cleanOut || '-',
        workHours: effectiveHours,
        rawDurationHours: cappedRes.rawDurationHours || effectiveHours,
        isCappedToMax: cappedRes.isCappedToMax,
        isMissingClockOut: isMissingOut,
        dailyWage: Math.round(effectiveHours * hourlyRate),
      };
    })
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const missingClockOutDaysCount = dailyWorkBreakdown.filter((d) => d.isMissingClockOut).length;

  // Penentuan rentang periode: Bulanan (Cut-Off 26-25) vs Part-Time Mingguan (Senin-Sabtu)
  let weeklyCycle = getWeeklyCycleRangeForDate(getJakartaDateString());
  const explicitWeekMatch = periodStr.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:s\/d|to|__|–|-)\s*(\d{4}-\d{2}-\d{2})/i
  );
  if (explicitWeekMatch) {
    weeklyCycle = getWeeklyCycleRangeForDate(explicitWeekMatch[1]);
  } else if (dailyWorkBreakdown.length > 0) {
    const validDates = dailyWorkBreakdown
      .map((d) => (d.date || '').slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (validDates.length > 0) {
      weeklyCycle = getWeeklyCycleRangeForDate(validDates[validDates.length - 1]);
    }
  }

  const weeklyStartFormatted = formatIndoDate(weeklyCycle.startDate);
  const weeklyEndFormatted = formatIndoDate(weeklyCycle.endDate);
  const weeklyRangeShort = `Senin, ${weeklyStartFormatted} – Sabtu, ${weeklyEndFormatted}`;
  const weeklyPeriodLabel = `Periode Mingguan: ${weeklyRangeShort}`;

  const periodCutOffLabel = isPartTime
    ? weeklyRangeShort
    : formatCutOffPeriodRange(
        periodStr,
        companyConfig.cutOffStartDay || 26,
        companyConfig.cutOffEndDay || 25
      );

  const resolvedCity = signatories?.city?.trim() || 'Tangerang';
  const printDateStr =
    isPartTime && !signatories?.customDateText?.trim()
      ? formatIndoDate(weeklyCycle.sundayPayoutDate)
      : formatEndOfPeriodPrintDate(periodStr, signatories?.customDateText);
  const printCityAndDate = `${resolvedCity}, ${printDateStr}`;

  const hasDailyBreakdown = dailyWorkBreakdown.length > 0;
  const presentDaysFromBreakdown = hasDailyBreakdown
    ? dailyWorkBreakdown.filter(
        (d) =>
          d.status !== 'Alpa' &&
          d.status !== 'Sakit' &&
          d.status !== 'Izin' &&
          d.status !== 'Cuti'
      ).length
    : undefined;

  const workDaysCount =
    Number(payroll.presentDaysCount) !== undefined && !isNaN(Number(payroll.presentDaysCount))
      ? Math.max(0, Math.round(Number(payroll.presentDaysCount)))
      : presentDaysFromBreakdown !== undefined
      ? presentDaysFromBreakdown
      : isPartTime
      ? 6
      : payroll.standardWorkingDays || 25;

  const totalActualWorkHours = hasDailyBreakdown
    ? Number(
        dailyWorkBreakdown
          .reduce((sum, item) => sum + (Number(item.workHours) || 0), 0)
          .toFixed(2)
      )
    : payroll.totalActualWorkHours !== undefined && !isNaN(Number(payroll.totalActualWorkHours))
    ? Number(
        Math.max(
          0,
          Math.min(workDaysCount * maxNormalHoursPerDay, Number(payroll.totalActualWorkHours))
        ).toFixed(2)
      )
    : Number((workDaysCount * maxNormalHoursPerDay).toFixed(2));

  // Gaji Pokok / Upah Kerja = Total Akumulasi Jam Kerja Aktual (sudah dibatasi maks jam normal/hari) × Tarif Per Jam
  const gajiPokokTotal = Math.round(totalActualWorkHours * hourlyRate);

  const tunjanganJabatanRate = Math.max(
    0,
    Math.round(Number(payroll.allowancePosition ?? employee.allowances?.position) || 0)
  );
  const tunjanganJabatanTotal = tunjanganJabatanRate;
  const subtotalGajiTetap = gajiPokokTotal + tunjanganJabatanTotal;

  // 2. GAJI TIDAK TETAP (Sinkronisasi dengan Tunjangan & Kedisiplinan / EmployeeAdjustment)
  const resolvedAdjustmentsList =
    Array.isArray(employeeAdjustments) && employeeAdjustments.length > 0
      ? employeeAdjustments
      : getSavedEmployeeAdjustments();
  const periodAdjustment = getEmployeeAdjustmentForPeriod(
    resolvedAdjustmentsList,
    employee,
    periodStr
  );

  const tunjanganKerajinanRate =
    periodAdjustment && periodAdjustment.tunjangan_kerajinan !== undefined
      ? Math.max(0, Math.round(Number(periodAdjustment.tunjangan_kerajinan) || 0))
      : payroll.tunjanganKerajinan !== undefined
      ? Math.max(0, Math.round(Number(payroll.tunjanganKerajinan) || 0))
      : Math.max(
          0,
          Math.round(
            (Number(payroll.allowanceTransport ?? employee.allowances?.transport) || 0) +
              (Number(payroll.allowanceCommunication ?? employee.allowances?.communication) || 0)
          )
        );
  const tunjanganKerajinanTotal = tunjanganKerajinanRate;

  const tunjanganKedisiplinanRate =
    periodAdjustment && periodAdjustment.tunjangan_kedisiplinan !== undefined
      ? Math.max(0, Math.round(Number(periodAdjustment.tunjangan_kedisiplinan) || 0))
      : payroll.tunjanganKedisiplinan !== undefined
      ? Math.max(0, Math.round(Number(payroll.tunjanganKedisiplinan) || 0))
      : Math.max(
          0,
          Math.round(Number(payroll.allowanceMeal ?? employee.allowances?.meal) || 0)
        );
  const tunjanganKedisiplinanTotal = tunjanganKedisiplinanRate;

  // Kelebihan jam kerja hanya dihitung jika ada Pengajuan Lembur yang berstatus "Disetujui" (Approved) pada rentang cut-off periode ini
  const empOtList = overtimeRequests
    ? overtimeRequests.filter((o) => o && o.employeeId === employee.id)
    : getLocalOvertimeRequestsForEmployee(employee.id);
  const approvedOtList = filterOvertimeRequestsForPeriod(
    empOtList,
    employee.id,
    periodStr,
    companyConfig.cutOffStartDay || 26,
    companyConfig.cutOffEndDay || 25,
    true
  );

  const approvedOtMinutesFromRequests = approvedOtList.reduce(
    (sum, o) => sum + getOvertimeMinutes(o),
    0
  );
  const otMultiplier = Number(companyConfig.defaultOvertimeMultiplier) || 1.5;

  const hasOvertimeRequestContext = overtimeRequests !== undefined || empOtList.length > 0;
  const overtimeMinutes =
    Math.max(0, Math.round(Number(payroll.overtimeMinutes) || 0)) > 0
      ? Math.max(0, Math.round(Number(payroll.overtimeMinutes) || 0))
      : hasOvertimeRequestContext
      ? approvedOtMinutesFromRequests
      : 0;
  const lemburJamTotal =
    Math.max(0, Math.round(Number(payroll.overtimePay) || 0)) > 0 &&
    overtimeMinutes === Math.max(0, Math.round(Number(payroll.overtimeMinutes) || 0))
      ? Math.max(0, Math.round(Number(payroll.overtimePay) || 0))
      : calculateOvertimePayByMinutes(employee, overtimeMinutes, otMultiplier);

  const baseOtRatePerMin =
    clampNonNegativeNumber(payroll.overtimeRatePerMinute, 0) ||
    getOvertimeRatePerMinute(employee, otMultiplier);
  const rawOvertimeHourlyRate =
    overtimeMinutes > 0 && lemburJamTotal > 0
      ? Math.round(lemburJamTotal / (overtimeMinutes / 60))
      : Math.round(baseOtRatePerMin * 60);
  const overtimeHourlyRate = Number.isFinite(rawOvertimeHourlyRate)
    ? Math.max(0, rawOvertimeHourlyRate)
    : 0;
  const rawOvertimeHoursQty =
    overtimeMinutes > 0
      ? Number((overtimeMinutes / 60).toFixed(1))
      : lemburJamTotal > 0 && overtimeHourlyRate > 0
      ? Number((lemburJamTotal / overtimeHourlyRate).toFixed(1))
      : 0;
  const overtimeHoursQty = Number.isFinite(rawOvertimeHoursQty)
    ? Math.max(0, rawOvertimeHoursQty)
    : 0;

  const overtimeDailyRate = dailySalaryRate;
  const overtimeDaysQty = 0;
  const lemburHariTotal = 0;

  // Tambahan Lainnya (Manajemen Bonus + Bonus KPI jika ada, tanpa penghitungan ganda)
  const bonusSummary = getEmployeeBonusesForPeriod(employeeBonuses, employee, periodStr);
  const bonusItems: Array<{
    id: string;
    amount: number;
    qty: number;
    reason_note: string;
  }> = bonusSummary.bonuses
    .filter((b) => Boolean(b && Number(b.amount) > 0))
    .map((b) => ({
      id: b.id,
      amount: Math.max(0, Math.round(Number(b.amount) || 0)),
      qty: 1,
      reason_note: (b.reason_note || 'Bonus & Apresiasi Kinerja').trim(),
    }));

  const bonusFromListTotal = bonusItems.reduce((sum, item) => sum + item.amount, 0);
  const kpiBonusVal =
    payroll.kpiBonus !== undefined
      ? Math.max(0, Math.round(Number(payroll.kpiBonus) || 0))
      : Math.max(0, Math.round((Number(payroll.bonus) || 0) - bonusFromListTotal));
  if (kpiBonusVal > 0) {
    bonusItems.unshift({
      id: `kpi-bonus-${payroll.id}`,
      amount: kpiBonusVal,
      qty: 1,
      reason_note: 'Bonus Insentif Kinerja / KPI',
    });
  }

  const totalTambahanLainnya = bonusItems.reduce((sum, item) => sum + item.amount, 0);

  // Komisi Penjualan Live Streaming (Akurat untuk % Omset, Bonus Per Pcs, maupun Kombinasi)
  const liveSalesSummary = calculateEmployeeLiveSalesCommission(employee, periodStr);
  const salesCommissionAmount = Math.max(
    0,
    Math.round(clampNonNegativeNumber(payroll.salesCommission, 0)),
    Math.round(clampNonNegativeNumber(liveSalesSummary.totalCommission, 0))
  );
  const liveCommissionPct = clampNonNegativeNumber(
    liveSalesSummary.commissionPercentage > 0
      ? liveSalesSummary.commissionPercentage
      : liveSalesSummary.coHostCommissionPercentage > 0
      ? liveSalesSummary.coHostCommissionPercentage
      : employee.salesCommissionPercentage || employee.coHostCommissionPercentage || 0,
    0
  );
  const liveCommissionPerPcs = Math.round(
    clampNonNegativeNumber(
      liveSalesSummary.commissionPerPcs > 0
        ? liveSalesSummary.commissionPerPcs
        : liveSalesSummary.coHostCommissionPerPcs > 0
        ? liveSalesSummary.coHostCommissionPerPcs
        : employee.salesCommissionPerPcs || employee.coHostCommissionPerPcs || 0,
      0
    )
  );
  const rawLiveOmset = Math.round(clampNonNegativeNumber(liveSalesSummary.totalOmset, 0));
  const liveOmsetAmount =
    rawLiveOmset > 0
      ? rawLiveOmset
      : salesCommissionAmount > 0 && liveCommissionPct > 0
      ? Math.round(salesCommissionAmount / (liveCommissionPct / 100))
      : 0;
  const liveCommissionPcsNote =
    liveSalesSummary.totalPcs > 0
      ? `${liveSalesSummary.totalPcs.toLocaleString('id-ID')} Pcs${
          liveCommissionPerPcs > 0 ? ` × ${formatRupiah(liveCommissionPerPcs)}/pcs` : ''
        }`
      : '';
  const liveCommissionFormulaLabel =
    liveCommissionPct > 0
      ? `× ${liveCommissionPct}%${liveCommissionPcsNote ? ` (${liveCommissionPcsNote})` : ''}`
      : liveCommissionPcsNote
      ? liveCommissionPcsNote
      : salesCommissionAmount > 0
      ? 'Komisi Penjualan Live'
      : '× 0%';

  // Tunjangan Hari Raya (THR): WAJIB CEKLIS ADMIN (show_in_payslip === true)
  // Jika show_in_payslip === false, thrAmount WAJIB 0 dan TIDAK BOLEH muncul atau dihitung di Slip Gaji!
  const resolvedThrList =
    Array.isArray(thrPayouts) && thrPayouts.length > 0 ? thrPayouts : getSavedThrPayouts();
  const activeThrRecord = getActiveEmployeeThrForPayslip(resolvedThrList, employee, periodStr);
  const thrShowInPayslip = Boolean(
    activeThrRecord
      ? activeThrRecord.show_in_payslip === true && Number(activeThrRecord.total_thr_amount) > 0
      : payroll.thrShowInPayslip === true && Number(payroll.thrAmount) > 0
  );
  const thrAmount = thrShowInPayslip
    ? Math.max(
        0,
        Math.round(Number(activeThrRecord?.total_thr_amount ?? payroll.thrAmount) || 0)
      )
    : 0;
  const thrBasisAmount = thrShowInPayslip
    ? Math.max(
        0,
        Math.round(Number(activeThrRecord?.calculation_basis_amount ?? payroll.thrBasisAmount ?? thrAmount) || 0)
      )
    : 0;
  const thrHolidayName = thrShowInPayslip
    ? activeThrRecord?.holiday_name || payroll.thrHolidayName || 'Hari Raya Keagamaan'
    : '';
  const thrTenureLabel = thrShowInPayslip
    ? activeThrRecord?.tenure_label || payroll.thrTenureLabel || '-'
    : '';
  const thrProportionFormula = thrShowInPayslip
    ? activeThrRecord?.proportion_formula || payroll.thrProportionFormula || '100% × Upah Dasar'
    : '';
  const thrPaymentStatus: 'Belum Cair' | 'Sudah Dibayar' =
    activeThrRecord?.payment_status === 'Sudah Dibayar' ||
    payroll.thrPaymentStatus === 'Sudah Dibayar'
      ? 'Sudah Dibayar'
      : 'Belum Cair';

  const subtotalGajiTidakTetap =
    tunjanganKerajinanTotal +
    tunjanganKedisiplinanTotal +
    lemburJamTotal +
    lemburHariTotal +
    totalTambahanLainnya +
    salesCommissionAmount +
    thrAmount;

  // 3. PENGURANGAN (Sinkronisasi Penuh dengan PayrollDeductionRecord & Panel Cuti/Izin)
  const resolvedDeductionsList =
    Array.isArray(payrollDeductions) && payrollDeductions.length > 0
      ? payrollDeductions
      : getSavedPayrollDeductions();
  const periodDeduction = getEmployeePayrollDeductionForPeriod(
    resolvedDeductionsList,
    employee,
    periodStr
  );

  // 3.1 Tanpa Keterangan (Alpa)
  const rawAlphaDaysFromPayroll = Math.max(0, Math.round(Number(payroll.alphaDaysCount) || 0));
  const rawAlphaPenaltyFromPayroll = Math.max(
    0,
    Math.round(Number(payroll.alphaPenaltyAmount) || 0)
  );
  const alphaDays = periodDeduction
    ? Math.max(0, Number(periodDeduction.tanpa_keterangan_hari) || 0)
    : payroll.tanpaKeteranganHari !== undefined
    ? Math.max(0, Number(payroll.tanpaKeteranganHari) || 0)
    : rawAlphaDaysFromPayroll;
  const alphaRate =
    periodDeduction && periodDeduction.tanpa_keterangan_rate > 0
      ? Math.max(0, Math.round(Number(periodDeduction.tanpa_keterangan_rate) || 0))
      : payroll.tanpaKeteranganRate && payroll.tanpaKeteranganRate > 0
      ? Math.max(0, Math.round(Number(payroll.tanpaKeteranganRate) || 0))
      : dailySalaryRate;
  const alphaDeductionTotal = periodDeduction
    ? Math.round(alphaDays * alphaRate)
    : payroll.isLateFeeWaived
    ? 0
    : rawAlphaPenaltyFromPayroll > 0
    ? rawAlphaPenaltyFromPayroll
    : alphaDays > 0
    ? Math.round(alphaDays * alphaRate)
    : 0;

  // 3.2 Izin (Jam / Menit)
  const defaultPerMinuteRate = Math.max(0, Math.round(hourlyRate / 60));
  const izinJamMinutes = periodDeduction
    ? Math.max(0, Math.round(Number(periodDeduction.izin_jam_menit) || 0))
    : payroll.izinJamMenit !== undefined
    ? Math.max(0, Math.round(Number(payroll.izinJamMenit) || 0))
    : 0;
  const izinJamRate =
    periodDeduction && periodDeduction.izin_jam_rate > 0
      ? Math.max(0, Math.round(Number(periodDeduction.izin_jam_rate) || 0))
      : payroll.izinJamRate && payroll.izinJamRate > 0
      ? Math.max(0, Math.round(Number(payroll.izinJamRate) || 0))
      : defaultPerMinuteRate;
  const izinJamDeduction = Math.round(izinJamMinutes * izinJamRate);

  // 3.3 Izin / Cuti Tanpa Gaji (Hari) & 3.4 Sakit (Otomatis dari Panel Cuti & Izin berstatus Disetujui)
  const empLeaves = leaveRequests
    ? leaveRequests.filter((l) => l.employeeId === employee.id && l.status === 'Disetujui')
    : getLocalLeavesForEmployee(employee.id);
  const unpaidSummary = getApprovedUnpaidLeaveSummaryForPeriod(
    empLeaves,
    employee,
    periodStr,
    dailySalaryRate
  );

  const manualIzinHari = periodDeduction
    ? Math.max(0, Number(periodDeduction.izin_hari_jumlah) || 0)
    : payroll.izinHariJumlah !== undefined
    ? Math.max(0, Number(payroll.izinHariJumlah) || 0)
    : 0;
  const izinHariDays = Math.max(manualIzinHari, unpaidSummary.unpaidDays);
  const izinHariRate =
    periodDeduction && periodDeduction.izin_hari_rate > 0
      ? Math.max(0, Math.round(Number(periodDeduction.izin_hari_rate) || 0))
      : payroll.izinHariRate && payroll.izinHariRate > 0
      ? Math.max(0, Math.round(Number(payroll.izinHariRate) || 0))
      : dailySalaryRate;
  const izinHariDeduction =
    izinHariDays > 0 ? Math.round(izinHariDays * izinHariRate) : 0;

  const sickSummary = getApprovedSickLeaveSummaryForPeriod(
    empLeaves,
    employee,
    periodStr,
    dailySalaryRate
  );
  const sakitDays = sickSummary.sickDays;
  const sakitRate = sickSummary.sickRatePerDay > 0 ? sickSummary.sickRatePerDay : dailySalaryRate;
  const sakitDeduction = sickSummary.sickDeductionTotal;

  // 3.5 Keterlambatan (Sinkron 100% dari calculatePayroll)
  const totalLateMinutes = Math.max(0, Math.round(Number(payroll.totalLateMinutes) || 0));
  const lateDeductionTotal = payroll.isLateFeeWaived
    ? 0
    : Math.max(
        0,
        Math.round(Number(payroll.latePenaltyAmount ?? payroll.lateDeduction) || 0)
      );
  const lateRatePerMinute =
    totalLateMinutes > 0 && lateDeductionTotal > 0
      ? Math.round(lateDeductionTotal / totalLateMinutes)
      : Number(companyConfig.attendancePenaltyPolicy?.flatLatePenaltyAmount) || 1000;

  // 3.6 Kesalahan (Sinkron dari panel Tunjangan & Kedisiplinan)
  const kesalahanQty = periodAdjustment
    ? Math.max(0, Math.round(Number(periodAdjustment.kesalahan_count) || 0))
    : payroll.kesalahanCount !== undefined
    ? Math.max(0, Math.round(Number(payroll.kesalahanCount) || 0))
    : 0;
  const kesalahanRate = periodAdjustment
    ? periodAdjustment.kesalahan_rate !== undefined && !isNaN(Number(periodAdjustment.kesalahan_rate))
      ? Math.max(0, Math.round(Number(periodAdjustment.kesalahan_rate)))
      : 10000
    : payroll.kesalahanRate !== undefined
    ? Math.max(0, Math.round(Number(payroll.kesalahanRate) || 0))
    : 10000;
  const kesalahanTotal = Math.round(kesalahanQty * kesalahanRate);
  const catatanKesalahan = (
    periodAdjustment?.catatan_kesalahan ??
    payroll.catatanKesalahan ??
    ''
  ).trim();
  const catatanPotongan = (
    periodDeduction?.catatan_potongan ??
    payroll.catatanPotongan ??
    ''
  ).trim();

  // 3.7 - 3.9 Rincian Kasbon 3 Tahap (Sinkron dari Panel Potongan Absensi & Kasbon + Modul Kasbon)
  const empCashAdvances = cashAdvances
    ? cashAdvances.filter(
        (c) =>
          c.employeeId === employee.id &&
          (c.status === 'disbursed' || c.status === 'approved' || c.status === 'paid')
      )
    : getLocalCashAdvancesForEmployee(employee.id);

  const activeCaRemaining = empCashAdvances
    .filter((c) => c.status === 'disbursed' || c.status === 'approved')
    .reduce((sum, c) => sum + Math.max(0, Math.round(Number(c.remainingBalance) || 0)), 0);
  const activeCaMonthlyInstallment = empCashAdvances
    .filter((c) => c.status === 'disbursed' || c.status === 'approved')
    .reduce((sum, c) => sum + Math.max(0, Math.round(Number(c.monthlyInstallment) || 0)), 0);

  let sisaKasbonBulanLalu = 0;
  let pembayaranKasbonBulanIni = 0;
  let sisaKasbonBulanDepan = 0;

  if (periodDeduction) {
    sisaKasbonBulanLalu = Math.max(0, Math.round(Number(periodDeduction.sisa_kasbon_lalu) || 0));
    const rawCicilan = Math.max(
      0,
      Math.round(Number(periodDeduction.cicilan_kasbon_bulan_ini) || 0)
    );
    pembayaranKasbonBulanIni =
      sisaKasbonBulanLalu > 0 ? Math.min(sisaKasbonBulanLalu, rawCicilan) : rawCicilan;
    sisaKasbonBulanDepan = Math.max(0, sisaKasbonBulanLalu - pembayaranKasbonBulanIni);
  } else if (payroll.sisaKasbonLalu !== undefined || payroll.cicilanKasbonBulanIni !== undefined) {
    sisaKasbonBulanLalu = Math.max(0, Math.round(Number(payroll.sisaKasbonLalu) || 0));
    const rawCicilan = Math.max(0, Math.round(Number(payroll.cicilanKasbonBulanIni) || 0));
    pembayaranKasbonBulanIni =
      sisaKasbonBulanLalu > 0 ? Math.min(sisaKasbonBulanLalu, rawCicilan) : rawCicilan;
    sisaKasbonBulanDepan = Math.max(0, sisaKasbonBulanLalu - pembayaranKasbonBulanIni);
  } else {
    pembayaranKasbonBulanIni = Math.max(
      0,
      Math.round(Number(payroll.cashAdvanceDeduction) || activeCaMonthlyInstallment || 0)
    );
    sisaKasbonBulanLalu =
      activeCaRemaining > 0
        ? activeCaRemaining >= pembayaranKasbonBulanIni
          ? activeCaRemaining
          : activeCaRemaining + pembayaranKasbonBulanIni
        : pembayaranKasbonBulanIni;
    sisaKasbonBulanDepan = Math.max(0, sisaKasbonBulanLalu - pembayaranKasbonBulanIni);
  }

  // BPJS & PPh 21 (Input Manual per Karyawan dari Panel "Potongan Absensi & Kasbon", Default Rp 0)
  const bpjsBaseSalary =
    subtotalGajiTetap > 0 ? subtotalGajiTetap : Math.round(Number(employee.baseSalary) || 0);
  const bpjsTkEmployeeTotal = periodDeduction
    ? Math.max(0, Math.round(Number(periodDeduction.bpjs_tk_manual) || 0))
    : Math.max(0, Math.round(Number(payroll.bpjs_tk_manual) || 0));
  const bpjsTkPct = 0;
  const bpjsKesEmployeeTotal = periodDeduction
    ? Math.max(0, Math.round(Number(periodDeduction.bpjs_kesehatan_manual) || 0))
    : Math.max(0, Math.round(Number(payroll.bpjs_kesehatan_manual) || 0));
  const bpjsKesPct = 0;
  const pph21Total = periodDeduction
    ? Math.max(0, Math.round(Number(periodDeduction.pph21_manual) || 0))
    : Math.max(0, Math.round(Number(payroll.pph21_manual) || 0));

  // Subtotal Pengurangan (Sisa Kasbon bulan lalu & bulan depan TIDAK dijumlahkan)
  const subtotalPengurangan =
    alphaDeductionTotal +
    izinJamDeduction +
    izinHariDeduction +
    sakitDeduction +
    lateDeductionTotal +
    kesalahanTotal +
    pembayaranKasbonBulanIni +
    bpjsTkEmployeeTotal +
    bpjsKesEmployeeTotal +
    pph21Total;

  // 4. JUMLAH BERSIH & PROTEKSI TAKE HOME PAY NON-NEGATIF (Minimal Rp 0)
  const totalGrossIncome = Math.max(0, subtotalGajiTetap + subtotalGajiTidakTetap);
  const coveredDeductionAmount = Math.min(totalGrossIncome, Math.max(0, subtotalPengurangan));
  const uncoveredDeductionDeficit = Math.max(0, subtotalPengurangan - totalGrossIncome);
  const hasUncoveredDeductionDeficit = uncoveredDeductionDeficit > 0;
  const jumlahBersih = Math.max(0, totalGrossIncome - subtotalPengurangan);
  const terbilangText = terbilangRupiah(jumlahBersih);

  return {
    effectiveEmployee: employee,
    isPartTime,
    weeklyPeriodLabel,
    weeklyStartDate: weeklyCycle.startDate,
    weeklyEndDate: weeklyCycle.endDate,
    sundayPayoutDate: weeklyCycle.sundayPayoutDate,
    periodCutOffLabel,
    printCityAndDate,
    workDaysCount,
    totalActualWorkHours,
    maxNormalHoursPerDay,
    hourlyRate,
    dailyWorkBreakdown,
    missingClockOutDaysCount,
    positionLines,
    dailySalaryRate,
    gajiPokokTotal,
    tunjanganJabatanRate,
    tunjanganJabatanTotal,
    subtotalGajiTetap,
    tunjanganKerajinanRate,
    tunjanganKerajinanTotal,
    tunjanganKedisiplinanRate,
    tunjanganKedisiplinanTotal,
    overtimeHourlyRate,
    overtimeHoursQty,
    lemburJamTotal,
    overtimeDailyRate,
    overtimeDaysQty,
    lemburHariTotal,
    bonusItems,
    totalTambahanLainnya,
    liveOmsetAmount,
    liveCommissionPct,
    liveCommissionPerPcs,
    liveCommissionPcsNote,
    liveCommissionFormulaLabel,
    salesCommissionAmount,
    thrShowInPayslip,
    thrAmount,
    thrBasisAmount,
    thrHolidayName,
    thrTenureLabel,
    thrProportionFormula,
    thrPaymentStatus,
    subtotalGajiTidakTetap,
    alphaDays,
    alphaRate,
    alphaDeductionTotal,
    izinJamMinutes,
    izinJamRate,
    izinJamDeduction,
    izinHariDays,
    izinHariRate,
    izinHariDeduction,
    sakitDays,
    sakitRate,
    sakitDeduction,
    lateRatePerMinute,
    totalLateMinutes,
    lateDeductionTotal,
    kesalahanRate,
    kesalahanQty,
    kesalahanTotal,
    catatanKesalahan,
    catatanPotongan,
    sisaKasbonBulanLalu,
    pembayaranKasbonBulanIni,
    sisaKasbonBulanDepan,
    bpjsBaseSalary,
    bpjsTkPct,
    bpjsTkEmployeeTotal,
    bpjsKesPct,
    bpjsKesEmployeeTotal,
    pph21Total,
    subtotalPengurangan,
    totalGrossIncome,
    coveredDeductionAmount,
    uncoveredDeductionDeficit,
    hasUncoveredDeductionDeficit,
    jumlahBersih,
    terbilangText,
  };
}

interface OfficialPayslipDocumentProps {
  data: OfficialPayslipComputedData;
  companyConfig: CompanyConfig;
  signatories: PayrollSignatoriesConfig;
  onEditSignatories?: () => void;
}

export const OfficialPayslipDocument: React.FC<OfficialPayslipDocumentProps> = ({
  data,
  companyConfig,
  signatories,
  onEditSignatories,
}) => {
  const { effectiveEmployee, isPartTime } = data;
  const accountingSignatoryName =
    signatories.preparedBy?.name && signatories.preparedBy.name.trim()
      ? signatories.preparedBy.name.trim()
      : 'Siti Rahma Ramadany, S.KM';
  const preparedStamp = useMemo(
    () =>
      signatories.preparedBy?.stampDataUrl ||
      signatories.companyStampDataUrl ||
      generateOfficialCompanyStampDataUrl(
        companyConfig.companyName || 'PT LUPYTA MAJU PERKASA'
      ),
    [
      signatories.preparedBy?.stampDataUrl,
      signatories.companyStampDataUrl,
      companyConfig.companyName,
    ]
  );
  const preparedSignature = useMemo(
    () =>
      signatories.preparedBy?.signatureDataUrl ||
      generateStylizedSignatureDataUrl(accountingSignatoryName, '#0f172a'),
    [signatories.preparedBy?.signatureDataUrl, accountingSignatoryName]
  );

  // Filter daftar rincian kerja harian khusus minggu aktif jika Part-Time memiliki data lintas minggu
  const weeklyBreakdownItems = useMemo(() => {
    if (!data.dailyWorkBreakdown || data.dailyWorkBreakdown.length === 0) return [];
    if (isPartTime && data.weeklyStartDate && data.weeklyEndDate) {
      const inWeek = data.dailyWorkBreakdown.filter(
        (d) => d.date >= data.weeklyStartDate! && d.date <= data.weeklyEndDate!
      );
      if (inWeek.length > 0) return inWeek;
    }
    return data.dailyWorkBreakdown.slice(-6);
  }, [data.dailyWorkBreakdown, isPartTime, data.weeklyStartDate, data.weeklyEndDate]);

  return (
    <div className="bg-white text-slate-900 border border-slate-300 rounded-xl p-5 sm:p-8 print:p-3 print:border-slate-400 print:rounded-none print:shadow-none font-sans text-xs leading-relaxed">
      {/* 1. KOP SURAT RESMI PT LUPYTA MAJU PERKASA & JUDUL SLIP GAJI */}
      <div className="w-full border-b-2 border-slate-900 pb-2.5 mb-3 print:pb-2 print:mb-2.5">
        <div className="w-full overflow-hidden rounded-xs">
          <img
            src="/assets/aistudio/image_2a293321.png"
            alt="Kop Surat Resmi PT Lupyta Maju Perkasa"
            className="w-full h-auto object-contain block scale-[1.012] origin-center"
          />
        </div>
      </div>

      {/* HEADER JUDUL: KHUSUS PART-TIME (MINGGUAN) VS REGULER BULANAN */}
      {isPartTime ? (
        <div className="text-center pb-3 mb-4 print:pb-2.5 print:mb-3 border-b-2 border-orange-300 bg-gradient-to-r from-orange-50/80 via-amber-50/90 to-orange-50/80 rounded-lg py-2.5 px-3 print:bg-amber-50/60">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-600 text-white print:bg-orange-100 print:text-orange-950 print:border-2 print:border-orange-600 text-[11px] sm:text-xs font-black tracking-[0.14em] uppercase shadow-2xs">
            <span>SLIP GAJI PART-TIME (MINGGUAN)</span>
          </div>
          <p className="text-xs sm:text-sm font-extrabold text-orange-950 mt-1.5">
            {data.weeklyPeriodLabel}
          </p>
          <p className="text-[10px] font-semibold text-orange-800 mt-0.5">
            Siklus Kerja Mingguan (Senin s/d Sabtu) • Jadwal Pencairan Setiap Hari Minggu
            {data.sundayPayoutDate ? ` (${formatIndoDate(data.sundayPayoutDate)})` : ''}
          </p>
        </div>
      ) : (
        <div className="text-center pb-3 mb-4 print:pb-2 print:mb-3 border-b border-slate-300">
          <h1 className="text-lg sm:text-xl print:text-lg font-black tracking-[0.25em] uppercase text-slate-950">
            SLIP GAJI
          </h1>
        </div>
      )}

      {/* INFORMASI KARYAWAN (LAYOUT 2 KOLOM) */}
      <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-8 gap-y-2 pb-4 mb-4 border-b border-slate-300 text-xs">
        {/* Kolom Kiri */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">ID Karyawan</span>
            <span className="text-slate-600">:</span>
            <span className="font-mono font-bold text-slate-950">
              {effectiveEmployee.nik || effectiveEmployee.id || '-'}
            </span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Nama Karyawan</span>
            <span className="text-slate-600">:</span>
            <span className="font-bold text-slate-950">{effectiveEmployee.fullName || '-'}</span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Status Karyawan</span>
            <span className="text-slate-600">:</span>
            {isPartTime ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300 font-extrabold text-[11px] w-fit">
                Part-Time (Mingguan)
              </span>
            ) : (
              <span className="font-semibold text-slate-900">
                {effectiveEmployee.employmentStatus || effectiveEmployee.status || '-'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Divisi</span>
            <span className="text-slate-600">:</span>
            <span className="font-semibold text-slate-900">
              {effectiveEmployee.department || '-'}
            </span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Posisi / Jabatan</span>
            <span className="text-slate-600">:</span>
            <div className="font-semibold text-slate-900 space-y-0.5">
              {data.positionLines.map((line, idx) => (
                <div key={idx} className="leading-snug">
                  - {line}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">
              {isPartTime ? 'Periode Mingguan' : 'Periode'}
            </span>
            <span className="text-slate-600">:</span>
            <span className={`font-bold ${isPartTime ? 'text-orange-900' : 'text-slate-950'}`}>
              {data.periodCutOffLabel}
            </span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">
              {isPartTime ? 'Total Jam & Hari Kerja' : 'Jumlah Hari Kerja'}
            </span>
            <span className="text-slate-600">:</span>
            <span className="font-bold text-slate-950">
              {isPartTime
                ? `${data.totalActualWorkHours} Jam (${data.workDaysCount} Hari Kerja)`
                : `${data.workDaysCount} Hari`}
            </span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">*Bank</span>
            <span className="text-slate-600">:</span>
            <span className="font-bold text-slate-950">{effectiveEmployee.bankName || '-'}</span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Nomor Rekening</span>
            <span className="text-slate-600">:</span>
            <span className="font-mono font-bold text-slate-950">
              {effectiveEmployee.bankAccountNumber || '-'}
            </span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Nama Penerima</span>
            <span className="text-slate-600">:</span>
            <span className="font-bold text-slate-950">
              {effectiveEmployee.bankAccountHolder || effectiveEmployee.fullName || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TABEL RINCIAN PENDAPATAN & 3. PENGURANGAN */}
      {isPartTime ? (
        /* ==================================================================== */
        /* FORMAT KHUSUS KARYAWAN PART-TIME (MINGGUAN) — BERBASIS JAM/HARI KERJA */
        /* ==================================================================== */
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-orange-900 print:bg-slate-800 text-white font-bold uppercase tracking-wider">
                  <th className="py-2 px-3 text-left border border-slate-300 w-[36%]">
                    Komponen Upah &amp; Rincian Mingguan
                  </th>
                  <th className="py-2 px-3 text-right border border-slate-300 w-[20%]">
                    Tarif / Dasar (Rp)
                  </th>
                  <th className="py-2 px-3 text-left border border-slate-300 w-[24%]">
                    Jam / Hari Kerja
                  </th>
                  <th className="py-2 px-3 text-right border border-slate-300 w-[20%]">
                    Total (Rp)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* BAGIAN 1 — PENDAPATAN KERJA MINGGUAN (BERBASIS JAM/HARI KERJA) */}
                <tr className="bg-orange-50/90 font-extrabold text-orange-950">
                  <td colSpan={4} className="py-1.5 px-3 border border-slate-300 uppercase tracking-wider">
                    1. RINCIAN PENDAPATAN KERJA MINGGUAN (JAM / HARI KERJA)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">
                    <div>
                      Upah Kerja ({data.totalActualWorkHours} Jam × {formatRupiah(data.hourlyRate)})
                    </div>
                    <div className="text-[10px] font-normal text-slate-600 mt-0.5">
                      {data.workDaysCount} Hari Kerja Aktif • Shift Normal Maks. {data.maxNormalHoursPerDay} Jam/Hari ({formatAccountingRupiah(data.dailySalaryRate)}/hari)
                    </div>
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono">
                    <div className="font-bold text-slate-900">
                      {formatAccountingRupiah(data.hourlyRate)} / jam
                    </div>
                    <div className="text-[10px] text-slate-500">
                      ({formatAccountingRupiah(data.dailySalaryRate)} / hari)
                    </div>
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-slate-800">
                    <div className="font-bold text-orange-900">
                      {data.totalActualWorkHours} Jam Kerja
                    </div>
                    <div className="text-[10px] text-slate-600">
                      ({data.workDaysCount} Hari Kerja)
                    </div>
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono font-bold text-slate-950">
                    {formatAccountingRupiah(data.gajiPokokTotal)}
                  </td>
                </tr>

                {/* Rincian Jam Masuk/Kerja Per Hari dalam Periode Minggu Tersebut (Ringkas) */}
                {weeklyBreakdownItems.length > 0 && (
                  <tr className="bg-amber-50/30 print:bg-white">
                    <td colSpan={4} className="py-2 px-3 border border-slate-300">
                      <div className="flex items-center justify-between flex-wrap gap-1 mb-1.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-900">
                          Rincian Jam Masuk &amp; Jam Kerja Per Hari ({data.periodCutOffLabel}):
                        </div>
                        {data.missingClockOutDaysCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[9px] font-extrabold">
                            ⚠️ {data.missingClockOutDaysCount} Hari Belum Clock-Out
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-1.5">
                        {weeklyBreakdownItems.map((dayItem, idx) => {
                          const isMissingOut = Boolean(
                            dayItem.isMissingClockOut ||
                              !dayItem.checkOut ||
                              dayItem.checkOut === '-' ||
                              String(dayItem.checkOut).toLowerCase().includes('belum') ||
                              (dayItem.checkIn &&
                                dayItem.checkIn !== '-' &&
                                dayItem.checkIn === dayItem.checkOut)
                          );
                          return (
                            <div
                              key={`${dayItem.date}-${idx}`}
                              className={`p-1.5 rounded border flex items-center justify-between gap-2 text-[10px] ${
                                isMissingOut
                                  ? 'border-rose-300 bg-rose-50/60 print:bg-white'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 truncate">
                                  {formatIndoDate(dayItem.date)}
                                </div>
                                <div className="text-slate-500 font-mono">
                                  {dayItem.checkIn || '-'} –{' '}
                                  {isMissingOut ? (
                                    <span className="text-rose-700 font-bold">Belum Clock-Out</span>
                                  ) : (
                                    `${dayItem.checkOut || '-'} WIB`
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-extrabold text-orange-800 font-mono">
                                  {dayItem.workHours} Jam
                                </div>
                                {isMissingOut ? (
                                  <div className="text-[9px] font-bold text-rose-700">
                                    ⚠️ Belum Clock-Out
                                  </div>
                                ) : (
                                  <div className="text-slate-600 font-mono">
                                    {formatRupiah(dayItem.dailyWage)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Tunjangan Jabatan Tetap HANYA ditampilkan jika nilainya > 0 */}
                {data.tunjanganJabatanTotal > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Tunjangan Jabatan
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.tunjanganJabatanRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      × 1 Periode
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                      {formatAccountingRupiah(data.tunjanganJabatanTotal)}
                    </td>
                  </tr>
                )}

                {/* Tunjangan Harian / Kerajinan (Hanya jika > 0) */}
                {data.tunjanganKerajinanTotal > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Tunjangan Harian / Kerajinan
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.tunjanganKerajinanRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      Tunjangan Aktif
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                      {formatAccountingRupiah(data.tunjanganKerajinanTotal)}
                    </td>
                  </tr>
                )}

                {/* Tunjangan Kedisiplinan / Makan Harian (Hanya jika > 0) */}
                {data.tunjanganKedisiplinanTotal > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Tunjangan Makan / Kedisiplinan
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.tunjanganKedisiplinanRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      Tunjangan Aktif
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                      {formatAccountingRupiah(data.tunjanganKedisiplinanTotal)}
                    </td>
                  </tr>
                )}

                {/* Upah Lembur (Ditampilkan jika > 0 atau sebagai informasi lembur mingguan) */}
                {(data.lemburJamTotal > 0 || data.overtimeHoursQty > 0) && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Upah Lembur ({data.overtimeHoursQty} Jam × {formatRupiah(data.overtimeHourlyRate)})
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.overtimeHourlyRate)} / jam
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700 font-semibold">
                      × {data.overtimeHoursQty} Jam Lembur
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-indigo-900">
                      {formatAccountingRupiah(data.lemburJamTotal)}
                    </td>
                  </tr>
                )}

                {/* Bonus / Tambahan Lainnya (Hanya jika > 0) */}
                {data.bonusItems.map((bItem, idx) => (
                  <tr key={bItem.id} className="bg-amber-50/40">
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      {idx === 0 ? 'Bonus & Insentif Mingguan' : '↳ Bonus Tambahan'}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(bItem.amount)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-800">
                      <span className="font-semibold">× {bItem.qty}</span>{' '}
                      <span className="text-slate-600">({bItem.reason_note})</span>
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-emerald-800">
                      {formatAccountingRupiah(bItem.amount)}
                    </td>
                  </tr>
                ))}

                {/* Komisi Live Streaming (Hanya jika > 0) */}
                {data.salesCommissionAmount > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Komisi Live Streaming
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(
                        data.liveOmsetAmount > 0 ? data.liveOmsetAmount : data.salesCommissionAmount
                      )}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      {data.liveCommissionFormulaLabel}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-emerald-800">
                      {formatAccountingRupiah(data.salesCommissionAmount)}
                    </td>
                  </tr>
                )}

                {/* Tunjangan Hari Raya (THR) — HANYA MUNCUL JIKA CEKLIS ADMIN (show_in_payslip === true) */}
                {Boolean(data.thrShowInPayslip && data.thrAmount > 0) && (
                  <tr className="bg-emerald-50/70">
                    <td className="py-1.5 px-3 border border-slate-300 font-bold text-emerald-950">
                      <div>Tunjangan Hari Raya (THR)</div>
                      <div className="text-[10px] font-medium text-emerald-700">
                        {data.thrHolidayName} • Masa Kerja: {data.thrTenureLabel}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-800">
                      {formatAccountingRupiah(data.thrBasisAmount)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-800">
                      <div className="font-semibold text-emerald-900">{data.thrProportionFormula}</div>
                      <div className="text-[10px] text-slate-600">
                        Status: {data.thrPaymentStatus === 'Sudah Dibayar' ? 'Sudah Dibayar (Cair)' : 'Terjadwal Pencairan'}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-bold text-emerald-800">
                      {formatAccountingRupiah(data.thrAmount)}
                    </td>
                  </tr>
                )}

                <tr className="bg-orange-100/80 font-extrabold text-slate-950">
                  <td colSpan={3} className="py-2 px-3 border border-slate-300 text-right uppercase">
                    Subtotal Pendapatan Mingguan (Bruto)
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono text-orange-950">
                    {formatAccountingRupiah(data.totalGrossIncome)}
                  </td>
                </tr>

                {/* BAGIAN 2 — POTONGAN MINGGUAN (DISEDERHANAKAN UNTUK PART-TIME) */}
                <tr className="bg-rose-50/90 font-extrabold text-rose-950">
                  <td colSpan={4} className="py-1.5 px-3 border border-slate-300 uppercase tracking-wider">
                    2. POTONGAN (KASBON, KETERLAMBATAN &amp; ABSENSI)
                  </td>
                </tr>

                {/* Keterlambatan */}
                <tr>
                  <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                    Potongan Keterlambatan
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                    {formatAccountingRupiah(data.totalLateMinutes > 0 ? data.lateRatePerMinute : 0)}
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                    × {data.totalLateMinutes} Menit
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(data.lateDeductionTotal)}
                  </td>
                </tr>

                {/* Tanpa Keterangan / Alpha (Tampil jika ada potongan/hari alpha) */}
                {(data.alphaDays > 0 || data.alphaDeductionTotal > 0) && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Tanpa Keterangan (Alpha)
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.alphaRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      × {data.alphaDays} Hari
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.alphaDeductionTotal)}
                    </td>
                  </tr>
                )}

                {/* Izin Jam / Menit (Tampil jika > 0) */}
                {(data.izinJamMinutes > 0 || data.izinJamDeduction > 0) && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Potongan Izin (Jam / Menit)
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.izinJamRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      × {data.izinJamMinutes} Menit
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.izinJamDeduction)}
                    </td>
                  </tr>
                )}

                {/* Izin Hari / Unpaid (Tampil jika > 0) */}
                {(data.izinHariDays > 0 || data.izinHariDeduction > 0) && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Potongan Izin (Hari)
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.izinHariRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      × {data.izinHariDays} Hari
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.izinHariDeduction)}
                    </td>
                  </tr>
                )}

                {/* Sakit Tanpa Surat Dokter (Tampil jika > 0) */}
                {data.sakitDeduction > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Potongan Sakit
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.sakitRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      × {data.sakitDays} Hari
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.sakitDeduction)}
                    </td>
                  </tr>
                )}

                {/* Kesalahan / Penyesuaian (Tampil jika > 0) */}
                {(data.kesalahanQty > 0 || data.kesalahanTotal > 0) && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      Potongan Kesalahan / Penyesuaian
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.kesalahanRate)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      × {data.kesalahanQty} Kali
                      {Boolean(data.catatanKesalahan) && (
                        <span className="text-slate-600 italic"> ({data.catatanKesalahan})</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.kesalahanTotal)}
                    </td>
                  </tr>
                )}

                {/* Kasbon & Cicilan Kasbon */}
                {data.sisaKasbonBulanLalu > 0 && (
                  <tr className="bg-slate-50/80">
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-700">
                      Saldo Kasbon Sebelumnya
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-700">
                      {formatAccountingRupiah(data.sisaKasbonBulanLalu)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                      Sisa Kasbon periode lalu
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-400">
                      Rp -
                    </td>
                  </tr>
                )}
                <tr className="bg-amber-50/40">
                  <td className="py-1.5 px-3 border border-slate-300 font-semibold text-slate-800">
                    Potongan Cicilan Kasbon
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                    {formatAccountingRupiah(data.pembayaranKasbonBulanIni)}
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-slate-700 font-medium">
                    Potongan kasbon periode ini
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                    {formatAccountingRupiah(data.pembayaranKasbonBulanIni)}
                  </td>
                </tr>
                {data.sisaKasbonBulanDepan > 0 && (
                  <tr className="bg-slate-50/80">
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-700">
                      Sisa Kasbon Berikutnya
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-700">
                      {formatAccountingRupiah(data.sisaKasbonBulanDepan)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                      Sisa Kasbon periode depan
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-400">
                      Rp -
                    </td>
                  </tr>
                )}

                {/* BPJS & PPh 21 HANYA ditampilkan untuk Part-Time jika nilainya > 0 */}
                {data.bpjsTkEmployeeTotal > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      BPJS Ketenagakerjaan
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.bpjsTkEmployeeTotal)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      Potongan Manual
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.bpjsTkEmployeeTotal)}
                    </td>
                  </tr>
                )}
                {data.bpjsKesEmployeeTotal > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      BPJS Kesehatan
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.bpjsKesEmployeeTotal)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      Potongan Manual
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.bpjsKesEmployeeTotal)}
                    </td>
                  </tr>
                )}
                {data.pph21Total > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      PPh 21
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(data.pph21Total)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                      Potongan Manual
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                      {formatAccountingRupiah(data.pph21Total)}
                    </td>
                  </tr>
                )}

                <tr className="bg-rose-100/80 font-extrabold text-slate-950">
                  <td colSpan={3} className="py-2 px-3 border border-slate-300 text-right uppercase">
                    Subtotal Potongan Mingguan
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono text-rose-800">
                    {formatAccountingRupiah(data.subtotalPengurangan)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* FORMAT REGULER KARYAWAN FULL-TIME / KONTRAK (BULANAN)                */
        /* ==================================================================== */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-slate-800 text-white font-bold uppercase tracking-wider">
                <th className="py-2 px-3 text-left border border-slate-300 w-[34%]">
                  Komponen Slip Gaji
                </th>
                <th className="py-2 px-3 text-right border border-slate-300 w-[22%]">
                  Tarif / Dasar (Rp)
                </th>
                <th className="py-2 px-3 text-left border border-slate-300 w-[24%]">
                  Kuantitas / Keterangan
                </th>
                <th className="py-2 px-3 text-right border border-slate-300 w-[20%]">
                  Total (Rp)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* ============================================================== */}
              {/* BAGIAN 1 — GAJI TETAP                                          */}
              {/* ============================================================== */}
              <tr className="bg-emerald-50/90 font-extrabold text-emerald-950">
                <td colSpan={4} className="py-1.5 px-3 border border-slate-300 uppercase tracking-wider">
                  1. GAJI TETAP
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  <div>Gaji Pokok</div>
                  <div className="text-[10px] text-slate-500">
                    Jam kerja standar adalah {data.maxNormalHoursPerDay} jam/hari (Maks. {data.maxNormalHoursPerDay} Jam/Hari • {formatAccountingRupiah(data.dailySalaryRate)}/hari)
                  </div>
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  <div>{formatAccountingRupiah(data.hourlyRate)} / jam</div>
                  <div className="text-[10px] text-slate-500">
                    ({formatAccountingRupiah(data.dailySalaryRate)} / hari)
                  </div>
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  <div className="font-semibold text-slate-900">
                    × {data.totalActualWorkHours} Jam Aktual
                  </div>
                  <div className="text-[10px] text-slate-500">
                    ({data.workDaysCount} Hari Kerja • Maks. {data.maxNormalHoursPerDay} Jam/Hari)
                  </div>
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.gajiPokokTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Tunjangan Jabatan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.tunjanganJabatanRate)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × 1 Kali / Bulan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.tunjanganJabatanTotal)}
                </td>
              </tr>
              <tr className="bg-emerald-100/80 font-extrabold text-slate-950">
                <td colSpan={3} className="py-2 px-3 border border-slate-300 text-right uppercase">
                  Subtotal Gaji Tetap
                </td>
                <td className="py-2 px-3 border border-slate-300 text-right font-mono text-emerald-900">
                  {formatAccountingRupiah(data.subtotalGajiTetap)}
                </td>
              </tr>

              {/* ============================================================== */}
              {/* BAGIAN 2 — GAJI TIDAK TETAP                                    */}
              {/* ============================================================== */}
              <tr className="bg-teal-50/90 font-extrabold text-teal-950">
                <td colSpan={4} className="py-1.5 px-3 border border-slate-300 uppercase tracking-wider">
                  2. GAJI TIDAK TETAP
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Tunjangan Kerajinan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.tunjanganKerajinanRate)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × 1 Kali / Bulan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.tunjanganKerajinanTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Tunjangan Kedisiplinan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.tunjanganKedisiplinanRate)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × 1 Kali / Bulan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.tunjanganKedisiplinanTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Lembur (Jam)
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.lemburJamTotal > 0 ? data.overtimeHourlyRate : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.overtimeHoursQty} Jam
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.lemburJamTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Lembur (Hari)
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.lemburHariTotal > 0 ? data.overtimeDailyRate : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.overtimeDaysQty} Hari
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.lemburHariTotal)}
                </td>
              </tr>

              {/* Tambahan Lainnya (Terintegrasi dengan Manajemen Bonus) */}
              {data.bonusItems.length > 0 ? (
                data.bonusItems.map((bItem, idx) => (
                  <tr key={bItem.id} className="bg-amber-50/40">
                    <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                      {idx === 0 ? 'Tambahan Lainnya' : '↳ Tambahan Lainnya'}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                      {formatAccountingRupiah(bItem.amount)}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-slate-800">
                      <span className="font-semibold">× {bItem.qty}</span>{' '}
                      <span className="text-slate-600">({bItem.reason_note})</span>
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-emerald-800">
                      {formatAccountingRupiah(bItem.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                    Tambahan Lainnya
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                    Rp -
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-slate-500">
                    × 0 (-)
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                    Rp -
                  </td>
                </tr>
              )}

              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Komisi
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(
                    data.liveOmsetAmount > 0 ? data.liveOmsetAmount : data.salesCommissionAmount
                  )}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  {data.liveCommissionFormulaLabel}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                  {formatAccountingRupiah(data.salesCommissionAmount)}
                </td>
              </tr>

              {/* Tunjangan Hari Raya (THR) — HANYA MUNCUL JIKA CEKLIS ADMIN (show_in_payslip === true) */}
              {Boolean(data.thrShowInPayslip && data.thrAmount > 0) && (
                <tr className="bg-emerald-50/70">
                  <td className="py-1.5 px-3 border border-slate-300 font-bold text-emerald-950">
                    <div>Tunjangan Hari Raya (THR)</div>
                    <div className="text-[10px] font-medium text-emerald-700">
                      {data.thrHolidayName} • Masa Kerja: {data.thrTenureLabel}
                    </div>
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-800">
                    {formatAccountingRupiah(data.thrBasisAmount)}
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-slate-800">
                    <div className="font-semibold text-emerald-900">{data.thrProportionFormula}</div>
                    <div className="text-[10px] text-slate-600">
                      Status: {data.thrPaymentStatus === 'Sudah Dibayar' ? 'Sudah Dibayar (Cair)' : 'Terjadwal Pencairan'}
                    </div>
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-bold text-emerald-800">
                    {formatAccountingRupiah(data.thrAmount)}
                  </td>
                </tr>
              )}

              <tr className="bg-teal-100/80 font-extrabold text-slate-950">
                <td colSpan={3} className="py-2 px-3 border border-slate-300 text-right uppercase">
                  Subtotal Gaji Tidak Tetap
                </td>
                <td className="py-2 px-3 border border-slate-300 text-right font-mono text-teal-900">
                  {formatAccountingRupiah(data.subtotalGajiTidakTetap)}
                </td>
              </tr>

              {/* ============================================================== */}
              {/* BAGIAN 3 — PENGURANGAN                                         */}
              {/* ============================================================== */}
              <tr className="bg-rose-50/90 font-extrabold text-rose-950">
                <td colSpan={4} className="py-1.5 px-3 border border-slate-300 uppercase tracking-wider">
                  3. PENGURANGAN
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Tanpa Keterangan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.alphaDays > 0 ? data.alphaRate : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.alphaDays} Hari
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.alphaDeductionTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Izin (Jam)
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.izinJamMinutes > 0 ? data.izinJamRate : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.izinJamMinutes} Menit
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.izinJamDeduction)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Izin (Hari)
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(
                    data.izinHariDeduction > 0 || data.izinHariDays > 0 ? data.izinHariRate : 0
                  )}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.izinHariDays} Hari
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.izinHariDeduction)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Sakit
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.sakitDeduction > 0 ? data.sakitRate : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.sakitDays} Hari
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.sakitDeduction)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Keterlambatan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.totalLateMinutes > 0 ? data.lateRatePerMinute : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.totalLateMinutes} Menit
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.lateDeductionTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  Kesalahan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.kesalahanQty > 0 ? data.kesalahanRate : 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  × {data.kesalahanQty} Kesalahan / Bulan
                  {Boolean(data.catatanKesalahan) && (
                    <span className="text-slate-600 italic"> ({data.catatanKesalahan})</span>
                  )}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.kesalahanTotal)}
                </td>
              </tr>

              {/* Blok Rincian Kasbon */}
              <tr className="bg-slate-50/80">
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-700">
                  Kasbon
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-700">
                  {formatAccountingRupiah(data.sisaKasbonBulanLalu)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                  Sisa Kasbon bulan lalu
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-400">
                  Rp -
                </td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="py-1.5 px-3 border border-slate-300 font-semibold text-slate-800">
                  Pembayaran Kasbon
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.pembayaranKasbonBulanIni)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700 font-medium">
                  Cicilan bulan ini
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.pembayaranKasbonBulanIni)}
                </td>
              </tr>
              <tr className="bg-slate-50/80">
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-700">
                  Sisa Kasbon
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-700">
                  {formatAccountingRupiah(data.sisaKasbonBulanDepan)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                  Sisa Kasbon bulan depan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono text-slate-400">
                  Rp -
                </td>
              </tr>

              {/* Potongan Pajak & BPJS (Input Manual / Default Rp 0) */}
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  **BPJS Ketenagakerjaan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.bpjsTkEmployeeTotal)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  {data.bpjsTkEmployeeTotal > 0 ? 'Potongan Manual' : '-'}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.bpjsTkEmployeeTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  **BPJS Kesehatan
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.bpjsKesEmployeeTotal)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  {data.bpjsKesEmployeeTotal > 0 ? 'Potongan Manual' : '-'}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.bpjsKesEmployeeTotal)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 border border-slate-300 font-medium text-slate-800">
                  **PPh 21
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                  {formatAccountingRupiah(data.pph21Total)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                  {data.pph21Total > 0 ? 'Potongan Manual' : '-'}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-rose-700">
                  {formatAccountingRupiah(data.pph21Total)}
                </td>
              </tr>
              <tr className="bg-rose-100/80 font-extrabold text-slate-950">
                <td colSpan={3} className="py-2 px-3 border border-slate-300 text-right uppercase">
                  Subtotal Pengurangan
                </td>
                <td className="py-2 px-3 border border-slate-300 text-right font-mono text-rose-800">
                  {formatAccountingRupiah(data.subtotalPengurangan)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* CATATAN KHUSUS PROTEKSI TAKE HOME PAY NON-NEGATIF (JIKA TOTAL POTONGAN > TOTAL PENGHASILAN BRUTO) */}
      {data.hasUncoveredDeductionDeficit && (
        <div className="mt-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-lg text-xs text-amber-950 break-inside-avoid print:bg-white print:border-slate-700">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-amber-200">
            <div>
              <p className="font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                ⚠️ Catatan Rincian Potongan &amp; Proteksi Take Home Pay Non-Negatif
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Total beban potongan pada periode ini melebihi Total Penghasilan Bruto. Sesuai kebijakan proteksi gaji,{' '}
                <strong className="font-bold">Take Home Pay (Jumlah Bersih) ditetapkan minimal Rp 0 (tidak minus)</strong>.
                Selisih potongan yang belum tertutup dicatat secara transparan sebagai sisa kewajiban / evaluasi HR &amp; Finance:
              </p>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 font-black text-[10px] uppercase">
              Proteksi THP Minimal Rp 0
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 text-[11px]">
            <div className="p-2 rounded bg-white/90 border border-amber-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Penghasilan Bruto</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {formatRupiah(data.totalGrossIncome)}
              </p>
            </div>
            <div className="p-2 rounded bg-white/90 border border-amber-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Beban Potongan</p>
              <p className="font-mono font-bold text-rose-700 mt-0.5">
                {formatRupiah(data.subtotalPengurangan)}
              </p>
            </div>
            <div className="p-2 rounded bg-white/90 border border-amber-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Potongan Tertutup Gaji</p>
              <p className="font-mono font-bold text-emerald-700 mt-0.5">
                {formatRupiah(data.coveredDeductionAmount)}
              </p>
            </div>
            <div className="p-2 rounded bg-rose-50 border border-rose-300">
              <p className="text-[10px] font-bold text-rose-800 uppercase">
                Selisih Belum Tertutup
              </p>
              <p className="font-mono font-black text-rose-700 mt-0.5">
                {formatRupiah(data.uncoveredDeductionDeficit)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. RINGKASAN JUMLAH BERSIH & TERBILANG */}
      <div
        className={`mt-4 p-4 border-2 border-slate-900 rounded-lg print:bg-white ${
          isPartTime ? 'bg-orange-50/80' : 'bg-emerald-50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-sm sm:text-base font-black tracking-wider uppercase text-slate-950">
              {isPartTime
                ? 'JUMLAH BERSIH MINGGUAN (TAKE HOME PAY) :'
                : 'JUMLAH BERSIH (TAKE HOME PAY) :'}
            </span>
            {data.hasUncoveredDeductionDeficit && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Non-Negatif • Selisih Potongan Belum Tertutup: {formatRupiah(data.uncoveredDeductionDeficit)}
              </span>
            )}
          </div>
          <span
            className={`text-lg sm:text-2xl font-black font-mono print:text-black ${
              isPartTime ? 'text-orange-900' : 'text-emerald-800'
            }`}
          >
            {formatRupiah(data.jumlahBersih)}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            Terbilang :
          </span>
          <span className="text-xs sm:text-sm font-bold italic text-slate-900 font-serif">
            &ldquo;{data.terbilangText}&rdquo;
          </span>
        </div>
      </div>

      {/* CATATAN KAKI & BLOK TANDA TANGAN */}
      <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-6 items-end break-inside-avoid">
        {/* Catatan Kaki di Kiri Bawah */}
        <div className="md:col-span-5 print:col-span-5 space-y-1 text-[11px] text-slate-600 italic self-start">
          <p>*Pembayaran akan dilakukan pada nomor rekening tujuan tercantum</p>
          {isPartTime ? (
            <p>*Pencairan upah Part-Time dilakukan setiap akhir siklus mingguan (Hari Minggu)</p>
          ) : (
            <p>**Akan dilakukan pemotongan sesuai dengan aturan pemerintah (akan datang)</p>
          )}
        </div>

        {/* Blok Tanda Tangan di Kanan Bawah */}
        <div className="md:col-span-7 print:col-span-7">
          <div className="text-right font-semibold text-slate-800 mb-3 text-xs">
            {data.printCityAndDate}
          </div>
          <div className="grid grid-cols-2 gap-6 text-center text-xs">
            {/* Kolom Kiri: Karyawan */}
            <div className="flex flex-col justify-between min-h-[135px] print:min-h-[135px]">
              <span className="font-semibold text-slate-800">Karyawan,</span>
              <div className="h-24 print:h-24" />
              <div className="border-t border-slate-800 pt-1.5 mx-auto w-44 max-w-full">
                <p className="font-bold text-slate-950 truncate">
                  {effectiveEmployee.fullName}
                </p>
              </div>
            </div>

            {/* Kolom Kanan: Prepared by Accounting (Stempel Menumpuk di Atas Tanda Tangan) */}
            <div
              onClick={onEditSignatories}
              className={`flex flex-col justify-between min-h-[135px] print:min-h-[135px] rounded-lg p-1 ${
                onEditSignatories ? 'hover:bg-slate-50 cursor-pointer transition-colors' : ''
              }`}
              title={
                onEditSignatories
                  ? 'Klik untuk mengubah nama penandatangan Accounting/HR, tanda tangan & stempel'
                  : undefined
              }
            >
              <span className="font-semibold text-slate-800">Prepared by Accounting,</span>
              <div className="relative h-24 print:h-24 w-48 max-w-full mx-auto flex items-end justify-center my-0.5 select-none">
                {/* Layer 1 (Bawah): Tanda Tangan Basah / Digital */}
                {Boolean(preparedSignature) && (
                  <img
                    src={preparedSignature}
                    alt={accountingSignatoryName}
                    className="max-h-[72px] max-w-[165px] print:max-h-[72px] print:max-w-[165px] object-contain relative z-10 mb-1 pointer-events-none select-none"
                  />
                )}
                {/* Layer 2 (Atas): Stempel Resmi Menumpuk di Kiri-Tengah Tanda Tangan (-8deg, 104px, mix-blend-multiply) */}
                {Boolean(preparedStamp) && (
                  <img
                    src={preparedStamp}
                    alt="Stempel Resmi Perusahaan"
                    className="payslip-stamp-overlay absolute left-1/2 -translate-x-[68%] -bottom-1.5 w-[104px] h-[104px] print:w-[104px] print:h-[104px] object-contain opacity-[0.92] contrast-125 saturate-[1.2] mix-blend-multiply -rotate-[8deg] pointer-events-none select-none z-20 print:opacity-[0.92] print:contrast-125 print:saturate-[1.2] print:mix-blend-multiply print:-rotate-[8deg]"
                  />
                )}
              </div>
              <div className="border-t border-slate-800 pt-1.5 mx-auto w-48 max-w-full relative z-30">
                <p className="font-bold text-slate-950 truncate">
                  {accountingSignatoryName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PayslipModalProps {
  payroll: PayrollRecord | null;
  employee: Employee | null;
  companyConfig: CompanyConfig;
  employees?: Employee[];
  cashAdvances?: CashAdvance[];
  leaveRequests?: LeaveRequest[];
  overtimeRequests?: OvertimeRequest[];
  employeeBonuses?: EmployeeBonus[];
  employeeAdjustments?: EmployeeAdjustment[];
  payrollDeductions?: PayrollDeductionRecord[];
  thrPayouts?: ThrPayoutRecord[];
  onClose: () => void;
  onUpdateSignatories?: (config: PayrollSignatoriesConfig) => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  payroll,
  employee,
  companyConfig,
  employees = [],
  cashAdvances,
  leaveRequests,
  overtimeRequests,
  employeeBonuses: propEmployeeBonuses = [],
  employeeAdjustments: propEmployeeAdjustments = [],
  payrollDeductions: propPayrollDeductions = [],
  thrPayouts: propThrPayouts = [],
  onClose,
  onUpdateSignatories,
}) => {
  const [signatories, setSignatories] = useState<PayrollSignatoriesConfig>(() =>
    getPayrollSignatoriesConfig(companyConfig)
  );
  const [isSignatoryModalOpen, setIsSignatoryModalOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [cloudLiveSessions, setCloudLiveSessions] = useState<LiveStreamSalesRecord[]>([]);
  const [syncedEmployeeData, setSyncedEmployeeData] = useState<Partial<Employee> | null>(null);
  const [employeeBonuses, setEmployeeBonuses] = useState<EmployeeBonus[]>(() =>
    getSavedEmployeeBonuses()
  );
  const [employeeAdjustments, setEmployeeAdjustments] = useState<EmployeeAdjustment[]>(() =>
    getSavedEmployeeAdjustments()
  );
  const [payrollDeductions, setPayrollDeductions] = useState<PayrollDeductionRecord[]>(() =>
    getSavedPayrollDeductions()
  );
  const [thrPayouts, setThrPayouts] = useState<ThrPayoutRecord[]>(() =>
    getSavedThrPayouts()
  );

  useEffect(() => {
    setSignatories(getPayrollSignatoriesConfig(companyConfig));
  }, [companyConfig, payroll]);

  useEffect(() => {
    const handleSync = () => {
      setSignatories(getPayrollSignatoriesConfig(companyConfig));
    };
    window.addEventListener('tgi_signatories_updated', handleSync);
    return () => window.removeEventListener('tgi_signatories_updated', handleSync);
  }, [companyConfig]);

  useEffect(() => {
    if (!employee?.id) return;
    let isMounted = true;

    const loadLiveCommissionData = async () => {
      const [sessions, empFromDb, bonusesFromDb, adjustmentsFromDb, deductionsFromDb, thrFromDb] =
        await Promise.all([
          fetchLivestreamSessionsFromSupabase(employee.id, payroll?.period),
          fetchEmployeeByIdFromSupabase(employee.id),
          fetchEmployeeBonuses(),
          fetchEmployeeAdjustments(),
          fetchPayrollDeductions(),
          fetchThrPayoutsFromSupabase(),
        ]);
      if (!isMounted) return;
      if (Array.isArray(sessions) && sessions.length > 0) {
        setCloudLiveSessions(sessions);
      }
      if (empFromDb) {
        setSyncedEmployeeData(empFromDb);
      }
      if (Array.isArray(bonusesFromDb)) {
        setEmployeeBonuses(bonusesFromDb);
      }
      if (Array.isArray(adjustmentsFromDb)) {
        setEmployeeAdjustments(adjustmentsFromDb);
      }
      if (Array.isArray(deductionsFromDb)) {
        setPayrollDeductions(deductionsFromDb);
      }
      if (Array.isArray(thrFromDb)) {
        setThrPayouts(thrFromDb);
      }
    };

    loadLiveCommissionData();

    const handleLiveUpdated = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv?.detail?.id === employee.id) {
        setSyncedEmployeeData(customEv.detail);
      }
      loadLiveCommissionData();
    };

    const handleBonusesUpdated = () => {
      setEmployeeBonuses(getSavedEmployeeBonuses());
    };

    const handleAdjustmentsUpdated = () => {
      setEmployeeAdjustments(getSavedEmployeeAdjustments());
    };

    const handleDeductionsUpdated = () => {
      setPayrollDeductions(getSavedPayrollDeductions());
    };

    const handleThrUpdated = () => {
      setThrPayouts(getSavedThrPayouts());
    };

    window.addEventListener('tgi_employee_live_updated', handleLiveUpdated);
    window.addEventListener('tgi_livestream_sessions_updated', handleLiveUpdated);
    window.addEventListener('tgi_employee_bonuses_updated', handleBonusesUpdated);
    window.addEventListener('tgi_employee_adjustments_updated', handleAdjustmentsUpdated);
    window.addEventListener('tgi_payroll_deductions_updated', handleDeductionsUpdated);
    window.addEventListener('tgi_thr_payouts_updated', handleThrUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('tgi_employee_live_updated', handleLiveUpdated);
      window.removeEventListener('tgi_livestream_sessions_updated', handleLiveUpdated);
      window.removeEventListener('tgi_employee_bonuses_updated', handleBonusesUpdated);
      window.removeEventListener('tgi_employee_adjustments_updated', handleAdjustmentsUpdated);
      window.removeEventListener('tgi_payroll_deductions_updated', handleDeductionsUpdated);
      window.removeEventListener('tgi_thr_payouts_updated', handleThrUpdated);
    };
  }, [employee?.id, payroll?.period]);

  const effectiveEmployee = useMemo<Employee | null>(() => {
    if (!employee) return null;
    const map = new Map<string, LiveStreamSalesRecord>();
    const propLogs = Array.isArray(employee.liveStreamSalesLogs)
      ? employee.liveStreamSalesLogs
      : [];
    const dbEmpLogs = Array.isArray(syncedEmployeeData?.liveStreamSalesLogs)
      ? syncedEmployeeData!.liveStreamSalesLogs!
      : [];
    for (const s of [...cloudLiveSessions, ...dbEmpLogs, ...propLogs]) {
      if (s?.id) map.set(s.id, s);
    }
    return {
      ...employee,
      ...(syncedEmployeeData || {}),
      id: employee.id,
      isLiveStreamHost: Boolean(
        syncedEmployeeData?.is_host ??
          syncedEmployeeData?.isLiveStreamHost ??
          employee.is_host ??
          employee.isLiveStreamHost
      ),
      is_host: Boolean(
        syncedEmployeeData?.is_host ??
          syncedEmployeeData?.isLiveStreamHost ??
          employee.is_host ??
          employee.isLiveStreamHost
      ),
      isCoHostLiveStream: Boolean(
        syncedEmployeeData?.is_co_host ??
          syncedEmployeeData?.isCoHostLiveStream ??
          employee.is_co_host ??
          employee.isCoHostLiveStream
      ),
      is_co_host: Boolean(
        syncedEmployeeData?.is_co_host ??
          syncedEmployeeData?.isCoHostLiveStream ??
          employee.is_co_host ??
          employee.isCoHostLiveStream
      ),
      liveStreamSalesLogs: Array.from(map.values()),
    };
  }, [employee, syncedEmployeeData, cloudLiveSessions]);

  const combinedBonuses = useMemo(() => {
    const map = new Map<string, EmployeeBonus>();
    for (const b of [...employeeBonuses, ...propEmployeeBonuses]) {
      if (b?.id) map.set(b.id, b);
    }
    return Array.from(map.values());
  }, [employeeBonuses, propEmployeeBonuses]);

  const combinedAdjustments = useMemo(() => {
    const map = new Map<string, EmployeeAdjustment>();
    for (const a of [...employeeAdjustments, ...propEmployeeAdjustments]) {
      if (a?.id) map.set(a.id, a);
    }
    return Array.from(map.values());
  }, [employeeAdjustments, propEmployeeAdjustments]);

  const combinedDeductions = useMemo(() => {
    const map = new Map<string, PayrollDeductionRecord>();
    for (const d of [...payrollDeductions, ...propPayrollDeductions]) {
      if (d?.id) map.set(d.id, d);
    }
    return Array.from(map.values());
  }, [payrollDeductions, propPayrollDeductions]);

  const combinedThrPayouts = useMemo(() => {
    const map = new Map<string, ThrPayoutRecord>();
    for (const t of [...thrPayouts, ...propThrPayouts]) {
      if (t?.id) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [thrPayouts, propThrPayouts]);

  const computedData = useMemo(() => {
    if (!payroll || !effectiveEmployee) return null;
    return computeOfficialPayslipData({
      payroll,
      employee: effectiveEmployee,
      companyConfig,
      employeeBonuses: combinedBonuses,
      employeeAdjustments: combinedAdjustments,
      payrollDeductions: combinedDeductions,
      thrPayouts: combinedThrPayouts,
      cashAdvances,
      leaveRequests,
      overtimeRequests,
      signatories,
    });
  }, [
    payroll,
    effectiveEmployee,
    companyConfig,
    combinedBonuses,
    combinedAdjustments,
    combinedDeductions,
    combinedThrPayouts,
    cashAdvances,
    leaveRequests,
    overtimeRequests,
    signatories,
  ]);

  if (!payroll || !effectiveEmployee || !computedData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveSignatories = (newConfig: PayrollSignatoriesConfig) => {
    setSignatories(newConfig);
    savePayrollSignatoriesConfig(newConfig);
    onUpdateSignatories?.(newConfig);
    setSavedToast('Pengaturan penandatangan & tanda tangan slip gaji berhasil diperbarui!');
    setTimeout(() => setSavedToast(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:fixed">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Modal Action Bar (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm ${
                computedData.isPartTime ? 'bg-orange-600' : 'bg-emerald-600'
              }`}
            >
              TGI
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-800 text-sm">
                  {computedData.isPartTime
                    ? 'Slip Gaji Part-Time (Mingguan) — A4'
                    : 'Slip Gaji Karyawan (A4)'}
                </h3>
                {computedData.isPartTime && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-900 border border-orange-300">
                    SLIP GAJI PART-TIME (MINGGUAN)
                  </span>
                )}
                {(payroll.isLocked ||
                  (companyConfig.lockedPayrollPeriods || []).includes(payroll.period) ||
                  isPayrollPeriodPastCutoff(
                    payroll.period,
                    new Date(),
                    companyConfig.cutOffStartDay || 26,
                    companyConfig.cutOffEndDay || 25
                  )) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <Lock className="w-3 h-3 text-amber-700" />
                    Periode Terkunci (Arsip)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {computedData.isPartTime
                  ? `${computedData.weeklyPeriodLabel} • ${payroll.referenceNumber}`
                  : `${payroll.period} (${computedData.periodCutOffLabel}) • ${payroll.referenceNumber}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSignatoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
              title="Ubah nama penandatangan Accounting/HR, tanda tangan digital & stempel perusahaan"
            >
              <PenTool className="w-3.5 h-3.5 text-indigo-600" />
              <span>Atur Penandatangan &amp; TTD</span>
            </button>
            <a
              href={getPayslipWhatsAppUrl(effectiveEmployee, payroll, companyConfig)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-2xs"
              title={`Kirim Notifikasi WA Slip Gaji ke ${effectiveEmployee.fullName}`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim Notifikasi WA</span>
            </a>
            <a
              href={getPayslipEmailUrl(effectiveEmployee, payroll, companyConfig)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs"
              title={`Kirim Email Slip Gaji ke ${effectiveEmployee.fullName}`}
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Kirim Email</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
              title="Unduh dan simpan slip gaji format PDF ukuran A4"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh PDF (A4)</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak Fisik</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {Boolean(savedToast) && (
          <div className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{savedToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSavedToast(null)}
              className="text-emerald-100 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Printable A4 Payslip Container */}
        <div className="p-4 sm:p-8 overflow-y-auto print:overflow-visible print:p-0 bg-slate-100 print:bg-white">
          <div className="max-w-[210mm] mx-auto">
            <OfficialPayslipDocument
              data={computedData}
              companyConfig={companyConfig}
              signatories={signatories}
              onEditSignatories={() => setIsSignatoryModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Modal Pengaturan Penandatangan, TTD Digital & Stempel */}
      <SignatoryConfigModal
        isOpen={isSignatoryModalOpen}
        onClose={() => setIsSignatoryModalOpen(false)}
        companyConfig={companyConfig}
        employees={employees}
        initialConfig={signatories}
        onSaveConfig={handleSaveSignatories}
      />
    </div>
  );
};
