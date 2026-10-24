import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  WifiOff,
  MoreVertical,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlatform?: 'android' | 'ios' | 'desktop';
  isInstallable: boolean;
  onNativeInstall: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
  defaultPlatform = 'android',
  isInstallable,
  onNativeInstall,
}) => {
  const [selectedTab, setSelectedTab] = useState<'android' | 'ios' | 'desktop'>(defaultPlatform);

  useEffect(() => {
    setSelectedTab(defaultPlatform);
  }, [defaultPlatform]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 sm:p-5 text-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
                <Sparkles className="w-3 h-3" />
                Progressive Web App (PWA)
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-white mt-1">
                Install Aplikasi TGI Portal ke HP
              </h3>
              <p className="text-[11px] text-slate-300">
                Buka langsung dari layar utama HP seperti aplikasi native tanpa browser bar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Native 1-Click Install Callout if supported */}
          {isInstallable && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-emerald-950">
                  Perangkat Anda Mendukung Instalasi Instan!
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Klik tombol di samping untuk langsung memasang ikon TGI Portal di layar utama HP Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={onNativeInstall}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Install Sekarang</span>
              </button>
            </div>
          )}

          {/* Platform Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setSelectedTab('android')}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTab === 'android'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              HP Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('ios')}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTab === 'ios'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              iPhone / iOS (Safari)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('desktop')}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTab === 'desktop'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laptop / PC
            </button>
          </div>

          {/* Step-by-step instructions */}
          {selectedTab === 'android' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900">Buka di Browser Google Chrome HP</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Jika sedang membuka dari preview atau link chat, buka alamat web aplikasi di{' '}
                    <strong>Google Chrome</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Ketuk Ikon Menu Titik Tiga</span>
                    <span className="inline-flex items-center p-1 bg-slate-200 rounded-md">
                      <MoreVertical className="w-3.5 h-3.5 text-slate-700" />
                    </span>
                    <span>di Pojok Kanan Atas</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Buka menu pengaturan Chrome di bagian atas layar HP Anda.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900">
                    Pilih &ldquo;Instal aplikasi&rdquo; atau &ldquo;Tambahkan ke layar utama&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Konfirmasi dengan mengetuk <strong>Instal</strong>. Ikon <strong>TGI Portal</strong> akan langsung muncul di layar utama HP Anda!
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'ios' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900">Buka Aplikasi di Safari iPhone / iPad</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pastikan Anda membuka link Portal Karyawan menggunakan browser bawaan <strong>Safari</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Ketuk Tombol Bagikan (Share)</span>
                    <span className="inline-flex items-center p-1 bg-slate-200 rounded-md">
                      <Share className="w-3.5 h-3.5 text-blue-600" />
                    </span>
                    <span>di Bar Bawah Safari</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ikon kotak dengan panah ke atas di bagian tengah bawah layar iPhone.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Pilih &ldquo;Tambah ke Layar Utama&rdquo; (Add to Home Screen)</span>
                    <PlusSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Lalu ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Aplikasi siap dibuka layar penuh!
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'desktop' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900">
                    Klik Ikon Install di Kolom URL Browser (Chrome / Edge)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Di sebelah kanan kolom alamat website (Address Bar), klik ikon komputer/unduh bertuliskan{' '}
                    <strong>Install TGI Portal Karyawan &amp; HRIS</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Catatan Saat Membuka di AI Studio Preview</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Jika Anda membuka aplikasi di dalam panel preview, buka aplikasi di tab baru penuh agar tombol install bawaan browser aktif.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Benefits Footer */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Keunggulan Aplikasi PWA:</strong> Kamera Absen &amp; GPS 25M lebih cepat, layar penuh tanpa address bar, dan hemat kuota.
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isIOS, isAndroid, isInstalled, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold"
        title="Aplikasi TGI Portal telah terpasang di perangkat ini"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="hidden xl:inline">Terinstal</span>
      </span>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'manual') {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const defaultPlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'android';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
          compact
            ? 'px-2.5 py-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            : 'px-2.5 sm:px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/25'
        }`}
        title="Install Aplikasi TGI Portal ke Layar Utama HP / Perangkat"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>

      <PWAInstallGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        defaultPlatform={defaultPlatform}
        isInstallable={isInstallable}
        onNativeInstall={async () => {
          await promptInstall();
          setShowGuideModal(false);
        }}
      />
    </>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isIOS, isAndroid, isInstalled, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('tgi_pwa_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('tgi_pwa_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleInstallAction = async () => {
    if (isInstallable) {
      const result = await promptInstall();
      if (result === 'manual') {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const defaultPlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'android';

  return (
    <>
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-3.5 sm:p-4 text-white border border-emerald-700/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-white">
                Pasang Aplikasi TGI Portal di Layar Utama HP
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/30 text-[10px] font-bold text-emerald-200">
                PWA Ready
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/85 mt-0.5">
              Akses Kamera Absen Wajah &amp; GPS Geofence 25M, Slip Gaji, dan Cuti 1x ketuk langsung dari menu HP Anda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleInstallAction}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isInstallable ? 'Install ke HP' : 'Cara Install di HP'}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl text-emerald-200/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Sembunyikan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PWAInstallGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        defaultPlatform={defaultPlatform}
        isInstallable={isInstallable}
        onNativeInstall={async () => {
          await promptInstall();
          setShowGuideModal(false);
        }}
      />
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-xs">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Mode Offline Aktif — Data lokal tetap tersimpan di HP dan akan disinkronkan saat koneksi kembali.
      </span>
    </div>
  );
};
