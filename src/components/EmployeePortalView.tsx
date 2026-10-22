import React, { useState, useMemo } from 'react';
import {
  User,
  WalletCards,
  CalendarDays,
  Clock,
  Receipt,
  Download,
  Printer,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  Building,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Shield,
  Lock,
  FileText,
  Upload,
  ArrowRight,
  ChevronDown,
  Info,
  Calendar,
  Check,
  Percent,
  FileCheck2,
  DollarSign,
  Briefcase,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Save,
  Users,
  Boxes,
  Wrench,
  ShieldCheck,
  Award,
  Star,
  ThumbsUp,
  Bell,
  Sparkles,
  HandCoins,
  Banknote,
  CalendarCheck2,
  Camera,
} from 'lucide-react';
import {
  Employee,
  PayrollRecord,
  LeaveRequest,
  OvertimeRequest,
  ReimbursementClaim,
  CompanyConfig,
  ReimbursementCategory,
  CompanyAsset,
  PerformanceReview,
  AppNotification,
  CashAdvance,
  CashAdvanceTenorMonths,
  CashAdvanceInstallment,
  AttendanceRecord,
} from '../types';
import {
  formatCurrency,
  formatIDR,
  formatRupiah,
  formatIndoDate,
  getOvertimeRatePerMinute,
  calculateOvertimePayByMinutes,
  getOvertimeMinutes,
  formatOvertimeMinutes,
  calculateMinutesBetweenTimes,
  getEmployeeShift,
  evaluateAttendanceAgainstShift,
} from '../utils/formatters';
import { getEmployeeEffectivePin } from '../services/supabaseService';
import { LiveFaceGpsAttendanceScanner } from './LiveFaceGpsAttendanceScanner';

interface EmployeePortalViewProps {
  currentEmployee: Employee;
  allEmployees: Employee[];
  payrollRecord?: PayrollRecord | null;
  allPayrolls: PayrollRecord[];
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  reimbursements: ReimbursementClaim[];
  assets?: CompanyAsset[];
  reviews?: PerformanceReview[];
  companyConfig: CompanyConfig;
  onApplyLeave: (req: LeaveRequest) => void;
  onApplyOvertime: (req: OvertimeRequest) => void;
  onApplyReimbursement: (claim: ReimbursementClaim) => void;
  onUpdateProfile: (emp: Employee) => void;
  onOpenPayslip: (record: PayrollRecord) => void;
  onSwitchToAdminMode: () => void;
  onSelectEmployee: (empId: string) => void;
  onReportAssetIssue?: (assetId: string, notes: string) => void;
  notifications?: AppNotification[];
  activePortalTabOverride?: 'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile' | null;
  onOpenNotifications?: () => void;
  isAdminUnlocked?: boolean;
  onRequestAdminAccess?: () => void;
  onLockAdmin?: () => void;
  attendances?: AttendanceRecord[];
  onAddAttendance?: (att: AttendanceRecord) => void;
  cashAdvances?: CashAdvance[];
  onApplyCashAdvance?: (
    advanceData: Omit<
      CashAdvance,
      'id' | 'createdAt' | 'status' | 'totalPaid' | 'remainingBalance' | 'installments'
    >
  ) => void;
}

const LEAVE_TYPES: LeaveRequest['type'][] = [
  'Cuti Tahunan',
  'Cuti Sakit',
  'Cuti Khusus (Menikah/Duka)',
  'Cuti Melahirkan',
  'Izin Pribadi',
];

const REIMBURSEMENT_CATEGORIES: ReimbursementCategory[] = [
  'Transport & Bensin',
  'Parkir & Tol',
  'Makan Lembur & Konsumsi',
  'Operasional Toko & Gudang',
  'Pengiriman & Ekspedisi',
  'Medis & Rawat Jalan',
  'Perlengkapan Kantor (ATK)',
  'Komunikasi & Pulsa',
  'Lain-lain',
];

export const EmployeePortalView: React.FC<EmployeePortalViewProps> = ({
  currentEmployee,
  allEmployees,
  payrollRecord,
  allPayrolls,
  leaveRequests,
  overtimeRequests,
  reimbursements,
  assets = [],
  reviews = [],
  companyConfig,
  onApplyLeave,
  onApplyOvertime,
  onApplyReimbursement,
  onUpdateProfile,
  onOpenPayslip,
  onSwitchToAdminMode,
  onSelectEmployee,
  onReportAssetIssue,
  notifications = [],
  activePortalTabOverride,
  onOpenNotifications,
  isAdminUnlocked = false,
  onRequestAdminAccess,
  onLockAdmin,
  attendances = [],
  onAddAttendance,
  cashAdvances = [],
  onApplyCashAdvance,
}) => {
  const [activePortalTab, setActivePortalTab] = useState<'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile'>('payroll');
  const [isSwitchProfileModalOpen, setIsSwitchProfileModalOpen] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [pendingSwitchEmp, setPendingSwitchEmp] = useState<Employee | null>(null);
  const [switchPinInput, setSwitchPinInput] = useState('');
  const [switchPinError, setSwitchPinError] = useState<string | null>(null);
  const [clockInNotes, setClockInNotes] = useState('');
  const [attendanceNotice, setAttendanceNotice] = useState<string | null>(null);
  const [previewAttendanceRecord, setPreviewAttendanceRecord] = useState<AttendanceRecord | null>(null);

  // Kasbon (Cash Advance) Form State
  const [isCashAdvanceModalOpen, setIsCashAdvanceModalOpen] = useState(false);
  const [cashAdvanceAmount, setCashAdvanceAmount] = useState<number>(1500000);
  const [cashAdvanceTenor, setCashAdvanceTenor] = useState<CashAdvanceTenorMonths>(3);
  const [cashAdvanceReason, setCashAdvanceReason] = useState('');
  const [cashAdvanceError, setCashAdvanceError] = useState<string | null>(null);
  const [cashAdvanceSuccessMsg, setCashAdvanceSuccessMsg] = useState<string | null>(null);

  // Sync tab if commanded by notification navigation
  React.useEffect(() => {
    if (activePortalTabOverride) {
      setActivePortalTab(activePortalTabOverride);
    }
  }, [activePortalTabOverride]);

  // Personal Attendances & Shift Schedule
  const myShift = useMemo(
    () => getEmployeeShift(currentEmployee, companyConfig.workShifts),
    [currentEmployee, companyConfig.workShifts]
  );

  const [useCustomClockTime, setUseCustomClockTime] = useState(false);
  const [customClockInTime, setCustomClockInTime] = useState(myShift.checkInTime);
  const [customClockOutTime, setCustomClockOutTime] = useState(myShift.checkOutTime);

  React.useEffect(() => {
    setCustomClockInTime(myShift.checkInTime);
    setCustomClockOutTime(myShift.checkOutTime);
  }, [myShift.id, myShift.checkInTime, myShift.checkOutTime]);

  const myAttendances = useMemo(() => {
    return attendances.filter((a) => a.employeeId === currentEmployee.id);
  }, [attendances, currentEmployee.id]);

  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayAttendance = useMemo(() => {
    return myAttendances.find((a) => a.date === todayDateStr);
  }, [myAttendances, todayDateStr]);

  const shiftEvalPreview = useMemo(() => {
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetIn = useCustomClockTime ? customClockInTime : todayAttendance?.checkIn || nowStr;
    const targetOut = useCustomClockTime ? customClockOutTime : todayAttendance?.checkOut || myShift.checkOutTime;
    return evaluateAttendanceAgainstShift(targetIn, targetOut, myShift);
  }, [useCustomClockTime, customClockInTime, customClockOutTime, todayAttendance, myShift]);

  // Count unread performance / bonus notifications for this employee
  const unreadKpiNotifs = useMemo(() => {
    return notifications.filter(
      (n) =>
        !n.isRead &&
        ((n.recipientType === 'employee' && n.recipientEmployeeId === currentEmployee.id) || n.recipientType === 'all')
    );
  }, [notifications, currentEmployee.id]);

  // Filter personal data
  const myReviews = useMemo(
    () => reviews.filter((r) => r.employeeId === currentEmployee.id),
    [reviews, currentEmployee.id]
  );

  const myLeaveRequests = useMemo(
    () => leaveRequests.filter((l) => l.employeeId === currentEmployee.id),
    [leaveRequests, currentEmployee.id]
  );

  const myOvertimeRequests = useMemo(
    () => overtimeRequests.filter((o) => o.employeeId === currentEmployee.id),
    [overtimeRequests, currentEmployee.id]
  );

  const myReimbursements = useMemo(
    () => reimbursements.filter((r) => r.employeeId === currentEmployee.id),
    [reimbursements, currentEmployee.id]
  );

  const myAssets = useMemo(
    () => assets.filter((a) => a.assignedToEmployeeId === currentEmployee.id),
    [assets, currentEmployee.id]
  );

  const myCashAdvances = useMemo(
    () => cashAdvances.filter((ca) => ca.employeeId === currentEmployee.id),
    [cashAdvances, currentEmployee.id]
  );

  const activeCashAdvanceBalance = useMemo(
    () =>
      myCashAdvances
        .filter((ca) => ca.status === 'disbursed' || ca.status === 'approved')
        .reduce((sum, ca) => sum + ca.remainingBalance, 0),
    [myCashAdvances]
  );

  const maxCashAdvancePlafon = currentEmployee.baseSalary;

  const handleSubmitCashAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    setCashAdvanceError(null);

    if (cashAdvanceAmount <= 0) {
      setCashAdvanceError('Nominal pengajuan kasbon harus lebih dari Rp 0.');
      return;
    }
    if (cashAdvanceAmount > maxCashAdvancePlafon) {
      setCashAdvanceError(
        `Nominal kasbon melebihi plafon maksimum gaji pokok Anda (${formatRupiah(maxCashAdvancePlafon)}).`
      );
      return;
    }
    if (!cashAdvanceReason.trim()) {
      setCashAdvanceError('Mohon isi alasan atau keperluan pengajuan kasbon.');
      return;
    }

    if (onApplyCashAdvance) {
      onApplyCashAdvance({
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.fullName,
        employeeNik: currentEmployee.nik,
        department: currentEmployee.department,
        position: currentEmployee.role,
        baseSalary: currentEmployee.baseSalary,
        maxAllowedAmount: maxCashAdvancePlafon,
        amount: cashAdvanceAmount,
        reason: cashAdvanceReason.trim(),
        tenorMonths: cashAdvanceTenor,
        monthlyInstallment: Math.round(cashAdvanceAmount / cashAdvanceTenor),
      });
    }

    setIsCashAdvanceModalOpen(false);
    setCashAdvanceReason('');
    setCashAdvanceSuccessMsg(
      `Pengajuan kasbon sebesar ${formatRupiah(cashAdvanceAmount)} (Tenor ${cashAdvanceTenor} bulan) berhasil dikirim ke Panel Admin HR & Finance!`
    );
    setTimeout(() => setCashAdvanceSuccessMsg(null), 5000);
  };

  // Leave Form State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'Cuti Tahunan' as LeaveRequest['type'],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  // Calculate days for leave form
  const calculatedLeaveDays = useMemo(() => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 1;
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [leaveForm.startDate, leaveForm.endDate]);

  // Overtime Form State (Hitungan Per Menit)
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    minutes: 90,
    startTime: '17:30',
    endTime: '19:00',
    taskDescription: '',
  });

  const myOvertimeRatePerMinute = useMemo(() => {
    return getOvertimeRatePerMinute(currentEmployee, companyConfig.defaultOvertimeMultiplier || 1.5);
  }, [currentEmployee, companyConfig.defaultOvertimeMultiplier]);

  // Calculate estimated overtime pay per minute: ((Base Salary + Position Allowance) / 173 / 60) * 1.5 * minutes
  const estimatedOvertimePay = useMemo(() => {
    return calculateOvertimePayByMinutes(
      currentEmployee,
      overtimeForm.minutes || 0,
      companyConfig.defaultOvertimeMultiplier || 1.5
    );
  }, [currentEmployee, overtimeForm.minutes, companyConfig.defaultOvertimeMultiplier]);

  const handleOvertimeTimeRangeChange = (newStart: string, newEnd: string) => {
    const diffMins = calculateMinutesBetweenTimes(newStart, newEnd);
    setOvertimeForm((prev) => ({
      ...prev,
      startTime: newStart,
      endTime: newEnd,
      minutes: diffMins > 0 ? diffMins : prev.minutes,
    }));
  };

  // Reimbursement Form State
  const [isReimbursementModalOpen, setIsReimbursementModalOpen] = useState(false);
  const [reimbursementForm, setReimbursementForm] = useState<{
    category: ReimbursementCategory;
    amount: number;
    description: string;
    receiptFileName: string;
    paymentMethod: 'Transfer Bank' | 'Kas Kecil (Petty Cash)';
    receiptPhotoUrl: string;
  }>({
    category: 'Transport & Bensin',
    amount: 150000,
    description: '',
    receiptFileName: '',
    paymentMethod: 'Transfer Bank',
    receiptPhotoUrl: '',
  });

  // Claims sub-tab: 'overtime' | 'reimbursement'
  const [claimsSubTab, setClaimsSubTab] = useState<'overtime' | 'reimbursement'>('overtime');

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    phone: currentEmployee.phone,
    email: currentEmployee.email,
    googleEmail: currentEmployee.googleEmail || currentEmployee.email,
    address: currentEmployee.address || '',
    bankName: currentEmployee.bankName,
    bankAccountNumber: currentEmployee.bankAccountNumber,
    bankAccountHolder: currentEmployee.bankAccountHolder,
    emergencyName: currentEmployee.emergencyContact?.name || '',
    emergencyRelation: currentEmployee.emergencyContact?.relation || '',
    emergencyPhone: currentEmployee.emergencyContact?.phone || '',
  });

  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [reportedAssetNotice, setReportedAssetNotice] = useState<string | null>(null);

  // Sync profileForm if currentEmployee changes
  React.useEffect(() => {
    setProfileForm({
      phone: currentEmployee.phone,
      email: currentEmployee.email,
      googleEmail: currentEmployee.googleEmail || currentEmployee.email,
      address: currentEmployee.address || '',
      bankName: currentEmployee.bankName,
      bankAccountNumber: currentEmployee.bankAccountNumber,
      bankAccountHolder: currentEmployee.bankAccountHolder,
      emergencyName: currentEmployee.emergencyContact?.name || '',
      emergencyRelation: currentEmployee.emergencyContact?.relation || '',
      emergencyPhone: currentEmployee.emergencyContact?.phone || '',
    });
    setProfileSuccessMsg(false);
  }, [currentEmployee]);

  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Leave Submit Handler
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError(null);
    if (!leaveForm.reason.trim()) {
      setLeaveError('Mohon isi alasan atau keperluan cuti.');
      return;
    }

    if (leaveForm.type === 'Cuti Tahunan' && calculatedLeaveDays > currentEmployee.remainingLeaveDays) {
      setLeaveError(
        `Sisa jatah cuti tahunan Anda hanya ${currentEmployee.remainingLeaveDays} hari. Permohonan Anda sebanyak ${calculatedLeaveDays} hari melebihi batas kuota yang tersedia.`
      );
      return;
    }

    const newReq: LeaveRequest = {
      id: `leave-${Date.now().toString().slice(-6)}`,
      employeeId: currentEmployee.id,
      type: leaveForm.type,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      totalDays: calculatedLeaveDays,
      reason: leaveForm.reason.trim(),
      status: 'Menunggu Persetujuan',
      appliedAt: new Date().toISOString().slice(0, 10),
    };

    onApplyLeave(newReq);
    setIsLeaveModalOpen(false);
    setLeaveError(null);
    setLeaveForm({
      type: 'Cuti Tahunan',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      reason: '',
    });
  };

  // Overtime Submit Handler (Hitungan Per Menit)
  const handleSubmitOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeForm.taskDescription.trim()) return;

    const validMinutes = Math.max(1, Math.round(Number(overtimeForm.minutes) || 0));

    const newReq: OvertimeRequest = {
      id: `ot-${Date.now().toString().slice(-6)}`,
      employeeId: currentEmployee.id,
      date: overtimeForm.date,
      hours: Number((validMinutes / 60).toFixed(2)),
      minutes: validMinutes,
      startTime: overtimeForm.startTime || undefined,
      endTime: overtimeForm.endTime || undefined,
      ratePerMinute: myOvertimeRatePerMinute,
      taskDescription: overtimeForm.taskDescription.trim(),
      calculatedPay: estimatedOvertimePay,
      status: 'Menunggu Persetujuan',
    };

    onApplyOvertime(newReq);
    setIsOvertimeModalOpen(false);
    setOvertimeForm({
      date: new Date().toISOString().slice(0, 10),
      minutes: 90,
      startTime: '17:30',
      endTime: '19:00',
      taskDescription: '',
    });
  };

  // Reimbursement Submit Handler
  const handleSubmitReimbursement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimbursementForm.description.trim() || reimbursementForm.amount <= 0) return;

    const randomNum = Math.floor(100 + Math.random() * 900);
    const newClaim: ReimbursementClaim = {
      id: `rmb-${Date.now().toString().slice(-6)}`,
      claimNumber: `RMB-2026-10-${randomNum}`,
      employeeId: currentEmployee.id,
      date: new Date().toISOString().slice(0, 10),
      category: reimbursementForm.category,
      amount: Number(reimbursementForm.amount),
      description: reimbursementForm.description.trim(),
      receiptNumber: `RCP-${Date.now().toString().slice(-6)}`,
      receiptFileName: reimbursementForm.receiptFileName || 'Struk_Nota_Pengeluaran.jpg',
      receiptFileType: 'image',
      receiptPhotoUrl:
        reimbursementForm.receiptPhotoUrl ||
        'https://images.unsplash.com/photo-1554415707-9e4466bfe0dc?auto=format&fit=crop&w=600&h=800&q=80',
      status: 'Menunggu Persetujuan',
      appliedAt: `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
      paymentMethod: reimbursementForm.paymentMethod,
    };

    onApplyReimbursement(newClaim);
    setIsReimbursementModalOpen(false);
    setReimbursementForm({
      category: 'Transport & Bensin',
      amount: 150000,
      description: '',
      receiptFileName: '',
      paymentMethod: 'Transfer Bank',
      receiptPhotoUrl: '',
    });
  };

  // Profile Save Handler
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Employee = {
      ...currentEmployee,
      phone: profileForm.phone,
      email: profileForm.email,
      googleEmail: profileForm.googleEmail,
      address: profileForm.address,
      bankName: profileForm.bankName,
      bankAccountNumber: profileForm.bankAccountNumber,
      bankAccountHolder: profileForm.bankAccountHolder,
      emergencyContact: {
        name: profileForm.emergencyName,
        relation: profileForm.emergencyRelation,
        phone: profileForm.emergencyPhone,
      },
    };

    onUpdateProfile(updated);
    setProfileSuccessMsg(true);
    setTimeout(() => setProfileSuccessMsg(false), 4000);
  };

  // Simulated File Upload for Reimbursement
  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReimbursementForm((prev) => ({
        ...prev,
        receiptFileName: file.name,
        receiptPhotoUrl: 'https://images.unsplash.com/photo-1554415707-9e4466bfe0dc?auto=format&fit=crop&w=600&h=800&q=80',
      }));
    }
  };

  // Calculate current employee total monthly gross and deductions
  const baseSal = currentEmployee.baseSalary;
  const posAllow = currentEmployee.allowances?.position || 0;
  const transAllow = currentEmployee.allowances?.transport || 0;
  const mealAllow = currentEmployee.allowances?.meal || 0;
  const commAllow = currentEmployee.allowances?.communication || 0;
  const totalAllow = posAllow + transAllow + mealAllow + commAllow;

  const currentPay = payrollRecord || allPayrolls.find((p) => p.employeeId === currentEmployee.id);
  const overtimePay = currentPay ? currentPay.overtimePay : 0;
  const bonusPay = currentPay ? currentPay.bonus : 0;
  const grossSalary = currentPay ? currentPay.totalGrossSalary : baseSal + totalAllow + overtimePay + bonusPay;
  const totalDeduct = currentPay ? currentPay.totalDeductions : Math.round(grossSalary * 0.08);
  const takeHomePay = currentPay ? currentPay.takeHomePay : Math.max(0, grossSalary - totalDeduct);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Top Banner: Employee Mode Active & Back to Admin Switcher */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentEmployee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
              alt={currentEmployee.fullName}
              className="w-14 h-14 rounded-2xl object-cover ring-3 ring-white/30 shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-xs text-white border border-white/20">
                  Portal Layanan Mandiri (Self-Service)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/30 text-emerald-100 border border-emerald-300/30">
                  {currentEmployee.employmentStatus}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Halo, {currentEmployee.fullName}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                NIK: <span className="font-mono font-bold">{currentEmployee.nik}</span> •{' '}
                {currentEmployee.role} ({currentEmployee.department})
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('attendance')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-emerald-900 hover:bg-emerald-50 shadow-sm cursor-pointer transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {todayAttendance?.checkIn
                      ? `Absen Wajah & GPS HP (${todayAttendance.checkIn})`
                      : 'Absen Foto Wajah & GPS HP Sekarang'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Switchers: Protected against unauthorized employee switching */}
          {!isAdminUnlocked ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-950/40 border border-emerald-400/30 rounded-xl text-emerald-100 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="font-semibold text-white truncate max-w-[170px]">
                  Profil Anda: {currentEmployee.fullName}
                </span>
                <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-1.5 py-0.5 rounded font-mono shrink-0">
                  {currentEmployee.nik}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSwitchProfileModalOpen(true)}
                  className="ml-1 text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors"
                  title="Ganti ke akun karyawan Anda jika menggunakan perangkat bersama"
                >
                  Ganti Akun
                </button>
              </div>

              <button
                type="button"
                onClick={() => (onRequestAdminAccess ? onRequestAdminAccess() : onSwitchToAdminMode())}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white text-purple-900 hover:bg-purple-50 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
                title="Buka Panel HR & Payroll Admin (Perlu PIN Keamanan)"
              >
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                <span>Masuk Panel Admin (PIN)</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Quick Employee Selector for Admin Preview */}
              <div className="relative">
                <select
                  value={currentEmployee.id}
                  onChange={(e) => onSelectEmployee(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl text-white focus:outline-hidden cursor-pointer"
                  title="Admin Preview: Simulasi Karyawan"
                >
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="text-slate-800 bg-white">
                      Admin Preview: {emp.fullName} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Back to Admin Panel Button */}
              <button
                type="button"
                onClick={onSwitchToAdminMode}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
              >
                <Shield className="w-4 h-4 text-emerald-600" />
                Kembali ke Panel Admin
              </button>

              {onLockAdmin && (
                <button
                  type="button"
                  onClick={onLockAdmin}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-950/40 hover:bg-rose-900/40 text-white rounded-xl border border-white/20 transition-all cursor-pointer"
                  title="Kunci Akses Admin dan Kembali ke Mode Karyawan Biasa"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Kunci</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unread Performance / Payroll Notification Alert Banner */}
      {unreadKpiNotifs.length > 0 && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full text-violet-100">
                  Notifikasi Kinerja ({unreadKpiNotifs.length})
                </span>
                <span className="text-xs text-violet-100 font-semibold truncate max-w-xs sm:max-w-md">
                  {unreadKpiNotifs[0].title}
                </span>
              </div>
              <p className="text-xs text-violet-100/90 mt-1 max-w-2xl line-clamp-1">
                {unreadKpiNotifs[0].message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadKpiNotifs[0].actionUrl === 'rapor_kinerja' ? (
              <button
                onClick={() => setActivePortalTab('performance')}
                className="px-3.5 py-1.5 bg-white text-violet-900 rounded-xl text-xs font-bold hover:bg-violet-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-violet-700" />
                <span>Buka Rapor Kinerja</span>
              </button>
            ) : (
              <button
                onClick={() => setActivePortalTab('payroll')}
                className="px-3.5 py-1.5 bg-white text-emerald-900 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cek Bonus Slip Gaji</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActivePortalTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'payroll'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <WalletCards className="w-4 h-4" />
          Gaji & Slip Gaji Pribadi
        </button>

        <button
          onClick={() => setActivePortalTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" />
          Presensi & Absensi Mandiri
          {todayAttendance ? (
            <span className="w-2 h-2 rounded-full bg-emerald-300 ring-1 ring-white" title="Sudah Absen Hari Ini" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Belum Absen Hari Ini" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('leave')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'leave'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Pengajuan Cuti & Izin
          {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('claims')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'claims'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Klaim Lembur & Reimbursement
        </button>

        <button
          onClick={() => setActivePortalTab('cash_advance')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'cash_advance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          <span>Pengajuan Kasbon & Cicilan ({myCashAdvances.length})</span>
          {myCashAdvances.some((c) => c.status === 'pending' || c.status === 'approved') && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('assets')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'assets'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Aset Kantor Saya ({myAssets.length})
        </button>

        <button
          onClick={() => setActivePortalTab('performance')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'performance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Rapor Kinerja & KPI ({myReviews.length})</span>
          {unreadKpiNotifs.some(n => n.category === 'PERFORMANCE_REVIEW') && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-white animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          Profil & Rekening Bank
        </button>
      </div>

      {/* TAB 1: GAJI & SLIP GAJI */}
      {activePortalTab === 'payroll' && (
        <div className="space-y-6">
          {/* Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Take Home Pay */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                    Gaji Bersih (Take Home Pay)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                    {companyConfig.currentPayrollPeriod}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
                  {formatCurrency(takeHomePay)}
                </h2>
                <p className="text-xs text-emerald-100 mt-1">
                  Ditransfer ke {currentEmployee.bankName} (No: {currentEmployee.bankAccountNumber})
                </p>
              </div>

              {currentPay && (
                <div className="mt-4 pt-3 border-t border-white/20">
                  <button
                    onClick={() => onOpenPayslip(currentPay)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    Unduh PDF / Cetak Slip Gaji Pribadi
                  </button>
                </div>
              )}
            </div>

            {/* Total Penghasilan Bruto */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Penghasilan Bruto
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(grossSalary)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Gaji Pokok + 4 Komponen Tunjangan + Lembur & Bonus
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Gaji Pokok:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(baseSal)}</span>
              </div>
            </div>

            {/* Total Potongan Resmi */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                  Total Potongan Wajib
                </span>
                <h3 className="text-2xl font-bold text-rose-700 mt-1">
                  - {formatCurrency(totalDeduct)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Iuran BPJS TK, BPJS Kesehatan & PPh 21 TER
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Jadwal Pencairan:</span>
                <span className="font-semibold text-emerald-600">
                  Tgl {companyConfig.payrollDisbursementDay} {companyConfig.currentPayrollPeriod.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>

          {/* Rincian Komponen Gaji Bulanan */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rincian Komponen Slip Gaji Bulan Ini
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Perhitungan resmi berdasarkan regulasi ketenagakerjaan dan kebijakan PT Tas Grosir Import
                </p>
              </div>
              {currentPay && (
                <button
                  onClick={() => onOpenPayslip(currentPay)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  Unduh / Cetak Slip Gaji (PDF)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kolom 1: Penerimaan (Earnings) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Komponen Penghasilan & Tunjangan
                </h4>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Gaji Pokok (Base Salary)</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(baseSal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Tunjangan Jabatan</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(posAllow)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Tunjangan Transport</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(transAllow)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Tunjangan Makan</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(mealAllow)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Tunjangan Komunikasi</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(commAllow)}</span>
                  </div>
                  {overtimePay > 0 && (
                    <div className="flex justify-between items-center text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded">
                      <span className="font-semibold">Upah Lembur Terverifikasi</span>
                      <span className="font-bold">+{formatCurrency(overtimePay)}</span>
                    </div>
                  )}
                  {bonusPay > 0 && (
                    <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      <span className="font-semibold">Bonus Insentif Kinerja</span>
                      <span className="font-bold">+{formatCurrency(bonusPay)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
                    <span>Total Penghasilan Bruto:</span>
                    <span className="text-emerald-700">{formatCurrency(grossSalary)}</span>
                  </div>
                </div>
              </div>

              {/* Kolom 2: Potongan (Deductions) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Komponen Potongan Iuran & Pajak
                </h4>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>BPJS Kesehatan Karyawan (1%)</span>
                    <span className="font-semibold text-rose-700">
                      - {formatCurrency(currentPay ? currentPay.bpjsKesehatanEmployee : Math.round(baseSal * 0.01))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>BPJS Ketenagakerjaan - JHT (2%)</span>
                    <span className="font-semibold text-rose-700">
                      - {formatCurrency(currentPay ? currentPay.bpjsJhtEmployee : Math.round(baseSal * 0.02))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>BPJS Ketenagakerjaan - Jaminan Pensiun (1%)</span>
                    <span className="font-semibold text-rose-700">
                      - {formatCurrency(currentPay ? currentPay.bpjsJpEmployee : Math.round(baseSal * 0.01))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Pajak Penghasilan PPh 21 (Skema TER 2026)</span>
                    <span className="font-semibold text-rose-700">
                      - {formatCurrency(currentPay ? currentPay.pph21TER : Math.round(grossSalary * 0.025))}
                    </span>
                  </div>
                  {currentPay && currentPay.lateDeduction > 0 && (
                    <div className="flex justify-between items-center text-amber-800 bg-amber-50 px-2 py-1 rounded">
                      <span>Potongan Keterlambatan Absensi</span>
                      <span className="font-semibold">- {formatCurrency(currentPay.lateDeduction)}</span>
                    </div>
                  )}
                  {currentPay && (currentPay.cashAdvanceDeduction || 0) > 0 && (
                    <div className="flex justify-between items-center text-rose-800 bg-rose-50 px-2 py-1 rounded">
                      <span>
                        Potongan Cicilan Kasbon{' '}
                        {currentPay.cashAdvanceNotes ? `(${currentPay.cashAdvanceNotes})` : ''}
                      </span>
                      <span className="font-bold">- {formatCurrency(currentPay.cashAdvanceDeduction || 0)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
                    <span>Total Potongan:</span>
                    <span className="text-rose-700">- {formatCurrency(totalDeduct)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Information Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                Rekening pencairan: <strong>{currentEmployee.bankName}</strong> ({currentEmployee.bankAccountNumber} a.n {currentEmployee.bankAccountHolder})
              </span>
              <span className="text-slate-400">
                Plafon BPJS Kesehatan Cap: {formatCurrency(companyConfig.bpjsKesehatanMaxCap)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB PRESENSI & ABSENSI MANDIRI (MENGIKUTI JADWAL SHIFT) */}
      {activePortalTab === 'attendance' && (
        <div className="space-y-6">
          {attendanceNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{attendanceNotice}</span>
            </div>
          )}

          {/* Active Shift Schedule Banner for Employee */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span className="font-bold text-emerald-700">{myShift.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>Jadwal Kerja Aktif Anda</span>
                  {myShift.location && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{myShift.location}</span>
                    </>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {myShift.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hari Kerja: <strong>{myShift.workDays.join(', ')}</strong> · Istirahat:{' '}
                  <strong>{myShift.breakDurationMinutes} Menit</strong>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs shrink-0">
                <div>
                  <span className="text-slate-500 block text-[10px]">Jam Masuk Shift</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {myShift.checkInTime} WIB
                  </span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-500 block text-[10px]">Jam Pulang Shift</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {myShift.checkOutTime} WIB
                  </span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-500 block text-[10px]">Batas Tepat Waktu</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {shiftEvalPreview.maxAllowedCheckIn} WIB
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    (Toleransi {myShift.gracePeriodMinutes} mnt)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clock In / Clock Out Action Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Presensi Mengikuti Jadwal {myShift.name} ({myShift.checkInTime} – {myShift.checkOutTime} WIB)</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  Presensi Kehadiran Hari Ini ({formatIndoDate(todayDateStr)})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status tepat waktu atau terlambat dihitung otomatis berdasarkan jam masuk shift Anda ({myShift.checkInTime} WIB + toleransi {myShift.gracePeriodMinutes} menit).
                </p>
              </div>

              <div className="flex items-center gap-2">
                {todayAttendance ? (
                  <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <span className="text-slate-500 block text-[10px]">Status Hari Ini:</span>
                    <span className="font-bold text-emerald-800">
                      {todayAttendance.status} ({todayAttendance.checkIn}
                      {todayAttendance.checkOut ? ` - ${todayAttendance.checkOut}` : ''})
                    </span>
                  </div>
                ) : (
                  <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                    <span className="text-amber-700 font-bold">Belum Absen Masuk Hari Ini</span>
                  </div>
                )}
              </div>
            </div>

            {/* Option to toggle Real-Time Clock vs Custom Shift Time Simulation */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomClockTime}
                    onChange={(e) => setUseCustomClockTime(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Gunakan Input Jam Absen Manual / Simulasi Mengikuti Shift</span>
                </label>

                <span className="text-[11px] text-slate-500">
                  {useCustomClockTime
                    ? 'Mode input jam aktif: Anda dapat menguji jam masuk & pulang terhadap shift'
                    : 'Mode jam real-time perangkat aktif'}
                </span>
              </div>

              {useCustomClockTime && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jam Absen Masuk (Check-In)
                    </label>
                    <input
                      type="time"
                      value={customClockInTime}
                      onChange={(e) => setCustomClockInTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jam Absen Pulang (Check-Out)
                    </label>
                    <input
                      type="time"
                      value={customClockOutTime}
                      onChange={(e) => setCustomClockOutTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomClockInTime(myShift.checkInTime);
                        setCustomClockOutTime(myShift.checkOutTime);
                      }}
                      className="px-2.5 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      Sesuai Shift ({myShift.checkInTime} - {myShift.checkOutTime})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const [h, m] = myShift.checkInTime.split(':').map(Number);
                        const lateTotal = ((h || 9) * 60 + (m || 0) + (myShift.gracePeriodMinutes || 5) + 15) % (24 * 60);
                        const lateStr = `${String(Math.floor(lateTotal / 60)).padStart(2, '0')}:${String(lateTotal % 60).padStart(2, '0')}`;
                        setCustomClockInTime(lateStr);
                      }}
                      className="px-2.5 py-2 bg-white hover:bg-amber-50 text-amber-700 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      Tes Terlambat
                    </button>
                  </div>
                </div>
              )}

              {/* Live Shift Comparison Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Evaluasi terhadap {myShift.code}:</span>
                  <span
                    className={`font-bold ${
                      shiftEvalPreview.lateMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {shiftEvalPreview.status}
                    {shiftEvalPreview.lateMinutes > 0
                      ? ` (Terlambat ${shiftEvalPreview.lateMinutes} Menit dari jadwal ${myShift.checkInTime})`
                      : ` (Sesuai jadwal masuk ${myShift.checkInTime})`}
                  </span>
                </div>
                <span className="font-mono text-slate-600">
                  Estimasi Durasi: <strong>{shiftEvalPreview.workHours} Jam</strong>
                </span>
              </div>
            </div>

              {/* Live Camera & Real-Time Phone GPS Attendance Scanner */}
              <LiveFaceGpsAttendanceScanner
                currentEmployee={currentEmployee}
                activeShift={myShift}
                todayAttendance={todayAttendance}
                todayDateStr={todayDateStr}
                useCustomClockTime={useCustomClockTime}
                customClockInTime={customClockInTime}
                customClockOutTime={customClockOutTime}
                clockInNotes={clockInNotes}
                onChangeNotes={setClockInNotes}
                onSubmitAttendance={(record, mode) => {
                  onAddAttendance?.(record);
                  if (mode === 'check_in') {
                    setAttendanceNotice(
                      `Berhasil Absen Masuk dengan Foto Wajah & GPS HP pukul ${record.checkIn} WIB (${
                        record.checkInFullTimestamp || ''
                      }) di ${record.locationAddress || myShift.location} → Status: ${record.status}${
                        record.lateMinutes > 0 ? ` (Terlambat ${record.lateMinutes} menit)` : ''
                      }!`
                    );
                  } else {
                    setAttendanceNotice(
                      `Berhasil Absen Pulang dengan Foto Wajah & GPS HP pukul ${record.checkOut} WIB (${
                        record.checkOutFullTimestamp || ''
                      }) • Durasi Kerja: ${record.workHours} Jam!`
                    );
                  }
                  setTimeout(() => setAttendanceNotice(null), 7000);
                }}
              />
            </div>

          {/* Personal Attendance History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Riwayat Presensi, Foto Wajah & Titik Lokasi GPS Saya
                </h3>
                <p className="text-xs text-slate-500">
                  Total {myAttendances.length} catatan kehadiran tercatat beserta bukti foto wajah real-time & koordinat GPS HP
                </p>
              </div>
            </div>

            {myAttendances.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada riwayat presensi untuk akun Anda. Silakan klik tombol <strong>Jepret Foto Wajah & Absen Masuk</strong> pada kamera di atas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                      <th className="py-3 px-4">Tanggal & Jam Real-Time</th>
                      <th className="py-3 px-4">Bukti Foto Wajah</th>
                      <th className="py-3 px-4">Jadwal Shift</th>
                      <th className="py-3 px-4">Jam Masuk / Pulang</th>
                      <th className="py-3 px-4">Status Evaluasi Shift</th>
                      <th className="py-3 px-4">Detail Lokasi GPS HP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myAttendances.map((att) => {
                      const schedIn = att.scheduledCheckIn || myShift.checkInTime;
                      const schedOut = att.scheduledCheckOut || myShift.checkOutTime;
                      const shiftLabel = att.shiftName || myShift.name;
                      const photoToShow = att.facePhotoSnapshot || att.checkOutPhotoSnapshot;
                      return (
                        <tr key={att.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 block">
                              {formatIndoDate(att.date)}
                            </span>
                            {att.checkInFullTimestamp && (
                              <span className="text-[10px] font-mono text-emerald-700 block mt-0.5">
                                {att.checkInFullTimestamp}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {photoToShow ? (
                              <button
                                type="button"
                                onClick={() => setPreviewAttendanceRecord(att)}
                                className="flex items-center gap-2 group cursor-pointer text-left"
                              >
                                <img
                                  src={photoToShow}
                                  alt="Foto Absen"
                                  className="w-12 h-10 rounded-lg object-cover border border-emerald-300 shadow-2xs group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                                />
                                <div>
                                  <span className="text-[11px] font-bold text-emerald-700 group-hover:underline block">
                                    Lihat Foto & GPS
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Watermark Real-Time
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Tanpa Foto
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 block">{shiftLabel}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Jadwal: {schedIn} - {schedOut} WIB
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className="text-emerald-700 font-bold">
                              Masuk: {att.checkIn || '-'}
                            </span>
                            <span className="block text-indigo-700 font-bold text-[11px]">
                              Pulang: {att.checkOut || '-'} ({att.workHours}j)
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                att.status === 'Hadir Tepat Waktu'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : att.status === 'Terlambat'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {att.status}
                              {att.lateMinutes > 0 ? ` (${att.lateMinutes} mnt)` : ''}
                            </span>
                            {(att.earlyLeaveMinutes || 0) > 0 && (
                              <span className="block text-[10px] text-rose-600 font-medium mt-0.5">
                                Pulang cepat {att.earlyLeaveMinutes} mnt
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="text-[11px] font-medium text-slate-800 line-clamp-2">
                              {att.locationAddress || att.notes || '-'}
                            </div>
                            {att.locationCoords && (
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                GPS: {att.locationCoords.latitude.toFixed(6)},{' '}
                                {att.locationCoords.longitude.toFixed(6)} (±
                                {att.locationCoords.accuracy}m)
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Detail Foto Wajah & Lokasi GPS dari Tabel Riwayat */}
          {previewAttendanceRecord && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200">
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Bukti Foto Wajah & Lokasi GPS Real-Time ({formatIndoDate(previewAttendanceRecord.date)})</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {currentEmployee.fullName} ({currentEmployee.nik}) • {previewAttendanceRecord.shiftName || myShift.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewAttendanceRecord(null)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {previewAttendanceRecord.facePhotoSnapshot && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-emerald-800 block">
                          Foto Absen Masuk ({previewAttendanceRecord.checkIn} WIB)
                        </span>
                        <img
                          src={previewAttendanceRecord.facePhotoSnapshot}
                          alt="Foto Absen Masuk"
                          className="w-full rounded-xl border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                    {previewAttendanceRecord.checkOutPhotoSnapshot && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-indigo-800 block">
                          Foto Absen Pulang ({previewAttendanceRecord.checkOut} WIB)
                        </span>
                        <img
                          src={previewAttendanceRecord.checkOutPhotoSnapshot}
                          alt="Foto Absen Pulang"
                          className="w-full rounded-xl border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-slate-500">Waktu Real-Time Tercatat:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {previewAttendanceRecord.checkInFullTimestamp || `${previewAttendanceRecord.date} • ${previewAttendanceRecord.checkIn} WIB`}
                      </span>
                    </div>
                    {previewAttendanceRecord.locationCoords && (
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-slate-500">Titik Koordinat GPS HP:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          Lat {previewAttendanceRecord.locationCoords.latitude.toFixed(6)}°, Long{' '}
                          {previewAttendanceRecord.locationCoords.longitude.toFixed(6)}° (Akurasi ±
                          {previewAttendanceRecord.locationCoords.accuracy}m)
                        </span>
                      </div>
                    )}
                    <div className="pt-1 border-t border-slate-200/80">
                      <span className="text-slate-500 block mb-0.5">Detail Alamat Lokasi GPS HP:</span>
                      <span className="font-semibold text-slate-900 block">
                        {previewAttendanceRecord.locationAddress || previewAttendanceRecord.notes || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENGAJUAN CUTI & IZIN MANDIRI */}
      {activePortalTab === 'leave' && (
        <div className="space-y-6">
          {/* Quota & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sisa Cuti Tahunan</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                  {currentEmployee.remainingLeaveDays} <span className="text-sm font-normal text-slate-400">Hari</span>
                </h3>
                <p className="text-xs text-emerald-600 mt-0.5">Dari hak 12 hari/tahun</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuti Terpakai</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                  {Math.max(0, 12 - currentEmployee.remainingLeaveDays)}{' '}
                  <span className="text-sm font-normal text-slate-400">Hari</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Tahun berjalan 2026</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menunggu Persetujuan</p>
                <h3 className="text-2xl font-bold text-amber-700 mt-0.5">
                  {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length}{' '}
                  <span className="text-sm font-normal text-slate-400">Pengajuan</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Sedang ditinjau HR</p>
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Riwayat Pengajuan Cuti & Izin</h3>
                <p className="text-xs text-slate-500">
                  Pantau status persetujuan cuti Anda secara langsung oleh tim HRD
                </p>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Buat Pengajuan Cuti Baru
              </button>
            </div>

            {/* Leave History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-3">Tgl Diajukan</th>
                    <th className="py-3 px-3">Jenis Cuti</th>
                    <th className="py-3 px-3">Rentang Tanggal</th>
                    <th className="py-3 px-3">Durasi</th>
                    <th className="py-3 px-3">Alasan / Keperluan</th>
                    <th className="py-3 px-3">Status Persetujuan</th>
                    <th className="py-3 px-3">Ditinjau Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLeaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Belum ada riwayat pengajuan cuti. Klik tombol di atas untuk mengajukan.
                      </td>
                    </tr>
                  ) : (
                    myLeaveRequests.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">{leave.appliedAt}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800">{leave.type}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {leave.startDate} s/d {leave.endDate}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-800">
                          {leave.totalDays} Hari
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={leave.reason}>
                          {leave.reason}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              leave.status === 'Disetujui'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : leave.status === 'Ditolak'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {leave.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                          {leave.approvedBy || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KLAIM LEMBUR & REIMBURSEMENT */}
      {activePortalTab === 'claims' && (
        <div className="space-y-6">
          {/* Sub-Tabs: Lembur vs Reimbursement */}
          <div className="flex bg-slate-100 p-1 rounded-xl max-w-md border border-slate-200">
            <button
              onClick={() => setClaimsSubTab('overtime')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                claimsSubTab === 'overtime'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Klaim Lembur Per Menit ({myOvertimeRequests.length})
            </button>
            <button
              onClick={() => setClaimsSubTab('reimbursement')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                claimsSubTab === 'reimbursement'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Klaim Reimbursement ({myReimbursements.length})
            </button>
          </div>

          {/* SUB-TAB: LEMBUR PER MENIT */}
          {claimsSubTab === 'overtime' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Riwayat Pengajuan Lembur (Hitungan Per Menit)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Setiap menit lembur dihitung proporsional ({formatRupiah(myOvertimeRatePerMinute)}/menit) dan otomatis masuk ke slip gaji setelah disetujui HRD
                  </p>
                </div>
                <button
                  onClick={() => setIsOvertimeModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Ajukan Lembur (Per Menit)
                </button>
              </div>

              {/* Info Ringkasan Tarif Lembur Per Menit Karyawan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs">
                <div>
                  <span className="text-indigo-700 block text-[11px]">Tarif Lembur Anda / Menit:</span>
                  <span className="font-mono font-extrabold text-indigo-950 text-sm">
                    {formatRupiah(myOvertimeRatePerMinute)} / menit
                  </span>
                </div>
                <div>
                  <span className="text-indigo-700 block text-[11px]">Total Durasi Disetujui:</span>
                  <span className="font-bold text-indigo-950 text-sm">
                    {formatOvertimeMinutes(
                      myOvertimeRequests
                        .filter((o) => o.status === 'Disetujui')
                        .reduce((acc, o) => acc + getOvertimeMinutes(o), 0)
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-700 block text-[11px]">Total Upah Lembur Disetujui:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatRupiah(
                      myOvertimeRequests
                        .filter((o) => o.status === 'Disetujui')
                        .reduce((acc, o) => acc + o.calculatedPay, 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-3">Tanggal & Jam</th>
                      <th className="py-3 px-3">Durasi (Menit)</th>
                      <th className="py-3 px-3">Tarif / Menit</th>
                      <th className="py-3 px-3">Uraian Tugas Lembur</th>
                      <th className="py-3 px-3">Total Upah Lembur</th>
                      <th className="py-3 px-3">Status Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myOvertimeRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada pengajuan lembur yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      myOvertimeRequests.map((ot) => {
                        const mins = getOvertimeMinutes(ot);
                        const ratePerMin = ot.ratePerMinute || myOvertimeRatePerMinute;
                        return (
                          <tr key={ot.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium">
                              <span className="block">{ot.date}</span>
                              {ot.startTime && ot.endTime && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {ot.startTime} - {ot.endTime} WIB
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-bold text-indigo-700 block">{mins} Menit</span>
                              <span className="text-[10px] text-slate-400">{formatOvertimeMinutes(mins)}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600">
                              {formatRupiah(ratePerMin)}/mnt
                            </td>
                            <td className="py-3 px-3 max-w-sm truncate text-slate-700" title={ot.taskDescription}>
                              {ot.taskDescription}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-bold text-emerald-700 block">
                                {formatCurrency(ot.calculatedPay)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {mins} mnt × {formatRupiah(ratePerMin)}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  ot.status === 'Disetujui'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : ot.status === 'Ditolak'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {ot.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB: REIMBURSEMENT */}
          {claimsSubTab === 'reimbursement' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Riwayat Klaim Reimbursement Pribadi</h3>
                  <p className="text-xs text-slate-500">
                    Penggantian biaya operasional kantor, bensin/tol, atau keperluan dinas luar
                  </p>
                </div>
                <button
                  onClick={() => setIsReimbursementModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Ajukan Klaim Baru
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-3">No Klaim</th>
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3">Nominal Klaim</th>
                      <th className="py-3 px-3">Keterangan</th>
                      <th className="py-3 px-3">Pencairan</th>
                      <th className="py-3 px-3">Bukti Nota</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myReimbursements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Belum ada pengajuan klaim reimbursement.
                        </td>
                      </tr>
                    ) : (
                      myReimbursements.map((rmb) => (
                        <tr key={rmb.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                            {rmb.claimNumber}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-500">{rmb.date}</td>
                          <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-700">{rmb.category}</td>
                          <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">
                            {formatCurrency(rmb.amount)}
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={rmb.description}>
                            {rmb.description}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                            {rmb.paymentMethod || 'Transfer'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {rmb.receiptPhotoUrl ? (
                              <button
                                onClick={() => setPreviewReceiptUrl(rmb.receiptPhotoUrl || null)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] underline flex items-center gap-1"
                              >
                                Lihat Nota
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                rmb.status === 'Dibayarkan'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : rmb.status === 'Disetujui'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : rmb.status === 'Ditolak'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {rmb.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PENGAJUAN KASBON & CICILAN POTONG GAJI */}
      {activePortalTab === 'cash_advance' && (
        <div className="space-y-6 animate-in fade-in-50">
          {cashAdvanceSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{cashAdvanceSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setCashAdvanceSuccessMsg(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-100">
                  Plafon Maksimum Kasbon Anda
                </span>
                <h3 className="text-2xl font-extrabold mt-1">
                  {formatRupiah(maxCashAdvancePlafon)}
                </h3>
                <p className="text-xs text-amber-100 mt-1">
                  Maksimal 100% dari Gaji Pokok ({currentEmployee.role})
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setCashAdvanceAmount(Math.min(1500000, maxCashAdvancePlafon));
                    setCashAdvanceTenor(3);
                    setCashAdvanceReason('');
                    setCashAdvanceError(null);
                    setIsCashAdvanceModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-white text-amber-900 hover:bg-amber-50 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-700" />
                  <span>Ajukan Pinjaman Kasbon Baru</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sisa Pinjaman Kasbon Berjalan
                </span>
                <h3 className="text-2xl font-bold text-indigo-700 mt-1">
                  {formatRupiah(activeCashAdvanceBalance)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Total pokok kasbon aktif yang sedang dicicil melalui potong gaji
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Status Pengajuan Aktif:</span>
                <span className="font-bold text-indigo-700">
                  {myCashAdvances.filter((c) => c.status === 'disbursed' || c.status === 'pending' || c.status === 'approved').length} Kasbon
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Potongan Cicilan Bulan Ini ({companyConfig.currentPayrollPeriod})
                </span>
                <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                  {formatRupiah(
                    myCashAdvances
                      .filter((c) => c.status === 'disbursed')
                      .reduce((sum, c) => {
                        const inst = c.installments.find(
                          (i) => i.period === companyConfig.currentPayrollPeriod
                        );
                        return sum + (inst ? inst.amount : 0);
                      }, 0)
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Otomatis terhubung dengan slip gaji bulanan Anda
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Rekening Pencairan:</span>
                <span className="font-mono font-bold text-slate-800">
                  {currentEmployee.bankName} - {currentEmployee.bankAccountNumber}
                </span>
              </div>
            </div>
          </div>

          {/* List of Employee Cash Advances & Installments */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-amber-600" />
                  <span>Riwayat Pengajuan Kasbon & Jadwal Cicilan Potong Gaji</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Terhubung langsung secara real-time dengan Panel Kasbon Admin HR & Finance PT Tas Grosir Import.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCashAdvanceAmount(Math.min(1500000, maxCashAdvancePlafon));
                  setCashAdvanceTenor(3);
                  setCashAdvanceReason('');
                  setCashAdvanceError(null);
                  setIsCashAdvanceModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Ajukan Kasbon Baru</span>
              </button>
            </div>

            {myCashAdvances.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <HandCoins className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  Belum Ada Riwayat Pengajuan Kasbon
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Anda dapat mengajukan fasilitas pinjaman kasbon darurat karyawan dengan cicilan potong gaji otomatis hingga 12 bulan tanpa bunga.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myCashAdvances.map((ca) => {
                  const statusInfo =
                    ca.status === 'pending'
                      ? {
                          label: 'Menunggu Persetujuan HR/Finance',
                          cls: 'bg-amber-100 text-amber-800 border-amber-200',
                        }
                      : ca.status === 'approved'
                      ? {
                          label: 'Disetujui HRD (Menunggu Pencairan Transfer)',
                          cls: 'bg-blue-100 text-blue-800 border-blue-200',
                        }
                      : ca.status === 'disbursed'
                      ? {
                          label: 'Aktif Dicairkan (Sedang Dicicil)',
                          cls: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                        }
                      : ca.status === 'paid'
                      ? {
                          label: 'Lunas',
                          cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        }
                      : {
                          label: 'Ditolak',
                          cls: 'bg-rose-100 text-rose-800 border-rose-200',
                        };

                  return (
                    <div
                      key={ca.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 space-y-4 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              #{ca.id.toUpperCase()}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.cls}`}
                            >
                              {statusInfo.label}
                            </span>
                            <span className="text-xs text-slate-400">
                              • Diajukan: {formatIndoDate(ca.createdAt.slice(0, 10))}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium mt-1.5">
                            <strong>Keperluan:</strong> &ldquo;{ca.reason}&rdquo;
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Nominal Pinjaman Kasbon
                          </span>
                          <span className="text-lg font-black text-slate-900">
                            {formatRupiah(ca.amount)}
                          </span>
                          <span className="text-[11px] text-amber-700 font-semibold block">
                            Tenor {ca.tenorMonths} Bulan ({formatRupiah(ca.monthlyInstallment)} / bln)
                          </span>
                        </div>
                      </div>

                      {/* Progress & Balance Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">Sudah Terpotong Gaji:</span>
                          <span className="font-bold text-emerald-700 text-sm">
                            {formatRupiah(ca.totalPaid)}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">Sisa Pokok Kasbon:</span>
                          <span className="font-bold text-indigo-700 text-sm">
                            {formatRupiah(ca.remainingBalance)}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">Info Pencairan / Otorisasi:</span>
                          <span className="font-semibold text-slate-800 text-[11px] block truncate">
                            {ca.disbursedAt
                              ? `${ca.disbursementMethod || 'Transfer'} (${ca.disbursementReference || '-'})`
                              : ca.approvedBy
                              ? `Disetujui oleh ${ca.approvedBy}`
                              : ca.rejectionReason
                              ? `Alasan ditolak: ${ca.rejectionReason}`
                              : 'Menunggu verifikasi Admin HR'}
                          </span>
                        </div>
                      </div>

                      {/* Installments Schedule Table */}
                      {ca.installments && ca.installments.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[11px] font-bold text-slate-600 block mb-2">
                            Jadwal Angsuran Potong Gaji ({ca.installments.length}x Cicilan):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {ca.installments.map((inst) => (
                              <div
                                key={inst.installmentNumber}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                                  inst.status === 'deducted'
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-[11px]">
                                    Cicilan ke-{inst.installmentNumber} ({inst.period})
                                  </div>
                                  <div className="font-mono font-bold text-xs">
                                    {formatRupiah(inst.amount)}
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    inst.status === 'deducted'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {inst.status === 'deducted' ? 'Lunas' : 'Terjadwal'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN KASBON BARU (PORTAL KARYAWAN) */}
      {isCashAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Form Pengajuan Kasbon Karyawan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Otomatis terkirim ke Panel Kasbon Admin HR & Finance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCashAdvanceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCashAdvance} className="space-y-4 text-xs">
              {cashAdvanceError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{cashAdvanceError}</span>
                </div>
              )}

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 block">
                    Pemohon Kasbon: <strong>{currentEmployee.fullName}</strong> ({currentEmployee.nik})
                  </span>
                  <span className="text-[11px] text-amber-900 font-bold">
                    Plafon Maksimum Kasbon: {formatRupiah(maxCashAdvancePlafon)}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800">
                  Bunga 0%
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Pinjaman Kasbon (Rp) *
                </label>
                <input
                  type="number"
                  min={100000}
                  max={maxCashAdvancePlafon}
                  step={50000}
                  required
                  value={cashAdvanceAmount}
                  onChange={(e) => setCashAdvanceAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-extrabold text-slate-900 focus:outline-hidden focus:border-amber-600"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[500000, 1000000, 2000000, 3000000, Math.round(maxCashAdvancePlafon * 0.5)]
                    .filter((v, idx, arr) => v <= maxCashAdvancePlafon && arr.indexOf(v) === idx)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashAdvanceAmount(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          cashAdvanceAmount === preset
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        {formatRupiah(preset)}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Pilih Tenor Cicilan Potong Gaji *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([1, 3, 6, 12] as CashAdvanceTenorMonths[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCashAdvanceTenor(t)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        cashAdvanceTenor === t
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t} Bulan
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-indigo-800 block">
                    Estimasi Potongan Gaji per Bulan ({cashAdvanceTenor}x Cicilan):
                  </span>
                  <span className="text-[10px] text-indigo-600">
                    Mulai periode payroll {companyConfig.currentPayrollPeriod}
                  </span>
                </div>
                <span className="text-base font-black text-indigo-900">
                  {formatRupiah(Math.round(cashAdvanceAmount / cashAdvanceTenor))} / bln
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan / Keperluan Pengajuan Kasbon *
                </label>
                <textarea
                  rows={3}
                  required
                  value={cashAdvanceReason}
                  onChange={(e) => setCashAdvanceReason(e.target.value)}
                  placeholder="Jelaskan keperluan pengajuan kasbon (contoh: Biaya pengobatan keluarga, perbaikan kendaraan kerja, biaya pendidikan anak, dll)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCashAdvanceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <HandCoins className="w-4 h-4" />
                  <span>Kirim Pengajuan Kasbon</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: ASET KANTOR & INVENTARIS SAYA */}
      {activePortalTab === 'assets' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Aset Dipegang
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                  {myAssets.length} <span className="text-sm font-normal text-slate-400">Unit</span>
                </h3>
                <p className="text-xs text-teal-600 mt-0.5">Tanggung jawab dinas aktif</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valuasi Fasilitas Kantor
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  {formatRupiah(myAssets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0))}
                </h3>
                <p className="text-xs text-emerald-600 mt-0.5">Inventaris PT TGI</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Kondisi Fasilitas
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  {myAssets.filter((a) => a.condition === 'Baik').length} / {myAssets.length}{' '}
                  <span className="text-xs font-normal text-slate-400">Normal</span>
                </h3>
                <p className="text-xs text-indigo-600 mt-0.5">Siap menunjang kerja</p>
              </div>
            </div>
          </div>

          {/* List of Held Assets */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Daftar Fasilitas & Aset Kantor yang Sedang Anda Pegang
                </h3>
                <p className="text-xs text-slate-500">
                  Harap jaga dan rawat inventaris perusahaan yang diamanahkan kepada Anda dengan sebaik-baiknya
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-teal-50 text-teal-800 rounded-lg border border-teal-200 self-start sm:self-auto">
                {myAssets.length} Aset Terdaftar atas Nama Anda
              </span>
            </div>

            {myAssets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Boxes className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700 text-sm">
                  Saat ini tidak ada aset atau fasilitas kantor yang tercatat atas nama Anda.
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Jika Anda telah menerima laptop, scanner barcode, atau fasilitas operasional lain dari HR/Operasional, hubungi admin untuk verifikasi penugasan aset.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 shadow-xs space-y-3 relative group hover:border-teal-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                          {asset.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                          {asset.name}
                        </h4>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">{asset.assetCode}</span>
                          {asset.serialNumber && <span>• SN: {asset.serialNumber}</span>}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          asset.condition === 'Baik'
                            ? 'bg-emerald-100 text-emerald-800'
                            : asset.condition === 'Perlu Perbaikan'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {asset.condition}
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tanggal Diserahkan:</span>
                        <span className="font-semibold text-slate-800">{asset.assignedDate || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Nilai Aset Resmi:</span>
                        <span className="font-semibold text-slate-800">{formatRupiah(asset.purchaseCost)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Masa Garansi:</span>
                        <span className="text-slate-700">{asset.warrantyExpiry || 'Tidak tercatat'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Lokasi Penempatan:</span>
                        <span className="text-slate-700 truncate block">{asset.location || 'Kantor / Gudang TGI'}</span>
                      </div>
                    </div>

                    {asset.handoverConditionNotes && (
                      <div className="p-2.5 bg-slate-100/80 rounded-xl text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700 block text-[10px] uppercase">
                          Catatan Serah Terima:
                        </span>
                        <p className="mt-0.5 italic">{asset.handoverConditionNotes}</p>
                      </div>
                    )}

                    {asset.specifications && (
                      <p className="text-[11px] text-slate-500">
                        <strong>Spesifikasi:</strong> {asset.specifications}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Terdaftar resmi di HR & IT TGI
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onReportAssetIssue) {
                            onReportAssetIssue(
                              asset.id,
                              `Laporan kendala pada aset ${asset.name} (${asset.assetCode})`
                            );
                          }
                          setReportedAssetNotice(
                            `Laporan kendala inventaris ${asset.name} (${asset.assetCode}) telah diteruskan ke tim IT & HR PT Tas Grosir Import.`
                          );
                          setTimeout(() => setReportedAssetNotice(null), 5000);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Laporkan Kendala</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reportedAssetNotice && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{reportedAssetNotice}</span>
                </span>
                <button
                  onClick={() => setReportedAssetNotice(null)}
                  className="text-indigo-500 hover:text-indigo-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: RAPOR PENILAIAN KINERJA & KPI PRIBADI */}
      {activePortalTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  Rapor Penilaian Kinerja & Evaluasi KPI Pribadi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hasil penilaian berkala dari atasan/manajemen PT Tas Grosir Import beserta catatan feedback pembinaan dan insentif bonus.
                </p>
              </div>

              {myReviews.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                    {myReviews.length} Periode Evaluasi
                  </span>
                </div>
              )}
            </div>

            {myReviews.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">Belum Ada Catatan Penilaian Kinerja</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Atasan atau tim HRD belum merilis lembar evaluasi berkala untuk akun Anda pada periode saat ini.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {myReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 shadow-xs space-y-4"
                  >
                    {/* Header Review */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            Periode Evaluasi: {rev.period}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                            {rev.periodType}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Dinilai oleh: <strong>{rev.reviewerName}</strong> ({rev.reviewerRole}) • Tgl: {formatIndoDate(rev.reviewDate)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">SKOR AKHIR</span>
                          <span className="text-2xl font-black text-slate-900 leading-tight">
                            {rev.finalScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                          </span>
                        </div>
                        <div className="pl-3 border-l border-slate-200 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                            rev.grade === 'A+' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            rev.grade === 'A' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                            rev.grade === 'B+' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            rev.grade === 'B' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            Grade {rev.grade}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Komponen Penilaian */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>KPI (Bobot 40%)</span>
                          <span className="font-bold text-indigo-700">{rev.kpiScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.kpiScore)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>Kedisiplinan (20%)</span>
                          <span className="font-bold text-teal-700">{rev.disciplineScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.disciplineScore)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>Kerjasama Tim (20%)</span>
                          <span className="font-bold text-blue-700">{rev.teamworkScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.teamworkScore)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span>Inisiatif (20%)</span>
                          <span className="font-bold text-purple-700">{rev.initiativeScore}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${Math.min(100, rev.initiativeScore)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Feedback & Catatan Tertulis Atasan */}
                    <div className="space-y-2.5 text-xs">
                      {rev.strengthsNotes && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                          <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
                            Kelebihan & Prestasi Anda
                          </span>
                          <p className="text-slate-700 mt-1 text-[11px] leading-relaxed">
                            {rev.strengthsNotes}
                          </p>
                        </div>
                      )}

                      {rev.improvementsNotes && (
                        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                            Area yang Perlu Ditingkatkan
                          </span>
                          <p className="text-slate-700 mt-1 text-[11px] leading-relaxed">
                            {rev.improvementsNotes}
                          </p>
                        </div>
                      )}

                      {rev.generalFeedback && (
                        <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
                          <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
                            <Star className="w-3.5 h-3.5 text-indigo-700" />
                            Pesan & Ulasan Keseluruhan dari Atasan
                          </span>
                          <p className="text-slate-700 mt-1 text-[11px] leading-relaxed italic">
                            &ldquo;{rev.generalFeedback}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bonus Insentif Kinerja Terintegrasi */}
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-900 block">
                          Bonus Insentif Kinerja untuk Periode Ini:
                        </span>
                        <span className="text-base font-extrabold text-emerald-800">
                          {formatRupiah(rev.recommendedBonus)}
                        </span>
                      </div>
                      <div>
                        {rev.isBonusAppliedToPayroll ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-full font-bold text-xs shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Telah Dicairkan / Disinkronkan ke Slip Gaji ({rev.payrollPeriodApplied || rev.period})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-semibold text-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Menunggu Jadwal Pencairan Payroll
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PROFIL & DATA REKENING PRIBADI */}
      {activePortalTab === 'profile' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Profil & Rekening Penerima Gaji</h3>
              <p className="text-xs text-slate-500">
                Perbarui nomor kontak darurat, alamat domisili, atau nomor rekening bank payroll Anda
              </p>
            </div>
            {profileSuccessMsg && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Data berhasil diperbarui & tersinkronisasi!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Read-Only Employment Master Data */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Data Kepegawaian Resmi (Read-Only)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor Induk Karyawan:</span>
                  <span className="font-mono font-bold text-slate-800">{currentEmployee.nik}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Departemen:</span>
                  <span className="font-semibold text-slate-800">{currentEmployee.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Posisi / Jabatan:</span>
                  <span className="font-semibold text-slate-800">{currentEmployee.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status Ikatan Kerja:</span>
                  <span className="font-semibold text-emerald-700">{currentEmployee.employmentStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">NPWP:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.npwp || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">No. BPJS Kesehatan:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.bpjsKesehatanNo || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">No. BPJS Ketenagakerjaan:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.bpjsKetenagakerjaanNo || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tanggal Bergabung:</span>
                  <span className="text-slate-700">{currentEmployee.joinDate}</span>
                </div>
              </div>
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Kontak & Domisili */}
              <div className="space-y-3.5">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Informasi Kontak & Akun
                </h4>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Email Perusahaan</label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Akun Google Terhubung (SSO)</label>
                  <input
                    type="email"
                    value={profileForm.googleEmail}
                    onChange={(e) => setProfileForm({ ...profileForm, googleEmail: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Alamat Tempat Tinggal (Domisili)</label>
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Rekening Bank & Kontak Darurat */}
              <div className="space-y-3.5">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Rekening Bank Penerima Gaji
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Nama Bank</label>
                    <select
                      value={profileForm.bankName}
                      onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value as any })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                    >
                      <option value="BCA">BCA (Bank Central Asia)</option>
                      <option value="Mandiri">Bank Mandiri</option>
                      <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                      <option value="BNI">Bank Negara Indonesia (BNI)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      required
                      value={profileForm.bankAccountNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">Nama Pemilik Rekening (Sesuai Buku Tabungan)</label>
                  <input
                    type="text"
                    required
                    value={profileForm.bankAccountHolder}
                    onChange={(e) => setProfileForm({ ...profileForm, bankAccountHolder: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    Kontak Darurat (Emergency Contact)
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Nama Kontak Darurat</label>
                      <input
                        type="text"
                        value={profileForm.emergencyName}
                        onChange={(e) => setProfileForm({ ...profileForm, emergencyName: e.target.value })}
                        placeholder="Contoh: Rina (Istri)"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Hubungan</label>
                      <input
                        type="text"
                        value={profileForm.emergencyRelation}
                        onChange={(e) => setProfileForm({ ...profileForm, emergencyRelation: e.target.value })}
                        placeholder="Pasangan / Orang Tua"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">No. Telp Darurat</label>
                    <input
                      type="text"
                      value={profileForm.emergencyPhone}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyPhone: e.target.value })}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan Perubahan Data Profil
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PENGAJUAN CUTI */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Form Pengajuan Cuti & Izin</h3>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-3.5 text-xs">
              {leaveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-xs">{leaveError}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Cuti / Izin *</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {leaveForm.type === 'Cuti Tahunan' && (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Sisa jatah cuti tahunan Anda: <strong>{currentEmployee.remainingLeaveDays} hari</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600">Total Durasi Hari Kerja:</span>
                <span className="font-bold text-slate-900 text-sm">{calculatedLeaveDays} Hari</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan / Keperluan Cuti *</label>
                <textarea
                  required
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Jelaskan alasan pengajuan cuti secara singkat dan jelas..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  Kirim Permohonan Cuti
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN LEMBUR (HITUNGAN PER MENIT) */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Form Pengajuan Lembur (Hitungan Per Menit)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pilih jam mulai & selesai atau ketik langsung durasi menit lembur Anda
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOvertimeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOvertime} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Lembur *</label>
                  <input
                    type="date"
                    required
                    value={overtimeForm.date}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={overtimeForm.startTime}
                    onChange={(e) => handleOvertimeTimeRangeChange(e.target.value, overtimeForm.endTime)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={overtimeForm.endTime}
                    onChange={(e) => handleOvertimeTimeRangeChange(overtimeForm.startTime, e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Jumlah Durasi Lembur (Menit) *
                  </label>
                  <span className="text-[11px] font-bold text-indigo-600">
                    Setara: {formatOvertimeMinutes(overtimeForm.minutes)}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={720}
                  step={1}
                  required
                  value={overtimeForm.minutes}
                  onChange={(e) =>
                    setOvertimeForm({ ...overtimeForm, minutes: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono font-bold text-sm text-slate-900"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[15, 30, 45, 60, 90, 120, 150, 180, 240].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOvertimeForm({ ...overtimeForm, minutes: preset })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        overtimeForm.minutes === preset
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {preset} Menit
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Tarif Lembur Anda per Menit:</span>
                  <span className="font-mono font-bold">{formatCurrency(myOvertimeRatePerMinute)} / menit</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Rumus Kalkulasi:</span>
                  <span className="font-mono font-semibold">
                    {overtimeForm.minutes} menit × {formatCurrency(myOvertimeRatePerMinute)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-indigo-200/80 flex items-center justify-between">
                  <span className="font-bold text-indigo-950">Estimasi Kompensasi Lembur:</span>
                  <span className="font-black text-indigo-900 text-sm">
                    {formatCurrency(estimatedOvertimePay)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian Tugas Lembur *</label>
                <textarea
                  required
                  rows={3}
                  value={overtimeForm.taskDescription}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, taskDescription: e.target.value })}
                  placeholder="Jelaskan pekerjaan atau target operasional yang diselesaikan saat lembur..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Kirim Klaim Lembur ({overtimeForm.minutes} Menit)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGAJUAN REIMBURSEMENT */}
      {isReimbursementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Form Pengajuan Reimbursement</h3>
              </div>
              <button
                onClick={() => setIsReimbursementModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReimbursement} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Biaya *</label>
                  <select
                    value={reimbursementForm.category}
                    onChange={(e) => setReimbursementForm({ ...reimbursementForm, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  >
                    {REIMBURSEMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nominal Biaya (Rp) *</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={reimbursementForm.amount}
                    onChange={(e) => setReimbursementForm({ ...reimbursementForm, amount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Pencairan Pilihan</label>
                <select
                  value={reimbursementForm.paymentMethod}
                  onChange={(e) => setReimbursementForm({ ...reimbursementForm, paymentMethod: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                >
                  <option value="Transfer Bank">Transfer ke Rekening Gaji ({currentEmployee.bankName})</option>
                  <option value="Kas Kecil (Petty Cash)">Kas Kecil Tunai (Petty Cash Kantor)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Pengeluaran *</label>
                <textarea
                  required
                  rows={2}
                  value={reimbursementForm.description}
                  onChange={(e) => setReimbursementForm({ ...reimbursementForm, description: e.target.value })}
                  placeholder="Contoh: Bensin & e-toll pengantaran pesanan tas reseller Mangga Dua..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lampiran Foto Nota / Struk Bukti *</label>
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-600 font-medium">
                    {reimbursementForm.receiptFileName || 'Klik untuk pilih foto struk / nota'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.xlsx,.csv"
                    onChange={handleSimulatedFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReimbursementModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  Kirim Klaim Reimbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW NOTA */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Bukti Kwitansi / Struk Klaim</h4>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={previewReceiptUrl}
                alt="Nota Klaim"
                className="w-full h-80 object-cover"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilih Identitas / Ganti Akun Karyawan (Dilindungi PIN per Akun) */}
      {isSwitchProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Ganti Akun Portal Karyawan (Verifikasi PIN)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Setiap akun karyawan dilindungi PIN khusus agar privasi slip gaji tetap aman
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSwitchProfileModalOpen(false);
                  setPendingSwitchEmp(null);
                  setSwitchPinInput('');
                  setSwitchPinError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pendingSwitchEmp ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const defPin = companyConfig.securitySettings?.defaultEmployeePin || '1234';
                  const expected = getEmployeeEffectivePin(pendingSwitchEmp, defPin);
                  if (switchPinInput.trim() === expected) {
                    onSelectEmployee(pendingSwitchEmp.id);
                    setIsSwitchProfileModalOpen(false);
                    setPendingSwitchEmp(null);
                    setSwitchPinInput('');
                    setSwitchPinError(null);
                  } else {
                    setSwitchPinError(
                      `PIN salah untuk akun ${pendingSwitchEmp.fullName} (${pendingSwitchEmp.nik})!`
                    );
                  }
                }}
                className="space-y-3"
              >
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-950">
                      {pendingSwitchEmp.fullName}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono">
                      {pendingSwitchEmp.nik} • {pendingSwitchEmp.department}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSwitchEmp(null);
                      setSwitchPinInput('');
                      setSwitchPinError(null);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Ubah Pilihan
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Masukkan PIN / Password Akun {pendingSwitchEmp.fullName}:
                  </label>
                  <input
                    type="password"
                    value={switchPinInput}
                    onChange={(e) => {
                      setSwitchPinInput(e.target.value);
                      setSwitchPinError(null);
                    }}
                    placeholder="Masukkan PIN khusus akun karyawan ini"
                    autoFocus
                    maxLength={12}
                    className="w-full px-3 py-2.5 text-center font-mono text-base font-bold tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                {switchPinError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                    {switchPinError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSwitchEmp(null);
                      setSwitchPinInput('');
                      setSwitchPinError(null);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                  >
                    Verifikasi & Buka Akun
                  </button>
                </div>
              </form>
            ) : (
              <>
                <input
                  type="text"
                  value={profileSearchQuery}
                  onChange={(e) => setProfileSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NIK Anda..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                  {allEmployees
                    .filter(
                      (e) =>
                        e.fullName.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
                        e.nik.toLowerCase().includes(profileSearchQuery.toLowerCase())
                    )
                    .map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          if (emp.id === currentEmployee.id) {
                            setIsSwitchProfileModalOpen(false);
                            return;
                          }
                          setPendingSwitchEmp(emp);
                          setSwitchPinInput('');
                          setSwitchPinError(null);
                        }}
                        className={`w-full p-3 text-left flex items-center justify-between hover:bg-emerald-50 transition-colors cursor-pointer ${
                          emp.id === currentEmployee.id ? 'bg-emerald-50/70' : ''
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{emp.fullName}</div>
                          <div className="text-[11px] text-slate-500">
                            {emp.nik} • {emp.role} ({emp.department})
                          </div>
                        </div>
                        {emp.id === currentEmployee.id ? (
                          <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
                            🔒 Perlu PIN
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
