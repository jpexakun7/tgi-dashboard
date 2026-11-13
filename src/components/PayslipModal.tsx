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
} from '../services/supabaseService';

export interface OfficialPayslipComputedData {
  effectiveEmployee: Employee;
  periodCutOffLabel: string;
  printCityAndDate: string;
  workDaysCount: number;
  totalActualWorkHours: number;
  maxNormalHoursPerDay: number;
  hourlyRate: number;
  dailyWorkBreakdown: DailyWorkWageItem[];
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
  liveCommissionPcsNote: string;
  salesCommissionAmount: number;
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
  // 4. Jumlah Bersih
  jumlahBersih: number;
  terbilangText: string;
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
    cashAdvances,
    leaveRequests,
    overtimeRequests,
    signatories,
  } = params;

  const periodStr = payroll.period || companyConfig.currentPayrollPeriod || 'November 2026';
  const periodCutOffLabel = formatCutOffPeriodRange(
    periodStr,
    companyConfig.cutOffStartDay || 26,
    companyConfig.cutOffEndDay || 25
  );

  const resolvedCity = signatories?.city?.trim() || 'Tangerang';
  const printDateStr = formatEndOfPeriodPrintDate(periodStr, signatories?.customDateText);
  const printCityAndDate = `${resolvedCity}, ${printDateStr}`;

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
  const maxNormalHoursPerDay = getEmployeeStandardDailyHours(
    employee,
    Number(payroll.standardWorkHoursPerDay) || STANDARD_WORK_HOURS_PER_DAY
  );
  const hourlyRate = Math.max(
    0,
    Math.round(
      Number(payroll.hourlyRate) ||
        getEmployeeHourlyRate(employee, maxNormalHoursPerDay, payroll.standardWorkingDays || 25)
    )
  );
  const dailySalaryRate = Math.max(
    0,
    Math.round(
      hourlyRate * maxNormalHoursPerDay ||
        Number(payroll.dailySalary) ||
        getEmployeeDailySalary(employee, payroll.standardWorkingDays || 25, maxNormalHoursPerDay)
    )
  );

  const rawBreakdown = Array.isArray(payroll.dailyWorkBreakdown)
    ? payroll.dailyWorkBreakdown
    : [];
  const dailyWorkBreakdown: DailyWorkWageItem[] = rawBreakdown.map((item) => {
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
      maxNormalHoursPerDay
    );
    return {
      ...item,
      workHours: cappedRes.cappedWorkHours,
      rawDurationHours: cappedRes.rawDurationHours,
      isCappedToMax: cappedRes.isCappedToMax,
      isMissingClockOut: cappedRes.isMissingClockOut,
      dailyWage: Math.round(cappedRes.cappedWorkHours * hourlyRate),
    };
  });

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

  // Gaji Pokok = Total Akumulasi Jam Kerja Aktual (sudah dibatasi maks 9 jam/hari) × Tarif Per Jam
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

  // Kelebihan jam kerja hanya dihitung jika ada Pengajuan Lembur yang berstatus "Disetujui" (Approved)
  const empOtList = overtimeRequests
    ? overtimeRequests.filter((o) => o && o.employeeId === employee.id)
    : getLocalOvertimeRequestsForEmployee(employee.id);
  const approvedOtList = empOtList.filter((o) => o.status === 'Disetujui');

  const approvedOtMinutesFromRequests = approvedOtList.reduce(
    (sum, o) => sum + getOvertimeMinutes(o),
    0
  );
  const approvedOtPayFromRequests = approvedOtList.reduce(
    (sum, o) =>
      sum +
      (Math.max(0, Math.round(Number(o.calculatedPay) || 0)) ||
        calculateOvertimePayByMinutes(employee, getOvertimeMinutes(o), 1.5)),
    0
  );

  const hasOvertimeRequestContext = overtimeRequests !== undefined || empOtList.length > 0;
  const overtimeMinutes = hasOvertimeRequestContext
    ? approvedOtMinutesFromRequests
    : Math.max(0, Math.round(Number(payroll.overtimeMinutes) || 0));
  const lemburJamTotal = hasOvertimeRequestContext
    ? approvedOtPayFromRequests
    : Math.max(0, Math.round(Number(payroll.overtimePay) || 0));

  const baseOtRatePerMin =
    Number(payroll.overtimeRatePerMinute) || getOvertimeRatePerMinute(employee, 1.5);
  const overtimeHourlyRate =
    overtimeMinutes > 0 && lemburJamTotal > 0
      ? Math.round(lemburJamTotal / (overtimeMinutes / 60))
      : Math.round(baseOtRatePerMin * 60);
  const overtimeHoursQty =
    overtimeMinutes > 0
      ? Number((overtimeMinutes / 60).toFixed(1))
      : lemburJamTotal > 0 && overtimeHourlyRate > 0
      ? Number((lemburJamTotal / overtimeHourlyRate).toFixed(1))
      : 0;

  const overtimeDailyRate = dailySalaryRate;
  const overtimeDaysQty = 0;
  const lemburHariTotal = 0;

  // Tambahan Lainnya (Manajemen Bonus + Bonus KPI jika ada)
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

  const payrollBonusVal = Math.max(0, Math.round(Number(payroll.bonus) || 0));
  if (payrollBonusVal > 0) {
    bonusItems.unshift({
      id: `kpi-bonus-${payroll.id}`,
      amount: payrollBonusVal,
      qty: 1,
      reason_note: 'Bonus Insentif Kinerja / KPI',
    });
  }

  const totalTambahanLainnya = bonusItems.reduce((sum, item) => sum + item.amount, 0);

  // Komisi Penjualan Live Streaming
  const liveSalesSummary = calculateEmployeeLiveSalesCommission(employee, periodStr);
  const salesCommissionAmount = Math.max(
    0,
    Math.round(Number(payroll.salesCommission) || 0),
    Math.round(Number(liveSalesSummary.totalCommission) || 0)
  );
  const liveOmsetAmount = Math.max(0, Math.round(Number(liveSalesSummary.totalOmset) || 0));
  const liveCommissionPct =
    liveSalesSummary.commissionPercentage > 0
      ? liveSalesSummary.commissionPercentage
      : liveSalesSummary.coHostCommissionPercentage > 0
      ? liveSalesSummary.coHostCommissionPercentage
      : Number(employee.salesCommissionPercentage || employee.coHostCommissionPercentage) || 0;
  const liveCommissionPcsNote =
    liveSalesSummary.totalPcs > 0
      ? `${liveSalesSummary.totalPcs.toLocaleString('id-ID')} Pcs`
      : '';

  const subtotalGajiTidakTetap =
    tunjanganKerajinanTotal +
    tunjanganKedisiplinanTotal +
    lemburJamTotal +
    lemburHariTotal +
    totalTambahanLainnya +
    salesCommissionAmount;

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
    : payroll.tanpaKeteranganHari !== undefined
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

  // 3.3 Izin (Hari) & 3.4 Sakit (Otomatis dari Panel Cuti & Izin berstatus Disetujui)
  const empLeaves = leaveRequests
    ? leaveRequests.filter((l) => l.employeeId === employee.id && l.status === 'Disetujui')
    : getLocalLeavesForEmployee(employee.id);
  const approvedIzinPribadiDays = empLeaves
    .filter((l) => l.type === 'Izin Pribadi')
    .reduce((sum, l) => sum + Math.max(0, Number(l.totalDays) || 0), 0);

  const izinHariDays = periodDeduction
    ? Math.max(0, Number(periodDeduction.izin_hari_jumlah) || 0)
    : payroll.izinHariJumlah !== undefined
    ? Math.max(0, Number(payroll.izinHariJumlah) || 0)
    : approvedIzinPribadiDays;
  const izinHariRate =
    periodDeduction && periodDeduction.izin_hari_rate > 0
      ? Math.max(0, Math.round(Number(periodDeduction.izin_hari_rate) || 0))
      : payroll.izinHariRate && payroll.izinHariRate > 0
      ? Math.max(0, Math.round(Number(payroll.izinHariRate) || 0))
      : dailySalaryRate;
  const izinHariDeduction =
    periodDeduction || payroll.izinHariJumlah !== undefined
      ? Math.round(izinHariDays * izinHariRate)
      : 0;

  const sickSummary = getApprovedSickLeaveSummaryForPeriod(
    empLeaves,
    employee,
    periodStr,
    dailySalaryRate
  );
  const sakitDays = sickSummary.sickDays;
  const sakitRate = sickSummary.sickRatePerDay > 0 ? sickSummary.sickRatePerDay : dailySalaryRate;
  const sakitDeduction = sickSummary.sickDeductionTotal;

  // 3.5 Keterlambatan (Sinkron dari log absensi)
  const totalLateMinutes = Math.max(0, Math.round(Number(payroll.totalLateMinutes) || 0));
  const rawTotalLateAndAlpha = payroll.isLateFeeWaived
    ? 0
    : Math.max(0, Math.round(Number(payroll.lateDeduction) || 0));
  const lateDeductionTotal = Math.max(
    0,
    rawTotalLateAndAlpha - (periodDeduction ? 0 : rawAlphaPenaltyFromPayroll)
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

  // 4. JUMLAH BERSIH
  const jumlahBersih = Math.max(
    0,
    subtotalGajiTetap + subtotalGajiTidakTetap - subtotalPengurangan
  );
  const terbilangText = terbilangRupiah(jumlahBersih);

  return {
    effectiveEmployee: employee,
    periodCutOffLabel,
    printCityAndDate,
    workDaysCount,
    totalActualWorkHours,
    maxNormalHoursPerDay,
    hourlyRate,
    dailyWorkBreakdown,
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
    liveCommissionPcsNote,
    salesCommissionAmount,
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
  const { effectiveEmployee } = data;
  const accountingSignatoryName =
    signatories.preparedBy?.name && signatories.preparedBy.name.trim()
      ? signatories.preparedBy.name.trim()
      : 'Siti Rahma Ramadany, S.KM';
  const preparedStamp =
    signatories.preparedBy?.stampDataUrl || signatories.companyStampDataUrl || '';
  const hourlyRateRef = getEmployeeHourlyRate(
    effectiveEmployee,
    STANDARD_WORK_HOURS_PER_DAY,
    25
  );

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
      <div className="text-center pb-3 mb-4 print:pb-2 print:mb-3 border-b border-slate-300">
        <h1 className="text-lg sm:text-xl print:text-lg font-black tracking-[0.25em] uppercase text-slate-950">
          SLIP GAJI
        </h1>
      </div>

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
            <span className="font-semibold text-slate-900">
              {effectiveEmployee.employmentStatus || effectiveEmployee.status || '-'}
            </span>
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
            <span className="font-semibold text-slate-700">Periode</span>
            <span className="text-slate-600">:</span>
            <span className="font-bold text-slate-950">{data.periodCutOffLabel}</span>
          </div>
          <div className="grid grid-cols-[135px_12px_1fr] items-start">
            <span className="font-semibold text-slate-700">Jumlah Hari Kerja</span>
            <span className="text-slate-600">:</span>
            <span className="font-bold text-slate-950">{data.workDaysCount} Hari</span>
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
                {formatAccountingRupiah(data.liveOmsetAmount)}
              </td>
              <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                × {data.liveCommissionPct}%
                {Boolean(data.liveCommissionPcsNote) ? ` (${data.liveCommissionPcsNote})` : ''}
              </td>
              <td className="py-1.5 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                {formatAccountingRupiah(data.salesCommissionAmount)}
              </td>
            </tr>
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

      {/* 4. RINGKASAN JUMLAH BERSIH & TERBILANG */}
      <div className="mt-4 p-4 bg-emerald-50 border-2 border-slate-900 rounded-lg print:bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-sm sm:text-base font-black tracking-wider uppercase text-slate-950">
            JUMLAH BERSIH :
          </span>
          <span className="text-lg sm:text-2xl font-black font-mono text-emerald-800 print:text-black">
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
          <p>**Akan dilakukan pemotongan sesuai dengan aturan pemerintah (akan datang)</p>
        </div>

        {/* Blok Tanda Tangan di Kanan Bawah */}
        <div className="md:col-span-7 print:col-span-7">
          <div className="text-right font-semibold text-slate-800 mb-3 text-xs">
            {data.printCityAndDate}
          </div>
          <div className="grid grid-cols-2 gap-6 text-center text-xs">
            {/* Kolom Kiri: Karyawan */}
            <div className="flex flex-col justify-between min-h-[110px]">
              <span className="font-semibold text-slate-800">Karyawan,</span>
              <div className="h-16" />
              <div className="border-t border-slate-800 pt-1.5 mx-auto w-44 max-w-full">
                <p className="font-bold text-slate-950 truncate">
                  {effectiveEmployee.fullName}
                </p>
              </div>
            </div>

            {/* Kolom Kanan: Prepared by Accounting */}
            <div
              onClick={onEditSignatories}
              className={`flex flex-col justify-between min-h-[110px] rounded-lg p-1 ${
                onEditSignatories ? 'hover:bg-slate-50 cursor-pointer transition-colors' : ''
              }`}
              title={onEditSignatories ? 'Klik untuk mengubah nama penandatangan Accounting/HR' : undefined}
            >
              <span className="font-semibold text-slate-800">Prepared by Accounting,</span>
              <div className="relative h-16 flex items-end justify-center my-0.5">
                {Boolean(signatories.preparedBy?.showStamp && preparedStamp) && (
                  <img
                    src={preparedStamp}
                    alt="Stempel"
                    className="absolute left-1/2 -translate-x-10 bottom-0 w-14 h-14 object-contain opacity-80 pointer-events-none z-10"
                  />
                )}
                {Boolean(signatories.preparedBy?.signatureDataUrl) && (
                  <img
                    src={signatories.preparedBy.signatureDataUrl}
                    alt={accountingSignatoryName}
                    className="max-h-14 max-w-[130px] object-contain relative z-20"
                  />
                )}
              </div>
              <div className="border-t border-slate-800 pt-1.5 mx-auto w-48 max-w-full relative z-20">
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
      const [sessions, empFromDb, bonusesFromDb, adjustmentsFromDb, deductionsFromDb] =
        await Promise.all([
          fetchLivestreamSessionsFromSupabase(employee.id, payroll?.period),
          fetchEmployeeByIdFromSupabase(employee.id),
          fetchEmployeeBonuses(),
          fetchEmployeeAdjustments(),
          fetchPayrollDeductions(),
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

    window.addEventListener('tgi_employee_live_updated', handleLiveUpdated);
    window.addEventListener('tgi_livestream_sessions_updated', handleLiveUpdated);
    window.addEventListener('tgi_employee_bonuses_updated', handleBonusesUpdated);
    window.addEventListener('tgi_employee_adjustments_updated', handleAdjustmentsUpdated);
    window.addEventListener('tgi_payroll_deductions_updated', handleDeductionsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('tgi_employee_live_updated', handleLiveUpdated);
      window.removeEventListener('tgi_livestream_sessions_updated', handleLiveUpdated);
      window.removeEventListener('tgi_employee_bonuses_updated', handleBonusesUpdated);
      window.removeEventListener('tgi_employee_adjustments_updated', handleAdjustmentsUpdated);
      window.removeEventListener('tgi_payroll_deductions_updated', handleDeductionsUpdated);
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

  const computedData = useMemo(() => {
    if (!payroll || !effectiveEmployee) return null;
    return computeOfficialPayslipData({
      payroll,
      employee: effectiveEmployee,
      companyConfig,
      employeeBonuses: combinedBonuses,
      employeeAdjustments: combinedAdjustments,
      payrollDeductions: combinedDeductions,
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              TGI
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Slip Gaji Karyawan (A4)</h3>
              <p className="text-xs text-slate-500">{payroll.referenceNumber}</p>
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
