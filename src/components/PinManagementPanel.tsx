import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Shield,
  UserCheck,
  Save,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Database,
} from 'lucide-react';
import {
  CompanyConfig,
  Employee,
  GoogleAdminAccount,
  ActivityActionType,
  ActivityCategory,
} from '../types';
import { getEmployeeEffectivePin } from '../services/supabaseService';

interface PinManagementPanelProps {
  companyConfig: CompanyConfig;
  onUpdateConfig: (newConfig: CompanyConfig) => void;
  employees: Employee[];
  onUpdateEmployee?: (updatedEmp: Employee) => void;
  onLogAudit?: (
    actionType: ActivityActionType,
    category: ActivityCategory,
    description: string,
    meta?: any
  ) => void;
}

export const PinManagementPanel: React.FC<PinManagementPanelProps> = ({
  companyConfig,
  onUpdateConfig,
  employees,
  onUpdateEmployee,
  onLogAudit,
}) => {
  const [masterAdminPin, setMasterAdminPin] = useState(
    companyConfig.securitySettings?.adminPin || '2026'
  );
  const [defaultEmployeePin, setDefaultEmployeePin] = useState(
    companyConfig.securitySettings?.defaultEmployeePin || '1234'
  );
  const [requirePinForWebAccess, setRequirePinForWebAccess] = useState(
    companyConfig.securitySettings?.requirePinForWebAccess ?? true
  );
  const [requirePinForAdminMode, setRequirePinForAdminMode] = useState(
    companyConfig.securitySettings?.requirePinForAdminMode ?? true
  );

  // Per-Admin PIN edits state: { [adminId]: pinString }
  const [adminPins, setAdminPins] = useState<Record<string, string>>({});

  // Per-Employee PIN edits state: { [employeeId]: pinString }
  const [employeePins, setEmployeePins] = useState<Record<string, string>>({});

  const [showAllPins, setShowAllPins] = useState(false);
  const [searchEmp, setSearchEmp] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMasterAdminPin(companyConfig.securitySettings?.adminPin || '2026');
    setDefaultEmployeePin(companyConfig.securitySettings?.defaultEmployeePin || '1234');
    setRequirePinForWebAccess(companyConfig.securitySettings?.requirePinForWebAccess ?? true);
    setRequirePinForAdminMode(companyConfig.securitySettings?.requirePinForAdminMode ?? true);

    const initAdminPins: Record<string, string> = {};
    (companyConfig.allowedGoogleAdmins || []).forEach((adm) => {
      initAdminPins[adm.id] = adm.accessPin || companyConfig.securitySettings?.adminPin || '2026';
    });
    setAdminPins(initAdminPins);
  }, [companyConfig]);

  useEffect(() => {
    const initEmpPins: Record<string, string> = {};
    const defPin = companyConfig.securitySettings?.defaultEmployeePin || '1234';
    employees.forEach((emp) => {
      initEmpPins[emp.id] = getEmployeeEffectivePin(emp, defPin);
    });
    setEmployeePins(initEmpPins);
  }, [employees, companyConfig.securitySettings?.defaultEmployeePin]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCopyPin = (id: string, pinVal: string) => {
    navigator.clipboard.writeText(pinVal);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save Master Admin PIN & Per-Admin Account PINs
  const handleSaveAdminPinConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedMasterPin = masterAdminPin.trim() || '2026';
    const cleanedDefaultEmpPin = defaultEmployeePin.trim() || '1234';

    const updatedAdmins: GoogleAdminAccount[] = (companyConfig.allowedGoogleAdmins || []).map(
      (adm) => ({
        ...adm,
        accessPin: (adminPins[adm.id] || cleanedMasterPin).trim(),
      })
    );

    const newConfig: CompanyConfig = {
      ...companyConfig,
      allowedGoogleAdmins: updatedAdmins,
      securitySettings: {
        ...companyConfig.securitySettings,
        adminPin: cleanedMasterPin,
        webAccessPin: cleanedMasterPin,
        defaultEmployeePin: cleanedDefaultEmpPin,
        requirePinForWebAccess,
        requirePinForAdminMode,
      },
    };

    onUpdateConfig(newConfig);
    showToast('Pengaturan PIN Panel Admin HR & Keamanan Akses Web berhasil disimpan!');

    if (onLogAudit) {
      onLogAudit(
        'SETTINGS_MODIFIED',
        'Hak Akses & Admin',
        `Memperbarui konfigurasi PIN Panel Admin HR (Master PIN: ${cleanedMasterPin}) dan PIN masing-masing akun Admin.`,
        {
          targetId: 'admin-pin-settings',
          targetName: 'PIN Panel Admin HR',
          severity: 'warning',
        }
      );
    }
  };

  // Save a single employee's PIN to state, localStorage, and Supabase
  const handleSaveSingleEmployeePin = (emp: Employee) => {
    const newPin = (employeePins[emp.id] || '').trim();
    if (!newPin) {
      showToast(`PIN untuk ${emp.fullName} tidak boleh kosong!`);
      return;
    }

    if (onUpdateEmployee) {
      onUpdateEmployee({
        ...emp,
        accessPin: newPin,
      });
    }

    showToast(
      `PIN Portal Karyawan untuk ${emp.fullName} (${emp.nik}) berhasil diubah menjadi "${newPin}" & disinkronkan ke Supabase!`
    );

    if (onLogAudit) {
      onLogAudit(
        'USER_ACCESS_CHANGED',
        'Data Karyawan',
        `Mengubah kode PIN akses Portal Karyawan untuk ${emp.fullName} (${emp.nik}).`,
        {
          targetId: emp.id,
          targetName: `${emp.fullName} (${emp.nik})`,
          newValue: `PIN Baru: ${newPin}`,
          severity: 'info',
        }
      );
    }
  };

  // Auto-generate unique PINs based on NIK for all employees
  const handleGenerateUniqueNikPins = () => {
    const nextMap: Record<string, string> = { ...employeePins };
    employees.forEach((emp, idx) => {
      const digits = emp.nik.replace(/\D/g, '');
      const uniquePin = digits.length >= 3 ? `1${digits.slice(-3)}` : `${1001 + idx}`;
      // Ensure it never collides with masterAdminPin
      const safePin = uniquePin === masterAdminPin ? `9${uniquePin.slice(1)}` : uniquePin;
      nextMap[emp.id] = safePin;
      if (onUpdateEmployee) {
        onUpdateEmployee({
          ...emp,
          accessPin: safePin,
        });
      }
    });
    setEmployeePins(nextMap);
    showToast(
      `Berhasil membuat & menyimpan PIN unik otomatis untuk ${employees.length} akun karyawan ke Cloud Supabase!`
    );
  };

  // Save all modified employee PINs at once
  const handleSaveAllEmployeePins = () => {
    let updatedCount = 0;
    employees.forEach((emp) => {
      const targetPin = (employeePins[emp.id] || '').trim();
      if (targetPin && targetPin !== emp.accessPin) {
        if (onUpdateEmployee) {
          onUpdateEmployee({
            ...emp,
            accessPin: targetPin,
          });
        }
        updatedCount++;
      }
    });

    showToast(
      updatedCount > 0
        ? `Berhasil menyimpan ${updatedCount} perubahan PIN akun karyawan ke Supabase!`
        : 'Seluruh PIN akun karyawan sudah tersimpan dan sinkron.'
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchEmp.toLowerCase();
    const matchText =
      emp.fullName.toLowerCase().includes(q) ||
      emp.nik.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q);
    const matchDept = deptFilter === 'ALL' || emp.department === deptFilter;
    return matchText && matchDept;
  });

  const departments = Array.from(new Set(employees.map((e) => e.department)));

  return (
    <div className="space-y-6 animate-fade-in">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner: Explanation of Dual-Layer Per-Account PIN Architecture */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg border border-purple-700/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[10px] font-bold uppercase tracking-wider">
              <KeyRound className="w-3 h-3" />
              Sistem Keamanan PIN Per Akun (Terpisah)
            </div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              Manajemen PIN & Password Akses Web Sesuai Akun
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Atur kode PIN / Password yang berbeda untuk setiap akun. <strong>PIN Panel Admin HR</strong> dan{' '}
              <strong>PIN Portal Karyawan</strong> dipisahkan secara ketat: karyawan hanya bisa login ke profil pribadinya sendiri dan <u>tidak bisa</u> menggunakan PIN mereka untuk membuka Panel Admin HR maupun melihat gaji karyawan lain.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAllPins(!showAllPins)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 transition-colors cursor-pointer"
            >
              {showAllPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showAllPins ? 'Sembunyikan Angka PIN' : 'Tampilkan Semua PIN'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAGIAN 1: PIN PANEL ADMIN HR & DAFTAR PIN AKUN ADMIN                  */}
      {/* ===================================================================== */}
      <form
        onSubmit={handleSaveAdminPinConfig}
        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
      >
        <div className="p-5 bg-purple-50/60 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                1. Pengaturan PIN Khusus Panel Admin HR (Master & Per Akun Admin)
              </h3>
              <p className="text-xs text-slate-500">
                Hanya PIN di bawah ini yang diizinkan membuka <strong>Panel Admin HR & Penggajian</strong>.
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>Simpan PIN Admin HR</span>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Master PIN & Security Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-1.5">
              <label className="block font-bold text-purple-950">
                🔑 PIN Master Panel Admin HR
              </label>
              <div className="relative">
                <input
                  type={showAllPins ? 'text' : 'password'}
                  maxLength={12}
                  required
                  value={masterAdminPin}
                  onChange={(e) => setMasterAdminPin(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl font-mono text-sm font-extrabold text-purple-900 tracking-widest focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  placeholder="2026"
                />
                <KeyRound className="w-4 h-4 text-purple-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-purple-800">
                Digunakan untuk membuka kunci utama Panel Admin HR & Payroll.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block font-bold text-slate-800">
                PIN Default Karyawan Baru (Fallback)
              </label>
              <div className="relative">
                <input
                  type={showAllPins ? 'text' : 'password'}
                  maxLength={12}
                  required
                  value={defaultEmployeePin}
                  onChange={(e) => setDefaultEmployeePin(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm font-extrabold text-slate-800 tracking-widest focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder="1234"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-500">
                PIN awal jika ada karyawan baru yang belum diatur PIN khususnya.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePinForWebAccess}
                  onChange={(e) => setRequirePinForWebAccess(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-800 text-xs">
                  Wajibkan PIN Saat Pertama Masuk Web
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePinForAdminMode}
                  onChange={(e) => setRequirePinForAdminMode(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-800 text-xs">
                  Kunci Perpindahan ke Mode Admin HR
                </span>
              </label>
            </div>
          </div>

          {/* Per-Admin Account PIN Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              Daftar PIN / Password Masing-Masing Akun Pengelola Admin ({(companyConfig.allowedGoogleAdmins || []).length} Akun Admin)
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-3">Nama Admin</th>
                    <th className="py-2.5 px-3">Email Login</th>
                    <th className="py-2.5 px-3">Jabatan / Otoritas</th>
                    <th className="py-2.5 px-3">PIN / Password Khusus Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(companyConfig.allowedGoogleAdmins || []).map((adm) => (
                    <tr key={adm.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{adm.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{adm.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          {adm.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <input
                            type={showAllPins ? 'text' : 'password'}
                            maxLength={12}
                            value={adminPins[adm.id] ?? adm.accessPin ?? masterAdminPin}
                            onChange={(e) =>
                              setAdminPins({ ...adminPins, [adm.id]: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-purple-50/40 border border-purple-200 rounded-lg font-mono font-bold text-purple-900 text-xs tracking-wider focus:outline-hidden focus:border-purple-600"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyPin(
                                adm.id,
                                adminPins[adm.id] ?? adm.accessPin ?? masterAdminPin
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 cursor-pointer"
                            title="Salin PIN Admin"
                          >
                            {copiedId === adm.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* BAGIAN 2: PIN / PASSWORD PER AKUN KARYAWAN (PORTAL KARYAWAN)          */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-emerald-50/60 border-b border-emerald-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>2. Pengaturan PIN / Password Portal Karyawan (Per Akun Karyawan)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                  {employees.length} Akun Karyawan
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Setiap karyawan memiliki PIN khusus sendiri untuk membuka <strong>Portal Karyawan Mandiri</strong> & melihat slip gajinya. Tersinkron otomatis ke Cloud Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateUniqueNikPins}
              className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Buat PIN otomatis berbeda-beda untuk tiap karyawan dari nomor NIK"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Generate PIN Unik Sesuai NIK</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllEmployeePins}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Simpan Semua PIN Karyawan</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Search & Department Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
                placeholder="Cari nama karyawan, NIK, atau jabatan untuk mengatur PIN..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="ALL">Semua Departemen ({employees.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Employee PIN Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">Karyawan & Jabatan</th>
                  <th className="py-3 px-3">NIK</th>
                  <th className="py-3 px-3">Departemen</th>
                  <th className="py-3 px-3">PIN Aktif Saat Ini</th>
                  <th className="py-3 px-3">Atur PIN / Password Baru</th>
                  <th className="py-3 px-4 text-right">Aksi Simpan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada data karyawan yang sesuai pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const currentEffectivePin = getEmployeeEffectivePin(emp, defaultEmployeePin);
                    const editedPin = employeePins[emp.id] ?? currentEffectivePin;
                    const isSameAsAdminPin = editedPin.trim() === masterAdminPin.trim();
                    const isModified = editedPin.trim() !== currentEffectivePin;

                    return (
                      <tr key={emp.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                emp.avatarUrl ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
                              }
                              alt={emp.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{emp.fullName}</div>
                              <div className="text-[11px] text-slate-500">{emp.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {emp.nik}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {emp.department}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-extrabold">
                            <KeyRound className="w-3 h-3 text-emerald-600" />
                            <span>{showAllPins ? currentEffectivePin : '••••'}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyPin(emp.id, currentEffectivePin)}
                              className="ml-1 text-emerald-600 hover:text-emerald-900 cursor-pointer"
                              title="Salin PIN Karyawan"
                            >
                              {copiedId === emp.id ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1 max-w-[180px]">
                            <input
                              type={showAllPins ? 'text' : 'password'}
                              maxLength={12}
                              value={editedPin}
                              onChange={(e) =>
                                setEmployeePins({
                                  ...employeePins,
                                  [emp.id]: e.target.value,
                                })
                              }
                              placeholder="Contoh: 1001"
                              className={`w-full px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs tracking-wider border focus:outline-hidden ${
                                isSameAsAdminPin
                                  ? 'bg-amber-50 border-amber-400 text-amber-900'
                                  : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
                              }`}
                            />
                            {isSameAsAdminPin && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>Sama dgn PIN Admin! Disarankan beda.</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveSingleEmployeePin(emp)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                              isModified
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700'
                            }`}
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isModified ? 'Simpan Perubahan' : 'Simpan PIN'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
