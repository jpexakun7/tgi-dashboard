import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  X,
  Server,
  ShieldCheck,
  Sparkles,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Receipt,
  Users,
  Boxes,
  WalletCards,
  Award,
  Sliders,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';
import {
  SUPABASE_URL,
  SUPABASE_SQL_SCHEMA,
} from '../lib/supabase';
import { SupabaseSyncStatus } from '../services/supabaseService';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SupabaseSyncStatus;
  onRefreshStatus: () => void;
  onTriggerSeed: () => Promise<void>;
  isSeeding: boolean;
  employeeCount: number;
  assetCount: number;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onRefreshStatus,
  onTriggerSeed,
  isSeeding,
  employeeCount,
  assetCount,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sql'>('status');

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const tableList = [
    { key: 'employees', label: 'Data Karyawan', icon: Users, isReady: syncStatus.tableDetails?.employees ?? syncStatus.isTablesCreated },
    { key: 'attendances', label: 'Presensi / Absensi', icon: CalendarCheck2, isReady: syncStatus.tableDetails?.attendances ?? false },
    { key: 'tgi_employee_bonuses', label: 'Manajemen Bonus', icon: Award, isReady: syncStatus.tableDetails?.tgi_employee_bonuses ?? false },
    { key: 'employee_adjustments', label: 'Tunjangan & Kedisiplinan', icon: Sliders, isReady: syncStatus.tableDetails?.employee_adjustments ?? false },
    { key: 'payroll_deductions', label: 'Potongan & BPJS Manual', icon: FileSpreadsheet, isReady: syncStatus.tableDetails?.payroll_deductions ?? false },
    { key: 'payrolls', label: 'Penggajian / Payroll', icon: WalletCards, isReady: syncStatus.tableDetails?.payrolls ?? syncStatus.isTablesCreated },
    { key: 'leave_requests', label: 'Pengajuan Cuti & Izin', icon: CalendarDays, isReady: syncStatus.tableDetails?.leave_requests ?? false },
    { key: 'overtime_requests', label: 'Klaim Lembur', icon: Clock, isReady: syncStatus.tableDetails?.overtime_requests ?? false },
    { key: 'reimbursements', label: 'Reimbursement', icon: Receipt, isReady: syncStatus.tableDetails?.reimbursements ?? false },
    { key: 'cash_advances', label: 'Kasbon & Cicilan', icon: WalletCards, isReady: syncStatus.tableDetails?.cash_advances ?? false },
    { key: 'company_assets', label: 'Inventaris Aset', icon: Boxes, isReady: syncStatus.tableDetails?.company_assets ?? syncStatus.isTablesCreated },
    { key: 'company_settings', label: 'Pengaturan Perusahaan', icon: Settings, isReady: syncStatus.tableDetails?.company_settings ?? false },
  ];

  const readyCount = tableList.filter((t) => t.isReady).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Supabase Cloud (Single Source of Truth)
              </h2>
              <p className="text-xs text-slate-500">
                PT LUPYTA MAJU PERKASA • Sinkronisasi Real-Time Antar-Perangkat (Laptop & HP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-5 pt-3 border-b border-slate-100 flex text-xs font-semibold gap-4 shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            Status Koneksi & 12 Modul Cloud ({readyCount}/{tableList.length})
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`pb-2.5 flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Skrip SQL Lengkap (CREATE TABLE IF NOT EXISTS)
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Card */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  syncStatus.isConnected && syncStatus.isTablesCreated
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : syncStatus.isConnected
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : 'bg-rose-50/80 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  {syncStatus.isConnected && syncStatus.isTablesCreated ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm">
                      {syncStatus.isConnected
                        ? 'Supabase Cloud (Sinkron Antar-Perangkat)'
                        : 'Mode Offline / Lokal'}
                    </h3>
                    <p className="text-[11px] opacity-85 mt-0.5">
                      {syncStatus.error ||
                        'Seluruh modul terhubung langsung ke Supabase Cloud. Setiap perubahan langsung tampil sama persis di semua laptop & HP.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRefreshStatus}
                  className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tarik Data Cloud Terbaru</span>
                </button>
              </div>

              {/* Per-Table Realtime Status Grid */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    Status Tabel Cloud-First di Supabase:
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {readyCount} dari {tableList.length} Tabel Siap
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tableList.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div
                        key={t.key}
                        className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 ${
                          t.isReady
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50/70 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate font-medium">{t.label}</span>
                        </div>
                        <span className="text-[10px] font-bold shrink-0">
                          {t.isReady ? '✓ Cloud' : 'Perlu SQL'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connection Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Supabase Project URL:</span>
                  <span className="font-mono font-medium text-slate-800 text-[11px] break-all select-all">
                    {SUPABASE_URL || 'Belum dikonfigurasi (VITE_SUPABASE_URL)'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Data Aktif Saat Ini:</span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {employeeCount} Karyawan • {assetCount} Inventaris Aset
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                    {syncStatus.isConnected
                      ? '✓ Cloud-First Single Source of Truth (Supabase ↔ Semua Perangkat)'
                      : '⚡ Mode Offline / Lokal'}
                  </span>
                </div>
              </div>

              {/* Manual Seed / Push Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Unggah / Sinkronkan Seluruh Data ke Supabase Cloud
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Dorong seluruh data di perangkat ini ke Supabase Cloud dan muat ulang data terbaru dari server.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSeeding}
                  onClick={onTriggerSeed}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-semibold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isSeeding ? 'Menyinkronkan...' : 'Sinkronkan ke Cloud Sekarang'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-xs text-slate-900">
                    Skrip SQL Lengkap 15 Tabel Cloud-First (CREATE TABLE IF NOT EXISTS)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Mencakup tabel employees (standard_daily_hours), attendances, tgi_employee_bonuses, employee_adjustments, payroll_deductions (bpjs manual), cash_advances, dan company_settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Skrip SQL Tersalin!' : 'Salin Skrip SQL Lengkap'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-800 leading-relaxed select-all">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Cara Menjalankan Skrip di Supabase:</p>
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-amber-800">
                    <li>
                      Buka proyek Anda di Supabase (
                      <a
                        href={SUPABASE_URL || 'https://supabase.com/dashboard'}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold inline-flex items-center gap-0.5"
                      >
                        Buka Supabase <ExternalLink className="w-3 h-3" />
                      </a>
                      ).
                    </li>
                    <li>Di menu sebelah kiri, klik menu <strong>SQL Editor</strong>.</li>
                    <li>Klik <strong>New Query</strong>, tempelkan skrip di atas, lalu klik <strong>Run</strong>.</li>
                    <li>Setelah selesai, kembali ke aplikasi ini dan klik <strong>Tarik Data Cloud Terbaru</strong> pada tab status.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'status' ? 'sql' : 'status')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            {activeTab === 'status' ? 'Lihat Skrip SQL Lengkap →' : '← Kembali ke Status Koneksi'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
