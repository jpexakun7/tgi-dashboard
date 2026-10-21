import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  CalendarCheck2,
  Download,
  CheckCircle,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Clock,
  Info,
} from 'lucide-react';
import { Employee, AttendanceRecord } from '../types';
import { formatIndoDate } from '../utils/formatters';
import {
  downloadAttendanceExcelTemplate,
  downloadAttendanceCSVTemplate,
} from '../utils/excelTemplates';

interface UploadAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onApplyImportedAttendance: (importedRecords: AttendanceRecord[]) => void;
}

interface ParsedAttendanceRow {
  nik: string;
  employeeName?: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Hadir Tepat Waktu' | 'Terlambat' | 'Izin' | 'Sakit' | 'Cuti' | 'Alpa';
  workHours: number;
  lateMinutes: number;
  notes?: string;
  matchedEmployee?: Employee;
  isValid: boolean;
}

export const UploadAttendanceModal: React.FC<UploadAttendanceModalProps> = ({
  isOpen,
  onClose,
  employees,
  onApplyImportedAttendance,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const processFile = (fileToRead: File) => {
    setFile(fileToRead);
    setErrorMsg(null);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const binaryStr = evt.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setErrorMsg('File kosong atau lembar kerja tidak memiliki data baris.');
          setIsLoading(false);
          return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        const rows: ParsedAttendanceRow[] = rawJson.map((row) => {
          // Cari kolom NIK
          const nikKey = Object.keys(row).find((k) =>
            /nik|nomor induk|emp.*id/i.test(k)
          ) || 'NIK';
          const rawNik = String(row[nikKey] || '').trim();

          // Cari kolom Tanggal
          const dateKey = Object.keys(row).find((k) =>
            /tanggal|date|tgl/i.test(k)
          );
          let date = dateKey && row[dateKey] ? String(row[dateKey]).trim() : todayStr;
          // Normalisasi format tanggal jika Excel menyimpan sebagai nomor serial
          if (!isNaN(Number(date)) && Number(date) > 30000) {
            const excelDate = new Date(Math.round((Number(date) - 25569) * 86400 * 1000));
            date = excelDate.toISOString().split('T')[0];
          }

          // Cari jam masuk
          const inKey = Object.keys(row).find((k) =>
            /masuk|in|check.*in/i.test(k)
          );
          const rawCheckIn = inKey && row[inKey] ? String(row[inKey]).trim() : '08:45';

          // Cari jam keluar
          const outKey = Object.keys(row).find((k) =>
            /pulang|keluar|out|check.*out/i.test(k)
          );
          const rawCheckOut = outKey && row[outKey] ? String(row[outKey]).trim() : '17:45';

          // Cari catatan
          const noteKey = Object.keys(row).find((k) =>
            /catatan|keterangan|lokasi|note/i.test(k)
          );
          const notes = noteKey && row[noteKey] ? String(row[noteKey]).trim() : 'Impor dari mesin/file presensi';

          // Hitung keterlambatan (Standar kantor: jam 09:00 WIB)
          let lateMinutes = 0;
          let calculatedStatus: ParsedAttendanceRow['status'] = 'Hadir Tepat Waktu';

          if (rawCheckIn && rawCheckIn.includes(':')) {
            const [hStr, mStr] = rawCheckIn.split(':');
            const h = parseInt(hStr, 10) || 0;
            const m = parseInt(mStr, 10) || 0;
            const totalMinutes = h * 60 + m;
            const limitMinutes = 9 * 60; // 09:00

            if (totalMinutes > limitMinutes) {
              lateMinutes = totalMinutes - limitMinutes;
              calculatedStatus = 'Terlambat';
            }
          }

          // Cari status jika sudah dispesifikasikan di file
          const statusKey = Object.keys(row).find((k) => /status/i.test(k));
          if (statusKey && row[statusKey]) {
            const s = String(row[statusKey]).toLowerCase();
            if (s.includes('sakit')) calculatedStatus = 'Sakit';
            else if (s.includes('izin')) calculatedStatus = 'Izin';
            else if (s.includes('cuti')) calculatedStatus = 'Cuti';
            else if (s.includes('alpa')) calculatedStatus = 'Alpa';
            else if (s.includes('lambat')) calculatedStatus = 'Terlambat';
            else if (s.includes('tepat') || s.includes('hadir')) calculatedStatus = lateMinutes > 0 ? 'Terlambat' : 'Hadir Tepat Waktu';
          }

          const matchedEmployee = employees.find(
            (e) => e.nik.toLowerCase() === rawNik.toLowerCase()
          );

          return {
            nik: rawNik,
            employeeName: matchedEmployee?.fullName || row['Nama Karyawan'] || row['Nama'] || '-',
            date,
            checkIn: rawCheckIn,
            checkOut: rawCheckOut,
            status: calculatedStatus,
            workHours: 8.5,
            lateMinutes,
            notes,
            matchedEmployee,
            isValid: !!matchedEmployee,
          };
        });

        setParsedRows(rows);
      } catch (err: any) {
        setErrorMsg(`Gagal memproses file: ${err.message || 'Format tidak didukung'}`);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Gagal membaca file.');
      setIsLoading(false);
    };

    reader.readAsBinaryString(fileToRead);
  };

  const handleApply = () => {
    const validRows = parsedRows.filter((r) => r.isValid && r.matchedEmployee);
    if (validRows.length === 0) {
      setErrorMsg('Tidak ada data baris presensi yang valid.');
      return;
    }

    const newAttendanceRecords: AttendanceRecord[] = validRows.map((r, i) => ({
      id: `att-import-${Date.now()}-${i}`,
      employeeId: r.matchedEmployee!.id,
      date: r.date,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      workHours: r.workHours,
      lateMinutes: r.lateMinutes,
      notes: r.notes,
    }));

    onApplyImportedAttendance(newAttendanceRecords);
    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Unggah & Impor Data Presensi (Excel / CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Impor data log presensi harian dari mesin fingerprint atau aplikasi absensi mobile.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* Download Template Bar */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Gunakan format standar presensi TGI:</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => downloadAttendanceExcelTemplate(employees)}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Template Excel (.xlsx)
              </button>
              <button
                onClick={() => downloadAttendanceCSVTemplate(employees)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Template CSV
              </button>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-6 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2.5">
              <Upload className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-800 text-sm">
              {file ? file.name : 'Pilih atau Tarik File Excel (.xlsx, .xls) / CSV ke sini'}
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Kolom yang didukung: NIK, Tanggal, Jam Masuk, Jam Pulang, Status, Catatan / Lokasi.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Parsed Data */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-800">
                    Pratinjau Data Presensi ({parsedRows.length} baris)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                    {validCount} Cocok
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-semibold">
                      {invalidCount} NIK Tidak Dikenal
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                  }}
                  className="text-slate-500 hover:text-rose-600 font-medium text-[11px] cursor-pointer"
                >
                  Reset File
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Validasi</th>
                      <th className="py-2 px-3">NIK & Karyawan</th>
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3">Jam Masuk</th>
                      <th className="py-2 px-3">Jam Pulang</th>
                      <th className="py-2 px-3">Status Terdeteksi</th>
                      <th className="py-2 px-3">Keterlambatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.isValid ? 'hover:bg-slate-50/60' : 'bg-rose-50/50'}
                      >
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Cocok
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              NIK Tidak Ditemukan
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-800 block">
                            {row.employeeName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {row.nik}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">{row.date}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          {row.checkIn}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          {row.checkOut}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              row.status === 'Hadir Tepat Waktu'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'Terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {row.lateMinutes > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {row.lateMinutes} mnt
                            </span>
                          ) : (
                            <span className="text-emerald-600">Tepat Waktu</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer font-medium text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={parsedRows.length === 0 || validCount === 0 || isLoading}
            onClick={handleApply}
            className={`px-5 py-2 rounded-xl text-white font-semibold text-xs transition-colors shadow-md ${
              parsedRows.length === 0 || validCount === 0 || isLoading
                ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-emerald-600/30'
            }`}
          >
            {isLoading ? 'Memproses...' : `Impor (${validCount} Log) Presensi`}
          </button>
        </div>
      </div>
    </div>
  );
};
