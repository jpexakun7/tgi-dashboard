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
} from 'lucide-react';
import { CompanyConfig, Employee } from '../types';
import {
  verifyAdminLoginSecure,
  verifyEmployeeLoginSecure,
  updateAdminPinSecure,
  hasConfiguredAdminCredentialHash,
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
  const [adminEmail, setAdminEmail] = useState<string>('jpexakun7@gmail.com');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitialAdminSetup, setIsInitialAdminSetup] = useState(false);
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loginRole === 'admin') {
      const configured = hasConfiguredAdminCredentialHash(adminEmail);
      setIsInitialAdminSetup(!configured);
    } else {
      setIsInitialAdminSetup(false);
    }
  }, [loginRole, adminEmail]);

  const handleDigitClick = (digit: string) => {
    if (pinInput.length < 16) {
      setPinInput((prev) => prev + digit);
      setErrorMsg(null);
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPinInput('');
    setConfirmNewPin('');
    setErrorMsg(null);
  };

  const handleInitialSetupSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      const setupRes = await updateAdminPinSecure(adminEmail, 'Super Admin', trimmed);
      if (!setupRes.success) {
        setErrorMsg(setupRes.message || 'Gagal menyimpan kredensial Admin.');
        setIsVerifying(false);
        return;
      }
      setSuccessMsg('Kredensial Admin berhasil dienkripsi & disimpan. Mengautentikasi sesi...');
      const verifyRes = await verifyAdminLoginSecure(adminEmail, trimmed, 'Super Admin');
      if (verifyRes.authenticated) {
        emitUnlock({
          mode: 'admin',
          unlockAdmin: true,
          adminEmail: verifyRes.email || adminEmail,
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
    if (isInitialAdminSetup && loginRole === 'admin') {
      await handleInitialSetupSubmit();
      return;
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
        const res = await verifyAdminLoginSecure(adminEmail, trimmed, 'Super Admin');
        if (res.authenticated) {
          emitUnlock({
            mode: 'admin',
            unlockAdmin: true,
            adminEmail: res.email || adminEmail,
            sessionToken: res.sessionToken,
          });
          return;
        }
        if (res.requiresInitialSetup) {
          setIsInitialAdminSetup(true);
          setErrorMsg(res.message || null);
          return;
        }
        setErrorMsg(res.message || 'PIN / Kata Sandi Admin tidak valid.');
        setPinInput('');
      } else {
        if (!employeeIdentifier.trim()) {
          setErrorMsg('Masukkan NIK, ID Karyawan, atau Email Anda terlebih dahulu.');
          return;
        }
        const res = await verifyEmployeeLoginSecure(employeeIdentifier, trimmed);
        if (res.authenticated && res.employeeId) {
          emitUnlock({
            mode: 'employee',
            unlockAdmin: false,
            employeeId: res.employeeId,
            sessionToken: res.sessionToken,
          });
          return;
        }
        setErrorMsg(res.message || 'NIK / ID Karyawan atau PIN Akses tidak sesuai.');
        setPinInput('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative">
      {/* Subtle Ambient Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto bg-slate-900/95 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Top Header */}
        <div className="bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-900 p-4 sm:p-6 border-b border-slate-800 text-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-1.5">
            <Lock className="w-3 h-3" /> Gerbang Keamanan Terenkripsi
          </span>
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight break-words">
            {cleanCompanyName}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
            Verifikasi identitas sebelum mengakses data penggajian & HRIS
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="p-3 sm:p-5 pb-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setLoginRole('employee');
                setErrorMsg(null);
                setSuccessMsg(null);
                setPinInput('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
                loginRole === 'employee'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
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
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
                loginRole === 'admin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Admin HR / Finance</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleVerify} className="p-4 sm:p-6 space-y-4">
          {loginRole === 'employee' ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                NIK / ID Karyawan / Email Terdaftar
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={employeeIdentifier}
                  onChange={(e) => {
                    setEmployeeIdentifier(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Contoh: TGI-2024-001 atau email@..."
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Data karyawan tidak ditampilkan sebelum identitas & PIN diverifikasi oleh server.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Email Administrator
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="admin@tasgrosirimport.com"
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* PIN / Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                {isInitialAdminSetup && loginRole === 'admin'
                  ? 'Buat PIN / Kata Sandi Admin Baru'
                  : loginRole === 'admin'
                  ? 'PIN / Kata Sandi Admin'
                  : 'PIN Akses Karyawan'}
              </label>
              {isInitialAdminSetup && loginRole === 'admin' && (
                <span className="text-[10px] font-semibold text-amber-400">Setup Awal</span>
              )}
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={
                  isInitialAdminSetup && loginRole === 'admin'
                    ? 'Minimal 4 karakter / digit'
                    : 'Masukkan PIN / Password'
                }
                autoComplete="current-password"
                className="w-full pl-4 pr-11 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-base sm:text-lg font-mono tracking-widest text-white placeholder:text-xs placeholder:tracking-normal placeholder:font-sans placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPin((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title={showPin ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm PIN when initial setup */}
          {isInitialAdminSetup && loginRole === 'admin' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Konfirmasi PIN / Kata Sandi Admin Baru
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                value={confirmNewPin}
                onChange={(e) => {
                  setConfirmNewPin(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Ketik ulang PIN / Kata Sandi"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm font-mono tracking-widest text-white placeholder:text-xs placeholder:tracking-normal placeholder:font-sans placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-amber-300/90 mt-1.5 leading-relaxed">
                Sistem tidak menggunakan password bawaan (hardcode). PIN/Kata Sandi Anda akan di-hash dengan SHA-256 & disimpan ke fungsi RPC Supabase.
              </p>
            </div>
          )}

          {/* Error / Success Alert */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-words">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-words">{successMsg}</span>
            </div>
          )}

          {/* Responsive Numpad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                className="py-2.5 sm:py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 active:scale-95 border border-slate-700/70 text-white font-bold text-sm sm:text-base transition-all"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 sm:py-3 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 text-rose-400 font-bold text-xs transition-all"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="py-2.5 sm:py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 active:scale-95 border border-slate-700/70 text-white font-bold text-sm sm:text-base transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 sm:py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center transition-all"
              title="Hapus 1 karakter"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
              loginRole === 'admin'
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            } disabled:opacity-50`}
          >
            <span>
              {isVerifying
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
      </div>
    </div>
  );
};
