import React, { useState, useMemo } from 'react';
import {
  Users,
  Briefcase,
  Building2,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Award,
  UserCheck,
  CheckCircle2,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Employee, Department } from '../types';

interface EmployeeDemographicsChartsProps {
  employees: Employee[];
  compact?: boolean;
  onSelectRole?: (role: string) => void;
  onSelectDepartment?: (dept: string) => void;
}

const GENDER_COLORS = {
  pria: '#3b82f6', // blue-500
  wanita: '#ec4899', // pink-500
  unknown: '#94a3b8', // slate-400
};

const DEPARTMENT_COLORS: { [key: string]: string } = {
  'Teknologi & IT': '#0284c7', // sky-600
  'Keuangan & Akuntansi': '#10b981', // emerald-500
  'Operasional': '#f59e0b', // amber-500
  'Human Resources & GA': '#8b5cf6', // purple-500
  'Pemasaran & Bisnis': '#ec4899', // pink-500
  'Layanan Pelanggan': '#06b6d4', // cyan-500
};

export const EmployeeDemographicsCharts: React.FC<EmployeeDemographicsChartsProps> = ({
  employees,
  compact = false,
  onSelectRole,
  onSelectDepartment,
}) => {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [activeChartTab, setActiveChartTab] = useState<'gender' | 'roles' | 'dept_gender' | 'status'>('gender');

  // Filter employees if department filter is chosen
  const filteredEmployees = useMemo(() => {
    if (selectedDeptFilter === 'ALL') return employees;
    return employees.filter((e) => e.department === selectedDeptFilter);
  }, [employees, selectedDeptFilter]);

  // Total counts
  const totalCount = filteredEmployees.length;
  const activeCount = filteredEmployees.filter((e) => e.isActive).length;

  // Gender counts
  const genderStats = useMemo(() => {
    let pria = 0;
    let wanita = 0;
    let lainnya = 0;

    filteredEmployees.forEach((e) => {
      const g = e.gender;
      if (g === 'Laki-laki') {
        pria += 1;
      } else if (g === 'Perempuan') {
        wanita += 1;
      } else {
        lainnya += 1;
      }
    });

    const priaPct = totalCount > 0 ? Math.round((pria / totalCount) * 100) : 0;
    const wanitaPct = totalCount > 0 ? Math.round((wanita / totalCount) * 100) : 0;
    const lainnyaPct = totalCount > 0 ? Math.round((lainnya / totalCount) * 100) : 0;

    return {
      pria,
      wanita,
      lainnya,
      priaPct,
      wanitaPct,
      lainnyaPct,
    };
  }, [filteredEmployees, totalCount]);

  // Gender Donut Chart Data
  const genderChartData = useMemo(() => {
    const data = [
      { name: 'Pria (Laki-laki)', value: genderStats.pria, color: GENDER_COLORS.pria },
      { name: 'Wanita (Perempuan)', value: genderStats.wanita, color: GENDER_COLORS.wanita },
    ];
    if (genderStats.lainnya > 0) {
      data.push({ name: 'Belum Diatur', value: genderStats.lainnya, color: GENDER_COLORS.unknown });
    }
    return data;
  }, [genderStats]);

  // Roles (Jabatan) breakdown
  const rolesData = useMemo(() => {
    const roleMap: { [key: string]: { count: number; pria: number; wanita: number; depts: Set<string> } } = {};

    filteredEmployees.forEach((e) => {
      const roleName = e.role?.trim() || 'Tanpa Jabatan';
      if (!roleMap[roleName]) {
        roleMap[roleName] = { count: 0, pria: 0, wanita: 0, depts: new Set() };
      }
      roleMap[roleName].count += 1;
      if (e.gender === 'Laki-laki') {
        roleMap[roleName].pria += 1;
      } else if (e.gender === 'Perempuan') {
        roleMap[roleName].wanita += 1;
      }
      if (e.department) {
        roleMap[roleName].depts.add(e.department);
      }
    });

    return Object.entries(roleMap)
      .map(([role, stats]) => ({
        role,
        count: stats.count,
        pria: stats.pria,
        wanita: stats.wanita,
        dept: Array.from(stats.depts).join(', '),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEmployees]);

  // Department gender breakdown (Gender per Departemen)
  const deptGenderData = useMemo(() => {
    const map: { [key: string]: { dept: string; pria: number; wanita: number; total: number } } = {};

    filteredEmployees.forEach((e) => {
      const dept = e.department || 'Lainnya';
      if (!map[dept]) {
        map[dept] = { dept, pria: 0, wanita: 0, total: 0 };
      }
      map[dept].total += 1;
      if (e.gender === 'Laki-laki') {
        map[dept].pria += 1;
      } else if (e.gender === 'Perempuan') {
        map[dept].wanita += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredEmployees]);

  // Status Kepegawaian breakdown
  const statusData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredEmployees.forEach((e) => {
      const status = e.employmentStatus || 'Lainnya';
      map[status] = (map[status] || 0) + 1;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredEmployees]);

  const uniqueRolesCount = rolesData.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Banner / Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-emerald-400">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Diagram & Analisis Karyawan PT Tas Grosir Import
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Real-time Data
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Pemetaan jumlah karyawan, komposisi gender (pria & wanita), serta sebaran jabatan/posisi kerja.
              </p>
            </div>
          </div>

          {/* Department Filter dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-300" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="text-xs bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              <option value="ALL">Semua Departemen ({employees.length})</option>
              <option value="Teknologi & IT">Teknologi & IT</option>
              <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
              <option value="Operasional">Operasional</option>
              <option value="Human Resources & GA">Human Resources & GA</option>
              <option value="Pemasaran & Bisnis">Pemasaran & Bisnis</option>
              <option value="Layanan Pelanggan">Layanan Pelanggan</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="p-5 grid grid-cols-2 lg:grid-cols-5 gap-3.5 bg-slate-50/70 border-b border-slate-200">
        {/* Total Karyawan */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Karyawan
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-500 font-medium">Orang</span>
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> {activeCount} Aktif Bekerja
          </p>
        </div>

        {/* Pria */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Karyawan Pria
            </span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {genderStats.priaPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-600">{genderStats.pria}</span>
            <span className="text-xs text-slate-500 font-medium">Laki-laki</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${genderStats.priaPct}%` }}
            />
          </div>
        </div>

        {/* Wanita */}
        <div className="bg-white p-3.5 rounded-xl border border-pink-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-pink-700 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500" /> Karyawan Wanita
            </span>
            <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
              {genderStats.wanitaPct}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-pink-600">{genderStats.wanita}</span>
            <span className="text-xs text-slate-500 font-medium">Perempuan</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-pink-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${genderStats.wanitaPct}%` }}
            />
          </div>
        </div>

        {/* Total Jabatan Unik */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Variasi Jabatan
            </span>
            <Briefcase className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{uniqueRolesCount}</span>
            <span className="text-xs text-slate-500 font-medium">Posisi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {rolesData[0]?.role ? `Terbanyak: ${rolesData[0].role}` : 'Struktur Posisi'}
          </p>
        </div>

        {/* Rasio Gender */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Rasio Pria : Wanita
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">
              {genderStats.wanita > 0
                ? `${(genderStats.pria / genderStats.wanita).toFixed(1)} : 1`
                : `${genderStats.pria} : 0`}
            </span>
            <span className="text-xs text-slate-500 font-medium">Indeks</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Keseimbangan tim kerja
          </p>
        </div>
      </div>

      {/* Main Charts View */}
      <div className="p-5 space-y-6">
        {/* Navigation sub-tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveChartTab('gender')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeChartTab === 'gender'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Diagram Gender (Pria vs Wanita)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('roles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeChartTab === 'roles'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Diagram Jabatan (Posisi Kerja)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('dept_gender')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeChartTab === 'dept_gender'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Gender per Departemen</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Total sampel: {totalCount} staf</span>
          </div>
        </div>

        {/* Tab 1: Gender Distribution Donut Chart & Detailed Breakdown */}
        {activeChartTab === 'gender' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Donut Chart */}
            <div className="lg:col-span-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-indigo-600" />
                  Diagram Komposisi Kelamin (Pria vs Wanita)
                </h4>
                <span className="text-[11px] text-slate-500">Persentase</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Proporsi karyawan laki-laki dan perempuan di seluruh unit operasional.
              </p>

              <div className="h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${val} Karyawan (${totalCount > 0 ? Math.round((Number(val) / totalCount) * 100) : 0}%)`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        color: '#fff',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        border: 'none',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-xs text-slate-700 font-medium">{value}</span>}
                    />
                    <Pie
                      data={genderChartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {genderChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Label in Donut */}
                <div className="absolute top-[41%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 block leading-tight">{totalCount}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Karyawan</span>
                </div>
              </div>
            </div>

            {/* Right: Comparative Breakdown Cards */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      ♂
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Karyawan Pria (Laki-laki)</h5>
                      <p className="text-[11px] text-slate-500">Divisi Teknis, Gudang, & Analis</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-blue-700">{genderStats.pria}</span>
                    <span className="text-xs text-blue-600 ml-1 font-semibold">({genderStats.priaPct}%)</span>
                  </div>
                </div>
                <div className="mt-3 w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${genderStats.priaPct}%` }} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Kontribusi kuota: {genderStats.pria} dari {totalCount} staf</span>
                  <span className="font-semibold text-blue-700">Mayoritas: Lapangan & IT</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-pink-200 bg-pink-50/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      ♀
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Karyawan Wanita (Perempuan)</h5>
                      <p className="text-[11px] text-slate-500">Divisi HR, Marketing, & CS</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-pink-700">{genderStats.wanita}</span>
                    <span className="text-xs text-pink-600 ml-1 font-semibold">({genderStats.wanitaPct}%)</span>
                  </div>
                </div>
                <div className="mt-3 w-full bg-pink-200/60 h-2 rounded-full overflow-hidden">
                  <div className="bg-pink-600 h-full rounded-full" style={{ width: `${genderStats.wanitaPct}%` }} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Kontribusi kuota: {genderStats.wanita} dari {totalCount} staf</span>
                  <span className="font-semibold text-pink-700">Mayoritas: HR & Pemasaran</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Kesimpulan Kesetaraan Gender:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Proporsional & Seimbang
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Struktur sumber daya manusia PT Tas Grosir Import memiliki distribusi gender yang sehat dengan partisipasi aktif tenaga kerja wanita pada posisi strategis pemasaran & SDM, serta laki-laki pada bidang rekayasa teknis & logistik.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Roles / Jabatan Bar Chart & Position Ranking */}
        {activeChartTab === 'roles' && (
          <div className="space-y-6">
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Diagram Jumlah Karyawan Berdasarkan Jabatan (Posisi Kerja)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Jumlah personel aktif untuk setiap jabatan kerja yang terdaftar di sistem.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  Total {uniqueRolesCount} Jabatan Berbeda
                </span>
              </div>

              {/* Bar Chart of Roles */}
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rolesData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      dataKey="role"
                      type="category"
                      width={170}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 500 }}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${val} Orang`,
                        name === 'pria' ? 'Pria' : name === 'wanita' ? 'Wanita' : 'Jumlah Karyawan',
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        color: '#fff',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        border: 'none',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      formatter={(val) => (
                        <span className="text-xs text-slate-700 font-medium">
                          {val === 'pria' ? 'Laki-laki' : val === 'wanita' ? 'Perempuan' : val}
                        </span>
                      )}
                    />
                    <Bar dataKey="pria" stackId="a" fill="#3b82f6" name="pria" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="wanita" stackId="a" fill="#ec4899" name="wanita" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* List Table of Positions with Details */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Rincian Detail Posisi & Komposisi Kelamin per Jabatan
                </span>
                <span className="text-[11px] text-slate-500">Klik baris untuk memfilter</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {rolesData.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectRole && onSelectRole(item.role)}
                    className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-900 block">{item.role}</span>
                        <span className="text-[11px] text-slate-500">{item.dept}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
                          ♂ {item.pria} Pria
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-pink-600 font-semibold flex items-center gap-1">
                          ♀ {item.wanita} Wanita
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg text-xs min-w-[50px] text-center">
                        {item.count} org
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Department Gender Distribution (Pria & Wanita per Divisi) */}
        {activeChartTab === 'dept_gender' && (
          <div className="space-y-6">
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-600" />
                    Diagram Distribusi Gender per Departemen Kerja
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Perbandingan jumlah staf pria (biru) dan staf wanita (pink) pada setiap departemen perusahaan.
                  </p>
                </div>
              </div>

              {/* Grouped Bar Chart */}
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deptGenderData}
                    margin={{ top: 10, right: 20, left: -10, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="dept"
                      angle={-20}
                      textAnchor="end"
                      height={45}
                      tick={{ fontSize: 11, fill: '#334155' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${val} Staf`,
                        name === 'pria' ? '♂ Pria (Laki-laki)' : '♀ Wanita (Perempuan)',
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        color: '#fff',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        border: 'none',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      formatter={(val) => (
                        <span className="text-xs text-slate-700 font-medium">
                          {val === 'pria' ? '♂ Laki-laki' : '♀ Perempuan'}
                        </span>
                      )}
                    />
                    <Bar dataKey="pria" name="pria" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="wanita" name="wanita" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {deptGenderData.map((d, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectDepartment && onSelectDepartment(d.dept)}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-800 truncate">{d.dept}</span>
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                      {d.total} Org
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                    <span className="text-blue-600 font-semibold">♂ {d.pria} Pria</span>
                    <span>•</span>
                    <span className="text-pink-600 font-semibold">♀ {d.wanita} Wanita</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${d.total > 0 ? (d.pria / d.total) * 100 : 0}%` }}
                      title={`Pria: ${d.pria}`}
                    />
                    <div
                      className="bg-pink-500 h-full transition-all"
                      style={{ width: `${d.total > 0 ? (d.wanita / d.total) * 100 : 0}%` }}
                      title={`Wanita: ${d.wanita}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
