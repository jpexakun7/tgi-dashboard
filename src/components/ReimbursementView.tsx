import React, { useState, useRef, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Upload,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  Camera,
  RotateCcw,
  Trash2,
  X,
  CreditCard,
  Building,
  User,
  Calendar,
  FileText,
  DollarSign,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Employee,
  ReimbursementClaim,
  ReimbursementCategory,
  ReimbursementStatus,
} from '../types';
import { formatRupiah, formatIndoDate } from '../utils/formatters';
import { validateImageFile, compressImage } from '../utils/imageUtils';

interface ReimbursementViewProps {
  employees: Employee[];
  reimbursements: ReimbursementClaim[];
  onAddReimbursement: (claim: ReimbursementClaim) => void;
  onUpdateReimbursement: (claim: ReimbursementClaim) => void;
  onDeleteReimbursement: (id: string) => void;
  onImportReimbursements: (claims: ReimbursementClaim[]) => void;
  adminEmail?: string;
}

const CATEGORIES: ReimbursementCategory[] = [
  'Transport & Bensin',
  'Parkir & Tol',
  'Makan Lembur & Konsumsi',
  'Operasional Toko & Gudang',
  'Pengiriman & Ekspedisi',
  'Medis & Rawat Jalan',
  'Perlengkapan Kantor (ATK)',
  'Promosi & Iklan',
  'Komunikasi & Pulsa',
  'Lain-lain',
];

export const ReimbursementView: React.FC<ReimbursementViewProps> = ({
  employees,
  reimbursements,
  onAddReimbursement,
  onUpdateReimbursement,
  onDeleteReimbursement,
  onImportReimbursements,
  adminEmail,
}) => {
  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewReceiptClaim, setPreviewReceiptClaim] = useState<ReimbursementClaim | null>(null);
  const [rejectingClaim, setRejectingClaim] = useState<ReimbursementClaim | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Claim Form State
  const [formEmployeeId, setFormEmployeeId] = useState<string>(employees[0]?.id || '');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<ReimbursementCategory>('Transport & Bensin');
  const [formAmount, setFormAmount] = useState<number>(150000);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'Transfer Bank' | 'Payroll Bersama Gaji' | 'Kas Kecil (Petty Cash)'>('Transfer Bank');
  const [formPhotoPreview, setFormPhotoPreview] = useState<string>('');
  const [formFileName, setFormFileName] = useState<string>('');
  const [formPhotoError, setFormPhotoError] = useState<string | null>(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Import State
  const [importedRows, setImportedRows] = useState<Partial<ReimbursementClaim>[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [deleteConfirmClaimId, setDeleteConfirmClaimId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3500);
  };

  // KPI Metrics Calculation
  const totalClaimsCount = reimbursements.length;
  const pendingClaims = reimbursements.filter((r) => r.status === 'Menunggu Persetujuan');
  const pendingAmount = pendingClaims.reduce((sum, r) => sum + r.amount, 0);

  const approvedClaims = reimbursements.filter((r) => r.status === 'Disetujui' || r.status === 'Dibayarkan');
  const approvedAmount = approvedClaims.reduce((sum, r) => sum + r.amount, 0);

  const disbursedClaims = reimbursements.filter((r) => r.status === 'Dibayarkan');
  const disbursedAmount = disbursedClaims.reduce((sum, r) => sum + r.amount, 0);

  // Filtered List
  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter((claim) => {
      const emp = employees.find((e) => e.id === claim.employeeId);
      const matchesSearch =
        search === '' ||
        claim.claimNumber.toLowerCase().includes(search.toLowerCase()) ||
        claim.description.toLowerCase().includes(search.toLowerCase()) ||
        claim.receiptNumber?.toLowerCase().includes(search.toLowerCase()) ||
        emp?.fullName.toLowerCase().includes(search.toLowerCase()) ||
        emp?.nik.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = selectedStatus === 'ALL' || claim.status === selectedStatus;
      const matchesCategory = selectedCategory === 'ALL' || claim.category === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [reimbursements, employees, search, selectedStatus, selectedCategory]);

  // Camera Functions
  const startCamera = async () => {
    setFormPhotoError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFormPhotoError('Kamera tidak didukung oleh browser Anda.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 800 }, height: { ideal: 800 }, facingMode: 'environment' },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error('Camera error', err);
      setFormPhotoError('Gagal mengakses kamera. Berikan izin kamera browser.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setFormPhotoPreview(dataUrl);
    setFormFileName(`Foto_Struk_${Date.now()}.jpg`);
    stopCamera();
    showToast('Foto struk berhasil diambil dari kamera!');
  };

  // Handle Photo File Upload
  const handlePhotoUpload = async (file: File) => {
    setFormPhotoError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormPhotoError(validation.error || 'File gambar tidak valid');
      return;
    }
    try {
      const compressed = await compressImage(file, 800, 800, 0.85);
      setFormPhotoPreview(compressed);
      setFormFileName(file.name);
      showToast('Foto struk berhasil diunggah!');
    } catch (e) {
      setFormPhotoError('Gagal memproses gambar struk.');
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    stopCamera();
    setFormEmployeeId(employees[0]?.id || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory('Transport & Bensin');
    setFormAmount(150000);
    setFormDescription('');
    setFormReceiptNumber('');
    setFormPaymentMethod('Transfer Bank');
    setFormPhotoPreview('');
    setFormFileName('');
    setFormPhotoError(null);
    setIsAddModalOpen(true);
  };

  // Submit New Claim
  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription || formAmount <= 0) {
      setFormPhotoError('Lengkapi rincian keterangan dan nominal klaim.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const claimSeq = String(reimbursements.length + 1).padStart(3, '0');
    const newClaimNumber = `RMB-${currentYear}-${currentMonth}-${claimSeq}`;

    const newClaim: ReimbursementClaim = {
      id: `rmb-${Date.now()}`,
      claimNumber: newClaimNumber,
      employeeId: formEmployeeId,
      date: formDate,
      category: formCategory,
      amount: formAmount,
      description: formDescription,
      receiptNumber: formReceiptNumber || undefined,
      receiptPhotoUrl: formPhotoPreview || undefined,
      receiptFileName: formFileName || undefined,
      receiptFileType: 'image',
      status: 'Menunggu Persetujuan',
      appliedAt: `${formDate} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
      paymentMethod: formPaymentMethod,
    };

    onAddReimbursement(newClaim);
    setIsAddModalOpen(false);
    stopCamera();
    showToast(`Pengajuan reimbursement ${newClaimNumber} berhasil dibuat!`);
  };

  // Approve Claim
  const handleApprove = (claim: ReimbursementClaim) => {
    const updated: ReimbursementClaim = {
      ...claim,
      status: 'Disetujui',
      approvedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
      approvedBy: adminEmail ? `Admin (${adminEmail})` : 'Admin Keuangan TGI',
    };
    onUpdateReimbursement(updated);
    showToast(`Klaim ${claim.claimNumber} disetujui!`);
  };

  // Reject Claim
  const handleReject = () => {
    if (!rejectingClaim) return;
    const updated: ReimbursementClaim = {
      ...rejectingClaim,
      status: 'Ditolak',
      rejectionReason: rejectReason || 'Bukti kuitansi atau keperluan tidak memenuhi kriteria perusahaan',
    };
    onUpdateReimbursement(updated);
    setRejectingClaim(null);
    setRejectReason('');
    showToast(`Klaim ${rejectingClaim.claimNumber} ditolak.`);
  };

  // Mark Disbursed
  const handleMarkDisbursed = (claim: ReimbursementClaim) => {
    const updated: ReimbursementClaim = {
      ...claim,
      status: 'Dibayarkan',
      disbursedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
    };
    onUpdateReimbursement(updated);
    showToast(`Klaim ${claim.claimNumber} ditandai lunas dibayarkan!`);
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const exportRows = filteredReimbursements.map((c) => {
      const emp = employees.find((e) => e.id === c.employeeId);
      return {
        'No. Klaim': c.claimNumber,
        'Tanggal': c.date,
        'Nama Karyawan': emp?.fullName || 'N/A',
        'NIK': emp?.nik || 'N/A',
        'Departemen': emp?.department || 'N/A',
        'Kategori': c.category,
        'Nominal (IDR)': c.amount,
        'Keterangan Keperluan': c.description,
        'No. Struk/Kuitansi': c.receiptNumber || '-',
        'Status': c.status,
        'Waktu Pengajuan': c.appliedAt,
        'Disetujui Oleh': c.approvedBy || '-',
        'Metode Pembayaran': c.paymentMethod || 'Transfer Bank',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reimbursement');
    XLSX.writeFile(workbook, `TGI_Laporan_Reimbursement_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Laporan reimbursement berhasil diunduh ke Excel (.xlsx)!');
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'NIK': 'TGI-2023-062',
        'Tanggal (YYYY-MM-DD)': '2026-10-08',
        'Kategori': 'Transport & Bensin',
        'Nominal': 250000,
        'Keterangan Keperluan': 'BBM Solar truk pengiriman tas grosir ke ekspedisi kargo',
        'Nomor Struk': 'SPBU-34-9981',
      },
      {
        'NIK': 'TGI-2022-014',
        'Tanggal (YYYY-MM-DD)': '2026-10-08',
        'Kategori': 'Perlengkapan Kantor (ATK)',
        'Nominal': 180000,
        'Keterangan Keperluan': 'Kertas struk kasir thermal 10 roll dan pulpen kantor',
        'Nomor Struk': 'ATK-7712',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Klaim');
    XLSX.writeFile(workbook, 'Template_Impor_Reimbursement_TGI.xlsx');
    showToast('Template Excel berhasil diunduh!');
  };

  // Handle Excel / CSV File Import
  const handleImportFile = (file: File) => {
    setImportError(null);
    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          setImportError('File Excel/CSV kosong atau format tidak sesuai.');
          return;
        }

        const parsedClaims: ReimbursementClaim[] = [];
        const currentYear = new Date().getFullYear();
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

        rawJson.forEach((row, idx) => {
          // Flexible key lookup
          const nik = row['NIK'] || row['nik'] || row['No Induk'] || '';
          const emp = employees.find((e) => e.nik.toLowerCase() === String(nik).trim().toLowerCase()) || employees[0];
          const date = row['Tanggal (YYYY-MM-DD)'] || row['Tanggal'] || row['date'] || new Date().toISOString().split('T')[0];
          const rawCat = row['Kategori'] || row['category'] || 'Operasional Toko & Gudang';
          const category = CATEGORIES.includes(rawCat as any) ? (rawCat as ReimbursementCategory) : 'Operasional Toko & Gudang';
          const amount = Number(row['Nominal'] || row['Nominal (IDR)'] || row['amount'] || 0);
          const description = row['Keterangan Keperluan'] || row['Keterangan'] || row['Deskripsi'] || 'Klaim operasional diimpor via Excel';
          const receiptNumber = row['Nomor Struk'] || row['No Struk'] || row['receipt'] || `IMP-${idx + 1}`;

          if (amount > 0) {
            parsedClaims.push({
              id: `rmb-import-${Date.now()}-${idx}`,
              claimNumber: `RMB-${currentYear}-${currentMonth}-${String(reimbursements.length + idx + 1).padStart(3, '0')}`,
              employeeId: emp.id,
              date: String(date),
              category,
              amount,
              description: String(description),
              receiptNumber: String(receiptNumber),
              receiptFileName: file.name,
              receiptFileType: 'excel',
              status: 'Menunggu Persetujuan',
              appliedAt: `${date} 09:00 WIB`,
              paymentMethod: 'Transfer Bank',
            });
          }
        });

        if (parsedClaims.length === 0) {
          setImportError('Tidak ada baris data reimbursement yang valid di file.');
          return;
        }

        setImportedRows(parsedClaims);
        showToast(`${parsedClaims.length} klaim reimbursement berhasil dibaca dari file!`);
      } catch (err) {
        console.error('Import parse error:', err);
        setImportError('Gagal membaca file Excel/CSV. Pastikan format kolom sesuai template.');
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    if (importedRows.length === 0) return;
    onImportReimbursements(importedRows as ReimbursementClaim[]);
    setIsImportModalOpen(false);
    setImportedRows([]);
    setImportFileName('');
    showToast(`Berhasil menambahkan ${importedRows.length} data klaim reimbursement!`);
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
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              Klaim Penggantian Biaya Operasional (Reimbursement)
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Kelola Klaim Reimbursement & Bukti Struk Karyawan
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Verifikasi pengajuan biaya operasional, transportasi, makan lembur, pengiriman ekspedisi tas, dan unggah bukti foto struk/bon serta berkas Excel/CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Impor Excel / CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-300" />
              Ekspor Excel (.xlsx)
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Plus className="w-4 h-4" />
              Ajukan Klaim Baru
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pengajuan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Klaim Diajukan
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalClaimsCount}
            </h3>
            <span className="text-xs text-slate-500 font-medium">Transaksi</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Total tercatat di sistem penggajian
          </p>
        </div>

        {/* Menunggu Persetujuan */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Menunggu ACC
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-amber-800">
              {formatRupiah(pendingAmount)}
            </h3>
            <p className="mt-1 text-xs font-bold text-amber-700">
              {pendingClaims.length} klaim perlu tindakan admin
            </p>
          </div>
        </div>

        {/* Disetujui */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Total Disetujui
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-800">
              {formatRupiah(approvedAmount)}
            </h3>
            <p className="mt-1 text-xs text-emerald-700 font-medium">
              {approvedClaims.length} klaim disetujui
            </p>
          </div>
        </div>

        {/* Dibayarkan */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Lunas Dibayarkan
            </span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-blue-800">
              {formatRupiah(disbursedAmount)}
            </h3>
            <p className="mt-1 text-xs text-blue-700 font-medium">
              {disbursedClaims.length} klaim telah ditransfer
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari no. klaim, nama staf, keterangan, no struk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="Menunggu Persetujuan">Menunggu Persetujuan ({pendingClaims.length})</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Dibayarkan">Dibayarkan</option>
            <option value="Ditolak">Ditolak</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">Semua Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reimbursement Claims Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Klaim & Karyawan</th>
                <th className="py-3 px-4">Tanggal & Kategori</th>
                <th className="py-3 px-4">Keterangan Biaya</th>
                <th className="py-3 px-4">Nominal Klaim</th>
                <th className="py-3 px-4">Bukti Struk / Berkas</th>
                <th className="py-3 px-4">Status & Metode</th>
                <th className="py-3 px-4 text-center">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReimbursements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada klaim reimbursement yang cocok.</p>
                    <p className="text-[11px] mt-0.5">Ubah filter atau ajukan klaim baru.</p>
                  </td>
                </tr>
              ) : (
                filteredReimbursements.map((claim) => {
                  const emp = employees.find((e) => e.id === claim.employeeId);
                  return (
                    <tr key={claim.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Klaim & Karyawan */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={emp?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
                            alt={emp?.fullName}
                            className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                          />
                          <div>
                            <span className="font-semibold text-slate-900 block text-xs">
                              {emp?.fullName || 'Staf'}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-mono">{claim.claimNumber}</span>
                              <span>•</span>
                              <span>{emp?.department}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tanggal & Kategori */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">
                          {formatIndoDate(claim.date)}
                        </span>
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold">
                          {claim.category}
                        </span>
                      </td>

                      {/* Keterangan Biaya */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-800 line-clamp-2 leading-relaxed font-medium">
                          {claim.description}
                        </p>
                        {claim.receiptNumber && (
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            No. Struk: {claim.receiptNumber}
                          </span>
                        )}
                      </td>

                      {/* Nominal Klaim */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatRupiah(claim.amount)}
                        </span>
                      </td>

                      {/* Bukti Struk / Berkas */}
                      <td className="py-3 px-4">
                        {claim.receiptPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptClaim(claim)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold border border-indigo-200 cursor-pointer transition-all"
                            title="Klik untuk melihat foto struk"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Foto Struk</span>
                          </button>
                        ) : claim.receiptFileName ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                            {claim.receiptFileName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Tanpa Berkas</span>
                        )}
                      </td>

                      {/* Status & Metode */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            claim.status === 'Disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : claim.status === 'Dibayarkan'
                              ? 'bg-blue-100 text-blue-800'
                              : claim.status === 'Ditolak'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {claim.status}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-1">
                          {claim.paymentMethod || 'Transfer Bank'}
                        </span>
                        {claim.rejectionReason && (
                          <span className="text-[10px] text-rose-600 block mt-0.5 max-w-[150px] truncate" title={claim.rejectionReason}>
                            Alasan: {claim.rejectionReason}
                          </span>
                        )}
                      </td>

                      {/* Tindakan Admin */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {claim.status === 'Menunggu Persetujuan' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(claim)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Setujui Reimbursement"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>ACC</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingClaim(claim);
                                  setRejectReason('');
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Tolak Reimbursement"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Tolak</span>
                              </button>
                            </>
                          )}

                          {claim.status === 'Disetujui' && (
                            <button
                              type="button"
                              onClick={() => handleMarkDisbursed(claim)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Tandai Sudah Ditransfer / Dibayar"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Bayar</span>
                            </button>
                          )}

                          {deleteConfirmClaimId === claim.id ? (
                            <div className="flex items-center gap-1 animate-fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteReimbursement(claim.id);
                                  setDeleteConfirmClaimId(null);
                                  showToast(`Klaim ${claim.claimNumber} berhasil dihapus.`);
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmClaimId(null)}
                                className="px-1.5 py-1 text-[10px] text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmClaimId(claim.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hapus Klaim"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* MODAL: AJUKAN REIMBURSEMENT BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pengajuan Klaim Reimbursement Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Unggah struk atau kuitansi untuk diverifikasi oleh admin keuangan PT Tas Grosir Import.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIsAddModalOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Karyawan Pemohon</label>
                  <select
                    value={formEmployeeId}
                    onChange={(e) => setFormEmployeeId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer font-medium"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.nik} - {emp.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tanggal Transaksi / Nota</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Kategori Biaya</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ReimbursementCategory)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Nominal Biaya (IDR)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Nomor Struk / Kuitansi</label>
                  <input
                    type="text"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    placeholder="e.g. SPBU-1294 / EXP-889"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Keterangan / Keperluan Operasional</label>
                <textarea
                  required
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Jelaskan keperluan pengeluaran (misal: Bensin armada antar tas grosir, makan lembur packing)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              {/* UPLOAD FOTO BUKTI STRUK / BON */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Upload Foto Bukti Struk / Bon Pembayaran
                  </span>
                  <span className="text-[11px] text-slate-400">JPG, PNG, WebP</span>
                </div>

                {formPhotoError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formPhotoError}</span>
                  </div>
                )}

                {/* Camera Viewfinder if Active */}
                {isCameraActive && (
                  <div className="p-3 bg-slate-900 rounded-xl text-white">
                    <div className="relative w-full max-w-xs mx-auto aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={captureCamera}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Jepret Foto Struk
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview or Upload buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {formPhotoPreview ? (
                    <div className="relative w-24 h-28 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm shrink-0 group">
                      <img
                        src={formPhotoPreview}
                        alt="Preview Struk"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormPhotoPreview('');
                          setFormFileName('');
                        }}
                        className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-28 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <Receipt className="w-6 h-6 mb-1 text-slate-300" />
                      <span className="text-[10px]">Belum Ada</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap gap-2">
                      <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih Foto dari Galeri</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handlePhotoUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-slate-600" />
                        <span>Ambil dari Kamera</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {formFileName ? `Berkas terpilih: ${formFileName}` : 'Pastikan nominal, tanggal, dan nama toko pada struk terlihat jelas.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Metode Penggantian yang Diinginkan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Transfer Bank', 'Payroll Bersama Gaji', 'Kas Kecil (Petty Cash)'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setFormPaymentMethod(method)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-medium ${
                        formPaymentMethod === method
                          ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 font-bold'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setIsAddModalOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  Ajukan Reimbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPOR EXCEL / CSV / XLS */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Impor Data Reimbursement (Excel / CSV / XLS)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Unggah lembar kerja berisi daftar klaim pengeluaran staf untuk diproses serentak.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedRows([]);
                  setImportFileName('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Instructions and Download Template */}
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-emerald-900 mb-0.5">Format Template Kolom Excel:</h4>
                  <p className="text-emerald-800 text-[11px]">
                    Kolom yang didukung: <strong>NIK, Tanggal, Kategori, Nominal, Keterangan, Nomor Struk</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImportFile(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="excelFileInput" className="cursor-pointer block">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <p className="font-bold text-slate-800 text-sm">
                    {importFileName ? importFileName : 'Klik atau seret file .xlsx / .xls / .csv ke sini'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mendukung berkas Microsoft Excel dan CSV dari sistem kasir atau rekonsiliasi bank.
                  </p>
                </label>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview of Imported Rows */}
              {importedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Pratinjau Data ({importedRows.length} Baris Klaim):
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      Total Nominal: {formatRupiah(importedRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2">Karyawan</th>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Kategori</th>
                          <th className="p-2">Nominal</th>
                          <th className="p-2">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importedRows.map((row, idx) => {
                          const emp = employees.find((e) => e.id === row.employeeId);
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-medium text-slate-900">{emp?.fullName || 'Staf'}</td>
                              <td className="p-2">{row.date}</td>
                              <td className="p-2">{row.category}</td>
                              <td className="p-2 font-bold text-emerald-700">{formatRupiah(row.amount || 0)}</td>
                              <td className="p-2 truncate max-w-[200px]">{row.description}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportedRows([]);
                    setImportFileName('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={importedRows.length === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  Konfirmasi & Tambahkan {importedRows.length} Klaim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW FOTO STRUK / LIGHTBOX */}
      {previewReceiptClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Bukti Struk: {previewReceiptClaim.claimNumber}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {previewReceiptClaim.description} • {formatRupiah(previewReceiptClaim.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptClaim(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center bg-slate-100 rounded-xl p-2 overflow-hidden max-h-[65vh]">
              {previewReceiptClaim.receiptPhotoUrl ? (
                <img
                  src={previewReceiptClaim.receiptPhotoUrl}
                  alt="Bukti Struk"
                  className="max-h-[60vh] w-auto object-contain rounded-lg shadow-sm"
                />
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Receipt className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>Tidak ada foto struk terlampir.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                No. Nota: <strong>{previewReceiptClaim.receiptNumber || '-'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPreviewReceiptClaim(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALASAN PENOLAKAN KLAIM */}
      {rejectingClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-rose-700">
                <XCircle className="w-4 h-4" />
                Tolak Pengajuan Reimbursement
              </h3>
              <button
                type="button"
                onClick={() => setRejectingClaim(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3 text-xs">
              <p className="text-slate-600">
                Anda akan menolak klaim <strong>{rejectingClaim.claimNumber}</strong> ({formatRupiah(rejectingClaim.amount)}). Masukkan alasan penolakan untuk karyawan:
              </p>

              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Foto struk buram tidak terbaca, pengeluaran di luar jam operasional, atau melebihi batas plafon..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingClaim(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Konfirmasi Tolak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
