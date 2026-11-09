import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Briefcase,
  Building,
  CreditCard,
  Edit2,
  Trash2,
  Download,
  Eye,
  X,
  Check,
  ShieldCheck,
  AlertCircle,
  Camera,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  UserCheck,
  RefreshCw,
  User,
  BarChart3,
  PieChart as PieIcon,
  Boxes,
  Award,
  Star,
  FileCheck2,
  Calendar,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
  Video,
} from 'lucide-react';
import {
  Employee,
  Department,
  EmploymentStatus,
  PTKPStatus,
  CompanyAsset,
  PerformanceReview,
  LiveStreamSalesRecord,
  LiveStreamPlatform,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  formatNpwpInput,
  getNpwpStatusInfo,
  getContractValidityInfo,
  evaluateBankAccountValidity,
  getEmployeeDailySalary,
  getEmployeeHourlyRate,
  STANDARD_WORK_HOURS_PER_DAY,
  calculateEmployeeLiveSalesCommission,
} from '../utils/formatters';
import {
  getContractReminderWhatsAppUrl,
  getContractReminderEmailUrl,
  formatWhatsAppPhone,
} from '../utils/notificationHelper';
import { validateImageFile, compressImage, compressVideoFrame } from '../utils/imageUtils';
import { EmployeeDemographicsCharts } from './EmployeeDemographicsCharts';
import { LiveStreamSessionModal } from './LiveStreamSessionModal';
import {
  syncEmployeeLiveColumnsToSupabase,
  upsertLivestreamSessionToSupabase,
  deleteLivestreamSessionFromSupabase,
  generateSessionUuid,
} from '../services/supabaseService';

const SAMPLE_PHOTOS = [
  { label: 'Pria Formal 1', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80' },
  { label: 'Wanita Formal 1', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&h=300&q=80' },
  { label: 'Pria Formal 2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&h=300&q=80' },
  { label: 'Wanita Formal 2', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&h=300&q=80' },
  { label: 'Pria Formal 3', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&h=300&q=80' },
  { label: 'Wanita Formal 3', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80' },
];

interface EmployeeManagementProps {
  employees: Employee[];
  assets?: CompanyAsset[];
  reviews?: PerformanceReview[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  employees,
  assets = [],
  reviews = [],
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDemographics, setShowDemographics] = useState<boolean>(true);

  // Quick Photo Upload Modal State
  const [quickPhotoEmployee, setQuickPhotoEmployee] = useState<Employee | null>(null);
  const [quickPhotoPreview, setQuickPhotoPreview] = useState<string>('');
  const [quickPhotoError, setQuickPhotoError] = useState<string | null>(null);
  const [isCompressingQuick, setIsCompressingQuick] = useState(false);
  const [isQuickCameraActive, setIsQuickCameraActive] = useState(false);
  const quickVideoRef = useRef<HTMLVideoElement | null>(null);
  const quickStreamRef = useRef<MediaStream | null>(null);

  // Form Photo State & Camera
  const [formPhotoError, setFormPhotoError] = useState<string | null>(null);
  const [isCompressingForm, setIsCompressingForm] = useState(false);
  const [isFormCameraActive, setIsFormCameraActive] = useState(false);
  const formVideoRef = useRef<HTMLVideoElement | null>(null);
  const formStreamRef = useRef<MediaStream | null>(null);
  const [adminPreviewDoc, setAdminPreviewDoc] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    downloadFileName?: string;
  } | null>(null);
  const [isUploadingContract, setIsUploadingContract] = useState(false);

  // Admin Live Streaming Omset & Commission State inside Detail Karyawan Modal
  const [detailEditingLogId, setDetailEditingLogId] = useState<string | null>(null);
  const [detailLiveRole, setDetailLiveRole] = useState<'Host' | 'Co-Host'>('Host');
  const [detailLiveDate, setDetailLiveDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [detailLivePlatform, setDetailLivePlatform] =
    useState<LiveStreamPlatform>('TikTok Shop Live');
  const [detailLiveTitle, setDetailLiveTitle] = useState<string>('');
  const [detailLiveDuration, setDetailLiveDuration] = useState<number>(3);
  const [detailLiveOmset, setDetailLiveOmset] = useState<number>(0);
  const [detailLivePcs, setDetailLivePcs] = useState<number>(0);
  const [isLiveSessionModalOpen, setIsLiveSessionModalOpen] = useState<boolean>(false);
  const [liveSessionModalEmpId, setLiveSessionModalEmpId] = useState<string | null>(null);

  // Sync viewingEmployee automatically when employees list updates from Portal Karyawan
  useEffect(() => {
    if (viewingEmployee) {
      const updated = employees.find((e) => e.id === viewingEmployee.id);
      if (updated) {
        setViewingEmployee(updated);
      }
    }
  }, [employees]);

  const handleAdminContractUpload = async (emp: Employee, file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error || 'Format gambar dokumen kontrak tidak didukung.');
      return;
    }
    try {
      setIsUploadingContract(true);
      const compressedContract = await compressImage(file, 1000, 1400, 0.82);
      const nowTimestamp = `${new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })} • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
      const updated: Employee = {
        ...emp,
        contractDocumentUrl: compressedContract,
        contractDocumentName: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
        contractUpdatedAt: nowTimestamp,
      };
      onUpdateEmployee(updated);
      setViewingEmployee(updated);
      showToast(
        `Dokumen Kontrak Kerja untuk ${emp.fullName} berhasil diunggah & disinkronkan ke Portal Karyawan!`
      );
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses dokumen kontrak kerja.');
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleFormContractUpload = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Format gambar dokumen kontrak tidak didukung.');
      return;
    }
    try {
      setIsUploadingContract(true);
      const compressedContract = await compressImage(file, 1000, 1400, 0.82);
      const nowTimestamp = `${new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })} • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
      setFormData((prev) => ({
        ...prev,
        contractDocumentUrl: compressedContract,
        contractDocumentName: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
        contractUpdatedAt: nowTimestamp,
      }));
      showToast('Dokumen Kontrak Kerja berhasil dikompresi & siap disimpan!');
    } catch (err: any) {
      setFormError(err?.message || 'Gagal memproses gambar dokumen kontrak.');
    } finally {
      setIsUploadingContract(false);
    }
  };

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      stopFormCamera();
      stopQuickCamera();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  // Form Camera Functions
  const startFormCamera = async () => {
    setFormPhotoError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFormPhotoError('Browser ini tidak mendukung akses kamera.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
      });
      formStreamRef.current = stream;
      setIsFormCameraActive(true);
      setTimeout(() => {
        if (formVideoRef.current) {
          formVideoRef.current.srcObject = stream;
          formVideoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setFormPhotoError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan di browser.');
      setIsFormCameraActive(false);
    }
  };

  const stopFormCamera = () => {
    if (formStreamRef.current) {
      formStreamRef.current.getTracks().forEach((track) => track.stop());
      formStreamRef.current = null;
    }
    setIsFormCameraActive(false);
  };

  const captureFormCamera = () => {
    if (!formVideoRef.current) return;
    const dataUrl = compressVideoFrame(formVideoRef.current, 800, 800, 0.8, true);
    if (!dataUrl) return;
    setFormData((prev) => ({
      ...prev,
      avatarUrl: dataUrl,
      facePhotoUrl: dataUrl,
    }));
    stopFormCamera();
    showToast('Foto berhasil dijepret dari kamera (JPEG 800px)!');
  };

  const handleFormPhotoUpload = async (file: File) => {
    setFormPhotoError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormPhotoError(validation.error || 'File tidak valid');
      return;
    }

    try {
      setIsCompressingForm(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      setFormData((prev) => ({
        ...prev,
        avatarUrl: compressedDataUrl,
        facePhotoUrl: compressedDataUrl,
      }));
      showToast('Pas foto real karyawan berhasil dimuat (JPEG 800px)!');
    } catch (err: any) {
      console.error(err);
      setFormPhotoError(err.message || 'Gagal memproses file gambar.');
    } finally {
      setIsCompressingForm(false);
    }
  };

  // Quick Photo Modal Functions
  const openQuickPhotoModal = (emp: Employee) => {
    setQuickPhotoEmployee(emp);
    setQuickPhotoPreview(emp.avatarUrl);
    setQuickPhotoError(null);
    setIsQuickCameraActive(false);
  };

  const closeQuickPhotoModal = () => {
    stopQuickCamera();
    setQuickPhotoEmployee(null);
    setQuickPhotoPreview('');
    setQuickPhotoError(null);
  };

  const startQuickCamera = async () => {
    setQuickPhotoError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setQuickPhotoError('Browser ini tidak mendukung akses kamera.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
      });
      quickStreamRef.current = stream;
      setIsQuickCameraActive(true);
      setTimeout(() => {
        if (quickVideoRef.current) {
          quickVideoRef.current.srcObject = stream;
          quickVideoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setQuickPhotoError('Gagal mengakses kamera. Pastikan izin kamera telah diizinkan.');
      setIsQuickCameraActive(false);
    }
  };

  const stopQuickCamera = () => {
    if (quickStreamRef.current) {
      quickStreamRef.current.getTracks().forEach((track) => track.stop());
      quickStreamRef.current = null;
    }
    setIsQuickCameraActive(false);
  };

  const captureQuickCamera = () => {
    if (!quickVideoRef.current) return;
    const dataUrl = compressVideoFrame(quickVideoRef.current, 800, 800, 0.8, true);
    if (!dataUrl) return;
    setQuickPhotoPreview(dataUrl);
    stopQuickCamera();
    showToast('Foto dari kamera siap disimpan (JPEG 800px)!');
  };

  const handleQuickPhotoUpload = async (file: File) => {
    setQuickPhotoError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setQuickPhotoError(validation.error || 'File tidak valid');
      return;
    }

    try {
      setIsCompressingQuick(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      setQuickPhotoPreview(compressedDataUrl);
      showToast('Pratinjau foto baru siap disimpan (JPEG 800px)!');
    } catch (err: any) {
      console.error(err);
      setQuickPhotoError(err.message || 'Gagal memproses file gambar.');
    } finally {
      setIsCompressingQuick(false);
    }
  };

  const handleSaveQuickPhoto = () => {
    if (!quickPhotoEmployee || !quickPhotoPreview) return;
    const updated: Employee = {
      ...quickPhotoEmployee,
      avatarUrl: quickPhotoPreview,
      facePhotoUrl: quickPhotoPreview,
    };
    onUpdateEmployee(updated);

    // If viewing modal is currently viewing this employee, update it too
    if (viewingEmployee && viewingEmployee.id === quickPhotoEmployee.id) {
      setViewingEmployee(updated);
    }

    closeQuickPhotoModal();
    showToast(`Foto profil real untuk ${quickPhotoEmployee.fullName} berhasil diperbarui!`);
  };

  // Form State for Add / Edit
  const [formData, setFormData] = useState<Partial<Employee>>({
    nik: '',
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: '',
    role: '',
    department: 'Teknologi & IT',
    employmentStatus: 'PKWTT (Tetap)',
    joinDate: new Date().toISOString().split('T')[0],
    hourlyRate: 35000,
    hourly_rate: 35000,
    dailySalary: 315000,
    daily_salary: 315000,
    baseSalary: 7875000,
    isLiveStreamHost: false,
    salesCommissionPercentage: 0,
    salesCommissionPerPcs: 0,
    isCoHostLiveStream: false,
    coHostCommissionPercentage: 0,
    coHostCommissionPerPcs: 0,
    allowances: {
      position: 1000000,
      transport: 800000,
      meal: 1100000,
      communication: 350000,
    },
    bankName: 'BCA',
    bankAccountNumber: '',
    bankAccountHolder: '',
    npwp: '',
    ptkpStatus: 'TK/0',
    bpjsKesehatanNo: '',
    bpjsKetenagakerjaanNo: '',
    remainingLeaveDays: 12,
    isActive: true,
  });

  // Ensure form is properly initialized whenever add modal is opened
  useEffect(() => {
    if (isAddModalOpen && !editingEmployee) {
      stopFormCamera();
      setFormError(null);
      setFormPhotoError(null);
      const currentYear = new Date().getFullYear();
      const nextNum = employees.length + 1;
      const todayIso = new Date().toISOString().split('T')[0];
      const nextYearIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFormData({
        nik: `TGI-${currentYear}-${String(nextNum).padStart(3, '0')}`,
        fullName: '',
        email: '',
        phone: '0812-',
        avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + ((nextNum * 37) % 500)}?auto=format&fit=crop&w=256&h=256&q=80`,
        role: 'Staff Operasional',
        gender: 'Laki-laki',
        department: 'Operasional',
        employmentStatus: 'PKWT (Kontrak)',
        joinDate: todayIso,
        contractStartDate: todayIso,
        contractEndDate: nextYearIso,
        contractDocumentNumber: `PKWT/TKB/${currentYear}/${String(nextNum).padStart(3, '0')}`,
        contractDocumentUrl: '',
        contractDocumentName: '',
        hourlyRate: 25000,
        hourly_rate: 25000,
        dailySalary: 225000,
        daily_salary: 225000,
        baseSalary: 5625000,
        isLiveStreamHost: false,
        salesCommissionPercentage: 0,
        salesCommissionPerPcs: 0,
        isCoHostLiveStream: false,
        coHostCommissionPercentage: 0,
        coHostCommissionPerPcs: 0,
        allowances: {
          position: 500000,
          transport: 600000,
          meal: 800000,
          communication: 250000,
        },
        bankName: 'BCA',
        bankAccountNumber: '',
        bankAccountHolder: '',
        npwp: '00.000.000.0-000.000',
        ptkpStatus: 'TK/0',
        bpjsKesehatanNo: '0001000000000',
        bpjsKetenagakerjaanNo: `${String(currentYear).slice(-2)}000000000`,
        remainingLeaveDays: 12,
        isActive: true,
      });
    }
  }, [isAddModalOpen, editingEmployee, employees.length]);

  const openAddModal = () => {
    stopFormCamera();
    setEditingEmployee(null);
    setFormError(null);
    setFormPhotoError(null);
    const currentYear = new Date().getFullYear();
    const nextNum = employees.length + 1;
    const todayIso = new Date().toISOString().split('T')[0];
    const nextYearIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      nik: `TGI-${currentYear}-${String(nextNum).padStart(3, '0')}`,
      fullName: '',
      email: '',
      phone: '0812-',
      avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + ((nextNum * 37) % 500)}?auto=format&fit=crop&w=256&h=256&q=80`,
      role: 'Staff Operasional',
      gender: 'Laki-laki',
      department: 'Operasional',
      employmentStatus: 'PKWT (Kontrak)',
      joinDate: todayIso,
      contractStartDate: todayIso,
      contractEndDate: nextYearIso,
      contractDocumentNumber: `PKWT/TKB/${currentYear}/${String(nextNum).padStart(3, '0')}`,
      contractDocumentUrl: '',
      contractDocumentName: '',
      hourlyRate: 25000,
      hourly_rate: 25000,
      dailySalary: 225000,
      daily_salary: 225000,
      baseSalary: 5625000,
      isLiveStreamHost: false,
      salesCommissionPercentage: 0,
      salesCommissionPerPcs: 0,
      isCoHostLiveStream: false,
      coHostCommissionPercentage: 0,
      coHostCommissionPerPcs: 0,
      allowances: {
        position: 500000,
        transport: 600000,
        meal: 800000,
        communication: 250000,
      },
      bankName: 'BCA',
      bankAccountNumber: '',
      bankAccountHolder: '',
      npwp: '00.000.000.0-000.000',
      ptkpStatus: 'TK/0',
      bpjsKesehatanNo: '0001000000000',
      bpjsKetenagakerjaanNo: `${String(currentYear).slice(-2)}000000000`,
      remainingLeaveDays: 12,
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    stopFormCamera();
    setEditingEmployee(emp);
    setFormError(null);
    setFormPhotoError(null);
    const resolvedHourly = getEmployeeHourlyRate(emp, STANDARD_WORK_HOURS_PER_DAY, 25);
    const resolvedDaily = getEmployeeDailySalary(emp, 25, STANDARD_WORK_HOURS_PER_DAY);
    const resolvedIsHost = Boolean(emp.is_host === true || emp.isLiveStreamHost === true);
    const resolvedIsCoHost = Boolean(emp.is_co_host === true || emp.isCoHostLiveStream === true);
    const resolvedHostPct = Number(emp.host_commission_pct ?? emp.salesCommissionPercentage) || 0;
    const resolvedHostPcs = Number(emp.host_commission_per_pcs ?? emp.salesCommissionPerPcs) || 0;
    const resolvedCoHostPct =
      Number(emp.co_host_commission_pct ?? emp.coHostCommissionPercentage) || 0;
    const resolvedCoHostPcs =
      Number(emp.co_host_commission_per_pcs ?? emp.coHostCommissionPerPcs) || 0;

    setFormData({
      ...emp,
      hourlyRate: resolvedHourly,
      hourly_rate: resolvedHourly,
      dailySalary: resolvedDaily,
      daily_salary: resolvedDaily,
      isLiveStreamHost: resolvedIsHost,
      is_host: resolvedIsHost,
      salesCommissionPercentage: resolvedHostPct,
      host_commission_pct: resolvedHostPct,
      salesCommissionPerPcs: resolvedHostPcs,
      host_commission_per_pcs: resolvedHostPcs,
      isCoHostLiveStream: resolvedIsCoHost,
      is_co_host: resolvedIsCoHost,
      coHostCommissionPercentage: resolvedCoHostPct,
      co_host_commission_pct: resolvedCoHostPct,
      coHostCommissionPerPcs: resolvedCoHostPcs,
      co_host_commission_per_pcs: resolvedCoHostPcs,
      allowances: {
        position: emp.allowances?.position || 0,
        transport: emp.allowances?.transport || 0,
        meal: emp.allowances?.meal || 0,
        communication: emp.allowances?.communication || 0,
      },
    });
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    stopFormCamera();
    setEditingEmployee(null);
    setFormError(null);
    setIsAddModalOpen(false);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();

    const fullNameTrimmed = formData.fullName?.trim() || '';
    if (!fullNameTrimmed) {
      setFormError('Mohon isi Nama Lengkap karyawan!');
      return;
    }

    const currentYear = new Date().getFullYear();
    const nikTrimmed = formData.nik?.trim() || `TGI-${currentYear}-${String(employees.length + 1).padStart(3, '0')}`;
    const emailTrimmed = formData.email?.trim() || `${fullNameTrimmed.toLowerCase().replace(/\s+/g, '.')}@tgi.co.id`;
    const departmentTrimmed = formData.department?.trim() || editingEmployee?.department || 'Operasional';

    stopFormCamera();

    const explicitHourly = Number(formData.hourlyRate ?? formData.hourly_rate) || 0;
    const explicitDaily = Number(formData.dailySalary ?? formData.daily_salary) || 0;
    const resolvedHourlyRate =
      explicitHourly > 0
        ? Math.round(explicitHourly)
        : explicitDaily > 0
        ? Math.round(explicitDaily / STANDARD_WORK_HOURS_PER_DAY)
        : Math.round((Number(formData.baseSalary) || 5625000) / (25 * STANDARD_WORK_HOURS_PER_DAY));
    const resolvedDailySalary =
      explicitDaily > 0
        ? Math.round(explicitDaily)
        : Math.round(resolvedHourlyRate * STANDARD_WORK_HOURS_PER_DAY);
    const resolvedBaseSalary =
      Number(formData.baseSalary) || resolvedDailySalary * 25;

    const resolvedIsHost = Boolean(formData.isLiveStreamHost ?? formData.is_host);
    const resolvedCommPct = resolvedIsHost
      ? Math.max(0, Number(formData.salesCommissionPercentage ?? formData.host_commission_pct) || 0)
      : 0;
    const resolvedCommPerPcs = resolvedIsHost
      ? Math.max(
          0,
          Math.round(Number(formData.salesCommissionPerPcs ?? formData.host_commission_per_pcs) || 0)
        )
      : 0;

    const resolvedIsCoHost = Boolean(formData.isCoHostLiveStream ?? formData.is_co_host);
    const resolvedCoHostCommPct = resolvedIsCoHost
      ? Math.max(
          0,
          Number(formData.coHostCommissionPercentage ?? formData.co_host_commission_pct) || 0
        )
      : 0;
    const resolvedCoHostCommPerPcs = resolvedIsCoHost
      ? Math.max(
          0,
          Math.round(
            Number(formData.coHostCommissionPerPcs ?? formData.co_host_commission_per_pcs) || 0
          )
        )
      : 0;

    if (editingEmployee) {
      const updated: Employee = {
        ...editingEmployee,
        ...(formData as Employee),
        fullName: fullNameTrimmed,
        nik: nikTrimmed,
        email: emailTrimmed,
        department: departmentTrimmed,
        ktpNumber: formData.ktpNumber?.replace(/\D/g, '').slice(0, 16) || editingEmployee.ktpNumber,
        npwp: formData.npwp?.trim() || editingEmployee.npwp,
        contractStartDate: formData.contractStartDate || formData.joinDate || editingEmployee.contractStartDate,
        contractEndDate:
          formData.employmentStatus === 'PKWTT (Tetap)'
            ? undefined
            : formData.contractEndDate || editingEmployee.contractEndDate,
        contractDocumentNumber: formData.contractDocumentNumber?.trim() || editingEmployee.contractDocumentNumber,
        contractDocumentUrl: formData.contractDocumentUrl || editingEmployee.contractDocumentUrl,
        contractDocumentName: formData.contractDocumentName || editingEmployee.contractDocumentName,
        contractUpdatedAt: formData.contractUpdatedAt || editingEmployee.contractUpdatedAt,
        birthDate: formData.birthDate || editingEmployee.birthDate,
        hourlyRate: resolvedHourlyRate,
        hourly_rate: resolvedHourlyRate,
        dailySalary: resolvedDailySalary,
        daily_salary: resolvedDailySalary,
        baseSalary: resolvedBaseSalary,
        isLiveStreamHost: resolvedIsHost,
        is_host: resolvedIsHost,
        salesCommissionPercentage: resolvedCommPct,
        host_commission_pct: resolvedCommPct,
        salesCommissionPerPcs: resolvedCommPerPcs,
        host_commission_per_pcs: resolvedCommPerPcs,
        isCoHostLiveStream: resolvedIsCoHost,
        is_co_host: resolvedIsCoHost,
        coHostCommissionPercentage: resolvedCoHostCommPct,
        co_host_commission_pct: resolvedCoHostCommPct,
        coHostCommissionPerPcs: resolvedCoHostCommPerPcs,
        co_host_commission_per_pcs: resolvedCoHostCommPerPcs,
        liveStreamSalesLogs:
          formData.liveStreamSalesLogs || editingEmployee.liveStreamSalesLogs || [],
        allowances: {
          position: Number(formData.allowances?.position) || 0,
          transport: Number(formData.allowances?.transport) || 0,
          meal: Number(formData.allowances?.meal) || 0,
          communication: Number(formData.allowances?.communication) || 0,
        },
        avatarUrl: formData.avatarUrl || editingEmployee.avatarUrl,
        facePhotoUrl: formData.facePhotoUrl || formData.avatarUrl || editingEmployee.facePhotoUrl,
      };
      onUpdateEmployee(updated);
      syncEmployeeLiveColumnsToSupabase(updated).catch(() => {});
      showToast(`Data karyawan ${updated.fullName} (Tarif Per Jam: ${formatRupiah(resolvedHourlyRate)}/jam${resolvedIsHost ? ` • Host Live: ${resolvedCommPct}%` : ''}${resolvedIsCoHost ? ` • Co-Host Live: ${resolvedCoHostCommPct}%` : ''}) berhasil diperbarui!`);
    } else {
      const joinDt = formData.joinDate || new Date().toISOString().split('T')[0];
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        nik: nikTrimmed,
        ktpNumber: formData.ktpNumber?.replace(/\D/g, '').slice(0, 16) || undefined,
        fullName: fullNameTrimmed,
        email: emailTrimmed,
        phone: formData.phone?.trim() || '0812-0000-0000',
        avatarUrl:
          formData.avatarUrl ||
          `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 500)}?auto=format&fit=crop&w=256&h=256&q=80`,
        facePhotoUrl: formData.facePhotoUrl || formData.avatarUrl,
        role: formData.role?.trim() || 'Staff Operasional',
        gender: formData.gender || 'Laki-laki',
        department: departmentTrimmed,
        employmentStatus: (formData.employmentStatus as EmploymentStatus) || 'PKWT (Kontrak)',
        joinDate: joinDt,
        contractStartDate: formData.contractStartDate || joinDt,
        contractEndDate:
          formData.employmentStatus === 'PKWTT (Tetap)' ? undefined : formData.contractEndDate,
        contractDocumentNumber: formData.contractDocumentNumber?.trim() || undefined,
        contractDocumentUrl: formData.contractDocumentUrl || undefined,
        contractDocumentName: formData.contractDocumentName || undefined,
        contractUpdatedAt: formData.contractUpdatedAt || undefined,
        birthDate: formData.birthDate || undefined,
        hourlyRate: resolvedHourlyRate,
        hourly_rate: resolvedHourlyRate,
        dailySalary: resolvedDailySalary,
        daily_salary: resolvedDailySalary,
        baseSalary: resolvedBaseSalary,
        isLiveStreamHost: resolvedIsHost,
        is_host: resolvedIsHost,
        salesCommissionPercentage: resolvedCommPct,
        host_commission_pct: resolvedCommPct,
        salesCommissionPerPcs: resolvedCommPerPcs,
        host_commission_per_pcs: resolvedCommPerPcs,
        isCoHostLiveStream: resolvedIsCoHost,
        is_co_host: resolvedIsCoHost,
        coHostCommissionPercentage: resolvedCoHostCommPct,
        co_host_commission_pct: resolvedCoHostCommPct,
        coHostCommissionPerPcs: resolvedCoHostCommPerPcs,
        co_host_commission_per_pcs: resolvedCoHostCommPerPcs,
        liveStreamSalesLogs: [],
        allowances: {
          position: Number(formData.allowances?.position) || 0,
          transport: Number(formData.allowances?.transport) || 0,
          meal: Number(formData.allowances?.meal) || 0,
          communication: Number(formData.allowances?.communication) || 0,
        },
        bankName: formData.bankName || 'BCA',
        bankAccountNumber: formData.bankAccountNumber?.trim() || '1234567890',
        bankAccountHolder: formData.bankAccountHolder?.trim() || fullNameTrimmed,
        npwp: formData.npwp?.trim() || '00.000.000.0-000.000',
        ptkpStatus: formData.ptkpStatus || 'TK/0',
        bpjsKesehatanNo: formData.bpjsKesehatanNo?.trim() || '0001000000000',
        bpjsKetenagakerjaanNo: formData.bpjsKetenagakerjaanNo?.trim() || `${String(currentYear).slice(-2)}000000000`,
        remainingLeaveDays: Number(formData.remainingLeaveDays) ?? 12,
        isActive: true,
        approvalStatus: 'approved',
      };
      onAddEmployee(newEmp);
      showToast(`Karyawan baru "${newEmp.fullName}" (Tarif Per Jam: ${formatRupiah(resolvedHourlyRate)}/jam) berhasil ditambahkan ke database!`);
    }

    setEditingEmployee(null);
    setIsAddModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = [
      'NIK',
      'Nama Lengkap',
      'Email',
      'Telepon',
      'Jabatan',
      'Departemen',
      'Status Kontrak',
      'Tarif Gaji Per Jam',
      'Gaji Per Hari (9 Jam)',
      'Gaji Pokok (25 Hari)',
      'Tunjangan Jabatan',
      'Tunjangan Transport',
      'Tunjangan Makan',
      'Tunjangan Komunikasi',
      'Bank',
      'No Rekening',
      'Atas Nama',
      'PTKP',
      'NPWP',
      'BPJS Kesehatan',
      'BPJS Ketenagakerjaan',
    ];

    const rows = employees.map((e) => [
      e.nik,
      `"${e.fullName}"`,
      e.email,
      e.phone,
      `"${e.role}"`,
      `"${e.department}"`,
      e.employmentStatus,
      getEmployeeHourlyRate(e, STANDARD_WORK_HOURS_PER_DAY, 25),
      getEmployeeDailySalary(e, 25, STANDARD_WORK_HOURS_PER_DAY),
      e.baseSalary,
      e.allowances.position,
      e.allowances.transport,
      e.allowances.meal,
      e.allowances.communication,
      e.bankName,
      `'${e.bankAccountNumber}`,
      `"${e.bankAccountHolder}"`,
      e.ptkpStatus,
      e.npwp,
      `'${e.bpjsKesehatanNo}`,
      `'${e.bpjsKetenagakerjaanNo}`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TGI_Data_Karyawan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic unique departments from real employees in database
  const uniqueDepartments = React.useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((e) => e.department?.trim())
          .filter((d): d is string => Boolean(d))
      )
    );
  }, [employees]);

  // Suggestions for custom department input (existing database departments + common operational presets)
  const departmentSuggestions = React.useMemo(() => {
    const commonPresets = [
      'Operasional',
      'Gudang',
      'Packing',
      'Ekspedisi',
      'Admin Marketplace',
      'Layanan Pelanggan',
      'Pemasaran & Bisnis',
      'Keuangan & Akuntansi',
      'Human Resources & GA',
      'Teknologi & IT',
    ];
    return Array.from(new Set([...uniqueDepartments, ...commonPresets]));
  }, [uniqueDepartments]);

  // Filtered employees
  const filtered = employees.filter((emp) => {
    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.nik.toLowerCase().includes(search.toLowerCase()) ||
      (emp.ktpNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      emp.role.toLowerCase().includes(search.toLowerCase()) ||
      emp.department.toLowerCase().includes(search.toLowerCase());

    const matchDept = selectedDept === 'ALL' || emp.department === selectedDept;
    const matchStatus = selectedStatus === 'ALL' || emp.employmentStatus === selectedStatus;

    return matchSearch && matchDept && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Data Karyawan Tas Grosir Import
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola profil, jabatan, rekening bank, tunjangan, dan data pajak karyawan Tas Grosir Import.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDemographics(!showDemographics)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              showDemographics
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span>{showDemographics ? 'Sembunyikan Diagram' : 'Diagram & Statistik'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              showDemographics ? 'bg-slate-700 text-slate-200' : 'bg-indigo-200/70 text-indigo-800'
            }`}>
              {employees.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const defaultHost =
                employees.find((e) => e.isLiveStreamHost || e.isCoHostLiveStream) ||
                employees[0];
              setLiveSessionModalEmpId(defaultHost ? defaultHost.id : null);
              setIsLiveSessionModalOpen(true);
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 hover:from-pink-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-pink-600/20"
            title="Form Input Manual Sesi Live Streaming (Omset, Tas Terjual & Tarif Komisi Fleksibel Host / Co-Host)"
          >
            <Video className="w-4 h-4 text-white" />
            <span>Input Sesi Live &amp; Komisi (Host / Co-Host)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Ekspor CSV
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4" />
            Tambah Karyawan
          </button>
        </div>
      </div>

      {/* Employee Demographics & Charts Section */}
      {showDemographics && (
        <div className="transition-all animate-fadeIn">
          <EmployeeDemographicsCharts
            employees={employees}
            onSelectRole={(role) => setSearch(role)}
            onSelectDepartment={(dept) => setSelectedDept(dept)}
          />
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, NIK, atau posisi karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">Semua Departemen ({employees.length})</option>
            {uniqueDepartments.map((dept) => {
              const count = employees.filter((e) => e.department?.trim() === dept).length;
              return (
                <option key={dept} value={dept}>
                  {dept} ({count})
                </option>
              );
            })}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="PKWTT (Tetap)">PKWTT (Tetap)</option>
            <option value="PKWT (Kontrak)">PKWT (Kontrak)</option>
            <option value="Probation">Probation</option>
          </select>
        </div>
      </div>

      {/* Peringatan Deteksi Rekening Bank Duplikat / Belum Valid */}
      {(() => {
        const invalidBankEmps = employees.filter(
          (e) => e.isActive !== false && evaluateBankAccountValidity(e, employees).isInvalid
        );
        if (invalidBankEmps.length === 0) return null;
        return (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950">
                  Deteksi Rekening Duplikat / Perlu Cek ({invalidBankEmps.length} Karyawan):
                </span>{' '}
                <span className="text-amber-800">
                  Terdapat karyawan dengan nomor rekening bank yang sama persis (&ge; 2 orang) atau kurang dari 10 digit:{' '}
                  <strong className="font-bold">
                    {invalidBankEmps
                      .map((e) => `${e.fullName} (${e.bankName} ${e.bankAccountNumber || '-'})`)
                      .join(', ')}
                  </strong>
                  . Silakan perbarui nomor rekening sebelum pencairan Payroll.
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">NIK &amp; NIK KTP</th>
                <th className="py-3 px-4">Status &amp; Masa Kontrak</th>
                <th className="py-3 px-4">Tarif Per Jam &amp; Harian</th>
                <th className="py-3 px-4">Rekening Bank</th>
                <th className="py-3 px-4">PTKP / NPWP Pajak</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => {
                const contractInfo = getContractValidityInfo(emp);
                const npwpInfo = getNpwpStatusInfo(emp.npwp, emp.ktpNumber);
                const bankCheck = evaluateBankAccountValidity(emp, employees);
                return (
                <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative group shrink-0">
                        <img
                          src={emp.avatarUrl}
                          alt={emp.fullName}
                          className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-slate-200 group-hover:ring-emerald-500 transition-all shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => openQuickPhotoModal(emp)}
                          title="Upload / Ganti Pas Foto Real Karyawan"
                          className="absolute inset-0 bg-slate-900/65 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-white" />
                        </button>
                        {emp.avatarUrl && emp.avatarUrl.startsWith('data:image') && (
                          <span
                            title="Foto real kustom terpasang"
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center"
                          >
                            <span className="w-1 h-1 bg-white rounded-full" />
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 block text-xs">
                            {emp.fullName}
                          </span>
                          {emp.gender && (
                            <span
                              title={`Jenis Kelamin: ${emp.gender}`}
                              className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                emp.gender === 'Laki-laki'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-pink-50 text-pink-700 border border-pink-200'
                              }`}
                            >
                              {emp.gender === 'Laki-laki' ? '♂ Pria' : '♀ Wanita'}
                            </span>
                          )}
                          {emp.avatarUrl && emp.avatarUrl.startsWith('data:image') && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-semibold">
                              Foto Real
                            </span>
                          )}
                          {emp.contractDocumentUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setAdminPreviewDoc({
                                  title: `Dokumen Kontrak Kerja — ${emp.fullName}`,
                                  subtitle: `${emp.contractDocumentNumber || emp.employmentStatus} • Masa Aktif: ${
                                    emp.contractStartDate || emp.joinDate
                                  } s/d ${emp.contractEndDate || 'Tetap (PKWTT)'}`,
                                  imageUrl: emp.contractDocumentUrl!,
                                  downloadFileName:
                                    emp.contractDocumentName || `Kontrak-Kerja-${emp.nik}.jpg`,
                                })
                              }
                              title="Klik untuk melihat Dokumen Kontrak Kerja"
                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <FileCheck2 className="w-2.5 h-2.5" />
                              <span>Lihat Kontrak</span>
                            </button>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {emp.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] text-slate-700 font-semibold block">
                      {emp.nik}
                    </span>
                    {emp.ktpNumber ? (
                      <span className="font-mono text-[10px] text-indigo-700 font-semibold block">
                        NIK KTP: {emp.ktpNumber}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-semibold block">
                        NIK KTP: Belum dilengkapi
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-slate-900 block mt-0.5">
                      {emp.role}
                    </span>
                    <span className="text-[10px] text-slate-500">{emp.department}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          emp.employmentStatus === 'PKWTT (Tetap)'
                            ? 'bg-emerald-100 text-emerald-800'
                            : emp.employmentStatus === 'PKWT (Kontrak)'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {emp.employmentStatus}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          contractInfo.isPermanent
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : contractInfo.isExpired
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : contractInfo.isExpiringSoon
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {contractInfo.badgeText}
                      </span>
                    </div>
                    {!contractInfo.isPermanent && emp.contractEndDate && (
                      <span className="block text-[10px] text-slate-500 font-mono">
                        s/d {emp.contractEndDate}
                      </span>
                    )}
                    {!contractInfo.isPermanent &&
                      (contractInfo.isExpiringSoon ||
                        contractInfo.isExpired ||
                        (contractInfo.daysRemaining !== null &&
                          contractInfo.daysRemaining <= 30)) && (
                        <div className="mt-1.5">
                          <a
                            href={getContractReminderWhatsAppUrl(
                              emp,
                              contractInfo.daysRemaining
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              showToast(
                                `Membuka WhatsApp pengingat kontrak PKWT untuk ${emp.fullName}...`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold shadow-2xs transition-colors"
                            title={`Kirim pengingat berakhirnya kontrak kerja PKWT (${contractInfo.badgeText}) via WhatsApp ke ${emp.fullName}`}
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Ingatkan Kontrak (WA)</span>
                          </a>
                        </div>
                      )}
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      Sisa Cuti: {emp.remainingLeaveDays} hari
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] mb-0.5">
                      {formatRupiah(getEmployeeHourlyRate(emp, STANDARD_WORK_HOURS_PER_DAY, 25))} / jam
                    </span>
                    <span className="font-semibold text-slate-900 block text-[11px]">
                      9 Jam/Hr: {formatRupiah(getEmployeeDailySalary(emp, 25, STANDARD_WORK_HOURS_PER_DAY))}
                    </span>
                    {(emp.isLiveStreamHost ||
                      (emp.salesCommissionPercentage || 0) > 0 ||
                      (emp.salesCommissionPerPcs || 0) > 0) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-md bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 font-bold text-[10px]">
                        <Sparkles className="w-2.5 h-2.5 text-fuchsia-600" />
                        <span>
                          Host Live:{' '}
                          {(emp.salesCommissionPercentage || 0) > 0
                            ? `${emp.salesCommissionPercentage}% Omset`
                            : ''}
                          {(emp.salesCommissionPercentage || 0) > 0 &&
                          (emp.salesCommissionPerPcs || 0) > 0
                            ? ' + '
                            : ''}
                          {(emp.salesCommissionPerPcs || 0) > 0
                            ? `${formatRupiah(emp.salesCommissionPerPcs || 0)}/pcs`
                            : ''}
                        </span>
                      </span>
                    )}
                    {(emp.isCoHostLiveStream ||
                      (emp.coHostCommissionPercentage || 0) > 0 ||
                      (emp.coHostCommissionPerPcs || 0) > 0) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-md bg-violet-50 text-violet-800 border border-violet-200 font-bold text-[10px]">
                        <Sparkles className="w-2.5 h-2.5 text-violet-600" />
                        <span>
                          Co-Host Live:{' '}
                          {(emp.coHostCommissionPercentage || 0) > 0
                            ? `${emp.coHostCommissionPercentage}% Omset`
                            : ''}
                          {(emp.coHostCommissionPercentage || 0) > 0 &&
                          (emp.coHostCommissionPerPcs || 0) > 0
                            ? ' + '
                            : ''}
                          {(emp.coHostCommissionPerPcs || 0) > 0
                            ? `${formatRupiah(emp.coHostCommissionPerPcs || 0)}/pcs`
                            : ''}
                        </span>
                      </span>
                    )}
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Est. 25 Hr: {formatRupiah(emp.baseSalary)}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      Tunj: {formatRupiah(emp.allowances.position + emp.allowances.transport + emp.allowances.meal + emp.allowances.communication)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-800 block">
                      {emp.bankName} - {emp.bankAccountNumber || '-'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      a/n {emp.bankAccountHolder}
                    </span>
                    {bankCheck.isInvalid && (
                      <div className="mt-1">
                        <span
                          title={bankCheck.detailReason}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold shadow-2xs"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{bankCheck.badgeLabel}</span>
                        </span>
                        <span className="block text-[9px] text-amber-700 font-medium mt-0.5">
                          {bankCheck.detailReason}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px]">
                        {emp.ptkpStatus}
                      </span>
                      {npwpInfo.isNikMatched && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[9px]">
                          NIK-NPWP
                        </span>
                      )}
                    </div>
                    <span className="block text-[10px] font-mono text-slate-600 mt-0.5">
                      {emp.npwp || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        title="Input Manual Sesi Live Streaming & Komisi (Host / Co-Host)"
                        onClick={() => {
                          setLiveSessionModalEmpId(emp.id);
                          setIsLiveSessionModalOpen(true);
                        }}
                        className="p-1.5 text-pink-600 hover:text-pink-800 hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                      <button
                        title="Upload / Ganti Foto Real Karyawan"
                        onClick={() => openQuickPhotoModal(emp)}
                        className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        title="Lihat Profil"
                        onClick={() => setViewingEmployee(emp)}
                        className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        title="Edit Karyawan"
                        onClick={() => openEditModal(emp)}
                        className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        title="Hapus Karyawan"
                        onClick={() => setDeletingEmployee(emp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
              {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-900 text-sm">
                          {employees.length === 0
                            ? 'Belum ada data karyawan'
                            : 'Tidak ada data karyawan ditemukan'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {search || selectedDept !== 'ALL' || selectedStatus !== 'ALL'
                            ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
                            : 'Database Supabase saat ini belum memiliki data karyawan. Klik tombol di bawah untuk menambahkan karyawan pertama.'}
                        </p>
                        <button
                          type="button"
                          onClick={openAddModal}
                          className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tambah Karyawan Baru</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
          </table>
        </div>
      </div>

      {/* VIEW PROFILE MODAL */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="relative group shrink-0">
                  <img
                    src={viewingEmployee.avatarUrl}
                    alt={viewingEmployee.fullName}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-emerald-500 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => openQuickPhotoModal(viewingEmployee)}
                    title="Upload / Ganti Foto Real Karyawan"
                    className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {viewingEmployee.fullName}
                    {viewingEmployee.avatarUrl && viewingEmployee.avatarUrl.startsWith('data:image') && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-semibold">
                        Foto Real
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500">{viewingEmployee.role} • {viewingEmployee.department}</span>
                    {viewingEmployee.gender && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        viewingEmployee.gender === 'Laki-laki'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-pink-50 text-pink-700 border border-pink-200'
                      }`}>
                        {viewingEmployee.gender === 'Laki-laki' ? '♂ Laki-laki (Pria)' : '♀ Perempuan (Wanita)'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openQuickPhotoModal(viewingEmployee)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      Upload / Ganti Foto Real Karyawan
                    </button>
                    {viewingEmployee.contractDocumentUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setAdminPreviewDoc({
                            title: `Dokumen Kontrak Kerja — ${viewingEmployee.fullName}`,
                            subtitle: `${
                              viewingEmployee.contractDocumentNumber || viewingEmployee.employmentStatus
                            } • Masa Aktif: ${
                              viewingEmployee.contractStartDate || viewingEmployee.joinDate
                            } s/d ${viewingEmployee.contractEndDate || 'Tetap (PKWTT)'}`,
                            imageUrl: viewingEmployee.contractDocumentUrl!,
                            downloadFileName:
                              viewingEmployee.contractDocumentName ||
                              `Kontrak-Kerja-${viewingEmployee.nik}.jpg`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold cursor-pointer"
                      >
                        <FileCheck2 className="w-3 h-3" />
                        <span>Lihat Dokumen Kontrak</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                <span className="font-semibold text-slate-700 block border-b pb-1">Data Pekerjaan &amp; Identitas</span>
                <div className="flex justify-between"><span className="text-slate-500">NIK Karyawan:</span><span className="font-mono font-medium">{viewingEmployee.nik}</span></div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Nomor NIK KTP (16 Digit):</span>
                  {viewingEmployee.ktpNumber ? (
                    <span className="font-mono font-bold text-indigo-700">{viewingEmployee.ktpNumber}</span>
                  ) : (
                    <span className="font-semibold text-amber-600">Belum dilengkapi</span>
                  )}
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Status Kontrak:</span><span className="font-medium">{viewingEmployee.employmentStatus}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tgl Bergabung:</span><span className="font-medium">{formatIndoDate(viewingEmployee.joinDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Jenis Kelamin:</span><span className="font-medium text-slate-800">{viewingEmployee.gender || 'Laki-laki'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Sisa Cuti:</span><span className="font-medium">{viewingEmployee.remainingLeaveDays} Hari</span></div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="font-semibold text-slate-700">Kontak (WA/Email) &amp; Rekening</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Tersinkron Supabase</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 block">Email Karyawan (Kantor / Pribadi):</label>
                  <input
                    type="email"
                    value={viewingEmployee.email || ''}
                    onChange={(e) => {
                      const updated: Employee = {
                        ...viewingEmployee,
                        email: e.target.value,
                      };
                      setViewingEmployee(updated);
                      onUpdateEmployee(updated);
                    }}
                    placeholder="nama@tasgrosirimport.co.id"
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-500">Nomor WhatsApp / HP:</label>
                    <span className="text-[10px] font-mono text-green-700 font-semibold">
                      wa.me/{formatWhatsAppPhone(viewingEmployee.phone) || '-'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={viewingEmployee.phone || ''}
                    onChange={(e) => {
                      const updated: Employee = {
                        ...viewingEmployee,
                        phone: e.target.value,
                      };
                      setViewingEmployee(updated);
                      onUpdateEmployee(updated);
                    }}
                    placeholder="0812-3456-7890"
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800"
                  />
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Bank:</span>
                  <span className="font-medium">
                    {viewingEmployee.bankName} - {viewingEmployee.bankAccountNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Atas Nama:</span>
                  <span className="font-medium">{viewingEmployee.bankAccountHolder}</span>
                </div>
                {evaluateBankAccountValidity(viewingEmployee, employees).isInvalid && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>
                        {evaluateBankAccountValidity(viewingEmployee, employees).badgeLabel}
                      </span>
                    </span>
                    <span className="block text-[10px] text-amber-700 mt-0.5">
                      {evaluateBankAccountValidity(viewingEmployee, employees).detailReason}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-emerald-50/60 rounded-xl space-y-2 border border-emerald-100">
                <span className="font-semibold text-emerald-900 block border-b border-emerald-200 pb-1">Struktur Gaji Per Jam &amp; Tunjangan</span>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Tarif Gaji Per Jam (hourly_rate):</span>
                  <span className="font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    {formatRupiah(getEmployeeHourlyRate(viewingEmployee, STANDARD_WORK_HOURS_PER_DAY, 25))} / jam
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Gaji Harian (Standar 9 Jam):</span>
                  <span className="font-bold text-slate-800">
                    {formatRupiah(getEmployeeDailySalary(viewingEmployee, 25, STANDARD_WORK_HOURS_PER_DAY))} / hari
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-600">Est. Bulanan (25 Hr / 225 Jam):</span><span className="font-bold text-slate-900">{formatRupiah(viewingEmployee.baseSalary)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tunj. Jabatan:</span><span>{formatRupiah(viewingEmployee.allowances.position)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tunj. Transport:</span><span>{formatRupiah(viewingEmployee.allowances.transport)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tunj. Makan:</span><span>{formatRupiah(viewingEmployee.allowances.meal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tunj. Komunikasi:</span><span>{formatRupiah(viewingEmployee.allowances.communication)}</span></div>
                {(viewingEmployee.isLiveStreamHost ||
                  viewingEmployee.isCoHostLiveStream ||
                  (viewingEmployee.salesCommissionPercentage || 0) > 0 ||
                  (viewingEmployee.salesCommissionPerPcs || 0) > 0 ||
                  (viewingEmployee.coHostCommissionPercentage || 0) > 0) && (
                  <div className="pt-2 mt-1 border-t border-emerald-200 space-y-1">
                    {viewingEmployee.isLiveStreamHost && (
                      <div className="flex justify-between items-center">
                        <span className="text-fuchsia-800 font-bold">Status Host Live Stream:</span>
                        <span className="px-2 py-0.5 rounded bg-fuchsia-100 text-fuchsia-900 font-bold text-[10px] border border-fuchsia-300">
                          Aktif ({viewingEmployee.salesCommissionPercentage || 0}% Omset
                          {(viewingEmployee.salesCommissionPerPcs || 0) > 0
                            ? ` + ${formatRupiah(viewingEmployee.salesCommissionPerPcs || 0)}/pcs`
                            : ''}
                          )
                        </span>
                      </div>
                    )}
                    {viewingEmployee.isCoHostLiveStream && (
                      <div className="flex justify-between items-center">
                        <span className="text-violet-800 font-bold">Status Co-Host Live:</span>
                        <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-900 font-bold text-[10px] border border-violet-300">
                          Aktif ({viewingEmployee.coHostCommissionPercentage || 0}% Omset
                          {(viewingEmployee.coHostCommissionPerPcs || 0) > 0
                            ? ` + ${formatRupiah(viewingEmployee.coHostCommissionPerPcs || 0)}/pcs`
                            : ''}
                          )
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Total Komisi Live Tercatat:</span>
                      <span className="font-extrabold text-fuchsia-700">
                        {formatRupiah(
                          calculateEmployeeLiveSalesCommission(viewingEmployee).totalCommission
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-purple-50/60 rounded-xl space-y-2 border border-purple-100">
                <span className="font-semibold text-purple-900 block border-b border-purple-200 pb-1">Pajak (PPh 21) &amp; BPJS</span>
                <div className="flex justify-between"><span className="text-slate-600">Status PTKP:</span><span className="font-bold text-purple-800">{viewingEmployee.ptkpStatus}</span></div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Nomor NPWP:</span>
                  <span className="font-mono font-bold text-slate-900">{viewingEmployee.npwp || '-'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600">Status Padan NIK-NPWP:</span>
                  <span className="font-semibold text-[11px] text-emerald-700">
                    {getNpwpStatusInfo(viewingEmployee.npwp, viewingEmployee.ktpNumber).label}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-600">BPJS Kesehatan:</span><span className="font-mono">{viewingEmployee.bpjsKesehatanNo}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">BPJS Ketenagakerjaan:</span><span className="font-mono">{viewingEmployee.bpjsKetenagakerjaanNo}</span></div>
              </div>
            </div>

            {/* Seksi Masa Aktif Kontrak & Upload Dokumen Kontrak Kerja (PKWT / PKWTT) */}
            {(() => {
              const contractInfo = getContractValidityInfo(viewingEmployee);
              return (
                <div className="mt-4 p-4 bg-gradient-to-br from-indigo-50/60 via-white to-emerald-50/50 rounded-xl border border-indigo-200 space-y-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-2.5">
                    <div>
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                        <FileCheck2 className="w-4 h-4 text-indigo-600" />
                        Masa Aktif Kontrak &amp; Dokumen Kontrak Kerja ({viewingEmployee.employmentStatus})
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Atur tanggal mulai/berakhir kontrak dan unggah dokumen kontrak kerja (langsung tampil di Portal Karyawan)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                          contractInfo.isPermanent
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : contractInfo.isExpired
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : contractInfo.isExpiringSoon
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {contractInfo.badgeText}
                      </span>
                      {!contractInfo.isPermanent &&
                        (contractInfo.isExpiringSoon ||
                          contractInfo.isExpired ||
                          (contractInfo.daysRemaining !== null &&
                            contractInfo.daysRemaining <= 30)) && (
                          <>
                            <a
                              href={getContractReminderWhatsAppUrl(
                                viewingEmployee,
                                contractInfo.daysRemaining
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Ingatkan Kontrak (WA)</span>
                            </a>
                            <a
                              href={getContractReminderEmailUrl(
                                viewingEmployee,
                                contractInfo.daysRemaining
                              )}
                              className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email Kontrak</span>
                            </a>
                          </>
                        )}
                    </div>
                  </div>

                  {/* Quick Edit Masa Aktif Kontrak */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Tanggal Mulai Kontrak
                      </label>
                      <input
                        type="date"
                        value={viewingEmployee.contractStartDate || viewingEmployee.joinDate}
                        onChange={(e) => {
                          const updated: Employee = {
                            ...viewingEmployee,
                            contractStartDate: e.target.value,
                            contractUpdatedAt: new Date().toLocaleDateString('id-ID'),
                          };
                          onUpdateEmployee(updated);
                          setViewingEmployee(updated);
                          showToast('Tanggal mulai kontrak berhasil diperbarui!');
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Tanggal Berakhir Kontrak
                      </label>
                      <input
                        type="date"
                        disabled={viewingEmployee.employmentStatus === 'PKWTT (Tetap)'}
                        value={
                          viewingEmployee.employmentStatus === 'PKWTT (Tetap)'
                            ? ''
                            : viewingEmployee.contractEndDate || ''
                        }
                        onChange={(e) => {
                          const updated: Employee = {
                            ...viewingEmployee,
                            contractEndDate: e.target.value || undefined,
                            contractUpdatedAt: new Date().toLocaleDateString('id-ID'),
                          };
                          onUpdateEmployee(updated);
                          setViewingEmployee(updated);
                          showToast('Tanggal berakhir kontrak berhasil diperbarui!');
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nomor Dokumen Kontrak / SK
                      </label>
                      <input
                        type="text"
                        value={viewingEmployee.contractDocumentNumber || ''}
                        onChange={(e) => {
                          const updated: Employee = {
                            ...viewingEmployee,
                            contractDocumentNumber: e.target.value,
                          };
                          onUpdateEmployee(updated);
                          setViewingEmployee(updated);
                        }}
                        placeholder="PKWT/TKB/2026/001"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Kartu Dokumen Kontrak & Photo Profil */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Kartu 1: Dokumen Kontrak Kerja */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                      {viewingEmployee.contractDocumentUrl ? (
                        <img
                          src={viewingEmployee.contractDocumentUrl}
                          alt={`Kontrak ${viewingEmployee.fullName}`}
                          onClick={() =>
                            setAdminPreviewDoc({
                              title: `Dokumen Kontrak Kerja — ${viewingEmployee.fullName}`,
                              subtitle: `${
                                viewingEmployee.contractDocumentNumber || viewingEmployee.employmentStatus
                              } • ${viewingEmployee.contractStartDate || viewingEmployee.joinDate} s/d ${
                                viewingEmployee.contractEndDate || 'Tetap (PKWTT)'
                              }`,
                              imageUrl: viewingEmployee.contractDocumentUrl!,
                              downloadFileName:
                                viewingEmployee.contractDocumentName ||
                                `Kontrak-Kerja-${viewingEmployee.nik}.jpg`,
                            })
                          }
                          className="w-20 h-16 rounded-xl object-cover ring-2 ring-indigo-500 shrink-0 cursor-pointer"
                        />
                      ) : (
                        <div className="w-20 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                          <FileCheck2 className="w-5 h-5" />
                          <span className="text-[9px] mt-0.5">Belum Ada</span>
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">Dokumen Kontrak Kerja</span>
                          {viewingEmployee.contractDocumentUrl ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">
                              ✓ Terunggah
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800">
                              Belum Upload
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {viewingEmployee.contractDocumentName ||
                            viewingEmployee.contractDocumentNumber ||
                            'Unggah foto/scan PKWT atau SK PKWTT'}
                        </p>
                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                          {viewingEmployee.contractDocumentUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setAdminPreviewDoc({
                                  title: `Dokumen Kontrak Kerja — ${viewingEmployee.fullName}`,
                                  subtitle: `${
                                    viewingEmployee.contractDocumentNumber ||
                                    viewingEmployee.employmentStatus
                                  } • ${
                                    viewingEmployee.contractStartDate || viewingEmployee.joinDate
                                  } s/d ${viewingEmployee.contractEndDate || 'Tetap (PKWTT)'}`,
                                  imageUrl: viewingEmployee.contractDocumentUrl!,
                                  downloadFileName:
                                    viewingEmployee.contractDocumentName ||
                                    `Kontrak-Kerja-${viewingEmployee.nik}.jpg`,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Lihat</span>
                            </button>
                          )}
                          <label className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer inline-flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>
                              {isUploadingContract
                                ? 'Mengunggah...'
                                : viewingEmployee.contractDocumentUrl
                                ? 'Ganti Kontrak'
                                : 'Upload Kontrak'}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/jpg"
                              className="hidden"
                              disabled={isUploadingContract}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleAdminContractUpload(viewingEmployee, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Kartu 2: Photo Profil Karyawan */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                      <img
                        src={viewingEmployee.avatarUrl}
                        alt={viewingEmployee.fullName}
                        onClick={() =>
                          setAdminPreviewDoc({
                            title: `Photo Profil — ${viewingEmployee.fullName}`,
                            subtitle: `NIK: ${viewingEmployee.nik} • ${viewingEmployee.role}`,
                            imageUrl: viewingEmployee.avatarUrl,
                            downloadFileName: `Foto-Profil-${viewingEmployee.nik}.jpg`,
                          })
                        }
                        className="w-16 h-16 rounded-xl object-cover ring-2 ring-emerald-500 shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">Photo Profil Karyawan</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            Aktif
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {viewingEmployee.profilePhotoUpdatedAt
                            ? `Diupdate: ${viewingEmployee.profilePhotoUpdatedAt}`
                            : 'Tersinkronisasi dengan Portal Karyawan'}
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setAdminPreviewDoc({
                                title: `Photo Profil — ${viewingEmployee.fullName}`,
                                subtitle: `NIK: ${viewingEmployee.nik} • ${viewingEmployee.role}`,
                                imageUrl: viewingEmployee.avatarUrl,
                                downloadFileName: `Foto-Profil-${viewingEmployee.nik}.jpg`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Perbesar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openQuickPhotoModal(viewingEmployee)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[10px] cursor-pointer flex items-center gap-1"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Ganti</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Seksi Aset Kantor & Inventaris yang Ditugaskan */}
            {(() => {
              const myAssets = (assets || []).filter(
                (a) => a.assignedToEmployeeId === viewingEmployee.id
              );
              return (
                <div className="mt-4 p-4 bg-teal-50/70 rounded-xl border border-teal-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-teal-200/80 pb-2">
                    <span className="font-bold text-teal-900 flex items-center gap-1.5 text-xs">
                      <Boxes className="w-4 h-4 text-teal-700" />
                      Inventaris & Aset Kantor yang Dipegang ({myAssets.length})
                    </span>
                    <span className="text-[10px] text-teal-700 font-semibold bg-teal-100/90 px-2 py-0.5 rounded-full">
                      Tanggung Jawab Staf
                    </span>
                  </div>

                  {myAssets.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-1">
                      Belum ada inventaris aset kantor yang ditugaskan ke staf ini.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {myAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="bg-white p-3 rounded-lg border border-teal-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{asset.name}</span>
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                {asset.assetCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>Kategori: {asset.category}</span>
                              {asset.serialNumber && <span>• SN: {asset.serialNumber}</span>}
                              {asset.assignedDate && <span>• Diserahkan: {asset.assignedDate}</span>}
                            </div>
                            {asset.handoverConditionNotes && (
                              <p className="text-[10px] text-slate-500 italic mt-0.5">
                                Catatan serah terima: &ldquo;{asset.handoverConditionNotes}&rdquo;
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                asset.condition === 'Baik'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {asset.condition}
                            </span>
                            <span className="font-semibold text-slate-700 text-[11px]">
                              {formatRupiah(asset.purchaseCost)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Seksi Evaluasi Kinerja & Nilai KPI */}
            {(() => {
              const myReviews = (reviews || []).filter(
                (r) => r.employeeId === viewingEmployee.id
              );
              return (
                <div className="mt-4 p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                      <Award className="w-4 h-4 text-indigo-700" />
                      Evaluasi Kinerja & Nilai KPI ({myReviews.length})
                    </span>
                    <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100/90 px-2 py-0.5 rounded-full">
                      Performance Appraisal
                    </span>
                  </div>

                  {myReviews.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-1">
                      Belum ada rekaman penilaian kinerja berkala untuk karyawan ini.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {myReviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="bg-white p-3.5 rounded-lg border border-indigo-200/70 space-y-2.5 text-xs shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs">
                                Periode: {rev.period} ({rev.periodType})
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                Dinilai oleh {rev.reviewerName} • {formatIndoDate(rev.reviewDate)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-700">
                                Skor: <span className="text-indigo-700 text-sm font-black">{rev.finalScore}</span>/100
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  rev.grade === 'A+' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                  rev.grade === 'A' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                                  rev.grade === 'B+' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  rev.grade === 'B' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                  'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                Grade {rev.grade}
                              </span>
                            </div>
                          </div>

                          {/* 4 Komponen Nilai */}
                          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                              <span className="text-slate-500 block text-[9px]">KPI (40%)</span>
                              <span className="font-bold text-indigo-700 text-xs">{rev.kpiScore}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                              <span className="text-slate-500 block text-[9px]">Disiplin</span>
                              <span className="font-bold text-teal-700 text-xs">{rev.disciplineScore}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                              <span className="text-slate-500 block text-[9px]">Kerjasama</span>
                              <span className="font-bold text-blue-700 text-xs">{rev.teamworkScore}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                              <span className="text-slate-500 block text-[9px]">Inisiatif</span>
                              <span className="font-bold text-purple-700 text-xs">{rev.initiativeScore}</span>
                            </div>
                          </div>

                          {rev.generalFeedback && (
                            <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                              &ldquo;{rev.generalFeedback}&rdquo;
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="text-slate-500">
                              Rekomendasi Bonus: <strong className="text-emerald-700">{formatRupiah(rev.recommendedBonus)}</strong>
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                rev.isBonusAppliedToPayroll
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rev.isBonusAppliedToPayroll ? '✓ Bonus Masuk Payroll' : '⏳ Belum Masuk Payroll'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Seksi Khusus Admin di Detail Karyawan: Input & Edit Data Omset Live Streaming, Jumlah Tas Terjual (Pcs), dan Persentase Komisi (Host & Co-Host) */}
            {(() => {
              const liveSummary = calculateEmployeeLiveSalesCommission(viewingEmployee);
              const hostPct = Math.max(0, Number(viewingEmployee.salesCommissionPercentage) || 0);
              const hostPcsRate = Math.max(0, Number(viewingEmployee.salesCommissionPerPcs) || 0);
              const coHostPct = Math.max(0, Number(viewingEmployee.coHostCommissionPercentage) || 0);
              const coHostPcsRate = Math.max(0, Number(viewingEmployee.coHostCommissionPerPcs) || 0);
              const activeRatePct = detailLiveRole === 'Co-Host' ? coHostPct : hostPct;
              const activeRatePcs = detailLiveRole === 'Co-Host' ? coHostPcsRate : hostPcsRate;
              const previewOmsetComm = Math.round(
                (Math.max(0, Number(detailLiveOmset) || 0) * activeRatePct) / 100
              );
              const previewPcsComm = Math.round(
                Math.max(0, Number(detailLivePcs) || 0) * activeRatePcs
              );
              const previewComm = previewOmsetComm + previewPcsComm;

              const resetDetailLiveForm = () => {
                setDetailEditingLogId(null);
                setDetailLiveTitle('');
                setDetailLiveOmset(0);
                setDetailLivePcs(0);
                setDetailLiveDuration(3);
              };

              const handleSaveDetailLiveLog = (e: React.FormEvent) => {
                e.preventDefault();
                if (detailLiveOmset <= 0 && detailLivePcs <= 0) {
                  showToast('Masukkan Nilai Omset Penjualan Sesi Live (IDR) atau Jumlah Tas yang Terjual (Pcs) terlebih dahulu.');
                  return;
                }

                if (detailEditingLogId) {
                  let editedSessionObj: LiveStreamSalesRecord | null = null;
                  const updatedLogs = (viewingEmployee.liveStreamSalesLogs || []).map((log) => {
                    if (log.id !== detailEditingLogId) return log;
                    const updatedItem: LiveStreamSalesRecord = {
                      ...log,
                      date: detailLiveDate || log.date,
                      session_date: detailLiveDate || log.date,
                      platform: detailLivePlatform,
                      sessionRole: detailLiveRole,
                      role_type: detailLiveRole === 'Co-Host' ? 'co_host' : 'host',
                      sessionTitle:
                        detailLiveTitle.trim() || `Sesi ${detailLiveRole} ${detailLivePlatform}`,
                      durationHours: Math.max(0.5, Number(detailLiveDuration) || 1),
                      omsetAmount: Math.max(0, Math.round(Number(detailLiveOmset) || 0)),
                      omset: Math.max(0, Math.round(Number(detailLiveOmset) || 0)),
                      pcsSold: Math.max(0, Math.round(Number(detailLivePcs) || 0)),
                      pcs_sold: Math.max(0, Math.round(Number(detailLivePcs) || 0)),
                      commissionPercentageSnapshot: activeRatePct,
                      commission_pct_used: activeRatePct,
                      commissionPerPcsSnapshot: activeRatePcs,
                      commission_per_pcs_used: activeRatePcs,
                      calculatedCommission: previewComm,
                      total_commission: previewComm,
                    };
                    editedSessionObj = updatedItem;
                    return updatedItem;
                  });
                  const updatedEmp: Employee = {
                    ...viewingEmployee,
                    isLiveStreamHost:
                      detailLiveRole === 'Host' ? true : viewingEmployee.isLiveStreamHost,
                    is_host:
                      detailLiveRole === 'Host'
                        ? true
                        : Boolean(viewingEmployee.is_host ?? viewingEmployee.isLiveStreamHost),
                    isCoHostLiveStream:
                      detailLiveRole === 'Co-Host' ? true : viewingEmployee.isCoHostLiveStream,
                    is_co_host:
                      detailLiveRole === 'Co-Host'
                        ? true
                        : Boolean(viewingEmployee.is_co_host ?? viewingEmployee.isCoHostLiveStream),
                    liveStreamSalesLogs: updatedLogs,
                  };
                  if (editedSessionObj) {
                    upsertLivestreamSessionToSupabase(editedSessionObj).catch(() => {});
                  }
                  syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                  onUpdateEmployee(updatedEmp);
                  setViewingEmployee(updatedEmp);
                  resetDetailLiveForm();
                  showToast(
                    `Perubahan sesi ${detailLiveRole} untuk ${viewingEmployee.fullName} berhasil disimpan & disinkronkan ke Slip Gaji!`
                  );
                  return;
                }

                const resolvedDateStr = detailLiveDate || new Date().toISOString().split('T')[0];
                const newLog: LiveStreamSalesRecord = {
                  id: generateSessionUuid(),
                  employeeId: viewingEmployee.id,
                  employee_id: viewingEmployee.id,
                  employeeName: viewingEmployee.fullName,
                  employee_name: viewingEmployee.fullName,
                  employeeNik: viewingEmployee.nik,
                  date: resolvedDateStr,
                  session_date: resolvedDateStr,
                  period: 'Maret 2026',
                  platform: detailLivePlatform,
                  sessionRole: detailLiveRole,
                  role_type: detailLiveRole === 'Co-Host' ? 'co_host' : 'host',
                  sessionTitle:
                    detailLiveTitle.trim() || `Sesi ${detailLiveRole} ${detailLivePlatform}`,
                  durationHours: Math.max(0.5, Number(detailLiveDuration) || 1),
                  omsetAmount: Math.max(0, Math.round(Number(detailLiveOmset) || 0)),
                  omset: Math.max(0, Math.round(Number(detailLiveOmset) || 0)),
                  pcsSold: Math.max(0, Math.round(Number(detailLivePcs) || 0)),
                  pcs_sold: Math.max(0, Math.round(Number(detailLivePcs) || 0)),
                  commissionPercentageSnapshot: activeRatePct,
                  commission_pct_used: activeRatePct,
                  commissionPerPcsSnapshot: activeRatePcs,
                  commission_per_pcs_used: activeRatePcs,
                  calculatedCommission: previewComm,
                  total_commission: previewComm,
                  status: 'Terverifikasi',
                  createdAt: new Date().toISOString(),
                };
                const updatedLogs = [newLog, ...(viewingEmployee.liveStreamSalesLogs || [])];
                const updatedEmp: Employee = {
                  ...viewingEmployee,
                  isLiveStreamHost:
                    detailLiveRole === 'Host' ? true : viewingEmployee.isLiveStreamHost,
                  is_host:
                    detailLiveRole === 'Host'
                      ? true
                      : Boolean(viewingEmployee.is_host ?? viewingEmployee.isLiveStreamHost),
                  isCoHostLiveStream:
                    detailLiveRole === 'Co-Host' ? true : viewingEmployee.isCoHostLiveStream,
                  is_co_host:
                    detailLiveRole === 'Co-Host'
                      ? true
                      : Boolean(viewingEmployee.is_co_host ?? viewingEmployee.isCoHostLiveStream),
                  liveStreamSalesLogs: updatedLogs,
                };
                upsertLivestreamSessionToSupabase(newLog).catch(() => {});
                syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                onUpdateEmployee(updatedEmp);
                setViewingEmployee(updatedEmp);
                resetDetailLiveForm();
                showToast(
                  `Sesi ${detailLiveRole} (${detailLivePlatform}) — Omset ${formatRupiah(newLog.omsetAmount)} & ${newLog.pcsSold} Pcs Tas untuk ${viewingEmployee.fullName} berhasil disimpan & disinkronkan ke Slip Gaji!`
                );
              };

              return (
                <div className="mt-4 p-4 bg-gradient-to-br from-pink-50/70 via-white to-violet-50/60 rounded-xl border border-pink-200 space-y-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-200/80 pb-2.5">
                    <div>
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                        <Video className="w-4 h-4 text-pink-600" />
                        <span>
                          Kendali Admin: Input Pencatatan Sesi Live Streaming (Omset &amp; Tas Terjual) — Host &amp; Co-Host
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Atur % Komisi Omset dan Tarif per Pcs Tas secara terpisah untuk Host maupun Co-Host. Di Portal Karyawan bersifat Read-Only.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-center">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[10px]">
                        Tas Terjual: {liveSummary.totalPcs.toLocaleString('id-ID')} Pcs
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-pink-600 text-white font-bold text-[10px]">
                        Total Komisi: {formatRupiah(liveSummary.totalCommission)}
                      </span>
                    </div>
                  </div>

                  {/* Pengaturan Terpisah & Fleksibel: % Komisi Omset & Tarif per Pcs (Rp/Pcs) untuk Host dan Co-Host */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="p-2.5 bg-white rounded-xl border border-pink-200">
                      <label className="inline-flex items-center gap-1.5 font-bold text-pink-900 mb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(viewingEmployee.isLiveStreamHost || viewingEmployee.is_host)}
                          onChange={(e) => {
                            const updatedEmp = {
                              ...viewingEmployee,
                              isLiveStreamHost: e.target.checked,
                              is_host: e.target.checked,
                            };
                            syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                            onUpdateEmployee(updatedEmp);
                            setViewingEmployee(updatedEmp);
                          }}
                          className="rounded text-pink-600"
                        />
                        <span>Komisi Host (% Omset)</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={viewingEmployee.salesCommissionPercentage || 0}
                          onChange={(e) => {
                            const nextPct = Math.max(0, Number(e.target.value) || 0);
                            const updatedEmp = {
                              ...viewingEmployee,
                              isLiveStreamHost: true,
                              is_host: true,
                              salesCommissionPercentage: nextPct,
                              host_commission_pct: nextPct,
                            };
                            syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                            onUpdateEmployee(updatedEmp);
                            setViewingEmployee(updatedEmp);
                          }}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-pink-700"
                        />
                        <span className="font-bold text-slate-600">%</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-pink-200">
                      <label className="block font-bold text-pink-900 mb-1">
                        Tarif Host per Pcs Tas (Rp/Pcs)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold">Rp</span>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={viewingEmployee.salesCommissionPerPcs || 0}
                          onChange={(e) => {
                            const nextPcs = Math.max(0, Math.round(Number(e.target.value) || 0));
                            const updatedEmp = {
                              ...viewingEmployee,
                              isLiveStreamHost: true,
                              is_host: true,
                              salesCommissionPerPcs: nextPcs,
                              host_commission_per_pcs: nextPcs,
                            };
                            syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                            onUpdateEmployee(updatedEmp);
                            setViewingEmployee(updatedEmp);
                          }}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-pink-700"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-violet-200">
                      <label className="inline-flex items-center gap-1.5 font-bold text-violet-900 mb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(viewingEmployee.isCoHostLiveStream || viewingEmployee.is_co_host)}
                          onChange={(e) => {
                            const updatedEmp = {
                              ...viewingEmployee,
                              isCoHostLiveStream: e.target.checked,
                              is_co_host: e.target.checked,
                            };
                            syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                            onUpdateEmployee(updatedEmp);
                            setViewingEmployee(updatedEmp);
                          }}
                          className="rounded text-violet-600"
                        />
                        <span>Komisi Co-Host (% Omset)</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={viewingEmployee.coHostCommissionPercentage || 0}
                          onChange={(e) => {
                            const nextPct = Math.max(0, Number(e.target.value) || 0);
                            const updatedEmp = {
                              ...viewingEmployee,
                              isCoHostLiveStream: true,
                              is_co_host: true,
                              coHostCommissionPercentage: nextPct,
                              co_host_commission_pct: nextPct,
                            };
                            syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                            onUpdateEmployee(updatedEmp);
                            setViewingEmployee(updatedEmp);
                          }}
                          className="w-full px-2.5 py-1 bg-violet-50/50 border border-violet-300 rounded-lg font-mono font-bold text-violet-800"
                        />
                        <span className="font-bold text-violet-700">%</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-violet-200">
                      <label className="block font-bold text-violet-900 mb-1">
                        Tarif Co-Host per Pcs Tas (Rp/Pcs)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-violet-600 font-bold">Rp</span>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={viewingEmployee.coHostCommissionPerPcs || 0}
                          onChange={(e) => {
                            const nextPcs = Math.max(0, Math.round(Number(e.target.value) || 0));
                            const updatedEmp = {
                              ...viewingEmployee,
                              isCoHostLiveStream: true,
                              is_co_host: true,
                              coHostCommissionPerPcs: nextPcs,
                              co_host_commission_per_pcs: nextPcs,
                            };
                            syncEmployeeLiveColumnsToSupabase(updatedEmp).catch(() => {});
                            onUpdateEmployee(updatedEmp);
                            setViewingEmployee(updatedEmp);
                          }}
                          className="w-full px-2.5 py-1 bg-violet-50/50 border border-violet-300 rounded-lg font-mono font-bold text-violet-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Input / Edit Sesi Omset Live & Jumlah Tas Terjual di Detail Karyawan */}
                  <form
                    onSubmit={handleSaveDetailLiveLog}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {detailEditingLogId
                          ? 'Edit Data Sesi Live Streaming (Omset & Jumlah Tas Terjual)'
                          : 'Form Input Sesi Live Streaming Baru (Host / Co-Host)'}
                      </span>
                      {detailEditingLogId && (
                        <button
                          type="button"
                          onClick={resetDetailLiveForm}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Pilih Karyawan (Host / Co-Host)
                        </label>
                        <select
                          value={viewingEmployee.id}
                          onChange={(e) => {
                            const targetEmp = employees.find((item) => item.id === e.target.value);
                            if (targetEmp) {
                              setViewingEmployee(targetEmp);
                              resetDetailLiveForm();
                              setDetailLiveRole(
                                targetEmp.isCoHostLiveStream && !targetEmp.isLiveStreamHost
                                  ? 'Co-Host'
                                  : 'Host'
                              );
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                        >
                          {employees.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.fullName} ({item.nik})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Peran Sesi (Host / Co-Host)
                        </label>
                        <select
                          value={detailLiveRole}
                          onChange={(e) =>
                            setDetailLiveRole(e.target.value as 'Host' | 'Co-Host')
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                        >
                          <option value="Host">
                            Host ({hostPct}%{hostPcsRate > 0 ? ` + ${formatRupiah(hostPcsRate)}/pcs` : ''})
                          </option>
                          <option value="Co-Host">
                            Co-Host ({coHostPct}%{coHostPcsRate > 0 ? ` + ${formatRupiah(coHostPcsRate)}/pcs` : ''})
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Platform (TikTok Shop / Shopee Live)
                        </label>
                        <select
                          value={detailLivePlatform}
                          onChange={(e) =>
                            setDetailLivePlatform(e.target.value as LiveStreamPlatform)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900"
                        >
                          <option value="TikTok Shop Live">TikTok Shop Live</option>
                          <option value="Shopee Live">Shopee Live</option>
                          <option value="Tokopedia Play">Tokopedia Play</option>
                          <option value="Instagram / FB Live">Instagram / FB Live</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Tanggal Sesi Live
                        </label>
                        <input
                          type="date"
                          value={detailLiveDate}
                          onChange={(e) => setDetailLiveDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-pink-800 mb-0.5">
                          Nilai Omset Penjualan Sesi Live (IDR) *
                        </label>
                        <input
                          type="number"
                          step={50000}
                          min={0}
                          placeholder="Contoh: 15000000"
                          value={detailLiveOmset || ''}
                          onChange={(e) =>
                            setDetailLiveOmset(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-full px-2.5 py-1.5 bg-pink-50/40 border border-pink-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">
                          Jumlah Tas yang Terjual (Pcs) *
                        </label>
                        <input
                          type="number"
                          step={1}
                          min={0}
                          placeholder="Contoh: 95"
                          value={detailLivePcs || ''}
                          onChange={(e) =>
                            setDetailLivePcs(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-full px-2.5 py-1.5 bg-indigo-50/40 border border-indigo-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Judul / Keterangan Sesi Live
                        </label>
                        <input
                          type="text"
                          placeholder="Misal: Live Promo Tas Selempang"
                          value={detailLiveTitle}
                          onChange={(e) => setDetailLiveTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Durasi Sesi (Jam)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={detailLiveDuration}
                          onChange={(e) => setDetailLiveDuration(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-600">
                        <span>
                          Estimasi Komisi Sesi Ini ({detailLiveRole}):{' '}
                          <strong className="text-pink-700 font-extrabold">
                            +{formatRupiah(previewComm)}
                          </strong>
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          Rincian: Omset × {activeRatePct}% ({formatRupiah(previewOmsetComm)}) +{' '}
                          {detailLivePcs || 0} Pcs Tas × {formatRupiah(activeRatePcs)}/pcs (
                          {formatRupiah(previewPcsComm)})
                        </span>
                      </div>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {detailEditingLogId
                            ? 'Simpan Perubahan Sesi'
                            : 'Simpan Sesi Live & Sinkron ke Slip Gaji'}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Daftar Sesi Live Tercatat di Detail Karyawan */}
                  {liveSummary.filteredLogs.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-2.5">Tanggal &amp; Platform</th>
                            <th className="py-2 px-2.5">Peran &amp; Sesi</th>
                            <th className="py-2 px-2.5 text-right">Omset Sesi (IDR)</th>
                            <th className="py-2 px-2.5 text-right">Tas Terjual (Pcs)</th>
                            <th className="py-2 px-2.5 text-right">Komisi Otomatis</th>
                            <th className="py-2 px-2.5 text-center">Edit/Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {liveSummary.filteredLogs.map((log) => {
                            const isCoHostRow =
                              log.sessionRole === 'Co-Host' ||
                              (!log.sessionRole &&
                                viewingEmployee.isCoHostLiveStream &&
                                !viewingEmployee.isLiveStreamHost);
                            const rowPct = isCoHostRow
                              ? coHostPct > 0
                                ? coHostPct
                                : Number(log.commissionPercentageSnapshot) || 0
                              : hostPct > 0
                              ? hostPct
                              : Number(log.commissionPercentageSnapshot) || 0;
                            const rowPcsRate = isCoHostRow
                              ? coHostPcsRate > 0
                                ? coHostPcsRate
                                : Number(log.commissionPerPcsSnapshot) || 0
                              : hostPcsRate > 0
                              ? hostPcsRate
                              : Number(log.commissionPerPcsSnapshot) || 0;
                            const rowComm = Math.round(
                              ((Number(log.omsetAmount) || 0) * rowPct) / 100 +
                                (Number(log.pcsSold) || 0) * rowPcsRate
                            );
                            return (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="py-1.5 px-2.5">
                                  <span className="font-semibold text-slate-800 block">
                                    {formatIndoDate(log.date)}
                                  </span>
                                  <span className="text-[9px] text-pink-700 font-bold">
                                    {log.platform}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <span
                                    className={`inline-block mr-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      isCoHostRow
                                        ? 'bg-violet-100 text-violet-800'
                                        : 'bg-pink-100 text-pink-800'
                                    }`}
                                  >
                                    {isCoHostRow ? 'Co-Host' : 'Host'}
                                  </span>
                                  <span className="font-medium text-slate-800">
                                    {log.sessionTitle}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-semibold">
                                  {formatRupiah(log.omsetAmount)}
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-indigo-800">
                                  {log.pcsSold.toLocaleString('id-ID')} Pcs
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-pink-700">
                                  +{formatRupiah(rowComm)}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDetailEditingLogId(log.id);
                                        setDetailLiveRole(isCoHostRow ? 'Co-Host' : 'Host');
                                        setDetailLiveDate(log.date);
                                        setDetailLivePlatform(log.platform);
                                        setDetailLiveTitle(log.sessionTitle);
                                        setDetailLiveDuration(log.durationHours);
                                        setDetailLiveOmset(log.omsetAmount);
                                        setDetailLivePcs(log.pcsSold);
                                      }}
                                      className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                                      title="Edit sesi live"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedLogs = (
                                          viewingEmployee.liveStreamSalesLogs || []
                                        ).filter((item) => item.id !== log.id);
                                        const updatedEmp = {
                                          ...viewingEmployee,
                                          liveStreamSalesLogs: updatedLogs,
                                        };
                                        deleteLivestreamSessionFromSupabase(log.id).catch(() => {});
                                        onUpdateEmployee(updatedEmp);
                                        setViewingEmployee(updatedEmp);
                                        showToast('Catatan sesi live dihapus.');
                                      }}
                                      className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                      title="Hapus sesi live"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
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
              );
            })()}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDeletingEmployee(viewingEmployee);
                }}
                className="px-3.5 py-2 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Karyawan</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const emp = viewingEmployee;
                    setViewingEmployee(null);
                    openEditModal(emp);
                  }}
                  className="px-3.5 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profil & Gaji</span>
                </button>
                <button
                  onClick={() => setViewingEmployee(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT EMPLOYEE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingEmployee ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
              </h3>
              <button
                onClick={closeAddModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="mt-5 space-y-5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Seksi Foto Profil Real Karyawan (Pas Foto) */}
              <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-xs">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      Pas Foto Real Karyawan (Foto Wajah Asli)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload foto real karyawan (pas foto resmi/bebas rapi) untuk identitas profil, presensi, dan slip gaji.
                    </p>
                  </div>
                  {formData.avatarUrl && formData.avatarUrl.startsWith('data:image') && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-medium text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Foto Real Terpasang
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Avatar Display */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-emerald-500 shadow-md bg-slate-100 flex items-center justify-center">
                      {formData.avatarUrl ? (
                        <img
                          src={formData.avatarUrl}
                          alt="Pratinjau Foto"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-10 h-10 text-slate-300" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">Rasio 1:1</span>
                  </div>

                  {/* Photo Controls */}
                  <div className="flex-1 w-full space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium cursor-pointer transition-colors shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isCompressingForm ? 'Memproses...' : 'Upload File Foto'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          disabled={isCompressingForm}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFormPhotoUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          if (isFormCameraActive) {
                            stopFormCamera();
                          } else {
                            startFormCamera();
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition-colors border shadow-xs cursor-pointer ${
                          isFormCameraActive
                            ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isFormCameraActive ? 'Tutup Kamera' : 'Ambil via Kamera Web'}</span>
                      </button>

                      {formData.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            stopFormCamera();
                            setFormData((prev) => ({
                              ...prev,
                              avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 500)}?auto=format&fit=crop&w=256&h=256&q=80`,
                              facePhotoUrl: undefined,
                            }));
                          }}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl font-medium cursor-pointer"
                          title="Reset ke avatar standar"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>

                    {formPhotoError && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{formPhotoError}</span>
                      </div>
                    )}

                    {/* Camera Viewfinder when active */}
                    {isFormCameraActive && (
                      <div className="p-3 bg-slate-900 rounded-xl text-white">
                        <div className="relative w-full max-w-xs mx-auto aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center">
                          <video
                            ref={formVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          <div className="absolute inset-0 border-2 border-emerald-400 rounded-full scale-75 pointer-events-none opacity-80 border-dashed" />
                        </div>
                        <div className="mt-2.5 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={captureFormCamera}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Jepret Pas Foto
                          </button>
                          <button
                            type="button"
                            onClick={stopFormCamera}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Preset sample headshots */}
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1.5">Atau pilih dari foto sampel formal:</p>
                      <div className="flex flex-wrap gap-2">
                        {SAMPLE_PHOTOS.map((sample, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              stopFormCamera();
                              setFormData((prev) => ({
                                ...prev,
                                avatarUrl: sample.url,
                                facePhotoUrl: sample.url,
                              }));
                            }}
                            className="relative p-0.5 rounded-lg border-2 hover:border-emerald-500 transition-all cursor-pointer overflow-hidden group"
                            title={sample.label}
                          >
                            <img
                              src={sample.url}
                              alt={sample.label}
                              className="w-7 h-7 rounded-md object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seksi 1: Identitas */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-2.5 pb-1 border-b border-slate-100">
                  1. Informasi Pribadi & Pekerjaan
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">NIK (Nomor Induk)</label>
                    <input
                      type="text"
                      required
                      value={formData.nik}
                      onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Nomor NIK KTP (16 Digit)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={16}
                      value={formData.ktpNumber || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ktpNumber: e.target.value.replace(/\D/g, '').slice(0, 16),
                        })
                      }
                      placeholder="16 digit angka sesuai KTP"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Budi Hartono"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Email Karyawan (Notifikasi Slip Gaji)
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="nama@tasgrosirimport.co.id"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600">Nomor WhatsApp / HP</label>
                      {formData.phone && (
                        <span className="text-[10px] font-mono text-green-700 font-semibold">
                          WA: {formatWhatsAppPhone(formData.phone)}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0812-3456-7890 (Otomatis ke 628...)"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Jabatan / Posisi</label>
                    <input
                      type="text"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="e.g. Fullstack Developer"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600 font-semibold">
                        Departemen / Divisi <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Ketik Bebas atau Klik Pilihan Cepat
                      </span>
                    </div>
                    <input
                      type="text"
                      list="department-suggestions"
                      required
                      value={formData.department || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value as Department })
                      }
                      placeholder="Ketik nama departemen baru (contoh: Gudang, Packing, Ekspedisi, Admin Marketplace)..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <datalist id="department-suggestions">
                      {departmentSuggestions.map((dept) => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>

                    {/* Quick-Select Department Chips */}
                    <div className="mt-2 space-y-1.5">
                      {uniqueDepartments.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-400">
                            Departemen Aktif Saat Ini:
                          </span>
                          {uniqueDepartments.map((dept) => {
                            const isSelected = formData.department?.trim() === dept;
                            return (
                              <button
                                key={`active-${dept}`}
                                type="button"
                                onClick={() => setFormData({ ...formData, department: dept })}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                    : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {dept}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">
                          Saran Cepat Divisi:
                        </span>
                        {[
                          'Operasional',
                          'Gudang',
                          'Packing',
                          'Ekspedisi',
                          'Admin Marketplace',
                          'Layanan Pelanggan',
                          'Keuangan & Akuntansi',
                          'Human Resources & GA',
                          'Pemasaran & Bisnis',
                          'Teknologi & IT',
                        ]
                          .filter((preset) => !uniqueDepartments.includes(preset))
                          .map((preset) => {
                            const isSelected = formData.department?.trim() === preset;
                            return (
                              <button
                                key={`preset-${preset}`}
                                type="button"
                                onClick={() => setFormData({ ...formData, department: preset })}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                + {preset}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Jenis Kelamin</label>
                    <select
                      value={formData.gender || 'Laki-laki'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gender: e.target.value as 'Laki-laki' | 'Perempuan',
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    >
                      <option value="Laki-laki">♂ Laki-laki (Pria)</option>
                      <option value="Perempuan">♀ Perempuan (Wanita)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Status Kepegawaian</label>
                    <select
                      value={formData.employmentStatus}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          employmentStatus: e.target.value as EmploymentStatus,
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    >
                      <option value="PKWTT (Tetap)">PKWTT (Tetap)</option>
                      <option value="PKWT (Kontrak)">PKWT (Kontrak)</option>
                      <option value="Probation">Probation</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Tanggal Bergabung</label>
                    <input
                      type="date"
                      value={formData.joinDate || ''}
                      onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={formData.birthDate || ''}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Sisa Hari Cuti</label>
                    <input
                      type="number"
                      value={formData.remainingLeaveDays}
                      onChange={(e) =>
                        setFormData({ ...formData, remainingLeaveDays: Number(e.target.value) })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                {/* Sub-seksi Masa Aktif Kontrak & Upload Dokumen Kontrak Kerja */}
                <div className="mt-3 p-3.5 bg-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                      <FileCheck2 className="w-4 h-4 text-indigo-600" />
                      Masa Aktif Kontrak &amp; Upload Dokumen Kontrak Kerja (PKWT / PKWTT)
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      Sinkron ke Portal Karyawan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1">Tanggal Mulai Kontrak</label>
                      <input
                        type="date"
                        value={formData.contractStartDate || formData.joinDate || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, contractStartDate: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">
                        Tanggal Berakhir Kontrak{' '}
                        {formData.employmentStatus === 'PKWTT (Tetap)' && '(Tetap)'}
                      </label>
                      <input
                        type="date"
                        disabled={formData.employmentStatus === 'PKWTT (Tetap)'}
                        value={
                          formData.employmentStatus === 'PKWTT (Tetap)'
                            ? ''
                            : formData.contractEndDate || ''
                        }
                        onChange={(e) =>
                          setFormData({ ...formData, contractEndDate: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Nomor Kontrak / SK Kerja</label>
                      <input
                        type="text"
                        value={formData.contractDocumentNumber || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, contractDocumentNumber: e.target.value })
                        }
                        placeholder="PKWT/TKB/2026/001"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3 min-w-0">
                      {formData.contractDocumentUrl ? (
                        <img
                          src={formData.contractDocumentUrl}
                          alt="Pratinjau Kontrak"
                          className="w-14 h-12 rounded-lg object-cover border border-indigo-300 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-12 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                          <FileCheck2 className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-xs truncate">
                          {formData.contractDocumentUrl
                            ? formData.contractDocumentName || 'Dokumen-Kontrak-Kerja.jpg'
                            : 'Belum ada dokumen kontrak kerja diunggah'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Karyawan dapat melihat dan mengunduh dokumen kontrak ini langsung dari Portal Karyawan
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {isUploadingContract
                            ? 'Mengompresi...'
                            : formData.contractDocumentUrl
                            ? 'Ganti File Kontrak'
                            : 'Upload Dokumen Kontrak'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          className="hidden"
                          disabled={isUploadingContract}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFormContractUpload(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {formData.contractDocumentUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              contractDocumentUrl: undefined,
                              contractDocumentName: undefined,
                            }))
                          }
                          className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                          title="Hapus Dokumen Kontrak"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seksi 2: Gaji Per Hari, Gaji Pokok & Tunjangan */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-1 border-b border-slate-100">
                  <h4 className="font-semibold text-slate-800">
                    2. Struktur Tarif Gaji Per Jam (Hourly Rate), Harian (9 Jam) &amp; Tunjangan (IDR)
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Payroll Real-Time = Jam Kerja Riil × Tarif Gaji Per Jam (Standar 9 Jam/Hari)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-50/90 border border-emerald-400 rounded-xl">
                    <label className="block text-emerald-950 font-bold mb-1">
                      Tarif Gaji Per Jam (<code className="font-mono text-[10px]">hourly_rate</code>) *
                    </label>
                    <input
                      type="number"
                      name="hourly_rate"
                      required
                      min={0}
                      step={500}
                      value={
                        formData.hourlyRate ??
                        formData.hourly_rate ??
                        Math.round(
                          (Number(formData.dailySalary ?? formData.daily_salary) ||
                            Math.round((Number(formData.baseSalary) || 0) / 25)) /
                            STANDARD_WORK_HOURS_PER_DAY
                        )
                      }
                      onChange={(e) => {
                        const nextHourly = Math.max(0, Number(e.target.value) || 0);
                        const nextDaily = Math.round(nextHourly * STANDARD_WORK_HOURS_PER_DAY);
                        setFormData({
                          ...formData,
                          hourlyRate: nextHourly,
                          hourly_rate: nextHourly,
                          dailySalary: nextDaily,
                          daily_salary: nextDaily,
                          baseSalary: Math.round(nextDaily * 25),
                        });
                      }}
                      placeholder="Contoh: 15000"
                      className="w-full p-2 bg-white border border-emerald-500 rounded-lg text-emerald-950 font-extrabold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <span className="block text-[10px] text-emerald-700 mt-1 font-medium">
                      Dikali akumulasi jam kerja riil bulanan
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                    <label className="block text-emerald-900 font-bold mb-1">
                      Gaji Harian Standar 9 Jam (<code className="font-mono text-[10px]">daily_salary</code>)
                    </label>
                    <input
                      type="number"
                      name="daily_salary"
                      min={0}
                      step={5000}
                      value={
                        formData.dailySalary ??
                        formData.daily_salary ??
                        Math.round((Number(formData.baseSalary) || 0) / 25)
                      }
                      onChange={(e) => {
                        const nextDaily = Math.max(0, Number(e.target.value) || 0);
                        const nextHourly = Math.round(nextDaily / STANDARD_WORK_HOURS_PER_DAY);
                        setFormData({
                          ...formData,
                          hourlyRate: nextHourly,
                          hourly_rate: nextHourly,
                          dailySalary: nextDaily,
                          daily_salary: nextDaily,
                          baseSalary: Math.round(nextDaily * 25),
                        });
                      }}
                      placeholder="Contoh: 135000"
                      className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-emerald-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <span className="block text-[10px] text-emerald-700 mt-1">
                      9 jam × {formatRupiah(formData.hourlyRate ?? formData.hourly_rate ?? 0)} / jam
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-slate-600 font-semibold mb-1">
                      Estimasi Bulanan (25 Hari / 225 Jam)
                    </label>
                    <input
                      type="number"
                      step={50000}
                      value={formData.baseSalary}
                      onChange={(e) => {
                        const nextBase = Math.max(0, Number(e.target.value) || 0);
                        const syncedDaily = Math.round(nextBase / 25);
                        const syncedHourly = Math.round(syncedDaily / STANDARD_WORK_HOURS_PER_DAY);
                        setFormData({
                          ...formData,
                          baseSalary: nextBase,
                          dailySalary: syncedDaily,
                          daily_salary: syncedDaily,
                          hourlyRate: syncedHourly,
                          hourly_rate: syncedHourly,
                        });
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    />
                    <span className="block text-[10px] text-slate-400 mt-1">
                      Estimasi penuh 25 hari × 9 jam kerja
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-slate-600 mb-1">Tunj. Jabatan</label>
                    <input
                      type="number"
                      value={formData.allowances?.position || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowances: {
                            ...formData.allowances!,
                            position: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-slate-600 mb-1">Tunj. Transport</label>
                    <input
                      type="number"
                      value={formData.allowances?.transport || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowances: {
                            ...formData.allowances!,
                            transport: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-slate-600 mb-1">Tunj. Uang Makan</label>
                    <input
                      type="number"
                      value={formData.allowances?.meal || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowances: {
                            ...formData.allowances!,
                            meal: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-slate-600 mb-1">Tunj. Komunikasi</label>
                    <input
                      type="number"
                      value={formData.allowances?.communication || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowances: {
                            ...formData.allowances!,
                            communication: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                {/* Pengaturan Host Live Stream & Komisi Penjualan (TikTok Shop / Shopee Live) */}
                <div className="mt-3 p-3.5 rounded-2xl border-2 border-fuchsia-200 bg-gradient-to-r from-fuchsia-50/80 via-purple-50/60 to-indigo-50/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="is_live_stream_host"
                        checked={Boolean(formData.isLiveStreamHost ?? formData.is_host)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const nextPct =
                            checked && !formData.salesCommissionPercentage
                              ? 2.5
                              : formData.salesCommissionPercentage || 0;
                          setFormData({
                            ...formData,
                            isLiveStreamHost: checked,
                            is_host: checked,
                            salesCommissionPercentage: nextPct,
                            host_commission_pct: nextPct,
                          });
                        }}
                        className="w-4 h-4 rounded text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-extrabold text-fuchsia-950 text-xs sm:text-sm flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-fuchsia-600" />
                          <span>Host Live Stream (TikTok Shop / Shopee Live)</span>
                        </span>
                        <span className="block text-[10px] text-fuchsia-800">
                          Centang jika karyawan bertugas sebagai Host Live Streaming agar mendapatkan Komisi Penjualan otomatis di Slip Gaji
                        </span>
                      </div>
                    </label>
                    {formData.isLiveStreamHost && (
                      <span className="px-2.5 py-1 rounded-full bg-fuchsia-600 text-white text-[10px] font-extrabold uppercase tracking-wider shrink-0 self-start sm:self-center">
                        Komisi Host Aktif
                      </span>
                    )}
                  </div>

                  {formData.isLiveStreamHost && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-fuchsia-200/80 animate-in fade-in">
                      <div className="p-2.5 bg-white rounded-xl border border-fuchsia-300 shadow-2xs">
                        <label className="block text-fuchsia-950 font-bold mb-1 text-xs">
                          Komisi Penjualan (%) dari Omset
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            name="sales_commission_percentage"
                            min={0}
                            max={100}
                            step={0.1}
                            value={formData.salesCommissionPercentage ?? 0}
                            onChange={(e) => {
                              const nextPct = Math.max(0, Number(e.target.value) || 0);
                              setFormData({
                                ...formData,
                                isLiveStreamHost: true,
                                is_host: true,
                                salesCommissionPercentage: nextPct,
                                host_commission_pct: nextPct,
                              });
                            }}
                            placeholder="Contoh: 2.5"
                            className="w-full p-2 pr-8 bg-fuchsia-50/40 border border-fuchsia-400 rounded-lg text-fuchsia-950 font-extrabold focus:outline-hidden focus:ring-2 focus:ring-fuchsia-500/30"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-fuchsia-700">
                            %
                          </span>
                        </div>
                        <span className="block text-[10px] text-fuchsia-700 mt-1">
                          Contoh: 2.5% × Omset Live Rp 50.000.000 ={' '}
                          <strong>
                            {formatRupiah(
                              Math.round(
                                (50000000 * (Number(formData.salesCommissionPercentage) || 0)) / 100
                              )
                            )}
                          </strong>
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded-xl border border-purple-300 shadow-2xs">
                        <label className="block text-purple-950 font-bold mb-1 text-xs">
                          Komisi per Pcs Terjual (IDR / Pcs)
                        </label>
                        <input
                          type="number"
                          name="sales_commission_per_pcs"
                          min={0}
                          step={500}
                          value={formData.salesCommissionPerPcs ?? 0}
                          onChange={(e) => {
                            const nextPcs = Math.max(0, Math.round(Number(e.target.value) || 0));
                            setFormData({
                              ...formData,
                              isLiveStreamHost: true,
                              is_host: true,
                              salesCommissionPerPcs: nextPcs,
                              host_commission_per_pcs: nextPcs,
                            });
                          }}
                          placeholder="Contoh: 2000"
                          className="w-full p-2 bg-purple-50/40 border border-purple-300 rounded-lg text-purple-950 font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                        />
                        <span className="block text-[10px] text-purple-700 mt-1">
                          Contoh: 300 Pcs ×{' '}
                          {formatRupiah(Number(formData.salesCommissionPerPcs) || 0)} ={' '}
                          <strong>
                            {formatRupiah(
                              300 * Math.round(Number(formData.salesCommissionPerPcs) || 0)
                            )}
                          </strong>
                        </span>
                      </div>

                      <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-200 flex flex-col justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-indigo-950 block">
                            Integrasi Otomatis ke Slip Gaji
                          </span>
                          <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                            Setiap omset sesi live (TikTok Shop / Shopee Live) yang dicatat di Portal Karyawan atau Admin akan otomatis dihitung ke komponen{' '}
                            <strong className="text-fuchsia-800">
                              &ldquo;Insentif / Komisi Penjualan&rdquo;
                            </strong>{' '}
                            pada Slip Gaji bulanan.
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 mt-1">
                          ✓ Real-Time masuk ke Gaji Bruto &amp; THP
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pengaturan Co-Host Live Stream & Komisi Co-Host (%) */}
                  <div className="pt-3 border-t border-fuchsia-200/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          name="is_co_host_live_stream"
                          checked={Boolean(formData.isCoHostLiveStream ?? formData.is_co_host)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const nextPct =
                              checked && !formData.coHostCommissionPercentage
                                ? 1.0
                                : formData.coHostCommissionPercentage || 0;
                            setFormData({
                              ...formData,
                              isCoHostLiveStream: checked,
                              is_co_host: checked,
                              coHostCommissionPercentage: nextPct,
                              co_host_commission_pct: nextPct,
                            });
                          }}
                          className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                        />
                        <div>
                          <span className="font-extrabold text-violet-950 text-xs sm:text-sm flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-violet-600" />
                            <span>Co-Host Live Stream (Pendamping Sesi Live)</span>
                          </span>
                          <span className="block text-[10px] text-violet-800">
                            Centang jika karyawan bertugas sebagai Co-Host Live Streaming untuk mencatat sesi live di Portal Karyawan &amp; menerima Komisi Co-Host otomatis di Slip Gaji
                          </span>
                        </div>
                      </label>
                      {formData.isCoHostLiveStream && (
                        <span className="px-2.5 py-1 rounded-full bg-violet-600 text-white text-[10px] font-extrabold uppercase tracking-wider shrink-0 self-start sm:self-center">
                          Komisi Co-Host Aktif
                        </span>
                      )}
                    </div>

                    {formData.isCoHostLiveStream && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 animate-in fade-in">
                        <div className="p-2.5 bg-white rounded-xl border border-violet-300 shadow-2xs">
                          <label className="block text-violet-950 font-bold mb-1 text-xs">
                            Komisi Co-Host (% dari Omset)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              name="co_host_commission_percentage"
                              min={0}
                              max={100}
                              step={0.1}
                              value={formData.coHostCommissionPercentage ?? 0}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  isCoHostLiveStream: true,
                                  coHostCommissionPercentage: Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  ),
                                })
                              }
                              placeholder="Contoh: 1.0"
                              className="w-full p-2 pr-8 bg-violet-50/40 border border-violet-400 rounded-lg text-violet-950 font-extrabold focus:outline-hidden focus:ring-2 focus:ring-violet-500/30"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-violet-700">
                              %
                            </span>
                          </div>
                          <span className="block text-[10px] text-violet-700 mt-1">
                            Contoh: {Number(formData.coHostCommissionPercentage) || 0}% × Omset Sesi Live Rp 50.000.000 ={' '}
                            <strong>
                              {formatRupiah(
                                Math.round(
                                  (50000000 * (Number(formData.coHostCommissionPercentage) || 0)) / 100
                                )
                              )}
                            </strong>
                          </span>
                        </div>

                        <div className="p-2.5 bg-white rounded-xl border border-violet-300 shadow-2xs">
                          <label className="block text-violet-950 font-bold mb-1 text-xs">
                            Tarif Co-Host per Pcs Tas (IDR / Pcs)
                          </label>
                          <input
                            type="number"
                            name="co_host_commission_per_pcs"
                            min={0}
                            step={500}
                            value={formData.coHostCommissionPerPcs ?? 0}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                isCoHostLiveStream: true,
                                coHostCommissionPerPcs: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0)
                                ),
                              })
                            }
                            placeholder="Contoh: 1000"
                            className="w-full p-2 bg-violet-50/40 border border-violet-300 rounded-lg text-violet-950 font-bold focus:outline-hidden focus:ring-2 focus:ring-violet-500/30"
                          />
                          <span className="block text-[10px] text-violet-700 mt-1">
                            Contoh: 300 Pcs Tas ×{' '}
                            {formatRupiah(Number(formData.coHostCommissionPerPcs) || 0)} ={' '}
                            <strong>
                              {formatRupiah(
                                300 * Math.round(Number(formData.coHostCommissionPerPcs) || 0)
                              )}
                            </strong>
                          </span>
                        </div>

                        <div className="p-2.5 bg-white/90 rounded-xl border border-violet-200 flex flex-col justify-between text-[11px]">
                          <div>
                            <span className="font-bold text-violet-950 block">
                              Transparansi Read-Only di Portal Karyawan
                            </span>
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                              Admin menginput omset &amp; jumlah tas terjual (Pcs). Co-Host melihat rincian komisi secara Read-Only dan nilainya otomatis masuk ke{' '}
                              <strong className="text-violet-800">
                                &ldquo;Insentif / Komisi Penjualan&rdquo;
                              </strong>{' '}
                              pada Slip Gaji bulanan.
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 mt-1">
                            ✓ Sinkron Real-Time ke Slip Gaji &amp; THP
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seksi 3: Bank & Pajak */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-2.5 pb-1 border-b border-slate-100">
                  3. Informasi Bank, PTKP & BPJS
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Nama Bank</label>
                    <select
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value as any })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    >
                      <option value="BCA">BCA (Bank Central Asia)</option>
                      <option value="Mandiri">Bank Mandiri</option>
                      <option value="BRI">BRI</option>
                      <option value="BNI">BNI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      value={formData.bankAccountNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, bankAccountNumber: e.target.value })
                      }
                      placeholder="1234567890"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Nama Pemilik Rekening</label>
                    <input
                      type="text"
                      value={formData.bankAccountHolder}
                      onChange={(e) =>
                        setFormData({ ...formData, bankAccountHolder: e.target.value })
                      }
                      placeholder="Nama di buku tabungan"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Status PTKP (PPh 21 TER 2026)</label>
                    <select
                      value={formData.ptkpStatus}
                      onChange={(e) =>
                        setFormData({ ...formData, ptkpStatus: e.target.value as PTKPStatus })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      <option value="TK/0">TK/0 (Tidak Kawin, 0 Tanggungan - TER A)</option>
                      <option value="TK/1">TK/1 (Tidak Kawin, 1 Tanggungan - TER A)</option>
                      <option value="TK/2">TK/2 (Tidak Kawin, 2 Tanggungan - TER B)</option>
                      <option value="TK/3">TK/3 (Tidak Kawin, 3 Tanggungan - TER B)</option>
                      <option value="K/0">K/0 (Kawin, 0 Tanggungan - TER A)</option>
                      <option value="K/1">K/1 (Kawin, 1 Tanggungan - TER B)</option>
                      <option value="K/2">K/2 (Kawin, 2 Tanggungan - TER B)</option>
                      <option value="K/3">K/3 (Kawin, 3 Tanggungan - TER C)</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600">NPWP Karyawan (15 / 16 Digit)</label>
                      {formData.ktpNumber && formData.ktpNumber.length === 16 && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              npwp: formData.ktpNumber,
                            })
                          }
                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Samakan = NIK
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.npwp}
                      onChange={(e) =>
                        setFormData({ ...formData, npwp: formatNpwpInput(e.target.value) })
                      }
                      placeholder="12.345.678.9-012.000 atau 16 digit NIK"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">No. BPJS Kesehatan</label>
                    <input
                      type="text"
                      value={formData.bpjsKesehatanNo}
                      onChange={(e) =>
                        setFormData({ ...formData, bpjsKesehatanNo: e.target.value })
                      }
                      placeholder="0001829..."
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md cursor-pointer"
                >
                  {editingEmployee ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE EMPLOYEE MODAL */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Karyawan</h3>
                <p className="text-xs text-slate-500">Tindakan ini permanen dan menghapus data karyawan</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 flex items-center gap-3">
              <img
                src={deletingEmployee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775?auto=format&fit=crop&w=256&h=256&q=80'}
                alt={deletingEmployee.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{deletingEmployee.fullName}</p>
                <p className="text-xs text-slate-600 font-mono font-medium">{deletingEmployee.nik} • {deletingEmployee.role}</p>
                <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {deletingEmployee.department}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus data karyawan <strong>{deletingEmployee.fullName}</strong>?
              Data rekam gaji (payroll) dan riwayat absensi yang terkait juga akan disinkronkan secara otomatis.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const empName = deletingEmployee.fullName;
                  const empId = deletingEmployee.id;
                  onDeleteEmployee(empId);
                  if (viewingEmployee?.id === empId) {
                    setViewingEmployee(null);
                  }
                  setDeletingEmployee(null);
                  showToast(`Data karyawan "${empName}" berhasil dihapus dari sistem.`);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Karyawan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PHOTO UPLOAD MODAL */}
      {quickPhotoEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload Pas Foto Real Karyawan
                  </h3>
                  <p className="text-xs text-slate-500">
                    {quickPhotoEmployee.fullName} • {quickPhotoEmployee.nik}
                  </p>
                </div>
              </div>
              <button
                onClick={closeQuickPhotoModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Preview Comparison */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-around">
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 font-medium block mb-1.5">Foto Saat Ini</span>
                  <img
                    src={quickPhotoEmployee.avatarUrl}
                    alt="Foto Saat Ini"
                    className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-300 mx-auto shadow-xs"
                  />
                </div>
                <div className="text-slate-300 text-sm font-semibold">➔</div>
                <div className="text-center">
                  <span className="text-[10px] text-emerald-700 font-semibold block mb-1.5 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Pratinjau Baru
                  </span>
                  <div className="relative inline-block">
                    <img
                      src={quickPhotoPreview || quickPhotoEmployee.avatarUrl}
                      alt="Pratinjau Baru"
                      className="w-16 h-16 rounded-xl object-cover ring-2 ring-emerald-500 mx-auto shadow-md"
                    />
                    {quickPhotoPreview && quickPhotoPreview.startsWith('data:image') && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                </div>
              </div>

              {quickPhotoError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quickPhotoError}</span>
                </div>
              )}

              {/* Upload Controls */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="p-3 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-900 rounded-xl font-medium cursor-pointer transition-colors flex flex-col items-center justify-center text-center gap-1">
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-xs">
                      {isCompressingQuick ? 'Memproses...' : 'Upload File Foto'}
                    </span>
                    <span className="text-[10px] text-emerald-700/80">Pilih JPG, PNG, WebP</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      disabled={isCompressingQuick}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQuickPhotoUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (isQuickCameraActive) {
                        stopQuickCamera();
                      } else {
                        startQuickCamera();
                      }
                    }}
                    className={`p-3 border rounded-xl font-medium transition-colors flex flex-col items-center justify-center text-center gap-1 cursor-pointer ${
                      isQuickCameraActive
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Camera className="w-5 h-5 text-slate-600" />
                    <span className="font-semibold text-xs">
                      {isQuickCameraActive ? 'Tutup Kamera' : 'Ambil Kamera'}
                    </span>
                    <span className="text-[10px] text-slate-500">Live webcam snap</span>
                  </button>
                </div>

                {/* Webcam Stream */}
                {isQuickCameraActive && (
                  <div className="p-3 bg-slate-900 rounded-xl text-white">
                    <div className="relative w-full max-w-xs mx-auto aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center">
                      <video
                        ref={quickVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      <div className="absolute inset-0 border-2 border-emerald-400 rounded-full scale-75 pointer-events-none opacity-80 border-dashed" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={captureQuickCamera}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Jepret Pas Foto
                      </button>
                      <button
                        type="button"
                        onClick={stopQuickCamera}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Preset Options */}
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1.5">Atau pilih foto sampel formal:</span>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_PHOTOS.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          stopQuickCamera();
                          setQuickPhotoPreview(sample.url);
                          showToast(`Foto sampel ${sample.label} dipilih!`);
                        }}
                        className={`relative p-0.5 rounded-lg border-2 transition-all cursor-pointer overflow-hidden ${
                          quickPhotoPreview === sample.url
                            ? 'border-emerald-600 ring-2 ring-emerald-400/50'
                            : 'border-slate-200 hover:border-emerald-400'
                        }`}
                        title={sample.label}
                      >
                        <img
                          src={sample.url}
                          alt={sample.label}
                          className="w-8 h-8 rounded-md object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeQuickPhotoModal}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickPhoto}
                  disabled={!quickPhotoPreview || quickPhotoPreview === quickPhotoEmployee.avatarUrl}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Pas Foto Real</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU DOKUMEN KTP / PHOTO PROFIL DI PORTAL ADMIN */}
      {adminPreviewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{adminPreviewDoc.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{adminPreviewDoc.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdminPreviewDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center max-h-[65vh]">
              <img
                src={adminPreviewDoc.imageUrl}
                alt={adminPreviewDoc.title}
                className="w-full max-h-[62vh] object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Terintegrasi dari Portal Karyawan &amp; Admin HR
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={adminPreviewDoc.imageUrl}
                  download={adminPreviewDoc.downloadFileName || 'Dokumen-Karyawan.jpg'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Dokumen</span>
                </a>
                <button
                  type="button"
                  onClick={() => setAdminPreviewDoc(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Interaktif Sesi Live Streaming & Komisi (Host / Co-Host) */}
      <LiveStreamSessionModal
        isOpen={isLiveSessionModalOpen}
        onClose={() => setIsLiveSessionModalOpen(false)}
        employees={employees}
        initialEmployeeId={liveSessionModalEmpId}
        currentPeriod="Maret 2026"
        onUpdateEmployee={(updated) => {
          onUpdateEmployee(updated);
          if (viewingEmployee && viewingEmployee.id === updated.id) {
            setViewingEmployee(updated);
          }
        }}
        onNotify={(msg) => showToast(msg)}
      />
    </div>
  );
};
