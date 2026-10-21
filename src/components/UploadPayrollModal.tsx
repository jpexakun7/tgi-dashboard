import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Employee, PayrollRecord } from '../types';
import { formatRupiah, calculatePayroll } from '../utils/formatters';
import {
  downloadPayrollExcelTemplate,
  downloadPayrollCSVTemplate,
} from '../utils/excelTemplates';

interface UploadPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  payrolls: PayrollRecord[];
  currentPeriod: string;
  onApplyImportedPayroll: (updatedPayrolls: PayrollRecord[]) => void;
}

interface ParsedPayrollRow {
  nik: string;
  employeeName?: string;
  bonus: number;
  overtimeHours: number;
  otherDeductions: number;
  updatedBaseSalary?: number;
  matchedEmployee?: Employee;
  isValid: boolean;
  notes?: string;
}

export const UploadPayrollModal: React.FC<UploadPayrollModalProps> = ({
  isOpen,
  onClose,
  employees,
  payrolls,
  currentPeriod,
  onApplyImportedPayroll,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPayrollRow[]>([]);
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
          setErrorMsg('File kosong atau format lembar kerja tidak sesuai.');
          setIsLoading(false);
          return;
        }

        const rows: ParsedPayrollRow[] = rawJson.map((row) => {
          // Cari kolom NIK dengan berbagai variasi penamaan
          const nikKey = Object.keys(row).find((k) =>
            /nik|nomor induk|emp.*id/i.test(k)
          ) || 'NIK';
          const rawNik = String(row[nikKey] || '').trim();

          // Cari kolom Bonus
          const bonusKey = Object.keys(row).find((k) =>
            /bonus|insentif|tunjangan tambahan/i.test(k)
          );
          const bonus = bonusKey ? Number(String(row[bonusKey]).replace(/[^0-9.-]+/g, '')) || 0 : 0;

          // Cari kolom Lembur
          const otKey = Object.keys(row).find((k) =>
            /lembur|jam lembur|overtime/i.test(k)
          );
          const overtimeHours = otKey ? Number(String(row[otKey]).replace(/[^0-9.-]+/g, '')) || 0 : 0;

          // Cari kolom Potongan Lain
          const potKey = Object.keys(row).find((k) =>
            /potongan|deduction|potongan lain/i.test(k)
          );
          const otherDeductions = potKey ? Number(String(row[potKey]).replace(/[^0-9.-]+/g, '')) || 0 : 0;

          // Cocokkan dengan master data karyawan
          const matchedEmployee = employees.find(
            (e) => e.nik.toLowerCase() === rawNik.toLowerCase()
          );

          return {
            nik: rawNik,
            employeeName: matchedEmployee?.fullName || row['Nama Karyawan'] || row['Nama'] || '-',
            bonus,
            overtimeHours,
            otherDeductions,
            matchedEmployee,
            isValid: !!matchedEmployee,
            notes: matchedEmployee ? 'Cocok' : 'NIK Tidak Ditemukan',
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
      setErrorMsg('Terjadi kendala saat membaca file.');
      setIsLoading(false);
    };

    reader.readAsBinaryString(fileToRead);
  };

  const handleApply = () => {
    const validRows = parsedRows.filter((r) => r.isValid && r.matchedEmployee);
    if (validRows.length === 0) {
      setErrorMsg('Tidak ada data baris valid yang cocok dengan karyawan terdaftar.');
      return;
    }

    // Perbarui atau buat payroll record untuk karyawan yang diimpor
    const updatedPayrolls: PayrollRecord[] = payrolls.map((existingRecord) => {
      const match = validRows.find(
        (r) => r.matchedEmployee?.id === existingRecord.employeeId
      );

      if (match && match.matchedEmployee) {
        // Hitung ulang payroll dengan bonus dan lembur baru
        const rec = calculatePayroll(
          match.matchedEmployee,
          currentPeriod,
          match.overtimeHours,
          match.bonus,
          existingRecord.lateDeduction > 0 ? 30 : 0
        );
        return {
          ...rec,
          otherDeductions: match.otherDeductions,
          takeHomePay: Math.max(0, rec.takeHomePay - match.otherDeductions),
          totalDeductions: rec.totalDeductions + match.otherDeductions,
        };
      }

      return existingRecord;
    });

    onApplyImportedPayroll(updatedPayrolls);
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
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Unggah & Impor Data Payroll (Excel / CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Perbarui komponen bonus, upah lembur, dan potongan batch secara instan.
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
              <span>Belum punya formatnya? Unduh template resmi TGI:</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => downloadPayrollExcelTemplate(employees)}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Template Excel (.xlsx)
              </button>
              <button
                onClick={() => downloadPayrollCSVTemplate(employees)}
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
              Mendukung format file Excel (.xlsx, .xls) dan CSV berisikan kolom NIK, Bonus, dan Jam Lembur.
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
                    Pratinjau Data Impor ({parsedRows.length} baris)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                    {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-semibold">
                      {invalidCount} NIK Tidak Cocok
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
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">NIK</th>
                      <th className="py-2 px-3">Nama Karyawan</th>
                      <th className="py-2 px-3">Bonus & Insentif</th>
                      <th className="py-2 px-3">Jam Lembur</th>
                      <th className="py-2 px-3">Potongan Lain</th>
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
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              {row.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium">{row.nik}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {row.employeeName}
                        </td>
                        <td className="py-2 px-3 text-emerald-700 font-medium">
                          {formatRupiah(row.bonus)}
                        </td>
                        <td className="py-2 px-3 font-medium text-indigo-700">
                          {row.overtimeHours} Jam
                        </td>
                        <td className="py-2 px-3 text-rose-600">
                          {formatRupiah(row.otherDeductions)}
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
            {isLoading ? 'Memproses...' : `Terapkan (${validCount} Karyawan) ke Payroll`}
          </button>
        </div>
      </div>
    </div>
  );
};
