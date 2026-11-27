import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Delete,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  KeyRound,
  UserCheck,
  Building2,
  Mail,
  CheckCircle2,
  Clock,
  Loader2,
  Keyboard,
} from 'lucide-react';
import { CompanyConfig, Employee } from '../types';
import {
  verifyAdminLoginSecure,
  verifyEmployeeLoginSecure,
  updateAdminPinSecure,
  syncAdminPinStatusFromSupabase,
  checkPinRateLimit,
  isOfficialAdminEmail,
  registerAllowedAdminEmails,
  sanitizeSafeText,
} from '../services/authSecurityService';

interface WebPinGatekeeperProps {
  companyName?: string;
  companyConfig?: CompanyConfig;
  employees?: Employee[];
  onUnlockSuccess?: (authResult: {
    mode: 'admin' | 'employee';
    employeeId?: string;
    unlockAdmin?: boolean;
    adminEmail?: string;
    sessionToken?: string;
  }) => void;
  onUnlockWeb?: (authResult: {
    mode: 'admin' | 'employee';
    employeeId?: string;
    unlockAdmin?: boolean;
    adminEmail?: string;
    sessionToken?: string;
  }) => void;
}

export const WebPinGatekeeper: React.FC<WebPinGatekeeperProps> = ({
  companyName,
  companyConfig,
  onUnlockSuccess,
  onUnlockWeb,
}) => {
  const rawName = companyName || companyConfig?.companyName || 'Tas Grosir Import';
  const cleanCompanyName = rawName.replace(/^PT\.?\s+/i, '').trim() || 'Tas Grosir Import';

  const emitUnlock = (payload: {
    mode: 'admin' | 'employee';
    employeeId?: string;
    unlockAdmin?: boolean;
    adminEmail?: string;
    sessionToken?: string;
  }) => {
    onUnlockSuccess?.(payload);
    onUnlockWeb?.(payload);
  };

  const [loginRole, setLoginRole] = useState<'employee' | 'admin'>('employee');
  const [employeeIdentifier, setEmployeeIdentifier] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showScreenKeypad, setShowScreenKeypad] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingPinStatus, setIsCheckingPinStatus] = useState(true);
  const [isInitialAdminSetup, setIsInitialAdminSetup] = useState(false);
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const configEmails: string[] = [];
    if (Array.isArray(companyConfig?.allowedGoogleAdmins)) {
      for (const acc of companyConfig.allowedGoogleAdmins) {
        if (acc?.email && acc.status === 'active') {
          configEmails.push(acc.email);
        }
      }
    }
    if (configEmails.length > 0) {
      registerAllowedAdminEmails(configEmails);
    }
  }, [companyConfig]);

  const activeRateScope =
    loginRole === 'admin'
      ? `admin_pin::${(adminEmail.trim() || 'default_admin').toLowerCase()}`
      : `emp_pin::${(employeeIdentifier.trim() || 'default').toLowerCase()}`;

  useEffect(() => {
    const status = checkPinRateLimit(activeRateScope);
    setLockoutSeconds(status.isLocked ? status.remainingSeconds : 0);
  }, [activeRateScope, loginRole]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      const status = checkPinRateLimit(activeRateScope);
      if (!status.isLocked) {
        setLockoutSeconds(0);
        setErrorMsg(null);
      } else {
        setLockoutSeconds(status.remainingSeconds);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds, activeRateScope]);

  useEffect(() => {
    let isMounted = true;
    const checkCloudPin = async () => {
      setIsCheckingPinStatus(true);
      try {
        const res = await syncAdminPinStatusFromSupabase(adminEmail.trim() || undefined);
        if (!isMounted) return;
        if (loginRole === 'admin') {
          setIsInitialAdminSetup(!res.isConfigured);
        } else {
          setIsInitialAdminSetup(false);
        }
      } catch {
        if (!isMounted) return;
        setIsInitialAdminSetup(false);
      } finally {
        if (isMounted) {
          setIsCheckingPinStatus(false);
        }
      }
    };
    void checkCloudPin();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginRole]);

  const handleDigitClick = (digit: string) => {
    if (lockoutSeconds > 0) return;
    if (pinInput.length < 16) {
      setPinInput((prev) => prev + digit);
      setErrorMsg(null);
    }
  };

  const handleBackspace = () => {
    if (lockoutSeconds > 0) return;
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    if (lockoutSeconds > 0) return;
    setPinInput('');
    setConfirmNewPin('');
    setErrorMsg(null);
  };

  const handleInitialSetupSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0) return;

    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Silakan masukkan Email Administrator resmi terlebih dahulu.');
      return;
    }
    if (!isOfficialAdminEmail(cleanEmail)) {
      setErrorMsg(
        'Akses Ditolak: Email yang Anda masukkan tidak terdaftar sebagai Administrator resmi di sistem.'
      );
      return;
    }

    const trimmed = pinInput.trim();
    if (trimmed.length < 4) {
      setErrorMsg('PIN / Kata Sandi baru minimal 4 karakter.');
      return;
    }
    if (trimmed !== confirmNewPin.trim()) {
      setErrorMsg('Konfirmasi PIN / Kata Sandi tidak cocok.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const setupRes = await updateAdminPinSecure(cleanEmail, 'Super Admin', trimmed);
      if (!setupRes.success) {
        setErrorMsg(setupRes.message || 'Gagal menyimpan kredensial Admin.');
        setIsVerifying(false);
        return;
      }
      setSuccessMsg('Kredensial Admin berhasil dienkripsi & disimpan. Mengautentikasi sesi...');
      const verifyRes = await verifyAdminLoginSecure(cleanEmail, trimmed, 'Super Admin');
      if (verifyRes.authenticated) {
        emitUnlock({
          mode: 'admin',
          unlockAdmin: true,
          adminEmail: verifyRes.email || cleanEmail,
          sessionToken: verifyRes.sessionToken,
        });
      } else {
        setIsInitialAdminSetup(false);
        setPinInput('');
        setConfirmNewPin('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0) return;

    if (isInitialAdminSetup && loginRole === 'admin') {
      await handleInitialSetupSubmit();
      return;
    }

    if (loginRole === 'admin') {
      const cleanEmail = adminEmail.trim().toLowerCase();
      if (!cleanEmail) {
        setErrorMsg('Silakan masukkan Email Administrator resmi terlebih dahulu.');
        return;
      }
      if (!isOfficialAdminEmail(cleanEmail)) {
        setErrorMsg(
          'Akses Ditolak: Email yang Anda masukkan tidak terdaftar sebagai Administrator resmi di database sistem.'
        );
        return;
      }
    }

    const trimmed = pinInput.trim();
    if (!trimmed) {
      setErrorMsg('Silakan masukkan PIN atau Kata Sandi Anda terlebih dahulu.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      if (loginRole === 'admin') {
        const cleanEmail = adminEmail.trim().toLowerCase();
        const res = await verifyAdminLoginSecure(cleanEmail, trimmed, 'Super Admin');
        if (res.authenticated) {
          emitUnlock({
            mode: 'admin',
            unlockAdmin: true,
            adminEmail: res.email || cleanEmail,
            sessionToken: res.sessionToken,
          });
          return;
        }
        if (res.isLockedOut && res.remainingSeconds) {
          setLockoutSeconds(res.remainingSeconds);
        }
        if (res.requiresInitialSetup) {
          setIsInitialAdminSetup(true);
          setErrorMsg(res.message || null);
          return;
        }
        setErrorMsg(res.message || 'PIN / Kata Sandi Admin tidak valid.');
        setPinInput('');
      } else {
        const sanitizedId = sanitizeSafeText(employeeIdentifier, 100);
        if (!sanitizedId) {
          setErrorMsg('Masukkan NIK, ID Karyawan, atau Email Anda terlebih dahulu.');
          return;
        }
        const res = await verifyEmployeeLoginSecure(sanitizedId, trimmed);
        if (res.authenticated && res.employeeId) {
          emitUnlock({
            mode: 'employee',
            unlockAdmin: false,
            employeeId: res.employeeId,
            sessionToken: res.sessionToken,
          });
          return;
        }
        if (res.isLockedOut && res.remainingSeconds) {
          setLockoutSeconds(res.remainingSeconds);
        }
        setErrorMsg(res.message || 'NIK / ID Karyawan atau PIN Akses tidak sesuai.');
        setPinInput('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const TGI_LOGO_IMAGE_PATH = '/assets/aistudio/WhatsApp_Image_2026-11-25_at_09.41.19_a4e57460.jpeg';

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden w-full max-w-full overflow-x-hidden bg-[#121212] flex items-center justify-center p-4 relative">
      {/* 1. Background Layar Penuh Proporsional + Lapisan Gelap Transparan (Overlay Hitam 50%) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 bg-[#141414]">
        {/* Tekstur gelap layar penuh dari gambar asli */}
        <img
          src={TGI_LOGO_IMAGE_PATH}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center scale-110 blur-sm opacity-65 select-none"
        />
        {/* Gambar logo dengan ukuran proporsional (tidak terpotong/gepeng) di tengah layar belakang */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <img
            src={TGI_LOGO_IMAGE_PATH}
            alt="TGI Tas Grosir Import Background"
            className="max-w-full max-h-full w-auto h-auto object-contain opacity-45 select-none"
          />
        </div>
        {/* Lapisan gelap transparan (overlay hitam 50%) & pendaran cahaya emas lembut */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute -top-28 -left-28 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-28 -right-28 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-yellow-500/10 blur-3xl" />
      </div>

      {/* 3. Kotak Form Login Compact Glassmorphism (max-w-md w-full p-5 sm:p-6 space-y-3) */}
      <div className="relative z-10 max-w-md w-full mx-auto bg-black/60 backdrop-blur-md border border-amber-500/30 rounded-2xl p-5 sm:p-6 space-y-3 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Top Header Kompak dengan Monogram Logo Emas TGI (w-14 h-14) */}
        <div className="pb-3 border-b border-amber-500/20 text-center space-y-1.5">
          <div className="w-14 h-14 rounded-xl bg-[#181818] border border-amber-400/40 flex items-center justify-center mx-auto shadow-[0_6px_24px_rgba(245,158,11,0.2)] overflow-hidden p-1">
            <img
              src={TGI_LOGO_IMAGE_PATH}
              alt="Logo TGI Tas Grosir Import"
              className="w-full h-full object-contain rounded-lg select-none"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-400/30">
              <Lock className="w-2.5 h-2.5 text-amber-400" /> Gerbang Keamanan Terenkripsi
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent tracking-tight break-words">
            {cleanCompanyName}
          </h1>
          <p className="text-[11px] text-stone-300/80 leading-snug">
            Verifikasi identitas sebelum mengakses data penggajian &amp; HRIS
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/55 rounded-xl border border-amber-500/25">
          <button
            type="button"
            onClick={() => {
              setLoginRole('employee');
              setErrorMsg(null);
              setSuccessMsg(null);
              setPinInput('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              loginRole === 'employee'
                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-stone-950 shadow-md shadow-amber-500/25'
                : 'text-stone-400 hover:text-amber-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Portal Karyawan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginRole('admin');
              setErrorMsg(null);
              setSuccessMsg(null);
              setPinInput('');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              loginRole === 'admin'
                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-stone-950 shadow-md shadow-amber-500/25'
                : 'text-stone-400 hover:text-amber-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Admin HR / Finance</span>
          </button>
        </div>

        {/* Form Body */}
        {isCheckingPinStatus ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
            <div className="text-xs font-bold text-amber-100">
              Memeriksa Status PIN Keamanan...
            </div>
            <p className="text-[11px] text-stone-400 max-w-xs leading-relaxed">
              Menghubungkan ke database Cloud Supabase untuk memverifikasi konfigurasi PIN perangkat.
            </p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            {lockoutSeconds > 0 && (
              <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-start gap-2.5 text-rose-200 text-xs">
                <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5">
                  <div className="font-extrabold text-rose-300 text-[11px]">
                    Akses Diblokir Sementara (Anti Brute-Force)
                  </div>
                  <p className="text-[10px] text-rose-200/90 leading-relaxed">
                    Terdeteksi 5 kali percobaan PIN salah. Silakan tunggu{' '}
                    <span className="font-mono font-black text-white bg-rose-800/80 px-1.5 py-0.5 rounded">
                      {formatCountdown(lockoutSeconds)}
                    </span>{' '}
                    sebelum mencoba kembali.
                  </p>
                </div>
              </div>
            )}

            {loginRole === 'employee' ? (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-200/80 mb-1">
                  NIK / ID Karyawan / Email Terdaftar
                </label>
                <div className="relative">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400/80 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={100}
                    disabled={lockoutSeconds > 0}
                    value={employeeIdentifier}
                    onChange={(e) => {
                      setEmployeeIdentifier(e.target.value.slice(0, 100));
                      setErrorMsg(null);
                    }}
                    placeholder="Contoh: TGI-2024-001 atau email@..."
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2 bg-black/65 border border-amber-500/30 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-200/80 mb-1">
                  Email Administrator Resmi
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-amber-400/80 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="email"
                    maxLength={120}
                    disabled={lockoutSeconds > 0}
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value.slice(0, 120));
                      setErrorMsg(null);
                    }}
                    placeholder="Masukkan Email Administrator"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="w-full pl-9 pr-3 py-2 bg-black/65 border border-amber-500/30 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* PIN / Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  {isInitialAdminSetup && loginRole === 'admin'
                    ? 'Buat PIN / Kata Sandi Admin Baru'
                    : loginRole === 'admin'
                    ? 'PIN / Kata Sandi Admin'
                    : 'PIN Akses Karyawan'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowScreenKeypad((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/80 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <Keyboard className="w-3 h-3 text-amber-400" />
                  <span>{showScreenKeypad ? 'Sembunyikan Keypad' : 'Gunakan Keypad Layar'}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPin ? 'text' : 'password'}
                  maxLength={32}
                  disabled={lockoutSeconds > 0}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.slice(0, 32));
                    setErrorMsg(null);
                  }}
                  placeholder={
                    isInitialAdminSetup && loginRole === 'admin'
                      ? 'Minimal 4 karakter / digit'
                      : 'Masukkan PIN / Password'
                  }
                  autoComplete="current-password"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-black/65 border border-amber-500/30 rounded-xl text-center text-sm sm:text-base font-mono tracking-widest text-amber-100 placeholder:text-xs placeholder:tracking-normal placeholder:font-sans placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400/80 hover:text-amber-200 p-1 cursor-pointer"
                  title={showPin ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm PIN when initial setup */}
            {isInitialAdminSetup && loginRole === 'admin' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-200/80 mb-1">
                  Konfirmasi PIN / Kata Sandi Admin Baru
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={32}
                  disabled={lockoutSeconds > 0}
                  value={confirmNewPin}
                  onChange={(e) => {
                    setConfirmNewPin(e.target.value.slice(0, 32));
                    setErrorMsg(null);
                  }}
                  placeholder="Ketik ulang PIN / Kata Sandi"
                  className="w-full px-3.5 py-2 bg-black/65 border border-amber-500/30 rounded-xl text-center text-xs sm:text-sm font-mono tracking-widest text-amber-100 placeholder:text-xs placeholder:tracking-normal placeholder:font-sans placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 disabled:opacity-50"
                />
                <p className="text-[10px] text-amber-300/85 mt-1 leading-snug">
                  PIN/Kata Sandi di-hash SHA-256 &amp; disimpan terpusat ke Cloud Supabase.
                </p>
              </div>
            )}

            {/* Error / Success Alert */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-start gap-2 text-rose-300 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug break-words">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-start gap-2 text-amber-200 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-snug break-words">{successMsg}</span>
              </div>
            )}

            {/* 2. Opsional Numpad Virtual (Disembunyikan Secara Default) */}
            {showScreenKeypad && (
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={lockoutSeconds > 0}
                    onClick={() => handleDigitClick(digit)}
                    className="py-1.5 sm:py-2 rounded-lg bg-white/5 hover:bg-amber-500/20 active:scale-95 border border-amber-500/25 hover:border-amber-400/50 text-amber-50 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-40"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={lockoutSeconds > 0}
                  onClick={handleClear}
                  className="py-1.5 sm:py-2 rounded-lg bg-black/50 hover:bg-rose-950/60 border border-rose-500/25 text-rose-300 font-bold text-[11px] transition-all cursor-pointer disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={lockoutSeconds > 0}
                  onClick={() => handleDigitClick('0')}
                  className="py-1.5 sm:py-2 rounded-lg bg-white/5 hover:bg-amber-500/20 active:scale-95 border border-amber-500/25 hover:border-amber-400/50 text-amber-50 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-40"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={lockoutSeconds > 0}
                  onClick={handleBackspace}
                  className="py-1.5 sm:py-2 rounded-lg bg-black/50 hover:bg-amber-500/15 border border-amber-500/25 text-amber-300 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                  title="Hapus 1 karakter"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Submit Button dengan Aksen Emas Mewah */}
            <button
              type="submit"
              disabled={isVerifying || lockoutSeconds > 0}
              className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm text-stone-950 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-300 hover:via-yellow-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 border border-amber-300/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>
                {lockoutSeconds > 0
                  ? `Terkunci (${formatCountdown(lockoutSeconds)})`
                  : isVerifying
                  ? 'Memverifikasi Kredensial...'
                  : isInitialAdminSetup && loginRole === 'admin'
                  ? 'Simpan & Masuk Panel Admin'
                  : loginRole === 'admin'
                  ? 'Verifikasi & Masuk Panel Admin'
                  : 'Verifikasi & Buka Portal Karyawan'}
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
