import React, { useState, useMemo } from 'react';
import {
  HandCoins,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  ArrowRight,
  TrendingUp,
  Receipt,
  Building,
  User,
  Eye,
  Send,
  Check,
  X,
  CreditCard,
  FileText,
  BadgeAlert,
  Percent,
  Sparkles,
  ChevronDown,
  Info,
  CalendarCheck,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import {
  CashAdvance,
  CashAdvanceStatus,
  CashAdvanceTenorMonths,
  Employee,
  PayrollRecord,
  GoogleAdminUser,
  ActivityActionType,
  ActivityCategory,
  CompanyConfig,
} from '../types';
import { formatRupiah, formatIndoDate } from '../utils/formatters';
import { getCashAdvanceStatusWhatsAppUrl, formatWhatsAppPhone } from '../utils/notificationHelper';

interface CashAdvanceViewProps {
  cashAdvances: CashAdvance[];
  employees: Employee[];
  payrolls: PayrollRecord[];
  companyConfig: CompanyConfig;
  adminUser?: GoogleAdminUser | null;
  onApproveCashAdvance: (id: string, notes?: string) => void;
  onRejectCashAdvance: (id: string, reason: string) => void;
  onDisburseCashAdvance: (
    id: string,
    details: {
      method: 'Bank Transfer' | 'Tunai / Petty Cash';
      reference: string;
      notes?: string;
    }
  ) => void;
  onCreateCashAdvance?: (advanceData: Omit<CashAdvance, 'id' | 'createdAt' | 'status' | 'totalPaid' | 'remainingBalance' | 'installments'>) => void;
  onApplyDeductionToPayroll?: (advanceId: string, installmentNumber: number) => void;
  onNavigateToPayroll?: () => void;
}

export function CashAdvanceView({
  cashAdvances,
  employees,
  payrolls,
  companyConfig,
  adminUser,
  onApproveCashAdvance,
  onRejectCashAdvance,
  onDisburseCashAdvance,
  onCreateCashAdvance,
  onApplyDeductionToPayroll,
  onNavigateToPayroll,
}: CashAdvanceViewProps) {
  // State Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [selectedAdvanceForSchedule, setSelectedAdvanceForSchedule] = useState<CashAdvance | null>(null);
  const [disburseModalAdvance, setDisburseModalAdvance] = useState<CashAdvance | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<'Bank Transfer' | 'Tunai / Petty Cash'>('Bank Transfer');
  const [disburseReference, setDisburseReference] = useState<string>('');
  const [disburseNotes, setDisburseNotes] = useState<string>('');

  // Reject Modal
  const [rejectModalAdvance, setRejectModalAdvance] = useState<CashAdvance | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Quick WhatsApp Notification Prompt after Admin clicks Setujui / Tolak / Cairkan
  const [waQuickPrompt, setWaQuickPrompt] = useState<{
    advance: CashAdvance;
    status: CashAdvanceStatus;
    emp?: Employee;
  } | null>(null);
  const [adminWaNote, setAdminWaNote] = useState<string>('');

  // Admin New Advance Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newEmployeeId, setNewEmployeeId] = useState<string>('');
  const [newAmount, setNewAmount] = useState<number>(1000000);
  const [newTenor, setNewTenor] = useState<CashAdvanceTenorMonths>(3);
  const [newReason, setNewReason] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Selected employee for new advance
  const selectedEmpForNew = useMemo(() => {
    return employees.find((e) => e.id === newEmployeeId);
  }, [employees, newEmployeeId]);

  // Max plafon for selected employee (100% Gaji Pokok)
  const maxPlafon = selectedEmpForNew ? selectedEmpForNew.baseSalary : 0;
  const calculatedMonthly = Math.round(newAmount / newTenor);

  // Calculate Metrics
  const metrics = useMemo(() => {
    const totalCount = cashAdvances.length;
    const pendingCount = cashAdvances.filter((c) => c.status === 'pending').length;
    const approvedCount = cashAdvances.filter((c) => c.status === 'approved').length;
    const activeCount = cashAdvances.filter((c) => c.status === 'disbursed').length;
    const paidCount = cashAdvances.filter((c) => c.status === 'paid').length;

    const totalDisbursedAmount = cashAdvances
      .filter((c) => c.status === 'disbursed' || c.status === 'paid')
      .reduce((sum, c) => sum + c.amount, 0);

    const totalRemainingBalance = cashAdvances
      .filter((c) => c.status === 'disbursed')
      .reduce((sum, c) => sum + c.remainingBalance, 0);

    const currentMonthInstallmentDue = cashAdvances
      .filter((c) => c.status === 'disbursed')
      .reduce((sum, c) => {
        const due = c.installments.find(
          (inst) => inst.status === 'scheduled' && (inst.period === companyConfig.currentPayrollPeriod)
        );
        return sum + (due ? due.amount : 0);
      }, 0);

    return {
      totalCount,
      pendingCount,
      approvedCount,
      activeCount,
      paidCount,
      totalDisbursedAmount,
      totalRemainingBalance,
      currentMonthInstallmentDue,
    };
  }, [cashAdvances, companyConfig.currentPayrollPeriod]);

  // Filtered List
  const filteredAdvances = useMemo(() => {
    return cashAdvances.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Department filter
      if (departmentFilter !== 'all' && item.department !== departmentFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.employeeName.toLowerCase().includes(q);
        const matchesNik = item.employeeNik.toLowerCase().includes(q);
        const matchesDept = item.department.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesReason = item.reason.toLowerCase().includes(q);
        if (!matchesName && !matchesNik && !matchesDept && !matchesId && !matchesReason) return false;
      }

      return true;
    });
  }, [cashAdvances, statusFilter, departmentFilter, searchQuery]);

  // Unique departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.department));
    return Array.from(set);
  }, [employees]);

  // Status Badge Helper
  const getStatusBadge = (status: CashAdvanceStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Menunggu Persetujuan',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
        };
      case 'approved':
        return {
          label: 'Disetujui HRD (Siap Cair)',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          dotClass: 'bg-blue-500',
        };
      case 'disbursed':
        return {
          label: 'Aktif (Sedang Dicicil)',
          badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          dotClass: 'bg-indigo-500',
        };
      case 'paid':
        return {
          label: 'Lunas',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-500',
        };
      case 'rejected':
        return {
          label: 'Ditolak',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          dotClass: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          dotClass: 'bg-slate-400',
        };
    }
  };

  const handleOpenDisburseModal = (advance: CashAdvance) => {
    setDisburseModalAdvance(advance);
    setDisburseMethod('Bank Transfer');
    setDisburseReference(`TRF-${companyConfig.disbursementBank.split(' ')[0]}-${Date.now().toString().slice(-6)}`);
    setDisburseNotes(`Pencairan kasbon ${advance.employeeName} periode ${companyConfig.currentPayrollPeriod}`);
  };

  const handleConfirmDisburse = () => {
    if (!disburseModalAdvance) return;
    const refStr = disburseReference || `DISB-${Date.now().toString().slice(-6)}`;
    onDisburseCashAdvance(disburseModalAdvance.id, {
      method: disburseMethod,
      reference: refStr,
      notes: disburseNotes,
    });
    const emp = employees.find((e) => e.id === disburseModalAdvance.employeeId);
    setAdminWaNote(
      disburseNotes ||
        `Dana kasbon sebesar ${formatRupiah(disburseModalAdvance.amount)} telah dicairkan via ${disburseMethod} (Ref: ${refStr}).`
    );
    setWaQuickPrompt({
      advance: {
        ...disburseModalAdvance,
        status: 'disbursed',
        disbursementMethod: disburseMethod,
        disbursementReference: refStr,
        notes: disburseNotes,
      },
      status: 'disbursed',
      emp,
    });
    setDisburseModalAdvance(null);
  };

  const handleOpenRejectModal = (advance: CashAdvance) => {
    setRejectModalAdvance(advance);
    setRejectionReason('');
  };

  const handleConfirmReject = () => {
    if (!rejectModalAdvance || !rejectionReason.trim()) return;
    onRejectCashAdvance(rejectModalAdvance.id, rejectionReason.trim());
    const emp = employees.find((e) => e.id === rejectModalAdvance.employeeId);
    setAdminWaNote(rejectionReason.trim());
    setWaQuickPrompt({
      advance: {
        ...rejectModalAdvance,
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
      },
      status: 'rejected',
      emp,
    });
    setRejectModalAdvance(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForNew) {
      setFormError('Pilih karyawan terlebih dahulu.');
      return;
    }
    if (newAmount <= 0) {
      setFormError('Nominal kasbon harus lebih dari Rp 0.');
      return;
    }
    if (newAmount > maxPlafon) {
      setFormError(`Nominal kasbon melebihi plafon maksimum 100% gaji pokok (${formatRupiah(maxPlafon)}).`);
      return;
    }
    if (!newReason.trim()) {
      setFormError('Alasan keperluan kasbon wajib diisi.');
      return;
    }

    if (onCreateCashAdvance) {
      onCreateCashAdvance({
        employeeId: selectedEmpForNew.id,
        employeeName: selectedEmpForNew.fullName,
        employeeNik: selectedEmpForNew.nik,
        department: selectedEmpForNew.department,
        position: selectedEmpForNew.role,
        baseSalary: selectedEmpForNew.baseSalary,
        maxAllowedAmount: selectedEmpForNew.baseSalary,
        amount: newAmount,
        reason: newReason.trim(),
        tenorMonths: newTenor,
        monthlyInstallment: Math.round(newAmount / newTenor),
      });
    }

    setIsCreateModalOpen(false);
    setNewEmployeeId('');
    setNewAmount(1000000);
    setNewTenor(3);
    setNewReason('');
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
              <HandCoins className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Manajemen Kasbon & Cicilan Potongan Gaji (Cash Advance)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola persetujuan pinjaman kasbon darurat karyawan, otorisasi pencairan dana, dan sinkronisasi otomatis potongan cicilan ke modul Payroll PT Tas Grosir Import.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToPayroll && (
            <button
              onClick={onNavigateToPayroll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-slate-500" />
              Buka Slip Gaji & Payroll
            </button>
          )}

          <button
            onClick={() => {
              setNewEmployeeId(employees[0]?.id || '');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Input Kasbon Karyawan
          </button>
        </div>
      </div>

      {/* Banner Cepat Kirim Notifikasi WA ke Karyawan setelah Setujui / Tolak / Cairkan */}
      {waQuickPrompt && (
        <div
          className={`p-4 rounded-2xl border shadow-sm flex flex-col gap-3 animate-in fade-in ${
            waQuickPrompt.status === 'rejected'
              ? 'bg-rose-50/90 border-rose-300'
              : 'bg-emerald-50/90 border-emerald-300'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  waQuickPrompt.status === 'rejected'
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Pengajuan Kasbon {waQuickPrompt.advance.employeeName} (
                  {formatRupiah(waQuickPrompt.advance.amount)}) telah{' '}
                  <span
                    className={
                      waQuickPrompt.status === 'rejected' ? 'text-rose-700' : 'text-emerald-700'
                    }
                  >
                    {waQuickPrompt.status === 'approved'
                      ? 'DISETUJUI'
                      : waQuickPrompt.status === 'disbursed'
                      ? 'DICAIRKAN'
                      : 'DITOLAK'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Nomor WA Karyawan:{' '}
                  <strong className="font-mono text-slate-800">
                    {formatWhatsAppPhone(waQuickPrompt.emp?.phone)
                      ? `+${formatWhatsAppPhone(waQuickPrompt.emp?.phone)}`
                      : 'Belum diisi (akan membuka kontak WA)'}
                  </strong>{' '}
                  — Sesuaikan catatan admin di bawah lalu klik tombol untuk mengirim WhatsApp.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWaQuickPrompt(null)}
              className="self-end sm:self-center p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              title="Tutup panel notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              value={adminWaNote}
              onChange={(e) => setAdminWaNote(e.target.value)}
              placeholder="Catatan admin / finance untuk disertakan di pesan WhatsApp..."
              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-600"
            />
            <a
              href={getCashAdvanceStatusWhatsAppUrl(
                waQuickPrompt.emp,
                waQuickPrompt.advance,
                waQuickPrompt.status,
                adminWaNote,
                companyConfig.companyName
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs inline-flex items-center justify-center gap-1.5 shadow-sm shrink-0 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kirim Notifikasi WA ke Karyawan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Metric Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending Approval */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Menunggu Persetujuan
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{metrics.pendingCount}</span>
              <span className="text-xs text-amber-700 font-semibold">Pengajuan Baru</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Perlu review HR/Finance</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Ready for Disbursement */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Siap Dicairkan (Disbursement)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-700">{metrics.approvedCount}</span>
              <span className="text-xs text-blue-600 font-medium">Disetujui HR</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Menunggu transfer dana</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Active Advances & Remaining Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Sisa Piutang Kasbon Berjalan
            </span>
            <div className="mt-1">
              <span className="text-xl font-black text-indigo-700">{formatRupiah(metrics.totalRemainingBalance)}</span>
            </div>
            <span className="text-[11px] text-indigo-600 font-medium mt-0.5 block">
              {metrics.activeCount} kasbon aktif sedang dicicil
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Current Month Deduction Target */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Potongan Kasbon {companyConfig.currentPayrollPeriod}
            </span>
            <div className="mt-1">
              <span className="text-xl font-black text-emerald-700">{formatRupiah(metrics.currentMonthInstallmentDue)}</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
              Otomatis terpotong di payroll
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kasbon berdasarkan nama staf, NIK, ID kasbon, alasan keperluan..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status and Department Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">Semua Status ({cashAdvances.length})</option>
              <option value="pending">Menunggu Persetujuan ({metrics.pendingCount})</option>
              <option value="approved">Disetujui HRD ({metrics.approvedCount})</option>
              <option value="disbursed">Aktif / Sedang Dicicil ({metrics.activeCount})</option>
              <option value="paid">Lunas ({metrics.paidCount})</option>
              <option value="rejected">Ditolak</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">Semua Departemen</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Daftar Permohonan & Jadwal Cicilan Kasbon ({filteredAdvances.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Periode Gaji Berjalan: <strong className="text-slate-800">{companyConfig.currentPayrollPeriod}</strong>
          </span>
        </div>

        {filteredAdvances.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <HandCoins className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Tidak ada data kasbon ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada permohonan kasbon yang sesuai dengan filter pencarian atau status yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Karyawan & Info</th>
                  <th className="py-3 px-3">Nominal & Plafon</th>
                  <th className="py-3 px-3">Tenor & Cicilan / Bulan</th>
                  <th className="py-3 px-3">Progres Pelunasan</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Tgl Pengajuan</th>
                  <th className="py-3 px-4 text-right">Aksi & Persetujuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdvances.map((adv) => {
                  const emp = employees.find((e) => e.id === adv.employeeId);
                  const statusStyle = getStatusBadge(adv.status);
                  const progressPct = adv.amount > 0 ? Math.round((adv.totalPaid / adv.amount) * 100) : 0;
                  const deductedCount = adv.installments.filter((i) => i.status === 'deducted').length;

                  return (
                    <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Column 1: Employee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              emp?.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                            }
                            alt={adv.employeeName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{adv.employeeName}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({adv.employeeNik})</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{adv.position}</div>
                            <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600">
                              {adv.department}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Amount & Plafon */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-sm text-slate-900">{formatRupiah(adv.amount)}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Plafon Max: {formatRupiah(adv.maxAllowedAmount)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Gaji Pokok: {formatRupiah(adv.baseSalary)}
                        </div>
                      </td>

                      {/* Column 3: Tenor & Monthly Installment */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {adv.tenorMonths} Bulan
                        </div>
                        <div className="text-indigo-700 font-bold mt-0.5">
                          {formatRupiah(adv.monthlyInstallment)} / bln
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5" title={adv.reason}>
                          Ket: "{adv.reason}"
                        </div>
                      </td>

                      {/* Column 4: Progress */}
                      <td className="py-3.5 px-3 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-700">
                            {deductedCount} dari {adv.tenorMonths} Bln
                          </span>
                          <span className="font-bold text-slate-900">{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              adv.status === 'paid' ? 'bg-emerald-600' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>Terbayar: {formatRupiah(adv.totalPaid)}</span>
                          <span className="font-semibold text-amber-700">
                            Sisa: {formatRupiah(adv.remainingBalance)}
                          </span>
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusStyle.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`} />
                          {statusStyle.label}
                        </span>
                        {adv.disbursementReference && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Ref: {adv.disbursementReference}
                          </div>
                        )}
                        {adv.rejectionReason && (
                          <div className="text-[10px] text-rose-600 mt-1 line-clamp-1" title={adv.rejectionReason}>
                            Alasan: {adv.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Column 6: Created Date */}
                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        <div>{formatIndoDate(adv.createdAt)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">ID: {adv.id}</div>
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Schedule Breakdown button */}
                          <button
                            type="button"
                            onClick={() => setSelectedAdvanceForSchedule(adv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
                            title="Lihat Jadwal Rincian Cicilan"
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <span>Jadwal</span>
                          </button>

                          {/* If Pending: Approve & Reject buttons */}
                          {adv.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const note =
                                    'Permohonan kasbon Anda telah disetujui HRD PT Tas Grosir Import dan segera diproses pencairannya oleh tim Finance.';
                                  onApproveCashAdvance(adv.id, note);
                                  setAdminWaNote(note);
                                  setWaQuickPrompt({
                                    advance: { ...adv, status: 'approved', notes: note },
                                    status: 'approved',
                                    emp,
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Setujui</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRejectModal(adv)}
                                className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer transition-all border border-rose-200"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Tolak</span>
                              </button>
                            </>
                          )}

                          {/* If Approved: Disburse button */}
                          {adv.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDisburseModal(adv)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Cairkan Dana</span>
                            </button>
                          )}

                          {/* If Disbursed: Option to check / sync to payroll */}
                          {adv.status === 'disbursed' && onApplyDeductionToPayroll && (
                            <button
                              type="button"
                              onClick={() => {
                                const currentScheduled = adv.installments.find(
                                  (i) => i.status === 'scheduled'
                                );
                                if (currentScheduled) {
                                  onApplyDeductionToPayroll(adv.id, currentScheduled.installmentNumber);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
                              title="Sinkronkan potongan angsuran bulan ini ke slip gaji"
                            >
                              <Receipt className="w-3.5 h-3.5 text-amber-600" />
                              <span>Potong Gaji</span>
                            </button>
                          )}

                          {/* Tombol Kirim Notifikasi WA ke Karyawan untuk kasbon yang sudah diproses */}
                          {adv.status !== 'pending' && (
                            <a
                              href={getCashAdvanceStatusWhatsAppUrl(
                                emp,
                                adv,
                                adv.status,
                                adv.rejectionReason || adv.notes,
                                companyConfig.companyName
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-colors"
                              title={`Kirim Notifikasi WA Status Kasbon ke ${adv.employeeName}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Kirim Notifikasi WA ke Karyawan</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Schedule Breakdown Modal */}
      {selectedAdvanceForSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Jadwal Angsuran & Cicilan Potongan Gaji
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedAdvanceForSchedule.employeeName} ({selectedAdvanceForSchedule.employeeNik})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAdvanceForSchedule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Advance summary card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Total Pinjaman</span>
                <span className="font-bold text-slate-900">{formatRupiah(selectedAdvanceForSchedule.amount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Cicilan / Bulan</span>
                <span className="font-bold text-indigo-600">{formatRupiah(selectedAdvanceForSchedule.monthlyInstallment)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Terbayar</span>
                <span className="font-bold text-emerald-600">{formatRupiah(selectedAdvanceForSchedule.totalPaid)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Sisa Pinjaman</span>
                <span className="font-bold text-amber-700">{formatRupiah(selectedAdvanceForSchedule.remainingBalance)}</span>
              </div>
            </div>

            {/* Installments Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Angsuran Ke-</th>
                    <th className="py-2.5 px-3">Periode Payroll</th>
                    <th className="py-2.5 px-3">Nominal Potongan</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedAdvanceForSchedule.installments.map((inst) => {
                    const isCurrentPeriod = inst.period === companyConfig.currentPayrollPeriod;
                    return (
                      <tr
                        key={inst.installmentNumber}
                        className={`hover:bg-slate-50/50 ${
                          isCurrentPeriod ? 'bg-amber-50/50 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800">
                            Ke-{inst.installmentNumber} dari {inst.totalInstallments}
                          </span>
                          {isCurrentPeriod && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-800">
                              Bulan Ini
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{inst.period}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{formatRupiah(inst.amount)}</td>
                        <td className="py-2.5 px-3 text-right">
                          {inst.status === 'deducted' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Terpotong di Slip Gaji
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Terjadwal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedAdvanceForSchedule(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Disburse / Pencairan Dana Modal */}
      {disburseModalAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Konfirmasi Pencairan Dana Kasbon
                  </h3>
                  <p className="text-xs text-slate-500">
                    Otorisasi transfer dana ke rekening staf & mulai aktifkan jadwal potongan cicilan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDisburseModalAdvance(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient Details */}
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Penerima Kasbon:</span>
                <span className="font-bold text-slate-900">{disburseModalAdvance.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nominal Dicairkan:</span>
                <span className="font-bold text-sm text-blue-700">{formatRupiah(disburseModalAdvance.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tenor Cicilan:</span>
                <span className="font-semibold text-slate-800">
                  {disburseModalAdvance.tenorMonths} Bulan (@ {formatRupiah(disburseModalAdvance.monthlyInstallment)} / bln)
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Pencairan Dana</label>
                <select
                  value={disburseMethod}
                  onChange={(e) => setDisburseMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Bank Transfer">Transfer Rekening Bank ({companyConfig.disbursementBank})</option>
                  <option value="Tunai / Petty Cash">Tunai / Kas Kecil (Petty Cash)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Referensi Transaksi Bank / Bukti</label>
                <input
                  type="text"
                  value={disburseReference}
                  onChange={(e) => setDisburseReference(e.target.value)}
                  placeholder="e.g. TRF-BCA-881920"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan Finance</label>
                <textarea
                  rows={2}
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  placeholder="Catatan transfer atau approval dana..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDisburseModalAdvance(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDisburse}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Konfirmasi Pencairan & Jadwalkan Cicilan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject Modal */}
      {rejectModalAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  Tolak Permohonan Kasbon
                </h3>
              </div>
              <button
                onClick={() => setRejectModalAdvance(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menolak permohonan kasbon karyawan{' '}
              <strong>{rejectModalAdvance.employeeName}</strong> sebesar{' '}
              <strong>{formatRupiah(rejectModalAdvance.amount)}</strong>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Penolakan Kasbon (Wajib Diisi):
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Misal: Plafon kasbon sebelumnya belum lunas, atau masa kerja belum mencukupi..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalAdvance(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Tolak Kasbon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Admin Create Cash Advance Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Input Kasbon Karyawan Baru (Admin / HR)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daftarkan permohonan pinjaman darurat karyawan dengan validasi plafon otomatis
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setFormError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Karyawan</label>
                <select
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nik}) - {emp.department} - Gaji Pokok: {formatRupiah(emp.baseSalary)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEmpForNew && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-amber-800 block">Plafon Maksimum Kasbon (100% Gaji Pokok):</span>
                    <span className="font-bold text-sm text-amber-950">{formatRupiah(selectedEmpForNew.baseSalary)}</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    Batas Aman Finansial
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal Pinjaman (IDR)</label>
                  <input
                    type="number"
                    min={100000}
                    max={maxPlafon}
                    step={100000}
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {formatRupiah(newAmount)}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilihan Tenor Cicilan</label>
                  <select
                    value={newTenor}
                    onChange={(e) => setNewTenor(Number(e.target.value) as CashAdvanceTenorMonths)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  >
                    <option value={1}>1 Bulan (Langsung Lunas Periode Ini)</option>
                    <option value={3}>3 Bulan (Dicicil 3 Periode Gaji)</option>
                    <option value={6}>6 Bulan (Dicicil 6 Periode Gaji)</option>
                    <option value={12}>12 Bulan (Dicicil 1 Tahun)</option>
                  </select>
                  <span className="text-[10px] text-indigo-600 font-bold mt-0.5 block">
                    Simulasi: {formatRupiah(calculatedMonthly)} / bulan
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Keperluan Kasbon Darurat</label>
                <textarea
                  rows={2}
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Misal: Biaya pengobatan darurat rumah sakit, perbaikan kendaraan kerja, dll..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Simpan & Ajukan Kasbon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
