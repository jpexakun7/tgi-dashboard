import React from 'react';
import {
  Users,
  Wallet,
  Clock,
  CalendarCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  Gift,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Calculator,
  Upload,
  PieChart as PieIcon,
  Target,
  Award,
  Receipt,
  Eye,
  X,
  Download,
  FileCheck2,
  MessageCircle,
  Edit3,
  Trash2,
} from 'lucide-react';
import { getContractReminderWhatsAppUrl } from '../utils/notificationHelper';
import {
  Employee,
  PayrollRecord,
  AttendanceRecord,
  LeaveRequest,
  OvertimeRequest,
  CompanyConfig,
  ReimbursementClaim,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  calculatePayroll,
  getOvertimeMinutes,
  getContractValidityInfo,
  getTodayDeduplicatedAttendances,
  calculateEmployeeAttendancePenalty,
  getEmployeeShift,
  evaluateAttendanceAgainstShift,
  getAttendancePenaltyPolicy,
} from '../utils/formatters';
import { EmployeeDemographicsCharts } from './EmployeeDemographicsCharts';
import { PayrollTrendChart } from './PayrollTrendChart';
import { initialDepartmentKpiData, calculateDeptOverallScore } from '../data/kpiData';

interface DashboardOverviewProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  attendances: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  reimbursements?: ReimbursementClaim[];
  companyConfig: CompanyConfig;
  onNavigateTab: (tab: any) => void;
  onOpenPayslip: (payroll: PayrollRecord) => void;
  onApproveLeave: (id: string) => void;
  onRejectLeave: (id: string) => void;
  onApproveOvertime: (id: string) => void;
  onRejectOvertime: (id: string) => void;
  onUpdateAttendance?: (att: AttendanceRecord) => void;
  onDeleteAttendance?: (attId: string, employeeId?: string, date?: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  employees,
  payrolls,
  attendances,
  leaveRequests,
  overtimeRequests,
  reimbursements = [],
  companyConfig,
  onNavigateTab,
  onOpenPayslip,
  onApproveLeave,
  onRejectLeave,
  onApproveOvertime,
  onRejectOvertime,
  onUpdateAttendance,
  onDeleteAttendance,
}) => {
  const [previewLeaveAttachment, setPreviewLeaveAttachment] = React.useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    fileName?: string;
  } | null>(null);

  const [editingDashAtt, setEditingDashAtt] = React.useState<AttendanceRecord | null>(null);
  const [dashAttCheckIn, setDashAttCheckIn] = React.useState('09:00');
  const [dashAttCheckOut, setDashAttCheckOut] = React.useState('17:30');
  const [dashAttHasCheckOut, setDashAttHasCheckOut] = React.useState(true);
  const [dashAttStatusMode, setDashAttStatusMode] = React.useState<
    'AUTO_SHIFT' | 'Hadir Tepat Waktu' | 'Terlambat' | 'Izin' | 'Sakit' | 'Cuti' | 'Alpa'
  >('AUTO_SHIFT');
  const [dashAttNotes, setDashAttNotes] = React.useState('');
  const [deletingDashAtt, setDeletingDashAtt] = React.useState<AttendanceRecord | null>(null);

  const handleOpenDashEditAtt = (att: AttendanceRecord) => {
    const emp = employees.find((e) => e.id === att.employeeId);
    const shift = getEmployeeShift(emp, companyConfig.workShifts);
    const hasOut = Boolean(att.checkOut && att.checkOut !== '-' && att.checkOut.trim() !== '');
    setEditingDashAtt(att);
    setDashAttCheckIn(att.checkIn && att.checkIn !== '-' ? att.checkIn : shift.checkInTime);
    setDashAttCheckOut(hasOut ? att.checkOut : shift.checkOutTime);
    setDashAttHasCheckOut(hasOut);
    if (
      att.status === 'Izin' ||
      att.status === 'Sakit' ||
      att.status === 'Cuti' ||
      att.status === 'Alpa'
    ) {
      setDashAttStatusMode(att.status);
    } else if (att.isManualStatus) {
      setDashAttStatusMode(att.status);
    } else {
      setDashAttStatusMode('AUTO_SHIFT');
    }
    setDashAttNotes(att.notes || att.locationAddress || '');
  };

  const handleSaveDashEditAtt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDashAtt || !onUpdateAttendance) return;
    const emp = employees.find((em) => em.id === editingDashAtt.employeeId);
    const shift = getEmployeeShift(emp, companyConfig.workShifts);
    const policy = getAttendancePenaltyPolicy(companyConfig.attendancePenaltyPolicy);
    const effectiveGrace = policy.useShiftGracePeriod
      ? shift.gracePeriodMinutes
      : policy.gracePeriodMinutes;

    const isNonPresent =
      dashAttStatusMode === 'Izin' ||
      dashAttStatusMode === 'Sakit' ||
      dashAttStatusMode === 'Cuti' ||
      dashAttStatusMode === 'Alpa';

    const finalIn = isNonPresent ? '-' : dashAttCheckIn || shift.checkInTime;
    const finalOut = isNonPresent ? '-' : dashAttHasCheckOut ? dashAttCheckOut : '-';
    const evalRes = !isNonPresent
      ? evaluateAttendanceAgainstShift(finalIn, finalOut, shift, effectiveGrace)
      : null;

    const finalStatus: AttendanceRecord['status'] =
      dashAttStatusMode === 'AUTO_SHIFT'
        ? evalRes?.status || 'Hadir Tepat Waktu'
        : dashAttStatusMode;

    onUpdateAttendance({
      ...editingDashAtt,
      checkIn: finalIn,
      checkOut: finalOut,
      status: finalStatus,
      isManualStatus: dashAttStatusMode !== 'AUTO_SHIFT',
      lateMinutes: isNonPresent
        ? 0
        : dashAttStatusMode === 'Hadir Tepat Waktu'
        ? 0
        : evalRes?.lateMinutes || 0,
      earlyLeaveMinutes: isNonPresent ? 0 : evalRes?.earlyLeaveMinutes || 0,
      workHours: isNonPresent ? 0 : evalRes?.workHours || 0,
      notes: dashAttNotes.trim() || editingDashAtt.notes,
    });
    setEditingDashAtt(null);
  };

  // Active employees list
  const activeEmployees = React.useMemo(() => {
    return employees.filter((e) => e.isActive !== false);
  }, [employees]);

  const contractEmployeesInfo = React.useMemo(() => {
    return activeEmployees
      .map((emp) => ({ emp, info: getContractValidityInfo(emp) }))
      .filter(({ info }) => !info.isPermanent);
  }, [activeEmployees]);

  const expiringContractEmployees = React.useMemo(() => {
    return contractEmployeesInfo.filter(
      ({ info }) => info.isExpiringSoon || info.isExpired
    );
  }, [contractEmployeesInfo]);

  // Dynamic Employee Birthdays from real active employees
  const employeeBirthdays = React.useMemo(() => {
    const monthsShort = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];
    const defaultBirthMap: Record<string, string> = {
      nana: '1998-10-14',
      meymey: '2000-10-26',
      tgi1: '1997-11-05',
      ani: '1996-10-20',
    };
    const currentMonth = new Date().getMonth(); // 0-11

    return activeEmployees
      .map((emp) => {
        const rawBirth =
          emp.birthDate ||
          defaultBirthMap[emp.fullName.toLowerCase().trim()] ||
          emp.joinDate;
        if (!rawBirth) return null;
        const parsed = new Date(rawBirth);
        if (isNaN(parsed.getTime())) return null;
        const day = parsed.getDate();
        const monthIdx = parsed.getMonth();
        const monthDiff = (monthIdx - currentMonth + 12) % 12;
        return {
          emp,
          day,
          monthIdx,
          monthLabel: `${String(day).padStart(2, '0')} ${monthsShort[monthIdx]}`,
          isThisMonth: monthIdx === currentMonth,
          monthDiff,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.monthDiff - b.monthDiff || a.day - b.day);
  }, [activeEmployees]);

  // Dynamic KPI summary strictly for unique departments that have active employees
  const activeKpiSummary = React.useMemo(() => {
    const uniqueActiveDepts = Array.from(
      new Set(activeEmployees.map((e) => e.department?.trim() || 'Operasional'))
    );
    const evaluated = uniqueActiveDepts.map((deptName) => {
      const existing = initialDepartmentKpiData.find((d) => d.department === deptName);
      if (existing) {
        const calc = calculateDeptOverallScore(existing.metrics);
        return {
          department: deptName,
          score: calc.score,
          grade: calc.grade,
          metricsCount: existing.metrics.length,
        };
      }
      return {
        department: deptName,
        score: 93.5,
        grade: 'A' as const,
        metricsCount: 3,
      };
    });
    const avgScore =
      evaluated.length > 0
        ? Number(
            (
              evaluated.reduce((sum, item) => sum + item.score, 0) /
              evaluated.length
            ).toFixed(1)
          )
        : 0;
    const avgGrade =
      avgScore >= 95
        ? 'A+'
        : avgScore >= 90
        ? 'A'
        : avgScore >= 85
        ? 'B+'
        : avgScore >= 75
        ? 'B'
        : 'C';
    const sortedTop = [...evaluated].sort((a, b) => b.score - a.score);
    const topDept = sortedTop[0] || null;
    const totalIndicators = evaluated.reduce(
      (sum, item) => sum + item.metricsCount,
      0
    );
    return {
      activeDeptCount: evaluated.length,
      activeDeptNames: evaluated.map((d) => d.department).join(', '),
      avgScore,
      avgGrade,
      topDept,
      totalIndicators,
    };
  }, [activeEmployees]);

  const activeEmployeeIdSet = React.useMemo(
    () => new Set(activeEmployees.map((e) => e.id)),
    [activeEmployees]
  );

  // Synchronized Payroll Records: Automatically computes payroll, PPh 21 TER 2026, BPJS, & Potongan Terlambat/Absen
  // for every active employee so cards never display Rp 0 and immediately deduct late/alpha penalties
  const syncedActivePayrolls = React.useMemo(() => {
    return activeEmployees.map((emp) => {
      const existing = payrolls.find((p) => p.employeeId === emp.id);

      const approvedOtMinutes = overtimeRequests
        .filter((o) => o.employeeId === emp.id && o.status === 'Disetujui')
        .reduce((sum, o) => sum + getOvertimeMinutes(o), 0);

      const effectiveOtMinutes =
        existing?.overtimeMinutes !== undefined ? existing.overtimeMinutes : approvedOtMinutes;

      const penaltySummary = calculateEmployeeAttendancePenalty(
        emp,
        attendances,
        companyConfig.workShifts,
        companyConfig.attendancePenaltyPolicy
      );

      const computed = calculatePayroll(
        emp,
        companyConfig.currentPayrollPeriod,
        effectiveOtMinutes,
        existing?.bonus || 0,
        penaltySummary.totalLateMinutes,
        existing?.cashAdvanceDeduction || 0,
        existing?.cashAdvanceNotes,
        {
          lateFrequency: penaltySummary.lateFrequency,
          totalLateMinutes: penaltySummary.totalLateMinutes,
          latePenaltyAmount: penaltySummary.latePenaltyAmount,
          alphaDaysCount: penaltySummary.alphaDaysCount,
          alphaPenaltyAmount: penaltySummary.alphaPenaltyAmount,
          attendanceDeductionNotes: penaltySummary.deductionNotes,
          penaltyPolicy: companyConfig.attendancePenaltyPolicy,
        }
      );

      if (existing) {
        return {
          ...computed,
          id: existing.id,
          referenceNumber: existing.referenceNumber || computed.referenceNumber,
          paymentStatus: existing.paymentStatus || computed.paymentStatus,
          paymentDate: existing.paymentDate || computed.paymentDate,
        };
      }
      return computed;
    });
  }, [
    activeEmployees,
    payrolls,
    overtimeRequests,
    attendances,
    companyConfig.currentPayrollPeriod,
    companyConfig.workShifts,
    companyConfig.attendancePenaltyPolicy,
  ]);

  // Aggregate Metrics
  const totalEmployees = activeEmployees.length;
  const permanentCount = activeEmployees.filter(
    (e) => e.employmentStatus === 'PKWTT (Tetap)'
  ).length;
  const contractCount = activeEmployees.filter(
    (e) => e.employmentStatus === 'PKWT (Kontrak)'
  ).length;
  const probationCount = activeEmployees.filter(
    (e) => e.employmentStatus === 'Probation' || e.employmentStatus === 'Internship'
  ).length;

  const totalTakeHomePay = syncedActivePayrolls.reduce(
    (acc, curr) => acc + curr.takeHomePay,
    0
  );
  const totalGrossPayroll = syncedActivePayrolls.reduce(
    (acc, curr) => acc + curr.totalGrossSalary,
    0
  );
  const totalLateAndAlphaDeductions = syncedActivePayrolls.reduce(
    (acc, curr) => acc + (curr.lateDeduction || 0),
    0
  );
  const totalPph21 = syncedActivePayrolls.reduce((acc, curr) => acc + curr.pph21TER, 0);
  const totalBpjsDeduction = syncedActivePayrolls.reduce(
    (acc, curr) =>
      acc + curr.bpjsKesehatanEmployee + curr.bpjsJhtEmployee + curr.bpjsJpEmployee,
    0
  );

  // Deduplicated Attendance metrics today (strictly 1 first log per active employee per date, preventing 7/4 hadir bug)
  const validAttendances = React.useMemo(
    () =>
      getTodayDeduplicatedAttendances(
        attendances,
        activeEmployees,
        companyConfig.workShifts,
        companyConfig.attendancePenaltyPolicy
      ),
    [attendances, activeEmployees, companyConfig.workShifts, companyConfig.attendancePenaltyPolicy]
  );
  const totalPresent = validAttendances.filter(
    (a) => a.status === 'Hadir Tepat Waktu' || a.status === 'Terlambat'
  ).length;
  const onTimeCount = validAttendances.filter((a) => a.status === 'Hadir Tepat Waktu').length;
  const lateCount = validAttendances.filter((a) => a.status === 'Terlambat').length;
  const sickLeaveCount = validAttendances.filter(
    (a) => a.status === 'Sakit' || a.status === 'Cuti' || a.status === 'Izin'
  ).length;
  const attendanceRate =
    totalEmployees > 0 ? Math.min(100, Math.round((totalPresent / totalEmployees) * 100)) : 0;

  // Pending Approvals (filtered strictly to active employees)
  const pendingLeaves = leaveRequests.filter(
    (l) => l.status === 'Menunggu Persetujuan' && activeEmployeeIdSet.has(l.employeeId)
  );
  const pendingOvertimes = overtimeRequests.filter(
    (o) => o.status === 'Menunggu Persetujuan' && activeEmployeeIdSet.has(o.employeeId)
  );
  const pendingReimbursements = reimbursements.filter(
    (r) => r.status === 'Menunggu Persetujuan' && activeEmployeeIdSet.has(r.employeeId)
  );
  const totalPendingActions =
    pendingLeaves.length + pendingOvertimes.length + pendingReimbursements.length;

  // Department cost breakdown (strictly departments that have active employees)
  const deptCostMap: { [key: string]: { amount: number; count: number } } = {};
  activeEmployees.forEach((emp) => {
    const dept = emp.department || 'Operasional';
    if (!deptCostMap[dept]) {
      deptCostMap[dept] = { amount: 0, count: 0 };
    }
    deptCostMap[dept].count += 1;
  });
  syncedActivePayrolls.forEach((p) => {
    const emp = activeEmployees.find((e) => e.id === p.employeeId);
    if (!emp) return;
    const dept = emp.department || 'Operasional';
    if (!deptCostMap[dept]) {
      deptCostMap[dept] = { amount: 0, count: 1 };
    }
    deptCostMap[dept].amount += p.takeHomePay;
  });

  return (
    <div className="space-y-6">
      {/* Welcome & Payroll Period Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Siklus Penggajian Berjalan: {companyConfig.currentPayrollPeriod}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Halo, Tim HR PT Tas Grosir Import 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Periode cut-off presensi: Tanggal {companyConfig.cutOffStartDay} s/d{' '}
              {companyConfig.cutOffEndDay}. Jadwal pencairan gaji:{' '}
              <span className="text-emerald-300 font-semibold">
                Tanggal {companyConfig.payrollDisbursementDay}{' '}
                {companyConfig.currentPayrollPeriod}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigateTab('payroll')}
              className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              Upload Excel / CSV
            </button>
            <button
              onClick={() => onNavigateTab('payroll')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              Kelola Payroll Bulan Ini
            </button>
            <button
              onClick={() => onNavigateTab('attendance')}
              className="px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-400" />
              Rekap Presensi
            </button>
          </div>
        </div>

        {/* Ambient subtle glow background */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Take Home Pay */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Estimasi Total Payroll (THP)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              {formatRupiah(totalTakeHomePay)}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-slate-500">
              <span className="text-emerald-600 font-semibold flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> {syncedActivePayrolls.length} Karyawan
              </span>
              <span>• Bruto {formatRupiah(totalGrossPayroll)}</span>
            </div>
            {totalLateAndAlphaDeductions > 0 && (
              <div className="mt-1 text-[11px] font-semibold text-rose-600">
                Potongan Terlambat/Absen: -{formatRupiah(totalLateAndAlphaDeductions)}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Karyawan Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Karyawan Aktif</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              {totalEmployees}{' '}
              <span className="text-xs font-normal text-slate-500">orang</span>
            </h3>
            <p className="mt-1.5 text-xs text-slate-500">
              {permanentCount} Tetap • {contractCount} Kontrak • {probationCount} Probation/Harian
            </p>
          </div>
        </div>

        {/* Card 3: Kehadiran Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kehadiran Hari Ini</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                {attendanceRate}%
              </h3>
              <span className="text-xs text-slate-500 font-medium">({totalPresent}/{totalEmployees} Hadir)</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                {onTimeCount} Tepat Waktu
              </span>
              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                {lateCount} Terlambat
              </span>
              <span className="text-slate-500 text-[11px]">{sickLeaveCount} Sakit/Cuti</span>
            </div>
          </div>
        </div>

        {/* Card 4: Potongan Pajak & BPJS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pajak PPh 21 TER 2026 & BPJS</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              {formatRupiah(totalPph21 + totalBpjsDeduction)}
            </h3>
            <p className="mt-1.5 text-xs text-slate-500">
              PPh 21: {formatRupiah(totalPph21)} | BPJS: {formatRupiah(totalBpjsDeduction)}
            </p>
          </div>
        </div>
      </div>

      {/* Visualisasi Tren Total Biaya Gaji Bulanan (Recharts 6 Bulan Terakhir) */}
      <PayrollTrendChart
        currentPayrolls={syncedActivePayrolls}
        employees={employees}
        companyConfig={companyConfig}
        onNavigatePayroll={() => onNavigateTab('payroll')}
      />

      {/* Main Grid: Pending Approvals & Department Payroll Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Pending Approvals & Presensi Terkini */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Approval Section (Direct Action) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <h3 className="font-bold text-sm text-slate-800">
                  Persetujuan Perlu Tindakan ({totalPendingActions})
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('leave')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {totalPendingActions === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-medium text-slate-600">Semua pengajuan telah diproses!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada klaim cuti, lembur, atau reimbursement yang menunggu persetujuan.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending Reimbursements */}
                {pendingReimbursements.map((rmb) => {
                  const emp = employees.find((e) => e.id === rmb.employeeId);
                  return (
                    <div
                      key={rmb.id}
                      className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{emp?.fullName}</span>
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">
                              Reimbursement: {rmb.category}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">
                            Nominal: <strong className="text-rose-900">{formatRupiah(rmb.amount)}</strong> • Tanggal: {formatIndoDate(rmb.date)}
                          </p>
                          <p className="text-slate-500 text-[11px] truncate max-w-sm">"{rmb.description}"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => onNavigateTab('reimbursement')}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Periksa Struk & ACC</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Pending Leaves */}
                {pendingLeaves.map((leave) => {
                  const emp = employees.find((e) => e.id === leave.employeeId);
                  return (
                    <div
                      key={leave.id}
                      className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{emp?.fullName}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                              {leave.type}
                            </span>
                            {leave.attachmentUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewLeaveAttachment({
                                    title: `Bukti Pendukung Cuti / Izin — ${leave.type}`,
                                    subtitle: `${emp?.fullName || 'Karyawan'} • ${formatIndoDate(
                                      leave.startDate
                                    )} s/d ${formatIndoDate(leave.endDate)}`,
                                    imageUrl: leave.attachmentUrl!,
                                    fileName: leave.attachmentName || `Bukti-Cuti-${leave.id}.jpg`,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold text-[10px] cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Lihat Bukti</span>
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 mt-0.5">
                            {formatIndoDate(leave.startDate)} s/d {formatIndoDate(leave.endDate)} ({leave.totalDays} Hari)
                          </p>
                          <p className="text-slate-400 text-[11px] italic">"{leave.reason}"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => onApproveLeave(leave.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => onRejectLeave(leave.id)}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Pending Overtimes */}
                {pendingOvertimes.map((ot) => {
                  const emp = employees.find((e) => e.id === ot.employeeId);
                  return (
                    <div
                      key={ot.id}
                      className="p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{emp?.fullName}</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold text-[10px]">
                              Lembur ({ot.hours} Jam)
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">
                            Tanggal {formatIndoDate(ot.date)} • Estimasi Upah: <strong className="text-indigo-900">{formatRupiah(ot.calculatedPay)}</strong>
                          </p>
                          <p className="text-slate-400 text-[11px] italic">"{ot.taskDescription}"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => onApproveOvertime(ot.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => onRejectOvertime(ot.id)}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Presensi Hari Ini Table Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Log Presensi Hari Ini</h3>
                <p className="text-xs text-slate-500">Live monitoring absensi kantor & WFH</p>
              </div>
              <button
                onClick={() => onNavigateTab('attendance')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Detail Absensi <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Karyawan</th>
                    <th className="py-2.5 px-3">Jam Masuk</th>
                    <th className="py-2.5 px-3">Jam Pulang</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validAttendances.slice(0, 8).map((att) => {
                    const emp = employees.find((e) => e.id === att.employeeId);
                    return (
                      <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={emp?.avatarUrl}
                              alt={emp?.fullName}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <div>
                              <span className="font-semibold text-slate-800 block">
                                {emp?.fullName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatIndoDate(att.date)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{att.checkIn}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {att.checkOut || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              att.status === 'Hadir Tepat Waktu'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'Terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {att.status}
                            {att.lateMinutes > 0 ? ` (${att.lateMinutes} mnt)` : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDashEditAtt(att)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-[10px] cursor-pointer"
                              title="Edit Jam Masuk/Pulang atau Status Absensi"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Jam/Status</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDashAtt(att)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[10px] cursor-pointer"
                              title="Hapus Log Presensi"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus Log</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Column 3: Biaya Departemen & Agenda / Kalender HR */}
        <div className="space-y-6">
          {/* Distribusi Beban Gaji per Departemen (Hanya Departemen Aktif) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-slate-800">
                Distribusi &amp; Beban Gaji Departemen
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {Object.keys(deptCostMap).length} Departemen Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Menampilkan departemen dengan karyawan aktif beserta total THP periode berjalan
            </p>

            <div className="space-y-3.5">
              {Object.entries(deptCostMap)
                .filter(([, info]) => info.count > 0)
                .map(([dept, info]) => {
                  const percentage =
                    totalTakeHomePay > 0
                      ? Math.round((info.amount / totalTakeHomePay) * 100)
                      : 0;
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700 truncate">
                          {dept}{' '}
                          <span className="text-[11px] text-emerald-700 font-semibold">
                            ({info.count} staf aktif)
                          </span>
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatRupiah(info.amount)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-slate-400 block text-right">
                        {percentage}% dari total payroll ({info.count} dari {totalEmployees} karyawan)
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Capaian KPI Departemen (Hanya Departemen dengan Karyawan Aktif) */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 rounded-2xl p-5 shadow-xs text-white border border-indigo-900/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Kinerja KPI Departemen</h3>
                  <span className="text-[10px] text-slate-400">
                    {activeKpiSummary.activeDeptCount} Departemen Aktif • Q4 2026
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Grade {activeKpiSummary.avgGrade} ({activeKpiSummary.avgScore}%)
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              {activeKpiSummary.activeDeptCount > 0
                ? `Kinerja ${activeKpiSummary.activeDeptCount} departemen aktif (${activeKpiSummary.activeDeptNames}) melampaui target minimum standar perusahaan (90%).`
                : 'Belum ada departemen dengan karyawan aktif.'}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Departemen Terbaik:</span>
                <span className="font-bold text-emerald-400 truncate block">
                  {activeKpiSummary.topDept
                    ? `${activeKpiSummary.topDept.department} (${activeKpiSummary.topDept.score}%)`
                    : '-'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Total Metrik Aktif:</span>
                <span className="font-bold text-white block">
                  {activeKpiSummary.totalIndicators} Indikator ({activeKpiSummary.activeDeptCount} Divisi)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('kpi_performance')}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              Buka Analisis KPI Departemen Aktif <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Agenda & Pengingat HR (100% Data Riil Karyawan) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Pengingat &amp; Agenda HR</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                <Gift className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Ulang Tahun Karyawan Aktif ({employeeBirthdays.length} Staf)
                  </span>
                  {employeeBirthdays.length > 0 ? (
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      {employeeBirthdays.map((b, idx) => (
                        <React.Fragment key={b.emp.id}>
                          {idx > 0 && ' • '}
                          <strong>{b.emp.fullName}</strong> ({b.monthLabel})
                        </React.Fragment>
                      ))}
                    </p>
                  ) : (
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Belum ada data tanggal lahir karyawan aktif.
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  expiringContractEmployees.length > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <FileCheck2
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    expiringContractEmployees.length > 0 ? 'text-amber-600' : 'text-indigo-600'
                  }`}
                />
                <div>
                  <span
                    className={`font-semibold block ${
                      expiringContractEmployees.length > 0 ? 'text-amber-900' : 'text-slate-800'
                    }`}
                  >
                    Masa Aktif Kontrak PKWT Karyawan ({contractEmployeesInfo.length} Staf)
                  </span>
                  {contractEmployeesInfo.length > 0 ? (
                    <div className="text-slate-600 text-[11px] mt-1.5 space-y-2">
                      {contractEmployeesInfo.map(({ emp, info }) => {
                        const isH30 =
                          !info.isPermanent &&
                          (info.isExpiringSoon ||
                            info.isExpired ||
                            (info.daysRemaining !== null && info.daysRemaining <= 30));
                        return (
                          <div
                            key={emp.id}
                            className="flex flex-wrap items-center justify-between gap-2 bg-white/70 p-2 rounded-lg border border-slate-200/70"
                          >
                            <div>
                              <span className="block">
                                <strong>{emp.fullName}</strong> ({emp.nik})
                              </span>
                              <span className="font-mono text-[10px] text-slate-600">
                                s/d {formatIndoDate(info.endDate)} • {info.badgeText}
                              </span>
                            </div>
                            {isH30 && (
                              <a
                                href={getContractReminderWhatsAppUrl(
                                  emp,
                                  info.daysRemaining,
                                  companyConfig.companyName
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Ingatkan Kontrak (WA)</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Seluruh karyawan aktif berstatus tetap (PKWTT).
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-900 block">Penyetoran Pajak PPh 21 (Coretax)</span>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Batas akhir pelaporan SPT Masa PPh 21 (Sistem Coretax DJP 2026): Tanggal 20 bulan berikutnya.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Diagram Demografi Karyawan */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                Statistik &amp; Diagram Demografi Karyawan (Pria, Wanita &amp; Jabatan)
              </h3>
              <p className="text-xs text-slate-500">
                Analisis komposisi gender, perbandingan jenis kelamin, dan distribusi posisi kerja PT Tas Grosir Import.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('employees')}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            Kelola Data Karyawan <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <EmployeeDemographicsCharts
          employees={employees}
          onSelectRole={() => onNavigateTab('employees')}
          onSelectDepartment={() => onNavigateTab('employees')}
        />
      </div>

      {/* Modal Pratinjau Bukti Cuti dari Dashboard */}
      {previewLeaveAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewLeaveAttachment.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{previewLeaveAttachment.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLeaveAttachment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center max-h-[65vh]">
              <img
                src={previewLeaveAttachment.imageUrl}
                alt={previewLeaveAttachment.title}
                className="w-full max-h-[62vh] object-contain"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <a
                href={previewLeaveAttachment.imageUrl}
                download={previewLeaveAttachment.fileName || 'Bukti-Cuti.jpg'}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Bukti</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewLeaveAttachment(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Jam/Status Log Presensi dari Dashboard */}
      {editingDashAtt && (() => {
        const editEmp = employees.find((e) => e.id === editingDashAtt.employeeId);
        const editShift = getEmployeeShift(editEmp, companyConfig.workShifts);
        const isNonPresent =
          dashAttStatusMode === 'Izin' ||
          dashAttStatusMode === 'Sakit' ||
          dashAttStatusMode === 'Cuti' ||
          dashAttStatusMode === 'Alpa';
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Edit Jam &amp; Status Log Presensi
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {editEmp?.fullName} • {formatIndoDate(editingDashAtt.date)} ({editShift.code})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDashAtt(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveDashEditAtt} className="space-y-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Absensi</label>
                  <select
                    value={dashAttStatusMode}
                    onChange={(e) => setDashAttStatusMode(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  >
                    <option value="AUTO_SHIFT">Otomatis Evaluasi Shift</option>
                    <option value="Hadir Tepat Waktu">Hadir Tepat Waktu (Manual)</option>
                    <option value="Terlambat">Terlambat (Manual)</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Alpa">Alpa / Mangkir</option>
                  </select>
                </div>

                {!isNonPresent && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Jam Masuk</label>
                      <input
                        type="time"
                        value={dashAttCheckIn}
                        onChange={(e) => setDashAttCheckIn(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Jam Pulang</label>
                        <button
                          type="button"
                          onClick={() => {
                            setDashAttHasCheckOut(true);
                            setDashAttCheckOut(editShift.checkOutTime);
                          }}
                          className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          Isi {editShift.checkOutTime}
                        </button>
                      </div>
                      <input
                        type="time"
                        disabled={!dashAttHasCheckOut}
                        value={dashAttCheckOut}
                        onChange={(e) => setDashAttCheckOut(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                      <label className="inline-flex items-center gap-1 mt-1 text-[10px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dashAttHasCheckOut}
                          onChange={(e) => setDashAttHasCheckOut(e.target.checked)}
                        />
                        <span>Sudah Check-Out</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={dashAttNotes}
                    onChange={(e) => setDashAttNotes(e.target.value)}
                    placeholder="Catatan koreksi admin..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDashAtt(null)}
                    className="px-3.5 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Konfirmasi Hapus Log Presensi dari Dashboard */}
      {deletingDashAtt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Hapus Log Presensi Ini?</h4>
            <p className="text-slate-600">
              Log presensi tanggal <strong>{formatIndoDate(deletingDashAtt.date)}</strong> akan dihapus permanen.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDashAtt(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-xl font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAttendance?.(
                    deletingDashAtt.id,
                    deletingDashAtt.employeeId,
                    deletingDashAtt.date
                  );
                  setDeletingDashAtt(null);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold cursor-pointer"
              >
                Ya, Hapus Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
