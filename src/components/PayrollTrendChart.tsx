import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Users,
  Calendar,
  Layers,
  BarChart3,
  LineChart as LineChartIcon,
  Download,
  Info,
  ArrowUpRight,
  Sparkles,
  PieChart as PieIcon,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PayrollRecord, Employee, CompanyConfig } from '../types';
import { formatRupiah } from '../utils/formatters';

interface PayrollTrendChartProps {
  currentPayrolls: PayrollRecord[];
  employees?: Employee[];
  companyConfig?: CompanyConfig;
  onNavigatePayroll?: () => void;
}

export interface MonthlyPayrollData {
  monthKey: string;
  monthLabel: string;
  shortLabel: string;
  year: number;
  totalTHP: number;
  totalGross: number;
  baseSalary: number;
  allowanceAndOvertime: number;
  totalDeductions: number;
  employeeCount: number;
  avgTHP: number;
  notes: string;
  isCurrentMonth?: boolean;
}

export const PayrollTrendChart: React.FC<PayrollTrendChartProps> = ({
  currentPayrolls,
  employees = [],
  companyConfig,
  onNavigatePayroll,
}) => {
  // Chart visual modes
  const [viewMode, setViewMode] = useState<'area' | 'stacked_bar' | 'composed'>('area');
  const [timeRange, setTimeRange] = useState<'6m' | '3m'>('6m');
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

  // Compute live aggregates for current month (Oktober 2026)
  const currentMonthAggregates = useMemo(() => {
    const totalTHP = currentPayrolls.reduce((sum, p) => sum + p.takeHomePay, 0);
    const totalGross = currentPayrolls.reduce((sum, p) => sum + p.totalGrossSalary, 0);
    const baseSalary = currentPayrolls.reduce((sum, p) => sum + p.baseSalary, 0);
    const allowanceAndOvertime = currentPayrolls.reduce(
      (sum, p) =>
        sum +
        p.allowancePosition +
        p.allowanceTransport +
        p.allowanceMeal +
        p.allowanceCommunication +
        p.overtimePay +
        (p.bonus || 0),
      0
    );
    const totalDeductions = currentPayrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
    const activeEmployeesCount = employees.filter((e) => e.isActive !== false).length;
    const employeeCount = activeEmployeesCount > 0 ? activeEmployeesCount : currentPayrolls.length;
    const avgTHP = employeeCount > 0 ? Math.round(totalTHP / employeeCount) : 0;

    return {
      totalTHP,
      totalGross,
      baseSalary,
      allowanceAndOvertime,
      totalDeductions,
      employeeCount,
      avgTHP,
    };
  }, [currentPayrolls, employees]);

  // Construct 6-month historical dataset
  const rawSixMonthData: MonthlyPayrollData[] = useMemo(() => {
    return [
      {
        monthKey: '2026-05',
        monthLabel: 'Mei 2026',
        shortLabel: 'Mei',
        year: 2026,
        totalTHP: 78500000,
        totalGross: 85900000,
        baseSalary: 64800000,
        allowanceAndOvertime: 21100000,
        totalDeductions: 7400000,
        employeeCount: 7,
        avgTHP: 11214285,
        notes: 'Penyesuaian operasional awal Kuartal II',
      },
      {
        monthKey: '2026-06',
        monthLabel: 'Juni 2026',
        shortLabel: 'Jun',
        year: 2026,
        totalTHP: 83200000,
        totalGross: 91400000,
        baseSalary: 64800000,
        allowanceAndOvertime: 26600000,
        totalDeductions: 8200000,
        employeeCount: 7,
        avgTHP: 11885714,
        notes: 'Insentif penjualan tengah tahun & kampanye grosir',
      },
      {
        monthKey: '2026-07',
        monthLabel: 'Juli 2026',
        shortLabel: 'Jul',
        year: 2026,
        totalTHP: 81400000,
        totalGross: 89300000,
        baseSalary: 64800000,
        allowanceAndOvertime: 24500000,
        totalDeductions: 7900000,
        employeeCount: 7,
        avgTHP: 11628571,
        notes: 'Normalisasi jam lembur logistik & packing',
      },
      {
        monthKey: '2026-08',
        monthLabel: 'Agustus 2026',
        shortLabel: 'Agu',
        year: 2026,
        totalTHP: 88900000,
        totalGross: 97800000,
        baseSalary: 74800000,
        allowanceAndOvertime: 23000000,
        totalDeductions: 8900000,
        employeeCount: 8,
        avgTHP: 11112500,
        notes: 'Penerimaan staf baru (UI/UX Developer) & bonus kemerdekaan',
      },
      {
        monthKey: '2026-09',
        monthLabel: 'September 2026',
        shortLabel: 'Sep',
        year: 2026,
        totalTHP: 91200000,
        totalGross: 100500000,
        baseSalary: 74800000,
        allowanceAndOvertime: 25700000,
        totalDeductions: 9300000,
        employeeCount: 8,
        avgTHP: 11400000,
        notes: 'Lembur intensif bongkar kontainer tas import 15 ton',
      },
      {
        monthKey: '2026-10',
        monthLabel: 'Oktober 2026 (Berjalan)',
        shortLabel: 'Okt*',
        year: 2026,
        totalTHP: currentMonthAggregates.totalTHP,
        totalGross: currentMonthAggregates.totalGross,
        baseSalary: currentMonthAggregates.baseSalary,
        allowanceAndOvertime: currentMonthAggregates.allowanceAndOvertime,
        totalDeductions: currentMonthAggregates.totalDeductions,
        employeeCount: currentMonthAggregates.employeeCount,
        avgTHP: currentMonthAggregates.avgTHP,
        notes: 'Periode aktif: Termasuk potongan cicilan kasbon staf & PPh 21 TER',
        isCurrentMonth: true,
      },
    ];
  }, [currentMonthAggregates]);

  // Filtered by selected timeRange
  const trendData = useMemo(() => {
    if (timeRange === '3m') {
      return rawSixMonthData.slice(3);
    }
    return rawSixMonthData;
  }, [rawSixMonthData, timeRange]);

  // Calculations & Insights
  const currentMonthData = rawSixMonthData[rawSixMonthData.length - 1];
  const previousMonthData = rawSixMonthData[rawSixMonthData.length - 2];

  const momChange = useMemo(() => {
    const diff = currentMonthData.totalTHP - previousMonthData.totalTHP;
    const percentage = ((diff / previousMonthData.totalTHP) * 100).toFixed(1);
    return {
      diff,
      percentage: Number(percentage),
      isPositive: diff >= 0,
    };
  }, [currentMonthData, previousMonthData]);

  const sixMonthTotalCost = useMemo(() => {
    return rawSixMonthData.reduce((acc, curr) => acc + curr.totalTHP, 0);
  }, [rawSixMonthData]);

  const sixMonthAverage = useMemo(() => {
    return Math.round(sixMonthTotalCost / rawSixMonthData.length);
  }, [sixMonthTotalCost, rawSixMonthData]);

  const highestMonth = useMemo(() => {
    return rawSixMonthData.reduce((max, curr) => (curr.totalTHP > max.totalTHP ? curr : max), rawSixMonthData[0]);
  }, [rawSixMonthData]);

  // Format currency for Y-Axis (e.g. 80 Jt)
  const formatYAxisMillion = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(0)} Jt`;
    }
    return `${val}`;
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      'Bulan',
      'Total Take Home Pay (Rp)',
      'Total Gaji Bruto (Rp)',
      'Gaji Pokok (Rp)',
      'Tunjangan & Lembur (Rp)',
      'Potongan Pajak & BPJS (Rp)',
      'Jumlah Karyawan',
      'Rata-rata THP (Rp)',
      'Catatan',
    ];

    const rows = rawSixMonthData.map((d) => [
      `"${d.monthLabel}"`,
      d.totalTHP,
      d.totalGross,
      d.baseSalary,
      d.allowanceAndOvertime,
      d.totalDeductions,
      d.employeeCount,
      d.avgTHP,
      `"${d.notes}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Tren_Biaya_Gaji_6Bulan_TGI_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Tooltip Renderer
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataItem = rawSixMonthData.find((d) => d.shortLabel === label || d.monthLabel === label) || payload[0]?.payload;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl border border-slate-700 max-w-xs text-xs z-50">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-2 mb-2.5">
          <div>
            <span className="font-bold text-sm text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {dataItem?.monthLabel || label}
            </span>
            {dataItem?.isCurrentMonth && (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                Bulan Berjalan
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-mono">
            {dataItem?.employeeCount} Staf
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-emerald-300 font-semibold bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-800/40">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Take Home Pay (Netto):
            </span>
            <span className="font-mono text-emerald-300 font-bold">
              {formatRupiah(dataItem?.totalTHP || 0)}
            </span>
          </div>

          <div className="flex items-center justify-between text-indigo-300 font-medium p-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Gaji Bruto (Kotor):
            </span>
            <span className="font-mono text-slate-200">
              {formatRupiah(dataItem?.totalGross || 0)}
            </span>
          </div>

          <div className="pt-1.5 border-t border-slate-800 space-y-1 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">• Gaji Pokok:</span>
              <span className="font-mono">{formatRupiah(dataItem?.baseSalary || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">• Tunjangan & Lembur:</span>
              <span className="font-mono text-amber-300">{formatRupiah(dataItem?.allowanceAndOvertime || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">• Potongan (PPh 21 & BPJS):</span>
              <span className="font-mono text-rose-300">-{formatRupiah(dataItem?.totalDeductions || 0)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 font-semibold text-slate-200">
              <span className="text-slate-400">• Rata-rata per Karyawan:</span>
              <span className="font-mono text-cyan-300">{formatRupiah(dataItem?.avgTHP || 0)}</span>
            </div>
          </div>

          {dataItem?.notes && (
            <div className="mt-2 text-[10px] text-slate-400 italic bg-slate-800/70 p-1.5 rounded-md border border-slate-700/50">
              "{dataItem.notes}"
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow">
      {/* Top Header & Interactive Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Tren Total Biaya Gaji Bulanan (Payroll Cost Trend)
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3 h-3" />
                  6 Bulan Terakhir
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualisasi dinamika pengeluaran gaji bersih (THP), beban bruto, dan rata-rata pengeluaran per karyawan PT Tas Grosir Import.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Filter */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimeRange('6m')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === '6m'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 Bulan
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('3m')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === '3m'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 Bulan
            </button>
          </div>

          {/* Chart Presentation Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('area')}
              title="Grafik Area Fluktuasi"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'area'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Area Tren</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('stacked_bar')}
              title="Grafik Komposisi Batang"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'stacked_bar'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Komposisi</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('composed')}
              title="Grafik Gabungan & Rata-rata"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'composed'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dual Sumbu</span>
            </button>
          </div>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download CSV Rekap 6 Bulan"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Highlight KPI Chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
        {/* Metric 1: Gaji Bulan Berjalan */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Biaya Periode Ini</span>
            <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {formatRupiah(currentMonthData.totalTHP)}
            </h4>
            <div className="flex items-center gap-1 mt-1 text-[11px]">
              <span
                className={`inline-flex items-center font-bold ${
                  momChange.isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {momChange.isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {momChange.isPositive ? `+${momChange.percentage}%` : `${momChange.percentage}%`}
              </span>
              <span className="text-slate-400">vs bln lalu</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Rata-rata 6 Bulan */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Rata-rata Biaya Bulanan</span>
            <div className="p-1 rounded-md bg-blue-100 text-blue-700">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {formatRupiah(sixMonthAverage)}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Rerata pengeluaran 6 periode
            </p>
          </div>
        </div>

        {/* Metric 3: Rata-rata per Karyawan */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Rerata THP / Karyawan</span>
            <div className="p-1 rounded-md bg-purple-100 text-purple-700">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {formatRupiah(currentMonthData.avgTHP)}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              {currentMonthData.employeeCount} karyawan aktif menerima gaji
            </p>
          </div>
        </div>

        {/* Metric 4: Puncak Pengeluaran */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Total Akumulasi 6 Bln</span>
            <div className="p-1 rounded-md bg-amber-100 text-amber-700">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {formatRupiah(sixMonthTotalCost)}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              Puncak: {highestMonth.shortLabel} ({formatRupiah(highestMonth.totalTHP)})
            </p>
          </div>
        </div>
      </div>

      {/* Main Chart Container with Recharts */}
      <div className="w-full h-80 pt-2 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'area' ? (
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTHP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxisMillion}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="totalGross"
                name="Total Gaji Bruto (Rp)"
                stroke="#6366f1"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorGross)"
                activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="totalTHP"
                name="Take Home Pay / Bersih (Rp)"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTHP)"
                activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          ) : viewMode === 'stacked_bar' ? (
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxisMillion}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="square"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Bar
                dataKey="baseSalary"
                name="Gaji Pokok"
                stackId="cost"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="allowanceAndOvertime"
                name="Tunjangan & Lembur"
                stackId="cost"
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="totalDeductions"
                name="Potongan (PPh 21 & BPJS)"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatYAxisMillion}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatYAxisMillion}
                tick={{ fill: '#0891b2', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Bar
                yAxisId="left"
                dataKey="totalTHP"
                name="Total Biaya THP (Kiri)"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                barSize={28}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgTHP"
                name="Rata-rata THP / Karyawan (Kanan)"
                stroke="#0891b2"
                strokeWidth={3}
                dot={{ r: 5, fill: '#0891b2', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Notes & Quick Action Bar */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Data periode <strong>Oktober 2026</strong> disinkronkan secara real-time dari modul kalkulasi Payroll & Kasbon.
          </span>
        </div>

        {onNavigatePayroll && (
          <button
            type="button"
            onClick={onNavigatePayroll}
            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer hover:underline self-end sm:self-auto"
          >
            Buka Rincian Payroll Periode Ini <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
