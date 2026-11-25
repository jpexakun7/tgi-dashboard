import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  AlertCircle,
  User,
  ShieldCheck,
  Calendar,
  Calculator,
  Eye,
  Upload,
  Trash2,
  X,
  Download,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Employee, LeaveRequest, OvertimeRequest } from '../types';
import {
  formatIndoDate,
  formatRupiah,
  getOvertimeRatePerMinute,
  calculateOvertimePayByMinutes,
  calculateOvertimeBreakdown,
  getOvertimeMinutes,
  formatOvertimeMinutes,
  calculateMinutesBetweenTimes,
  getJakartaDateString,
  getJakartaFullDateTimeLabel,
  calculateWorkingDaysBetweenDates,
  getEmployeeDailySalary,
  getEmployeeStandardDailyHours,
  isUnpaidLeaveType,
} from '../utils/formatters';
import {
  getLeaveStatusWhatsAppUrl,
  getOvertimeStatusWhatsAppUrl,
  formatWhatsAppPhone,
} from '../utils/notificationHelper';
import { validateImageFile, compressImage } from '../utils/imageUtils';
import { sanitizeSafeText } from '../services/authSecurityService';

interface LeaveAndOvertimeProps {
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  onApproveLeave: (id: string) => void;
  onRejectLeave: (id: string) => void;
  onAddLeave: (req: LeaveRequest) => void;
  onApproveOvertime: (id: string) => void;
  onRejectOvertime: (id: string) => void;
  onAddOvertime: (req: OvertimeRequest) => void;
}

export const LeaveAndOvertime: React.FC<LeaveAndOvertimeProps> = ({
  employees,
  leaveRequests,
  overtimeRequests,
  onApproveLeave,
  onRejectLeave,
  onAddLeave,
  onApproveOvertime,
  onRejectOvertime,
  onAddOvertime,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'leave' | 'overtime'>('leave');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  // Leave Form State
  const [leaveEmpId, setLeaveEmpId] = useState(employees[0]?.id || '');
  const [leaveType, setLeaveType] = useState<LeaveRequest['type']>('Cuti Tahunan');
  const [leaveStart, setLeaveStart] = useState(() => getJakartaDateString());
  const [leaveEnd, setLeaveEnd] = useState(() => getJakartaDateString());
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveStatus, setLeaveStatus] = useState<'Disetujui' | 'Menunggu Persetujuan'>('Disetujui');
  const [leaveAttachmentUrl, setLeaveAttachmentUrl] = useState('');
  const [leaveAttachmentName, setLeaveAttachmentName] = useState('');
  const [isCompressingAttachment, setIsCompressingAttachment] = useState(false);

  const selectedLeaveEmp =
    employees.find((e) => e.id === leaveEmpId) || employees[0] || undefined;
  const selectedLeaveEmpRemainingQuota = Math.max(
    0,
    Math.round(Number(selectedLeaveEmp?.remainingLeaveDays ?? 0))
  );
  const selectedLeaveEmpDailySalary = selectedLeaveEmp
    ? getEmployeeDailySalary(
        selectedLeaveEmp,
        25,
        getEmployeeStandardDailyHours(selectedLeaveEmp)
      )
    : 0;

  const openManualLeaveModal = () => {
    const todayStr = getJakartaDateString();
    if (!leaveEmpId && employees[0]?.id) {
      setLeaveEmpId(employees[0].id);
    }
    setLeaveStart(todayStr);
    setLeaveEnd(todayStr);
    setLeaveDays(1);
    setLeaveStatus('Disetujui');
    setIsLeaveModalOpen(true);
  };
  const [previewEvidenceModal, setPreviewEvidenceModal] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    fileName?: string;
  } | null>(null);

  // State untuk opsi cepat "Kirim Notifikasi WA ke Karyawan" setelah Admin klik Setujui / Tolak
  const [waQuickPrompt, setWaQuickPrompt] = useState<{
    kind: 'leave' | 'overtime';
    status: 'Disetujui' | 'Ditolak';
    emp?: Employee;
    leave?: LeaveRequest;
    overtime?: OvertimeRequest;
  } | null>(null);
  const [adminWaNote, setAdminWaNote] = useState<string>('');

  // Overtime Form State (Hitungan Per Menit)
  const [otEmpId, setOtEmpId] = useState(employees[0]?.id || '');
  const [otDate, setOtDate] = useState(() => getJakartaDateString());
  const [otMinutes, setOtMinutes] = useState<number>(90);
  const [otStartTime, setOtStartTime] = useState<string>('17:30');
  const [otEndTime, setOtEndTime] = useState<string>('19:00');
  const [otTask, setOtTask] = useState('');

  const selectedOtEmployee = employees.find((e) => e.id === otEmpId);
  const selectedOtBreakdown = calculateOvertimeBreakdown(selectedOtEmployee, otMinutes);
  const previewOvertimePay = selectedOtBreakdown.totalOvertimePay;

  const handleTimeRangeChange = (newStart: string, newEnd: string) => {
    setOtStartTime(newStart);
    setOtEndTime(newEnd);
    const diffMins = calculateMinutesBetweenTimes(newStart, newEnd);
    if (diffMins > 0) {
      setOtMinutes(diffMins);
    }
  };

  const handleUploadEvidenceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      e.target.value = '';
      return;
    }
    try {
      setIsCompressingAttachment(true);
      const compressed = await compressImage(file, 800, 800, 0.8);
      setLeaveAttachmentUrl(compressed);
      setLeaveAttachmentName(file.name.replace(/\.[^/.]+$/, '') + '.jpg');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompressingAttachment(false);
      e.target.value = '';
    }
  };

  const handleSaveLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const nowTimestamp = getJakartaFullDateTimeLabel().compactLabel;
    const resolvedEmpId = leaveEmpId || employees[0]?.id || '';
    const resolvedDays = Math.max(1, Math.round(Number(leaveDays) || 1));
    const safeReason =
      sanitizeSafeText(leaveReason, 400) || `Input manual Admin (${leaveType})`;

    const newReq: LeaveRequest = {
      id: `leave-${Date.now()}`,
      employeeId: resolvedEmpId,
      type: leaveType,
      startDate: leaveStart,
      endDate: leaveEnd,
      totalDays: resolvedDays,
      reason: safeReason,
      status: leaveStatus,
      approvedBy: leaveStatus === 'Disetujui' ? 'HRD Admin (Input Manual)' : undefined,
      appliedAt: getJakartaDateString(),
      attachmentUrl: leaveAttachmentUrl || undefined,
      attachmentName: sanitizeSafeText(leaveAttachmentName, 120) || undefined,
      attachmentUploadedAt: leaveAttachmentUrl ? nowTimestamp : undefined,
    };
    onAddLeave(newReq);
    setIsLeaveModalOpen(false);
    setLeaveReason('');
    setLeaveAttachmentUrl('');
    setLeaveAttachmentName('');
  };

  const handleSaveOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === otEmpId);
    const validMinutes = Math.max(1, Math.min(720, Math.round(Number(otMinutes) || 0)));
    const ratePerMinute = Math.max(0, getOvertimeRatePerMinute(emp, 1.5));
    const calculatedPay = Math.max(0, calculateOvertimePayByMinutes(emp, validMinutes, 1.5));
    const safeTask = sanitizeSafeText(otTask, 400) || 'Pekerjaan operasional lembur';

    const newOt: OvertimeRequest = {
      id: `ot-${Date.now()}`,
      employeeId: otEmpId,
      date: otDate,
      hours: Number((validMinutes / 60).toFixed(2)),
      minutes: validMinutes,
      startTime: otStartTime || undefined,
      endTime: otEndTime || undefined,
      ratePerMinute,
      taskDescription: safeTask,
      calculatedPay,
      status: 'Menunggu Persetujuan',
    };
    onAddOvertime(newOt);
    setIsOvertimeModalOpen(false);
    setOtTask('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            Manajemen Cuti & Klaim Lembur (Hitungan Per Menit)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Persetujuan permohonan cuti tahunan, izin sakit, dan kalkulasi upah lembur presisi per menit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSubTab === 'leave' ? (
            <button
              onClick={openManualLeaveModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Plus className="w-4 h-4" />
              + Input Cuti / Izin Manual
            </button>
          ) : (
            <button
              onClick={() => setIsOvertimeModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              Catat Lembur Baru (Per Menit)
            </button>
          )}
        </div>
      </div>

      {/* Banner Cepat Kirim Notifikasi WA ke Karyawan saat Admin klik Setujui / Tolak */}
      {waQuickPrompt && (
        <div
          className={`p-4 rounded-2xl border shadow-sm flex flex-col gap-3 animate-in fade-in ${
            waQuickPrompt.status === 'Disetujui'
              ? 'bg-emerald-50/90 border-emerald-300'
              : 'bg-rose-50/90 border-rose-300'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  waQuickPrompt.status === 'Disetujui'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Pengajuan {waQuickPrompt.kind === 'leave' ? 'Cuti / Izin' : 'Lembur'}{' '}
                  {waQuickPrompt.emp?.fullName || 'Karyawan'} telah{' '}
                  <span
                    className={
                      waQuickPrompt.status === 'Disetujui' ? 'text-emerald-700' : 'text-rose-700'
                    }
                  >
                    {waQuickPrompt.status.toUpperCase()}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Nomor WA Karyawan:{' '}
                  <strong className="font-mono text-slate-800">
                    {formatWhatsAppPhone(waQuickPrompt.emp?.phone)
                      ? `+${formatWhatsAppPhone(waQuickPrompt.emp?.phone)}`
                      : 'Belum diisi (akan membuka kontak WA)'}
                  </strong>{' '}
                  — Tambahkan catatan admin (opsional) lalu klik tombol di bawah untuk mengirim WA otomatis.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWaQuickPrompt(null)}
              className="self-end sm:self-center p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              title="Tutup panel notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              value={adminWaNote}
              onChange={(e) => setAdminWaNote(e.target.value)}
              placeholder="Ketik catatan admin HRD untuk disertakan di pesan WhatsApp (opsional)..."
              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-600"
            />
            <a
              href={
                waQuickPrompt.kind === 'leave' && waQuickPrompt.leave
                  ? getLeaveStatusWhatsAppUrl(
                      waQuickPrompt.emp,
                      waQuickPrompt.leave,
                      waQuickPrompt.status,
                      adminWaNote
                    )
                  : waQuickPrompt.overtime
                  ? getOvertimeStatusWhatsAppUrl(
                      waQuickPrompt.emp,
                      waQuickPrompt.overtime,
                      waQuickPrompt.status,
                      adminWaNote
                    )
                  : '#'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs inline-flex items-center justify-center gap-1.5 shadow-sm shrink-0 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kirim Notifikasi WA ke Karyawan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Segmented Tab Controls */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('leave')}
          className={`py-3 px-5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeSubTab === 'leave'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Daftar Pengajuan Cuti & Izin
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
            {leaveRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('overtime')}
          className={`py-3 px-5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeSubTab === 'overtime'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Klaim Lembur Per Menit (Overtime)
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
            {overtimeRequests.length}
          </span>
        </button>
      </div>

      {/* SUB-TAB 1: LEAVE REQUESTS */}
      {activeSubTab === 'leave' && (
        <div className="space-y-6">
          {/* Kuota Cuti Karyawan Summary Cards */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Sisa Saldo Cuti Tahunan Karyawan
              </h3>
              <button
                type="button"
                onClick={openManualLeaveModal}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Input Cuti / Izin Manual</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {employees.map((emp) => (
                <div key={emp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                  <span className="font-semibold text-slate-800 text-[11px] block truncate">
                    {emp.fullName.split(' ')[0]}
                  </span>
                  <span
                    className={`text-base font-bold block mt-0.5 ${
                      (emp.remainingLeaveDays ?? 0) > 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {emp.remainingLeaveDays ?? 0}
                  </span>
                  <span className="text-[10px] text-slate-400 block">hari tersisa</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Jenis Cuti</th>
                    <th className="py-3 px-4">Periode Tanggal</th>
                    <th className="py-3 px-4">Durasi</th>
                    <th className="py-3 px-4">Alasan</th>
                    <th className="py-3 px-4">Bukti / Lampiran</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi / Verifikator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveRequests.map((leave) => {
                    const emp = employees.find((e) => e.id === leave.employeeId);
                    return (
                      <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={emp?.avatarUrl}
                              alt={emp?.fullName}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block">{emp?.fullName}</span>
                              <span className="text-[10px] text-slate-400">{emp?.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium">
                            {leave.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {formatIndoDate(leave.startDate)} s/d {formatIndoDate(leave.endDate)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {leave.totalDays} Hari
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={leave.reason}>
                          {leave.reason}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {leave.attachmentUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewEvidenceModal({
                                  title: `Bukti Pendukung Cuti / Izin — ${leave.type}`,
                                  subtitle: `${emp?.fullName || 'Karyawan'} • ${formatIndoDate(
                                    leave.startDate
                                  )} s/d ${formatIndoDate(leave.endDate)} (${leave.totalDays} Hari)`,
                                  imageUrl: leave.attachmentUrl!,
                                  fileName: leave.attachmentName || `Bukti-Cuti-${leave.id}.jpg`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Lihat Bukti</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tanpa Lampiran</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                              leave.status === 'Disetujui'
                                ? 'bg-emerald-100 text-emerald-800'
                                : leave.status === 'Ditolak'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {leave.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {leave.status === 'Menunggu Persetujuan' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  onApproveLeave(leave.id);
                                  setAdminWaNote(
                                    'Permohonan cuti/izin Anda telah disetujui HRD Tas Grosir Import. Pastikan serah terima pekerjaan telah dikoordinasikan.'
                                  );
                                  setWaQuickPrompt({
                                    kind: 'leave',
                                    status: 'Disetujui',
                                    emp,
                                    leave: { ...leave, status: 'Disetujui' },
                                  });
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs cursor-pointer"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => {
                                  onRejectLeave(leave.id);
                                  setAdminWaNote(
                                    'Mohon maaf, permohonan cuti/izin belum dapat disetujui dikarenakan jadwal operasional yang padat.'
                                  );
                                  setWaQuickPrompt({
                                    kind: 'leave',
                                    status: 'Ditolak',
                                    emp,
                                    leave: { ...leave, status: 'Ditolak' },
                                  });
                                }}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-lg text-xs cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <a
                                href={getLeaveStatusWhatsAppUrl(
                                  emp,
                                  leave,
                                  leave.status,
                                  adminWaNote
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 shadow-2xs transition-colors"
                                title={`Kirim Notifikasi WA Status Cuti (${leave.status}) ke ${emp?.fullName}`}
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Kirim Notifikasi WA ke Karyawan</span>
                              </a>
                              <span className="text-[10px] text-slate-400">
                                {leave.approvedBy || 'Telah diproses'}
                              </span>
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
        </div>
      )}

      {/* SUB-TAB 2: OVERTIME REQUESTS (PER MENIT) */}
      {activeSubTab === 'overtime' && (
        <div className="space-y-6">
          {/* Overtime Tiered Formula info (UU Ketenagakerjaan PP 35/2021) */}
          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-3">
            <Calculator className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">
                Rumus Upah Lembur Sesuai UU Ketenagakerjaan &amp; PP No. 35 Tahun 2021 (1.5× &amp; 2.0×)
              </h4>
              <p className="text-indigo-800 mt-0.5 leading-relaxed">
                Upah Sejam Dasar = <strong>(Gaji Pokok + Tunjangan Tetap) ÷ 173</strong>.{' '}
                <strong>Jam Pertama (60 menit pertama)</strong> dikali <strong>1,5×</strong> upah dasar, sedangkan{' '}
                <strong>Jam Kedua dan berikutnya (menit ke-61 dst)</strong> dikali <strong>2,0×</strong> upah dasar secara proporsional.
              </p>
            </div>
          </div>

          {/* Overtime Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Tanggal & Jam Lembur</th>
                    <th className="py-3 px-4">Durasi (Menit)</th>
                    <th className="py-3 px-4">Rincian Tarif (1.5× / 2×)</th>
                    <th className="py-3 px-4">Total Upah Lembur</th>
                    <th className="py-3 px-4">Deskripsi Tugas / Pekerjaan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi HR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overtimeRequests.map((ot) => {
                    const emp = employees.find((e) => e.id === ot.employeeId);
                    const totalMins = getOvertimeMinutes(ot);
                    const breakdown = calculateOvertimeBreakdown(emp, totalMins);
                    return (
                      <tr key={ot.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={emp?.avatarUrl}
                              alt={emp?.fullName}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block">{emp?.fullName}</span>
                              <span className="text-[10px] text-slate-400">{emp?.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <span className="block font-medium">{formatIndoDate(ot.date)}</span>
                          {ot.startTime && ot.endTime && (
                            <span className="text-[10px] font-mono text-slate-500">
                              Pukul {ot.startTime} - {ot.endTime} WIB
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-indigo-700 block">
                            {totalMins} Menit
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatOvertimeMinutes(totalMins)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          <span className="block text-[11px]">
                            Jam 1 (1.5×): {breakdown.firstHourMinutes} mnt ({formatRupiah(breakdown.firstHourPay)})
                          </span>
                          {breakdown.subsequentMinutes > 0 && (
                            <span className="block text-[10px] text-indigo-700 font-semibold">
                              Jam 2+ (2.0×): {breakdown.subsequentMinutes} mnt ({formatRupiah(breakdown.subsequentPay)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">
                            {formatRupiah(ot.calculatedPay || breakdown.totalOvertimePay)}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            Sesuai UU Ketenagakerjaan
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[220px] truncate" title={ot.taskDescription}>
                          {ot.taskDescription}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                              ot.status === 'Disetujui'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ot.status === 'Ditolak'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ot.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {ot.status === 'Menunggu Persetujuan' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  onApproveOvertime(ot.id);
                                  setAdminWaNote(
                                    'Klaim lembur Anda telah disetujui HRD dan otomatis masuk ke perhitungan Slip Gaji periode berjalan.'
                                  );
                                  setWaQuickPrompt({
                                    kind: 'overtime',
                                    status: 'Disetujui',
                                    emp,
                                    overtime: { ...ot, status: 'Disetujui' },
                                  });
                                }}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs cursor-pointer"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => {
                                  onRejectOvertime(ot.id);
                                  setAdminWaNote(
                                    'Klaim lembur belum dapat disetujui. Silakan hubungi Admin HRD untuk konfirmasi.'
                                  );
                                  setWaQuickPrompt({
                                    kind: 'overtime',
                                    status: 'Ditolak',
                                    emp,
                                    overtime: { ...ot, status: 'Ditolak' },
                                  });
                                }}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-lg text-xs cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <a
                                href={getOvertimeStatusWhatsAppUrl(
                                  emp,
                                  ot,
                                  ot.status,
                                  adminWaNote
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 shadow-2xs transition-colors"
                                title={`Kirim Notifikasi WA Status Lembur (${ot.status}) ke ${emp?.fullName}`}
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Kirim Notifikasi WA ke Karyawan</span>
                              </a>
                              <span className="text-[10px] text-slate-400">Telah diverifikasi</span>
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
        </div>
      )}

      {/* Modal + Input Cuti / Izin Manual (Admin) */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                  Input Cuti / Izin Manual (Panel Admin)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Catat pengajuan cuti/izin karyawan secara manual dengan kalkulasi hari kerja otomatis &amp; sinkronisasi Payroll.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="mt-4 space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">Pilih Nama Karyawan *</label>
                  {selectedLeaveEmp && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedLeaveEmpRemainingQuota > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Sisa Cuti Tahunan: {selectedLeaveEmpRemainingQuota} Hari
                    </span>
                  )}
                </div>
                <select
                  value={leaveEmpId || employees[0]?.id || ''}
                  onChange={(e) => setLeaveEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.nik}) — Sisa Cuti: {e.remainingLeaveDays ?? 0} hari
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Jenis Cuti / Izin *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveRequest['type'])}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  <option value="Cuti Tahunan">Cuti Tahunan (Potong Kuota Cuti Tahunan)</option>
                  <option value="Izin Sakit">Izin Sakit (Sakit / Surat Dokter)</option>
                  <option value="Izin Keperluan Pribadi">Izin Keperluan Pribadi</option>
                  <option value="Cuti Melahirkan">Cuti Melahirkan</option>
                  <option value="Cuti Tanpa Gaji (Unpaid Leave)">
                    Cuti Tanpa Gaji (Unpaid Leave — Potong Absensi Payroll)
                  </option>
                  <option value="Cuti Khusus (Menikah/Duka)">Cuti Khusus (Menikah/Duka)</option>
                </select>
              </div>

              {/* Warning Banner jika Cuti Tahunan dipilih dan Sisa Cuti 0 atau Tidak Mencukupi */}
              {leaveType === 'Cuti Tahunan' &&
                (selectedLeaveEmpRemainingQuota === 0 ||
                  selectedLeaveEmpRemainingQuota < Number(leaveDays)) && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-[11px]">
                      <span className="font-extrabold block text-amber-950">
                        {selectedLeaveEmpRemainingQuota === 0
                          ? `Peringatan: Sisa Cuti Tahunan ${selectedLeaveEmp?.fullName || 'Karyawan'} saat ini adalah 0 Hari!`
                          : `Peringatan: Sisa Cuti Tahunan (${selectedLeaveEmpRemainingQuota} hari) tidak mencukupi untuk pengajuan ${leaveDays} hari kerja!`}
                      </span>
                      <p className="text-amber-800 leading-relaxed">
                        Jika tetap disimpan dengan status <strong>Disetujui</strong>, sisa kuota cuti tahunan akan menjadi{' '}
                        <strong>
                          {Math.max(0, selectedLeaveEmpRemainingQuota - (Number(leaveDays) || 0))} hari
                        </strong>
                        . Anda juga dapat mengubah jenis izin ke{' '}
                        <strong>Cuti Tanpa Gaji (Unpaid Leave)</strong> bila memotong gaji harian.
                      </p>
                    </div>
                  </div>
                )}

              {/* Info Banner jika Cuti Tanpa Gaji (Unpaid Leave) / Izin Keperluan Pribadi dipilih */}
              {isUnpaidLeaveType(leaveType, leaveReason) && (
                <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-900 flex items-start gap-2.5">
                  <Calculator className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px]">
                    <span className="font-extrabold block text-rose-950">
                      Terhubung Otomatis ke Potongan Ketidakhadiran / Absensi Payroll
                    </span>
                    <p className="text-rose-800 leading-relaxed">
                      Saat berstatus <strong>Disetujui</strong>, sistem otomatis menghitung potongan izin/unpaid leave sebesar{' '}
                      <strong>
                        {leaveDays} hari × {formatRupiah(selectedLeaveEmpDailySalary)} = -
                        {formatRupiah(Math.round((Number(leaveDays) || 0) * selectedLeaveEmpDailySalary))}
                      </strong>{' '}
                      pada Tabel Payroll &amp; Slip Gaji periode berjalan.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => {
                      const nextStart = e.target.value;
                      const nextEnd = nextStart > leaveEnd ? nextStart : leaveEnd;
                      setLeaveStart(nextStart);
                      setLeaveEnd(nextEnd);
                      setLeaveDays(calculateWorkingDaysBetweenDates(nextStart, nextEnd));
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    min={leaveStart}
                    value={leaveEnd}
                    onChange={(e) => {
                      const nextEnd = e.target.value < leaveStart ? leaveStart : e.target.value;
                      setLeaveEnd(nextEnd);
                      setLeaveDays(calculateWorkingDaysBetweenDates(leaveStart, nextEnd));
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">
                      Jumlah Hari Kerja *
                    </label>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      Otomatis Dihitung
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min={0.5}
                    max={365}
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(Math.max(0.5, Number(e.target.value) || 1))}
                    className="w-full p-2 bg-emerald-50/40 border border-emerald-300 rounded-xl text-emerald-950 font-extrabold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Status Pengajuan *
                  </label>
                  <select
                    value={leaveStatus}
                    onChange={(e) =>
                      setLeaveStatus(e.target.value as 'Disetujui' | 'Menunggu Persetujuan')
                    }
                    className={`w-full p-2 border rounded-xl font-bold ${
                      leaveStatus === 'Disetujui'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <option value="Disetujui">✓ Langsung Disetujui (Approved)</option>
                    <option value="Menunggu Persetujuan">⏳ Menunggu Persetujuan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Alasan / Catatan Cuti atau Izin
                </label>
                <textarea
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Contoh: Acara keluarga / Pemeriksaan kesehatan / Izin keperluan mendadak..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-600">
                  Upload Gambar Bukti Pendukung (Surat Dokter / Bukti Izin — Opsional)
                </label>
                {leaveAttachmentUrl ? (
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={leaveAttachmentUrl}
                        alt="Pratinjau Bukti"
                        className="w-10 h-10 rounded-lg object-cover border border-indigo-300 shrink-0"
                      />
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {leaveAttachmentName || 'Bukti-Cuti.jpg'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLeaveAttachmentUrl('');
                        setLeaveAttachmentName('');
                      }}
                      className="p-1.5 rounded-lg bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="text-xs font-semibold text-slate-700">
                      {isCompressingAttachment
                        ? 'Mengompresi gambar...'
                        : 'Pilih Foto Surat Dokter / Bukti Izin (Otomatis Kompresi)'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleUploadEvidenceFile}
                      disabled={isCompressingAttachment}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCompressingAttachment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {leaveStatus === 'Disetujui'
                    ? 'Simpan & Langsung Setujui'
                    : 'Simpan Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajukan Lembur Baru (Hitungan Per Menit) */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Form Klaim Lembur Karyawan (Hitungan Per Menit)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Masukkan jam mulai & selesai atau ketik langsung jumlah menit lembur.
            </p>

            <form onSubmit={handleSaveOvertime} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Karyawan</label>
                <select
                  value={otEmpId}
                  onChange={(e) => setOtEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.role}) — Tarif: {formatRupiah(getOvertimeRatePerMinute(e, 1.5))}/menit
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Lembur</label>
                  <input
                    type="date"
                    value={otDate}
                    onChange={(e) => setOtDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={otStartTime}
                    onChange={(e) => handleTimeRangeChange(e.target.value, otEndTime)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={otEndTime}
                    onChange={(e) => handleTimeRangeChange(otStartTime, e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">
                    Total Durasi Lembur (Menit) *
                  </label>
                  <span className="text-[11px] font-bold text-indigo-600">
                    Setara: {formatOvertimeMinutes(otMinutes)}
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  min={1}
                  max={720}
                  required
                  value={otMinutes}
                  onChange={(e) => setOtMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[15, 30, 45, 60, 90, 120, 150, 180, 240].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOtMinutes(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        otMinutes === preset
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {preset} Menit
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulasi Rincian Kalkulasi Sesuai UU Ketenagakerjaan (1.5x & 2.0x) */}
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Jam Pertama ({selectedOtBreakdown.firstHourMinutes} mnt × 1,5×):</span>
                  <span className="font-mono font-bold">
                    {formatRupiah(selectedOtBreakdown.firstHourPay)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Jam Berikutnya ({selectedOtBreakdown.subsequentMinutes} mnt × 2,0×):</span>
                  <span className="font-mono font-bold">
                    {formatRupiah(selectedOtBreakdown.subsequentPay)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-indigo-200/80 flex items-center justify-between">
                  <span className="font-bold text-indigo-950">Total Estimasi Upah Lembur:</span>
                  <span className="text-sm font-black text-indigo-700">
                    {formatRupiah(previewOvertimePay)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rincian Tugas Lembur</label>
                <textarea
                  rows={2}
                  value={otTask}
                  onChange={(e) => setOtTask(e.target.value)}
                  placeholder="e.g. Closing pembukuan akhir bulan / Bongkar muat gudang"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Klaim Lembur ({otMinutes} Menit)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pratinjau / Zoom Bukti Cuti & Izin */}
      {previewEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewEvidenceModal.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{previewEvidenceModal.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEvidenceModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center max-h-[65vh]">
              <img
                src={previewEvidenceModal.imageUrl}
                alt={previewEvidenceModal.title}
                className="w-full max-h-[62vh] object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Tersinkronisasi dari Portal Karyawan
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewEvidenceModal.imageUrl}
                  download={previewEvidenceModal.fileName || 'Bukti-Cuti-Izin.jpg'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Bukti</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewEvidenceModal(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

