import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck2,
  Clock,
  UserCheck,
  AlertCircle,
  Plus,
  Upload,
  Search,
  CheckCircle,
  Calendar,
  Settings2,
  Users,
  Edit3,
  Trash2,
  Check,
  Sparkles,
  MapPin,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Camera,
  X,
} from 'lucide-react';
import { Employee, AttendanceRecord, CompanyConfig, WorkShift } from '../types';
import {
  formatIndoDate,
  DEFAULT_WORK_SHIFTS,
  getEmployeeShift,
  evaluateAttendanceAgainstShift,
} from '../utils/formatters';
import { UploadAttendanceModal } from './UploadAttendanceModal';

interface AttendanceViewProps {
  employees: Employee[];
  attendances: AttendanceRecord[];
  companyConfig?: CompanyConfig;
  initialSubTab?: 'attendance' | 'shifts' | 'employee_shifts';
  onAddAttendance: (att: AttendanceRecord) => void;
  onApplyImportedAttendance?: (importedRecords: AttendanceRecord[]) => void;
  onUpdateShifts?: (newShifts: WorkShift[]) => void;
  onAssignEmployeeShift?: (employeeId: string, shiftId: string) => void;
  onBulkAssignDepartmentShift?: (department: string, shiftId: string) => void;
}

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const SHIFT_COLOR_CLASSES: Record<
  WorkShift['colorTheme'],
  { bg: string; text: string; border: string; badge: string }
> = {
  emerald: {
    bg: 'bg-emerald-50/70',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  teal: {
    bg: 'bg-teal-50/70',
    text: 'text-teal-900',
    border: 'border-teal-200',
    badge: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  indigo: {
    bg: 'bg-indigo-50/70',
    text: 'text-indigo-900',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  purple: {
    bg: 'bg-purple-50/70',
    text: 'text-purple-900',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  amber: {
    bg: 'bg-amber-50/70',
    text: 'text-amber-900',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  rose: {
    bg: 'bg-rose-50/70',
    text: 'text-rose-900',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
  },
};

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  employees,
  attendances,
  companyConfig,
  initialSubTab = 'attendance',
  onAddAttendance,
  onApplyImportedAttendance,
  onUpdateShifts,
  onAssignEmployeeShift,
  onBulkAssignDepartmentShift,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'shifts' | 'employee_shifts'>(
    initialSubTab
  );

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const workShifts: WorkShift[] = useMemo(() => {
    if (companyConfig?.workShifts && companyConfig.workShifts.length > 0) {
      return companyConfig.workShifts;
    }
    return DEFAULT_WORK_SHIFTS;
  }, [companyConfig?.workShifts]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewPhotoRecord, setPreviewPhotoRecord] = useState<AttendanceRecord | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // State for Shift Create / Edit Modal
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState<{
    code: string;
    name: string;
    checkInTime: string;
    checkOutTime: string;
    gracePeriodMinutes: number;
    breakDurationMinutes: number;
    workDays: string[];
    colorTheme: WorkShift['colorTheme'];
    location: string;
    description: string;
    isDefault: boolean;
  }>({
    code: 'SHF-05',
    name: '',
    checkInTime: '08:30',
    checkOutTime: '17:00',
    gracePeriodMinutes: 10,
    breakDurationMinutes: 60,
    workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
    colorTheme: 'emerald',
    location: 'Kantor Pusat Hayam Wuruk',
    description: '',
    isDefault: false,
  });

  // Employee Plotting Filters & Bulk Assign State
  const [empPlotSearch, setEmpPlotSearch] = useState('');
  const [empPlotDeptFilter, setEmpPlotDeptFilter] = useState('ALL');
  const [empPlotShiftFilter, setEmpPlotShiftFilter] = useState('ALL');
  const [bulkDepartment, setBulkDepartment] = useState('ALL');
  const [bulkShiftId, setBulkShiftId] = useState(workShifts[0]?.id || 'shift-pagi-reguler');

  // Form Clock In State (Manual Admin Record)
  const [formEmpId, setFormEmpId] = useState(employees[0]?.id || '');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCheckIn, setFormCheckIn] = useState('08:55');
  const [formCheckOut, setFormCheckOut] = useState('17:30');
  const [formNotes, setFormNotes] = useState('Kehadiran sesuai jadwal shift');

  // Selected employee's shift in the attendance modal
  const selectedModalEmployee = useMemo(
    () => employees.find((e) => e.id === formEmpId) || employees[0],
    [employees, formEmpId]
  );

  const selectedModalShift = useMemo(
    () => getEmployeeShift(selectedModalEmployee, workShifts),
    [selectedModalEmployee, workShifts]
  );

  const modalShiftEvaluation = useMemo(
    () => evaluateAttendanceAgainstShift(formCheckIn, formCheckOut, selectedModalShift),
    [formCheckIn, formCheckOut, selectedModalShift]
  );

  // Sync checkIn / checkOut defaults when admin changes employee in modal
  const handleSelectModalEmployee = (empId: string) => {
    setFormEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    const shift = getEmployeeShift(emp, workShifts);
    setFormCheckIn(shift.checkInTime);
    setFormCheckOut(shift.checkOutTime);
  };

  const onTimeCount = attendances.filter((a) => a.status === 'Hadir Tepat Waktu').length;
  const lateCount = attendances.filter((a) => a.status === 'Terlambat').length;
  const sickCount = attendances.filter((a) => a.status === 'Sakit' || a.status === 'Izin').length;
  const leaveCount = attendances.filter((a) => a.status === 'Cuti').length;

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === formEmpId);
    if (!emp) return;

    const empShift = getEmployeeShift(emp, workShifts);
    const evalRes = evaluateAttendanceAgainstShift(formCheckIn, formCheckOut, empShift);

    const newAtt: AttendanceRecord = {
      id: `att-${Date.now()}`,
      employeeId: formEmpId,
      date: formDate,
      checkIn: formCheckIn,
      checkOut: formCheckOut,
      status: evalRes.status,
      workHours: evalRes.workHours,
      lateMinutes: evalRes.lateMinutes,
      earlyLeaveMinutes: evalRes.earlyLeaveMinutes,
      shiftId: empShift.id,
      shiftName: empShift.name,
      scheduledCheckIn: empShift.checkInTime,
      scheduledCheckOut: empShift.checkOutTime,
      notes: formNotes || `Presensi mengikuti ${empShift.name}`,
    };

    onAddAttendance(newAtt);
    setIsModalOpen(false);
    showToast(
      `Presensi ${emp.fullName} (${empShift.code}: ${empShift.checkInTime}-${empShift.checkOutTime}) berhasil disimpan!`
    );
  };

  // Handlers for Shift CRUD
  const handleOpenAddShiftModal = () => {
    setEditingShiftId(null);
    setShiftForm({
      code: `SHF-0${workShifts.length + 1}`,
      name: '',
      checkInTime: '08:30',
      checkOutTime: '17:00',
      gracePeriodMinutes: 10,
      breakDurationMinutes: 60,
      workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
      colorTheme: 'indigo',
      location: 'Kantor Pusat / Cabang',
      description: '',
      isDefault: false,
    });
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShiftModal = (shift: WorkShift) => {
    setEditingShiftId(shift.id);
    setShiftForm({
      code: shift.code,
      name: shift.name,
      checkInTime: shift.checkInTime,
      checkOutTime: shift.checkOutTime,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      breakDurationMinutes: shift.breakDurationMinutes,
      workDays: [...shift.workDays],
      colorTheme: shift.colorTheme || 'emerald',
      location: shift.location || '',
      description: shift.description || '',
      isDefault: Boolean(shift.isDefault),
    });
    setIsShiftModalOpen(true);
  };

  const handleSaveShiftModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.name.trim()) return;

    let updatedList: WorkShift[] = [];
    if (editingShiftId) {
      updatedList = workShifts.map((s) => {
        if (s.id === editingShiftId) {
          return {
            ...s,
            code: shiftForm.code.trim() || s.code,
            name: shiftForm.name.trim(),
            checkInTime: shiftForm.checkInTime,
            checkOutTime: shiftForm.checkOutTime,
            gracePeriodMinutes: Math.max(0, Number(shiftForm.gracePeriodMinutes) || 0),
            breakDurationMinutes: Math.max(0, Number(shiftForm.breakDurationMinutes) || 0),
            workDays: shiftForm.workDays.length > 0 ? shiftForm.workDays : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
            colorTheme: shiftForm.colorTheme,
            location: shiftForm.location.trim(),
            description: shiftForm.description.trim(),
            isDefault: shiftForm.isDefault,
          };
        }
        return shiftForm.isDefault ? { ...s, isDefault: false } : s;
      });
      showToast(
        `Jadwal "${shiftForm.name}" (${shiftForm.checkInTime} - ${shiftForm.checkOutTime} WIB) berhasil diperbarui!`
      );
    } else {
      const newShift: WorkShift = {
        id: `shift-${Date.now().toString().slice(-6)}`,
        code: shiftForm.code.trim() || `SHF-0${workShifts.length + 1}`,
        name: shiftForm.name.trim(),
        checkInTime: shiftForm.checkInTime,
        checkOutTime: shiftForm.checkOutTime,
        gracePeriodMinutes: Math.max(0, Number(shiftForm.gracePeriodMinutes) || 0),
        breakDurationMinutes: Math.max(0, Number(shiftForm.breakDurationMinutes) || 0),
        workDays: shiftForm.workDays.length > 0 ? shiftForm.workDays : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
        colorTheme: shiftForm.colorTheme,
        location: shiftForm.location.trim(),
        description: shiftForm.description.trim(),
        isDefault: shiftForm.isDefault,
        isActive: true,
      };
      updatedList = shiftForm.isDefault
        ? [...workShifts.map((s) => ({ ...s, isDefault: false })), newShift]
        : [...workShifts, newShift];
      showToast(
        `Shift baru "${newShift.name}" (${newShift.checkInTime} - ${newShift.checkOutTime} WIB) berhasil ditambahkan!`
      );
    }

    onUpdateShifts?.(updatedList);
    setIsShiftModalOpen(false);
  };

  // Inline Quick Time Update on Shift Card
  const handleQuickUpdateShiftTime = (
    shiftId: string,
    field: 'checkInTime' | 'checkOutTime' | 'gracePeriodMinutes',
    value: string | number
  ) => {
    const updatedList = workShifts.map((s) => {
      if (s.id === shiftId) {
        return {
          ...s,
          [field]: field === 'gracePeriodMinutes' ? Math.max(0, Number(value) || 0) : String(value),
        };
      }
      return s;
    });
    onUpdateShifts?.(updatedList);
    const target = updatedList.find((s) => s.id === shiftId);
    if (target) {
      showToast(
        `Jam kerja ${target.name} diset ke Masuk ${target.checkInTime} & Pulang ${target.checkOutTime} (Toleransi ${target.gracePeriodMinutes} mnt)`
      );
    }
  };

  const handleSetDefaultShift = (shiftId: string) => {
    const updatedList = workShifts.map((s) => ({
      ...s,
      isDefault: s.id === shiftId,
    }));
    onUpdateShifts?.(updatedList);
    const target = updatedList.find((s) => s.id === shiftId);
    showToast(`"${target?.name}" ditetapkan sebagai Shift Default perusahaan.`);
  };

  const handleDeleteShift = (shiftId: string) => {
    if (workShifts.length <= 1) {
      showToast('Minimal harus ada 1 jadwal shift aktif di sistem.');
      return;
    }
    const target = workShifts.find((s) => s.id === shiftId);
    const remaining = workShifts.filter((s) => s.id !== shiftId);
    if (target?.isDefault && remaining.length > 0) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    onUpdateShifts?.(remaining);
    showToast(`Jadwal shift "${target?.name}" berhasil dihapus.`);
  };

  const handleResetDefaultShifts = () => {
    onUpdateShifts?.(DEFAULT_WORK_SHIFTS);
    showToast('Daftar jadwal shift berhasil dikembalikan ke 4 Shift Standar.');
  };

  const toggleWorkDayInForm = (day: string) => {
    setShiftForm((prev) => {
      const exists = prev.workDays.includes(day);
      if (exists && prev.workDays.length > 1) {
        return { ...prev, workDays: prev.workDays.filter((d) => d !== day) };
      } else if (!exists) {
        return { ...prev, workDays: [...prev.workDays, day] };
      }
      return prev;
    });
  };

  const filteredAttendances = attendances.filter((att) => {
    const emp = employees.find((e) => e.id === att.employeeId);
    if (!emp) return false;

    const empShift = getEmployeeShift(emp, workShifts);
    const recordShiftId = att.shiftId || empShift.id;

    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.nik.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || att.status === statusFilter;
    const matchShift = shiftFilter === 'ALL' || recordShiftId === shiftFilter;

    return matchSearch && matchStatus && matchShift;
  });

  const filteredPlotEmployees = employees.filter((emp) => {
    const empShift = getEmployeeShift(emp, workShifts);
    const matchSearch =
      emp.fullName.toLowerCase().includes(empPlotSearch.toLowerCase()) ||
      emp.nik.toLowerCase().includes(empPlotSearch.toLowerCase()) ||
      emp.role.toLowerCase().includes(empPlotSearch.toLowerCase());
    const matchDept = empPlotDeptFilter === 'ALL' || emp.department === empPlotDeptFilter;
    const matchShift = empPlotShiftFilter === 'ALL' || empShift.id === empPlotShiftFilter;
    return matchSearch && matchDept && matchShift;
  });

  const departments = Array.from(new Set(employees.map((e) => e.department)));

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2.5 border border-slate-700 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-emerald-600" />
            Manajemen Presensi & Jadwal Shift Kerja
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur manual jam masuk dan pulang kerja dalam beberapa shift. Karyawan akan absen mengikuti jadwal shift yang ditetapkan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAddShiftModal}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Buat Shift Baru
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            Upload CSV Absensi
          </button>
          <button
            onClick={() => {
              const firstEmp = employees[0];
              const shift = getEmployeeShift(firstEmp, workShifts);
              setFormEmpId(firstEmp?.id || '');
              setFormDate(new Date().toISOString().split('T')[0]);
              setFormCheckIn(shift.checkInTime);
              setFormCheckOut(shift.checkOutTime);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Catat Presensi Manual
          </button>
        </div>
      </div>

      {/* Main Navigation Sub-Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('shifts')}
          className={`flex-1 min-w-[210px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'shifts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Setting Jam Masuk & Pulang ({workShifts.length} Shift)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('employee_shifts')}
          className={`flex-1 min-w-[210px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'employee_shifts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Plotting Shift Karyawan ({employees.length} Staf)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('attendance')}
          className={`flex-1 min-w-[210px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" />
          <span>Rekap Presensi Harian ({attendances.length} Log)</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SETTING MANUAL JAM MASUK & PULANG KERJA (MULTI-SHIFT PANEL)   */}
      {/* ===================================================================== */}
      {activeSubTab === 'shifts' && (
        <div className="space-y-6">
          {/* Top Banner Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Konfigurasi Manual Jam Masuk & Jam Pulang Kerja (Multi-Shift)
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Ubah langsung <strong>Jam Masuk</strong>, <strong>Jam Pulang</strong>, dan <strong>Toleransi Keterlambatan (Menit)</strong> pada kartu shift di bawah ini. Saat karyawan melakukan absen di Portal Karyawan, status hadir tepat waktu atau terlambat otomatis dihitung mengikuti jam shift masing-masing.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetDefaultShifts}
                className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Kembalikan ke 4 shift standar pabrik/kantor"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Default
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('employee_shifts')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Atur Shift Karyawan
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Grid of Shift Cards with Direct Manual Time Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {workShifts.map((shift) => {
              const assignedEmployees = employees.filter(
                (e) => getEmployeeShift(e, workShifts).id === shift.id
              );
              const evalSample = evaluateAttendanceAgainstShift(
                shift.checkInTime,
                shift.checkOutTime,
                shift
              );
              const theme = SHIFT_COLOR_CLASSES[shift.colorTheme || 'emerald'];

              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span className="font-bold text-slate-800">{shift.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>{assignedEmployees.length} Karyawan</span>
                          {shift.isDefault && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 font-sans font-bold">
                                Shift Default
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{shift.name}</h3>
                        {shift.location && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{shift.location}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {!shift.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultShift(shift.id)}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            title="Jadikan shift default untuk karyawan baru"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditShiftModal(shift)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit detail lengkap shift"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {workShifts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteShift(shift.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus shift"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Direct Manual Time Pickers (Jam Masuk, Jam Pulang, Toleransi) */}
                    <div className={`p-4 rounded-xl border ${theme.bg} ${theme.border} space-y-3`}>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>PENGATURAN MANUAL JAM KERJA SHIFT</span>
                        <span className="font-mono text-slate-600">
                          Durasi Bersih: {evalSample.workHours} Jam
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Jam Masuk Kerja
                          </label>
                          <input
                            type="time"
                            value={shift.checkInTime}
                            onChange={(e) =>
                              handleQuickUpdateShiftTime(shift.id, 'checkInTime', e.target.value)
                            }
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Jam Pulang Kerja
                          </label>
                          <input
                            type="time"
                            value={shift.checkOutTime}
                            onChange={(e) =>
                              handleQuickUpdateShiftTime(shift.id, 'checkOutTime', e.target.value)
                            }
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Toleransi (Menit)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={shift.gracePeriodMinutes}
                            onChange={(e) =>
                              handleQuickUpdateShiftTime(
                                shift.id,
                                'gracePeriodMinutes',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span>
                          Batas Tepat Waktu: <strong className="font-mono text-slate-900">{evalSample.maxAllowedCheckIn} WIB</strong>
                        </span>
                        <span>·</span>
                        <span>Istirahat: <strong>{shift.breakDurationMinutes} Menit</strong></span>
                        <span>·</span>
                        <span>Hari: <strong>{shift.workDays.length} Hari/Minggu</strong></span>
                      </div>
                    </div>

                    {/* Assigned Employees Preview */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-500 font-medium">
                          Karyawan pada shift ini ({assignedEmployees.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEmpPlotShiftFilter(shift.id);
                            setActiveSubTab('employee_shifts');
                          }}
                          className="text-emerald-700 hover:underline font-semibold cursor-pointer"
                        >
                          Kelola anggota →
                        </button>
                      </div>
                      {assignedEmployees.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Belum ada karyawan yang di-plot ke shift ini.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {assignedEmployees.slice(0, 5).map((emp) => (
                            <div
                              key={emp.id}
                              className="flex items-center gap-1.5 pr-2 py-0.5 text-xs text-slate-700"
                            >
                              <img
                                src={emp.avatarUrl}
                                alt={emp.fullName}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                              <span className="font-medium">{emp.fullName}</span>
                            </div>
                          ))}
                          {assignedEmployees.length > 5 && (
                            <span className="text-xs text-slate-500 font-medium">
                              +{assignedEmployees.length - 5} lainnya
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PLOTTING / PENUGASAN SHIFT KARYAWAN                            */}
      {/* ===================================================================== */}
      {activeSubTab === 'employee_shifts' && (
        <div className="space-y-6">
          {/* Bulk Assign Shift per Department */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Penugasan Shift Massal per Departemen
                </h2>
                <p className="text-xs text-slate-500">
                  Terapkan jadwal shift masuk & pulang kerja ke seluruh karyawan dalam satu departemen sekaligus.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Target Departemen
                </label>
                <select
                  value={bulkDepartment}
                  onChange={(e) => setBulkDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                >
                  <option value="ALL">Semua Departemen ({employees.length} Karyawan)</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      Departemen {dept} ({employees.filter((e) => e.department === dept).length} Staf)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Jadwal Shift Tujuan
                </label>
                <select
                  value={bulkShiftId}
                  onChange={(e) => setBulkShiftId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                >
                  {workShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.checkInTime} - {s.checkOutTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    const targetShift = workShifts.find((s) => s.id === bulkShiftId);
                    onBulkAssignDepartmentShift?.(bulkDepartment, bulkShiftId);
                    showToast(
                      `Jadwal "${targetShift?.name}" (${targetShift?.checkInTime}-${targetShift?.checkOutTime}) berhasil diterapkan ke ${
                        bulkDepartment === 'ALL' ? 'seluruh karyawan' : `Departemen ${bulkDepartment}`
                      }!`
                    );
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Terapkan Shift Massal
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar for Employee Shift Table */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, NIK, atau jabatan karyawan..."
                value={empPlotSearch}
                onChange={(e) => setEmpPlotSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={empPlotDeptFilter}
                onChange={(e) => setEmpPlotDeptFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              >
                <option value="ALL">Semua Departemen</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={empPlotShiftFilter}
                onChange={(e) => setEmpPlotShiftFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              >
                <option value="ALL">Semua Shift Kerja</option>
                {workShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} • {s.name} ({s.checkInTime}-{s.checkOutTime})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employee Shift Assignment Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Karyawan</th>
                    <th className="py-3.5 px-4">Departemen & Jabatan</th>
                    <th className="py-3.5 px-4">Jadwal Shift Saat Ini</th>
                    <th className="py-3.5 px-4">Jam Masuk & Pulang</th>
                    <th className="py-3.5 px-4">Batas Toleransi</th>
                    <th className="py-3.5 px-4">Ubah Shift Kerja Karyawan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPlotEmployees.map((emp) => {
                    const currentShift = getEmployeeShift(emp, workShifts);
                    const evalInfo = evaluateAttendanceAgainstShift(
                      currentShift.checkInTime,
                      currentShift.checkOutTime,
                      currentShift
                    );

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={emp.avatarUrl}
                              alt={emp.fullName}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block">
                                {emp.fullName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {emp.nik}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800 block">{emp.department}</span>
                          <span className="text-[11px] text-slate-500">{emp.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {currentShift.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Kode: {currentShift.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="font-bold text-emerald-700">
                            {currentShift.checkInTime}
                          </span>
                          <span className="text-slate-400 mx-1.5">–</span>
                          <span className="font-bold text-indigo-700">
                            {currentShift.checkOutTime} WIB
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="font-medium">{currentShift.gracePeriodMinutes} Menit</span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            Maks: {evalInfo.maxAllowedCheckIn} WIB
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={currentShift.id}
                            onChange={(e) => {
                              const newShiftId = e.target.value;
                              const targetShift = workShifts.find((s) => s.id === newShiftId);
                              onAssignEmployeeShift?.(emp.id, newShiftId);
                              showToast(
                                `Shift kerja ${emp.fullName} diubah ke ${targetShift?.name} (${targetShift?.checkInTime} - ${targetShift?.checkOutTime} WIB)`
                              );
                            }}
                            className="w-full max-w-[260px] px-3 py-2 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          >
                            {workShifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.code} • {s.name} ({s.checkInTime}-{s.checkOutTime})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: REKAP PRESENSI & ABSENSI HARIAN                                */}
      {/* ===================================================================== */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Hadir Tepat Waktu</span>
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{onTimeCount}</h3>
              <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                Sesuai jam shift masing-masing
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Terlambat</span>
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{lateCount}</h3>
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                Melewati toleransi shift
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sakit & Izin</span>
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{sickCount}</h3>
              <p className="text-[11px] text-blue-600 mt-1 font-medium">Surat keterangan</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Jadwal Shift Aktif</span>
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{workShifts.length} Shift</h3>
              <p className="text-[11px] text-purple-600 mt-1 font-medium">
                Cuti disetujui: {leaveCount}
              </p>
            </div>
          </div>

          {/* Filter and Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama atau NIK karyawan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              >
                <option value="ALL">Semua Shift Kerja</option>
                {workShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} • {s.name} ({s.checkInTime}-{s.checkOutTime})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              >
                <option value="ALL">Semua Status Kehadiran</option>
                <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
                <option value="Terlambat">Terlambat</option>
                <option value="Sakit">Sakit</option>
                <option value="Cuti">Cuti</option>
              </select>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Tanggal & Jam Real-Time</th>
                    <th className="py-3 px-4">Bukti Foto Wajah</th>
                    <th className="py-3 px-4">Jadwal Shift</th>
                    <th className="py-3 px-4">Jam Masuk / Pulang</th>
                    <th className="py-3 px-4">Evaluasi Jam Shift</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Detail Lokasi GPS HP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendances.map((att) => {
                    const emp = employees.find((e) => e.id === att.employeeId);
                    const empShift = getEmployeeShift(emp, workShifts);
                    const schedIn = att.scheduledCheckIn || empShift.checkInTime;
                    const schedOut = att.scheduledCheckOut || empShift.checkOutTime;
                    const shiftLabel = att.shiftName || empShift.name;
                    const photoSnap = att.facePhotoSnapshot || att.checkOutPhotoSnapshot;

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                emp?.avatarUrl ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
                              }
                              alt={emp?.fullName}
                              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-emerald-500/30"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block text-xs">
                                {emp?.fullName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono block">
                                {emp?.nik} • {emp?.department}
                              </span>
                              {emp?.ktpNumber && (
                                <span className="text-[10px] text-indigo-700 font-mono font-semibold block">
                                  NIK KTP: {emp.ktpNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                          <span className="block">{formatIndoDate(att.date)}</span>
                          {att.checkInFullTimestamp && (
                            <span className="text-[10px] font-mono text-emerald-700 block">
                              {att.checkInFullTimestamp}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {photoSnap ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoRecord(att)}
                              className="flex items-center gap-2 group cursor-pointer text-left"
                            >
                              <img
                                src={photoSnap}
                                alt="Foto Absen"
                                className="w-11 h-9 rounded-lg object-cover border border-emerald-300 shadow-2xs group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                              />
                              <div>
                                <span className="text-[11px] font-bold text-emerald-700 group-hover:underline block">
                                  Foto & GPS
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Terverifikasi
                                </span>
                              </div>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Manual</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 block truncate max-w-[170px]">
                            {shiftLabel}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Jadwal: {schedIn} - {schedOut}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="font-semibold text-emerald-700 block">
                            Masuk: {att.checkIn}
                          </span>
                          <span className="font-semibold text-indigo-700 block text-[11px]">
                            Pulang: {att.checkOut || '-'} ({att.workHours > 0 ? `${att.workHours}j` : '-'})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {att.lateMinutes > 0 ? (
                            <span className="font-semibold text-amber-600 block">
                              Terlambat {att.lateMinutes} mnt
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium block">
                              Masuk Tepat Waktu
                            </span>
                          )}
                          {(att.earlyLeaveMinutes || 0) > 0 && (
                            <span className="text-[10px] text-rose-600 font-medium block">
                              Pulang cepat {att.earlyLeaveMinutes} mnt
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                              att.status === 'Hadir Tepat Waktu'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'Terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : att.status === 'Sakit'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[230px]">
                          <div className="text-[11px] font-medium text-slate-800 line-clamp-2">
                            {att.locationAddress || att.notes || '-'}
                          </div>
                          {att.locationCoords && (
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              GPS: {att.locationCoords.latitude.toFixed(6)},{' '}
                              {att.locationCoords.longitude.toFixed(6)} (±
                              {att.locationCoords.accuracy}m)
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Preview Foto Wajah & Lokasi GPS di Admin Panel */}
          {previewPhotoRecord && (() => {
            const previewEmp = employees.find((e) => e.id === previewPhotoRecord.employeeId);
            return (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200">
                  <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {previewEmp?.avatarUrl && (
                        <img
                          src={previewEmp.avatarUrl}
                          alt={previewEmp.fullName}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-400 shrink-0"
                        />
                      )}
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-2">
                          <Camera className="w-4 h-4 text-emerald-400" />
                          <span>Verifikasi Foto Wajah & Titik GPS HP ({formatIndoDate(previewPhotoRecord.date)})</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          {previewEmp?.fullName} ({previewEmp?.nik})
                          {previewEmp?.ktpNumber ? ` • NIK KTP: ${previewEmp.ktpNumber}` : ''} •{' '}
                          {previewPhotoRecord.shiftName}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoRecord(null)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {previewPhotoRecord.facePhotoSnapshot && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-emerald-800 block">
                          Foto Absen Masuk ({previewPhotoRecord.checkIn} WIB)
                        </span>
                        <img
                          src={previewPhotoRecord.facePhotoSnapshot}
                          alt="Foto Absen Masuk"
                          className="w-full rounded-xl border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                    {previewPhotoRecord.checkOutPhotoSnapshot && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-indigo-800 block">
                          Foto Absen Pulang ({previewPhotoRecord.checkOut} WIB)
                        </span>
                        <img
                          src={previewPhotoRecord.checkOutPhotoSnapshot}
                          alt="Foto Absen Pulang"
                          className="w-full rounded-xl border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-slate-500">Waktu Real-Time Saat Foto Diambil:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {previewPhotoRecord.checkInFullTimestamp || `${previewPhotoRecord.date} • ${previewPhotoRecord.checkIn} WIB`}
                      </span>
                    </div>
                    {previewPhotoRecord.locationCoords && (
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-slate-500">Koordinat GPS HP:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          Lat {previewPhotoRecord.locationCoords.latitude.toFixed(6)}°, Long{' '}
                          {previewPhotoRecord.locationCoords.longitude.toFixed(6)}° (Akurasi ±
                          {previewPhotoRecord.locationCoords.accuracy}m)
                        </span>
                      </div>
                    )}
                    <div className="pt-1 border-t border-slate-200/80">
                      <span className="text-slate-500 block mb-0.5">Detail Lokasi Terbaca dari GPS HP:</span>
                      <span className="font-semibold text-slate-900 block">
                        {previewPhotoRecord.locationAddress || previewPhotoRecord.notes || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: TAMBAH / EDIT JADWAL SHIFT KERJA                             */}
      {/* ===================================================================== */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              {editingShiftId ? 'Edit Jadwal Shift Kerja' : 'Buat Jadwal Shift Kerja Baru'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur manual jam masuk, jam pulang, dan batas toleransi keterlambatan shift.
            </p>

            {/* Quick Shift Presets */}
            <div className="mt-4">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Preset Cepat Jam Shift:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Pagi Gudang (08:00 - 16:30)', in: '08:00', out: '16:30' },
                  { label: 'Reguler Kantor (09:00 - 17:30)', in: '09:00', out: '17:30' },
                  { label: 'Shift Siang (13:00 - 21:30)', in: '13:00', out: '21:30' },
                  { label: 'Shift Sore (15:00 - 23:00)', in: '15:00', out: '23:00' },
                  { label: 'Shift Malam (21:00 - 05:00)', in: '21:00', out: '05:00' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setShiftForm((prev) => ({
                        ...prev,
                        checkInTime: preset.in,
                        checkOutTime: preset.out,
                      }))
                    }
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveShiftModal} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Kode Shift</label>
                  <input
                    type="text"
                    required
                    value={shiftForm.code}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="SHF-05"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Nama Shift Kerja</label>
                  <input
                    type="text"
                    required
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Contoh: Shift Pagi Toko / Shift Malam Gudang"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <div>
                  <label className="block text-emerald-900 font-bold mb-1">
                    Jam Masuk Kerja (Check-In)
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.checkInTime}
                    onChange={(e) =>
                      setShiftForm((prev) => ({ ...prev, checkInTime: e.target.value }))
                    }
                    className="w-full p-2.5 bg-white border border-emerald-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-emerald-900 font-bold mb-1">
                    Jam Pulang Kerja (Check-Out)
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.checkOutTime}
                    onChange={(e) =>
                      setShiftForm((prev) => ({ ...prev, checkOutTime: e.target.value }))
                    }
                    className="w-full p-2.5 bg-white border border-emerald-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Toleransi Keterlambatan (Menit)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={shiftForm.gracePeriodMinutes}
                    onChange={(e) =>
                      setShiftForm((prev) => ({
                        ...prev,
                        gracePeriodMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Durasi Istirahat (Menit)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={shiftForm.breakDurationMinutes}
                    onChange={(e) =>
                      setShiftForm((prev) => ({
                        ...prev,
                        breakDurationMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1.5">
                  Hari Kerja Shift Aktif
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DAYS.map((day) => {
                    const active = shiftForm.workDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWorkDayInForm(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Lokasi / Cabang</label>
                  <input
                    type="text"
                    value={shiftForm.location}
                    onChange={(e) =>
                      setShiftForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    placeholder="Kantor Pusat / Gudang"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tema Warna</label>
                  <select
                    value={shiftForm.colorTheme}
                    onChange={(e) =>
                      setShiftForm((prev) => ({
                        ...prev,
                        colorTheme: e.target.value as WorkShift['colorTheme'],
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  >
                    <option value="emerald">Hijau Emerald</option>
                    <option value="teal">Biru Tosca (Teal)</option>
                    <option value="indigo">Biru Indigo</option>
                    <option value="purple">Ungu (Shift Malam)</option>
                    <option value="amber">Kuning Amber</option>
                    <option value="rose">Merah Rose</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shiftForm.isDefault}
                  onChange={(e) =>
                    setShiftForm((prev) => ({ ...prev, isDefault: e.target.checked }))
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">
                  Jadikan sebagai Shift Default untuk karyawan yang belum dipilih shift-nya
                </span>
              </label>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Jadwal Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CATAT PRESENSI MANUAL (MENGIKUTI SHIFT KARYAWAN)             */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Catat Presensi Harian</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Otomatis menyesuaikan jadwal masuk & pulang sesuai shift karyawan
            </p>

            <form onSubmit={handleSaveAttendance} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Pilih Karyawan</label>
                <select
                  value={formEmpId}
                  onChange={(e) => handleSelectModalEmployee(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                >
                  {employees.map((e) => {
                    const sh = getEmployeeShift(e, workShifts);
                    return (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({sh.code}: {sh.checkInTime}-{sh.checkOutTime})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Info Jadwal Shift Karyawan */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{selectedModalShift.name}</span>
                  <span className="font-mono text-[11px] font-bold text-emerald-700">
                    {selectedModalShift.code}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Jadwal Masuk: <strong className="font-mono">{selectedModalShift.checkInTime}</strong> · Pulang:{' '}
                  <strong className="font-mono">{selectedModalShift.checkOutTime}</strong> · Toleransi:{' '}
                  <strong>{selectedModalShift.gracePeriodMinutes} mnt</strong> (Maks {modalShiftEvaluation.maxAllowedCheckIn})
                </p>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tanggal Presensi</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Jam Masuk Aktual
                  </label>
                  <input
                    type="time"
                    value={formCheckIn}
                    onChange={(e) => setFormCheckIn(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Jam Pulang Aktual
                  </label>
                  <input
                    type="time"
                    value={formCheckOut}
                    onChange={(e) => setFormCheckOut(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Live Shift Evaluation Preview */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  modalShiftEvaluation.lateMinutes > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <span className="block text-[10px] uppercase font-bold opacity-75">
                    Hasil Evaluasi Shift:
                  </span>
                  <span className="font-bold">
                    {modalShiftEvaluation.status}
                    {modalShiftEvaluation.lateMinutes > 0
                      ? ` (${modalShiftEvaluation.lateMinutes} Menit)`
                      : ''}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="block text-[10px] opacity-75">Durasi Kerja</span>
                  <span className="font-bold">{modalShiftEvaluation.workHours} Jam</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Kantor Pusat / Gudang"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Presensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Attendance Modal */}
      <UploadAttendanceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        employees={employees}
        onApplyImportedAttendance={(imported) => {
          if (onApplyImportedAttendance) {
            onApplyImportedAttendance(imported);
          }
          showToast(`${imported.length} data absensi berhasil diimpor dari file!`);
        }}
      />
    </div>
  );
};
