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
import {
  Employee,
  AttendanceRecord,
  CompanyConfig,
  WorkShift,
  AttendancePenaltyPolicy,
} from '../types';
import {
  formatIndoDate,
  formatRupiah,
  DEFAULT_WORK_SHIFTS,
  DEFAULT_ATTENDANCE_PENALTY_POLICY,
  getAttendancePenaltyPolicy,
  getEmployeeShift,
  evaluateAttendanceAgainstShift,
  deduplicateDailyAttendances,
  calculateEmployeeAttendancePenalty,
} from '../utils/formatters';
import { UploadAttendanceModal } from './UploadAttendanceModal';

interface AttendanceViewProps {
  employees: Employee[];
  attendances: AttendanceRecord[];
  companyConfig?: CompanyConfig;
  initialSubTab?: 'attendance' | 'shifts' | 'employee_shifts';
  onAddAttendance: (att: AttendanceRecord) => void;
  onUpdateAttendance?: (att: AttendanceRecord) => void;
  onDeleteAttendance?: (attId: string, employeeId?: string, date?: string) => void;
  onApplyImportedAttendance?: (importedRecords: AttendanceRecord[]) => void;
  onUpdateShifts?: (newShifts: WorkShift[]) => void;
  onUpdatePenaltyPolicy?: (newPolicy: AttendancePenaltyPolicy) => void;
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
  onUpdateAttendance,
  onDeleteAttendance,
  onApplyImportedAttendance,
  onUpdateShifts,
  onUpdatePenaltyPolicy,
  onAssignEmployeeShift,
  onBulkAssignDepartmentShift,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'shifts' | 'employee_shifts'>(
    initialSubTab
  );
  const [isPenaltyPanelOpen, setIsPenaltyPanelOpen] = useState(true);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const workShifts: WorkShift[] = useMemo(() => {
    if (companyConfig?.workShifts && companyConfig.workShifts.length > 0) {
      return companyConfig.workShifts;
    }
    return DEFAULT_WORK_SHIFTS;
  }, [companyConfig?.workShifts]);

  const penaltyPolicy: AttendancePenaltyPolicy = useMemo(
    () => getAttendancePenaltyPolicy(companyConfig?.attendancePenaltyPolicy),
    [companyConfig?.attendancePenaltyPolicy]
  );

  const handlePolicyChange = (patch: Partial<AttendancePenaltyPolicy>) => {
    const next: AttendancePenaltyPolicy = {
      ...penaltyPolicy,
      ...patch,
    };
    onUpdatePenaltyPolicy?.(next);
  };

  // Deduplicated Daily Attendances (1st log per employee per date + automatic lateMinutes calculation)
  const deduplicatedAttendances = useMemo(
    () => deduplicateDailyAttendances(attendances, employees, workShifts, penaltyPolicy),
    [attendances, employees, workShifts, penaltyPolicy]
  );

  // Per-employee penalty summary map
  const employeePenaltyMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateEmployeeAttendancePenalty>>();
    employees.forEach((emp) => {
      map.set(
        emp.id,
        calculateEmployeeAttendancePenalty(emp, deduplicatedAttendances, workShifts, penaltyPolicy)
      );
    });
    return map;
  }, [employees, deduplicatedAttendances, workShifts, penaltyPolicy]);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
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
    location: 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
    description: '',
    isDefault: false,
  });
  const [shiftToDelete, setShiftToDelete] = useState<WorkShift | null>(null);

  // Edit & Delete Daily Attendance Log State (Admin)
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editAttCheckIn, setEditAttCheckIn] = useState('09:00');
  const [editAttCheckOut, setEditAttCheckOut] = useState('17:30');
  const [editAttHasCheckOut, setEditAttHasCheckOut] = useState(true);
  const [editAttStatusMode, setEditAttStatusMode] = useState<
    'AUTO_SHIFT' | 'Hadir Tepat Waktu' | 'Terlambat' | 'Izin' | 'Sakit' | 'Cuti' | 'Alpa'
  >('AUTO_SHIFT');
  const [editAttManualLateMins, setEditAttManualLateMins] = useState(0);
  const [editAttNotes, setEditAttNotes] = useState('');
  const [attendanceToDelete, setAttendanceToDelete] = useState<AttendanceRecord | null>(null);

  // Employee Plotting Filters & Bulk Assign State
  const [empPlotSearch, setEmpPlotSearch] = useState('');
  const [empPlotDeptFilter, setEmpPlotDeptFilter] = useState('ALL');
  const [empPlotShiftFilter, setEmpPlotShiftFilter] = useState('ALL');
  const [bulkDepartment, setBulkDepartment] = useState('ALL');
  const [bulkShiftId, setBulkShiftId] = useState(workShifts[0]?.id || 'shift-pagi-reguler');

  // Form Clock In State (Manual Admin Record)
  const [formEmpId, setFormEmpId] = useState(employees[0]?.id || '');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAttendanceMode, setFormAttendanceMode] = useState<
    'AUTO_SHIFT' | 'Alpa' | 'Sakit' | 'Izin' | 'Cuti'
  >('AUTO_SHIFT');
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

  const modalShiftEvaluation = useMemo(() => {
    const effectiveGrace = penaltyPolicy.useShiftGracePeriod
      ? selectedModalShift.gracePeriodMinutes
      : penaltyPolicy.gracePeriodMinutes;
    return evaluateAttendanceAgainstShift(
      formCheckIn,
      formCheckOut,
      selectedModalShift,
      effectiveGrace
    );
  }, [formCheckIn, formCheckOut, selectedModalShift, penaltyPolicy]);

  // Sync checkIn / checkOut defaults when admin changes employee in modal
  const handleSelectModalEmployee = (empId: string) => {
    setFormEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    const shift = getEmployeeShift(emp, workShifts);
    setFormCheckIn(shift.checkInTime);
    setFormCheckOut(shift.checkOutTime);
  };

  const onTimeCount = deduplicatedAttendances.filter(
    (a) => a.status === 'Hadir Tepat Waktu'
  ).length;
  const lateCount = deduplicatedAttendances.filter((a) => a.status === 'Terlambat').length;
  const alphaCount = deduplicatedAttendances.filter((a) => a.status === 'Alpa').length;
  const sickCount = deduplicatedAttendances.filter(
    (a) => a.status === 'Sakit' || a.status === 'Izin'
  ).length;
  const leaveCount = deduplicatedAttendances.filter((a) => a.status === 'Cuti').length;

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === formEmpId);
    if (!emp) return;

    const empShift = getEmployeeShift(emp, workShifts);
    const effectiveGrace = penaltyPolicy.useShiftGracePeriod
      ? empShift.gracePeriodMinutes
      : penaltyPolicy.gracePeriodMinutes;
    const evalRes = evaluateAttendanceAgainstShift(
      formCheckIn,
      formCheckOut,
      empShift,
      effectiveGrace
    );

    const isAbsenceStatus = formAttendanceMode !== 'AUTO_SHIFT';

    const newAtt: AttendanceRecord = {
      id: `att-${Date.now()}`,
      employeeId: formEmpId,
      date: formDate,
      checkIn: isAbsenceStatus ? '-' : formCheckIn,
      checkOut: isAbsenceStatus ? '-' : formCheckOut,
      status: isAbsenceStatus ? formAttendanceMode : evalRes.status,
      workHours: isAbsenceStatus ? 0 : evalRes.workHours,
      lateMinutes: isAbsenceStatus ? 0 : evalRes.lateMinutes,
      earlyLeaveMinutes: isAbsenceStatus ? 0 : evalRes.earlyLeaveMinutes,
      shiftId: empShift.id,
      shiftName: empShift.name,
      scheduledCheckIn: empShift.checkInTime,
      scheduledCheckOut: empShift.checkOutTime,
      notes:
        formNotes ||
        (isAbsenceStatus
          ? `Status: ${formAttendanceMode}`
          : `Presensi mengikuti ${empShift.name}`),
    };

    onAddAttendance(newAtt);
    setIsModalOpen(false);
    showToast(
      `Presensi ${emp.fullName} (${
        isAbsenceStatus
          ? formAttendanceMode
          : `${empShift.code}: ${formCheckIn} → ${
              evalRes.lateMinutes > 0 ? `Terlambat ${evalRes.lateMinutes} mnt` : 'Tepat Waktu'
            }`
      }) berhasil disimpan & disinkronkan ke Payroll!`
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

  // Inline Quick Update for Shift Name, Location, and Working Days (5 or 6 days / individual toggle)
  const handleQuickUpdateShiftInfo = (
    shiftId: string,
    patch: Partial<Pick<WorkShift, 'name' | 'location' | 'workDays'>>
  ) => {
    const updatedList = workShifts.map((s) => {
      if (s.id === shiftId) {
        return {
          ...s,
          ...patch,
        };
      }
      return s;
    });
    onUpdateShifts?.(updatedList);
    const target = updatedList.find((s) => s.id === shiftId);
    if (target && patch.workDays) {
      showToast(
        `Hari kerja "${target.name}" diperbarui menjadi ${target.workDays.length} Hari/Minggu (${target.workDays.join(', ')}).`
      );
    }
  };

  const handleToggleCardWorkDay = (shift: WorkShift, day: string) => {
    const exists = shift.workDays.includes(day);
    if (exists && shift.workDays.length <= 1) {
      showToast('Minimal harus ada 1 hari kerja aktif pada shift.');
      return;
    }
    const nextDays = exists
      ? shift.workDays.filter((d) => d !== day)
      : ALL_DAYS.filter((d) => shift.workDays.includes(d) || d === day);
    handleQuickUpdateShiftInfo(shift.id, { workDays: nextDays });
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
      setShiftToDelete(null);
      return;
    }
    const target = workShifts.find((s) => s.id === shiftId);
    const remaining = workShifts.filter((s) => s.id !== shiftId);
    if (target?.isDefault && remaining.length > 0) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    onUpdateShifts?.(remaining);
    setShiftToDelete(null);
    showToast(
      `Jadwal shift "${target?.name}" (${target?.code}) berhasil dihapus & karyawan dialihkan ke shift default.`
    );
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
        return {
          ...prev,
          workDays: ALL_DAYS.filter((d) => prev.workDays.includes(d) || d === day),
        };
      }
      return prev;
    });
  };

  // Handlers for Admin Edit & Delete Daily Attendance Log
  const handleOpenEditAttendanceModal = (att: AttendanceRecord) => {
    const emp = employees.find((e) => e.id === att.employeeId);
    const empShift = getEmployeeShift(emp, workShifts);
    const validIn = att.checkIn && att.checkIn !== '-' ? att.checkIn : empShift.checkInTime;
    const hasOut = Boolean(att.checkOut && att.checkOut !== '-' && att.checkOut.trim() !== '');
    const validOut = hasOut ? att.checkOut : empShift.checkOutTime;

    setEditingAttendance(att);
    setEditAttCheckIn(validIn);
    setEditAttCheckOut(validOut);
    setEditAttHasCheckOut(hasOut);

    if (
      att.status === 'Izin' ||
      att.status === 'Sakit' ||
      att.status === 'Cuti' ||
      att.status === 'Alpa'
    ) {
      setEditAttStatusMode(att.status);
    } else if (att.isManualStatus) {
      setEditAttStatusMode(att.status);
    } else {
      setEditAttStatusMode('AUTO_SHIFT');
    }

    setEditAttManualLateMins(att.lateMinutes || 0);
    setEditAttNotes(att.notes || att.locationAddress || '');
  };

  const handleSaveEditedAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;

    const emp = employees.find((e) => e.id === editingAttendance.employeeId);
    const empShift = getEmployeeShift(emp, workShifts);
    const effectiveGrace = penaltyPolicy.useShiftGracePeriod
      ? empShift.gracePeriodMinutes
      : penaltyPolicy.gracePeriodMinutes;

    const isNonPresent =
      editAttStatusMode === 'Izin' ||
      editAttStatusMode === 'Sakit' ||
      editAttStatusMode === 'Cuti' ||
      editAttStatusMode === 'Alpa';

    const finalCheckIn = isNonPresent ? '-' : editAttCheckIn || empShift.checkInTime;
    const finalCheckOut = isNonPresent ? '-' : editAttHasCheckOut ? editAttCheckOut : '-';

    const evalRes = !isNonPresent
      ? evaluateAttendanceAgainstShift(finalCheckIn, finalCheckOut, empShift, effectiveGrace)
      : null;

    const isManualOverride = editAttStatusMode !== 'AUTO_SHIFT';
    const finalStatus: AttendanceRecord['status'] =
      editAttStatusMode === 'AUTO_SHIFT'
        ? evalRes?.status || 'Hadir Tepat Waktu'
        : editAttStatusMode;

    const finalLateMins = isNonPresent
      ? 0
      : editAttStatusMode === 'Hadir Tepat Waktu'
      ? 0
      : editAttStatusMode === 'Terlambat'
      ? editAttManualLateMins > 0
        ? editAttManualLateMins
        : Math.max(1, evalRes?.rawLateMinutes || evalRes?.lateMinutes || 15)
      : evalRes?.lateMinutes || 0;

    const updatedRecord: AttendanceRecord = {
      ...editingAttendance,
      checkIn: finalCheckIn,
      checkOut: finalCheckOut,
      status: finalStatus,
      isManualStatus: isManualOverride,
      lateMinutes: finalLateMins,
      earlyLeaveMinutes: isNonPresent ? 0 : evalRes?.earlyLeaveMinutes || 0,
      workHours: isNonPresent ? 0 : evalRes?.workHours || 0,
      shiftId: empShift.id,
      shiftName: empShift.name,
      scheduledCheckIn: empShift.checkInTime,
      scheduledCheckOut: empShift.checkOutTime,
      notes: editAttNotes.trim() || editingAttendance.notes,
      locationAddress: editAttNotes.trim() || editingAttendance.locationAddress,
    };

    if (onUpdateAttendance) {
      onUpdateAttendance(updatedRecord);
    } else {
      onAddAttendance(updatedRecord);
    }

    setEditingAttendance(null);
    showToast(
      `Log presensi ${emp?.fullName || 'Karyawan'} (${formatIndoDate(
        updatedRecord.date
      )}) berhasil diperbarui: Masuk ${updatedRecord.checkIn}, Pulang ${
        updatedRecord.checkOut
      }, Status "${updatedRecord.status}"!`
    );
  };

  const handleConfirmDeleteAttendance = () => {
    if (!attendanceToDelete) return;
    const emp = employees.find((e) => e.id === attendanceToDelete.employeeId);
    onDeleteAttendance?.(
      attendanceToDelete.id,
      attendanceToDelete.employeeId,
      attendanceToDelete.date
    );
    setAttendanceToDelete(null);
    showToast(
      `Log presensi ${emp?.fullName || 'Karyawan'} (${formatIndoDate(
        attendanceToDelete.date
      )}) berhasil dihapus permanen!`
    );
  };

  const filteredAttendances = deduplicatedAttendances.filter((att) => {
    const emp = employees.find((e) => e.id === att.employeeId);
    if (!emp) return false;

    const empShift = getEmployeeShift(emp, workShifts);
    const recordShiftId = att.shiftId || empShift.id;

    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.nik.toLowerCase().includes(search.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(search.toLowerCase());

    const matchDept = deptFilter === 'ALL' || emp.department?.trim() === deptFilter;
    const matchStatus = statusFilter === 'ALL' || att.status === statusFilter;
    const matchShift = shiftFilter === 'ALL' || recordShiftId === shiftFilter;

    return matchSearch && matchDept && matchStatus && matchShift;
  });

  const filteredPlotEmployees = employees.filter((emp) => {
    const empShift = getEmployeeShift(emp, workShifts);
    const matchSearch =
      emp.fullName.toLowerCase().includes(empPlotSearch.toLowerCase()) ||
      emp.nik.toLowerCase().includes(empPlotSearch.toLowerCase()) ||
      emp.role.toLowerCase().includes(empPlotSearch.toLowerCase());
    const matchDept = empPlotDeptFilter === 'ALL' || emp.department?.trim() === empPlotDeptFilter;
    const matchShift = empPlotShiftFilter === 'ALL' || empShift.id === empPlotShiftFilter;
    return matchSearch && matchDept && matchShift;
  });

  const departments = Array.from(
    new Set(
      employees
        .map((e) => e.department?.trim())
        .filter((d): d is string => Boolean(d))
    )
  );

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
          <span>Rekap Presensi Harian ({deduplicatedAttendances.length} Hari Unik)</span>
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

          {/* Grid of Shift Cards with Full Customization (Nama, Lokasi, Hari Kerja 5/6 Hari, Jam Masuk/Pulang, & Hapus Shift) */}
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
              const is5Days =
                shift.workDays.length === 5 &&
                ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].every((d) =>
                  shift.workDays.includes(d)
                );
              const is6Days =
                shift.workDays.length === 6 &&
                ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].every((d) =>
                  shift.workDays.includes(d)
                );

              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-3.5">
                    {/* Card Header with Explicit "Edit Info Shift" & "Hapus Shift" Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
                          <span className={`px-2 py-0.5 rounded font-bold border ${theme.badge}`}>
                            {shift.code}
                          </span>
                          <span>{assignedEmployees.length} Karyawan</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-sans font-semibold text-slate-700">
                            {shift.workDays.length} Hari Kerja/Minggu
                          </span>
                          {shift.isDefault && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-sans font-bold text-[10px]">
                                Shift Default
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5">{shift.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">
                            {shift.location || 'Lokasi kantor/gudang belum diatur'}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit Nama Shift, Alamat Lokasi, Hari Kerja, & Jam Shift"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Info Shift</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (workShifts.length <= 1) {
                              showToast('Minimal harus ada 1 jadwal shift aktif di sistem.');
                              return;
                            }
                            setShiftToDelete(shift);
                          }}
                          disabled={workShifts.length <= 1}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors ${
                            workShifts.length <= 1
                              ? 'text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed'
                              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 cursor-pointer'
                          }`}
                          title={
                            workShifts.length <= 1
                              ? 'Minimal harus ada 1 shift aktif'
                              : 'Hapus shift yang tidak terpakai'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Shift</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Quick Customization: Nama Shift, Lokasi Kantor/Gudang, & Hari Kerja (5/6 Hari) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Nama Shift Kerja
                        </label>
                        <input
                          type="text"
                          value={shift.name}
                          onChange={(e) =>
                            handleQuickUpdateShiftInfo(shift.id, { name: e.target.value })
                          }
                          placeholder="Nama Shift..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Alamat / Lokasi Kantor atau Gudang
                        </label>
                        <input
                          type="text"
                          value={shift.location || ''}
                          onChange={(e) =>
                            handleQuickUpdateShiftInfo(shift.id, { location: e.target.value })
                          }
                          placeholder="Alamat Kantor / Gudang..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Hari Kerja / Minggu ({shift.workDays.length} Hari):
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickUpdateShiftInfo(shift.id, {
                                  workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                is5Days
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              5 Hari (Sen-Jum)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickUpdateShiftInfo(shift.id, {
                                  workDays: [
                                    'Senin',
                                    'Selasa',
                                    'Rabu',
                                    'Kamis',
                                    'Jumat',
                                    'Sabtu',
                                  ],
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                is6Days
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              6 Hari (Sen-Sab)
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {ALL_DAYS.map((day) => {
                            const activeDay = shift.workDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleToggleCardWorkDay(shift, day)}
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                                  activeDay
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
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
                          Batas Tepat Waktu:{' '}
                          <strong className="font-mono text-slate-900">
                            {evalSample.maxAllowedCheckIn} WIB
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Istirahat: <strong>{shift.breakDurationMinutes} Menit</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Hari: <strong>{shift.workDays.length} Hari/Minggu</strong>
                        </span>
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
                1 log masuk pertama / karyawan / tanggal
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Terlambat (&gt; Toleransi)</span>
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{lateCount}</h3>
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                Toleransi: {penaltyPolicy.gracePeriodMinutes} mnt • Otomatis potong gaji
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Alpha / Mangkir &amp; Izin</span>
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                {alphaCount} Alpha • {sickCount} Sakit/Izin
              </h3>
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                Cuti disetujui: {leaveCount}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total Denda Terlambat &amp; Absen</span>
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-rose-700 mt-2">
                -
                {formatRupiah(
                  Array.from(employeePenaltyMap.values()).reduce(
                    (sum, item) => sum + item.totalDeductionAmount,
                    0
                  )
                )}
              </h3>
              <p className="text-[11px] text-purple-600 mt-1 font-medium">
                Tersinkronisasi langsung ke Payroll &amp; Slip Gaji
              </p>
            </div>
          </div>

          {/* PANEL KONFIGURASI: ATURAN DENDA KETERLAMBATAN & POTONGAN ABSEN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shrink-0">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Aturan Denda Keterlambatan &amp; Potongan Absen (Otomatis ke Payroll)
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        penaltyPolicy.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-slate-700 text-slate-300 border-slate-600'
                      }`}
                    >
                      {penaltyPolicy.enabled ? 'Aktif & Real-Time' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Deduplikasi 1 log masuk pertama/hari • Hitung otomatis menit terlambat dari Jam Masuk Shift • Potong langsung THP di Payroll &amp; Slip Gaji
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={penaltyPolicy.enabled}
                    onChange={(e) => {
                      handlePolicyChange({ enabled: e.target.checked });
                      showToast(
                        e.target.checked
                          ? 'Perhitungan otomatis denda keterlambatan & absen diaktifkan!'
                          : 'Perhitungan denda keterlambatan dinonaktifkan.'
                      );
                    }}
                    className="rounded text-emerald-500 focus:ring-emerald-400"
                  />
                  <span>Aktifkan Potongan</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsPenaltyPanelOpen((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  {isPenaltyPanelOpen ? 'Sembunyikan Aturan' : 'Atur Skema Denda'}
                </button>
              </div>
            </div>

            {isPenaltyPanelOpen && (
              <div className="p-5 space-y-5 bg-slate-50/60 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* A. Toleransi Keterlambatan (Grace Period) */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        A. Toleransi Keterlambatan (Grace Period)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[11px]">
                        {penaltyPolicy.gracePeriodMinutes} Menit
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Karyawan yang absen masuk melewati batas toleransi akan dihitung terlambat penuh dari jam masuk shift (Contoh: Shift 08:00, masuk 09:48 = terlambat 108 menit).
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Batas Toleransi Keterlambatan (Menit)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={penaltyPolicy.gracePeriodMinutes}
                          onChange={(e) =>
                            handlePolicyChange({
                              gracePeriodMinutes: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-28 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                        <div className="flex flex-wrap gap-1">
                          {[0, 5, 10, 15, 30].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handlePolicyChange({ gracePeriodMinutes: val })}
                              className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold border cursor-pointer ${
                                penaltyPolicy.gracePeriodMinutes === val
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {val}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={penaltyPolicy.useShiftGracePeriod}
                        onChange={(e) =>
                          handlePolicyChange({ useShiftGracePeriod: e.target.checked })
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Gunakan toleransi spesifik per masing-masing Shift Kerja</span>
                    </label>
                  </div>

                  {/* B. Skema Denda Terlambat */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">B. Skema Denda Terlambat</span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold text-[10px]">
                        {penaltyPolicy.latePenaltyScheme === 'flat_per_incident'
                          ? 'Flat / Kejadian'
                          : penaltyPolicy.latePenaltyScheme === 'per_minute'
                          ? 'Per Menit'
                          : 'Potong Tunjangan'}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Pilih Metode Perhitungan Denda Terlambat
                      </label>
                      <select
                        value={penaltyPolicy.latePenaltyScheme}
                        onChange={(e) =>
                          handlePolicyChange({
                            latePenaltyScheme: e.target
                              .value as AttendancePenaltyPolicy['latePenaltyScheme'],
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 cursor-pointer"
                      >
                        <option value="flat_per_incident">
                          Flat per Kejadian (Rp / Hari Terlambat)
                        </option>
                        <option value="per_minute">
                          Berjenjang / Per Menit Keterlambatan (Rp / Menit)
                        </option>
                        <option value="daily_allowance_cut">
                          Potong Tunjangan Harian / Makan &amp; Transport (%)
                        </option>
                      </select>
                    </div>

                    {penaltyPolicy.latePenaltyScheme === 'flat_per_incident' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Nominal Denda Flat per Hari Terlambat (IDR)
                        </label>
                        <input
                          type="number"
                          step={5000}
                          min={0}
                          value={penaltyPolicy.flatLatePenaltyAmount}
                          onChange={(e) =>
                            handlePolicyChange({
                              flatLatePenaltyAmount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Contoh: Terlambat 4x dalam sebulan = 4 ×{' '}
                          {formatRupiah(penaltyPolicy.flatLatePenaltyAmount)} ={' '}
                          <strong className="text-rose-600">
                            -{formatRupiah(4 * penaltyPolicy.flatLatePenaltyAmount)}
                          </strong>
                        </p>
                      </div>
                    )}

                    {penaltyPolicy.latePenaltyScheme === 'per_minute' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Tarif Denda per Menit Terlambat (IDR / Menit)
                        </label>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={penaltyPolicy.perMinutePenaltyAmount}
                          onChange={(e) =>
                            handlePolicyChange({
                              perMinutePenaltyAmount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Contoh: Total 210 menit terlambat ×{' '}
                          {formatRupiah(penaltyPolicy.perMinutePenaltyAmount)} ={' '}
                          <strong className="text-rose-600">
                            -{formatRupiah(210 * penaltyPolicy.perMinutePenaltyAmount)}
                          </strong>
                        </p>
                      </div>
                    )}

                    {penaltyPolicy.latePenaltyScheme === 'daily_allowance_cut' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Persentase Potong Tunjangan Makan &amp; Transport Harian (%)
                        </label>
                        <input
                          type="number"
                          step={10}
                          min={10}
                          max={100}
                          value={penaltyPolicy.dailyAllowanceCutPercentage}
                          onChange={(e) =>
                            handlePolicyChange({
                              dailyAllowanceCutPercentage: Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0)
                              ),
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Memotong {penaltyPolicy.dailyAllowanceCutPercentage}% dari tunjangan harian (1/
                          {penaltyPolicy.alphaWorkingDaysDivisor} × Tunj. Makan &amp; Transport) setiap hari terlambat.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* C. Potongan Alpha / Mangkir (Tanpa Keterangan) */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        C. Potongan Alpha / Mangkir
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px]">
                        {penaltyPolicy.alphaPenaltyScheme === 'proportional_25'
                          ? `1/${penaltyPolicy.alphaWorkingDaysDivisor} Gaji Pokok`
                          : 'Nominal Tetap'}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Skema Potongan Hari Alpha (Tanpa Keterangan)
                      </label>
                      <select
                        value={penaltyPolicy.alphaPenaltyScheme}
                        onChange={(e) =>
                          handlePolicyChange({
                            alphaPenaltyScheme: e.target
                              .value as AttendancePenaltyPolicy['alphaPenaltyScheme'],
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 cursor-pointer"
                      >
                        <option value="proportional_25">
                          Potong Proporsional (1/25 × Gaji Pokok per Hari Alpha)
                        </option>
                        <option value="fixed_amount">
                          Nominal Tetap per Hari Alpha (IDR / Hari)
                        </option>
                      </select>
                    </div>

                    {penaltyPolicy.alphaPenaltyScheme === 'proportional_25' ? (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Pembagi Hari Kerja Sebulan (Default 25 Hari)
                        </label>
                        <input
                          type="number"
                          min={20}
                          max={30}
                          value={penaltyPolicy.alphaWorkingDaysDivisor}
                          onChange={(e) =>
                            handlePolicyChange({
                              alphaWorkingDaysDivisor: Math.max(1, Number(e.target.value) || 25),
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Rumus: <strong>1/{penaltyPolicy.alphaWorkingDaysDivisor} × Gaji Pokok</strong> untuk setiap hari karyawan berstatus Alpa.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Nominal Potongan Tetap per Hari Alpha (IDR)
                        </label>
                        <input
                          type="number"
                          step={25000}
                          min={0}
                          value={penaltyPolicy.fixedAlphaPenaltyAmount}
                          onChange={(e) =>
                            handlePolicyChange({
                              fixedAlphaPenaltyAmount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              >
                <option value="ALL">Semua Departemen ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

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
                <option value="Alpa">Alpa / Mangkir</option>
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Cuti">Cuti</option>
              </select>
            </div>
          </div>

          {/* Attendance Table (Rekap Presensi Harian & Log Presensi) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rekap Presensi Harian &amp; Log Presensi Karyawan ({filteredAttendances.length} Log)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Admin dapat mengedit jam masuk/pulang (misal karyawan lupa check-out), menyesuaikan status absensi, atau menghapus log presensi per baris.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Tanggal &amp; Jam Real-Time</th>
                    <th className="py-3 px-4">Bukti Foto Wajah</th>
                    <th className="py-3 px-4">Jadwal Shift</th>
                    <th className="py-3 px-4">Jam Masuk / Pulang</th>
                    <th className="py-3 px-4">Evaluasi Jam Shift</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Detail Lokasi GPS HP</th>
                    <th className="py-3 px-4 text-right">Aksi Admin</th>
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
                    const isPresentWithoutCheckout =
                      (att.status === 'Hadir Tepat Waktu' || att.status === 'Terlambat') &&
                      (!att.checkOut || att.checkOut === '-');

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
                                  Foto &amp; GPS
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
                            Pulang: {att.checkOut || '-'}{' '}
                            {att.workHours > 0 ? `(${att.workHours}j)` : ''}
                          </span>
                          {isPresentWithoutCheckout && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditAttendanceModal(att)}
                              className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-sans font-bold text-[10px] cursor-pointer"
                              title="Klik untuk mengisi jam pulang karyawan yang lupa check-out"
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>Lupa Check-Out? Isi Jam</span>
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {att.status === 'Alpa' ? (
                            <span className="font-bold text-rose-600 block">
                              Alpha / Mangkir (Tanpa Keterangan)
                            </span>
                          ) : att.lateMinutes > 0 ? (
                            <span className="font-semibold text-amber-600 block">
                              Terlambat {att.lateMinutes} mnt (Shift {schedIn})
                            </span>
                          ) : att.status === 'Hadir Tepat Waktu' ? (
                            <span className="text-emerald-600 font-medium block">
                              Masuk Tepat Waktu
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium block">{att.status}</span>
                          )}
                          {(att.earlyLeaveMinutes || 0) > 0 && (
                            <span className="text-[10px] text-rose-600 font-medium block">
                              Pulang cepat {att.earlyLeaveMinutes} mnt
                            </span>
                          )}
                          {(() => {
                            const empPen = emp ? employeePenaltyMap.get(emp.id) : null;
                            if (empPen && empPen.totalDeductionAmount > 0) {
                              return (
                                <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                                  Akumulasi: {empPen.deductionNotes}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                              att.status === 'Hadir Tepat Waktu'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'Terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : att.status === 'Alpa'
                                ? 'bg-rose-100 text-rose-800 font-bold'
                                : att.status === 'Sakit' || att.status === 'Izin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {att.status}
                          </span>
                          {att.isManualStatus && (
                            <span className="block text-[9px] text-indigo-600 font-semibold mt-0.5">
                              Diset Manual Admin
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[210px]">
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
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAttendanceModal(att)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-[11px] transition-colors cursor-pointer"
                              title="Edit Jam Masuk/Pulang atau Sesuaikan Status Absensi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Jam/Status</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttendanceToDelete(att)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] transition-colors cursor-pointer"
                              title="Hapus Log Presensi Harian"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus Log</span>
                            </button>
                          </div>
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-slate-600 font-semibold">
                    Hari Kerja Shift Aktif ({shiftForm.workDays.length} Hari/Minggu)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setShiftForm((prev) => ({
                          ...prev,
                          workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
                    >
                      Set 5 Hari Kerja (Sen-Jum)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setShiftForm((prev) => ({
                          ...prev,
                          workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer"
                    >
                      Set 6 Hari Kerja (Sen-Sab)
                    </button>
                  </div>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">
                    Alamat / Lokasi Kantor atau Gudang
                  </label>
                  <input
                    type="text"
                    value={shiftForm.location}
                    onChange={(e) =>
                      setShiftForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    placeholder="Contoh: Jl. Sumber Mas I Blok C No. 191, Tangerang / Gudang Utama"
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

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Jenis Kehadiran / Status Presensi
                </label>
                <select
                  value={formAttendanceMode}
                  onChange={(e) =>
                    setFormAttendanceMode(
                      e.target.value as 'AUTO_SHIFT' | 'Alpa' | 'Sakit' | 'Izin' | 'Cuti'
                    )
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                >
                  <option value="AUTO_SHIFT">
                    Hadir Kerja (Evaluasi Tepat Waktu / Terlambat Otomatis)
                  </option>
                  <option value="Alpa">Alpa / Mangkir (Tanpa Keterangan - Potong Gaji)</option>
                  <option value="Sakit">Sakit (Surat Keterangan Dokter)</option>
                  <option value="Izin">Izin Resmi</option>
                  <option value="Cuti">Cuti</option>
                </select>
              </div>

              {formAttendanceMode === 'AUTO_SHIFT' && (
                <>
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
                        Hasil Evaluasi Shift ({selectedModalShift.checkInTime}):
                      </span>
                      <span className="font-bold">
                        {modalShiftEvaluation.status}
                        {modalShiftEvaluation.lateMinutes > 0
                          ? ` (Terlambat ${modalShiftEvaluation.lateMinutes} Menit)`
                          : ''}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="block text-[10px] opacity-75">Durasi Kerja</span>
                      <span className="font-bold">{modalShiftEvaluation.workHours} Jam</span>
                    </div>
                  </div>
                </>
              )}

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

      {/* ===================================================================== */}
      {/* MODAL 3: EDIT JAM MASUK/PULANG & STATUS LOG PRESENSI HARIAN (ADMIN)   */}
      {/* ===================================================================== */}
      {editingAttendance && (() => {
        const editEmp = employees.find((e) => e.id === editingAttendance.employeeId);
        const editShift = getEmployeeShift(editEmp, workShifts);
        const effectiveGrace = penaltyPolicy.useShiftGracePeriod
          ? editShift.gracePeriodMinutes
          : penaltyPolicy.gracePeriodMinutes;
        const isNonPresentMode =
          editAttStatusMode === 'Izin' ||
          editAttStatusMode === 'Sakit' ||
          editAttStatusMode === 'Cuti' ||
          editAttStatusMode === 'Alpa';
        const previewEval = !isNonPresentMode
          ? evaluateAttendanceAgainstShift(
              editAttCheckIn,
              editAttHasCheckOut ? editAttCheckOut : '-',
              editShift,
              effectiveGrace
            )
          : null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-indigo-600" />
                    <span>Edit Jam &amp; Status Log Presensi Harian</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Perbaiki jam pulang karyawan yang lupa check-out atau sesuaikan status absensi manual.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAttendance(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Employee & Shift Summary Banner */}
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  {editEmp?.avatarUrl && (
                    <img
                      src={editEmp.avatarUrl}
                      alt={editEmp.fullName}
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-emerald-500/30"
                    />
                  )}
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {editEmp?.fullName || editingAttendance.employeeId}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block">
                      {editEmp?.nik} • {editEmp?.department} • {formatIndoDate(editingAttendance.date)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                    {editShift.code}
                  </span>
                  <span className="block text-[11px] font-mono text-slate-600 mt-1">
                    {editShift.checkInTime} - {editShift.checkOutTime}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveEditedAttendance} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Pilih Status Absensi / Mode Evaluasi
                  </label>
                  <select
                    value={editAttStatusMode}
                    onChange={(e) =>
                      setEditAttStatusMode(
                        e.target.value as
                          | 'AUTO_SHIFT'
                          | 'Hadir Tepat Waktu'
                          | 'Terlambat'
                          | 'Izin'
                          | 'Sakit'
                          | 'Cuti'
                          | 'Alpa'
                      )
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="AUTO_SHIFT">
                      Otomatis Evaluasi Sesuai Jam Shift (Hadir Tepat Waktu / Terlambat)
                    </option>
                    <option value="Hadir Tepat Waktu">
                      Hadir Tepat Waktu (Manual Override - 0 Menit Terlambat)
                    </option>
                    <option value="Terlambat">Terlambat (Set Manual)</option>
                    <option value="Izin">Izin Resmi (Tidak Dihitung Alpha)</option>
                    <option value="Sakit">Sakit / Surat Dokter (Tidak Dihitung Alpha)</option>
                    <option value="Cuti">Cuti Resmi</option>
                    <option value="Alpa">Alpa / Mangkir (Tanpa Keterangan - Potong Gaji)</option>
                  </select>
                </div>

                {!isNonPresentMode && (
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-700 font-bold">
                            Jam Masuk (Check-In)
                          </label>
                          <button
                            type="button"
                            onClick={() => setEditAttCheckIn(editShift.checkInTime)}
                            className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                          >
                            Reset ke {editShift.checkInTime}
                          </button>
                        </div>
                        <input
                          type="time"
                          value={editAttCheckIn}
                          onChange={(e) => setEditAttCheckIn(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-700 font-bold">
                            Jam Pulang (Check-Out)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setEditAttHasCheckOut(true);
                              setEditAttCheckOut(editShift.checkOutTime);
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Isi Sesuai Shift ({editShift.checkOutTime})
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            disabled={!editAttHasCheckOut}
                            value={editAttCheckOut}
                            onChange={(e) => setEditAttCheckOut(e.target.value)}
                            className={`w-full p-2.5 border rounded-xl font-mono text-sm font-bold ${
                              editAttHasCheckOut
                                ? 'bg-white border-slate-300 text-slate-900'
                                : 'bg-slate-100 border-slate-200 text-slate-400'
                            }`}
                          />
                        </div>
                        <label className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editAttHasCheckOut}
                            onChange={(e) => setEditAttHasCheckOut(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>Sudah Check-Out (uncheck jika belum pulang)</span>
                        </label>
                      </div>
                    </div>

                    {editAttStatusMode === 'Terlambat' && (
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Durasi Terlambat Manual (Menit)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={editAttManualLateMins}
                          onChange={(e) => setEditAttManualLateMins(Number(e.target.value) || 0)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                        />
                      </div>
                    )}

                    {previewEval && (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Pratinjau Evaluasi Presensi:
                          </span>
                          <span className="font-bold text-slate-900">
                            {editAttStatusMode === 'AUTO_SHIFT'
                              ? previewEval.status
                              : editAttStatusMode}
                            {(editAttStatusMode === 'AUTO_SHIFT' && previewEval.lateMinutes > 0) ||
                            editAttStatusMode === 'Terlambat'
                              ? ` • Terlambat ${
                                  editAttStatusMode === 'Terlambat' && editAttManualLateMins > 0
                                    ? editAttManualLateMins
                                    : previewEval.lateMinutes || previewEval.rawLateMinutes
                                } Menit`
                              : ' • 0 Menit Terlambat'}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-[10px] text-slate-400 block">Jam Kerja</span>
                          <span className="font-bold text-indigo-700">
                            {previewEval.workHours} Jam
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Catatan Admin / Keterangan Lokasi
                  </label>
                  <input
                    type="text"
                    value={editAttNotes}
                    onChange={(e) => setEditAttNotes(e.target.value)}
                    placeholder="Contoh: Koreksi jam pulang oleh Admin HR (lupa check-out)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAttendance(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    Simpan Perubahan Log
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL 4: KONFIRMASI HAPUS LOG PRESENSI HARIAN                         */}
      {/* ===================================================================== */}
      {attendanceToDelete && (() => {
        const delEmp = employees.find((e) => e.id === attendanceToDelete.employeeId);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-2.5 rounded-xl bg-rose-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Hapus Log Presensi Harian?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Data log ini akan dihapus permanen dari sistem &amp; Supabase
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mb-4">
                <p className="font-bold text-slate-900">
                  {delEmp?.fullName || attendanceToDelete.employeeId} ({delEmp?.nik || '-'})
                </p>
                <p className="text-slate-600">
                  Tanggal: <strong>{formatIndoDate(attendanceToDelete.date)}</strong>
                </p>
                <p className="text-slate-600 font-mono">
                  Masuk: {attendanceToDelete.checkIn} • Pulang: {attendanceToDelete.checkOut || '-'} • Status: {attendanceToDelete.status}
                </p>
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAttendanceToDelete(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAttendance}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Ya, Hapus Log Presensi
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL 5: KONFIRMASI HAPUS SHIFT KERJA                                 */}
      {/* ===================================================================== */}
      {shiftToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Jadwal Shift ({shiftToDelete.code})?
                </h3>
                <p className="text-xs text-slate-500">
                  Karyawan di shift ini akan otomatis dialihkan ke Shift Default
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mb-4">
              <p className="font-bold text-slate-900">
                {shiftToDelete.code} — {shiftToDelete.name}
              </p>
              <p className="text-slate-600 font-mono">
                Jam Kerja: {shiftToDelete.checkInTime} - {shiftToDelete.checkOutTime} WIB ({shiftToDelete.workDays.length} Hari/Minggu)
              </p>
              {shiftToDelete.location && (
                <p className="text-slate-500">Lokasi: {shiftToDelete.location}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShiftToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteShift(shiftToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
              >
                Ya, Hapus Shift
              </button>
            </div>
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
