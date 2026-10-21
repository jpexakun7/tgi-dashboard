import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Clock,
  UserCheck,
  RotateCcw,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  Tag,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  X,
  Laptop,
  QrCode,
  Building2,
  Info,
  History,
  Check,
  ArrowRightLeft,
  Smartphone,
  Truck,
  Shirt,
  Layers,
} from 'lucide-react';
import {
  CompanyAsset,
  AssetCategory,
  AssetCondition,
  AssetStatus,
  AssetHistoryLog,
  Employee,
  GoogleAdminUser,
} from '../types';
import { formatRupiah } from '../utils/formatters';

interface AssetManagementViewProps {
  assets: CompanyAsset[];
  assetLogs: AssetHistoryLog[];
  employees: Employee[];
  adminUser?: GoogleAdminUser | null;
  onAddAsset: (asset: CompanyAsset) => void;
  onUpdateAsset: (asset: CompanyAsset) => void;
  onDeleteAsset: (assetId: string) => void;
  onAssignAsset: (
    assetId: string,
    employee: Employee,
    date: string,
    notes: string,
    condition: AssetCondition
  ) => void;
  onReturnAsset: (
    assetId: string,
    date: string,
    condition: AssetCondition,
    notes: string
  ) => void;
}

const CATEGORY_ICONS: Record<AssetCategory, React.ComponentType<{ className?: string }>> = {
  'Elektronik & Laptop': Laptop,
  'Peralatan Gudang & Barcode': QrCode,
  'Perangkat Kasir & POS': Smartphone,
  'Printer & Scanner Resi': Printer,
  'Kendaraan Operasional': Truck,
  'Fasilitas & Kantor': Building2,
  'Seragam & Perlengkapan Kerja': Shirt,
};

const CATEGORIES: AssetCategory[] = [
  'Elektronik & Laptop',
  'Peralatan Gudang & Barcode',
  'Perangkat Kasir & POS',
  'Printer & Scanner Resi',
  'Kendaraan Operasional',
  'Fasilitas & Kantor',
  'Seragam & Perlengkapan Kerja',
];

export const AssetManagementView: React.FC<AssetManagementViewProps> = ({
  assets,
  assetLogs,
  employees,
  adminUser,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
  onAssignAsset,
  onReturnAsset,
}) => {
  // Navigation View: 'inventory' | 'history'
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'history'>('inventory');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [assigningAsset, setAssigningAsset] = useState<CompanyAsset | null>(null);
  const [returningAsset, setReturningAsset] = useState<CompanyAsset | null>(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<CompanyAsset | null>(null);
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<CompanyAsset | null>(null);

  // Form State: Add / Edit Asset
  const [assetForm, setAssetForm] = useState({
    assetCode: '',
    serialNumber: '',
    name: '',
    category: 'Elektronik & Laptop' as AssetCategory,
    condition: 'Baik' as AssetCondition,
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: 2500000,
    status: 'Tersedia' as AssetStatus,
    warrantyExpiry: '',
    location: 'Kantor Pusat Jakarta',
    specifications: '',
    handoverConditionNotes: '',
  });

  // Form State: Assign Asset
  const [assignForm, setAssignForm] = useState({
    employeeId: employees[0]?.id || '',
    assignDate: new Date().toISOString().slice(0, 10),
    condition: 'Baik' as AssetCondition,
    notes: 'Unit diserahkan dalam kondisi lengkap dan berfungsi baik.',
  });

  // Form State: Return Asset
  const [returnForm, setReturnForm] = useState({
    returnDate: new Date().toISOString().slice(0, 10),
    condition: 'Baik' as AssetCondition,
    notes: 'Aset dikembalikan oleh karyawan dalam kondisi baik dan lengkap.',
  });

  // KPI & Highlight Calculations
  const stats = useMemo(() => {
    const totalCount = assets.length;
    const totalValuation = assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
    const assignedCount = assets.filter((a) => a.status === 'Dipinjamkan').length;
    const availableCount = assets.filter((a) => a.status === 'Tersedia').length;
    const maintenanceCount = assets.filter((a) => a.status === 'Dalam Perbaikan' || a.condition === 'Rusak').length;

    return {
      totalCount,
      totalValuation,
      assignedCount,
      availableCount,
      maintenanceCount,
    };
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchSearch =
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.assetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.serialNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.assignedToEmployeeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.assignedToEmployeeNik || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.location || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'all' || asset.category === selectedCategory;
      const matchStatus = selectedStatus === 'all' || asset.status === selectedStatus;
      const matchCondition = selectedCondition === 'all' || asset.condition === selectedCondition;

      return matchSearch && matchCategory && matchStatus && matchCondition;
    });
  }, [assets, searchQuery, selectedCategory, selectedStatus, selectedCondition]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const nextNum = String(assets.length + 1).padStart(3, '0');
    setAssetForm({
      assetCode: `TGI-AST-2026-${nextNum}`,
      serialNumber: '',
      name: '',
      category: 'Elektronik & Laptop',
      condition: 'Baik',
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchaseCost: 3500000,
      status: 'Tersedia',
      warrantyExpiry: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      location: 'Kantor Pusat Jakarta',
      specifications: '',
      handoverConditionNotes: '',
    });
    setEditingAsset(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (asset: CompanyAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      assetCode: asset.assetCode,
      serialNumber: asset.serialNumber || '',
      name: asset.name,
      category: asset.category,
      condition: asset.condition,
      purchaseDate: asset.purchaseDate,
      purchaseCost: asset.purchaseCost,
      status: asset.status,
      warrantyExpiry: asset.warrantyExpiry || '',
      location: asset.location || 'Kantor Pusat Jakarta',
      specifications: asset.specifications || '',
      handoverConditionNotes: asset.handoverConditionNotes || '',
    });
    setIsAddModalOpen(true);
  };

  // Save Asset (Create or Edit)
  const handleSubmitAssetForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name.trim() || !assetForm.assetCode.trim()) return;

    if (editingAsset) {
      const updated: CompanyAsset = {
        ...editingAsset,
        assetCode: assetForm.assetCode.trim(),
        serialNumber: assetForm.serialNumber.trim(),
        name: assetForm.name.trim(),
        category: assetForm.category,
        condition: assetForm.condition,
        purchaseDate: assetForm.purchaseDate,
        purchaseCost: Number(assetForm.purchaseCost),
        status: assetForm.status,
        warrantyExpiry: assetForm.warrantyExpiry || undefined,
        location: assetForm.location.trim(),
        specifications: assetForm.specifications.trim(),
      };
      onUpdateAsset(updated);
    } else {
      const newAsset: CompanyAsset = {
        id: `ast-${Date.now().toString().slice(-6)}`,
        assetCode: assetForm.assetCode.trim(),
        serialNumber: assetForm.serialNumber.trim() || undefined,
        name: assetForm.name.trim(),
        category: assetForm.category,
        condition: assetForm.condition,
        purchaseDate: assetForm.purchaseDate,
        purchaseCost: Number(assetForm.purchaseCost),
        status: assetForm.status,
        warrantyExpiry: assetForm.warrantyExpiry || undefined,
        location: assetForm.location.trim(),
        specifications: assetForm.specifications.trim() || undefined,
        assignedToEmployeeId: null,
        assignedToEmployeeName: null,
        assignedToEmployeeNik: null,
        assignedDate: null,
      };
      onAddAsset(newAsset);
    }

    setIsAddModalOpen(false);
    setEditingAsset(null);
  };

  // Open Assign Modal
  const handleOpenAssignModal = (asset: CompanyAsset) => {
    setAssigningAsset(asset);
    setAssignForm({
      employeeId: employees[0]?.id || '',
      assignDate: new Date().toISOString().slice(0, 10),
      condition: asset.condition,
      notes: `Penyerahan fasilitas ${asset.name} untuk operasional kerja harian.`,
    });
  };

  // Submit Assign
  const handleSubmitAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningAsset || !assignForm.employeeId) return;

    const targetEmp = employees.find((emp) => emp.id === assignForm.employeeId);
    if (!targetEmp) return;

    onAssignAsset(
      assigningAsset.id,
      targetEmp,
      assignForm.assignDate,
      assignForm.notes,
      assignForm.condition
    );

    setAssigningAsset(null);
  };

  // Open Return Modal
  const handleOpenReturnModal = (asset: CompanyAsset) => {
    setReturningAsset(asset);
    setReturnForm({
      returnDate: new Date().toISOString().slice(0, 10),
      condition: asset.condition,
      notes: `Pengembalian aset oleh ${asset.assignedToEmployeeName || 'karyawan'}.`,
    });
  };

  // Submit Return
  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningAsset) return;

    onReturnAsset(
      returningAsset.id,
      returnForm.returnDate,
      returnForm.condition,
      returnForm.notes
    );

    setReturningAsset(null);
  };

  // CSV Export for Audit and Inventory
  const handleExportCSV = () => {
    const headers = [
      'Kode Aset',
      'Nama Barang',
      'Kategori',
      'Nomor Seri',
      'Kondisi',
      'Status',
      'Penanggung Jawab (NIK)',
      'Nama Pemegang',
      'Tgl Pembelian',
      'Nilai Aset (IDR)',
      'Masa Garansi',
      'Lokasi',
    ];

    const rows = filteredAssets.map((a) => [
      `"${a.assetCode}"`,
      `"${a.name}"`,
      `"${a.category}"`,
      `"${a.serialNumber || '-'}"`,
      `"${a.condition}"`,
      `"${a.status}"`,
      `"${a.assignedToEmployeeNik || '-'}"`,
      `"${a.assignedToEmployeeName || '-'}"`,
      `"${a.purchaseDate}"`,
      `"${a.purchaseCost}"`,
      `"${a.warrantyExpiry || '-'}"`,
      `"${a.location || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventaris_Aset_TGI_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-200/60">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Manajemen Aset & Inventaris Perusahaan
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengelolaan fasilitas laptop, peralatan barcode gudang, printer resi, dan penugasan aset ke staf PT Tas Grosir Import
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Ekspor CSV Rekap Inventaris"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors cursor-pointer shadow-xs shadow-teal-700/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Aset Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Aset */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-teal-50 text-teal-700 rounded-xl shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              Total Unit Aset
            </p>
            <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.totalCount}</h3>
            <p className="text-[10px] text-teal-700 mt-0.5 font-medium">Terdaftar di sistem</p>
          </div>
        </div>

        {/* Total Valuasi Nilai Aset */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              Total Nilai Aset
            </p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate">
              {formatRupiah(stats.totalValuation)}
            </h3>
            <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">Harga pembelian buku</p>
          </div>
        </div>

        {/* Sedang Dipinjamkan */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              Dipinjamkan
            </p>
            <h3 className="text-xl font-extrabold text-indigo-700 mt-0.5">{stats.assignedCount}</h3>
            <p className="text-[10px] text-indigo-600 mt-0.5 font-medium">Dipegang staf aktif</p>
          </div>
        </div>

        {/* Tersedia di Gudang / Kantor */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              Tersedia (Ready)
            </p>
            <h3 className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.availableCount}</h3>
            <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">Siap ditugaskan</p>
          </div>
        </div>

        {/* Dalam Perbaikan / Rusak */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5 col-span-2 lg:col-span-1">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              Perlu Servis / Rusak
            </p>
            <h3 className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.maintenanceCount}</h3>
            <p className="text-[10px] text-amber-600 mt-0.5 font-medium">Dalam penanganan</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs: Inventaris vs Riwayat Log */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'inventory'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventaris Aset ({assets.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'history'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Log Riwayat Keluar-Masuk & Mutasi ({assetLogs.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Sinkronisasi otomatis dengan <strong>Audit Trail Sistem</strong>
        </div>
      </div>

      {/* SUB-TAB 1: INVENTARIS ASET TABLE */}
      {activeSubTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kode, nama aset, no seri, pemegang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-teal-500"
              />
            </div>

            {/* Filter Kategori */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
              >
                <option value="all">Semua Kategori Aset</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
              >
                <option value="all">Semua Status (Tersedia / Dipinjam)</option>
                <option value="Tersedia">Tersedia (Ready di Kantor/Gudang)</option>
                <option value="Dipinjamkan">Dipinjamkan (Dipegang Karyawan)</option>
                <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                <option value="Dihapuskan / Rusak Berat">Dihapuskan / Rusak Berat</option>
              </select>
            </div>

            {/* Filter Kondisi */}
            <div>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
              >
                <option value="all">Semua Kondisi Fisik</option>
                <option value="Baik">Kondisi Baik</option>
                <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                <option value="Rusak">Rusak</option>
              </select>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3.5">Kode & Nama Aset</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Kondisi Fisik</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Penanggung Jawab (Staf)</th>
                  <th className="py-3 px-3">Nilai Pembelian</th>
                  <th className="py-3 px-3">Lokasi / Penyimpanan</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">Tidak ada data aset yang sesuai filter.</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Coba sesuaikan kata kunci pencarian atau tambah inventaris baru.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const CatIcon = CATEGORY_ICONS[asset.category] || Boxes;
                    const isAssigned = asset.status === 'Dipinjamkan' && asset.assignedToEmployeeId;

                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Kode & Nama Aset */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                              <CatIcon className="w-4 h-4 text-teal-700" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate max-w-xs">
                                {asset.name}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded font-semibold text-slate-700">
                                  {asset.assetCode}
                                </span>
                                {asset.serialNumber && (
                                  <span className="text-[10px] text-slate-400 truncate">
                                    SN: {asset.serialNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Kategori */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                            {asset.category}
                          </span>
                        </td>

                        {/* Kondisi Fisik */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              asset.condition === 'Baik'
                                ? 'bg-emerald-100 text-emerald-800'
                                : asset.condition === 'Perlu Perbaikan'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {asset.condition === 'Baik' && <Check className="w-3 h-3" />}
                            {asset.condition === 'Perlu Perbaikan' && <AlertTriangle className="w-3 h-3" />}
                            {asset.condition === 'Rusak' && <X className="w-3 h-3" />}
                            <span>{asset.condition}</span>
                          </span>
                        </td>

                        {/* Status Aset */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              asset.status === 'Tersedia'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : asset.status === 'Dipinjamkan'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : asset.status === 'Dalam Perbaikan'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {asset.status === 'Dipinjamkan' ? (
                              <UserCheck className="w-3 h-3 text-indigo-600" />
                            ) : asset.status === 'Tersedia' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Wrench className="w-3 h-3 text-amber-600" />
                            )}
                            <span>{asset.status}</span>
                          </span>
                        </td>

                        {/* Penanggung Jawab Karyawan */}
                        <td className="py-3 px-3">
                          {isAssigned ? (
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 block truncate max-w-[140px]">
                                {asset.assignedToEmployeeName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 block truncate">
                                NIK: {asset.assignedToEmployeeNik || '-'}
                              </span>
                              {asset.assignedDate && (
                                <span className="text-[10px] text-slate-400 block">
                                  Sejak {asset.assignedDate}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              Belum ditugaskan (Ready)
                            </span>
                          )}
                        </td>

                        {/* Nilai Pembelian */}
                        <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800">
                          {formatRupiah(asset.purchaseCost)}
                        </td>

                        {/* Lokasi */}
                        <td className="py-3 px-3 max-w-[150px] truncate text-slate-600" title={asset.location}>
                          {asset.location || '-'}
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {/* Tombol Tugaskan ke Karyawan (jika tersedia atau mau re-assign) */}
                            {asset.status === 'Tersedia' ? (
                              <button
                                onClick={() => handleOpenAssignModal(asset)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg border border-teal-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Tugaskan aset ini ke karyawan aktif"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Tugaskan</span>
                              </button>
                            ) : asset.status === 'Dipinjamkan' ? (
                              <button
                                onClick={() => handleOpenReturnModal(asset)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Catat pengembalian aset dari staf"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Kembalikan</span>
                              </button>
                            ) : null}

                            {/* Detail / Info */}
                            <button
                              onClick={() => setSelectedAssetDetail(asset)}
                              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Lihat Detail Lengkap Aset"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(asset)}
                              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Data Aset"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setConfirmDeleteAsset(asset)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Aset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* SUB-TAB 2: LOG RIWAYAT & MUTASI ASET */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Log Riwayat Keluar-Masuk & Mutasi Aset Kantor
              </h3>
              <p className="text-xs text-slate-500">
                Catatan kronologis setiap penyerahan inventaris, pengembalian oleh karyawan, perbaikan service, dan pengadaan baru
              </p>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 bg-teal-50 text-teal-800 rounded-lg border border-teal-200">
              {assetLogs.length} Aktivitas Log Tercatat
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3.5">Tanggal Mutasi</th>
                  <th className="py-3 px-3">Tindakan / Aktivitas</th>
                  <th className="py-3 px-3">Kode & Nama Aset</th>
                  <th className="py-3 px-3">Karyawan Terkait (Staf)</th>
                  <th className="py-3 px-3">Kondisi Barang</th>
                  <th className="py-3 px-3">Catatan / Keterangan Penyerahan</th>
                  <th className="py-3 px-3">Admin Pelaksana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assetLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Belum ada riwayat mutasi aset yang tercatat.
                    </td>
                  </tr>
                ) : (
                  assetLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {log.date}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.action === 'Penyerahan / Pinjam'
                              ? 'bg-indigo-100 text-indigo-800'
                              : log.action === 'Pengembalian'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'Mulai Perbaikan' || log.action === 'Penggantian / Rusak'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 block truncate max-w-xs">
                          {log.assetName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {log.assetCode}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {log.employeeName ? (
                          <div>
                            <span className="font-semibold text-slate-800 block truncate">
                              {log.employeeName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              NIK: {log.employeeNik || '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.condition === 'Baik'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.condition === 'Perlu Perbaikan'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {log.condition}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={log.notes}>
                        {log.notes || '-'}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-medium">
                        {log.adminName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: FORM TAMBAH / EDIT ASET */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAsset ? 'Edit Data Inventaris Aset' : 'Tambah Aset Inventaris Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssetForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode / ID Aset <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TGI-AST-2026-011"
                    value={assetForm.assetCode}
                    onChange={(e) => setAssetForm({ ...assetForm, assetCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Seri (Serial Number)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: SN-889102X"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Aset / Inventaris <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Laptop ThinkPad T14 / Barcode Scanner Honeywell"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Barang *</label>
                  <select
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kondisi Fisik Saat Ini *</label>
                  <select
                    value={assetForm.condition}
                    onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold"
                  >
                    <option value="Baik">Baik (Normal / Mulus)</option>
                    <option value="Perlu Perbaikan">Perlu Perbaikan (Minor Kendala)</option>
                    <option value="Rusak">Rusak (Tidak Berfungsi)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nilai / Harga Aset (Rp) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    required
                    value={assetForm.purchaseCost}
                    onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Aset *</label>
                  <select
                    value={assetForm.status}
                    onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  >
                    <option value="Tersedia">Tersedia (Ready di Kantor/Gudang)</option>
                    <option value="Dipinjamkan">Dipinjamkan ke Karyawan</option>
                    <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                    <option value="Dihapuskan / Rusak Berat">Dihapuskan / Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Pembelian *</label>
                  <input
                    type="date"
                    required
                    value={assetForm.purchaseDate}
                    onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Masa Garansi Berakhir</label>
                  <input
                    type="date"
                    value={assetForm.warrantyExpiry}
                    onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Penyimpanan / Penempatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Sentra Gudang Hayam Wuruk / Meja Packing / Kantor Pusat"
                  value={assetForm.location}
                  onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Spesifikasi & Keterangan Barang</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Core i7 16GB RAM, charger original Type-C, tas laptop bawaan..."
                  value={assetForm.specifications}
                  onChange={(e) => setAssetForm({ ...assetForm, specifications: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {editingAsset ? 'Simpan Perubahan Aset' : 'Daftarkan Aset Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TUGASKAN ASET KE KARYAWAN (ASSIGNMENT) */}
      {assigningAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tugaskan Aset ke Karyawan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kaitkan inventaris kantor langsung ke NIK dan nama karyawan aktif
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningAsset(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Asset Summary Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{assigningAsset.name}</span>
                <span className="font-mono text-teal-700 font-bold">{assigningAsset.assetCode}</span>
              </div>
              <div className="text-slate-500 flex items-center justify-between text-[11px]">
                <span>Kategori: {assigningAsset.category}</span>
                <span>Nilai: {formatRupiah(assigningAsset.purchaseCost)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitAssign} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Karyawan Penerima Tanggung Jawab *
                </label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-medium"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} (NIK: {emp.nik}) - {emp.role} [{emp.department}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Penyerahan *
                  </label>
                  <input
                    type="date"
                    required
                    value={assignForm.assignDate}
                    onChange={(e) => setAssignForm({ ...assignForm, assignDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kondisi Saat Diserahkan *
                  </label>
                  <select
                    value={assignForm.condition}
                    onChange={(e) => setAssignForm({ ...assignForm, condition: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  >
                    <option value="Baik">Baik (Normal / Mulus)</option>
                    <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Serah Terima / Kelengkapan Aksesoris *
                </label>
                <textarea
                  required
                  rows={3}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  placeholder="Sebutkan kelengkapan yang diserahkan: charger, tas, mouse, dll..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-[11px] space-y-1">
                <span className="font-semibold block flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Pencatatan Resmi Perusahaan:
                </span>
                <p>
                  Aset ini akan muncul di profil kepegawaian staf dan tercatat di portal karyawan miliknya. Mutasi penyerahan akan otomatis tercatat ke dalam Audit Trail.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningAsset(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Konfirmasi Penugasan Aset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PENGEMBALIAN ASET (RETURN) */}
      {returningAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Catat Pengembalian Aset
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proses pengembalian inventaris dari karyawan ke pihak perusahaan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReturningAsset(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Asset info */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{returningAsset.name}</span>
                <span className="font-mono text-teal-700 font-bold">{returningAsset.assetCode}</span>
              </div>
              <div className="text-slate-600">
                Peminjam: <strong>{returningAsset.assignedToEmployeeName}</strong> (NIK: {returningAsset.assignedToEmployeeNik})
              </div>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Pengembalian *
                  </label>
                  <input
                    type="date"
                    required
                    value={returnForm.returnDate}
                    onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kondisi Fisik Saat Dikembalikan *
                  </label>
                  <select
                    value={returnForm.condition}
                    onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold"
                  >
                    <option value="Baik">Baik (Lengkap & Normal)</option>
                    <option value="Perlu Perbaikan">Perlu Perbaikan (Ada Kerusakan Kecil)</option>
                    <option value="Rusak">Rusak / Tidak Berfungsi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Pengembalian / Pemeriksaan Fisik *
                </label>
                <textarea
                  required
                  rows={3}
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Catatan kondisi saat diterima: kelengkapan charger, kondisi fisik layar, kelayakan fungsi..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturningAsset(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Konfirmasi Pengembalian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DETAIL LENGKAP ASET */}
      {selectedAssetDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Detail Inventaris Aset Perusahaan
                  </h3>
                  <span className="font-mono text-xs text-teal-700 font-bold">
                    {selectedAssetDetail.assetCode}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAssetDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{selectedAssetDetail.name}</h4>
                    <span className="text-slate-500 text-[11px]">{selectedAssetDetail.category}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAssetDetail.status === 'Tersedia'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedAssetDetail.status === 'Dipinjamkan'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedAssetDetail.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Nomor Seri:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedAssetDetail.serialNumber || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Kondisi Fisik:</span>
                    <span className="font-semibold text-slate-800">{selectedAssetDetail.condition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tanggal Beli:</span>
                    <span className="text-slate-700">{selectedAssetDetail.purchaseDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Harga / Nilai:</span>
                    <span className="font-bold text-slate-900">
                      {formatRupiah(selectedAssetDetail.purchaseCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Masa Garansi:</span>
                    <span className="text-slate-700">{selectedAssetDetail.warrantyExpiry || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Lokasi:</span>
                    <span className="text-slate-700">{selectedAssetDetail.location || '-'}</span>
                  </div>
                </div>

                {selectedAssetDetail.specifications && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 block text-[10px]">Spesifikasi Teknis:</span>
                    <p className="text-slate-700 mt-0.5">{selectedAssetDetail.specifications}</p>
                  </div>
                )}
              </div>

              {/* Assignment Details */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="font-semibold text-slate-800 block text-xs flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                  Status Penugasan Karyawan:
                </span>
                {selectedAssetDetail.assignedToEmployeeId ? (
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <p>
                      Dipegang oleh:{' '}
                      <strong className="text-slate-900">
                        {selectedAssetDetail.assignedToEmployeeName}
                      </strong>{' '}
                      (NIK: {selectedAssetDetail.assignedToEmployeeNik})
                    </p>
                    <p>Diserahkan sejak: {selectedAssetDetail.assignedDate}</p>
                    {selectedAssetDetail.handoverConditionNotes && (
                      <p className="italic text-slate-500">
                        Catatan serah terima: &ldquo;{selectedAssetDetail.handoverConditionNotes}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Aset saat ini belum dipinjamkan dan tersedia di lokasi penyimpanan.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedAssetDetail(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFIRM DELETE ASET */}
      {confirmDeleteAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Hapus Inventaris Aset?</h4>
                <p className="text-xs text-slate-500">Tindakan ini akan tercatat dalam audit log.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus data inventaris{' '}
              <strong>{confirmDeleteAsset.name}</strong> ({confirmDeleteAsset.assetCode})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmDeleteAsset(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteAsset(confirmDeleteAsset.id);
                  setConfirmDeleteAsset(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Ya, Hapus Aset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
