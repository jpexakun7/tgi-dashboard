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
} from 'lucide-react';
import { Employee, LeaveRequest, OvertimeRequest } from '../types';
import { formatIndoDate, formatRupiah } from '../utils/formatters';

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

  // Overtime Form State
  const [otEmpId, setOtEmpId] = useState(employees[0]?.id || '');
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otHours, setOtHours] = useState(2);
  const [otTask, setOtTask] = useState('');

  const handleSaveLeave = (e: React.FormEvent) => {
    e.preventDefault();
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
    };
    onAddLeave(newReq);
    setIsLeaveModalOpen(false);
    setLeaveReason('');
  };

  const handleSaveOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === otEmpId);
    const hourly = emp ? (emp.baseSalary + emp.allowances.position) / 173 : 50000;
    const calculatedPay = Math.round(Number(otHours) * hourly * 1.5);

    const newOt: OvertimeRequest = {
      id: `ot-${Date.now()}`,
      employeeId: otEmpId,
      date: otDate,
      hours: Number(otHours),
      taskDescription: otTask || 'Pekerjaan proyek mendesak',
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
            Manajemen Cuti & Klaim Lembur
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Persetujuan permohonan cuti tahunan, izin sakit, dan kalkulasi upah lembur resmi Kemenaker.
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
              Ajukan Lembur Baru
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
          Klaim Lembur (Overtime)
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
                        <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                          {leave.reason}
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

      {/* SUB-TAB 2: OVERTIME REQUESTS */}
      {activeSubTab === 'overtime' && (
        <div className="space-y-6">
          {/* Overtime Kemnaker Formula info */}
          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Standar Perhitungan Upah Lembur (Kepmenaker RI)</h4>
              <p className="text-indigo-800 mt-0.5">
                Upah per Jam = <strong>1 / 173 × (Gaji Pokok + Tunjangan Tetap)</strong>. Jam pertama lembur pada hari kerja dibayar 1.5×, jam berikutnya 2×. Nominal lembur yang disetujui akan langsung ditambahkan ke komponen slip gaji bulan berjalan.
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
                    <th className="py-3 px-4">Tanggal Lembur</th>
                    <th className="py-3 px-4">Durasi Jam</th>
                    <th className="py-3 px-4">Estimasi Upah Lembur</th>
                    <th className="py-3 px-4">Deskripsi Tugas / Pekerjaan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi HR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overtimeRequests.map((ot) => {
                    const emp = employees.find((e) => e.id === ot.employeeId);
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
                          {formatIndoDate(ot.date)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-indigo-700">
                          {ot.hours} Jam
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatRupiah(ot.calculatedPay)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[240px] truncate">
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajukan Lembur Baru */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Form Klaim Lembur Karyawan</h3>
            <form onSubmit={handleSaveOvertime} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Pilih Karyawan</label>
                <select
                  value={otEmpId}
                  onChange={(e) => setOtEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Tanggal Lembur</label>
                  <input
                    type="date"
                    value={otDate}
                    onChange={(e) => setOtDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Durasi Lembur (Jam)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={otHours}
                    onChange={(e) => setOtHours(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Rincian Tugas Lembur</label>
                <textarea
                  rows={2}
                  value={otTask}
                  onChange={(e) => setOtTask(e.target.value)}
                  placeholder="e.g. Closing pembukuan akhir bulan / Deployment aplikasi"
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
                  Kirim Klaim Lembur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
