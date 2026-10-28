import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  PenTool,
  Upload,
  Check,
  RotateCcw,
  Sparkles,
  Stamp,
  Trash2,
  MapPin,
  Calendar,
  UserCheck,
  ShieldCheck,
  Eye,
  Save,
} from 'lucide-react';
import {
  PayrollSignatoriesConfig,
  SignatoryItemConfig,
  CompanyConfig,
  Employee,
} from '../types';
import {
  DEFAULT_PAYROLL_SIGNATORIES,
  getPayrollSignatoriesConfig,
  savePayrollSignatoriesConfig,
  generateStylizedSignatureDataUrl,
  generateOfficialCompanyStampDataUrl,
} from '../utils/formatters';

interface SignatoryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyConfig: CompanyConfig;
  employees?: Employee[];
  initialConfig?: PayrollSignatoriesConfig;
  onSaveConfig: (newConfig: PayrollSignatoriesConfig) => void;
}

type SignatoryKey = 'preparedBy' | 'verifiedBy' | 'approvedBy';

const SIGNATORY_SECTIONS: {
  key: SignatoryKey;
  badge: string;
  title: string;
  defaultPlaceholderName: string;
  defaultPlaceholderRole: string;
  defaultPlaceholderSubtitle: string;
  colorClass: string;
}[] = [
  {
    key: 'preparedBy',
    badge: 'Kolom 1 • HRD',
    title: 'Bagian "Disiapkan Oleh"',
    defaultPlaceholderName: 'Ketik Nama Penandatangan HR...',
    defaultPlaceholderRole: 'HR Department',
    defaultPlaceholderSubtitle: 'Staff HR & Payroll Admin',
    colorClass: 'border-emerald-200 bg-emerald-50/40',
  },
  {
    key: 'verifiedBy',
    badge: 'Kolom 2 • Finance',
    title: 'Bagian "Diperiksa & Diverifikasi"',
    defaultPlaceholderName: 'Ketik Nama Penandatangan Finance...',
    defaultPlaceholderRole: 'Finance Department',
    defaultPlaceholderSubtitle: 'Finance & Accounting Lead',
    colorClass: 'border-indigo-200 bg-indigo-50/40',
  },
  {
    key: 'approvedBy',
    badge: 'Kolom 3 • Direksi',
    title: 'Bagian "Disetujui Oleh"',
    defaultPlaceholderName: 'Ketik Nama Direktur Utama...',
    defaultPlaceholderRole: 'Direktur Utama',
    defaultPlaceholderSubtitle: 'Direktur Utama',
    colorClass: 'border-amber-200 bg-amber-50/40',
  },
];

/**
 * Helper membaca file gambar (mempertahankan transparansi PNG untuk tanda tangan & stempel)
 */
function readSignatureOrStampImage(file: File, maxW = 500, maxH = 260): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) {
        reject(new Error('Gagal membaca file gambar'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Format gambar tidak valid'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Gagal memuat file gambar'));
    reader.readAsDataURL(file);
  });
}

export const SignatoryConfigModal: React.FC<SignatoryConfigModalProps> = ({
  isOpen,
  onClose,
  companyConfig,
  employees = [],
  initialConfig,
  onSaveConfig,
}) => {
  const [formState, setFormState] = useState<PayrollSignatoriesConfig>(() =>
    initialConfig || getPayrollSignatoriesConfig(companyConfig)
  );
  const [activeCanvasTarget, setActiveCanvasTarget] = useState<SignatoryKey | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormState(initialConfig || getPayrollSignatoriesConfig(companyConfig));
    }
  }, [isOpen, initialConfig, companyConfig]);

  if (!isOpen) return null;

  const showTempMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const updateSignatoryField = (
    key: SignatoryKey,
    patch: Partial<SignatoryItemConfig>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  };

  const handleUploadSignatureFile = async (
    key: SignatoryKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readSignatureOrStampImage(file, 480, 220);
      updateSignatoryField(key, { signatureDataUrl: dataUrl });
      showTempMessage(`Gambar tanda tangan untuk "${formState[key].name}" berhasil dimuat.`);
    } catch (err: any) {
      showTempMessage(err?.message || 'Gagal memuat gambar tanda tangan.');
    }
  };

  const handleUploadStampFile = async (
    key: SignatoryKey | 'company',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readSignatureOrStampImage(file, 320, 320);
      if (key === 'company') {
        setFormState((prev) => ({
          ...prev,
          companyStampDataUrl: dataUrl,
        }));
        showTempMessage('Stempel perusahaan berhasil diunggah!');
      } else {
        updateSignatoryField(key, { stampDataUrl: dataUrl, showStamp: true });
        showTempMessage(`Stempel khusus pada kolom "${formState[key].name}" berhasil dimuat.`);
      }
    } catch (err: any) {
      showTempMessage(err?.message || 'Gagal memuat gambar stempel.');
    }
  };

  const handlePasteSignatureFromClipboard = async (
    key: SignatoryKey,
    e: React.ClipboardEvent<HTMLDivElement>
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const dataUrl = await readSignatureOrStampImage(file, 480, 220);
          updateSignatoryField(key, { signatureDataUrl: dataUrl });
          showTempMessage(`Gambar tanda tangan berhasil ditempel (paste) dari clipboard!`);
          return;
        }
      }
    }
  };

  // Interactive Signature Pad Handlers
  const openDrawPad = (key: SignatoryKey) => {
    setActiveCanvasTarget(key);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }, 50);
  };

  const getPointerPos = (
    canvas: HTMLCanvasElement,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const drawMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    if (!activeCanvasTarget || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    updateSignatoryField(activeCanvasTarget, { signatureDataUrl: dataUrl });
    showTempMessage(
      `Goresan tanda tangan manual untuk "${formState[activeCanvasTarget].name}" berhasil diterapkan!`
    );
    setActiveCanvasTarget(null);
  };

  const handleResetToDefault = () => {
    const defaultCfg: PayrollSignatoriesConfig = {
      ...DEFAULT_PAYROLL_SIGNATORIES,
      preparedBy: { ...DEFAULT_PAYROLL_SIGNATORIES.preparedBy },
      verifiedBy: { ...DEFAULT_PAYROLL_SIGNATORIES.verifiedBy },
      approvedBy: { ...DEFAULT_PAYROLL_SIGNATORIES.approvedBy },
    };
    setFormState(defaultCfg);
    showTempMessage('Kolom penandatangan telah dikosongkan ke pengaturan awal.');
  };

  const handleSaveAndApply = (e: React.FormEvent) => {
    e.preventDefault();
    savePayrollSignatoriesConfig(formState);
    onSaveConfig(formState);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wide">
                Pengaturan Penandatangan, Tanda Tangan Digital &amp; Stempel Perusahaan
              </h3>
              <p className="text-xs text-slate-400">
                Kustomisasi nama, jabatan, tanda tangan &amp; stempel untuk Laporan Gaji Bulanan dan Slip Gaji PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveAndApply} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Baris Pengaturan Global: Kota, Tanggal Cetak, & Stempel Perusahaan Utama */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Kota Pengesahan Dokumen</span>
              </label>
              <input
                type="text"
                value={formState.city}
                onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                placeholder="Contoh: Jakarta"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Ditampilkan di atas tanda tangan PDF (misal: Jakarta, 28 Oktober 2026)
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tanggal Tanda Tangan (Opsional)</span>
              </label>
              <input
                type="text"
                value={formState.customDateText || ''}
                onChange={(e) => setFormState({ ...formState, customDateText: e.target.value })}
                placeholder={new Date().toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Kosongkan untuk otomatis mengikuti tanggal cetak hari ini
              </span>
            </div>

            {/* Stempel Perusahaan Utama */}
            <div className="flex flex-col justify-between bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Stamp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Stempel Resmi Perusahaan</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Unggah cap basah/stempel PNG atau gunakan stempel digital PT TGI
                  </span>
                </div>
                {formState.companyStampDataUrl && (
                  <img
                    src={formState.companyStampDataUrl}
                    alt="Stempel Perusahaan"
                    className="w-12 h-12 object-contain border border-slate-200 rounded-lg bg-slate-50 p-0.5 shrink-0"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <label className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors">
                  <Upload className="w-3 h-3" />
                  <span>Unggah Stempel</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadStampFile('company', e)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const autoStamp = generateOfficialCompanyStampDataUrl(
                      companyConfig.companyName
                    );
                    setFormState((prev) => ({
                      ...prev,
                      companyStampDataUrl: autoStamp,
                      approvedBy: {
                        ...prev.approvedBy,
                        showStamp: true,
                      },
                    }));
                    showTempMessage('Stempel Digital Resmi PT Tas Grosir Import berhasil dibuat!');
                  }}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Stempel Digital TGI</span>
                </button>
                {formState.companyStampDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, companyStampDataUrl: '' }))
                    }
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Hapus Stempel Perusahaan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3 Kartu Penandatangan: Disiapkan Oleh, Diperiksa & Diverifikasi, Disetujui Oleh */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SIGNATORY_SECTIONS.map((sec) => {
              const item = formState[sec.key];
              const effectiveStamp = item.stampDataUrl || formState.companyStampDataUrl;

              return (
                <div
                  key={sec.key}
                  onPaste={(e) => handlePasteSignatureFromClipboard(sec.key, e)}
                  className={`rounded-2xl border-2 p-4 flex flex-col justify-between space-y-3.5 transition-all ${sec.colorClass}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                          {sec.badge}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm mt-1">
                          {sec.title}
                        </h4>
                      </div>
                      {employees.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const emp = employees.find((x) => x.id === e.target.value);
                            if (emp) {
                              updateSignatoryField(sec.key, {
                                name: emp.fullName,
                                jobTitle: `${emp.department}`,
                                topSubtitle: emp.role,
                              });
                            }
                          }}
                          className="max-w-[125px] text-[10px] bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700 font-semibold cursor-pointer"
                          title="Isi cepat dari daftar karyawan aktif"
                        >
                          <option value="">+ Pilih Staf...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.fullName} ({emp.role})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Input Label Atas (Misal: Disiapkan Oleh,) */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Judul Kolom Pengesahan
                      </label>
                      <input
                        type="text"
                        required
                        value={item.headerLabel}
                        onChange={(e) =>
                          updateSignatoryField(sec.key, { headerLabel: e.target.value })
                        }
                        placeholder="Disiapkan Oleh,"
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Input Keterangan Peran Baris Atas */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Sub-Judul Jabatan (Di Atas TTD)
                      </label>
                      <input
                        type="text"
                        value={item.topSubtitle}
                        onChange={(e) =>
                          updateSignatoryField(sec.key, { topSubtitle: e.target.value })
                        }
                        placeholder={sec.defaultPlaceholderSubtitle}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Input Nama Lengkap Penandatangan */}
                    <div>
                      <label className="block font-bold text-slate-900 mb-1 text-[11px]">
                        Nama Lengkap &amp; Gelar Penandatangan
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateSignatoryField(sec.key, { name: e.target.value })
                        }
                        placeholder={sec.defaultPlaceholderName}
                        className="w-full p-2.5 bg-white border-2 border-slate-300 rounded-xl font-extrabold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>

                    {/* Input Jabatan / Departemen (Di Bawah Garis TTD) */}
                    <div>
                      <label className="block font-bold text-slate-900 mb-1 text-[11px]">
                        Jabatan / Departemen (Di Bawah Nama) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={item.jobTitle}
                        onChange={(e) =>
                          updateSignatoryField(sec.key, { jobTitle: e.target.value })
                        }
                        placeholder={sec.defaultPlaceholderRole}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-700 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Area Pratinjau & Unggah Tanda Tangan + Stempel */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">
                        Pratinjau Tanda Tangan &amp; Stempel:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Bisa Ctrl+V (Paste) gambar
                      </span>
                    </div>

                    {/* Kotak Pratinjau Garis Tanda Tangan */}
                    <div className="relative h-28 bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-end p-2 overflow-hidden">
                      {/* Gambar Stempel (Jika Diaktifkan) */}
                      {item.showStamp && effectiveStamp && (
                        <img
                          src={effectiveStamp}
                          alt="Stempel"
                          className="absolute left-1/2 -translate-x-12 bottom-5 w-20 h-20 object-contain opacity-80 pointer-events-none select-none z-10"
                        />
                      )}

                      {/* Gambar Tanda Tangan */}
                      {item.signatureDataUrl ? (
                        <img
                          src={item.signatureDataUrl}
                          alt={`TTD ${item.name}`}
                          className="max-h-16 max-w-[180px] object-contain mb-1 relative z-20"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 italic mb-5">
                          Belum ada gambar tanda tangan (kosong/manual)
                        </span>
                      )}

                      <div className="w-40 border-t border-slate-400 pt-1 text-center relative z-20">
                        <p className="font-bold text-slate-900 text-[11px] leading-tight truncate">
                          {item.name || '( Belum Diisi )'}
                        </p>
                        <p className="text-[9px] text-slate-500 leading-tight truncate">
                          {item.jobTitle || sec.defaultPlaceholderRole}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Aksi Tanda Tangan */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload TTD</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadSignatureFile(sec.key, e)}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => openDrawPad(sec.key)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <PenTool className="w-3 h-3 text-emerald-600" />
                        <span>Gores TTD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const sigUrl = generateStylizedSignatureDataUrl(
                            item.name || sec.defaultPlaceholderName
                          );
                          updateSignatoryField(sec.key, { signatureDataUrl: sigUrl });
                          showTempMessage(`TTD digital otomatis dibuat untuk ${item.name}`);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title="Buat tanda tangan digital kaligrafi otomatis dari nama"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>TTD Otomatis</span>
                      </button>

                      {item.signatureDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            updateSignatoryField(sec.key, { signatureDataUrl: '' })
                          }
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer ml-auto"
                          title="Hapus Tanda Tangan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Opsi Stempel per Kolom */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(item.showStamp)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (
                              checked &&
                              !item.stampDataUrl &&
                              !formState.companyStampDataUrl
                            ) {
                              const autoStamp = generateOfficialCompanyStampDataUrl(
                                companyConfig.companyName
                              );
                              setFormState((prev) => ({
                                ...prev,
                                companyStampDataUrl: autoStamp,
                                [sec.key]: {
                                  ...prev[sec.key],
                                  showStamp: true,
                                },
                              }));
                            } else {
                              updateSignatoryField(sec.key, { showStamp: checked });
                            }
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-semibold text-slate-700">
                          Tampilkan Stempel di Kolom Ini
                        </span>
                      </label>

                      <label className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer inline-flex items-center gap-1">
                        <Stamp className="w-3 h-3" />
                        <span>Stempel Khusus</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadStampFile(sec.key, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal / Overlay Kanvas Gores Tanda Tangan Manual */}
          {activeCanvasTarget && (
            <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Gores Tanda Tangan Manual
                    </h4>
                    <p className="text-xs text-slate-500">
                      Penandatangan: <strong>{formState[activeCanvasTarget].name}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCanvasTarget(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={180}
                    onMouseDown={startDrawing}
                    onMouseMove={drawMove}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={drawMove}
                    onTouchEnd={stopDrawing}
                    className="w-full h-44 cursor-crosshair touch-none bg-white"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Bersihkan Kanvas
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCanvasTarget(null)}
                      className="px-3 py-2 border border-slate-300 text-slate-600 rounded-xl font-semibold text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={saveCanvasSignature}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Pakai Tanda Tangan Ini</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opsi Tambahan untuk Slip Gaji Individual */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(formState.showAllThreeOnPayslip)}
                onChange={(e) =>
                  setFormState({ ...formState, showAllThreeOnPayslip: e.target.checked })
                }
                className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-emerald-950 block">
                  Terapkan juga Pejabat Penandatangan &amp; Stempel pada Slip Gaji Individual Karyawan
                </span>
                <span className="text-[11px] text-emerald-800">
                  Menampilkan tanda tangan HRD, Verifikasi Finance, dan Persetujuan Direktur Utama beserta stempel resmi pada setiap Slip Gaji.
                </span>
              </div>
            </label>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Default</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const autoStamp =
                    formState.companyStampDataUrl ||
                    generateOfficialCompanyStampDataUrl(companyConfig.companyName);
                  setFormState((prev) => ({
                    ...prev,
                    companyStampDataUrl: autoStamp,
                    preparedBy: {
                      ...prev.preparedBy,
                      signatureDataUrl:
                        prev.preparedBy.signatureDataUrl ||
                        generateStylizedSignatureDataUrl(prev.preparedBy.name, '#0f172a'),
                    },
                    verifiedBy: {
                      ...prev.verifiedBy,
                      signatureDataUrl:
                        prev.verifiedBy.signatureDataUrl ||
                        generateStylizedSignatureDataUrl(prev.verifiedBy.name, '#1e3a8a'),
                    },
                    approvedBy: {
                      ...prev.approvedBy,
                      showStamp: true,
                      signatureDataUrl:
                        prev.approvedBy.signatureDataUrl ||
                        generateStylizedSignatureDataUrl(prev.approvedBy.name, '#065f46'),
                    },
                  }));
                  showTempMessage(
                    'Seluruh tanda tangan digital & stempel perusahaan otomatis diisi!'
                  );
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Isi Otomatis Semua TTD &amp; Stempel</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Konfigurasi Penandatangan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
