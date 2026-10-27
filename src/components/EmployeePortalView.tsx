import React, { useState, useMemo, useRef } from 'react';
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
  Home,
  LayoutGrid,
  LogOut,
  Eye,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
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
  deduplicateDailyAttendances,
  calculateEmployeeAttendancePenalty,
  getAttendancePenaltyPolicy,
  formatNpwpInput,
  getNpwpStatusInfo,
  getContractValidityInfo,
} from '../utils/formatters';
import { formatWhatsAppPhone } from '../utils/notificationHelper';
import { getEmployeeEffectivePin } from '../services/supabaseService';
import { validateImageFile, compressImage, compressVideoFrame } from '../utils/imageUtils';
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
  activePortalTabOverride?: 'home' | 'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile' | null;
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
  const [activePortalTab, setActivePortalTab] = useState<'home' | 'payroll' | 'attendance' | 'leave' | 'claims' | 'cash_advance' | 'assets' | 'performance' | 'profile'>('home');
  const [isMobileMenuSheetOpen, setIsMobileMenuSheetOpen] = useState(false);
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

  // Pastikan mode simulasi jam manual selalu nonaktif jika bukan Admin yang membuka kunci
  React.useEffect(() => {
    if (!isAdminUnlocked && useCustomClockTime) {
      setUseCustomClockTime(false);
    }
  }, [isAdminUnlocked, useCustomClockTime]);

  const isAdminSimulationActive = isAdminUnlocked && useCustomClockTime;

  React.useEffect(() => {
    setCustomClockInTime(myShift.checkInTime);
    setCustomClockOutTime(myShift.checkOutTime);
  }, [myShift.id, myShift.checkInTime, myShift.checkOutTime]);

  const penaltyPolicy = useMemo(
    () => getAttendancePenaltyPolicy(companyConfig.attendancePenaltyPolicy),
    [companyConfig.attendancePenaltyPolicy]
  );

  const myAttendances = useMemo(() => {
    const raw = attendances.filter((a) => a.employeeId === currentEmployee.id);
    return deduplicateDailyAttendances(
      raw,
      [currentEmployee],
      companyConfig.workShifts,
      penaltyPolicy
    );
  }, [attendances, currentEmployee, companyConfig.workShifts, penaltyPolicy]);

  const myPenaltySummary = useMemo(
    () =>
      calculateEmployeeAttendancePenalty(
        currentEmployee,
        myAttendances,
        companyConfig.workShifts,
        penaltyPolicy
      ),
    [currentEmployee, myAttendances, companyConfig.workShifts, penaltyPolicy]
  );

  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayAttendance = useMemo(() => {
    return myAttendances.find((a) => a.date === todayDateStr);
  }, [myAttendances, todayDateStr]);

  const shiftEvalPreview = useMemo(() => {
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetIn = isAdminSimulationActive ? customClockInTime : todayAttendance?.checkIn || nowStr;
    const targetOut = isAdminSimulationActive ? customClockOutTime : todayAttendance?.checkOut || myShift.checkOutTime;
    const effectiveGrace = penaltyPolicy.useShiftGracePeriod
      ? myShift.gracePeriodMinutes
      : penaltyPolicy.gracePeriodMinutes;
    return evaluateAttendanceAgainstShift(targetIn, targetOut, myShift, effectiveGrace);
  }, [
    isAdminSimulationActive,
    customClockInTime,
    customClockOutTime,
    todayAttendance,
    myShift,
    penaltyPolicy,
  ]);

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

  // Leave Form State (with Evidence Photo Upload)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'Cuti Tahunan' as LeaveRequest['type'],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: '',
    attachmentUrl: '',
    attachmentName: '',
  });
  const [isCompressingLeavePhoto, setIsCompressingLeavePhoto] = useState(false);

  const handleUploadLeaveAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLeaveError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setLeaveError(validation.error || 'Format gambar bukti tidak didukung.');
      return;
    }
    try {
      setIsCompressingLeavePhoto(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      setLeaveForm((prev) => ({
        ...prev,
        attachmentUrl: compressedDataUrl,
        attachmentName: file.name || 'Bukti_Cuti_Izin.jpg',
      }));
    } catch (err: any) {
      setLeaveError(err?.message || 'Gagal mengompresi gambar bukti cuti/izin.');
    } finally {
      setIsCompressingLeavePhoto(false);
    }
  };

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

  // Profile Edit State (Tanpa Foto KTP, Cukup NIK KTP 16 Digit + Nomor NPWP)
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
    avatarUrl: currentEmployee.avatarUrl || '',
    ktpNumber: currentEmployee.ktpNumber || '',
    npwp: currentEmployee.npwp || '',
  });

  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);
  const [profileUploadBanner, setProfileUploadBanner] = useState<string | null>(null);
  const [profileUploadError, setProfileUploadError] = useState<string | null>(null);
  const [isProcessingProfilePhoto, setIsProcessingProfilePhoto] = useState(false);
  const [previewDocumentModal, setPreviewDocumentModal] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    downloadFileName?: string;
  } | null>(null);

  // Camera state for Profile Photo inside Panel Profil & Bank
  const [activeDocCameraMode, setActiveDocCameraMode] = useState<'profile' | null>(null);
  const docCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const docCameraStreamRef = useRef<MediaStream | null>(null);

  const stopDocCamera = () => {
    if (docCameraStreamRef.current) {
      docCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      docCameraStreamRef.current = null;
    }
    setActiveDocCameraMode(null);
  };

  React.useEffect(() => {
    return () => {
      stopDocCamera();
    };
  }, []);

  const startDocCamera = async (_mode: 'profile' = 'profile') => {
    setProfileUploadError(null);
    stopDocCamera();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setProfileUploadError('Browser perangkat Anda tidak mendukung akses kamera langsung.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
      });
      docCameraStreamRef.current = stream;
      setActiveDocCameraMode('profile');
      setTimeout(() => {
        if (docCameraVideoRef.current) {
          docCameraVideoRef.current.srcObject = stream;
          docCameraVideoRef.current.play().catch(console.error);
        }
      }, 120);
    } catch (err) {
      console.error('Camera access error:', err);
      setProfileUploadError(
        'Gagal membuka kamera. Pastikan izin kamera telah diaktifkan atau gunakan tombol Upload File Gambar.'
      );
      setActiveDocCameraMode(null);
    }
  };

  const captureDocCameraPhoto = () => {
    if (!docCameraVideoRef.current || !activeDocCameraMode) return;
    const video = docCameraVideoRef.current;

    // Otomatis kompres gambar kamera maksimal lebar 800px, format JPEG kualitas 0.8
    const dataUrl = compressVideoFrame(video, 800, 800, 0.8, true);
    if (!dataUrl) return;

    const nowTimestamp = `${new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

    const cleanNikKtp = (profileForm.ktpNumber || '').replace(/\D/g, '').trim();
    const validNikKtp = /^\d{16}$/.test(cleanNikKtp) ? cleanNikKtp : currentEmployee.ktpNumber;

    setProfileForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
    const updatedEmp: Employee = {
      ...currentEmployee,
      phone: profileForm.phone,
      email: profileForm.email,
      googleEmail: profileForm.googleEmail,
      address: profileForm.address,
      bankName: profileForm.bankName,
      bankAccountNumber: profileForm.bankAccountNumber,
      bankAccountHolder: profileForm.bankAccountHolder,
      avatarUrl: dataUrl,
      facePhotoUrl: dataUrl,
      profilePhotoUpdatedAt: nowTimestamp,
      ktpNumber: validNikKtp,
      npwp: profileForm.npwp.trim() || currentEmployee.npwp,
      emergencyContact: {
        name: profileForm.emergencyName,
        relation: profileForm.emergencyRelation,
        phone: profileForm.emergencyPhone,
      },
    };
    onUpdateProfile(updatedEmp);
    setProfileUploadBanner(
      'Foto Profil (JPEG 800px) berhasil dijepret & langsung terintegrasi real-time ke Header, Direktori Admin & Log Presensi!'
    );

    stopDocCamera();
    setTimeout(() => setProfileUploadBanner(null), 5000);
  };

  const handleUploadProfilePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setProfileUploadError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setProfileUploadError(validation.error || 'Format gambar tidak didukung.');
      return;
    }

    try {
      setIsProcessingProfilePhoto(true);
      // Kompresi otomatis maksimal lebar 800px, format JPEG kualitas 0.8
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      const nowTimestamp = `${new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })} • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

      setProfileForm((prev) => ({ ...prev, avatarUrl: compressedDataUrl }));

      const cleanNikKtp = (profileForm.ktpNumber || '').replace(/\D/g, '').trim();
      const validNikKtp = /^\d{16}$/.test(cleanNikKtp) ? cleanNikKtp : currentEmployee.ktpNumber;

      const updatedEmp: Employee = {
        ...currentEmployee,
        phone: profileForm.phone,
        email: profileForm.email,
        googleEmail: profileForm.googleEmail,
        address: profileForm.address,
        bankName: profileForm.bankName,
        bankAccountNumber: profileForm.bankAccountNumber,
        bankAccountHolder: profileForm.bankAccountHolder,
        avatarUrl: compressedDataUrl,
        facePhotoUrl: compressedDataUrl,
        profilePhotoUpdatedAt: nowTimestamp,
        ktpNumber: validNikKtp,
        npwp: profileForm.npwp.trim() || currentEmployee.npwp,
        emergencyContact: {
          name: profileForm.emergencyName,
          relation: profileForm.emergencyRelation,
          phone: profileForm.emergencyPhone,
        },
      };

      onUpdateProfile(updatedEmp);
      setProfileUploadBanner(
        'Foto Profil (terkompresi maks. 800px JPEG 0.8) berhasil diunggah & langsung terupdate di Header, Portal Karyawan, Direktori Admin & Log Presensi!'
      );
      setTimeout(() => setProfileUploadBanner(null), 5000);
    } catch (err: any) {
      setProfileUploadError(err?.message || 'Gagal memproses gambar Foto Profil.');
    } finally {
      setIsProcessingProfilePhoto(false);
    }
  };

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
      avatarUrl: currentEmployee.avatarUrl || '',
      ktpNumber: currentEmployee.ktpNumber || '',
      npwp: currentEmployee.npwp || '',
    });
    setProfileSuccessMsg(false);
  }, [currentEmployee]);

  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Leave Submit Handler (Supports Evidence Photo Attachment)
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

    const nowTimestamp = `${new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

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
      attachmentUrl: leaveForm.attachmentUrl || undefined,
      attachmentName: leaveForm.attachmentName || undefined,
      attachmentUploadedAt: leaveForm.attachmentUrl ? nowTimestamp : undefined,
    };

    onApplyLeave(newReq);
    setIsLeaveModalOpen(false);
    setLeaveError(null);
    setLeaveForm({
      type: 'Cuti Tahunan',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      reason: '',
      attachmentUrl: '',
      attachmentName: '',
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

  const isCurrentKtpNumberValid = /^\d{16}$/.test((currentEmployee.ktpNumber || '').trim());
  const isFormKtpNumberValid = /^\d{16}$/.test((profileForm.ktpNumber || '').replace(/\D/g, '').trim());
  const npwpInfo = useMemo(
    () => getNpwpStatusInfo(profileForm.npwp, profileForm.ktpNumber),
    [profileForm.npwp, profileForm.ktpNumber]
  );
  const myContractInfo = useMemo(() => getContractValidityInfo(currentEmployee), [currentEmployee]);
  const formNpwpStatus = npwpInfo;
  const contractValidity = myContractInfo;
  const isCompressingLeaveAttachment = isCompressingLeavePhoto;
  const formatDateID = formatIndoDate;

  // Profile Save Handler with strict 16-digit NIK KTP validation & NPWP integration
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileUploadError(null);

    const cleanedNikKtp = (profileForm.ktpNumber || '').replace(/\D/g, '').trim();
    if (!/^\d{16}$/.test(cleanedNikKtp)) {
      setProfileUploadError(
        `Validasi Gagal: Kolom 'Nomor NIK KTP (16 Digit)' wajib diisi tepat 16 digit angka (saat ini terisi ${cleanedNikKtp.length} digit). Mohon lengkapi NIK KTP Anda sebelum menyimpan perubahan profil.`
      );
      return;
    }

    const cleanedNpwpDigits = (profileForm.npwp || '').replace(/\D/g, '');
    if (cleanedNpwpDigits.length > 0 && cleanedNpwpDigits.length !== 15 && cleanedNpwpDigits.length !== 16) {
      setProfileUploadError(
        `Validasi NPWP: Nomor NPWP harus terdiri dari 15 digit atau 16 digit angka (Pemadanan NIK-NPWP). Saat ini terisi ${cleanedNpwpDigits.length} digit.`
      );
      return;
    }

    const finalNpwp =
      cleanedNpwpDigits.length === 16
        ? cleanedNpwpDigits
        : cleanedNpwpDigits.length === 15
        ? formatNpwpInput(cleanedNpwpDigits)
        : profileForm.npwp.trim() || currentEmployee.npwp;

    const updated: Employee = {
      ...currentEmployee,
      phone: profileForm.phone,
      email: profileForm.email,
      googleEmail: profileForm.googleEmail,
      address: profileForm.address,
      bankName: profileForm.bankName,
      bankAccountNumber: profileForm.bankAccountNumber,
      bankAccountHolder: profileForm.bankAccountHolder,
      avatarUrl: profileForm.avatarUrl || currentEmployee.avatarUrl,
      facePhotoUrl: profileForm.avatarUrl || currentEmployee.facePhotoUrl || currentEmployee.avatarUrl,
      ktpNumber: cleanedNikKtp,
      npwp: finalNpwp,
      emergencyContact: {
        name: profileForm.emergencyName,
        relation: profileForm.emergencyRelation,
        phone: profileForm.emergencyPhone,
      },
    };

    onUpdateProfile(updated);
    setProfileSuccessMsg(true);
    setProfileUploadBanner(
      `Profil, Rekening Bank, NIK KTP (${cleanedNikKtp}) & NPWP (${finalNpwp}) berhasil disimpan dan langsung tersinkronisasi ke Panel Admin HR & Pajak PPh 21!`
    );
    setTimeout(() => {
      setProfileSuccessMsg(false);
      setProfileUploadBanner(null);
    }, 4500);
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

  const portalTabLabels: Record<typeof activePortalTab, string> = {
    home: 'Beranda Ringkasan Karyawan',
    attendance: 'Kamera Absen Wajah & GPS HP',
    payroll: 'Gaji & Slip Gaji Pribadi',
    leave: 'Pengajuan Cuti & Izin',
    claims: 'Klaim Lembur & Reimbursement',
    cash_advance: 'Pengajuan Kasbon & Cicilan',
    assets: 'Inventaris & Aset Kantor Saya',
    performance: 'Rapor Kinerja & KPI',
    profile: 'Profil & Rekening Bank',
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-6 animate-in fade-in-50 max-w-full overflow-x-hidden">
      {/* Top Banner: Employee Mode Active & Back to Admin Switcher */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <img
              src={currentEmployee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
              alt={currentEmployee.fullName}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-3 ring-white/30 shadow-md shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 backdrop-blur-xs text-white border border-white/20">
                  Portal Karyawan
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-400/30 text-emerald-100 border border-emerald-300/30">
                  {currentEmployee.employmentStatus}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-white mt-1 truncate">
                Halo, {currentEmployee.fullName}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5 truncate">
                NIK: <span className="font-mono font-bold">{currentEmployee.nik}</span>
                {currentEmployee.ktpNumber ? (
                  <>
                    {' '}
                    • NIK KTP: <span className="font-mono font-bold">{currentEmployee.ktpNumber}</span>
                  </>
                ) : null}{' '}
                • {currentEmployee.role} ({currentEmployee.department})
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('attendance')}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-emerald-900 hover:bg-emerald-50 shadow-sm cursor-pointer transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {todayAttendance?.checkIn
                      ? `Absen Wajah & GPS HP (${todayAttendance.checkIn})`
                      : 'Absen Foto Wajah & GPS HP Sekarang'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePortalTab('profile')}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isCurrentKtpNumberValid
                      ? 'bg-emerald-900/45 text-emerald-100 border-emerald-400/40 hover:bg-emerald-900/65'
                      : 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 shadow-sm'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isCurrentKtpNumberValid
                      ? `NIK KTP: ${currentEmployee.ktpNumber} • NPWP: ${currentEmployee.npwp || '-'}`
                      : '⚠️ Lengkapi NIK KTP (16 Digit) & NPWP'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePortalTab('profile')}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    myContractInfo.status === 'expired' || myContractInfo.status === 'expiring_soon'
                      ? 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 shadow-sm'
                      : 'bg-white/15 text-white border-white/30 hover:bg-white/25'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>{myContractInfo.badgeText}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Switchers: Sesi Login Ketat — Saat karyawan login dengan NIK & PIN (!isAdminUnlocked), kunci tampilan hanya di Portal Karyawan mereka sendiri & sembunyikan seluruh tombol navigasi ke Dashboard Admin HR */}
          {!isAdminUnlocked ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="inline-flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2 bg-emerald-950/45 border border-emerald-400/35 rounded-xl text-emerald-100 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="font-semibold text-white truncate max-w-[165px]">
                    Sesi Terkunci: {currentEmployee.fullName}
                  </span>
                  <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {currentEmployee.nik}
                  </span>
                </div>
              </div>

              {onLockAdmin && (
                <button
                  type="button"
                  onClick={onLockAdmin}
                  className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-400/40 rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Keluar Sesi Login Portal Karyawan (Logout)"
                >
                  <LogOut className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Keluar Sesi (Logout)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kembali ke Panel Admin</span>
              </button>

              {onLockAdmin && (
                <button
                  type="button"
                  onClick={onLockAdmin}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-950/40 hover:bg-rose-900/40 text-white rounded-xl border border-white/20 transition-all cursor-pointer"
                  title="Kunci Akses Admin dan Kembali ke Mode Karyawan Biasa"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="hidden sm:inline">Kunci</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Warning Banner if Employee has not completed 16-digit NIK KTP */}
      {!isCurrentKtpNumberValid && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 border border-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  Peringatan Wajib Lengkapi Identitas
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-950">
                  Nomor NIK KTP (16 Digit) Anda Belum Lengkap!
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Harap segera lengkapi <strong>Nomor NIK KTP (16 Digit)</strong> dan{' '}
                <strong>Nomor NPWP (15/16 Digit)</strong> di tab{' '}
                <strong>Profil &amp; Bank</strong> untuk kelengkapan administrasi HR dan pelaporan Pajak PPh 21 TER.
              </p>
            </div>
          </div>
          {activePortalTab !== 'profile' && (
            <button
              type="button"
              onClick={() => setActivePortalTab('profile')}
              className="min-h-[38px] px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Lengkapi NIK KTP &amp; NPWP</span>
            </button>
          )}
        </div>
      )}

      {/* Global Contract Expiring / Expired Warning Banner */}
      {myContractInfo.warningMessage && (
        <div
          className={`rounded-2xl p-4 border-2 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in ${
            myContractInfo.status === 'expired'
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 border ${
                myContractInfo.status === 'expired'
                  ? 'bg-rose-100 text-rose-700 border-rose-300'
                  : 'bg-amber-100 text-amber-700 border-amber-300'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    myContractInfo.status === 'expired'
                      ? 'bg-rose-200 text-rose-900'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {myContractInfo.badgeText}
                </span>
                <span className="text-xs sm:text-sm font-bold">
                  Status Kontrak Kerja ({currentEmployee.employmentStatus})
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-90">{myContractInfo.warningMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentEmployee.contractDocumentUrl && (
              <button
                type="button"
                onClick={() =>
                  setPreviewDocumentModal({
                    title: `Dokumen Kontrak Kerja — ${currentEmployee.fullName}`,
                    subtitle: `${currentEmployee.employmentStatus} • No: ${
                      currentEmployee.contractDocumentNumber || '-'
                    }`,
                    imageUrl: currentEmployee.contractDocumentUrl!,
                    downloadFileName:
                      currentEmployee.contractDocumentName ||
                      `Kontrak_${currentEmployee.nik}.jpg`,
                  })
                }
                className="min-h-[38px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lihat Dokumen Kontrak</span>
              </button>
            )}
            {activePortalTab !== 'profile' && (
              <button
                type="button"
                onClick={() => setActivePortalTab('profile')}
                className="min-h-[38px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Detail Kontrak</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unread Performance / Payroll Notification Alert Banner */}
      {unreadKpiNotifs.length > 0 && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
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

      {/* Mobile Active Section Header Bar (<768px) — Replaces Horizontal Scroll Tabs on Phones */}
      <div className="md:hidden bg-white rounded-2xl px-3.5 py-2.5 border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">
            {portalTabLabels[activePortalTab]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer shrink-0"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
          <span>Semua Menu</span>
        </button>
      </div>

      {/* Desktop Navigation Sub-Tabs (≥768px) */}
      <div className="hidden md:flex bg-white rounded-2xl p-2 border border-slate-200 shadow-xs items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActivePortalTab('home')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'home'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Home className="w-4 h-4" />
          Beranda
        </button>

        <button
          onClick={() => setActivePortalTab('attendance')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Camera className="w-4 h-4" />
          Kamera Absen & GPS
          {todayAttendance ? (
            <span className="w-2 h-2 rounded-full bg-emerald-300 ring-1 ring-white" title="Sudah Absen Hari Ini" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Belum Absen Hari Ini" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('payroll')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'payroll'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <WalletCards className="w-4 h-4" />
          Slip Gaji Pribadi
        </button>

        <button
          onClick={() => setActivePortalTab('leave')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'leave'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Cuti & Izin
          {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('claims')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'claims'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Lembur & Klaim
        </button>

        <button
          onClick={() => setActivePortalTab('cash_advance')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'cash_advance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          <span>Kasbon ({myCashAdvances.length})</span>
          {myCashAdvances.some((c) => c.status === 'pending' || c.status === 'approved') && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('assets')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'assets'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Aset ({myAssets.length})
        </button>

        <button
          onClick={() => setActivePortalTab('performance')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'performance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Rapor KPI ({myReviews.length})</span>
          {unreadKpiNotifs.some(n => n.category === 'PERFORMANCE_REVIEW') && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-white animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActivePortalTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
            activePortalTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          Profil & Bank
        </button>
      </div>

      {/* TAB 0: BERANDA RINGKASAN KARYAWAN (HOME) */}
      {activePortalTab === 'home' && (
        <div className="space-y-5">
          {/* Card 1: Quick Live Face & GPS Attendance Action Card */}
          <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 text-white border border-slate-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Geofence Radius ≤ 25m Kantor & Anti-Fake GPS</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  {todayAttendance?.checkIn
                    ? `Presensi Hari Ini Tercatat (${todayAttendance.checkIn}${
                        todayAttendance.checkOut ? ` – ${todayAttendance.checkOut}` : ''
                      } WIB)`
                    : 'Anda Belum Absen Masuk Hari Ini'}
                </h3>
                <p className="text-xs text-slate-300">
                  Jadwal Shift: <strong className="text-emerald-400">{myShift.name}</strong> (
                  <span className="font-mono tabular-nums">
                    {myShift.checkInTime} – {myShift.checkOutTime} WIB
                  </span>
                  ) • Toleransi {myShift.gracePeriodMinutes} menit
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('attendance')}
                  className="min-h-[46px] px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer transition-all"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>
                    {todayAttendance?.checkIn
                      ? todayAttendance?.checkOut
                        ? 'Lihat Bukti Absen & Kamera'
                        : 'Buka Kamera & Absen Pulang'
                      : 'Buka Kamera & Absen Masuk'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3-Card Summary Row: Slip Gaji, Sisa Cuti, & Klaim Lembur Per Menit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Take Home Pay Summary */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                    Take Home Pay (Gaji Bersih)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20">
                    {companyConfig.currentPayrollPeriod}
                  </span>
                </div>
                <div className="text-2xl font-extrabold mt-2 tabular-nums tracking-tight">
                  {formatCurrency(takeHomePay)}
                </div>
                <p className="text-[11px] text-emerald-100 mt-1">
                  Rekening: {currentEmployee.bankName} ({currentEmployee.bankAccountNumber})
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('payroll')}
                  className="flex-1 min-h-[38px] py-2 px-3 rounded-xl bg-white text-emerald-900 text-xs font-bold hover:bg-emerald-50 transition-colors cursor-pointer text-center"
                >
                  Rincian Gaji
                </button>
                {currentPay && (
                  <button
                    type="button"
                    onClick={() => onOpenPayslip(currentPay)}
                    className="min-h-[38px] py-2 px-3 rounded-xl bg-emerald-900/50 hover:bg-emerald-900/70 text-white border border-white/25 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* Leave Balance Summary */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Sisa Cuti Tahunan
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {currentEmployee.remainingLeaveDays}{' '}
                    <span className="text-xs font-normal text-slate-500">Hari Tersisa</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length} pengajuan menunggu HR
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('leave')}
                  className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Ajukan Cuti / Izin Baru →
                </button>
              </div>
            </div>

            {/* Overtime Per Minute & Claims Summary */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Lembur Per Menit & Klaim
                  </span>
                  <div className="text-xl font-extrabold text-indigo-700 mt-1 tabular-nums">
                    {formatRupiah(myOvertimeRatePerMinute)}{' '}
                    <span className="text-xs font-normal text-slate-500">/ menit</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Total Lembur Disetujui:{' '}
                    <strong className="text-emerald-700">
                      {formatRupiah(
                        myOvertimeRequests
                          .filter((o) => o.status === 'Disetujui')
                          .reduce((acc, o) => acc + o.calculatedPay, 0)
                      )}
                    </strong>
                  </p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePortalTab('claims')}
                  className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Ajukan Klaim Lembur / Biaya →
                </button>
              </div>
            </div>
          </div>

          {/* Native-App Quick Menu Grid (Great for Mobile Thumb Access) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3">
              Menu Layanan Mandiri Karyawan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                {
                  id: 'attendance' as const,
                  label: 'Kamera Absen',
                  sub: 'Wajah & GPS ≤25m',
                  icon: Camera,
                  color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                },
                {
                  id: 'payroll' as const,
                  label: 'Slip Gaji PDF',
                  sub: companyConfig.currentPayrollPeriod,
                  icon: WalletCards,
                  color: 'bg-teal-50 text-teal-700 border-teal-200',
                },
                {
                  id: 'leave' as const,
                  label: 'Cuti & Izin',
                  sub: `Sisa ${currentEmployee.remainingLeaveDays} Hari`,
                  icon: CalendarDays,
                  color: 'bg-blue-50 text-blue-700 border-blue-200',
                },
                {
                  id: 'claims' as const,
                  label: 'Lembur & Klaim',
                  sub: `${formatRupiah(myOvertimeRatePerMinute)}/mnt`,
                  icon: Clock,
                  color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                },
                {
                  id: 'cash_advance' as const,
                  label: 'Kasbon Gaji',
                  sub: `${myCashAdvances.length} Pinjaman`,
                  icon: HandCoins,
                  color: 'bg-amber-50 text-amber-700 border-amber-200',
                },
                {
                  id: 'assets' as const,
                  label: 'Aset Kantor',
                  sub: `${myAssets.length} Inventaris`,
                  icon: Boxes,
                  color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                },
                {
                  id: 'performance' as const,
                  label: 'Rapor KPI',
                  sub: `${myReviews.length} Evaluasi`,
                  icon: Award,
                  color: 'bg-violet-50 text-violet-700 border-violet-200',
                },
                {
                  id: 'profile' as const,
                  label: 'Profil & Bank',
                  sub: currentEmployee.bankName,
                  icon: User,
                  color: 'bg-slate-100 text-slate-700 border-slate-200',
                },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePortalTab(item.id)}
                    className="min-h-[68px] p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all flex items-center gap-3 text-left cursor-pointer group"
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 ${item.color}`}>
                      <IconComp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                  {(currentPay?.lateDeduction || myPenaltySummary.totalDeductionAmount) > 0 && (
                    <div className="flex justify-between items-start text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-2 rounded-lg gap-2">
                      <div>
                        <span className="font-bold block">
                          Potongan Keterlambatan &amp; Absen
                        </span>
                        <span className="text-[11px] text-rose-700 font-semibold block mt-0.5">
                          {currentPay?.attendanceDeductionNotes || myPenaltySummary.deductionNotes}
                        </span>
                      </div>
                      <span className="font-bold text-rose-700 shrink-0">
                        -{' '}
                        {formatCurrency(
                          currentPay?.lateDeduction ?? myPenaltySummary.totalDeductionAmount
                        )}
                      </span>
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

            {/* Real-Time Clock Enforcement & Admin-Locked Simulation Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              {isAdminUnlocked ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomClockTime}
                        onChange={(e) => setUseCustomClockTime(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>[Khusus Admin] Gunakan Simulasi Jam Absen Manual Mengikuti Shift</span>
                    </label>

                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                      {isAdminSimulationActive
                        ? 'Mode Uji Admin Aktif: Simulasi jam masuk & pulang'
                        : 'Mode Jam Real-Time Perangkat Aktif'}
                    </span>
                  </div>

                  {isAdminSimulationActive && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80 items-end">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Simulasi Jam Masuk (Check-In)
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
                          Simulasi Jam Pulang (Check-Out)
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
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Jam Absen Real-Time Terkunci Otomatis (Anti-Manipulasi Jam Masuk/Pulang)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Waktu absen dikunci mengikuti jam server & perangkat real-time
                  </span>
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
                useCustomClockTime={isAdminSimulationActive}
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

          {/* Personal Attendance History Table (Mobile Cards + Desktop Table) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
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
              <>
                {/* Mobile Card View (<768px) — Zero Horizontal Scroll */}
                <div className="md:hidden divide-y divide-slate-100">
                  {myAttendances.map((att) => {
                    const schedIn = att.scheduledCheckIn || myShift.checkInTime;
                    const schedOut = att.scheduledCheckOut || myShift.checkOutTime;
                    const shiftLabel = att.shiftName || myShift.name;
                    const photoToShow = att.facePhotoSnapshot || att.checkOutPhotoSnapshot;
                    return (
                      <div key={att.id} className="p-4 space-y-3 hover:bg-slate-50/70">
                        {/* Top Row: Date + Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block">
                              {formatIndoDate(att.date)}
                            </span>
                            {att.checkInFullTimestamp && (
                              <span className="text-[10px] font-mono text-emerald-700 block mt-0.5 tabular-nums">
                                {att.checkInFullTimestamp}
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
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
                        </div>

                        {/* Middle Row: Photo Thumbnail + CheckIn/Out Times */}
                        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                          {photoToShow ? (
                            <button
                              type="button"
                              onClick={() => setPreviewAttendanceRecord(att)}
                              className="relative shrink-0 cursor-pointer group"
                            >
                              <img
                                src={photoToShow}
                                alt="Foto Absen"
                                className="w-14 h-14 rounded-xl object-cover border border-emerald-300 shadow-2xs"
                              />
                              <span className="absolute bottom-0.5 right-0.5 bg-emerald-600 text-white text-[9px] font-bold px-1 rounded">
                                Foto
                              </span>
                            </button>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-200/70 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                              No Foto
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1 text-xs">
                            <div className="font-semibold text-slate-800 truncate">
                              {shiftLabel}{' '}
                              <span className="text-[10px] font-mono text-slate-500">
                                ({schedIn}–{schedOut})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums">
                              <span className="text-emerald-700 font-bold">
                                Masuk: {att.checkIn || '-'}
                              </span>
                              <span className="text-indigo-700 font-bold">
                                Pulang: {att.checkOut || '-'} ({att.workHours}j)
                              </span>
                            </div>
                            {photoToShow && (
                              <button
                                type="button"
                                onClick={() => setPreviewAttendanceRecord(att)}
                                className="text-[11px] font-bold text-emerald-700 underline cursor-pointer"
                              >
                                Lihat Bukti Foto & Watermark GPS →
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: GPS Location & Distance */}
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="font-medium text-slate-800 break-words">
                              {att.locationAddress || att.notes || '-'}
                            </span>
                          </div>
                          {att.locationCoords && (
                            <div className="pl-5 text-[10px] font-mono text-slate-500 tabular-nums break-all">
                              GPS: {att.locationCoords.latitude.toFixed(6)},{' '}
                              {att.locationCoords.longitude.toFixed(6)}
                              {att.distanceMeters !== undefined ? ` (${att.distanceMeters}m ≤ 25m)` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (≥768px) */}
                <div className="hidden md:block overflow-x-auto">
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
                                <span className="text-[10px] font-mono text-emerald-700 block mt-0.5 tabular-nums">
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
                              <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                                Jadwal: {schedIn} - {schedOut} WIB
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums">
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
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5 tabular-nums">
                                  GPS: {att.locationCoords.latitude.toFixed(6)},{' '}
                                  {att.locationCoords.longitude.toFixed(6)}
                                  {att.distanceMeters !== undefined ? ` (${att.distanceMeters}m ≤ 25m)` : ''}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
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
                          {previewAttendanceRecord.locationCoords.longitude.toFixed(6)}°
                          {previewAttendanceRecord.distanceMeters !== undefined
                            ? ` (Jarak: ${previewAttendanceRecord.distanceMeters}m / Maks 25m)`
                            : ''}
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
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
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
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
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
                <h3 className="text-2xl font-bold text-amber-700 mt-0.5 tabular-nums">
                  {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length}{' '}
                  <span className="text-sm font-normal text-slate-400">Pengajuan</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Sedang ditinjau HR</p>
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Riwayat Pengajuan Cuti & Izin</h3>
                <p className="text-xs text-slate-500">
                  Pantau status persetujuan cuti Anda secara langsung oleh tim HRD
                </p>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors w-full sm:w-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Buat Pengajuan Cuti Baru
              </button>
            </div>

            {/* Mobile Card View for Leave Requests (<768px) */}
            <div className="md:hidden divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {myLeaveRequests.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Belum ada riwayat pengajuan cuti. Klik tombol di atas untuk mengajukan.
                </div>
              ) : (
                myLeaveRequests.map((leave) => (
                  <div key={leave.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{leave.type}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {leave.startDate} s/d {leave.endDate} ({leave.totalDays} Hari)
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                          leave.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : leave.status === 'Ditolak'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {leave.reason}
                    </p>
                    {leave.attachmentUrl && (
                      <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200/80 rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold text-indigo-900 truncate max-w-[180px]">
                          📎 {leave.attachmentName || 'Bukti Pendukung Cuti/Izin'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDocumentModal({
                              title: `Bukti Cuti / Izin — ${leave.type}`,
                              subtitle: `${currentEmployee.fullName} • ${leave.startDate} s/d ${leave.endDate}`,
                              imageUrl: leave.attachmentUrl!,
                              downloadFileName: leave.attachmentName || `Bukti-Cuti-${leave.id}.jpg`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Lihat Bukti</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Diajukan: {leave.appliedAt}</span>
                      <span>Reviewer: {leave.approvedBy || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Leave History Table (≥768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-3">Tgl Diajukan</th>
                    <th className="py-3 px-3">Jenis Cuti</th>
                    <th className="py-3 px-3">Rentang Tanggal</th>
                    <th className="py-3 px-3">Durasi</th>
                    <th className="py-3 px-3">Alasan / Keperluan</th>
                    <th className="py-3 px-3">Bukti / Lampiran</th>
                    <th className="py-3 px-3">Status Persetujuan</th>
                    <th className="py-3 px-3">Ditinjau Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLeaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
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
                          {leave.attachmentUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDocumentModal({
                                  title: `Bukti Cuti / Izin — ${leave.type}`,
                                  subtitle: `${currentEmployee.fullName} • ${leave.startDate} s/d ${leave.endDate}`,
                                  imageUrl: leave.attachmentUrl!,
                                  downloadFileName: leave.attachmentName || `Bukti-Cuti-${leave.id}.jpg`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Lihat Bukti</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tanpa Lampiran</span>
                          )}
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
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Profil, Identitas Resmi (NIK KTP &amp; NPWP), Kontrak Kerja &amp; Rekening Bank
              </h3>
              <p className="text-xs text-slate-500">
                Kelola Photo Profil, Nomor NIK KTP (16 Digit), Nomor NPWP (terintegrasi Pajak PPh 21 Admin HR), dokumen kontrak kerja, dan rekening gaji
              </p>
            </div>
            {profileSuccessMsg && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Data berhasil diperbarui &amp; tersinkronisasi ke Admin!
              </span>
            )}
          </div>

          {profileUploadBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{profileUploadBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileUploadBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {profileUploadError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{profileUploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileUploadError(null)}
                className="text-rose-700 hover:text-rose-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* SEKSI 1: PHOTO PROFIL & IDENTITAS PAJAK (NIK KTP 16 DIGIT + NPWP) */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/70 via-white to-indigo-50/50 rounded-2xl border border-emerald-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-900">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Photo Profil, Nomor NIK KTP (16 Digit) &amp; Nomor NPWP Pajak
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                      Sinkron Otomatis ke Portal Admin HR &amp; PPh 21
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Unggah Photo Profil Anda dan lengkapi Nomor NIK KTP 16 digit beserta Nomor NPWP (mendukung format 15/16 digit &amp; pemadanan NIK-NPWP Coretax DJP).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    NIK KTP: {isFormKtpNumberValid ? 'Valid (16 Digit)' : 'Belum Lengkap'} • NPWP:{' '}
                    {formNpwpStatus.isValid ? 'Terdaftar' : 'Belum Diisi'}
                  </span>
                </div>
              </div>

              {/* Live Camera Viewfinder when taking Photo Profil */}
              {activeDocCameraMode === 'profile' && (
                <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 border border-slate-700 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold">
                        Kamera Aktif: Ambil Photo Profil Wajah
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={stopDocCamera}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Tutup Kamera
                    </button>
                  </div>

                  <div className="relative mx-auto overflow-hidden rounded-xl bg-black border-2 border-emerald-500/60 flex items-center justify-center w-full max-w-[260px] aspect-square">
                    <video
                      ref={docCameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-full pointer-events-none" />
                  </div>

                  <div className="flex items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={captureDocCameraPhoto}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Jepret &amp; Simpan Photo Profil</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopDocCamera}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Grid 2 Kartu: 1. Photo Profil & 2. Identitas NIK KTP 16 Digit + NPWP */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ITEM 1: UPLOAD PHOTO PROFIL */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                          Photo Profil Karyawan
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Digunakan di Portal Karyawan, Verifikasi Wajah &amp; Data Karyawan Admin HR
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      ✓ Terintegrasi Admin
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div className="relative group shrink-0">
                      <img
                        src={
                          profileForm.avatarUrl ||
                          currentEmployee.avatarUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                        }
                        alt={currentEmployee.fullName}
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: `Photo Profil — ${currentEmployee.fullName}`,
                            subtitle: `NIK: ${currentEmployee.nik} • Terintegrasi dengan Portal Admin HR`,
                            imageUrl:
                              profileForm.avatarUrl ||
                              currentEmployee.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
                            downloadFileName: `Foto-Profil-${currentEmployee.nik}.jpg`,
                          })
                        }
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-2 ring-emerald-500 shadow-md cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: `Photo Profil — ${currentEmployee.fullName}`,
                            subtitle: `NIK: ${currentEmployee.nik} • Terintegrasi dengan Portal Admin HR`,
                            imageUrl:
                              profileForm.avatarUrl ||
                              currentEmployee.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
                            downloadFileName: `Foto-Profil-${currentEmployee.nik}.jpg`,
                          })
                        }
                        className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-slate-900/75 text-white hover:bg-slate-900 cursor-pointer"
                        title="Lihat Photo Profil"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                      <div className="text-xs font-bold text-slate-800">
                        {currentEmployee.fullName} ({currentEmployee.nik})
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {currentEmployee.profilePhotoUpdatedAt
                          ? `Terakhir diperbarui: ${currentEmployee.profilePhotoUpdatedAt}`
                          : 'Format JPG, PNG, atau WebP (Otomatis dikompresi maks. 800px & disinkronkan ke Admin)'}
                      </p>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <label className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isProcessingProfilePhoto ? 'Mengunggah...' : 'Upload Photo Profil'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            onChange={handleUploadProfilePhotoFile}
                            disabled={isProcessingProfilePhoto}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            activeDocCameraMode === 'profile'
                              ? stopDocCamera()
                              : startDocCamera('profile')
                          }
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {activeDocCameraMode === 'profile' ? 'Tutup Kamera' : 'Kamera Selfie'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ITEM 2: IDENTITAS RESMI NIK KTP (16 DIGIT) & NOMOR NPWP PAJAK PPH 21 */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                          Nomor NIK KTP (16 Digit) &amp; Nomor NPWP Pajak
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Tanpa perlu unggah foto KTP — cukup isi NIK 16 digit &amp; NPWP untuk kalkulasi PPh 21 TER
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isFormKtpNumberValid
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {isFormKtpNumberValid ? '✓ NIK 16 Digit Valid' : 'Wajib 16 Digit'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3.5">
                    {/* Input Wajib Isi (Required): Nomor NIK KTP (16 Digit) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <span>Nomor NIK KTP (16 Digit)</span>
                          <span className="text-rose-600 font-extrabold">* (Wajib Diisi)</span>
                        </label>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            isFormKtpNumberValid
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {(profileForm.ktpNumber || '').length}/16 Digit Angka
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          minLength={16}
                          maxLength={16}
                          pattern="\d{16}"
                          value={profileForm.ktpNumber}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 16);
                            setProfileForm({
                              ...profileForm,
                              ktpNumber: digitsOnly,
                            });
                            if (profileUploadError && digitsOnly.length === 16) {
                              setProfileUploadError(null);
                            }
                          }}
                          placeholder="Ketik 16 digit angka NIK sesuai KTP (Contoh: 3171012345670001)"
                          className={`flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border rounded-xl focus:outline-hidden ${
                            isFormKtpNumberValid
                              ? 'border-emerald-400 text-slate-900 focus:ring-2 focus:ring-emerald-500/20'
                              : 'border-amber-400 text-slate-900 focus:ring-2 focus:ring-rose-500/20'
                          }`}
                        />
                        {isFormKtpNumberValid &&
                          profileForm.ktpNumber !== currentEmployee.ktpNumber && (
                            <button
                              type="button"
                              onClick={() => {
                                const cleaned = profileForm.ktpNumber.replace(/\D/g, '').trim();
                                if (!/^\d{16}$/.test(cleaned)) return;
                                onUpdateProfile({
                                  ...currentEmployee,
                                  ktpNumber: cleaned,
                                });
                                setProfileUploadBanner(
                                  `Nomor NIK KTP (${cleaned}) berhasil disimpan & disinkronkan ke Panel Admin HR!`
                                );
                                setTimeout(() => setProfileUploadBanner(null), 4500);
                              }}
                              className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan NIK</span>
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Input Nomor NPWP (15/16 Digit atau Pemadanan NIK-NPWP) */}
                    <div className="pt-2.5 border-t border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>Nomor NPWP (15 / 16 Digit)</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold">
                            PPh 21 TER 2026
                          </span>
                        </label>
                        {isFormKtpNumberValid && (
                          <button
                            type="button"
                            onClick={() => {
                              const nikDigits = profileForm.ktpNumber.replace(/\D/g, '').slice(0, 16);
                              setProfileForm((prev) => ({
                                ...prev,
                                npwp: nikDigits,
                              }));
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            Samakan NPWP = NIK KTP 16 Digit (Coretax DJP)
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={profileForm.npwp}
                          onChange={(e) => {
                            const formatted = formatNpwpInput(e.target.value);
                            setProfileForm({
                              ...profileForm,
                              npwp: formatted,
                            });
                          }}
                          placeholder="Contoh: 12.345.678.9-012.000 atau 16 digit NIK KTP"
                          className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-indigo-500 text-slate-900"
                        />
                        {profileForm.npwp.trim() !== (currentEmployee.npwp || '').trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanedNpwp = profileForm.npwp.trim();
                              onUpdateProfile({
                                ...currentEmployee,
                                ktpNumber: isFormKtpNumberValid
                                  ? profileForm.ktpNumber.replace(/\D/g, '')
                                  : currentEmployee.ktpNumber,
                                npwp: cleanedNpwp,
                              });
                              setProfileUploadBanner(
                                `Nomor NPWP (${cleanedNpwp || 'Kosong'}) berhasil diperbarui & terintegrasi ke tabel Data Karyawan dan Pajak PPh 21 Admin HR!`
                              );
                              setTimeout(() => setProfileUploadBanner(null), 4500);
                            }}
                            className="min-h-[36px] px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Update NPWP</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-semibold ${
                            formNpwpStatus.isValid ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          Status Pajak: {formNpwpStatus.label}
                        </span>
                        <span className="text-slate-400">PTKP: {currentEmployee.ptkpStatus}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEKSI 2: MASA AKTIF KONTRAK KERJA & DOKUMEN KONTRAK KERJA (PKWT / PKWTT) */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        Masa Aktif Kontrak &amp; Dokumen Kontrak Kerja ({currentEmployee.employmentStatus})
                      </h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          contractValidity.isPermanent
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : contractValidity.isExpired
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : contractValidity.isExpiringSoon
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {contractValidity.badgeText}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Dikelola oleh Admin HRD PT Tangan Kita Berkarya • Tersinkronisasi langsung dari menu Data Karyawan
                    </p>
                  </div>
                </div>

                {currentEmployee.contractDocumentUrl ? (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDocumentModal({
                          title: `Dokumen Kontrak Kerja — ${currentEmployee.fullName}`,
                          subtitle: `${
                            currentEmployee.contractDocumentNumber || currentEmployee.employmentStatus
                          } • Masa Berlaku: ${currentEmployee.contractStartDate || currentEmployee.joinDate} s/d ${
                            currentEmployee.contractEndDate || 'Tetap (PKWTT)'
                          }`,
                          imageUrl: currentEmployee.contractDocumentUrl!,
                          downloadFileName:
                            currentEmployee.contractDocumentName ||
                            `Kontrak-Kerja-${currentEmployee.nik}.jpg`,
                        })
                      }
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Dokumen Kontrak</span>
                    </button>
                    <a
                      href={currentEmployee.contractDocumentUrl}
                      download={
                        currentEmployee.contractDocumentName ||
                        `Kontrak-Kerja-${currentEmployee.nik}.jpg`
                      }
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Unduh Kontrak</span>
                    </a>
                  </div>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold">
                    Dokumen fisik/digital belum diunggah oleh Admin HR
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Status Perjanjian Kerja</span>
                  <span className="font-extrabold text-slate-900 mt-0.5 block">
                    {currentEmployee.employmentStatus}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {currentEmployee.contractDocumentNumber || 'No. SK / Kontrak Standar HR'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Tanggal Mulai Kontrak</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {currentEmployee.contractStartDate
                      ? formatDateID(currentEmployee.contractStartDate)
                      : formatDateID(currentEmployee.joinDate)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Tgl Bergabung: {formatDateID(currentEmployee.joinDate)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Tanggal Berakhir Kontrak</span>
                  <span
                    className={`font-bold mt-0.5 block ${
                      contractValidity.isPermanent
                        ? 'text-indigo-700'
                        : contractValidity.isExpired
                        ? 'text-rose-700'
                        : contractValidity.isExpiringSoon
                        ? 'text-amber-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {contractValidity.isPermanent
                      ? 'Tidak Terbatas (Karyawan Tetap)'
                      : currentEmployee.contractEndDate
                      ? formatDateID(currentEmployee.contractEndDate)
                      : 'Belum Ditentukan HR'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentEmployee.contractUpdatedAt
                      ? `Diperbarui HR: ${currentEmployee.contractUpdatedAt}`
                      : 'Terdaftar di Master Data HR'}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    contractValidity.isPermanent
                      ? 'bg-indigo-50/70 border-indigo-200'
                      : contractValidity.isExpired
                      ? 'bg-rose-50 border-rose-200'
                      : contractValidity.isExpiringSoon
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-emerald-50/70 border-emerald-200'
                  }`}
                >
                  <span className="text-[11px] text-slate-600 block">Indikator Masa Aktif Kontrak</span>
                  <span
                    className={`font-extrabold mt-0.5 block ${
                      contractValidity.isPermanent
                        ? 'text-indigo-800'
                        : contractValidity.isExpired
                        ? 'text-rose-800'
                        : contractValidity.isExpiringSoon
                        ? 'text-amber-800'
                        : 'text-emerald-800'
                    }`}
                  >
                    {contractValidity.badgeText}
                  </span>
                  {!contractValidity.isPermanent && contractValidity.daysRemaining !== null && (
                    <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
                      <div
                        className={`h-full rounded-full ${
                          contractValidity.isExpired
                            ? 'bg-rose-600'
                            : contractValidity.isExpiringSoon
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${contractValidity.progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Read-Only Employment Master Data */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Data Kepegawaian Resmi &amp; Identitas Terdaftar (Sinkronisasi Admin HR)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor Induk Karyawan:</span>
                  <span className="font-mono font-bold text-slate-800">{currentEmployee.nik}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor NIK KTP (16 Digit):</span>
                  {currentEmployee.ktpNumber && /^\d{16}$/.test(currentEmployee.ktpNumber) ? (
                    <span className="font-mono font-bold text-indigo-700">
                      {currentEmployee.ktpNumber}
                    </span>
                  ) : (
                    <span className="font-semibold text-rose-600">Belum dilengkapi</span>
                  )}
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
                  <span className="text-slate-400 block text-[11px]">Nomor NPWP Terdaftar:</span>
                  <span className="font-mono font-bold text-slate-800">{currentEmployee.npwp || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">No. BPJS Kesehatan:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.bpjsKesehatanNo || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">No. BPJS Ketenagakerjaan:</span>
                  <span className="font-mono text-slate-700">{currentEmployee.bpjsKetenagakerjaanNo || '-'}</span>
                </div>
              </div>
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Kontak & Domisili */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    Informasi Kontak WhatsApp &amp; Email Notifikasi
                  </h4>
                  {(profileForm.phone !== currentEmployee.phone ||
                    profileForm.email !== currentEmployee.email) && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated: Employee = {
                          ...currentEmployee,
                          phone: profileForm.phone.trim(),
                          email: profileForm.email.trim(),
                        };
                        onUpdateProfile(updated);
                        setProfileUploadBanner(
                          `Nomor WhatsApp (${
                            formatWhatsAppPhone(profileForm.phone) || '-'
                          }) & Email (${
                            profileForm.email
                          }) berhasil disimpan dan disinkronkan ke Supabase!`
                        );
                        setTimeout(() => setProfileUploadBanner(null), 4500);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Simpan WA &amp; Email</span>
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-slate-600">
                      Nomor Telepon / WhatsApp Aktif
                    </label>
                    <span className="text-[10px] font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      Format WA: {formatWhatsAppPhone(profileForm.phone) ? `+${formatWhatsAppPhone(profileForm.phone)}` : 'Belum diisi'}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="Contoh: 0812-3456-7890 (Otomatis diformat ke 628...)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Digunakan untuk menerima notifikasi Slip Gaji, Persetujuan Cuti/Kasbon &amp; Kontrak via WhatsApp
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Alamat Email (Penerima Slip Gaji Resmi)
                  </label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="nama@tasgrosirimport.co.id"
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

              {/* Upload Gambar Bukti Pendukung (Surat Dokter / Bukti Izin - Kompresi Otomatis) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">
                    Upload Gambar Bukti Pendukung (Surat Dokter / Bukti Izin)
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600">
                    Kompresi Otomatis JPEG
                  </span>
                </div>

                {leaveForm.attachmentUrl ? (
                  <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={leaveForm.attachmentUrl}
                        alt="Preview Bukti Cuti"
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: 'Pratinjau Bukti Cuti & Izin',
                            subtitle: leaveForm.attachmentName || 'Bukti Pendukung',
                            imageUrl: leaveForm.attachmentUrl,
                            downloadFileName: leaveForm.attachmentName || 'Bukti-Cuti.jpg',
                          })
                        }
                        className="w-12 h-12 rounded-lg object-cover border border-indigo-300 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {leaveForm.attachmentName || 'Bukti-Cuti-Izin.jpg'}
                        </p>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          ✓ Gambar telah dikompresi &amp; siap dikirim ke Admin HR
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocumentModal({
                            title: 'Pratinjau Bukti Cuti & Izin',
                            subtitle: leaveForm.attachmentName || 'Bukti Pendukung',
                            imageUrl: leaveForm.attachmentUrl,
                            downloadFileName: leaveForm.attachmentName || 'Bukti-Cuti.jpg',
                          })
                        }
                        className="p-1.5 rounded-lg bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                        title="Perbesar Bukti"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLeaveForm((prev) => ({
                            ...prev,
                            attachmentUrl: '',
                            attachmentName: '',
                          }))
                        }
                        className="p-1.5 rounded-lg bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                        title="Hapus Gambar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-slate-700">
                      {isCompressingLeaveAttachment
                        ? 'Mengompresi gambar bukti...'
                        : 'Klik untuk pilih / foto Surat Dokter atau Bukti Izin'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Format JPG, PNG, WebP (Otomatis dikompresi maks. 800px agar ringan)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleUploadLeaveAttachment}
                      disabled={isCompressingLeaveAttachment}
                      className="hidden"
                    />
                  </label>
                )}
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
                  disabled={isCompressingLeaveAttachment}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50"
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

      {/* MODAL PREVIEW PHOTO PROFIL & DOKUMEN KTP */}
      {previewDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewDocumentModal.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{previewDocumentModal.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocumentModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center max-h-[65vh]">
              <img
                src={previewDocumentModal.imageUrl}
                alt={previewDocumentModal.title}
                className="w-full max-h-[62vh] object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Tersinkronisasi dengan Portal Admin HR
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewDocumentModal.imageUrl}
                  download={previewDocumentModal.downloadFileName || 'Dokumen-Karyawan.jpg'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDocumentModal(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  Tutup Pratinjau
                </button>
              </div>
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

      {/* Mobile Bottom Sheet Drawer for Secondary Employee Portal Menus (<768px) */}
      {isMobileMenuSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center md:hidden animate-in fade-in">
          <div className="bg-white w-full rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  Menu Lengkap Portal Karyawan
                </h4>
                <p className="text-[11px] text-slate-500">
                  Pilih fitur layanan mandiri {currentEmployee.fullName} ({currentEmployee.nik})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuSheetOpen(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: 'home' as const,
                  label: 'Beranda Utama',
                  desc: 'Ringkasan & Pintasan',
                  icon: Home,
                  badge: '',
                },
                {
                  id: 'attendance' as const,
                  label: 'Kamera Absen',
                  desc: 'Foto Wajah & GPS ≤25m',
                  icon: Camera,
                  badge: todayAttendance ? 'Sudah Absen' : 'Wajib Absen',
                },
                {
                  id: 'payroll' as const,
                  label: 'Slip Gaji Pribadi',
                  desc: companyConfig.currentPayrollPeriod,
                  icon: WalletCards,
                  badge: 'PDF',
                },
                {
                  id: 'leave' as const,
                  label: 'Cuti & Izin',
                  desc: `Sisa ${currentEmployee.remainingLeaveDays} Hari`,
                  icon: CalendarDays,
                  badge: '',
                },
                {
                  id: 'claims' as const,
                  label: 'Lembur & Klaim',
                  desc: 'Hitungan Per Menit',
                  icon: Clock,
                  badge: `${myOvertimeRequests.length}`,
                },
                {
                  id: 'cash_advance' as const,
                  label: 'Kasbon & Cicilan',
                  desc: 'Potong Gaji Otomatis',
                  icon: HandCoins,
                  badge: `${myCashAdvances.length}`,
                },
                {
                  id: 'assets' as const,
                  label: 'Aset Kantor Saya',
                  desc: 'Inventaris & Laporan',
                  icon: Boxes,
                  badge: `${myAssets.length}`,
                },
                {
                  id: 'performance' as const,
                  label: 'Rapor Kinerja KPI',
                  desc: 'Skor & Bonus Kinerja',
                  icon: Award,
                  badge: `${myReviews.length}`,
                },
                {
                  id: 'profile' as const,
                  label: 'Profil & Rekening',
                  desc: currentEmployee.bankName,
                  icon: User,
                  badge: '',
                },
              ].map((item) => {
                const IconComp = item.icon;
                const isActive = activePortalTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActivePortalTab(item.id);
                      setIsMobileMenuSheetOpen(false);
                    }}
                    className={`min-h-[64px] p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <IconComp
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isActive ? 'text-white' : 'text-emerald-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isActive ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              {isAdminUnlocked ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuSheetOpen(false);
                      setIsSwitchProfileModalOpen(true);
                    }}
                    className="flex-1 min-h-[42px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Simulasi Karyawan Lain
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuSheetOpen(false);
                      onSwitchToAdminMode();
                    }}
                    className="flex-1 min-h-[42px] py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                    <span>Kembali ke Panel Admin</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Sesi Terkunci: <strong>{currentEmployee.nik}</strong>
                    </span>
                  </div>
                  {onLockAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuSheetOpen(false);
                        onLockAdmin();
                      }}
                      className="min-h-[42px] py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Keluar Sesi (Logout)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Native-Style Mobile Bottom Navigation Bar (<768px, md:hidden) */}
      <nav
        aria-label="Navigasi Bawah Portal Karyawan"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] px-2 pb-1.5 pt-1"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('home');
              setIsMobileMenuSheetOpen(false);
            }}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
              activePortalTab === 'home'
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Home</span>
          </button>

          {/* 2. Slip Gaji */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('payroll');
              setIsMobileMenuSheetOpen(false);
            }}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
              activePortalTab === 'payroll'
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <WalletCards className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Slip Gaji</span>
          </button>

          {/* 3. Kamera Absen (Prominent Center One-Handed Thumb Action) */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('attendance');
              setIsMobileMenuSheetOpen(false);
            }}
            className="flex flex-col items-center justify-center cursor-pointer group -mt-4"
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 relative ${
                activePortalTab === 'attendance'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white ring-4 ring-emerald-100 shadow-emerald-600/35'
                  : 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white ring-4 ring-white shadow-emerald-600/25'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                  todayAttendance ? 'bg-emerald-300' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </div>
            <span
              className={`text-[10px] mt-1 leading-tight ${
                activePortalTab === 'attendance'
                  ? 'text-emerald-700 font-extrabold'
                  : 'text-slate-700 font-bold'
              }`}
            >
              Kamera Absen
            </span>
          </button>

          {/* 4. Cuti/Izin */}
          <button
            type="button"
            onClick={() => {
              setActivePortalTab('leave');
              setIsMobileMenuSheetOpen(false);
            }}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer relative ${
              activePortalTab === 'leave'
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <div className="relative">
              <CalendarDays className="w-5 h-5" />
              {myLeaveRequests.filter((l) => l.status === 'Menunggu Persetujuan').length > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
              )}
            </div>
            <span className="text-[10px] leading-tight">Cuti/Izin</span>
          </button>

          {/* 5. Lainnya (Opens Full Portal Menu Sheet) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuSheetOpen((prev) => !prev)}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
              isMobileMenuSheetOpen ||
              ['claims', 'cash_advance', 'assets', 'performance', 'profile'].includes(activePortalTab)
                ? 'text-emerald-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Lainnya</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

