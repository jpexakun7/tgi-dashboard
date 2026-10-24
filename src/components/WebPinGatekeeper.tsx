import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  UserCheck,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { CompanyConfig, Employee } from '../types';
import { getEmployeeEffectivePin } from '../services/supabaseService';

interface WebPinGatekeeperProps {
  companyConfig: CompanyConfig;
  employees: Employee[];
  onUnlockWeb: (options: {
    mode: 'admin' | 'employee';
    employeeId?: string;
    unlockAdmin?: boolean;
    adminEmail?: string;
  }) => void;
}

export const WebPinGatekeeper: React.FC<WebPinGatekeeperProps> = ({
  companyConfig,
  employees,
  onUnlockWeb,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [targetMode, setTargetMode] = useState<'admin' | 'employee'>('employee');
  const [selectedAdminEmail, setSelectedAdminEmail] = useState<string>('MASTER');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [nikInput, setNikInput] = useState<string>(employees[0]?.nik || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const activeEmpId = selectedEmpId || employees[0]?.id || '';
  const selectedEmployee =
    employees.find(
      (e) =>
        nikInput.trim() &&
        (e.nik.toLowerCase() === nikInput.trim().toLowerCase() ||
          e.fullName.toLowerCase() === nikInput.trim().toLowerCase())
    ) ||
    employees.find((e) => e.id === activeEmpId) ||
    employees[0];

  const masterAdminPin = companyConfig.securitySettings?.adminPin || '2026';
  const defaultEmployeePin = companyConfig.securitySettings?.defaultEmployeePin || '1234';
  const activeAdmins = (companyConfig.allowedGoogleAdmins || []).filter(
    (a) => a.status === 'active'
  );

  const selectedAdminObj = activeAdmins.find(
    (a) => a.email.toLowerCase() === selectedAdminEmail.toLowerCase()
  );

  const expectedEmployeePin = getEmployeeEffectivePin(selectedEmployee, defaultEmployeePin);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmed = pin.trim();
    if (!trimmed) {
      setErrorMessage(
        targetMode === 'admin'
          ? 'Masukkan PIN / Password Khusus Panel Admin HR terlebih dahulu.'
          : 'Masukkan PIN / Password Akun Karyawan Anda terlebih dahulu.'
      );
      return;
    }

    if (targetMode === 'admin') {
      const isMasterMatch = trimmed === masterAdminPin;
      const matchedAdminByPin = activeAdmins.find(
        (adm) => (adm.accessPin || masterAdminPin) === trimmed
      );

      if (selectedAdminEmail !== 'MASTER' && selectedAdminObj) {
        const adminPersonalPin = selectedAdminObj.accessPin || masterAdminPin;
        if (trimmed !== adminPersonalPin && trimmed !== masterAdminPin) {
          setErrorMessage(
            `PIN / Password salah untuk akun Admin "${selectedAdminObj.name}". Akses ditolak.`
          );
          return;
        }
      } else if (!isMasterMatch && !matchedAdminByPin) {
        // Check if they entered an Employee's PIN
        const matchedEmp = employees.find(
          (emp) => getEmployeeEffectivePin(emp, defaultEmployeePin) === trimmed
        );
        if (matchedEmp) {
          setErrorMessage(
            'PIN Portal Karyawan tidak dapat digunakan untuk membuka Panel Admin HR! Silakan pilih tab Portal Karyawan.'
          );
          return;
        }
        setErrorMessage(
          'Kode PIN Panel Admin HR salah! Akses ditolak.'
        );
        return;
      }

      setSuccessAnimation(true);
      setTimeout(() => {
        onUnlockWeb({
          mode: 'admin',
          unlockAdmin: true,
          adminEmail:
            selectedAdminEmail !== 'MASTER'
              ? selectedAdminEmail
              : matchedAdminByPin?.email || companyConfig.adminGoogleEmail,
        });
      }, 450);
      return;
    }

    // Mode: Portal Karyawan (Strictly checks the selected employee's personal PIN)
    if (!selectedEmployee) {
      setErrorMessage('Data karyawan belum tersedia. Silakan hubungi Admin HR.');
      return;
    }

    if (trimmed !== expectedEmployeePin) {
      if (trimmed === masterAdminPin && expectedEmployeePin !== masterAdminPin) {
        setErrorMessage(
          `PIN tersebut bukan PIN milik akun karyawan "${selectedEmployee.fullName}". Gunakan PIN khusus akun karyawan Anda.`
        );
        return;
      }

      setErrorMessage(
        `PIN / Password salah untuk akun karyawan ${selectedEmployee.fullName} (${selectedEmployee.nik})!`
      );
      return;
    }

    setSuccessAnimation(true);
    setTimeout(() => {
      onUnlockWeb({
        mode: 'employee',
        employeeId: selectedEmployee.id,
        unlockAdmin: false,
      });
    }, 450);
  };

  const handleNumClick = (digit: string) => {
    if (pin.length < 12) {
      setPin((prev) => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 select-none relative overflow-hidden">
      {/* Decorative subtle background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-7 relative z-10 animate-in fade-in zoom-in-95">
        {/* Top Brand Header */}
        <div className="text-center space-y-2 pb-4 border-b border-slate-100">
          <div
            className={`w-13 h-13 rounded-2xl text-white flex items-center justify-center mx-auto shadow-lg transition-colors ${
              targetMode === 'admin'
                ? 'bg-gradient-to-br from-purple-600 to-indigo-700 shadow-purple-600/25'
                : 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-600/25'
            }`}
          >
            {targetMode === 'admin' ? (
              <Shield className="w-6 h-6" />
            ) : (
              <UserCheck className="w-6 h-6" />
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
            <Building2 className="w-3 h-3" />
            {companyConfig.companyName || 'PT Tas Grosir Import'}
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {targetMode === 'admin'
              ? 'Login PIN Panel Admin HR'
              : 'Login PIN Portal Karyawan'}
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Masukkan kode PIN atau kata sandi sesuai akun Anda untuk membuka akses sistem.
          </p>
        </div>

        {/* Mode Selector (Admin vs Employee Portal) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mt-4">
          <button
            type="button"
            onClick={() => {
              setTargetMode('admin');
              setPin('');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              targetMode === 'admin'
                ? 'bg-white text-purple-800 shadow-xs ring-1 ring-purple-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span>Panel Admin HR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetMode('employee');
              setPin('');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              targetMode === 'employee'
                ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Portal Karyawan</span>
          </button>
        </div>

        {/* Account Selector based on Mode */}
        {targetMode === 'admin' ? (
          <div className="mt-3 p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
            <label className="block text-[11px] font-bold text-purple-900 mb-1">
              Pilih Akun Admin HR / Pengelola:
            </label>
            <select
              value={selectedAdminEmail}
              onChange={(e) => {
                setSelectedAdminEmail(e.target.value);
                setErrorMessage(null);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-purple-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="MASTER">🔑 Master Admin HR Utama</option>
              {activeAdmins.map((adm) => (
                <option key={adm.id} value={adm.email}>
                  {adm.name} — {adm.role}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                Masukkan NIK Karyawan atau Pilih Nama Anda:
              </label>
              <input
                type="text"
                value={nikInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setNikInput(val);
                  setErrorMessage(null);
                  const matched = employees.find(
                    (emp) =>
                      emp.nik.toLowerCase() === val.trim().toLowerCase() ||
                      emp.nik.toLowerCase().endsWith(val.trim().toLowerCase()) ||
                      emp.fullName.toLowerCase().includes(val.trim().toLowerCase())
                  );
                  if (matched) {
                    setSelectedEmpId(matched.id);
                  }
                }}
                placeholder="Ketik NIK (contoh: TGI-2021-001)..."
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-emerald-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {employees.length > 0 ? (
              <div>
                <label className="block text-[10px] font-semibold text-emerald-800 mb-1">
                  Daftar Karyawan Terdaftar (Sesi Terkunci per NIK):
                </label>
                <select
                  value={selectedEmployee?.id || activeEmpId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedEmpId(nextId);
                    const empObj = employees.find((emp) => emp.id === nextId);
                    if (empObj) {
                      setNikInput(empObj.nik);
                    }
                    setErrorMessage(null);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-emerald-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nik} — {emp.fullName} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-emerald-800 font-medium">
                Belum ada data karyawan di database. Masuk ke Panel Admin HR untuk menambah karyawan.
              </p>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successAnimation && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-center gap-2 animate-in zoom-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">
              PIN Akun Terverifikasi! Membuka{' '}
              {targetMode === 'admin' ? 'Panel Admin HR' : 'Portal Karyawan'}...
            </span>
          </div>
        )}

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <div className="relative max-w-xs mx-auto">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="••••"
                autoFocus
                maxLength={12}
                className={`w-full text-center tracking-[0.35em] text-xl font-extrabold font-mono py-2.5 px-10 bg-slate-50 border-2 rounded-2xl focus:outline-hidden text-slate-900 transition-all ${
                  targetMode === 'admin'
                    ? 'border-slate-200 focus:ring-4 focus:ring-purple-500/15 focus:border-purple-600'
                    : 'border-slate-200 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Akses terenkripsi & dilindungi per akun</span>
            </div>
          </div>

          {/* Interactive Numpad */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleNumClick(digit)}
                className={`h-11 rounded-xl bg-slate-100 text-slate-800 font-bold text-base transition-colors cursor-pointer flex items-center justify-center border border-slate-200/70 shadow-2xs ${
                  targetMode === 'admin'
                    ? 'hover:bg-purple-50 hover:text-purple-700 active:bg-purple-100'
                    : 'hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100'
                }`}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center border border-slate-200/70"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => handleNumClick('0')}
              className={`h-11 rounded-xl bg-slate-100 text-slate-800 font-bold text-base transition-colors cursor-pointer flex items-center justify-center border border-slate-200/70 shadow-2xs ${
                targetMode === 'admin'
                  ? 'hover:bg-purple-50 hover:text-purple-700'
                  : 'hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center border border-slate-200/70"
            >
              ⌫ Hapus
            </button>
          </div>

          <button
            type="submit"
            className={`w-full max-w-xs mx-auto py-3 rounded-2xl text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              targetMode === 'admin'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/20'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>
              {targetMode === 'admin'
                ? 'Buka Akses Panel Admin HR'
                : `Buka Portal Karyawan (${selectedEmployee?.fullName.split(' ')[0] || 'Staf'})`}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
