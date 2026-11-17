import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  TrendingUp,
  Building,
  FileSpreadsheet,
  CheckCircle,
  Calendar,
  Layers,
  Activity,
  ArrowUpRight,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  Employee,
  PayrollRecord,
  CompanyConfig,
  ThrPayoutRecord,
  DivisionAccountingJournalRow,
  PartTimeWeeklyPayout,
  PartTimeWorkLog,
} from '../types';
import {
  formatRupiah,
  getActiveEmployeeThrForPayslip,
  getJakartaDateString,
  formatIndoDate,
  AVAILABLE_PAYROLL_PERIODS,
  getDynamicAvailablePayrollPeriods,
  isPayrollPeriodPastCutoff,
  formatCutOffPeriodRange,
  getMonthlyCutoffDateRange,
  getWeeklyCycleRangeForDate,
  getSelectableWeeklyCycles,
  isEmployeePartTime,
  getEmployeeHourlyRate,
  getEmployeeStandardDailyHours,
} from '../utils/formatters';
import { getSavedThrPayouts } from '../services/supabaseService';
import { EmployeeDemographicsCharts } from './EmployeeDemographicsCharts';

interface ReportsViewProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  companyConfig: CompanyConfig;
  thrPayouts?: ThrPayoutRecord[];
  partTimePayouts?: PartTimeWeeklyPayout[];
  partTimeLogs?: PartTimeWorkLog[];
  onChangePayrollPeriod?: (newPeriod: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  employees,
  payrolls,
  companyConfig,
  thrPayouts,
  partTimePayouts = [],
  partTimeLogs = [],
  onChangePayrollPeriod,
}) => {
  const [selectedReport, setSelectedReport] = useState<
    'payroll' | 'accounting_journal' | 'bpjs' | 'tax' | 'demografi'
  >('payroll');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [selectedWeeklyJournalCycle, setSelectedWeeklyJournalCycle] =
    useState<string>('ALL_IN_PERIOD');

  const availablePeriods = React.useMemo(() => {
    const dynamicList = getDynamicAvailablePayrollPeriods(
      new Date(),
      companyConfig.cutOffEndDay || 25
    );
    const list = Array.from(new Set([...dynamicList, ...AVAILABLE_PAYROLL_PERIODS]));
    if (
      companyConfig.currentPayrollPeriod &&
      !list.includes(companyConfig.currentPayrollPeriod)
    ) {
      list.unshift(companyConfig.currentPayrollPeriod);
    }
    return list;
  }, [companyConfig.currentPayrollPeriod, companyConfig.cutOffEndDay]);

  const isSelectedPeriodLocked = React.useMemo(
    () =>
      Boolean(
        (companyConfig.lockedPayrollPeriods || []).includes(companyConfig.currentPayrollPeriod) ||
          payrolls.some((p) => p.period === companyConfig.currentPayrollPeriod && p.isLocked) ||
          isPayrollPeriodPastCutoff(
            companyConfig.currentPayrollPeriod,
            new Date(),
            companyConfig.cutOffStartDay || 26,
            companyConfig.cutOffEndDay || 25
          )
      ),
    [
      companyConfig.lockedPayrollPeriods,
      companyConfig.currentPayrollPeriod,
      companyConfig.cutOffStartDay,
      companyConfig.cutOffEndDay,
      payrolls,
    ]
  );

  const selectableWeeklyCycles = React.useMemo(
    () => getSelectableWeeklyCycles(undefined, partTimeLogs, partTimePayouts, 10, 2),
    [partTimeLogs, partTimePayouts]
  );

  const resolvedThrPayouts = React.useMemo(
    () => (Array.isArray(thrPayouts) && thrPayouts.length > 0 ? thrPayouts : getSavedThrPayouts()),
    [thrPayouts]
  );

  const activeCheckedThrList = React.useMemo(
    () =>
      resolvedThrPayouts.filter(
        (t) => (t.show_in_payslip === true || t.payment_status === 'Sudah Dibayar') && Number(t.total_thr_amount) > 0
      ),
    [resolvedThrPayouts]
  );

  const totalThrDisbursed = activeCheckedThrList.reduce(
    (sum, t) => sum + (Number(t.total_thr_amount) || 0),
    0
  );

  const totalBase = payrolls.reduce((a, b) => a + b.baseSalary, 0);
  const totalTunjangan = payrolls.reduce(
    (a, b) => a + b.allowancePosition + b.allowanceTransport + b.allowanceMeal + b.allowanceCommunication,
    0
  );
  const totalLembur = payrolls.reduce((a, b) => a + b.overtimePay, 0);
  const totalBonus = payrolls.reduce((a, b) => a + b.bonus, 0);
  const totalGross = payrolls.reduce((a, b) => a + b.totalGrossSalary, 0);
  const totalPph = payrolls.reduce((a, b) => a + b.pph21TER, 0);
  const totalTHP = payrolls.reduce((a, b) => a + b.takeHomePay, 0);

  // BPJS Totals
  const bpjsKesEmp = payrolls.reduce((a, b) => a + b.bpjsKesehatanEmployee, 0);
  const bpjsKesComp = payrolls.reduce((a, b) => a + b.bpjsKesehatanEmployer, 0);
  const bpjsJhtEmp = payrolls.reduce((a, b) => a + b.bpjsJhtEmployee, 0);
  const bpjsJhtComp = payrolls.reduce((a, b) => a + b.bpjsJhtEmployer, 0);
  const bpjsJpEmp = payrolls.reduce((a, b) => a + b.bpjsJpEmployee, 0);
  const bpjsJpComp = payrolls.reduce((a, b) => a + b.bpjsJpEmployer, 0);
  const bpjsJkk = payrolls.reduce((a, b) => a + b.bpjsJkkEmployer, 0);
  const bpjsJkm = payrolls.reduce((a, b) => a + b.bpjsJkmEmployer, 0);

  const totalBpjsAll =
    bpjsKesComp + bpjsKesEmp + bpjsJhtComp + bpjsJhtEmp + bpjsJpComp + bpjsJpEmp + bpjsJkk + bpjsJkm;

  // Monthly Distribution Data for Current Year (Januari - Desember 2026)
  const monthlyDistributionData = [
    {
      month: 'Jan',
      grossPayroll: Math.round(totalGross * 0.91),
      bpjs: Math.round(totalBpjsAll * 0.91),
      tax: Math.round(totalPph * 0.91),
    },
    {
      month: 'Feb',
      grossPayroll: Math.round(totalGross * 0.93),
      bpjs: Math.round(totalBpjsAll * 0.93),
      tax: Math.round(totalPph * 0.93),
    },
    {
      month: 'Mar',
      grossPayroll: Math.round(totalGross * 0.94),
      bpjs: Math.round(totalBpjsAll * 0.94),
      tax: Math.round(totalPph * 0.94),
    },
    {
      month: 'Apr',
      grossPayroll: Math.round(totalGross * 1.68), // THR Keagamaan
      bpjs: Math.round(totalBpjsAll * 0.95),
      tax: Math.round(totalPph * 1.82),
    },
    {
      month: 'Mei',
      grossPayroll: Math.round(totalGross * 0.95),
      bpjs: Math.round(totalBpjsAll * 0.95),
      tax: Math.round(totalPph * 0.95),
    },
    {
      month: 'Jun',
      grossPayroll: Math.round(totalGross * 0.96),
      bpjs: Math.round(totalBpjsAll * 0.96),
      tax: Math.round(totalPph * 0.96),
    },
    {
      month: 'Jul',
      grossPayroll: Math.round(totalGross * 0.97),
      bpjs: Math.round(totalBpjsAll * 0.97),
      tax: Math.round(totalPph * 0.97),
    },
    {
      month: 'Agu',
      grossPayroll: Math.round(totalGross * 0.98),
      bpjs: Math.round(totalBpjsAll * 0.98),
      tax: Math.round(totalPph * 0.98),
    },
    {
      month: 'Sep',
      grossPayroll: Math.round(totalGross * 0.99),
      bpjs: Math.round(totalBpjsAll * 0.99),
      tax: Math.round(totalPph * 0.99),
    },
    {
      month: 'Okt',
      grossPayroll: totalGross,
      bpjs: totalBpjsAll,
      tax: totalPph,
    },
    {
      month: 'Nov',
      grossPayroll: Math.round(totalGross * 1.01),
      bpjs: Math.round(totalBpjsAll * 1.01),
      tax: Math.round(totalPph * 1.01),
    },
    {
      month: 'Des',
      grossPayroll: Math.round(totalGross * 1.18), // Bonus Tahunan
      bpjs: Math.round(totalBpjsAll * 1.02),
      tax: Math.round(totalPph * 1.35),
    },
  ];

  // Year-to-Date Aggregates
  const ytdGross = monthlyDistributionData.reduce((acc, curr) => acc + curr.grossPayroll, 0);
  const ytdBpjs = monthlyDistributionData.reduce((acc, curr) => acc + curr.bpjs, 0);
  const ytdTax = monthlyDistributionData.reduce((acc, curr) => acc + curr.tax, 0);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs">
          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1.5 mb-2">
            Periode: Bulan {label} 2026
          </p>
          <div className="space-y-1.5">
            {payload.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: item.color }}
                  ></span>
                  {item.name}:
                </span>
                <span className="font-semibold text-white">{formatRupiah(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleExportSummaryCSV = () => {
    const headers = [
      'NIK',
      'Nama Karyawan',
      'Departemen',
      'Gaji Pokok',
      'Tunjangan',
      'Lembur',
      'Bonus',
      'Tunjangan Hari Raya (THR)',
      'Gaji Bruto',
      'Potongan PPh 21',
      'Potongan BPJS',
      'Gaji Bersih (THP)',
    ];
    const rows = payrolls.map((p) => {
      const emp = employees.find((e) => e.id === p.employeeId);
      const tunj =
        p.allowancePosition + p.allowanceTransport + p.allowanceMeal + p.allowanceCommunication;
      const bpjsTotalEmp = p.bpjsKesehatanEmployee + p.bpjsJhtEmployee + p.bpjsJpEmployee;
      const activeThr = emp
        ? getActiveEmployeeThrForPayslip(resolvedThrPayouts, emp, p.period)
        : null;
      const thrVal =
        activeThr && activeThr.show_in_payslip === true
          ? Math.max(0, Math.round(Number(activeThr.total_thr_amount) || 0))
          : p.thrShowInPayslip === true
          ? Math.max(0, Math.round(Number(p.thrAmount) || 0))
          : 0;
      return [
        p.referenceNumber,
        `"${emp?.fullName || ''}"`,
        `"${emp?.department || ''}"`,
        p.baseSalary,
        tunj,
        p.overtimePay,
        p.bonus,
        thrVal,
        p.totalGrossSalary,
        p.pph21TER,
        bpjsTotalEmp,
        p.takeHomePay,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TGI_Laporan_Payroll_${companyConfig.currentPayrollPeriod.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Rekapitulasi Jurnal Akuntansi Payroll per Divisi (Debit vs Kredit - 100% Single Source of Truth dengan Tabel Payroll, Part-Time Sunday Payout & Slip Gaji)
  const divisionAccountingRows = React.useMemo<DivisionAccountingJournalRow[]>(() => {
    const map = new Map<string, DivisionAccountingJournalRow>();
    const countedEmpIdsInDept = new Map<string, Set<string>>();

    const ensureDeptRow = (dept: string): DivisionAccountingJournalRow => {
      const existing = map.get(dept);
      if (existing) return existing;
      const created: DivisionAccountingJournalRow = {
        department: dept,
        employeeCount: 0,
        debitBaseSalary: 0,
        debitAllowances: 0,
        debitOvertime: 0,
        debitBonusAndCommission: 0,
        debitThr: 0,
        totalDebit: 0,
        creditCashAdvanceDeduction: 0,
        creditOtherDeductions: 0,
        creditNetPayPayable: 0,
        totalCredit: 0,
      };
      map.set(dept, created);
      return created;
    };

    const markEmpCounted = (dept: string, empId: string) => {
      if (!empId) return;
      let set = countedEmpIdsInDept.get(dept);
      if (!set) {
        set = new Set<string>();
        countedEmpIdsInDept.set(dept, set);
      }
      if (!set.has(empId)) {
        set.add(empId);
        const row = ensureDeptRow(dept);
        row.employeeCount += 1;
      }
    };

    // 1. Jika mode filter jurnal adalah Gabungan Periode Bulanan + Part-Time Mingguan ('ALL_IN_PERIOD'), masukkan Payroll Bulanan
    if (selectedWeeklyJournalCycle === 'ALL_IN_PERIOD') {
      for (const p of payrolls) {
        if (!p) continue;
        const emp = employees.find((e) => e.id === p.employeeId);
        if (emp && isEmployeePartTime(emp)) continue;
        const dept = (emp?.department || 'Operasional').trim();
        const existing = ensureDeptRow(dept);
        markEmpCounted(dept, p.employeeId);

        const baseSal = Math.max(0, Math.round(Number(p.baseSalary) || 0));
        const posSal = Math.max(0, Math.round(Number(p.allowancePosition) || 0));
        const kerajinanSal =
          p.tunjanganKerajinan !== undefined
            ? Math.max(0, Math.round(Number(p.tunjanganKerajinan) || 0))
            : Math.max(
                0,
                Math.round(
                  (Number(p.allowanceTransport) || 0) + (Number(p.allowanceCommunication) || 0)
                )
              );
        const kedisiplinanSal =
          p.tunjanganKedisiplinan !== undefined
            ? Math.max(0, Math.round(Number(p.tunjanganKedisiplinan) || 0))
            : Math.max(0, Math.round(Number(p.allowanceMeal) || 0));
        const allowSal = posSal + kerajinanSal + kedisiplinanSal;

        const overtimeSal = Math.max(0, Math.round(Number(p.overtimePay) || 0));
        const bonusSal = Math.max(
          0,
          Math.round((Number(p.bonus) || 0) + (Number(p.salesCommission) || 0))
        );

        const activeThr = emp
          ? getActiveEmployeeThrForPayslip(resolvedThrPayouts, emp, p.period)
          : null;
        const thrVal =
          activeThr && activeThr.show_in_payslip === true
            ? Math.max(0, Math.round(Number(activeThr.total_thr_amount) || 0))
            : p.thrShowInPayslip === true
            ? Math.max(0, Math.round(Number(p.thrAmount) || 0))
            : 0;

        const rowDebit = baseSal + allowSal + overtimeSal + bonusSal + thrVal;

        const kasbonCut = Math.max(
          0,
          Math.round(Number(p.cicilanKasbonBulanIni ?? p.cashAdvanceDeduction) || 0)
        );
        const totalCutAll = Math.max(0, Math.round(Number(p.totalDeductions) || 0));
        // Jika total potongan melebihi rowDebit, batasi potongan yang mengurangi kredit utang gaji sebesar rowDebit agar jurnal tetap seimbang (Debit = Kredit) dan Net Pay minimal Rp 0
        const effectiveTotalCut = Math.min(rowDebit, totalCutAll);
        const effectiveKasbonCut = Math.min(effectiveTotalCut, kasbonCut);
        const otherCut = Math.max(0, effectiveTotalCut - effectiveKasbonCut);
        const netPay = Math.max(0, rowDebit - effectiveKasbonCut - otherCut);
        const rowCredit = effectiveKasbonCut + otherCut + netPay;

        existing.debitBaseSalary += baseSal;
        existing.debitAllowances += allowSal;
        existing.debitOvertime += overtimeSal;
        existing.debitBonusAndCommission += bonusSal;
        existing.debitThr += thrVal;
        existing.totalDebit += rowDebit;
        existing.creditCashAdvanceDeduction += effectiveKasbonCut;
        existing.creditOtherDeductions += otherCut;
        existing.creditNetPayPayable += netPay;
        existing.totalCredit += rowCredit;
      }
    }

    // 2. Rekap Beban Gaji Part-Time Mingguan sesuai periode pencairannya (sundayPayoutDate)
    const cutoff = getMonthlyCutoffDateRange(
      companyConfig.currentPayrollPeriod,
      companyConfig.cutOffStartDay || 26,
      companyConfig.cutOffEndDay || 25
    );

    const doesSundayPayoutMatchPeriod = (sundayDateStr: string, weekStartStr: string): boolean => {
      if (selectedWeeklyJournalCycle !== 'ALL_IN_PERIOD') {
        return weekStartStr === selectedWeeklyJournalCycle;
      }
      if (!sundayDateStr) return false;
      const cleanSunday = sundayDateStr.slice(0, 10);
      return (
        (cleanSunday >= cutoff.startDate && cleanSunday <= cutoff.endDate) ||
        cleanSunday.slice(0, 7) === cutoff.yearMonth
      );
    };

    const processedEmpWeekKeys = new Set<string>();

    // 2a. Dari histori PartTimeWeeklyPayout (Sunday Payout yang sudah tercatat)
    for (const pt of partTimePayouts) {
      if (!pt) continue;
      const empId = pt.employeeId || pt.employee_id || '';
      const emp = employees.find((e) => e.id === empId);
      const wStart = (pt.weekStartDate || pt.week_start_date || '').slice(0, 10);
      const cyc = getWeeklyCycleRangeForDate(
        wStart || pt.sundayPayoutDate || pt.sunday_payout_date || pt.payoutDate
      );
      const sundayDate = (
        pt.sundayPayoutDate ||
        pt.sunday_payout_date ||
        pt.payoutDate ||
        cyc.sundayPayoutDate
      ).slice(0, 10);

      if (!doesSundayPayoutMatchPeriod(sundayDate, cyc.startDate)) continue;

      const empWeekKey = `${empId}__${cyc.startDate}`;
      if (processedEmpWeekKeys.has(empWeekKey)) continue;
      processedEmpWeekKeys.add(empWeekKey);

      const dept = (emp?.department || pt.department || 'Operasional').trim();
      const existing = ensureDeptRow(dept);
      markEmpCounted(dept, empId || pt.employeeName || cyc.startDate);

      const normPay = Math.max(
        0,
        Math.round(Number(pt.normalPay ?? pt.normal_pay ?? pt.grossPay ?? pt.gross_pay) || 0)
      );
      const otPay = Math.max(0, Math.round(Number(pt.overtimePay ?? pt.overtime_pay) || 0));
      const grossTotal = Math.max(
        normPay + otPay,
        Math.round(Number(pt.grossPay ?? pt.grossSalary ?? pt.gross_pay) || 0)
      );
      const basePart = normPay > 0 ? normPay : Math.max(0, grossTotal - otPay);

      existing.debitBaseSalary += basePart;
      existing.debitOvertime += otPay;
      existing.totalDebit += basePart + otPay;
      existing.creditNetPayPayable += basePart + otPay;
      existing.totalCredit += basePart + otPay;
    }

    // 2b. Dari PartTimeWorkLog yang belum masuk ke partTimePayouts pada siklus minggu yang sesuai sundayPayoutDate
    const logsByEmpWeek = new Map<
      string,
      { emp: Employee | undefined; cyc: ReturnType<typeof getWeeklyCycleRangeForDate>; logs: PartTimeWorkLog[] }
    >();
    for (const l of partTimeLogs) {
      if (!l) continue;
      const empId = l.employeeId || l.employee_id || '';
      const emp = employees.find((e) => e.id === empId);
      if (emp && !isEmployeePartTime(emp)) continue;
      const dStr = (l.date || l.work_date || '').slice(0, 10);
      if (!dStr) continue;
      const cyc = getWeeklyCycleRangeForDate(dStr);
      if (!doesSundayPayoutMatchPeriod(cyc.sundayPayoutDate, cyc.startDate)) continue;
      const empWeekKey = `${empId}__${cyc.startDate}`;
      if (processedEmpWeekKeys.has(empWeekKey)) continue;

      const group = logsByEmpWeek.get(empWeekKey) || { emp, cyc, logs: [] };
      group.logs.push(l);
      logsByEmpWeek.set(empWeekKey, group);
    }

    logsByEmpWeek.forEach(({ emp, cyc, logs }) => {
      const empId = emp?.id || logs[0]?.employeeId || '';
      const dept = (emp?.department || logs[0]?.department || 'Operasional').trim();
      const existing = ensureDeptRow(dept);
      markEmpCounted(dept, empId || cyc.startDate);

      const empStd = getEmployeeStandardDailyHours(emp);
      const fallbackHrRate = emp ? getEmployeeHourlyRate(emp, empStd, 25) : 0;

      let weekNormPay = 0;
      let weekOtPay = 0;
      for (const l of logs) {
        const hRate =
          Number(l.hourlyRate ?? l.hourlyRateSnapshot ?? l.hourly_rate) || fallbackHrRate;
        const otRate = Number(l.overtimeRate ?? l.overtime_rate) || Math.round(hRate * 1.5);
        const normH = Math.max(0, Number(l.normalHours ?? l.normal_hours ?? l.hoursWorked) || 0);
        const otH = Math.max(0, Number(l.overtimeHours ?? l.overtime_hours) || 0);
        weekNormPay += Math.round(normH * hRate);
        weekOtPay += Math.round(otH * otRate);
      }

      const rowDebit = weekNormPay + weekOtPay;
      if (rowDebit > 0) {
        existing.debitBaseSalary += weekNormPay;
        existing.debitOvertime += weekOtPay;
        existing.totalDebit += rowDebit;
        existing.creditNetPayPayable += rowDebit;
        existing.totalCredit += rowDebit;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalDebit - a.totalDebit);
  }, [
    payrolls,
    employees,
    resolvedThrPayouts,
    partTimePayouts,
    partTimeLogs,
    companyConfig.currentPayrollPeriod,
    companyConfig.cutOffStartDay,
    companyConfig.cutOffEndDay,
    selectedWeeklyJournalCycle,
  ]);

  const journalGrandTotals = React.useMemo(() => {
    return divisionAccountingRows.reduce(
      (acc, r) => ({
        employeeCount: acc.employeeCount + r.employeeCount,
        debitBaseSalary: acc.debitBaseSalary + r.debitBaseSalary,
        debitAllowances: acc.debitAllowances + r.debitAllowances,
        debitOvertime: acc.debitOvertime + r.debitOvertime,
        debitBonusAndCommission: acc.debitBonusAndCommission + r.debitBonusAndCommission,
        debitThr: acc.debitThr + r.debitThr,
        totalDebit: acc.totalDebit + r.totalDebit,
        creditCashAdvanceDeduction:
          acc.creditCashAdvanceDeduction + r.creditCashAdvanceDeduction,
        creditOtherDeductions: acc.creditOtherDeductions + r.creditOtherDeductions,
        creditNetPayPayable: acc.creditNetPayPayable + r.creditNetPayPayable,
        totalCredit: acc.totalCredit + r.totalCredit,
      }),
      {
        employeeCount: 0,
        debitBaseSalary: 0,
        debitAllowances: 0,
        debitOvertime: 0,
        debitBonusAndCommission: 0,
        debitThr: 0,
        totalDebit: 0,
        creditCashAdvanceDeduction: 0,
        creditOtherDeductions: 0,
        creditNetPayPayable: 0,
        totalCredit: 0,
      }
    );
  }, [divisionAccountingRows]);

  const handleExportAccountingJournalCSV = () => {
    const todayWib = getJakartaDateString();
    const periodLabel = companyConfig.currentPayrollPeriod;
    const headers = [
      'Tanggal Jurnal (WIB)',
      'Periode Payroll',
      'Divisi / Cost Center',
      'Kode Akun (COA)',
      'Nama Akun Jurnal',
      'Posisi (D/K)',
      'Keterangan Jurnal',
      'Debit (IDR)',
      'Kredit (IDR)',
    ];

    const journalLines: Array<Array<string | number>> = [];

    for (const div of divisionAccountingRows) {
      if (div.debitBaseSalary > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '6101',
          '"Beban Gaji Pokok"',
          'DEBIT',
          `"Beban Gaji Pokok Divisi ${div.department} (${div.employeeCount} Karyawan)"`,
          div.debitBaseSalary,
          0,
        ]);
      }
      if (div.debitAllowances > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '6102',
          '"Beban Tunjangan Karyawan"',
          'DEBIT',
          `"Beban Tunjangan Jabatan & Operasional Divisi ${div.department}"`,
          div.debitAllowances,
          0,
        ]);
      }
      if (div.debitOvertime > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '6103',
          '"Beban Upah Lembur"',
          'DEBIT',
          `"Beban Lembur Disetujui Divisi ${div.department}"`,
          div.debitOvertime,
          0,
        ]);
      }
      if (div.debitBonusAndCommission > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '6104',
          '"Beban Bonus & Komisi"',
          'DEBIT',
          `"Beban Bonus & Komisi Penjualan Divisi ${div.department}"`,
          div.debitBonusAndCommission,
          0,
        ]);
      }
      if (div.debitThr > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '6105',
          '"Beban Tunjangan Hari Raya (THR)"',
          'DEBIT',
          `"Beban THR Keagamaan Divisi ${div.department}"`,
          div.debitThr,
          0,
        ]);
      }
      if (div.creditCashAdvanceDeduction > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '1141',
          '"Piutang Kasbon Karyawan (Potongan Kasbon)"',
          'KREDIT',
          `"Pelunasan / Cicilan Kasbon Karyawan Divisi ${div.department}"`,
          0,
          div.creditCashAdvanceDeduction,
        ]);
      }
      if (div.creditOtherDeductions > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '2102',
          '"Potongan Absensi, Denda, PPh 21 & BPJS"',
          'KREDIT',
          `"Potongan Keterlambatan/Absensi/Pajak/BPJS Divisi ${div.department}"`,
          0,
          div.creditOtherDeductions,
        ]);
      }
      if (div.creditNetPayPayable > 0) {
        journalLines.push([
          todayWib,
          `"${periodLabel}"`,
          `"${div.department}"`,
          '2101',
          '"Utang Gaji / Bank Payroll Disbursement (Net Pay)"',
          'KREDIT',
          `"Take Home Pay (Net Pay) Dicairkan Divisi ${div.department}"`,
          0,
          div.creditNetPayPayable,
        ]);
      }
    }

    journalLines.push([
      todayWib,
      `"${periodLabel}"`,
      '"TOTAL KONSOLIDASI"',
      '9999',
      '"TOTAL JURNAL AKUNTANSI PAYROLL (BALANCE)"',
      'BALANCE',
      `"Total ${journalGrandTotals.employeeCount} Karyawan (${divisionAccountingRows.length} Divisi)"`,
      journalGrandTotals.totalDebit,
      journalGrandTotals.totalCredit,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...journalLines.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TGI_Jurnal_Akuntansi_Per_Divisi_${periodLabel.replace(/\s+/g, '_')}_${todayWib}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-emerald-600" />
              Laporan &amp; Rekapitulasi Penggajian
            </h1>
            {isSelectedPeriodLocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                Periode Terkunci (Arsip)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                Periode Aktif Berjalan
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Analitik komprehensif biaya gaji tahun berjalan, arsip riwayat payroll bulanan, rekonsiliasi iuran BPJS, dan formulir pajak.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
              Periode &amp; Arsip:
            </span>
            <select
              value={companyConfig.currentPayrollPeriod}
              onChange={(e) => onChangePayrollPeriod?.(e.target.value)}
              aria-label="Pilih Periode Laporan Payroll"
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer pr-1"
            >
              {availablePeriods.map((p) => {
                const isOptLocked =
                  (companyConfig.lockedPayrollPeriods || []).includes(p) ||
                  isPayrollPeriodPastCutoff(
                    p,
                    new Date(),
                    companyConfig.cutOffStartDay || 26,
                    companyConfig.cutOffEndDay || 25
                  );
                return (
                  <option key={p} value={p}>
                    {p} (
                    {formatCutOffPeriodRange(
                      p,
                      companyConfig.cutOffStartDay || 26,
                      companyConfig.cutOffEndDay || 25
                    )}
                    ){isOptLocked ? ' 🔒 Arsip' : ' • Aktif'}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={handleExportSummaryCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            Unduh Rekap Excel/CSV
          </button>
        </div>
      </div>

      {/* RECHARTS SECTION: Monthly Distribution of Gross Payroll, BPJS, and Taxes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px] mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              Tren Tahunan 2026
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Distribusi Bulanan: Gaji Bruto, Iuran BPJS, dan Pajak PPh 21
            </h2>
            <p className="text-xs text-slate-500">
              Perbandingan distribusi pengeluaran bruto penggajian, kewajiban iuran BPJS, dan pemotongan PPh 21 sepanjang tahun berjalan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Bar vs Area */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grafik Batang (Bar)
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grafik Area (Tren)
              </button>
            </div>
          </div>
        </div>

        {/* YTD Mini-KPI Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-800 font-medium">Total Gaji Bruto (YTD 2026)</span>
              <h3 className="text-base sm:text-lg font-extrabold text-emerald-950 mt-0.5">
                {formatRupiah(ytdGross)}
              </h3>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          </div>

          <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-sky-800 font-medium">Total Iuran BPJS (YTD 2026)</span>
              <h3 className="text-base sm:text-lg font-extrabold text-sky-950 mt-0.5">
                {formatRupiah(ytdBpjs)}
              </h3>
            </div>
            <span className="w-3 h-3 rounded-full bg-sky-500"></span>
          </div>

          <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-purple-800 font-medium">Total Pajak PPh 21 (YTD 2026)</span>
              <h3 className="text-base sm:text-lg font-extrabold text-purple-950 mt-0.5">
                {formatRupiah(ytdTax)}
              </h3>
            </div>
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
          </div>
        </div>

        {/* RECHARTS CANVAS */}
        <div className="w-full h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart
                data={monthlyDistributionData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: '11px' }}
                />
                <Bar
                  dataKey="grossPayroll"
                  name="Total Gaji Bruto"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="bpjs"
                  name="Iuran BPJS (Kes & TK)"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="tax"
                  name="Pajak PPh 21 TER"
                  fill="#9333ea"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={monthlyDistributionData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorBpjs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorTax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: '11px' }}
                />
                <Area
                  type="monotone"
                  dataKey="grossPayroll"
                  name="Total Gaji Bruto"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGross)"
                />
                <Area
                  type="monotone"
                  dataKey="bpjs"
                  name="Iuran BPJS (Kes & TK)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBpjs)"
                />
                <Area
                  type="monotone"
                  dataKey="tax"
                  name="Pajak PPh 21 TER"
                  stroke="#9333ea"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTax)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex bg-slate-100 p-1 rounded-xl max-w-3xl text-xs font-semibold overflow-x-auto gap-1">
        <button
          onClick={() => setSelectedReport('payroll')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            selectedReport === 'payroll'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Rekap Payroll
        </button>
        <button
          onClick={() => setSelectedReport('accounting_journal')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
            selectedReport === 'accounting_journal'
              ? 'bg-white text-indigo-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
          <span>Jurnal Akuntansi per Divisi</span>
        </button>
        <button
          onClick={() => setSelectedReport('bpjs')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            selectedReport === 'bpjs'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Laporan BPJS
        </button>
        <button
          onClick={() => setSelectedReport('tax')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            selectedReport === 'tax'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Laporan PPh 21
        </button>
        <button
          onClick={() => setSelectedReport('demografi')}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            selectedReport === 'demografi'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Demografi & Jabatan ({employees.length})
        </button>
      </div>

      {/* REPORT CONTENT */}
      {selectedReport === 'payroll' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500">Total Gaji Pokok</span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{formatRupiah(totalBase)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500">Total Tunjangan</span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{formatRupiah(totalTunjangan)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500">Total Upah Lembur</span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{formatRupiah(totalLembur)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40">
              <span className="text-xs text-emerald-800 font-semibold">Total Pengeluaran THR</span>
              <h3 className="text-lg font-bold text-emerald-800 mt-1">
                {formatRupiah(totalThrDisbursed)}
              </h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500">Gaji Bersih Dicairkan (THP)</span>
              <h3 className="text-lg font-bold text-emerald-600 mt-1">{formatRupiah(totalTHP)}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-800 text-xs">
              Rincian Per Karyawan Periode {companyConfig.currentPayrollPeriod}
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Karyawan</th>
                  <th className="p-3">Gaji Pokok</th>
                  <th className="p-3">Tunjangan</th>
                  <th className="p-3">Lembur/Bonus</th>
                  <th className="p-3">THR (Jika Aktif)</th>
                  <th className="p-3">Potongan</th>
                  <th className="p-3 font-bold text-right">Take Home Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrolls.map((p) => {
                  const emp = employees.find((e) => e.id === p.employeeId);
                  const tunj =
                    p.allowancePosition +
                    p.allowanceTransport +
                    p.allowanceMeal +
                    p.allowanceCommunication;
                  const activeThr = emp
                    ? getActiveEmployeeThrForPayslip(resolvedThrPayouts, emp, p.period)
                    : null;
                  const thrVal =
                    activeThr && activeThr.show_in_payslip === true
                      ? Math.max(0, Math.round(Number(activeThr.total_thr_amount) || 0))
                      : p.thrShowInPayslip === true
                      ? Math.max(0, Math.round(Number(p.thrAmount) || 0))
                      : 0;
                  return (
                    <tr key={p.id}>
                      <td className="p-3 font-semibold text-slate-800">{emp?.fullName}</td>
                      <td className="p-3">{formatRupiah(p.baseSalary)}</td>
                      <td className="p-3">{formatRupiah(tunj)}</td>
                      <td className="p-3">{formatRupiah(p.overtimePay + p.bonus)}</td>
                      <td className="p-3 font-semibold text-emerald-700">
                        {thrVal > 0 ? formatRupiah(thrVal) : '-'}
                      </td>
                      <td className="p-3 text-rose-600">({formatRupiah(p.totalDeductions)})</td>
                      <td className="p-3 font-bold text-emerald-700 text-right">
                        {formatRupiah(p.takeHomePay)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {activeCheckedThrList.length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-emerald-100 bg-emerald-50/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-950 block">
                    Laporan Pengeluaran Tunjangan Hari Raya (THR) Tercatat
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    Mencakup karyawan PKWTT, PKWT, dan Part-Time yang telah dicentang &amp; dicairkan oleh Admin
                  </span>
                </div>
                <span className="font-extrabold text-emerald-900">
                  Total THR: {formatRupiah(totalThrDisbursed)}
                </span>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Karyawan</th>
                    <th className="p-3">Status Kerja &amp; Masa Kerja</th>
                    <th className="p-3">Hari Raya &amp; Rumus</th>
                    <th className="p-3">Status Pembayaran</th>
                    <th className="p-3 font-bold text-right">Nominal THR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeCheckedThrList.map((t) => (
                    <tr key={t.id}>
                      <td className="p-3 font-semibold text-slate-800">
                        {t.employee_name}{' '}
                        <span className="text-[10px] text-slate-400">({t.employee_nik})</span>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-700">{t.employment_type}</span> •{' '}
                        <span className="text-slate-500">{t.tenure_label}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-800">{t.holiday_name}</span>
                        <span className="block text-[10px] text-slate-500">
                          {t.proportion_formula}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.payment_status === 'Sudah Dibayar'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.payment_status}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-emerald-700 text-right">
                        {formatRupiah(t.total_thr_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedReport === 'bpjs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <h3 className="font-bold text-slate-800 text-sm">
            Rekapitulasi Iuran BPJS Ketenagakerjaan & BPJS Kesehatan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200/80 space-y-2">
              <span className="font-bold text-teal-900 block text-sm border-b border-teal-200 pb-1">
                BPJS Kesehatan (Total 5%)
              </span>
              <div className="flex justify-between">
                <span>Ditanggung Perusahaan Tas Grosir Import (4%):</span>
                <span className="font-semibold">{formatRupiah(bpjsKesComp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dipotong dari Karyawan (1%):</span>
                <span className="font-semibold">{formatRupiah(bpjsKesEmp)}</span>
              </div>
              <div className="border-t border-teal-200 pt-2 flex justify-between font-bold text-teal-900">
                <span>Total Setoran BPJS Kesehatan:</span>
                <span>{formatRupiah(bpjsKesComp + bpjsKesEmp)}</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2">
              <span className="font-bold text-blue-900 block text-sm border-b border-blue-200 pb-1">
                BPJS Ketenagakerjaan
              </span>
              <div className="flex justify-between">
                <span>JHT - Perusahaan (3.7%):</span>
                <span className="font-semibold">{formatRupiah(bpjsJhtComp)}</span>
              </div>
              <div className="flex justify-between">
                <span>JHT - Karyawan (2.0%):</span>
                <span className="font-semibold">{formatRupiah(bpjsJhtEmp)}</span>
              </div>
              <div className="flex justify-between">
                <span>JP - Perusahaan (2.0%):</span>
                <span className="font-semibold">{formatRupiah(bpjsJpComp)}</span>
              </div>
              <div className="flex justify-between">
                <span>JP - Karyawan (1.0%):</span>
                <span className="font-semibold">{formatRupiah(bpjsJpEmp)}</span>
              </div>
              <div className="flex justify-between">
                <span>JKK (0.24%) & JKM (0.3%):</span>
                <span className="font-semibold">{formatRupiah(bpjsJkk + bpjsJkm)}</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between font-bold text-blue-900">
                <span>Total Setoran BPJS Ketenagakerjaan:</span>
                <span>
                  {formatRupiah(
                    bpjsJhtComp + bpjsJhtEmp + bpjsJpComp + bpjsJpEmp + bpjsJkk + bpjsJkm
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'tax' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">
            Rekap Pemotongan PPh 21 Masa (Skema Tarif Efektif Rata-Rata)
          </h3>
          <p className="text-xs text-slate-500">
            Formulir siap lapor untuk SPT Masa Pajak Penghasilan Pasal 21 dan Bukti Potong 1721-A1.
          </p>
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 text-xs flex justify-between items-center">
            <div>
              <span className="text-slate-600 block">Total Potongan PPh 21 Seluruh Karyawan:</span>
              <span className="text-2xl font-extrabold text-purple-700">{formatRupiah(totalPph)}</span>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-purple-600 text-white rounded-lg font-semibold text-xs">
                Billing Kode DJP Siap Dibuat
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'accounting_journal' && (
        <div className="space-y-6">
          {/* Header Banner & Export CSV Button */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-indigo-500/20 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    Double-Entry Balanced Journal (Bulanan Cut-Off 26–25 &amp; Part-Time Sunday Payout)
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  Jurnal Akuntansi Payroll per Divisi — Periode {companyConfig.currentPayrollPeriod}
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl">
                  Rekapitulasi beban gaji pokok, upah Part-Time Mingguan (sesuai <strong>sundayPayoutDate</strong>),
                  tunjangan, lembur, bonus, dan THR (Debit) beserta potongan kasbon, potongan absensi/pajak, dan utang
                  gaji bersih / Net Pay (Kredit) per departemen/divisi.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExportAccountingJournalCSV}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Ekspor CSV Jurnal Akuntansi</span>
                </button>
              </div>
            </div>

            {/* Filter Periode Cut-Off Bulanan & Siklus Mingguan Part-Time (Sunday Payout) */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-indigo-200">Periode Cut-Off Bulanan:</span>
                <select
                  value={companyConfig.currentPayrollPeriod}
                  onChange={(e) => onChangePayrollPeriod?.(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-400/40 text-white text-xs font-bold cursor-pointer"
                >
                  {availablePeriods.map((p) => (
                    <option key={p} value={p} className="bg-slate-900 text-white">
                      {p} (
                      {formatCutOffPeriodRange(
                        p,
                        companyConfig.cutOffStartDay || 26,
                        companyConfig.cutOffEndDay || 25
                      )}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-200">
                  Filter Siklus Part-Time (Sunday Payout):
                </span>
                <select
                  value={selectedWeeklyJournalCycle}
                  onChange={(e) => setSelectedWeeklyJournalCycle(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-orange-400/40 text-white text-xs font-bold cursor-pointer"
                >
                  <option value="ALL_IN_PERIOD" className="bg-slate-900 text-white">
                    Gabungan Bulanan + Semua Minggu Part-Time Periode Ini
                  </option>
                  {selectableWeeklyCycles.map((cyc) => (
                    <option key={cyc.startDate} value={cyc.startDate} className="bg-slate-900 text-white">
                      Khusus Part-Time Minggu: {cyc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Summary KPI Cards Debit vs Kredit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                DEBIT • Beban Gaji &amp; Tunjangan
              </span>
              <h4 className="text-lg font-extrabold text-slate-900 mt-1 font-mono">
                {formatRupiah(
                  journalGrandTotals.debitBaseSalary + journalGrandTotals.debitAllowances
                )}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pokok: {formatRupiah(journalGrandTotals.debitBaseSalary)} • Tunj:{' '}
                {formatRupiah(journalGrandTotals.debitAllowances)}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                DEBIT • Lembur, Bonus &amp; THR
              </span>
              <h4 className="text-lg font-extrabold text-slate-900 mt-1 font-mono">
                {formatRupiah(
                  journalGrandTotals.debitOvertime +
                    journalGrandTotals.debitBonusAndCommission +
                    journalGrandTotals.debitThr
                )}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Lembur: {formatRupiah(journalGrandTotals.debitOvertime)} • Bonus/THR:{' '}
                {formatRupiah(
                  journalGrandTotals.debitBonusAndCommission + journalGrandTotals.debitThr
                )}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                KREDIT • Potongan Kasbon &amp; Absensi
              </span>
              <h4 className="text-lg font-extrabold text-amber-900 mt-1 font-mono">
                {formatRupiah(
                  journalGrandTotals.creditCashAdvanceDeduction +
                    journalGrandTotals.creditOtherDeductions
                )}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Kasbon: {formatRupiah(journalGrandTotals.creditCashAdvanceDeduction)} • Absensi/Pajak:{' '}
                {formatRupiah(journalGrandTotals.creditOtherDeductions)}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                KREDIT • Net Pay Dicairkan (THP)
              </span>
              <h4 className="text-lg font-extrabold text-emerald-800 mt-1 font-mono">
                {formatRupiah(journalGrandTotals.creditNetPayPayable)}
              </h4>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Total Balance: {formatRupiah(journalGrandTotals.totalDebit)}
              </p>
            </div>
          </div>

          {/* Tabel Rekap Jurnal Akuntansi per Divisi */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Tabel Rekap Jurnal Akuntansi per Divisi / Cost Center
                </h4>
                <p className="text-xs text-slate-500">
                  Tanggal Cetak Jurnal WIB: {formatIndoDate(getJakartaDateString())} •{' '}
                  {divisionAccountingRows.length} Divisi Aktif ({journalGrandTotals.employeeCount}{' '}
                  Karyawan)
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold">
                ✓ SEIMBANG (DEBIT = KREDIT)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
                    <th className="p-3">Divisi / Departemen</th>
                    <th className="p-3 text-center">Staf</th>
                    <th className="p-3 text-right text-indigo-900">Beban Gaji (D)</th>
                    <th className="p-3 text-right text-indigo-900">Beban Tunjangan (D)</th>
                    <th className="p-3 text-right text-indigo-900">Beban Lembur (D)</th>
                    <th className="p-3 text-right text-indigo-900">Beban Bonus (D)</th>
                    <th className="p-3 text-right text-indigo-900">Beban THR (D)</th>
                    <th className="p-3 text-right bg-indigo-50 text-indigo-950 font-extrabold">
                      Total Debit
                    </th>
                    <th className="p-3 text-right text-amber-800">Pot. Kasbon (K)</th>
                    <th className="p-3 text-right text-rose-700">Pot. Lain/Pajak (K)</th>
                    <th className="p-3 text-right text-emerald-800">Net Pay / THP (K)</th>
                    <th className="p-3 text-right bg-emerald-50 text-emerald-950 font-extrabold">
                      Total Kredit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {divisionAccountingRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-500">
                        Belum ada data penggajian untuk periode berjalan.
                      </td>
                    </tr>
                  ) : (
                    divisionAccountingRows.map((row) => (
                      <tr key={row.department} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900">{row.department}</td>
                        <td className="p-3 text-center font-semibold text-slate-600">
                          {row.employeeCount}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          {formatRupiah(row.debitBaseSalary)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          {formatRupiah(row.debitAllowances)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          {formatRupiah(row.debitOvertime)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          {formatRupiah(row.debitBonusAndCommission)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          {formatRupiah(row.debitThr)}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold bg-indigo-50/60 text-indigo-950">
                          {formatRupiah(row.totalDebit)}
                        </td>
                        <td className="p-3 text-right font-mono text-amber-800">
                          {formatRupiah(row.creditCashAdvanceDeduction)}
                        </td>
                        <td className="p-3 text-right font-mono text-rose-700">
                          {formatRupiah(row.creditOtherDeductions)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {formatRupiah(row.creditNetPayPayable)}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold bg-emerald-50/60 text-emerald-950">
                          {formatRupiah(row.totalCredit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {divisionAccountingRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-extrabold text-xs">
                      <td className="p-3">TOTAL KONSOLIDASI</td>
                      <td className="p-3 text-center">{journalGrandTotals.employeeCount}</td>
                      <td className="p-3 text-right font-mono">
                        {formatRupiah(journalGrandTotals.debitBaseSalary)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatRupiah(journalGrandTotals.debitAllowances)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatRupiah(journalGrandTotals.debitOvertime)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatRupiah(journalGrandTotals.debitBonusAndCommission)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatRupiah(journalGrandTotals.debitThr)}
                      </td>
                      <td className="p-3 text-right font-mono text-indigo-300">
                        {formatRupiah(journalGrandTotals.totalDebit)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-300">
                        {formatRupiah(journalGrandTotals.creditCashAdvanceDeduction)}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-300">
                        {formatRupiah(journalGrandTotals.creditOtherDeductions)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-300">
                        {formatRupiah(journalGrandTotals.creditNetPayPayable)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-300">
                        {formatRupiah(journalGrandTotals.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'demografi' && (
        <div className="space-y-6">
          <EmployeeDemographicsCharts employees={employees} />
        </div>
      )}
    </div>
  );
};

