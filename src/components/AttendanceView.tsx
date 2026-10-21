import React, { useState } from 'react';
import {
  CalendarCheck2,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  Plus,
  Upload,
  Search,
  Filter,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { Employee, AttendanceRecord } from '../types';
import { formatIndoDate } from '../utils/formatters';
import { UploadAttendanceModal } from './UploadAttendanceModal';

interface AttendanceViewProps {
  employees: Employee[];
  attendances: AttendanceRecord[];
  onAddAttendance: (att: AttendanceRecord) => void;
  onApplyImportedAttendance?: (importedRecords: AttendanceRecord[]) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  employees,
  attendances,
  onAddAttendance,
  onApplyImportedAttendance,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Form Clock In State
  const [formEmpId, setFormEmpId] = useState(employees[0]?.id || '');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCheckIn, setFormCheckIn] = useState('08:45');
  const [formCheckOut, setFormCheckOut] = useState('17:45');
  const [formNotes, setFormNotes] = useState('Kehadiran onsite kantor');

  const onTimeCount = attendances.filter((a) => a.status === 'Hadir Tepat Waktu').length;
  const lateCount = attendances.filter((a) => a.status === 'Terlambat').length;
  const sickCount = attendances.filter((a) => a.status === 'Sakit' || a.status === 'Izin').length;
  const leaveCount = attendances.filter((a) => a.status === 'Cuti').length;

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === formEmpId);
    if (!emp) return;

    // Check if late (office start is 09:00)
    const [h, m] = formCheckIn.split(':').map(Number);
    const checkInMinutes = h * 60 + m;
    const standardMinutes = 9 * 60; // 09:00
    const lateMinutes = checkInMinutes > standardMinutes ? checkInMinutes - standardMinutes : 0;
    const status = lateMinutes > 0 ? 'Terlambat' : 'Hadir Tepat Waktu';

    const newAtt: AttendanceRecord = {
      id: `att-${Date.now()}`,
      employeeId: formEmpId,
      date: formDate,
      checkIn: formCheckIn,
      checkOut: formCheckOut,
      status,
      workHours: 8.5,
      lateMinutes,
      notes: formNotes,
    };

    onAddAttendance(newAtt);
    setIsModalOpen(false);
  };

  const filteredAttendances = attendances.filter((att) => {
    const emp = employees.find((e) => e.id === att.employeeId);
    if (!emp) return false;

    const matchSearch =
      emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
      emp.nik.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || att.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 border border-slate-700">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-emerald-600" />
            Presensi & Timesheet Harian
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekap absensi, jam kedatangan, keterlambatan, dan jam kerja terhubung ke kalkulator payroll TGI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            Upload Excel / CSV Absensi
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              setFormDate(now.toISOString().split('T')[0]);
              setFormCheckIn(timeStr);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4" />
            Catat Presensi Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Tepat Waktu</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{onTimeCount}</h3>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">Batas jam 09:00 WIB</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Terlambat</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{lateCount}</h3>
          <p className="text-[11px] text-amber-600 mt-1 font-medium">Potongan denda otomatis</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Sakit & Izin</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{sickCount}</h3>
          <p className="text-[11px] text-blue-600 mt-1 font-medium">Surat dokter terlampir</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Cuti Disetujui</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{leaveCount}</h3>
          <p className="text-[11px] text-purple-600 mt-1 font-medium">Pengajuan cuti tahunan</p>
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
        >
          <option value="ALL">Semua Status Kehadiran</option>
          <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
          <option value="Terlambat">Terlambat</option>
          <option value="Sakit">Sakit</option>
          <option value="Cuti">Cuti</option>
        </select>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Keluar</th>
                <th className="py-3 px-4">Durasi Kerja</th>
                <th className="py-3 px-4">Keterlambatan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Catatan / Lokasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendances.map((att) => {
                const emp = employees.find((e) => e.id === att.employeeId);
                return (
                  <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <span className="font-semibold text-slate-900 block text-xs">
                            {emp?.fullName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {emp?.nik} • {emp?.department}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {formatIndoDate(att.date)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {att.checkIn}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {att.checkOut}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {att.workHours > 0 ? `${att.workHours} Jam` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {att.lateMinutes > 0 ? (
                        <span className="font-semibold text-amber-600">
                          {att.lateMinutes} menit
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Tepat Waktu</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
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
                    <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">
                      {att.notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Presensi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Catat Presensi Harian</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Input check-in dan check-out karyawan secara manual
            </p>

            <form onSubmit={handleSaveAttendance} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Pilih Karyawan</label>
                <select
                  value={formEmpId}
                  onChange={(e) => setFormEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.nik})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Tanggal Presensi</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Jam Masuk (Check-In)</label>
                  <input
                    type="time"
                    value={formCheckIn}
                    onChange={(e) => setFormCheckIn(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Jam Pulang (Check-Out)</label>
                  <input
                    type="time"
                    value={formCheckOut}
                    onChange={(e) => setFormCheckOut(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Catatan / Keterangan</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Kantor Pusat Tas Grosir Import / WFH / Gudang"
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
