import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Award,
  TrendingUp,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Filter,
  Search,
  ChevronRight,
  ChevronDown,
  Edit3,
  Plus,
  X,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  ShieldCheck,
  Users,
  Briefcase,
  Zap,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from 'recharts';
import { Department, DepartmentKpiData, KpiMetric, KpiStatus, Employee } from '../types';
import { initialDepartmentKpiData } from '../data/kpiData';

interface DepartmentKpiViewProps {
  employees: Employee[];
}

const DEPARTMENT_COLORS: { [key: string]: string } = {
  'Teknologi & IT': '#0284c7', // Sky-600
  'Keuangan & Akuntansi': '#10b981', // Emerald-500
  'Operasional': '#f59e0b', // Amber-500
  'Human Resources & GA': '#8b5cf6', // Purple-500
  'Pemasaran & Bisnis': '#ec4899', // Pink-500
  'Layanan Pelanggan': '#06b6d4', // Cyan-500
  'Gudang': '#0d9488', // Teal-600
  'Packing': '#6366f1', // Indigo-500
  'Ekspedisi': '#ea580c', // Orange-600
  'Admin Marketplace': '#e11d48', // Rose-600
};

const FALLBACK_PALETTE = [
  '#0d9488',
  '#6366f1',
  '#ea580c',
  '#e11d48',
  '#0284c7',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
];

const getDepartmentColor = (dept: string, idx = 0): string => {
  if (DEPARTMENT_COLORS[dept]) return DEPARTMENT_COLORS[dept];
  let hash = 0;
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash + idx) % FALLBACK_PALETTE.length];
};

const createDefaultKpiForCustomDepartment = (
  deptName: string,
  deptEmps: Employee[]
): DepartmentKpiData => {
  const leadEmp = deptEmps[0];
  const slug = deptName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    department: deptName,
    leadName: leadEmp ? leadEmp.fullName : `Koordinator ${deptName}`,
    leadRole: leadEmp
      ? `${leadEmp.role} (${deptEmps.length} Staf Aktif: ${deptEmps.map((e) => e.fullName).join(', ')})`
      : `Divisi ${deptName}`,
    leadAvatar:
      leadEmp?.avatarUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    overallScore: 93.5,
    grade: 'A',
    status: 'on_track',
    quarter: 'Q4 2026',
    trend: [
      { quarter: 'Q1 2026', score: 90.0 },
      { quarter: 'Q2 2026', score: 91.5 },
      { quarter: 'Q3 2026', score: 92.8 },
      { quarter: 'Q4 2026', score: 93.5 },
    ],
    metrics: [
      {
        id: `kpi-${slug}-1`,
        name: `Target Penyelesaian Tugas Harian (${deptName})`,
        category: 'Produktivitas & Kecepatan',
        target: '≥ 95%',
        actual: '96.5%',
        unit: '%',
        weight: 40,
        achievementRate: 96.5,
        status: 'exceeded',
        notes: `Seluruh target harian tim ${deptName} diselesaikan tepat waktu sesuai standar SOP.`,
      },
      {
        id: `kpi-${slug}-2`,
        name: `Akurasi Kerja & Minim Kesalahan Operasional`,
        category: 'Kualitas & Ketelitian',
        target: '≥ 98%',
        actual: '98.2%',
        unit: '%',
        weight: 35,
        achievementRate: 98.2,
        status: 'on_track',
        notes: `Tingkat ketelitian kerja staf ${deptName} terjaga dengan baik.`,
      },
      {
        id: `kpi-${slug}-3`,
        name: `Kedisiplinan Presensi & Kepatuhan Shift`,
        category: 'Kedisiplinan SDM',
        target: '≥ 95%',
        actual: '95.0%',
        unit: '%',
        weight: 25,
        achievementRate: 95.0,
        status: 'on_track',
        notes: `Kehadiran anggota tim ${deptName} terkendali sesuai jadwal shift.`,
      },
    ],
    keyStrengths: [
      `Koordinasi kerja tim ${deptName} (${deptEmps.map((e) => e.fullName).join(', ')}) berjalan responsif dan terukur.`,
      `Pencapaian SLA harian divisi ${deptName} konsisten melampaui target minimum 90%.`,
    ],
    areasOfImprovement: [
      `Optimalisasi alur kerja dan pelaporan berkala pada divisi ${deptName}.`,
    ],
  };
};

export const DepartmentKpiView: React.FC<DepartmentKpiViewProps> = ({ employees }) => {
  // Load KPI data from localStorage or fallback
  const [kpiData, setKpiData] = useState<DepartmentKpiData[]>(() => {
    try {
      const saved = localStorage.getItem('tgi_department_kpis');
      return saved ? JSON.parse(saved) : initialDepartmentKpiData;
    } catch {
      return initialDepartmentKpiData;
    }
  });

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q4 2026');
  const [activeChartTab, setActiveChartTab] = useState<'bar' | 'radar' | 'trend'>('bar');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // Modal edit state
  const [editingDept, setEditingDept] = useState<DepartmentKpiData | null>(null);
  const [editingMetric, setEditingMetric] = useState<KpiMetric | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Save changes to localStorage
  const saveKpiData = (newData: DepartmentKpiData[]) => {
    setKpiData(newData);
    try {
      localStorage.setItem('tgi_department_kpis', JSON.stringify(newData));
    } catch (e) {
      console.error('Failed to save KPI data:', e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3500);
  };

  // Active employees & active departments map
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.isActive !== false),
    [employees]
  );

  // Dynamically derive unique active departments from employees (Array.from(new Set(...)))
  // and bind leadName/leadRole/leadAvatar dynamically to real employees in that department
  const activeKpiData = useMemo(() => {
    const deptEmpsMap: Record<string, Employee[]> = {};
    activeEmployees.forEach((emp) => {
      const dept = emp.department?.trim() || 'Operasional';
      if (!deptEmpsMap[dept]) deptEmpsMap[dept] = [];
      deptEmpsMap[dept].push(emp);
    });

    const uniqueActiveDepartments = Array.from(
      new Set(activeEmployees.map((e) => e.department?.trim() || 'Operasional'))
    );

    return uniqueActiveDepartments.map((deptName) => {
      const deptEmps = deptEmpsMap[deptName] || [];
      const leadEmp = deptEmps[0];
      const existingKpi = kpiData.find((d) => d.department === deptName);
      const baseKpi = existingKpi || createDefaultKpiForCustomDepartment(deptName, deptEmps);

      return {
        ...baseKpi,
        leadName: leadEmp ? leadEmp.fullName : baseKpi.leadName,
        leadRole: leadEmp
          ? `${leadEmp.role} (${deptEmps.length} Staf Aktif: ${deptEmps
              .map((e) => e.fullName)
              .join(', ')})`
          : baseKpi.leadRole,
        leadAvatar: leadEmp?.avatarUrl || baseKpi.leadAvatar,
      };
    });
  }, [kpiData, activeEmployees]);

  // Filtered department list
  const filteredDepartments = useMemo(() => {
    if (selectedDeptFilter === 'ALL') return activeKpiData;
    return activeKpiData.filter((d) => d.department === selectedDeptFilter);
  }, [activeKpiData, selectedDeptFilter]);

  // Aggregate Company KPIs (strictly across active departments)
  const companyAverageScore = useMemo(() => {
    if (activeKpiData.length === 0) return 0;
    const sum = activeKpiData.reduce((acc, curr) => acc + curr.overallScore, 0);
    return Math.round((sum / activeKpiData.length) * 10) / 10;
  }, [activeKpiData]);

  const topDepartment = useMemo(() => {
    return [...activeKpiData].sort((a, b) => b.overallScore - a.overallScore)[0];
  }, [activeKpiData]);

  const totalMetricsCount = useMemo(() => {
    return activeKpiData.reduce((acc, curr) => acc + curr.metrics.length, 0);
  }, [activeKpiData]);

  const exceededDeptsCount = useMemo(
    () => activeKpiData.filter((d) => d.status === 'exceeded').length,
    [activeKpiData]
  );
  const onTrackDeptsCount = useMemo(
    () => activeKpiData.filter((d) => d.status === 'on_track').length,
    [activeKpiData]
  );

  // Bar chart data for active departments comparison
  const barChartData = useMemo(() => {
    return activeKpiData.map((d, idx) => ({
      name: d.department.length > 15 ? d.department.substring(0, 14) + '...' : d.department,
      fullName: d.department,
      skor: d.overallScore,
      target: 90.0,
      color: getDepartmentColor(d.department, idx),
    }));
  }, [activeKpiData]);

  // Radar chart data
  const radarChartData = useMemo(() => {
    return activeKpiData.map((d) => ({
      subject: d.department.replace('& ', ''),
      score: d.overallScore,
      benchmark: 90,
      fullMark: 100,
    }));
  }, [activeKpiData]);

  // Trend data across quarters (strictly for active departments)
  const trendData = useMemo(() => {
    const quarters = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
    return quarters.map((q) => {
      const row: any = { quarter: q };
      activeKpiData.forEach((d) => {
        const item = d.trend.find((t) => t.quarter === q);
        row[d.department] = item ? item.score : d.overallScore;
      });
      return row;
    });
  }, [activeKpiData]);

  // Handle Edit Metric Form Submit (supports both initial & custom departments)
  const handleSaveMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editingMetric) return;

    const existsInKpiData = kpiData.some((d) => d.department === editingDept.department);
    const sourceList = existsInKpiData ? kpiData : [...kpiData, editingDept];

    const updatedDepartments = sourceList.map((dept) => {
      if (dept.department === editingDept.department) {
        const updatedMetrics = dept.metrics.map((m) =>
          m.id === editingMetric.id ? editingMetric : m
        );
        // Recalculate overall score based on weights
        const totalWeight = updatedMetrics.reduce((acc, m) => acc + (m.weight || 25), 0);
        const weightedScore = updatedMetrics.reduce((acc, m) => {
          const clampedAchieve = Math.min(Math.max(m.achievementRate, 50), 125);
          return acc + clampedAchieve * ((m.weight || 25) / totalWeight);
        }, 0);

        const newScore = Math.min(Math.round(weightedScore * 10) / 10, 100);
        let newGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' = 'B';
        if (newScore >= 97) newGrade = 'A+';
        else if (newScore >= 90) newGrade = 'A';
        else if (newScore >= 80) newGrade = 'B+';
        else if (newScore >= 70) newGrade = 'B';
        else newGrade = 'C';

        return {
          ...dept,
          overallScore: newScore,
          grade: newGrade,
          status:
            newScore >= 95
              ? ('exceeded' as KpiStatus)
              : newScore >= 85
              ? ('on_track' as KpiStatus)
              : ('needs_attention' as KpiStatus),
          metrics: updatedMetrics,
        };
      }
      return dept;
    });

    saveKpiData(updatedDepartments);
    setEditingDept(null);
    setEditingMetric(null);
    showToast('Indikator KPI berhasil diperbarui & skor kinerja telah dihitung ulang!');
  };

  // Export KPI Report to CSV
  const handleExportKPItoCSV = () => {
    const headers = [
      'Departemen',
      'Kepala Departemen',
      'Skor Kinerja Keseluruhan',
      'Predikat (Grade)',
      'Nama Metrik KPI',
      'Kategori',
      'Target',
      'Realisasi (Aktual)',
      'Tingkat Pencapaian (%)',
      'Bobot (%)',
      'Status',
      'Catatan Evaluasi',
    ];

    const rows: string[][] = [];
    activeKpiData.forEach((dept) => {
      dept.metrics.forEach((m) => {
        rows.push([
          `"${dept.department}"`,
          `"${dept.leadName} (${dept.leadRole})"`,
          `${dept.overallScore}%`,
          dept.grade,
          `"${m.name}"`,
          `"${m.category}"`,
          `"${m.target}"`,
          `"${m.actual}"`,
          `${m.achievementRate}%`,
          `${m.weight}%`,
          m.status === 'exceeded'
            ? 'Melebihi Target'
            : m.status === 'on_track'
            ? 'Tercapai'
            : m.status === 'needs_attention'
            ? 'Perlu Perhatian'
            : 'Kritis',
          `"${m.notes || '-'}"`,
        ]);
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TGI_Laporan_Kinerja_KPI_Departemen_${selectedQuarter.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Laporan KPI Departemen berhasil diekspor ke format CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-fadeIn text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              Siklus Evaluasi Kinerja: {selectedQuarter} PT Tas Grosir Import
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Analisis KPI & Kinerja Seluruh Departemen
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Pemantauan Key Performance Indicators (KPI), pencapaian target operasional, efektivitas tim kerja, dan kepatuhan standar SLA di setiap divisi perusahaan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              <option value="Q4 2026">Kuartal IV (Q4 2026 - Berjalan)</option>
              <option value="Q3 2026">Kuartal III (Q3 2026)</option>
              <option value="Q2 2026">Kuartal II (Q2 2026)</option>
              <option value="Q1 2026">Kuartal I (Q1 2026)</option>
            </select>

            <button
              onClick={handleExportKPItoCSV}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" />
              Ekspor Rekap KPI
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Scoreboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Rata-Rata Skor Perusahaan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Rata-Rata Skor KPI
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              {companyAverageScore}%
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Grade A (Luar Biasa)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Target Korporat: 90.0% • <strong>+5.3%</strong> di atas target
          </p>
        </div>

        {/* Card 2: Departemen Terbaik */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Departemen Terbaik
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {topDepartment?.department || 'Operasional'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-black text-blue-600">
                {topDepartment ? `${topDepartment.overallScore}%` : '0%'}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Predikat {topDepartment?.grade || '-'}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">
            PIC: {topDepartment?.leadName || '-'}
          </p>
        </div>

        {/* Card 3: Total Metrik KPI Terpantau */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Metrik Terukur
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalMetricsCount}
            </h3>
            <span className="text-xs text-slate-500 font-medium">Indikator Kinerja</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Pada {activeKpiData.length} departemen aktif ({activeKpiData.map((d) => d.department).join(', ') || '-'})
          </p>
        </div>

        {/* Card 4: Kepatuhan Target & SLA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status Capaian Divisi Aktif
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              {exceededDeptsCount + onTrackDeptsCount} / {activeKpiData.length}
            </h3>
            <span className="text-xs text-emerald-600 font-bold">100% On Track</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {exceededDeptsCount} Melebihi Target • {onTrackDeptsCount} Sesuai Target
          </p>
        </div>
      </div>

      {/* Visual Analytics & Diagram Kinerja */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px] mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              Visualisasi Diagram Kinerja
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Komparasi & Tren Kinerja Lintas Departemen
            </h3>
            <p className="text-xs text-slate-500">
              Perbandingan skor capaian KPI aktual terhadap batas ambang target minimum perusahaan (90%).
            </p>
          </div>

          {/* Sub-tab view toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveChartTab('bar')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeChartTab === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grafik Batang
            </button>
            <button
              onClick={() => setActiveChartTab('radar')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeChartTab === 'radar'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Diagram Radar (Keseimbangan)
            </button>
            <button
              onClick={() => setActiveChartTab('trend')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeChartTab === 'trend'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tren Kuartalan
            </button>
          </div>
        </div>

        {/* Tab 1: Bar Chart */}
        {activeChartTab === 'bar' && (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Skor Kinerja KPI']}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || _label}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar dataKey="skor" radius={[6, 6, 0, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 2: Radar Chart */}
        {activeChartTab === 'radar' && (
          <div className="h-80 w-full flex items-center justify-center pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[70, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Radar name="Skor Kinerja" dataKey="score" stroke="#059669" fill="#10b981" fillOpacity={0.45} />
                <Radar name="Target Minimum (90%)" dataKey="benchmark" stroke="#94a3b8" strokeDasharray="3 3" fill="none" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Skor']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 3: Trend Area Chart */}
        {activeChartTab === 'trend' && (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis domain={[85, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                {activeKpiData.map((d) => (
                  <Area
                    key={d.department}
                    type="monotone"
                    dataKey={d.department}
                    stroke={DEPARTMENT_COLORS[d.department] || '#10b981'}
                    fill={DEPARTMENT_COLORS[d.department] || '#10b981'}
                    fillOpacity={0.15}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filter and Search Bar for Active Departments */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filter Departemen Aktif:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            <option value="ALL">Semua Departemen Aktif ({activeKpiData.length})</option>
            {activeKpiData.map((d) => (
              <option key={d.department} value={d.department}>
                {d.department} ({d.overallScore}%)
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Melebihi Target
          </span>
          <span className="flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Sesuai Target
          </span>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="space-y-5">
        {filteredDepartments.map((dept) => {
          const isExpanded = expandedDept === dept.department;
          return (
            <div
              key={dept.department}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
            >
              {/* Department Card Header */}
              <div className="p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: DEPARTMENT_COLORS[dept.department] || '#059669' }}
                  >
                    <Building className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{dept.department}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          dept.status === 'exceeded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {dept.status === 'exceeded' ? '★ Melebihi Target' : '✓ Sesuai Target'}
                      </span>
                    </div>

                    {/* Department Head Info */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <img
                        src={dept.leadAvatar}
                        alt={dept.leadName}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                      />
                      <span>
                        Kepala Divisi: <strong>{dept.leadName}</strong> ({dept.leadRole})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score & Action Button */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900 block leading-tight">
                      {dept.overallScore}%
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Predikat: <strong className="text-emerald-700">{dept.grade}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedDept(isExpanded ? null : dept.department)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    title={isExpanded ? 'Tutup Rincian' : 'Buka Rincian'}
                  >
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Department Metrics Table / Grid */}
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dept.metrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            {metric.category} • Bobot {metric.weight}%
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 mt-0.5">{metric.name}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDept(dept);
                            setEditingMetric({ ...metric });
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Sesuaikan Target & Capaian"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Target vs Actual */}
                      <div className="flex items-baseline justify-between text-xs">
                        <div>
                          <span className="text-slate-500">Target: </span>
                          <span className="font-semibold text-slate-700">{metric.target}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Realisasi: </span>
                          <span className="font-bold text-slate-900">{metric.actual}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">Pencapaian:</span>
                          <span
                            className={`font-bold ${
                              metric.achievementRate >= 100
                                ? 'text-emerald-700'
                                : 'text-blue-700'
                            }`}
                          >
                            {metric.achievementRate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              metric.achievementRate >= 100
                                ? 'bg-emerald-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(metric.achievementRate, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Notes / Evaluasi */}
                      {metric.notes && (
                        <p className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-100 leading-relaxed">
                          {metric.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Collapsible Strengths & Improvement Section */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                    {/* Strengths */}
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Kekuatan Utama & Pencapaian Unggulan:
                      </h5>
                      <ul className="space-y-1.5 text-xs text-emerald-800 list-disc list-inside">
                        {dept.keyStrengths.map((s, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas of Improvement */}
                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                      <h5 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Rencana Aksi & Area Pengembangan (Next Quarter):
                      </h5>
                      <ul className="space-y-1.5 text-xs text-amber-800 list-disc list-inside">
                        {dept.areasOfImprovement.map((a, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT METRIC MODAL */}
      {editingDept && editingMetric && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sesuaikan Capaian Metrik KPI
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Departemen: <strong>{editingDept.department}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingDept(null);
                  setEditingMetric(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMetric} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nama Indikator KPI</label>
                <input
                  type="text"
                  required
                  value={editingMetric.name}
                  onChange={(e) => setEditingMetric({ ...editingMetric, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Target</label>
                  <input
                    type="text"
                    required
                    value={editingMetric.target}
                    onChange={(e) => setEditingMetric({ ...editingMetric, target: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    placeholder="e.g. ≥ 95%"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Realisasi (Aktual)</label>
                  <input
                    type="text"
                    required
                    value={editingMetric.actual}
                    onChange={(e) => setEditingMetric({ ...editingMetric, actual: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    placeholder="e.g. 98.4%"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Pencapaian (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingMetric.achievementRate}
                    onChange={(e) =>
                      setEditingMetric({ ...editingMetric, achievementRate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Status Metrik</label>
                  <select
                    value={editingMetric.status}
                    onChange={(e) =>
                      setEditingMetric({ ...editingMetric, status: e.target.value as KpiStatus })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="exceeded">Melebihi Target</option>
                    <option value="on_track">Sesuai Target</option>
                    <option value="needs_attention">Perlu Perhatian</option>
                    <option value="critical">Kritis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Catatan Evaluasi / Bukti</label>
                <textarea
                  rows={3}
                  value={editingMetric.notes || ''}
                  onChange={(e) => setEditingMetric({ ...editingMetric, notes: e.target.value })}
                  placeholder="Deskripsikan catatan operasional atau pencapaian..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setEditingMetric(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
