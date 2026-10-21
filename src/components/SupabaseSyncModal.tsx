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
} from 'lucide-react';
import { SUPABASE_URL, SUPABASE_SQL_SCHEMA, SUPABASE_ADDITIONAL_SQL_SCHEMA } from '../lib/supabase';
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
  const [sqlMode, setSqlMode] = useState<'additional' | 'full'>('additional');

  if (!isOpen) return null;

  const currentSql = sqlMode === 'additional' ? SUPABASE_ADDITIONAL_SQL_SCHEMA : SUPABASE_SQL_SCHEMA;

  const handleCopySql = () => {
    navigator.clipboard.writeText(currentSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const tableList = [
    { key: 'employees', label: 'Karyawan', icon: Users, isReady: syncStatus.tableDetails?.employees ?? syncStatus.isTablesCreated },
    { key: 'company_assets', label: 'Inventaris Aset', icon: Boxes, isReady: syncStatus.tableDetails?.company_assets ?? syncStatus.isTablesCreated },
    { key: 'payrolls', label: 'Penggajian', icon: WalletCards, isReady: syncStatus.tableDetails?.payrolls ?? syncStatus.isTablesCreated },
    { key: 'attendances', label: 'Presensi / Absensi', icon: CalendarCheck2, isReady: syncStatus.tableDetails?.attendances ?? false },
    { key: 'leave_requests', label: 'Pengajuan Cuti', icon: CalendarDays, isReady: syncStatus.tableDetails?.leave_requests ?? false },
    { key: 'overtime_requests', label: 'Klaim Lembur', icon: Clock, isReady: syncStatus.tableDetails?.overtime_requests ?? false },
    { key: 'reimbursements', label: 'Reimbursement', icon: Receipt, isReady: syncStatus.tableDetails?.reimbursements ?? false },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Integrasi Database Supabase Cloud
              </h2>
              <p className="text-xs text-slate-500">
                Penyimpanan Real-time PostgreSQL, Sinkronisasi Otomatis & RLS
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
        <div className="flex border-b border-slate-100 mt-4 mb-4 text-xs font-semibold gap-3">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            Status Koneksi & 7 Tabel
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
            Skrip SQL Schema & Editor (Copy-Paste)
          </button>
        </div>

        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Status Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                syncStatus.isTablesCreated
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : syncStatus.isConnected
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {syncStatus.isTablesCreated ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-xs sm:text-sm">{syncStatus.statusText}</h3>
                  <p className="text-[11px] opacity-85 mt-0.5">
                    {syncStatus.error ||
                      'Tabel Supabase terhubung. Setiap perubahan presensi, cuti, lembur, reimbursement, karyawan, aset, dan payroll tersimpan langsung.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRefreshStatus}
                className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Cek Ulang</span>
              </button>
            </div>

            {/* Per-Table Realtime Status Grid */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">Status 7 Tabel Real-time di Supabase:</span>
                <span className="text-[11px] text-slate-500">
                  {tableList.filter((t) => t.isReady).length} dari 7 Siap
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        {t.isReady ? '✓ Aktif' : 'Perlu SQL'}
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
                  {SUPABASE_URL}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Data Aktif Saat Ini:</span>
                <span className="font-semibold text-slate-800 text-xs">
                  {employeeCount} Karyawan • {assetCount} Inventaris Aset
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                  {syncStatus.isTablesCreated
                    ? '✓ Tersinkronisasi dua arah (Supabase ↔ App)'
                    : '⚡ Menggunakan penyimpanan lokal aman (Local Storage Fallback)'}
                </span>
              </div>
            </div>

            {/* Manual Seed Section (Auto-seed is disabled) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Unggah Data Mock Contoh (Manual / Opsional)
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Fitur auto-seed otomatis telah <strong>dimatikan</strong>. Jika tabel Supabase Anda kosong, aplikasi akan menampilkan daftar kosong (0 data). Tombol ini disediakan hanya jika Anda membutuhkan data contoh awal secara manual.
                </p>
              </div>
              <button
                type="button"
                disabled={isSeeding}
                onClick={onTriggerSeed}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-semibold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isSeeding ? 'Mengunggah...' : 'Unggah Data Mock'}</span>
              </button>
            </div>

            {/* Fallback Notice */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] space-y-0.5">
                <p className="font-semibold">Perlindungan Ketersediaan Data (Zero-Downtime Fallback):</p>
                <p className="text-blue-800">
                  Jika koneksi internet terputus atau tabel Supabase belum siap, sistem otomatis menggunakan <strong>localStorage</strong> lokal sehingga Anda tetap dapat mencatat presensi, mengajukan cuti, klaim lembur, dan reimbursement tanpa hambatan.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="space-y-3">
            {/* SQL Mode Switcher */}
            <div className="flex items-center justify-between gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSqlMode('additional')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  sqlMode === 'additional'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Skrip Tambahan (4 Tabel: Presensi, Cuti, Lembur, Reimbursement)
              </button>
              <button
                type="button"
                onClick={() => setSqlMode('full')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  sqlMode === 'full'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Skrip Lengkap (Semua 7 Tabel)
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-slate-900">
                  {sqlMode === 'additional'
                    ? 'Skrip SQL Tambahan: Presensi, Cuti, Lembur & Reimbursement'
                    : 'Skrip PostgreSQL Schema Lengkap (7 Tabel & RLS)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {sqlMode === 'additional'
                    ? 'Jalankan skrip ini jika tabel karyawan & aset sudah dibuat sebelumnya di Supabase.'
                    : 'Skrip lengkap membuat seluruh 7 tabel beserta relasi, indeks, dan aturan RLS.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Tersalin!' : 'Salin Skrip SQL'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-800 leading-relaxed select-all">
                {currentSql}
              </pre>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Cara Menjalankan Skrip di Supabase:</p>
                <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-amber-800">
                  <li>Buka proyek Anda di Supabase (<a href={SUPABASE_URL} target="_blank" rel="noreferrer" className="underline font-bold inline-flex items-center gap-0.5">Buka Supabase <ExternalLink className="w-3 h-3" /></a>).</li>
                  <li>Di menu sebelah kiri, klik menu <strong>SQL Editor</strong>.</li>
                  <li>Klik <strong>New Query</strong>, tempelkan skrip di atas, lalu klik <strong>Run</strong>.</li>
                  <li>Setelah selesai, kembali ke aplikasi ini dan klik <strong>Cek Ulang</strong> pada tab status.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
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
