import React, { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  X,
  Star,
  Users,
  Building,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  Edit2,
  Trash2,
  Eye,
  Check,
  Calculator,
  WalletCards,
  Clock,
  Layers,
  ThumbsUp,
  Target,
  Sliders,
  Bell,
  Send,
  AlertTriangle,
  CalendarPlus,
  BellRing,
} from 'lucide-react';
import {
  PerformanceReview,
  ReviewPeriodType,
  Employee,
  PayrollRecord,
  CompanyConfig,
  GoogleAdminUser,
  Department,
} from '../types';
import { formatRupiah, formatIndoDate } from '../utils/formatters';

interface PerformanceReviewViewProps {
  reviews: PerformanceReview[];
  employees: Employee[];
  payrolls: PayrollRecord[];
  companyConfig: CompanyConfig;
  adminUser?: GoogleAdminUser | null;
  onAddReview: (review: PerformanceReview, applyToPayrollImmediately?: boolean) => void;
  onUpdateReview: (review: PerformanceReview, applyToPayrollImmediately?: boolean) => void;
  onDeleteReview: (reviewId: string) => void;
  onApplyBonusToPayroll: (review: PerformanceReview) => void;
  onBatchApplyBonusesToPayroll: (reviewsToApply: PerformanceReview[]) => void;
  onNavigateToPayroll?: () => void;
  onOpenNewPeriod?: (data: {
    period: string;
    periodType: ReviewPeriodType;
    department: string;
    deadlineDate: string;
    notes?: string;
  }) => void;
  onSendDeadlineReminder?: (data: {
    period: string;
    deadlineDate: string;
    department?: string;
    pendingCount: number;
  }) => void;
}

// Grade calculation helper
export const calculatePerformanceGrade = (score: number): {
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  bonusPercent: number;
} => {
  if (score >= 90) {
    return {
      grade: 'A+',
      label: 'Istimewa / Luar Biasa',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-300',
      bonusPercent: 20, // 20% dari gaji pokok
    };
  }
  if (score >= 80) {
    return {
      grade: 'A',
      label: 'Sangat Baik',
      badgeBg: 'bg-teal-100',
      badgeText: 'text-teal-800',
      badgeBorder: 'border-teal-300',
      bonusPercent: 15,
    };
  }
  if (score >= 70) {
    return {
      grade: 'B+',
      label: 'Baik / Memenuhi Target',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      badgeBorder: 'border-blue-300',
      bonusPercent: 10,
    };
  }
  if (score >= 60) {
    return {
      grade: 'B',
      label: 'Cukup / Perlu Bimbingan',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-300',
      bonusPercent: 5,
    };
  }
  return {
    grade: 'C',
    label: 'Kurang / Perlu Peningkatan',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-300',
    bonusPercent: 0,
  };
};

export const PerformanceReviewView: React.FC<PerformanceReviewViewProps> = ({
  reviews,
  employees,
  payrolls,
  companyConfig,
  adminUser,
  onAddReview,
  onUpdateReview,
  onDeleteReview,
  onApplyBonusToPayroll,
  onBatchApplyBonusesToPayroll,
  onNavigateToPayroll,
  onOpenNewPeriod,
  onSendDeadlineReminder,
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);
  const [viewingReview, setViewingReview] = useState<PerformanceReview | null>(null);
  const [confirmDeleteReview, setConfirmDeleteReview] = useState<PerformanceReview | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Period Broadcast Modal
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [newPeriodForm, setNewPeriodForm] = useState<{
    period: string;
    periodType: ReviewPeriodType;
    department: string;
    deadlineDate: string;
    notes: string;
  }>({
    period: 'Q4 2026',
    periodType: 'Kuartalan',
    department: 'Semua Departemen',
    deadlineDate: '2026-10-25',
    notes: 'Penilaian kinerja & KPI triwulan keempat. Atasan diharapkan menyelesaikan evaluasi seluruh staf sebelum deadline cut-off.',
  });

  // Deadline Reminder Broadcast Modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderPeriod, setReminderPeriod] = useState<string>(companyConfig.currentPayrollPeriod || 'Oktober 2026');
  const [reminderDeadline, setReminderDeadline] = useState<string>('2026-10-25');
  const [reminderDept, setReminderDept] = useState<string>('Semua Departemen');

  // Form State
  const [formEmployeeId, setFormEmployeeId] = useState(employees[0]?.id || '');
  const [formPeriodType, setFormPeriodType] = useState<ReviewPeriodType>('Bulanan');
  const [formPeriod, setFormPeriod] = useState(companyConfig.currentPayrollPeriod || 'Oktober 2026');
  const [formReviewDate, setFormReviewDate] = useState(new Date().toISOString().slice(0, 10));
  
  // 4 Core Component Scores (Scale 1 - 100)
  const [formKpiScore, setFormKpiScore] = useState<number>(85);
  const [formDisciplineScore, setFormDisciplineScore] = useState<number>(85);
  const [formTeamworkScore, setFormTeamworkScore] = useState<number>(85);
  const [formInitiativeScore, setFormInitiativeScore] = useState<number>(85);

  // Notes & Feedback
  const [formStrengths, setFormStrengths] = useState('');
  const [formImprovements, setFormImprovements] = useState('');
  const [formGeneralFeedback, setFormGeneralFeedback] = useState('');
  
  // Custom bonus override option
  const [isCustomBonus, setIsCustomBonus] = useState(false);
  const [customBonusAmount, setCustomBonusAmount] = useState<number>(0);
  const [autoApplyToPayroll, setAutoApplyToPayroll] = useState(true);

  // Selected employee object for form calculation
  const selectedEmployeeObj = useMemo(() => {
    return employees.find((e) => e.id === formEmployeeId) || employees[0];
  }, [employees, formEmployeeId]);

  // Real-time weighted final score calculation
  const calculatedFinalScore = useMemo(() => {
    const weighted =
      formKpiScore * 0.4 +
      formDisciplineScore * 0.2 +
      formTeamworkScore * 0.2 +
      formInitiativeScore * 0.2;
    return Math.round(weighted);
  }, [formKpiScore, formDisciplineScore, formTeamworkScore, formInitiativeScore]);

  const calculatedGradeInfo = useMemo(() => {
    return calculatePerformanceGrade(calculatedFinalScore);
  }, [calculatedFinalScore]);

  // Recommended bonus calculation based on employee base salary
  const recommendedBonusAmount = useMemo(() => {
    if (isCustomBonus) return customBonusAmount;
    if (!selectedEmployeeObj) return 0;
    const base = selectedEmployeeObj.baseSalary || 5000000;
    const bonus = Math.round((base * calculatedGradeInfo.bonusPercent) / 100);
    return bonus;
  }, [isCustomBonus, customBonusAmount, selectedEmployeeObj, calculatedGradeInfo]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3500);
  };

  // Distinct periods for filter dropdown
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => set.add(r.period));
    if (companyConfig.currentPayrollPeriod) set.add(companyConfig.currentPayrollPeriod);
    return Array.from(set);
  }, [reviews, companyConfig.currentPayrollPeriod]);

  // Statistics Highlights
  const stats = useMemo(() => {
    const totalCount = reviews.length;
    const avgScore = totalCount > 0
      ? Math.round(reviews.reduce((acc, r) => acc + r.finalScore, 0) / totalCount)
      : 0;
    const totalBonusAllocated = reviews.reduce((acc, r) => acc + (r.recommendedBonus || 0), 0);
    const syncedCount = reviews.filter((r) => r.isBonusAppliedToPayroll).length;
    const gradeAplusCount = reviews.filter((r) => r.grade === 'A+' || r.grade === 'A').length;

    return {
      totalCount,
      avgScore,
      totalBonusAllocated,
      syncedCount,
      gradeAplusCount,
    };
  }, [reviews]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchSearch =
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.employeeNik.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.employeeRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reviewerName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPeriod = selectedPeriod === 'ALL' || r.period === selectedPeriod;
      const matchDept = selectedDept === 'ALL' || r.employeeDepartment === selectedDept;
      const matchGrade = selectedGrade === 'ALL' || r.grade === selectedGrade;

      return matchSearch && matchPeriod && matchDept && matchGrade;
    });
  }, [reviews, searchQuery, selectedPeriod, selectedDept, selectedGrade]);

  // Pending evaluations for deadline reminder
  const pendingEvaluationCount = useMemo(() => {
    const periodToCheck = reminderPeriod || companyConfig.currentPayrollPeriod;
    const reviewedEmpIds = new Set(
      reviews.filter((r) => r.period === periodToCheck).map((r) => r.employeeId)
    );
    const targetEmployees = employees.filter(
      (e) => e.isActive && (reminderDept === 'Semua Departemen' || e.department === reminderDept)
    );
    return Math.max(0, targetEmployees.length - reviewedEmpIds.size);
  }, [reviews, employees, reminderPeriod, reminderDept, companyConfig.currentPayrollPeriod]);

  // Broadcast new review period opened
  const handleBroadcastNewPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodForm.period.trim()) return;

    if (onOpenNewPeriod) {
      onOpenNewPeriod(newPeriodForm);
    }
    showToast(`Periode penilaian ${newPeriodForm.period} (${newPeriodForm.department}) berhasil dibuka & notifikasi broadcast telah dikirim ke Atasan / HRD!`);
    setIsNewPeriodModalOpen(false);
  };

  // Broadcast deadline reminder
  const handleSendReminderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSendDeadlineReminder) {
      onSendDeadlineReminder({
        period: reminderPeriod,
        deadlineDate: reminderDeadline,
        department: reminderDept,
        pendingCount: pendingEvaluationCount,
      });
    }
    showToast(`Pengingat deadline penilaian periode ${reminderPeriod} telah berhasil dikirim ke dashboard Atasan!`);
    setIsReminderModalOpen(false);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingReview(null);
    setFormEmployeeId(employees[0]?.id || '');
    setFormPeriodType('Bulanan');
    setFormPeriod(companyConfig.currentPayrollPeriod || 'Oktober 2026');
    setFormReviewDate(new Date().toISOString().slice(0, 10));
    setFormKpiScore(85);
    setFormDisciplineScore(90);
    setFormTeamworkScore(85);
    setFormInitiativeScore(85);
    setFormStrengths('Penyelesaian tugas harian konsisten dan proaktif mendukung pencapaian target divisi.');
    setFormImprovements('Tingkatkan ketelitian laporan administrasi dan komunikasi koordinasi berkala.');
    setFormGeneralFeedback('Performa kerja memuaskan dan memenuhi standar operasional PT Tas Grosir Import.');
    setIsCustomBonus(false);
    setCustomBonusAmount(0);
    setAutoApplyToPayroll(true);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rev: PerformanceReview) => {
    setEditingReview(rev);
    setFormEmployeeId(rev.employeeId);
    setFormPeriodType(rev.periodType);
    setFormPeriod(rev.period);
    setFormReviewDate(rev.reviewDate);
    setFormKpiScore(rev.kpiScore);
    setFormDisciplineScore(rev.disciplineScore);
    setFormTeamworkScore(rev.teamworkScore);
    setFormInitiativeScore(rev.initiativeScore);
    setFormStrengths(rev.strengthsNotes || '');
    setFormImprovements(rev.improvementsNotes || '');
    setFormGeneralFeedback(rev.generalFeedback || '');
    setIsCustomBonus(true);
    setCustomBonusAmount(rev.recommendedBonus);
    setAutoApplyToPayroll(!!rev.isBonusAppliedToPayroll);
    setIsAddModalOpen(true);
  };

  // Submit Review Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeObj) return;

    const finalScore = calculatedFinalScore;
    const grade = calculatedGradeInfo.grade;
    const finalBonus = isCustomBonus ? Number(customBonusAmount) : recommendedBonusAmount;

    if (editingReview) {
      const updated: PerformanceReview = {
        ...editingReview,
        employeeId: selectedEmployeeObj.id,
        employeeName: selectedEmployeeObj.fullName,
        employeeNik: selectedEmployeeObj.nik,
        employeeDepartment: selectedEmployeeObj.department,
        employeeRole: selectedEmployeeObj.role,
        periodType: formPeriodType,
        period: formPeriod,
        reviewDate: formReviewDate,
        reviewerName: adminUser?.name || 'Administrator Utama (TGI)',
        reviewerRole: adminUser?.role || 'Super Admin',
        kpiScore: Number(formKpiScore),
        disciplineScore: Number(formDisciplineScore),
        teamworkScore: Number(formTeamworkScore),
        initiativeScore: Number(formInitiativeScore),
        finalScore,
        grade,
        strengthsNotes: formStrengths.trim(),
        improvementsNotes: formImprovements.trim(),
        generalFeedback: formGeneralFeedback.trim(),
        recommendedBonus: finalBonus,
        isBonusAppliedToPayroll: autoApplyToPayroll ? true : editingReview.isBonusAppliedToPayroll,
        payrollPeriodApplied: autoApplyToPayroll ? formPeriod : editingReview.payrollPeriodApplied,
      };

      onUpdateReview(updated, autoApplyToPayroll);
      showToast(`Penilaian kinerja untuk ${selectedEmployeeObj.fullName} berhasil diperbarui!`);
    } else {
      const newReview: PerformanceReview = {
        id: `pr-${Date.now().toString().slice(-6)}`,
        employeeId: selectedEmployeeObj.id,
        employeeName: selectedEmployeeObj.fullName,
        employeeNik: selectedEmployeeObj.nik,
        employeeDepartment: selectedEmployeeObj.department,
        employeeRole: selectedEmployeeObj.role,
        periodType: formPeriodType,
        period: formPeriod,
        reviewDate: formReviewDate,
        reviewerName: adminUser?.name || 'Administrator Utama (TGI)',
        reviewerRole: adminUser?.role || 'Super Admin',
        kpiScore: Number(formKpiScore),
        disciplineScore: Number(formDisciplineScore),
        teamworkScore: Number(formTeamworkScore),
        initiativeScore: Number(formInitiativeScore),
        finalScore,
        grade,
        strengthsNotes: formStrengths.trim(),
        improvementsNotes: formImprovements.trim(),
        generalFeedback: formGeneralFeedback.trim(),
        recommendedBonus: finalBonus,
        isBonusAppliedToPayroll: autoApplyToPayroll,
        payrollPeriodApplied: autoApplyToPayroll ? formPeriod : undefined,
      };

      onAddReview(newReview, autoApplyToPayroll);
      showToast(
        `Penilaian kinerja ${selectedEmployeeObj.fullName} (Skor: ${finalScore}, Grade: ${grade}) berhasil disimpan${
          autoApplyToPayroll ? ' & bonus disinkronkan ke payroll' : ''
        }!`
      );
    }

    setIsAddModalOpen(false);
    setEditingReview(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'NIK',
      'Nama Karyawan',
      'Departemen',
      'Jabatan',
      'Periode',
      'Tipe Periode',
      'Tgl Penilaian',
      'Penilai',
      'Skor KPI (40%)',
      'Skor Disiplin (20%)',
      'Skor Kerjasama (20%)',
      'Skor Inisiatif (20%)',
      'Skor Akhir',
      'Grade',
      'Bonus Insentif (IDR)',
      'Status Payroll',
      'Kelebihan',
      'Area Peningkatan',
      'Feedback Atasan',
    ];

    const rows = filteredReviews.map((r) => [
      `"${r.employeeNik}"`,
      `"${r.employeeName}"`,
      `"${r.employeeDepartment}"`,
      `"${r.employeeRole}"`,
      `"${r.period}"`,
      `"${r.periodType}"`,
      `"${r.reviewDate}"`,
      `"${r.reviewerName}"`,
      r.kpiScore,
      r.disciplineScore,
      r.teamworkScore,
      r.initiativeScore,
      r.finalScore,
      `"${r.grade}"`,
      r.recommendedBonus,
      r.isBonusAppliedToPayroll ? '"Tersinkron"' : '"Belum Disinkron"',
      `"${r.strengthsNotes.replace(/"/g, '""')}"`,
      `"${r.improvementsNotes.replace(/"/g, '""')}"`,
      `"${r.generalFeedback.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TGI_Performance_Review_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Laporan penilaian kinerja berhasil diekspor ke format CSV!');
  };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200/60">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Penilaian Kinerja & KPI (Performance Review)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluasi berkala bulanan/kuartalan staf PT Tas Grosir Import & sinkronisasi otomatis bonus insentif ke modul Payroll.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToPayroll && (
            <button
              onClick={onNavigateToPayroll}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Buka Halaman Penggajian (Payroll)"
            >
              <WalletCards className="w-4 h-4 text-emerald-600" />
              <span>Buka Modul Payroll</span>
            </button>
          )}

          <button
            onClick={() => setIsNewPeriodModalOpen(true)}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Buka periode penilaian kinerja baru dan kirim notifikasi otomatis ke atasan"
          >
            <CalendarPlus className="w-4 h-4 text-blue-600" />
            <span>Buka Periode Baru</span>
          </button>

          <button
            onClick={() => setIsReminderModalOpen(true)}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Kirim pengingat batas akhir tenggat waktu (deadline reminder) penilaian ke atasan"
          >
            <BellRing className="w-4 h-4 text-amber-600" />
            <span>Kirim Reminder Deadline</span>
          </button>

          <button
            onClick={() => {
              const unapplied = reviews.filter((r) => !r.isBonusAppliedToPayroll);
              if (unapplied.length === 0) {
                // Apply all current reviews to update/re-sync
                onBatchApplyBonusesToPayroll(reviews);
                showToast(`Seluruh ${reviews.length} bonus insentif berhasil diperbarui di modul Payroll!`);
              } else {
                onBatchApplyBonusesToPayroll(unapplied);
                showToast(`${unapplied.length} bonus hasil penilaian berhasil disinkronkan ke modul Payroll!`);
              }
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Terapkan semua bonus penilaian kinerja ke modul payroll saat ini"
          >
            <Sparkles className="w-4 h-4" />
            <span>Sinkronkan Bonus ke Payroll</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Ekspor CSV Rekap Penilaian"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Beri Penilaian Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Rata-rata Skor Kinerja</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900">{stats.avgScore}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {stats.gradeAplusCount} staf Grade A+ & A
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <Target className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Total Evaluasi Karyawan</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.totalCount} Sesi</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Dari total {employees.length} karyawan aktif
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Total Alokasi Bonus Insentif</span>
            <span className="text-xl font-bold text-emerald-700 mt-1 block">
              {formatRupiah(stats.totalBonusAllocated)}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
              {stats.syncedCount} / {stats.totalCount} tersinkron ke payroll
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <WalletCards className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Skema Terintegrasi Payroll</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">Otomatisasi KPI</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Bonus dihitung dari % Gaji Pokok
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Info Banner Integrasi Bonus */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-emerald-50 p-4 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900">
              Integrasi Penilaian Kinerja dengan Bonus Insentif Payroll PT Tas Grosir Import
            </h4>
            <p className="text-slate-600 text-[11px] mt-0.5">
              Skor terbobot (KPI 40%, Kedisiplinan 20%, Kerjasama 20%, Inisiatif 20%) otomatis menentukan Grade:
              <strong> A+ (20%)</strong>, <strong>A (15%)</strong>, <strong>B+ (10%)</strong>, <strong>B (5%)</strong>, dan <strong>C (0%)</strong> dari Gaji Pokok karyawan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 bg-white/90 text-indigo-800 border border-indigo-200 rounded-lg font-semibold text-[11px]">
            Periode: {companyConfig.currentPayrollPeriod || 'Oktober 2026'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama karyawan, NIK, jabatan, atau penilai..."
            className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Periode */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Periode</option>
            {availablePeriods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Departemen */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Departemen</option>
            <option value="Teknologi & IT">Teknologi & IT</option>
            <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
            <option value="Operasional">Operasional</option>
            <option value="Human Resources & GA">Human Resources & GA</option>
            <option value="Pemasaran & Bisnis">Pemasaran & Bisnis</option>
            <option value="Layanan Pelanggan">Layanan Pelanggan</option>
          </select>

          {/* Grade */}
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden cursor-pointer font-semibold"
          >
            <option value="ALL">Semua Grade</option>
            <option value="A+">Grade A+ (90-100)</option>
            <option value="A">Grade A (80-89)</option>
            <option value="B+">Grade B+ (70-79)</option>
            <option value="B">Grade B (60-69)</option>
            <option value="C">Grade C (&lt;60)</option>
          </select>
        </div>
      </div>

      {/* Performance Reviews Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Periode & Dept</th>
                <th className="py-3 px-4 text-center">4 Komponen Penilaian</th>
                <th className="py-3 px-4 text-center">Skor & Grade</th>
                <th className="py-3 px-4">Bonus Insentif</th>
                <th className="py-3 px-4">Status Payroll</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Award className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">Tidak ada data penilaian kinerja yang cocok.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Klik &ldquo;Beri Penilaian Baru&rdquo; untuk memulai evaluasi kinerja karyawan.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReviews.map((rev) => {
                  const emp = employees.find((e) => e.id === rev.employeeId);
                  const gradeInfo = calculatePerformanceGrade(rev.finalScore);

                  return (
                    <tr key={rev.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Karyawan */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              emp?.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                            }
                            alt={rev.employeeName}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">
                              {rev.employeeName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 block">
                              {rev.employeeNik}
                            </span>
                            <span className="text-[11px] text-slate-600">{rev.employeeRole}</span>
                          </div>
                        </div>
                      </td>

                      {/* Periode & Dept */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block text-xs">
                          {rev.period}
                        </span>
                        <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-medium my-0.5">
                          {rev.periodType}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {rev.employeeDepartment}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Oleh: {rev.reviewerName}
                        </span>
                      </td>

                      {/* 4 Komponen Penilaian (Progress Bars) */}
                      <td className="py-3.5 px-4">
                        <div className="w-56 mx-auto space-y-1.5 text-[11px]">
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Kinerja Utama (KPI 40%)</span>
                              <span className="font-bold text-slate-800">{rev.kpiScore}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, rev.kpiScore)}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Kedisiplinan (20%)</span>
                              <span className="font-bold text-slate-800">{rev.disciplineScore}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500 rounded-full"
                                style={{ width: `${Math.min(100, rev.disciplineScore)}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Kerjasama Tim (20%)</span>
                              <span className="font-bold text-slate-800">{rev.teamworkScore}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, rev.teamworkScore)}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Inisiatif (20%)</span>
                              <span className="font-bold text-slate-800">{rev.initiativeScore}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${Math.min(100, rev.initiativeScore)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Skor & Grade */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xl font-extrabold text-slate-900 block leading-tight">
                          {rev.finalScore}
                        </span>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${gradeInfo.badgeBg} ${gradeInfo.badgeText} ${gradeInfo.badgeBorder}`}
                        >
                          Grade {rev.grade}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {gradeInfo.label}
                        </span>
                      </td>

                      {/* Bonus Insentif */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-700 text-xs block">
                          {formatRupiah(rev.recommendedBonus)}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {gradeInfo.bonusPercent}% Gaji Pokok
                        </span>
                      </td>

                      {/* Status Payroll */}
                      <td className="py-3.5 px-4">
                        {rev.isBonusAppliedToPayroll ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Tersinkron ke Gaji
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              Periode {rev.payrollPeriodApplied || rev.period}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold text-[10px]">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Belum Masuk Slip
                            </span>
                            <button
                              onClick={() => {
                                onApplyBonusToPayroll(rev);
                                showToast(`Bonus Rp ${formatRupiah(rev.recommendedBonus)} berhasil diterapkan ke slip gaji ${rev.employeeName}!`);
                              }}
                              className="block text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                            >
                              + Terapkan ke Payroll
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingReview(rev)}
                            title="Lihat Detail & Feedback Tertulis"
                            className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(rev)}
                            title="Edit Penilaian"
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteReview(rev)}
                            title="Hapus Penilaian"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: FORM PENILAIAN KINERJA (ADD / EDIT) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingReview ? 'Edit Penilaian Kinerja Karyawan' : 'Form Penilaian Kinerja & KPI Karyawan'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Evaluasi 4 komponen terbobot dan kalkulasi otomatis bonus insentif untuk slip gaji.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs mt-4">
              {/* Seksi 1: Pilihan Karyawan & Periode */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <span className="font-semibold text-slate-800 block text-xs border-b border-slate-200/80 pb-1">
                  1. Identitas Karyawan & Periode Penilaian
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Pilih Karyawan *</label>
                    <select
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      disabled={!!editingReview}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.nik}) - {emp.department} • {emp.role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tipe Periode *</label>
                    <select
                      value={formPeriodType}
                      onChange={(e) => setFormPeriodType(e.target.value as ReviewPeriodType)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 cursor-pointer"
                    >
                      <option value="Bulanan">Penilaian Bulanan</option>
                      <option value="Kuartalan">Penilaian Kuartalan (Quarterly)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Periode Evaluasi *</label>
                    <input
                      type="text"
                      value={formPeriod}
                      onChange={(e) => setFormPeriod(e.target.value)}
                      placeholder="e.g. Oktober 2026 atau Q4 2026"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Review *</label>
                    <input
                      type="date"
                      value={formReviewDate}
                      onChange={(e) => setFormReviewDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gaji Pokok Acuan</label>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold">
                      {formatRupiah(selectedEmployeeObj?.baseSalary || 5000000)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seksi 2: 4 Komponen Penilaian (Skala 1 - 100) */}
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200/70 space-y-3.5">
                <div className="flex items-center justify-between border-b border-indigo-200/80 pb-1.5">
                  <div>
                    <span className="font-bold text-indigo-950 block text-xs">
                      2. Komponen Penilaian Performa (Skala 1 - 100)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Geser slider atau masukkan angka nilai antara 1 s/d 100.
                    </p>
                  </div>

                  {/* Live Badge Skor Akhir */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Skor Terbobot:</span>
                      <span className="text-lg font-extrabold text-indigo-900 leading-tight">
                        {calculatedFinalScore} / 100
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${calculatedGradeInfo.badgeBg} ${calculatedGradeInfo.badgeText} ${calculatedGradeInfo.badgeBorder}`}
                    >
                      Grade {calculatedGradeInfo.grade}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Komponen 1: KPI (40%) */}
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">
                          A. Kinerja Utama (KPI) • <span className="text-indigo-600">Bobot 40%</span>
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Pencapaian target kerja departemen, kualitas hasil kerja, dan ketepatan tenggat waktu (SLA).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formKpiScore}
                          onChange={(e) => setFormKpiScore(Number(e.target.value))}
                          className="w-16 p-1.5 text-center font-bold text-sm bg-indigo-50 border border-indigo-300 rounded-lg text-indigo-900"
                        />
                        <span className="font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={formKpiScore}
                      onChange={(e) => setFormKpiScore(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  {/* Komponen 2: Kedisiplinan (20%) */}
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">
                          B. Kedisiplinan & Presensi • <span className="text-teal-600">Bobot 20%</span>
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Ketepatan jam masuk kerja/presensi, kepatuhan SOP perusahaan, dan integritas kehadiran.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formDisciplineScore}
                          onChange={(e) => setFormDisciplineScore(Number(e.target.value))}
                          className="w-16 p-1.5 text-center font-bold text-sm bg-teal-50 border border-teal-300 rounded-lg text-teal-900"
                        />
                        <span className="font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={formDisciplineScore}
                      onChange={(e) => setFormDisciplineScore(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                  </div>

                  {/* Komponen 3: Kerjasama Tim (20%) */}
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">
                          C. Kerjasama Tim & Komunikasi • <span className="text-blue-600">Bobot 20%</span>
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Koordinasi lintas divisi, empati kerja, komunikasi interpersonal, dan dukungan ke rekan kerja.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formTeamworkScore}
                          onChange={(e) => setFormTeamworkScore(Number(e.target.value))}
                          className="w-16 p-1.5 text-center font-bold text-sm bg-blue-50 border border-blue-300 rounded-lg text-blue-900"
                        />
                        <span className="font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={formTeamworkScore}
                      onChange={(e) => setFormTeamworkScore(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* Komponen 4: Inisiatif (20%) */}
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">
                          D. Inisiatif & Problem Solving • <span className="text-purple-600">Bobot 20%</span>
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Proaktif mencari solusi kendala, inovasi perbaikan proses kerja, dan kesediaan mengemban tugas baru.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formInitiativeScore}
                          onChange={(e) => setFormInitiativeScore(Number(e.target.value))}
                          className="w-16 p-1.5 text-center font-bold text-sm bg-purple-50 border border-purple-300 rounded-lg text-purple-900"
                        />
                        <span className="font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={formInitiativeScore}
                      onChange={(e) => setFormInitiativeScore(Number(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 3: Catatan & Feedback Tertulis Atasan */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <span className="font-semibold text-slate-800 block text-xs border-b border-slate-200/80 pb-1">
                  3. Catatan Evaluasi & Feedback Tertulis dari Atasan
                </span>

                <div className="space-y-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                      Kelebihan & Prestasi Karyawan (Strengths) *
                    </label>
                    <textarea
                      rows={2}
                      value={formStrengths}
                      onChange={(e) => setFormStrengths(e.target.value)}
                      placeholder="Tuliskan aspek positif, keberhasilan proyek, atau pencapaian target yang menonjol..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Area yang Perlu Ditingkatkan (Improvements) *
                    </label>
                    <textarea
                      rows={2}
                      value={formImprovements}
                      onChange={(e) => setFormImprovements(e.target.value)}
                      placeholder="Hal-hal yang perlu diperbaiki atau kompetensi yang perlu ditingkatkan di periode depan..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-indigo-600" />
                      Catatan & Feedback Keseluruhan dari Atasan (Overall Review) *
                    </label>
                    <textarea
                      rows={2}
                      value={formGeneralFeedback}
                      onChange={(e) => setFormGeneralFeedback(e.target.value)}
                      placeholder="Pesan penutup, apresiasi, atau arahan motivasi strategis dari manajemen..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 4: Integrasi Bonus Insentif ke Payroll */}
              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                    <WalletCards className="w-4 h-4 text-emerald-700" />
                    4. Rekomendasi Bonus Insentif Payroll
                  </span>
                  <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                    {calculatedGradeInfo.bonusPercent}% dari Gaji Pokok
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-slate-600 text-xs block">Nominal Bonus Insentif Hasil Kinerja:</span>
                    <span className="text-xl font-extrabold text-emerald-800 block">
                      {formatRupiah(isCustomBonus ? customBonusAmount : recommendedBonusAmount)}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isCustomBonus
                        ? 'Nominal disesuaikan secara kustom oleh atasan.'
                        : `Otomatis: ${calculatedGradeInfo.bonusPercent}% x ${formatRupiah(selectedEmployeeObj?.baseSalary || 0)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomBonus(!isCustomBonus);
                        if (!isCustomBonus) {
                          setCustomBonusAmount(recommendedBonusAmount);
                        }
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      {isCustomBonus ? 'Kembalikan ke Formula Otomatis' : 'Ubah Nominal Kustom'}
                    </button>
                  </div>
                </div>

                {isCustomBonus && (
                  <div className="pt-2 border-t border-emerald-200/70">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Masukkan Nominal Bonus Insentif Kustom (IDR)
                    </label>
                    <input
                      type="number"
                      step={50000}
                      value={customBonusAmount}
                      onChange={(e) => setCustomBonusAmount(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-emerald-300 rounded-xl text-emerald-900 font-bold"
                    />
                  </div>
                )}

                <div className="pt-2.5 border-t border-emerald-200/70">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoApplyToPayroll}
                      onChange={(e) => setAutoApplyToPayroll(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-slate-800 text-xs">
                      Langsung sinkronkan bonus insentif ini ke komponen gaji (Payroll) periode {formPeriod}
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 pl-6 mt-0.5">
                    Jika dicentang, kolom Bonus di menu Payroll akan diperbarui otomatis dan langsung menambah Take-Home Pay karyawan.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingReview ? 'Simpan Perubahan Penilaian' : 'Simpan Penilaian Kinerja'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW FULL REVIEW DETAIL & FEEDBACK */}
      {viewingReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Kartu Hasil Penilaian Kinerja Karyawan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Periode: {viewingReview.period} ({viewingReview.periodType})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Cetak Laporan Penilaian"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewingReview(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs mt-4">
              {/* Info Karyawan Header */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-base font-bold text-slate-900 block">
                    {viewingReview.employeeName}
                  </span>
                  <span className="font-mono text-xs text-slate-600 block mt-0.5">
                    NIK: {viewingReview.employeeNik} • {viewingReview.employeeRole}
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Departemen: {viewingReview.employeeDepartment}
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold">SKOR AKHIR</span>
                    <span className="text-2xl font-black text-slate-900 leading-tight">
                      {viewingReview.finalScore}
                    </span>
                  </div>
                  <div className="text-center pl-2 border-l border-slate-200">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${calculatePerformanceGrade(viewingReview.finalScore).badgeBg} ${calculatePerformanceGrade(viewingReview.finalScore).badgeText} ${calculatePerformanceGrade(viewingReview.finalScore).badgeBorder}`}
                    >
                      Grade {viewingReview.grade}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rincian 4 Komponen */}
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
                <span className="font-bold text-indigo-950 block text-xs">
                  Rincian Nilai 4 Komponen Evaluasi
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block">KPI (40%)</span>
                    <span className="text-lg font-bold text-indigo-700 block mt-1">
                      {viewingReview.kpiScore}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-teal-100 text-center">
                    <span className="text-[10px] text-slate-500 block">Disiplin (20%)</span>
                    <span className="text-lg font-bold text-teal-700 block mt-1">
                      {viewingReview.disciplineScore}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 text-center">
                    <span className="text-[10px] text-slate-500 block">Kerjasama (20%)</span>
                    <span className="text-lg font-bold text-blue-700 block mt-1">
                      {viewingReview.teamworkScore}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-purple-100 text-center">
                    <span className="text-[10px] text-slate-500 block">Inisiatif (20%)</span>
                    <span className="text-lg font-bold text-purple-700 block mt-1">
                      {viewingReview.initiativeScore}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback Atasan */}
              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
                    Kelebihan & Prestasi Karyawan (Strengths)
                  </span>
                  <p className="text-slate-700 mt-1 leading-relaxed text-xs">
                    {viewingReview.strengthsNotes || 'Tidak ada catatan khusus.'}
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    Area yang Perlu Ditingkatkan (Improvements)
                  </span>
                  <p className="text-slate-700 mt-1 leading-relaxed text-xs">
                    {viewingReview.improvementsNotes || 'Tidak ada catatan khusus.'}
                  </p>
                </div>

                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
                    <Star className="w-3.5 h-3.5 text-indigo-700" />
                    Catatan & Arahan Keseluruhan dari Atasan
                  </span>
                  <p className="text-slate-700 mt-1 leading-relaxed text-xs italic">
                    &ldquo;{viewingReview.generalFeedback}&rdquo;
                  </p>
                  <span className="block text-[10px] text-slate-400 mt-2 text-right">
                    — {viewingReview.reviewerName} ({viewingReview.reviewerRole}), {formatIndoDate(viewingReview.reviewDate)}
                  </span>
                </div>
              </div>

              {/* Bonus Insentif Info */}
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block">
                    Bonus Insentif Berdasarkan Kinerja
                  </span>
                  <span className="text-lg font-black text-emerald-800">
                    {formatRupiah(viewingReview.recommendedBonus)}
                  </span>
                </div>
                <div>
                  {viewingReview.isBonusAppliedToPayroll ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-full font-bold text-xs shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tersinkron ke Payroll ({viewingReview.payrollPeriodApplied || viewingReview.period})
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onApplyBonusToPayroll(viewingReview);
                        setViewingReview({
                          ...viewingReview,
                          isBonusAppliedToPayroll: true,
                          payrollPeriodApplied: viewingReview.period,
                        });
                        showToast(`Bonus berhasil diterapkan ke slip gaji ${viewingReview.employeeName}!`);
                      }}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Terapkan ke Payroll Sekarang
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end mt-4">
              <button
                onClick={() => setViewingReview(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600 mb-2">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-bold text-slate-900 text-sm">Hapus Penilaian Kinerja?</h4>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus catatan penilaian kinerja untuk{' '}
              <strong>{confirmDeleteReview.employeeName}</strong> periode {confirmDeleteReview.period}?
            </p>
            <div className="pt-4 mt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteReview(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteReview(confirmDeleteReview.id);
                  setConfirmDeleteReview(null);
                  showToast('Catatan penilaian kinerja berhasil dihapus.');
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BUKA PERIODE PENILAIAN BARU & BROADCAST NOTIFIKASI */}
      {isNewPeriodModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buka Periode Penilaian Baru</h3>
                  <p className="text-xs text-slate-500">Kirim notifikasi otomatis ke dashboard Atasan & HRD</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewPeriodModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBroadcastNewPeriod} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Periode Penilaian <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newPeriodForm.period}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, period: e.target.value })}
                    placeholder="Contoh: Q4 2026 atau November 2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipe Periode</label>
                  <select
                    value={newPeriodForm.periodType}
                    onChange={(e) =>
                      setNewPeriodForm({
                        ...newPeriodForm,
                        periodType: e.target.value as ReviewPeriodType,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="Kuartalan">Kuartalan (Triwulan)</option>
                    <option value="Bulanan">Bulanan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Departemen</label>
                  <select
                    value={newPeriodForm.department}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="Semua Departemen">Semua Departemen</option>
                    <option value="Teknologi & IT">Teknologi & IT</option>
                    <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Human Resources & GA">Human Resources & GA</option>
                    <option value="Pemasaran & Bisnis">Pemasaran & Bisnis</option>
                    <option value="Layanan Pelanggan">Layanan Pelanggan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Tenggat Waktu (Deadline) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newPeriodForm.deadlineDate}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, deadlineDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Arahan / Catatan untuk Seluruh Atasan & Reviewer
                </label>
                <textarea
                  rows={2}
                  value={newPeriodForm.notes}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, notes: e.target.value })}
                  placeholder="Berikan arahan terkait pembobotan atau fokus evaluasi periode ini..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>

              {/* Informative Callout */}
              <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 flex items-start gap-2 text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Sistem akan otomatis mengirimkan notifikasi in-app ke bilah lonceng Atasan/HRD serta mencatat event{' '}
                  <code className="bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono font-bold">
                    NOTIFICATION_SENT
                  </code>{' '}
                  pada Log Audit Trail sistem di bawah kategori <strong>Notifikasi Sistem</strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Buka Periode & Kirim Notifikasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: KIRIM PENGINGAT TENGGAT WAKTU (DEADLINE REMINDER) */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Kirim Pengingat Deadline Penilaian</h3>
                  <p className="text-xs text-slate-500">Peringatkan atasan tentang batas akhir cut-off KPI</p>
                </div>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendReminderSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Periode Evaluasi</label>
                  <select
                    value={reminderPeriod}
                    onChange={(e) => setReminderPeriod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 font-medium cursor-pointer"
                  >
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Departemen</label>
                  <select
                    value={reminderDept}
                    onChange={(e) => setReminderDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="Semua Departemen">Semua Departemen</option>
                    <option value="Teknologi & IT">Teknologi & IT</option>
                    <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Human Resources & GA">Human Resources & GA</option>
                    <option value="Pemasaran & Bisnis">Pemasaran & Bisnis</option>
                    <option value="Layanan Pelanggan">Layanan Pelanggan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Batas Akhir Tenggat (Deadline)</label>
                <input
                  type="date"
                  value={reminderDeadline}
                  onChange={(e) => setReminderDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 font-medium"
                />
              </div>

              {/* Status Pending Counter Card */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-amber-800 block">Karyawan Belum Dievaluasi</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-amber-900">{pendingEvaluationCount}</span>
                    <span className="text-xs text-amber-700 font-medium">orang staf</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    Prioritas URGENT
                  </span>
                  <p className="text-[10px] text-amber-700 mt-1">Notifikasi badge merah menyala</p>
                </div>
              </div>

              {/* Informative Callout */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Pesan peringatan akan langsung masuk ke bilah lonceng notifikasi seluruh atasan yang belum melengkapi penilaian staf. Setiap pengiriman tercatat otomatis ke <strong>Audit Trail (NOTIFICATION_SENT)</strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReminderModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pengingat Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
