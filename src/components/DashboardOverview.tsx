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
} from 'lucide-react';
import {
  Employee,
  PayrollRecord,
  AttendanceRecord,
  LeaveRequest,
  OvertimeRequest,
  CompanyConfig,
  ReimbursementClaim,
} from '../types';
import { formatRupiah, formatIndoDate } from '../utils/formatters';
import { EmployeeDemographicsCharts } from './EmployeeDemographicsCharts';
import { PayrollTrendChart } from './PayrollTrendChart';

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
}) => {
  // Aggregate Metrics
  const totalEmployees = employees.filter((e) => e.isActive).length;
  const permanentCount = employees.filter((e) => e.employmentStatus === 'PKWTT (Tetap)').length;
  const contractCount = employees.filter((e) => e.employmentStatus === 'PKWT (Kontrak)').length;

  const totalTakeHomePay = payrolls.reduce((acc, curr) => acc + curr.takeHomePay, 0);
  const totalGrossPayroll = payrolls.reduce((acc, curr) => acc + curr.totalGrossSalary, 0);
  const totalPph21 = payrolls.reduce((acc, curr) => acc + curr.pph21TER, 0);
  const totalBpjsDeduction = payrolls.reduce(
    (acc, curr) => acc + curr.bpjsKesehatanEmployee + curr.bpjsJhtEmployee + curr.bpjsJpEmployee,
    0
  );

  // Attendance metrics today
  const totalPresent = attendances.filter(
    (a) => a.status === 'Hadir Tepat Waktu' || a.status === 'Terlambat'
  ).length;
  const onTimeCount = attendances.filter((a) => a.status === 'Hadir Tepat Waktu').length;
  const lateCount = attendances.filter((a) => a.status === 'Terlambat').length;
  const sickLeaveCount = attendances.filter((a) => a.status === 'Sakit' || a.status === 'Cuti').length;
  const attendanceRate = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0;

  // Pending Approvals
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'Menunggu Persetujuan');
  const pendingOvertimes = overtimeRequests.filter((o) => o.status === 'Menunggu Persetujuan');
  const pendingReimbursements = reimbursements.filter((r) => r.status === 'Menunggu Persetujuan');
  const totalPendingActions = pendingLeaves.length + pendingOvertimes.length + pendingReimbursements.length;

  // Department cost breakdown
  const deptCostMap: { [key: string]: number } = {};
  payrolls.forEach((p) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    const dept = emp ? emp.department : 'Lainnya';
    deptCostMap[dept] = (deptCostMap[dept] || 0) + p.takeHomePay;
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
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
              <span className="text-emerald-600 font-semibold flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> {payrolls.length} Karyawan
              </span>
              <span>• Total Bruto {formatRupiah(totalGrossPayroll)}</span>
            </div>
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
              {permanentCount} Tetap • {contractCount} Kontrak • 1 Probation
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
        currentPayrolls={payrolls}
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
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{emp?.fullName}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                              {leave.type}
                            </span>
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
                    <th className="py-2.5 px-3 text-right">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendances.slice(0, 5).map((att) => {
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
                            <span className="font-semibold text-slate-800">{emp?.fullName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{att.checkIn}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{att.checkOut}</td>
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
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 truncate max-w-[180px]">
                          {att.notes || '-'}
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
          {/* Distribusi Beban Gaji per Departemen */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-800 mb-1">
              Beban Gaji per Departemen
            </h3>
            <p className="text-xs text-slate-500 mb-4">Total THP periode berjalan</p>

            <div className="space-y-3.5">
              {Object.entries(deptCostMap).map(([dept, amount]) => {
                const percentage =
                  totalTakeHomePay > 0 ? Math.round((amount / totalTakeHomePay) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate">{dept}</span>
                      <span className="font-semibold text-slate-900">{formatRupiah(amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 block text-right">
                      {percentage}% dari total payroll
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capaian KPI Departemen */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 rounded-2xl p-5 shadow-xs text-white border border-indigo-900/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Kinerja KPI Departemen</h3>
                  <span className="text-[10px] text-slate-400">Kuartal IV (Q4 2026)</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Grade A (95.3%)
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Kinerja seluruh 6 departemen melampaui target minimum standar perusahaan (90%).
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Top Performer:</span>
                <span className="font-bold text-emerald-400 truncate block">Keuangan (98.2%)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Total Metrik:</span>
                <span className="font-bold text-white block">24 Indikator</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('kpi_performance')}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              Buka Analisis KPI Lengkap <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Agenda & Pengingat HR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Pengingat & Agenda HR</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                <Gift className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">Ulang Tahun Karyawan</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    <strong>Nadia Putri</strong> (12 Okt) & <strong>Fajar Nugroho</strong> (19 Okt)
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 block">Review Probation</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Fajar Nugroho (UI/UX Developer) masuk bulan ke-3 probation pada 31 Oktober 2026.
                  </p>
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
                Statistik & Diagram Demografi Karyawan (Pria, Wanita & Jabatan)
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
    </div>
  );
};
