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
} from 'lucide-react';
import { Employee, LeaveRequest, OvertimeRequest } from '../types';
import {
  formatIndoDate,
  formatRupiah,
  getOvertimeRatePerMinute,
  calculateOvertimePayByMinutes,
  getOvertimeMinutes,
  formatOvertimeMinutes,
  calculateMinutesBetweenTimes,
} from '../utils/formatters';
import { validateImageFile, compressImage } from '../utils/imageUtils';

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
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveAttachmentUrl, setLeaveAttachmentUrl] = useState('');
  const [leaveAttachmentName, setLeaveAttachmentName] = useState('');
  const [isCompressingAttachment, setIsCompressingAttachment] = useState(false);
  const [previewEvidenceModal, setPreviewEvidenceModal] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    fileName?: string;
  } | null>(null);

  // Overtime Form State (Hitungan Per Menit)
  const [otEmpId, setOtEmpId] = useState(employees[0]?.id || '');
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otMinutes, setOtMinutes] = useState<number>(90);
  const [otStartTime, setOtStartTime] = useState<string>('17:30');
  const [otEndTime, setOtEndTime] = useState<string>('19:00');
  const [otTask, setOtTask] = useState('');

  const selectedOtEmployee = employees.find((e) => e.id === otEmpId);
  const selectedOtRatePerMinute = getOvertimeRatePerMinute(selectedOtEmployee, 1.5);
  const previewOvertimePay = calculateOvertimePayByMinutes(selectedOtEmployee, otMinutes, 1.5);

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
    const nowTimestamp = `${new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

    const newReq: LeaveRequest = {
      id: `leave-${Date.now()}`,
      employeeId: leaveEmpId,
      type: leaveType,
      startDate: leaveStart,
      endDate: leaveEnd,
      totalDays: Number(leaveDays),
      reason: leaveReason || 'Keperluan pribadi',
      status: 'Menunggu Persetujuan',
      appliedAt: new Date().toISOString().split('T')[0],
      attachmentUrl: leaveAttachmentUrl || undefined,
      attachmentName: leaveAttachmentName || undefined,
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
    const validMinutes = Math.max(1, Math.round(Number(otMinutes) || 0));
    const ratePerMinute = getOvertimeRatePerMinute(emp, 1.5);
    const calculatedPay = calculateOvertimePayByMinutes(emp, validMinutes, 1.5);

    const newOt: OvertimeRequest = {
      id: `ot-${Date.now()}`,
      employeeId: otEmpId,
      date: otDate,
      hours: Number((validMinutes / 60).toFixed(2)),
      minutes: validMinutes,
      startTime: otStartTime || undefined,
      endTime: otEndTime || undefined,
      ratePerMinute,
      taskDescription: otTask || 'Pekerjaan operasional lembur',
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
              onClick={() => setIsLeaveModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Plus className="w-4 h-4" />
              Ajukan Cuti Baru
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
            <h3 className="font-bold text-xs text-slate-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Sisa Saldo Cuti Tahunan Karyawan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {employees.map((emp) => (
                <div key={emp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                  <span className="font-semibold text-slate-800 text-[11px] block truncate">
                    {emp.fullName.split(' ')[0]}
                  </span>
                  <span className="text-base font-bold text-emerald-600 block mt-0.5">
                    {emp.remainingLeaveDays}
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
                                onClick={() => onApproveLeave(leave.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs cursor-pointer"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => onRejectLeave(leave.id)}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-lg text-xs cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {leave.approvedBy || 'Telah diproses'}
                            </span>
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
          {/* Overtime Per-Minute Formula info */}
          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-3">
            <Calculator className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Rumus Hitungan Upah Lembur Per Menit (Akurat & Proporsional)</h4>
              <p className="text-indigo-800 mt-0.5">
                Tarif Lembur per Menit = <strong>((Gaji Pokok + Tunjangan Jabatan) ÷ 173 ÷ 60) × 1.5</strong>. Total Upah Lembur = <strong>Total Menit Lembur × Tarif per Menit</strong>. Setiap menit kelebihan jam kerja dihitung secara presisi tanpa pembulatan jam yang merugikan karyawan.
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
                    <th className="py-3 px-4">Tarif / Menit</th>
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
                    const ratePerMin = ot.ratePerMinute || getOvertimeRatePerMinute(emp, 1.5);
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
                          {formatRupiah(ratePerMin)} <span className="text-[10px] text-slate-400">/mnt</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">
                            {formatRupiah(ot.calculatedPay)}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            {totalMins} mnt × {formatRupiah(ratePerMin)}
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
                                onClick={() => onApproveOvertime(ot.id)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs cursor-pointer"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => onRejectOvertime(ot.id)}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-lg text-xs cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">Telah diverifikasi</span>
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

      {/* Modal Ajukan Cuti Baru */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Form Pengajuan Cuti / Izin</h3>
            <form onSubmit={handleSaveLeave} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Pilih Karyawan</label>
                <select
                  value={leaveEmpId}
                  onChange={(e) => setLeaveEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} (Sisa Cuti: {e.remainingLeaveDays} hari)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Jenis Cuti</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="Cuti Tahunan">Cuti Tahunan</option>
                  <option value="Cuti Sakit">Cuti Sakit</option>
                  <option value="Cuti Khusus (Menikah/Duka)">Cuti Khusus (Menikah/Duka)</option>
                  <option value="Cuti Melahirkan">Cuti Melahirkan</option>
                  <option value="Izin Pribadi">Izin Pribadi</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Mulai Tanggal</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Jumlah Hari Kerja</label>
                <input
                  type="number"
                  min={1}
                  value={leaveDays}
                  onChange={(e) => setLeaveDays(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Alasan Cuti</label>
                <textarea
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Acara keluarga / pemeriksaan kesehatan"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-600">
                  Upload Gambar Bukti Pendukung (Surat Dokter / Bukti Izin)
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
                  Kirim Pengajuan
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
                  step={1}
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

              {/* Simulasi Rincian Kalkulasi Per Menit */}
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Tarif Lembur per Menit (1.5× Upah/Menit):</span>
                  <span className="font-mono font-bold">{formatRupiah(selectedOtRatePerMinute)} / menit</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Durasi Dihitung:</span>
                  <span className="font-mono font-bold">{otMinutes} Menit</span>
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

