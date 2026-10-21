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
import { Employee, PayrollRecord, CompanyConfig } from '../types';
import { formatRupiah } from '../utils/formatters';
import { EmployeeDemographicsCharts } from './EmployeeDemographicsCharts';

interface ReportsViewProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  companyConfig: CompanyConfig;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  employees,
  payrolls,
  companyConfig,
}) => {
  const [selectedReport, setSelectedReport] = useState<'payroll' | 'bpjs' | 'tax' | 'demografi'>('payroll');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');

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
      return [
        p.referenceNumber,
        `"${emp?.fullName || ''}"`,
        `"${emp?.department || ''}"`,
        p.baseSalary,
        tunj,
        p.overtimePay,
        p.bonus,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            Laporan & Rekapitulasi Penggajian
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analitik komprehensif biaya gaji tahun berjalan, rekonsiliasi iuran BPJS, dan formulir pajak.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="flex bg-slate-100 p-1 rounded-xl max-w-xl text-xs font-semibold overflow-x-auto">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500">Gaji Bersih Dicarikan (THP)</span>
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
                  return (
                    <tr key={p.id}>
                      <td className="p-3 font-semibold text-slate-800">{emp?.fullName}</td>
                      <td className="p-3">{formatRupiah(p.baseSalary)}</td>
                      <td className="p-3">{formatRupiah(tunj)}</td>
                      <td className="p-3">{formatRupiah(p.overtimePay + p.bonus)}</td>
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
                <span>Ditanggung Perusahaan PT Tas Grosir Import (4%):</span>
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

      {selectedReport === 'demografi' && (
        <div className="space-y-6">
          <EmployeeDemographicsCharts employees={employees} />
        </div>
      )}
    </div>
  );
};
