import * as XLSX from 'xlsx';
import { Employee } from '../types';

// Buat dan unduh template Excel untuk data Payroll (Bonus, Lembur, Tunjangan Tambahan)
export function downloadPayrollExcelTemplate(employees: Employee[]) {
  const data = employees.map((emp) => ({
    NIK: emp.nik,
    'Nama Karyawan': emp.fullName,
    Jabatan: emp.role,
    'Gaji Pokok (Opsional Update)': emp.baseSalary,
    'Bonus & Insentif (IDR)': 500000,
    'Jam Lembur (Jam)': 4,
    'Potongan Lainnya (IDR)': 0,
    'Catatan Payroll': 'Penyesuaian performa bulan berjalan',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Atur lebar kolom
  worksheet['!cols'] = [
    { wch: 16 }, // NIK
    { wch: 24 }, // Nama
    { wch: 22 }, // Jabatan
    { wch: 24 }, // Gaji Pokok
    { wch: 20 }, // Bonus
    { wch: 18 }, // Jam Lembur
    { wch: 20 }, // Potongan
    { wch: 30 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Payroll_TGI');
  XLSX.writeFile(workbook, `TGI_Template_Import_Payroll_2026.xlsx`);
}

// Buat dan unduh template CSV untuk data Payroll
export function downloadPayrollCSVTemplate(employees: Employee[]) {
  const headers = ['NIK', 'Nama Karyawan', 'Gaji Pokok Update', 'Bonus', 'Jam Lembur', 'Potongan Lain'];
  const rows = employees.map((emp) => [
    emp.nik,
    `"${emp.fullName}"`,
    emp.baseSalary,
    500000,
    4,
    0,
  ]);
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `TGI_Template_Import_Payroll_2026.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Buat dan unduh template Excel untuk data Presensi & Absensi (Mesin Fingerprint/Aplikasi)
export function downloadAttendanceExcelTemplate(employees: Employee[]) {
  const today = new Date().toISOString().split('T')[0];
  const sampleData = employees.map((emp, index) => ({
    NIK: emp.nik,
    'Nama Karyawan': emp.fullName,
    Tanggal: today,
    'Jam Masuk (HH:mm)': index % 3 === 0 ? '09:18' : '08:45',
    'Jam Pulang (HH:mm)': '17:45',
    'Status Presensi': index % 3 === 0 ? 'Terlambat' : 'Hadir Tepat Waktu',
    'Catatan / Lokasi': 'Absensi Kantor Pusat Hayam Wuruk',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 16 }, // NIK
    { wch: 24 }, // Nama
    { wch: 14 }, // Tanggal
    { wch: 18 }, // Jam Masuk
    { wch: 18 }, // Jam Pulang
    { wch: 20 }, // Status Presensi
    { wch: 32 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Presensi_TGI');
  XLSX.writeFile(workbook, `TGI_Template_Import_Presensi_2026.xlsx`);
}

// Buat dan unduh template CSV untuk data Presensi
export function downloadAttendanceCSVTemplate(employees: Employee[]) {
  const today = new Date().toISOString().split('T')[0];
  const headers = ['NIK', 'Nama Karyawan', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'];
  const rows = employees.map((emp, index) => [
    emp.nik,
    `"${emp.fullName}"`,
    today,
    index % 3 === 0 ? '09:18' : '08:45',
    '17:45',
    index % 3 === 0 ? 'Terlambat' : 'Hadir Tepat Waktu',
    '"Presensi Kantor Hayam Wuruk"',
  ]);
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `TGI_Template_Import_Presensi_2026.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
