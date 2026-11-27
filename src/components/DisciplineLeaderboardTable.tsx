import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Clock,
  Calendar,
  MapPin,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Filter,
  UserCheck,
} from 'lucide-react';
import {
  Employee,
  AttendanceRecord,
  CompanyConfig,
  PayrollRecord,
  PayrollDeductionRecord,
  DisciplineBadgeCategory,
  EmployeeDisciplineLeaderboardRow,
} from '../types';
import {
  calculateEmployeeDisciplineLeaderboard,
  formatCutOffPeriodRange,
  getDynamicAvailablePayrollPeriods,
  AVAILABLE_PAYROLL_PERIODS,
  getJakartaDateString,
} from '../utils/formatters';

interface DisciplineLeaderboardTableProps {
  employees: Employee[];
  attendances: AttendanceRecord[];
  companyConfig: CompanyConfig;
  payrolls?: PayrollRecord[];
  payrollDeductions?: PayrollDeductionRecord[];
  onChangePayrollPeriod?: (newPeriod: string) => void;
  onSelectEmployeeForBonusOrReview?: (row: EmployeeDisciplineLeaderboardRow) => void;
}

export const DisciplineLeaderboardTable: React.FC<DisciplineLeaderboardTableProps> = ({
  employees,
  attendances,
  companyConfig,
  payrolls = [],
  payrollDeductions = [],
  onChangePayrollPeriod,
  onSelectEmployeeForBonusOrReview,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    companyConfig.currentPayrollPeriod || 'November 2026'
  );
  const [badgeFilter, setBadgeFilter] = useState<'ALL' | DisciplineBadgeCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync local period if global companyConfig.currentPayrollPeriod changes
  React.useEffect(() => {
    if (companyConfig.currentPayrollPeriod) {
      setSelectedPeriod(companyConfig.currentPayrollPeriod);
    }
  }, [companyConfig.currentPayrollPeriod]);

  const availablePeriods = useMemo(() => {
    const dynamicList = getDynamicAvailablePayrollPeriods(
      new Date(),
      companyConfig.cutOffEndDay || 25
    );
    const list = Array.from(new Set([...dynamicList, ...AVAILABLE_PAYROLL_PERIODS]));
    if (selectedPeriod && !list.includes(selectedPeriod)) {
      list.unshift(selectedPeriod);
    }
    return list;
  }, [selectedPeriod, companyConfig.cutOffEndDay]);

  const handlePeriodChange = (nextPeriod: string) => {
    setSelectedPeriod(nextPeriod);
    onChangePayrollPeriod?.(nextPeriod);
  };

  // Hitung peringkat utuh seluruh karyawan aktif langsung dari data presensi real-time Supabase
  const allRankedRows = useMemo(() => {
    return calculateEmployeeDisciplineLeaderboard({
      employees,
      attendances,
      companyConfig,
      period: selectedPeriod,
      payrolls,
      payrollDeductions,
    });
  }, [employees, attendances, companyConfig, selectedPeriod, payrolls, payrollDeductions]);

  const filteredRows = useMemo(() => {
    return allRankedRows.filter((row) => {
      if (badgeFilter !== 'ALL' && row.badgeCategory !== badgeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.fullName.toLowerCase().includes(q);
        const matchNik = row.nik.toLowerCase().includes(q);
        const matchRole = row.role.toLowerCase().includes(q);
        const matchDept = row.department.toLowerCase().includes(q);
        const matchBranch = row.branchDisplayLabel.toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchRole && !matchDept && !matchBranch) {
          return false;
        }
      }
      return true;
    });
  }, [allRankedRows, badgeFilter, searchQuery]);

  const summaryCounts = useMemo(() => {
    const teladanCount = allRankedRows.filter((r) => r.badgeCategory === 'teladan').length;
    const cukupCount = allRankedRows.filter((r) => r.badgeCategory === 'cukup_disiplin').length;
    const evaluasiCount = allRankedRows.filter((r) => r.badgeCategory === 'perlu_evaluasi').length;
    const glcCount = allRankedRows.filter((r) => r.branchCategory === 'Green Lake City').length;
    const sumberMasCount = allRankedRows.filter((r) => r.branchCategory === 'Sumber Mas').length;
    return {
      total: allRankedRows.length,
      teladanCount,
      cukupCount,
      evaluasiCount,
      glcCount,
      sumberMasCount,
    };
  }, [allRankedRows]);

  const cutOffRangeLabel = useMemo(
    () =>
      formatCutOffPeriodRange(
        selectedPeriod,
        companyConfig.cutOffStartDay || 26,
        companyConfig.cutOffEndDay || 25
      ),
    [selectedPeriod, companyConfig.cutOffStartDay, companyConfig.cutOffEndDay]
  );

  const handleExportLeaderboardCSV = () => {
    const todayWib = getJakartaDateString();
    const headers = [
      'Peringkat',
      'NIK',
      'Nama Karyawan',
      'Jabatan',
      'Departemen',
      'Cabang Lokasi',
      'Jadwal Kerja',
      'Total Hari Kerja Wajib',
      'Total Hari Hadir',
      'Hadir Tepat Waktu',
      'Tukar Hari Libur Minggu',
      'Jumlah Alpha (Hari)',
      'Total Terlambat (Menit)',
      'Frekuensi Terlambat (Kali)',
      'Total Jam Kerja Aktual',
      'Rata-rata Jam Masuk',
      'Persentase Kehadiran (%)',
      'Badge Status Disiplin',
      'Status Tunjangan Kerajinan',
      'Status Tunjangan Kedisiplinan',
      'Periode Cut-Off',
    ];

    const csvRows = filteredRows.map((row) => [
      `#${row.rank}`,
      `"${row.nik}"`,
      `"${row.fullName.replace(/"/g, '""')}"`,
      `"${row.role.replace(/"/g, '""')}"`,
      `"${row.department.replace(/"/g, '""')}"`,
      `"${row.branchDisplayLabel}"`,
      `"${row.workDaysPerWeek} Hari/Minggu"`,
      row.requiredWorkDays,
      row.presentDaysCount,
      row.onTimeDaysCount,
      row.dayOffReplacementDaysCount,
      row.alphaDaysCount,
      row.totalLateMinutes,
      row.lateFrequency,
      row.totalActualWorkHours,
      `"${row.avgCheckInTimeLabel}"`,
      `${row.attendancePercentage}%`,
      `"${row.badgeLabel}"`,
      row.isKerajinanEligible ? '"Cair Penuh (0 Alpha)"' : '"Hangus (Ada Alpha)"',
      row.isKedisiplinanEligible ? '"Cair Penuh (0 Terlambat)"' : '"Hangus (Ada Terlambat)"',
      `"${selectedPeriod} (${cutOffRangeLabel})"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TGI_Peringkat_Karyawan_Terajin_Disiplin_${selectedPeriod.replace(/\s+/g, '_')}_${todayWib}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner Dark Charcoal Matte & Luxury Gold */}
      <div className="bg-gradient-to-br from-neutral-950 via-stone-900 to-neutral-900 border border-amber-500/35 rounded-2xl p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[11px] font-extrabold tracking-wide uppercase">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Leaderboard Presensi Real-Time Supabase • Cut-Off Tgl 26 s/d 25</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Tabel Peringkat &ldquo;Karyawan Terajin &amp; Disiplin&rdquo;
            </h2>
            <p className="text-xs text-stone-300 max-w-3xl leading-relaxed">
              Pemeringkatan otomatis seluruh karyawan aktif dari peringkat teratas (0 Alpha &amp; 0 Menit Terlambat) hingga peringkat terbawah berdasarkan rekap kehadiran, jam kerja aktual, rata-rata jam masuk, dan pemulihan Tukar Hari Libur Minggu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportLeaderboardCSV}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel / CSV ({filteredRows.length})</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-amber-500/20">
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-amber-500/25 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-stone-400 font-semibold block">
                Total Karyawan Aktif
              </span>
              <span className="text-lg font-extrabold text-white mt-0.5 block">
                {summaryCounts.total} Staf
              </span>
              <span className="text-[10px] text-amber-300/90 font-medium">
                Seluruh Karyawan Terdaftar
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBadgeFilter(badgeFilter === 'teladan' ? 'ALL' : 'teladan')}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              badgeFilter === 'teladan'
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/40'
                : 'bg-neutral-900/90 border-amber-500/30 hover:bg-neutral-800/90'
            }`}
          >
            <div>
              <span className="text-[11px] text-amber-300 font-bold block">
                🏆 Teladan / 100% Disiplin
              </span>
              <span className="text-lg font-extrabold text-amber-400 mt-0.5 block">
                {summaryCounts.teladanCount} Karyawan
              </span>
              <span className="text-[10px] text-stone-300">
                0 Alpha • 0 Menit Terlambat
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-neutral-950 font-bold shadow-sm">
              <Trophy className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setBadgeFilter(badgeFilter === 'cukup_disiplin' ? 'ALL' : 'cukup_disiplin')
            }
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              badgeFilter === 'cukup_disiplin'
                ? 'bg-yellow-500/25 border-yellow-400 ring-2 ring-yellow-400/40'
                : 'bg-neutral-900/90 border-yellow-500/25 hover:bg-neutral-800/90'
            }`}
          >
            <div>
              <span className="text-[11px] text-yellow-200 font-bold block">
                ⚡ Cukup Disiplin
              </span>
              <span className="text-lg font-extrabold text-yellow-300 mt-0.5 block">
                {summaryCounts.cukupCount} Karyawan
              </span>
              <span className="text-[10px] text-stone-300">
                0 Alpha • Terlambat 1–30 Menit
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              <Clock className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setBadgeFilter(badgeFilter === 'perlu_evaluasi' ? 'ALL' : 'perlu_evaluasi')
            }
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              badgeFilter === 'perlu_evaluasi'
                ? 'bg-rose-500/25 border-rose-400 ring-2 ring-rose-400/40'
                : 'bg-neutral-900/90 border-rose-500/30 hover:bg-neutral-800/90'
            }`}
          >
            <div>
              <span className="text-[11px] text-rose-300 font-bold block">
                ⚠️ Perlu Evaluasi / SP
              </span>
              <span className="text-lg font-extrabold text-rose-400 mt-0.5 block">
                {summaryCounts.evaluasiCount} Karyawan
              </span>
              <span className="text-[10px] text-stone-300">
                ≥ 1 Alpha atau Terlambat &gt; 30 Mnt
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </button>
        </div>
      </div>

      {/* Filter Bar: Periode Cut-Off, Status Badge, & Pencarian */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter Periode Cut-Off */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Periode Cut-Off (26 s/d 25)</span>
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
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

          {/* Filter Status Badge */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>Filter Status Badge Disiplin</span>
            </label>
            <select
              value={badgeFilter}
              onChange={(e) =>
                setBadgeFilter(e.target.value as 'ALL' | DisciplineBadgeCategory)
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Semua Status Badge ({summaryCounts.total})</option>
              <option value="teladan">
                🏆 Teladan / 100% Disiplin ({summaryCounts.teladanCount})
              </option>
              <option value="cukup_disiplin">
                ⚡ Cukup Disiplin ({summaryCounts.cukupCount})
              </option>
              <option value="perlu_evaluasi">
                ⚠️ Perlu Evaluasi / SP ({summaryCounts.evaluasiCount})
              </option>
            </select>
          </div>

          {/* Pencarian Karyawan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span>Cari Nama / NIK / Jabatan</span>
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama, NIK, atau jabatan..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Info Ringkasan Baris */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {(badgeFilter !== 'ALL' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setBadgeFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-neutral-900 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
              >
                Reset Filter ({summaryCounts.total})
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Menampilkan <strong>{filteredRows.length}</strong> dari{' '}
            <strong>{allRankedRows.length}</strong> karyawan aktif • Cut-Off{' '}
            <strong>{cutOffRangeLabel}</strong>
          </span>
        </div>
      </div>

      {/* Tabel Peringkat Lengkap */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-amber-300 font-bold border-b border-amber-500/30 text-[11px] uppercase tracking-wider">
                <th className="p-3.5 text-center w-20">Peringkat</th>
                <th className="p-3.5">Nama &amp; Jabatan / Cabang</th>
                <th className="p-3.5 text-center">Total Hadir</th>
                <th className="p-3.5 text-center">Jumlah Alpha</th>
                <th className="p-3.5 text-center">Total Terlambat</th>
                <th className="p-3.5 min-w-[180px]">Persentase Kehadiran</th>
                <th className="p-3.5">Badge Status Disiplin</th>
                {onSelectEmployeeForBonusOrReview && (
                  <th className="p-3.5 text-right">Aksi Evaluasi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={onSelectEmployeeForBonusOrReview ? 8 : 7}
                    className="p-10 text-center text-slate-500"
                  >
                    Tidak ada data karyawan yang sesuai dengan filter cabang atau status disiplin.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isTop1 = row.rank === 1;
                  const isTop2 = row.rank === 2;
                  const isTop3 = row.rank === 3;

                  return (
                    <tr
                      key={row.employeeId}
                      className={`transition-colors ${
                        isTop1
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : isTop2
                          ? 'bg-stone-50/80 hover:bg-stone-100/70'
                          : isTop3
                          ? 'bg-orange-50/40 hover:bg-orange-50/70'
                          : row.badgeCategory === 'perlu_evaluasi'
                          ? 'bg-rose-50/30 hover:bg-rose-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Kolom 1: Peringkat (#1, #2, dst) */}
                      <td className="p-3.5 text-center align-middle">
                        <div className="inline-flex flex-col items-center justify-center">
                          {isTop1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-neutral-950 font-black text-xs shadow-sm border border-amber-300">
                              <Trophy className="w-3.5 h-3.5" />
                              <span>#1</span>
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900 font-extrabold text-xs shadow-2xs border border-slate-400/50">
                              <Medal className="w-3.5 h-3.5 text-slate-700" />
                              <span>#2</span>
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-700/20 to-orange-700/20 text-amber-900 font-extrabold text-xs border border-amber-700/40">
                              <Award className="w-3.5 h-3.5 text-amber-700" />
                              <span>#3</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-xs border border-slate-200">
                              #{row.rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Kolom 2: Nama & Jabatan / Cabang (Green Lake City / Cipondoh) */}
                      <td className="p-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <img
                            src={row.employee.avatarUrl}
                            alt={row.fullName}
                            className={`w-9 h-9 rounded-full object-cover border shrink-0 ${
                              isTop1
                                ? 'border-amber-500 ring-2 ring-amber-400/40'
                                : 'border-slate-200'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {row.fullName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {row.nik}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700">{row.role}</span>
                              <span>•</span>
                              <span>{row.department}</span>
                              <span>•</span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  row.branchCategory === 'Green Lake City'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-neutral-900 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                {row.branchDisplayLabel}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px] border border-slate-200">
                                {row.workDaysPerWeek} Hari/Mgg
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 3: Total Hadir */}
                      <td className="p-3.5 text-center align-middle">
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-slate-900 text-xs sm:text-sm font-mono">
                            {row.presentDaysCount}{' '}
                            <span className="text-slate-400 font-normal">/</span>{' '}
                            {row.requiredWorkDays} <span className="text-[11px] font-sans">Hr</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Tepat Waktu: <strong className="text-slate-700">{row.onTimeDaysCount} Hr</strong> •{' '}
                            <strong className="text-slate-700">{row.totalActualWorkHours} Jam</strong>
                          </div>
                          {row.avgCheckInTimeLabel !== '-' && (
                            <div className="text-[10px] text-amber-800 font-semibold">
                              Rata-rata Masuk: {row.avgCheckInTimeLabel}
                            </div>
                          )}
                          {row.dayOffReplacementDaysCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">
                              <RefreshCw className="w-2.5 h-2.5" />
                              Tukar Hari Minggu: {row.dayOffReplacementDaysCount} Hr
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Kolom 4: Jumlah Alpha */}
                      <td className="p-3.5 text-center align-middle">
                        {row.alphaDaysCount === 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-extrabold text-xs">
                              0 Hari
                            </span>
                            {row.alphaDaysReplacedCount > 0 && (
                              <span className="text-[9px] text-amber-700 font-semibold mt-0.5">
                                (Pulih {row.alphaDaysReplacedCount} Hr via Minggu)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-xs">
                              {row.alphaDaysCount} Hari Alpha
                            </span>
                            <span className="text-[9px] text-rose-600 font-semibold mt-0.5">
                              Tunj. Kerajinan Hangus
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Kolom 5: Total Terlambat (menit) */}
                      <td className="p-3.5 text-center align-middle">
                        {row.totalLateMinutes === 0 ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-extrabold text-xs">
                            0 Menit
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-extrabold text-xs border ${
                                row.totalLateMinutes > 30
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-yellow-100 text-yellow-900 border-yellow-300'
                              }`}
                            >
                              {row.totalLateMinutes} Menit
                            </span>
                            <span className="text-[9px] text-slate-500 font-semibold mt-0.5">
                              {row.lateFrequency}x Terlambat • Tunj. Disiplin Rp 0
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Kolom 6: Persentase Kehadiran (dengan progress bar visual) */}
                      <td className="p-3.5 align-middle">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-900 font-mono">
                              {row.attendancePercentage}%
                            </span>
                            <span className="text-[10px] text-slate-500">
                              ({row.presentDaysCount}/{row.requiredWorkDays} Hari Wajib)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                row.badgeCategory === 'teladan'
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                                  : row.badgeCategory === 'cukup_disiplin'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-500'
                              }`}
                              style={{
                                width: `${Math.max(4, Math.min(100, row.attendancePercentage))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Kolom 7: Badge Status Disiplin */}
                      <td className="p-3.5 align-middle">
                        <div className="space-y-1">
                          {row.badgeCategory === 'teladan' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-neutral-950 via-stone-900 to-neutral-900 text-amber-300 border border-amber-400/60 font-extrabold text-[11px] shadow-2xs">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Teladan / 100% Disiplin</span>
                            </span>
                          )}
                          {row.badgeCategory === 'cukup_disiplin' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-400 font-extrabold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Cukup Disiplin</span>
                            </span>
                          )}
                          {row.badgeCategory === 'perlu_evaluasi' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[11px]">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Perlu Evaluasi / SP</span>
                            </span>
                          )}
                          <p className="text-[10px] text-slate-500 leading-snug">
                            {row.badgeSubtext}
                          </p>
                        </div>
                      </td>

                      {/* Kolom 8 Opsional: Aksi Evaluasi / Bonus */}
                      {onSelectEmployeeForBonusOrReview && (
                        <td className="p-3.5 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => onSelectEmployeeForBonusOrReview(row)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 font-extrabold text-[11px] inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Evaluasi &amp; Bonus</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
