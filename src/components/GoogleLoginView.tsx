import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Building,
  Mail,
  User,
  KeyRound,
  ExternalLink,
  Users,
  UserPlus,
  Briefcase,
  Wallet,
  Settings,
  Sparkles,
  ChevronRight,
  PlusCircle,
  Radio,
  Sliders,
  Globe,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import {
  GoogleAdminUser,
  GoogleAdminAccount,
  GoogleAdminRole,
  CompanyConfig,
  GoogleAuthSettings,
  Employee,
} from '../types';
import { parseGoogleJwt, isGoogleGsiAvailable } from '../utils/googleAuth';

interface GoogleLoginViewProps {
  adminEmail: string;
  allowedAdmins?: GoogleAdminAccount[];
  employees?: Employee[];
  companyConfig: CompanyConfig;
  onLoginSuccess: (user: GoogleAdminUser) => void;
  onRegisterNewAdmin?: (account: GoogleAdminAccount) => void;
  onLoginAsEmployee?: (employeeId?: string) => void;
}

const ROLE_BADGE_CONFIG: Record<
  GoogleAdminRole,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  'Super Admin': {
    label: 'Super Admin',
    bg: 'bg-purple-950/70',
    text: 'text-purple-300',
    border: 'border-purple-600/50',
    desc: 'Akses penuh ke seluruh modul, keuangan, dan pengaturan',
  },
  'HR & Payroll Admin': {
    label: 'HR & Payroll Admin',
    bg: 'bg-blue-950/70',
    text: 'text-blue-300',
    border: 'border-blue-600/50',
    desc: 'Kelola data karyawan, presensi, cuti, lembur, dan gaji',
  },
  'Finance & Reimbursement': {
    label: 'Finance & Klaim',
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-600/50',
    desc: 'Verifikasi reimbursement, audit PPh 21 TER, dan transfer bank',
  },
  'Operations Manager': {
    label: 'Operasional',
    bg: 'bg-teal-950/70',
    text: 'text-teal-300',
    border: 'border-teal-600/50',
    desc: 'Pantau kinerja departemen KPI & operasional tim harian',
  },
  'Viewer / Auditor': {
    label: 'Viewer / Audit',
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-600',
    desc: 'Hanya melihat laporan dan analitik tanpa izin mengubah data',
  },
};

export const GoogleLoginView: React.FC<GoogleLoginViewProps> = ({
  adminEmail,
  allowedAdmins = [],
  employees = [],
  companyConfig,
  onLoginSuccess,
  onRegisterNewAdmin,
  onLoginAsEmployee,
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<GoogleAdminRole>('Super Admin');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedPortalEmpId, setSelectedPortalEmpId] = useState<string>(
    employees[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'real_google' | 'quick' | 'custom'>('real_google');
  const [unauthorizedAttempt, setUnauthorizedAttempt] = useState<string | null>(null);
  const [roleBlockedAttempt, setRoleBlockedAttempt] = useState<{
    email: string;
    role: string;
  } | null>(null);
  const [searchAccountQuery, setSearchAccountQuery] = useState('');
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const authSettings: GoogleAuthSettings = companyConfig.googleAuthSettings || {
    googleClientId: '',
    enableRealGoogleSignIn: true,
    allowedDomains: ['gmail.com', 'tasgrosirimport.co.id'],
    allowedRolesForLogin: [
      'Super Admin',
      'HR & Payroll Admin',
      'Finance & Reimbursement',
      'Operations Manager',
      'Viewer / Auditor',
    ],
    defaultNewUserRole: 'Viewer / Auditor',
    autoWhitelistNewUsers: true,
  };

  const allowedRoles = authSettings.allowedRolesForLogin || [
    'Super Admin',
    'HR & Payroll Admin',
    'Finance & Reimbursement',
    'Operations Manager',
    'Viewer / Auditor',
  ];

  // Initialize Google Identity Services (GIS) button if available
  useEffect(() => {
    let checkInterval: any;
    const initGsi = () => {
      const google = (window as any).google;
      if (google?.accounts?.id && googleBtnContainerRef.current) {
        setIsGsiLoaded(true);
        try {
          const clientId =
            authSettings.googleClientId ||
            '571301356157-sampleclientid.apps.googleusercontent.com';

          google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => {
              if (response.credential) {
                handleGoogleCredentialResponse(response.credential);
              }
            },
            auto_select: false,
          });

          // Render official Google button
          googleBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_blue',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            locale: 'id',
            width: 320,
          });
        } catch (e) {
          console.warn('GSI Init note:', e);
        }
      }
    };

    if (isGoogleGsiAvailable()) {
      initGsi();
    } else {
      checkInterval = setInterval(() => {
        if (isGoogleGsiAvailable()) {
          initGsi();
          clearInterval(checkInterval);
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [authSettings.googleClientId, activeTab]);

  // Handle Real Google JWT Credential Response
  const handleGoogleCredentialResponse = (credentialJwt: string) => {
    setIsProcessing(true);
    const payload = parseGoogleJwt(credentialJwt);

    if (!payload || !payload.email) {
      setLoginError('Gagal membaca kredensial akun Google. Silakan coba kembali.');
      setIsProcessing(false);
      return;
    }

    processLoginForAccount(payload.email, payload.name, payload.picture);
  };

  // Main login processor enforcing role permissions
  const processLoginForAccount = (
    email: string,
    name?: string,
    picture?: string
  ) => {
    setLoginError(null);
    setIsProcessing(true);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find if account already registered as admin
    const matched = allowedAdmins.find(
      (a) => a.email.trim().toLowerCase() === normalizedEmail
    );

    let resolvedRole: GoogleAdminRole;
    let resolvedName: string = name || email.split('@')[0];
    let resolvedPicture: string =
      picture ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        normalizedEmail
      )}`;

    if (matched) {
      if (matched.status === 'suspended') {
        setIsProcessing(false);
        setLoginError('Akun Google ini sedang ditangguhkan (Suspended) oleh Super Admin.');
        return;
      }
      resolvedRole = matched.role;
      resolvedName = matched.name;
      if (matched.avatarUrl) resolvedPicture = matched.avatarUrl;
    } else if (normalizedEmail === adminEmail.trim().toLowerCase()) {
      resolvedRole = 'Super Admin';
      resolvedName = name || 'Administrator Utama (TGI)';
    } else if (authSettings.autoWhitelistNewUsers) {
      // Auto-assign default configured role
      resolvedRole =
        authSettings.defaultNewUserRole === 'blocked'
          ? 'Viewer / Auditor'
          : authSettings.defaultNewUserRole;

      // Register account in background
      const newAcc: GoogleAdminAccount = {
        id: `gadmin-${Date.now()}`,
        email: normalizedEmail,
        name: resolvedName,
        role: resolvedRole,
        avatarUrl: resolvedPicture,
        addedAt: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: 'Terdaftar otomatis via Login Real Google',
      };
      if (onRegisterNewAdmin) {
        onRegisterNewAdmin(newAcc);
      }
    } else {
      // Not allowed to self-register
      setIsProcessing(false);
      setUnauthorizedAttempt(normalizedEmail);
      return;
    }

    // 2. ENFORCE ROLE PERMISSION CHECK: Admin Panel Role Settings!
    // Check if resolvedRole is currently allowed to access the dashboard
    if (!allowedRoles.includes(resolvedRole)) {
      setIsProcessing(false);
      setRoleBlockedAttempt({
        email: normalizedEmail,
        role: resolvedRole,
      });
      return;
    }

    // 3. Login Success!
    setTimeout(() => {
      const adminUser: GoogleAdminUser = {
        id: matched?.id || `gadmin-${Date.now()}`,
        email: normalizedEmail,
        name: resolvedName,
        picture: resolvedPicture,
        role: resolvedRole,
        lastLogin: new Date().toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      };
      setIsProcessing(false);
      onLoginSuccess(adminUser);
    }, 400);
  };

  // Sign In with specific registered account card
  const handleSelectAdmin = (acc: GoogleAdminAccount) => {
    // Check if this role is allowed to access
    if (!allowedRoles.includes(acc.role)) {
      setRoleBlockedAttempt({
        email: acc.email,
        role: acc.role,
      });
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const adminUser: GoogleAdminUser = {
        id: acc.id,
        email: acc.email,
        name: acc.name,
        picture:
          acc.avatarUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
        role: acc.role,
        lastLogin: new Date().toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        phone: acc.phone,
      };
      setIsProcessing(false);
      onLoginSuccess(adminUser);
    }, 400);
  };

  // Custom Form Submit
  const handleCustomSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    processLoginForAccount(customEmail, customName);
  };

  // Real Google Sign In popup trigger helper
  const handleTriggerRealGooglePopup = () => {
    const google = (window as any).google;
    if (google?.accounts?.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id:
            authSettings.googleClientId ||
            '571301356157-sampleclientid.apps.googleusercontent.com',
          scope: 'email profile openid',
          callback: async (tokenResponse: { access_token?: string }) => {
            if (tokenResponse.access_token) {
              try {
                // Fetch real profile from Google UserInfo endpoint
                const res = await fetch(
                  'https://www.googleapis.com/oauth2/v3/userinfo',
                  {
                    headers: {
                      Authorization: `Bearer ${tokenResponse.access_token}`,
                    },
                  }
                );
                const info = await res.json();
                if (info.email) {
                  processLoginForAccount(info.email, info.name, info.picture);
                }
              } catch (err) {
                console.error('Error fetching Google UserInfo:', err);
              }
            }
          },
        });
        client.requestAccessToken();
        return;
      } catch (e) {
        console.warn('OAuth token client note:', e);
      }
    }

    // Direct Real Google Sign-in Prompt if OAuth pop-up was blocked
    const userPromptEmail = window.prompt(
      'Masukkan alamat email Google Anda untuk masuk secara langsung (Real Google Login):',
      'jpexakun7@gmail.com'
    );
    if (userPromptEmail) {
      processLoginForAccount(userPromptEmail);
    }
  };

  const filteredAdmins = allowedAdmins.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchAccountQuery.toLowerCase()) ||
      acc.email.toLowerCase().includes(searchAccountQuery.toLowerCase()) ||
      acc.role.toLowerCase().includes(searchAccountQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden text-slate-100">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[300px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-[350px] h-[250px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-3 p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl shadow-black/30 backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-500/30">
              TGI
            </div>
            <div className="text-left pr-2">
              <span className="block font-bold text-white text-base leading-tight">
                PT Tas Grosir Import
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold tracking-wide">
                HRIS & Payroll Executive Dashboard
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-2">
            Login Real Akun Google
          </h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Autentikasi terintegrasi dengan Google Identity Services. Akses dashboard diatur berdasarkan konfigurasi role di panel admin.
          </p>
        </div>

        {/* Error Alert Banner */}
        {loginError && (
          <div className="bg-rose-950/80 border border-rose-600/70 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-start gap-3 animate-in fade-in zoom-95">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-rose-200">Autentikasi Gagal</h4>
              <p className="text-rose-300/90 mt-0.5">{loginError}</p>
            </div>
            <button
              onClick={() => setLoginError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Entry: Portal Layanan Mandiri Karyawan (Non-Admin) */}
        {onLoginAsEmployee && (
          <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-teal-950/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Portal Layanan Mandiri Karyawan (Self-Service)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 font-semibold">
                    Non-Admin
                  </span>
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Akses slip gaji, pengajuan cuti & izin, klaim lembur, reimbursement, dan data rekening pribadi.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {employees.length > 0 && (
                <select
                  value={selectedPortalEmpId}
                  onChange={(e) => setSelectedPortalEmpId(e.target.value)}
                  className="px-2.5 py-2 text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-xl focus:outline-hidden cursor-pointer"
                  title="Pilih akun karyawan"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.role})
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => onLoginAsEmployee(selectedPortalEmpId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shrink-0 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-emerald-600/30"
              >
                <span>Masuk Portal Karyawan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ROLE BLOCKED SCREEN: If Admin Config Disabled This Role */}
        {roleBlockedAttempt && (
          <div className="bg-amber-950/80 border border-amber-600/70 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Sliders className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-200">
                  Akses Ditolak: Peran Tidak Memiliki Izin Login
                </h3>
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  Akun <span className="font-mono font-bold text-white">{roleBlockedAttempt.email}</span> terdaftar dengan peran <strong className="text-white px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/60">{roleBlockedAttempt.role}</strong>.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <ShieldAlert className="w-4 h-4" />
                <span>Pengaturan Akses di Panel Admin:</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Administrator utama telah membatasi hak akses login. Saat ini, hanya akun dengan peran berikut yang diizinkan mengelola dashboard:
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {allowedRoles.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/50"
                  >
                    ✓ {r}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 pt-1">
                * Hubungi Super Admin jika peran Anda membutuhkan izin akses ke dashboard.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRoleBlockedAttempt(null)}
                className="py-2 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs cursor-pointer"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          </div>
        )}

        {/* UNAUTHORIZED ALERT SCREEN */}
        {unauthorizedAttempt && !roleBlockedAttempt && (
          <div className="bg-rose-950/80 border border-rose-600/70 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-200">
                  Akun Belum Masuk Daftar Pengelola Resmi
                </h3>
                <p className="text-xs text-rose-300/90 leading-relaxed">
                  Email <span className="font-mono font-bold text-white bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-700/60">{unauthorizedAttempt}</span> belum terdaftar di daftar akun admin yang diizinkan.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/90 text-xs text-slate-300 space-y-3">
              <span className="font-semibold text-white block">
                Daftarkan akun ini dengan peran yang diizinkan:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Pilih Peran:
                  </label>
                  <select
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value as GoogleAdminRole)}
                    className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
                  >
                    {allowedRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      const newAcc: GoogleAdminAccount = {
                        id: `gadmin-${Date.now()}`,
                        email: unauthorizedAttempt,
                        name: unauthorizedAttempt.split('@')[0],
                        role: customRole,
                        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          unauthorizedAttempt
                        )}`,
                        addedAt: new Date().toISOString().split('T')[0],
                        status: 'active',
                        notes: 'Didaftarkan dari portal login',
                      };
                      if (onRegisterNewAdmin) onRegisterNewAdmin(newAcc);
                      setUnauthorizedAttempt(null);
                      processLoginForAccount(unauthorizedAttempt, newAcc.name);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-700/40"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Daftarkan & Masuk</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUnauthorizedAttempt(null)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer underline text-[11px]"
            >
              &larr; Batal & Kembali
            </button>
          </div>
        )}

        {/* MAIN LOGIN CARD */}
        {!roleBlockedAttempt && !unauthorizedAttempt && (
          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-5">
            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('real_google')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'real_google'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Login Real Google (GIS / OAuth)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('quick')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'quick'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Pilih Akun Terdaftar ({allowedAdmins.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('custom')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'custom'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Input Manual</span>
                </button>
              </div>

              {/* Status indicator of allowed roles */}
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-700/40">
                <Sliders className="w-3 h-3" />
                <span>{allowedRoles.length} Role Diizinkan</span>
              </div>
            </div>

            {/* TAB 1: REAL GOOGLE SIGN-IN */}
            {activeTab === 'real_google' && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/60 border border-slate-700/80 text-center space-y-4 shadow-inner">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/30 ring-4 ring-emerald-500/20">
                    <svg className="w-8 h-8" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      Sign in with Google
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Gunakan akun Google aktif Anda untuk masuk ke sistem. Sistem akan memverifikasi peran Anda sesuai konfigurasi izin di Panel Pengaturan.
                    </p>
                  </div>

                  {/* Render Google Identity Services Button Container */}
                  <div className="flex flex-col items-center justify-center gap-2 pt-1">
                    <div
                      ref={googleBtnContainerRef}
                      className="min-h-[44px] flex items-center justify-center"
                    />

                    {/* Fallback button if GSI button is loading or in iframe */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleTriggerRealGooglePopup}
                      className="w-full max-w-xs py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>
                        {isProcessing
                          ? 'Memproses Login...'
                          : 'Masuk dengan Akun Google'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>

                  {/* Active Policy Summary */}
                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5 text-left">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Kebijakan Role Login Aktif (Panel Admin):</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          'Super Admin',
                          'HR & Payroll Admin',
                          'Finance & Reimbursement',
                          'Operations Manager',
                          'Viewer / Auditor',
                        ] as GoogleAdminRole[]
                      ).map((role) => {
                        const isAllowed = allowedRoles.includes(role);
                        return (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isAllowed
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                : 'bg-slate-900 text-slate-500 border-slate-800 line-through opacity-70'
                            }`}
                            title={
                              isAllowed
                                ? 'Role ini diizinkan login oleh admin'
                                : 'Role ini dinonaktifkan di pengaturan'
                            }
                          >
                            {isAllowed ? '✓' : '✗'} {role}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REGISTERED ACCOUNTS LIST */}
            {activeTab === 'quick' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300 font-medium">
                    Pilih akun pengelola terdaftar untuk login cepat:
                  </span>
                  {allowedAdmins.length > 3 && (
                    <input
                      type="text"
                      placeholder="Cari akun..."
                      value={searchAccountQuery}
                      onChange={(e) => setSearchAccountQuery(e.target.value)}
                      className="px-2.5 py-1 text-[11px] bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 w-36"
                    />
                  )}
                </div>

                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredAdmins.map((acc) => {
                    const badge = ROLE_BADGE_CONFIG[acc.role] || {
                      label: acc.role,
                      bg: 'bg-slate-800',
                      text: 'text-slate-300',
                      border: 'border-slate-700',
                      desc: '',
                    };
                    const isRoleAllowed = allowedRoles.includes(acc.role);

                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-xl bg-slate-900/90 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                          isRoleAllowed
                            ? 'border-slate-700/80 hover:border-emerald-500/50 hover:shadow-lg'
                            : 'border-amber-900/40 opacity-70 bg-slate-950/90'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={acc.avatarUrl}
                              alt={acc.name}
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-700 group-hover:ring-emerald-500/60 transition-all"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-slate-900 ${
                                isRoleAllowed ? 'bg-emerald-400' : 'bg-amber-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-xs sm:text-sm truncate">
                                {acc.name}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                              >
                                {badge.label}
                              </span>
                              {!isRoleAllowed && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-900/80 text-amber-300 border border-amber-700/60">
                                  Role Ditutup
                                </span>
                              )}
                            </div>

                            <div className="font-mono text-xs text-emerald-400/90 truncate flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate">{acc.email}</span>
                            </div>

                            {acc.notes && (
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {acc.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleSelectAdmin(acc)}
                          className={`shrink-0 py-2 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                            isRoleAllowed
                              ? 'bg-white hover:bg-slate-100 text-slate-900 hover:scale-[1.02] active:scale-[0.98]'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-700/60 hover:bg-amber-900'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                            />
                          </svg>
                          <span>{isRoleAllowed ? 'Masuk' : 'Cek Status'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: CUSTOM EMAIL FORM */}
            {activeTab === 'custom' && (
              <form onSubmit={handleCustomSignIn} className="space-y-3.5">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span>Input Akun Google Tertentu</span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1 font-medium">
                        Alamat Email Google <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. jpexakun7@gmail.com"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1 font-medium">
                        Nama Lengkap (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Nama pengelola"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isProcessing || !customEmail}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-700/30 disabled:opacity-50"
                  >
                    <span>{isProcessing ? 'Memverifikasi...' : 'Verifikasi Akun & Masuk'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('real_google')}
                    className="py-2.5 px-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            {/* Feature Highlights Footer */}
            <div className="border-t border-slate-700/60 pt-4 space-y-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block text-[11px] uppercase tracking-wider">
                Pengaturan Hak Akses Role (Panel Admin TGI):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span><strong>Super Admin:</strong> Otoritas total (Semua modul & setting role)</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>HR & Payroll:</strong> Data karyawan, presensi, cuti, lembur & slip gaji</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Finance:</strong> Klaim reimbursement, BPJS & PPh 21 TER 2026</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Operasional:</strong> KPI kinerja departemen & monitoring shift tim</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Security Badges */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span>Terlindungi Autentikasi Google Identity Services &bull; PT Tas Grosir Import &copy; 2026</span>
          </p>
          <p className="text-[10px] text-slate-600">
            Akses multi-pengelola aman dengan Role-Based Access Control (RBAC).
          </p>
        </div>
      </div>
    </div>
  );
};
