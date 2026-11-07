import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Mail,
} from 'lucide-react';
import { CompanyConfig, GoogleAdminAccount, GoogleAdminUser } from '../types';
import {
  verifyAdminLoginSecure,
  updateAdminPinSecure,
  hasConfiguredAdminCredentialHash,
} from '../services/authSecurityService';

interface AdminPinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (authenticatedAdmin?: GoogleAdminUser) => void;
  allowedAdmins?: GoogleAdminAccount[];
  companyConfig?: CompanyConfig;
  currentAdminUser?: GoogleAdminUser | null;
}

export const AdminPinAuthModal: React.FC<AdminPinAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  allowedAdmins = [],
  companyConfig,
  currentAdminUser,
}) => {
  const effectiveAdmins =
    allowedAdmins.length > 0 ? allowedAdmins : companyConfig?.allowedGoogleAdmins || [];
  const activeAdmins = effectiveAdmins.filter((a) => a.status === 'active');
  const [selectedEmail, setSelectedEmail] = useState<string>(
    currentAdminUser?.email || activeAdmins[0]?.email || 'jpexakun7@gmail.com'
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const targetEmail =
        currentAdminUser?.email || activeAdmins[0]?.email || 'jpexakun7@gmail.com';
      setSelectedEmail(targetEmail);
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setIsInitialSetup(!hasConfiguredAdminCredentialHash(targetEmail));
    }
  }, [isOpen, currentAdminUser]);

  if (!isOpen) return null;

  const matchedAdmin = activeAdmins.find(
    (a) => a.email.toLowerCase() === selectedEmail.trim().toLowerCase()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = selectedEmail.trim().toLowerCase();
    const trimmedSecret = password.trim();

    if (!trimmedEmail) {
      setError('Pilih atau masukkan email Admin terlebih dahulu.');
      return;
    }

    if (!trimmedSecret) {
      setError('Masukkan PIN atau Kata Sandi Admin.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isInitialSetup) {
        if (trimmedSecret.length < 4) {
          setError('PIN / Kata Sandi baru minimal 4 karakter.');
          setIsSubmitting(false);
          return;
        }
        if (trimmedSecret !== confirmPassword.trim()) {
          setError('Konfirmasi PIN / Kata Sandi tidak cocok.');
          setIsSubmitting(false);
          return;
        }

        const saveRes = await updateAdminPinSecure(trimmedEmail, 'Super Admin', trimmedSecret);
        if (!saveRes.success) {
          setError(saveRes.message || 'Gagal menyimpan kredensial baru.');
          setIsSubmitting(false);
          return;
        }
      }

      const verifyRes = await verifyAdminLoginSecure(trimmedEmail, trimmedSecret, 'Super Admin');

      if (verifyRes.authenticated) {
        const adminProfile: GoogleAdminUser = {
          id: matchedAdmin?.id || `admin-${Date.now()}`,
          email: trimmedEmail,
          name: matchedAdmin?.name || 'Administrator Tas Grosir Import',
          picture:
            matchedAdmin?.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
          role: matchedAdmin?.role || 'Super Admin',
          lastLogin: new Date().toISOString(),
          phone: matchedAdmin?.phone,
        };
        onSuccess(adminProfile);
        onClose();
        return;
      }

      if (verifyRes.requiresInitialSetup) {
        setIsInitialSetup(true);
        setError(verifyRes.message || null);
        return;
      }

      setError(verifyRes.message || 'PIN atau Kata Sandi Admin salah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-x-hidden">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                Otorisasi Mode Admin HR
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Tas Grosir Import • Verifikasi Terenkripsi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Akun Email Admin Terdaftar
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={selectedEmail}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEmail(val);
                  setIsInitialSetup(!hasConfiguredAdminCredentialHash(val));
                  setError(null);
                }}
                placeholder="admin@tasgrosirimport.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              {isInitialSetup
                ? 'Buat PIN / Kata Sandi Admin Baru'
                : 'PIN / Kata Sandi Admin'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder={isInitialSetup ? 'Minimal 4 karakter' : 'Masukkan PIN / Kata Sandi'}
                autoFocus
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isInitialSetup && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Konfirmasi PIN / Kata Sandi Baru
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Ulangi PIN / Kata Sandi"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2">
                Kredensial Admin disimpan menggunakan hash SHA-256 / Supabase RPC tanpa password bawaan (hardcode).
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Memverifikasi...'
                  : isInitialSetup
                  ? 'Simpan & Masuk Admin'
                  : 'Verifikasi Akses'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
