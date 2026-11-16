import React, { useState, useMemo, useEffect } from 'react';
import {
  Employee,
  CompanyConfig,
  HrLetterType,
  GeneratedHrLetterRecord,
  EmployeeAdjustment,
} from '../types';
import {
  formatRupiah,
  formatIndoDate,
  getJakartaDateString,
  getJakartaIsoTimestamp,
  addDaysToDateString,
  generateAutoHrLetterNumber,
  getEmployeeStandardDailyHours,
  getEmployeeHourlyRate,
  getEmployeeDailySalary,
} from '../utils/formatters';
import {
  X,
  FileText,
  Printer,
  Upload,
  CheckCircle2,
  ShieldAlert,
  FileCheck2,
  CreditCard,
  Eye,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  History,
  Building2,
  UserCheck,
} from 'lucide-react';

interface DigitalLetterGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  employees?: Employee[];
  companyConfig: CompanyConfig;
  onUpdateEmployee: (updated: Employee) => void;
  initialTab?: 'documents' | 'generator';
  initialLetterType?: HrLetterType;
  employeeAdjustment?: EmployeeAdjustment | null;
  adminName?: string;
}

async function compressDocImageToDataUrl(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export const DigitalLetterGeneratorModal: React.FC<DigitalLetterGeneratorModalProps> = ({
  isOpen,
  onClose,
  employee,
  employees = [],
  companyConfig,
  onUpdateEmployee,
  initialTab = 'generator',
  initialLetterType = 'PKWT',
  employeeAdjustment,
  adminName = 'Administrator HRD',
}) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'generator'>(initialTab);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employee?.id || '');
  const [letterType, setLetterType] = useState<HrLetterType>(initialLetterType);
  const [issuedDate, setIssuedDate] = useState<string>(() => getJakartaDateString());
  const [letterNumber, setLetterNumber] = useState<string>('');
  const [effectiveStartDate, setEffectiveStartDate] = useState<string>('');
  const [effectiveEndDate, setEffectiveEndDate] = useState<string>('');
  const [probationEndDate, setProbationEndDate] = useState<string>('');
  const [violationSummary, setViolationSummary] = useState<string>('');
  const [consequenceNotes, setConsequenceNotes] = useState<string>('');
  const [hrSignatoryName, setHrSignatoryName] = useState<string>(
    companyConfig.payrollSignatories?.preparedBy?.name || 'Lupyta Maju Perkasa HRD'
  );
  const [hrSignatoryRole, setHrSignatoryRole] = useState<string>(
    companyConfig.payrollSignatories?.preparedBy?.jobTitle || 'HR & Payroll Manager'
  );
  const [uploadingDocType, setUploadingDocType] = useState<'ktp' | 'npwp' | 'contract' | null>(
    null
  );
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    url: string;
    fileName: string;
  } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const currentEmp = useMemo(() => {
    if (selectedEmpId) {
      const found = employees.find((e) => e.id === selectedEmpId);
      if (found) return found;
    }
    return employee;
  }, [selectedEmpId, employees, employee]);

  const { totalLettersCount, existingLetterNumbersSet } = useMemo(() => {
    let count = 0;
    let maxParsedSeq = 0;
    const numSet = new Set<string>();
    const list = employees.length > 0 ? employees : currentEmp ? [currentEmp] : [];
    for (const emp of list) {
      if (Array.isArray(emp.generatedLetters)) {
        count += emp.generatedLetters.length;
        for (const rec of emp.generatedLetters) {
          if (rec?.letter_number) {
            const cleanNum = rec.letter_number.trim();
            numSet.add(cleanNum.toUpperCase());
            const m = cleanNum.match(/^(\d+)\//);
            if (m) {
              const parsed = parseInt(m[1], 10);
              if (!isNaN(parsed) && parsed > maxParsedSeq) {
                maxParsedSeq = parsed;
              }
            }
          }
        }
      }
    }
    return {
      totalLettersCount: Math.max(count, maxParsedSeq),
      existingLetterNumbersSet: numSet,
    };
  }, [employees, currentEmp]);

  const computeUniqueLetterNumber = (type: HrLetterType, dateStr: string): string => {
    let seq = totalLettersCount + 1;
    let candidate = generateAutoHrLetterNumber(type, seq, dateStr);
    while (existingLetterNumbersSet.has(candidate.toUpperCase()) && seq < totalLettersCount + 500) {
      seq += 1;
      candidate = generateAutoHrLetterNumber(type, seq, dateStr);
    }
    return candidate;
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setLetterType(initialLetterType);
      setSelectedEmpId(employee?.id || employees[0]?.id || '');
    }
  }, [isOpen, initialTab, initialLetterType, employee, employees]);

  useEffect(() => {
    if (!currentEmp) return;
    const todayWib = getJakartaDateString();
    setIssuedDate(todayWib);

    // Sinkronkan tipe surat kontrak otomatis apabila status karyawan berubah ke PKWTT atau PKWT
    setLetterType((prev) => {
      if (prev === 'PKWT' || prev === 'PKWTT') {
        const empStatus = currentEmp.employmentStatus || currentEmp.status || 'PKWT (Kontrak)';
        return empStatus === 'PKWTT (Tetap)' ? 'PKWTT' : 'PKWT';
      }
      return prev;
    });

    const startDt =
      currentEmp.contractStartDate ||
      currentEmp.contract_start_date ||
      currentEmp.joinDate ||
      todayWib;
    const endDt =
      currentEmp.contractEndDate ||
      currentEmp.contract_end_date ||
      addDaysToDateString(startDt, 365);
    const probDt =
      currentEmp.probationEndDate ||
      currentEmp.probation_end_date ||
      addDaysToDateString(startDt, 90);

    setEffectiveStartDate(startDt);
    setEffectiveEndDate(endDt);
    setProbationEndDate(probDt);

    setLetterNumber(computeUniqueLetterNumber(letterType, todayWib));

    if (letterType === 'SP1' || letterType === 'SP2' || letterType === 'SP3') {
      const adjNote = employeeAdjustment?.catatan_kesalahan?.trim();
      const adjCount = Number(employeeAdjustment?.kesalahan_count) || 0;
      if (adjNote) {
        setViolationSummary(
          `${adjNote}${adjCount > 0 ? ` (Tercatat ${adjCount}x kesalahan pada periode berjalan)` : ''}`
        );
      } else {
        setViolationSummary(
          letterType === 'SP1'
            ? 'Pelanggaran disiplin jam kerja / keterlambatan berulang dan ketidakpatuhan terhadap SOP Operasional Tas Grosir Import.'
            : letterType === 'SP2'
            ? 'Pengulangan pelanggaran disiplin kerja setelah diterbitkannya Surat Peringatan Pertama (SP-1) serta kelalaian target operasional.'
            : 'Pelanggaran berat terhadap Peraturan Perusahaan dan SOP Kerja setelah diterbitkannya SP-1 dan SP-2.'
        );
      }

      setConsequenceNotes(
        letterType === 'SP1'
          ? 'Surat Peringatan Pertama (SP-1) ini berlaku selama 6 (enam) bulan sejak tanggal diterbitkan. Apabila terjadi pelanggaran kembali dalam masa berlaku tersebut, maka akan ditingkatkan menjadi Surat Peringatan Kedua (SP-2) disertai pemotongan tunjangan kedisiplinan.'
          : letterType === 'SP2'
          ? 'Surat Peringatan Kedua (SP-2) ini berlaku selama 6 (enam) bulan. Apabila Saudara/i kembali melakukan pelanggaran disiplin, maka perusahaan akan menerbitkan Surat Peringatan Ketiga (SP-3) / Terakhir.'
          : 'Surat Peringatan Ketiga (SP-3) ini merupakan peringatan terakhir. Apabila masih terjadi pelanggaran dalam masa pembinaan, perusahaan berhak melakukan Pemutusan Hubungan Kerja (PHK) sesuai peraturan ketenagakerjaan yang berlaku.'
      );
    }
  }, [currentEmp, letterType, totalLettersCount, employeeAdjustment]);

  if (!isOpen || !currentEmp) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleUploadArchiveDoc = async (
    docType: 'ktp' | 'npwp' | 'contract',
    file: File
  ) => {
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!validImageTypes.includes(file.type) && !isPdf) {
      showToast('Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Ukuran file terlalu besar (Maksimal 10 MB).');
      return;
    }

    setUploadingDocType(docType);
    try {
      const compressed = isPdf
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
          })
        : await compressDocImageToDataUrl(file, 960, 0.76);
      const todayFormatted = formatIndoDate(getJakartaDateString());
      let updated: Employee = { ...currentEmp };

      if (docType === 'ktp') {
        updated = {
          ...currentEmp,
          ktpPhotoUrl: compressed,
          ktpUploadedAt: todayFormatted,
        };
      } else if (docType === 'npwp') {
        updated = {
          ...currentEmp,
          npwpPhotoUrl: compressed,
          npwp_photo_url: compressed,
          npwpUploadedAt: todayFormatted,
        };
      } else if (docType === 'contract') {
        updated = {
          ...currentEmp,
          contractDocumentUrl: compressed,
          contractDocumentName: file.name || `Kontrak-${currentEmp.nik}.jpg`,
          contractUpdatedAt: todayFormatted,
        };
      }

      onUpdateEmployee(updated);
      showToast(
        `Dokumen ${
          docType === 'ktp' ? 'e-KTP' : docType === 'npwp' ? 'NPWP' : 'Kontrak Kerja'
        } ${currentEmp.fullName} berhasil diunggah & disinkronkan ke Supabase!`
      );
    } catch {
      showToast('Gagal memproses file dokumen. Pastikan format JPG/PNG/WEBP/PDF valid.');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleRemoveArchiveDoc = (docType: 'ktp' | 'npwp' | 'contract') => {
    let updated: Employee = { ...currentEmp };
    if (docType === 'ktp') {
      updated = { ...currentEmp, ktpPhotoUrl: undefined, ktpUploadedAt: undefined };
    } else if (docType === 'npwp') {
      updated = {
        ...currentEmp,
        npwpPhotoUrl: undefined,
        npwp_photo_url: undefined,
        npwpUploadedAt: undefined,
      };
    } else if (docType === 'contract') {
      updated = {
        ...currentEmp,
        contractDocumentUrl: undefined,
        contractDocumentName: undefined,
      };
    }
    onUpdateEmployee(updated);
    showToast('Arsip dokumen telah dihapus dari profil karyawan.');
  };

  const stdHours = getEmployeeStandardDailyHours(currentEmp);
  const hourlyRate = getEmployeeHourlyRate(currentEmp, stdHours, 25);
  const dailySalary = getEmployeeDailySalary(currentEmp, 25, stdHours);
  const totalFixedAllowances =
    (Number(currentEmp.allowances?.position) || 0) +
    (Number(currentEmp.allowances?.transport) || 0) +
    (Number(currentEmp.allowances?.meal) || 0) +
    (Number(currentEmp.allowances?.communication) || 0);
  const spExpiryDateWib = addDaysToDateString(issuedDate, 180);

  const handleSaveLetterToArchive = (): GeneratedHrLetterRecord => {
    const existingList = Array.isArray(currentEmp.generatedLetters)
      ? currentEmp.generatedLetters
      : [];
    const trimmedInputNum = letterNumber.trim();
    const resolvedLetterNum =
      trimmedInputNum || computeUniqueLetterNumber(letterType, issuedDate);

    // Anti-duplikat: Jika nomor surat yang sama persis untuk tipe surat ini sudah ada di arsip karyawan ini, perbarui entri tersebut
    const existingMatchIdx = existingList.findIndex(
      (item) =>
        item.letter_number.trim().toUpperCase() === resolvedLetterNum.toUpperCase() &&
        item.letter_type === letterType
    );

    const newRecord: GeneratedHrLetterRecord = {
      id: existingMatchIdx >= 0 ? existingList[existingMatchIdx].id : `hr-letter-${Date.now()}`,
      letter_number: resolvedLetterNum,
      letter_type: letterType,
      employee_id: currentEmp.id,
      employee_nik: currentEmp.nik,
      employee_name: currentEmp.fullName,
      department: currentEmp.department,
      role: currentEmp.role,
      issued_date: issuedDate,
      effective_start_date: effectiveStartDate,
      effective_end_date:
        letterType === 'PKWT'
          ? effectiveEndDate
          : letterType.startsWith('SP')
          ? spExpiryDateWib
          : undefined,
      violation_summary: letterType.startsWith('SP') ? violationSummary : undefined,
      consequence_notes: letterType.startsWith('SP') ? consequenceNotes : undefined,
      created_by: adminName,
      created_at: getJakartaIsoTimestamp(),
    };

    const nextLetters =
      existingMatchIdx >= 0
        ? existingList.map((item, idx) => (idx === existingMatchIdx ? newRecord : item))
        : [newRecord, ...existingList];

    const updatedEmp: Employee = {
      ...currentEmp,
      contractDocumentNumber:
        letterType === 'PKWT' || letterType === 'PKWTT'
          ? newRecord.letter_number
          : currentEmp.contractDocumentNumber,
      contractStartDate:
        letterType === 'PKWT' || letterType === 'PKWTT'
          ? effectiveStartDate
          : currentEmp.contractStartDate,
      contract_start_date:
        letterType === 'PKWT' || letterType === 'PKWTT'
          ? effectiveStartDate
          : currentEmp.contract_start_date,
      contractEndDate:
        letterType === 'PKWT'
          ? effectiveEndDate
          : letterType === 'PKWTT'
          ? undefined
          : currentEmp.contractEndDate,
      contract_end_date:
        letterType === 'PKWT'
          ? effectiveEndDate
          : letterType === 'PKWTT'
          ? undefined
          : currentEmp.contract_end_date,
      probationEndDate:
        letterType === 'PKWTT' ? undefined : probationEndDate || currentEmp.probationEndDate,
      probation_end_date:
        letterType === 'PKWTT' ? undefined : probationEndDate || currentEmp.probation_end_date,
      employmentStatus:
        letterType === 'PKWTT'
          ? 'PKWTT (Tetap)'
          : letterType === 'PKWT'
          ? 'PKWT (Kontrak)'
          : currentEmp.employmentStatus,
      status:
        letterType === 'PKWTT'
          ? 'PKWTT (Tetap)'
          : letterType === 'PKWT'
          ? 'PKWT (Kontrak)'
          : currentEmp.status,
      employmentType:
        letterType === 'PKWTT'
          ? 'Full-Time'
          : letterType === 'PKWT'
          ? 'Contract'
          : currentEmp.employmentType,
      employment_type:
        letterType === 'PKWTT'
          ? 'Full-Time'
          : letterType === 'PKWT'
          ? 'Contract'
          : currentEmp.employment_type,
      generatedLetters: nextLetters,
    };

    onUpdateEmployee(updatedEmp);
    showToast(`Surat ${letterType} (${newRecord.letter_number}) berhasil disimpan ke Arsip Karyawan!`);
    return newRecord;
  };

  const handlePrintLetter = () => {
    handleSaveLetterToArchive();
    const printEl = document.getElementById('hr-official-letter-print-area');
    if (!printEl) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>${letterType} - ${currentEmp.fullName} (${letterNumber})</title>
        <style>
          @page { size: A4 portrait; margin: 16mm 18mm; }
          body {
            font-family: 'Times New Roman', Times, serif;
            color: #0f172a;
            line-height: 1.5;
            font-size: 11.5pt;
            margin: 0;
            padding: 0;
          }
          .letter-container { max-width: 100%; margin: 0 auto; }
          .kop-header {
            border-bottom: 3px double #0f172a;
            padding-bottom: 10px;
            margin-bottom: 18px;
            text-align: center;
          }
          .kop-company { font-size: 15pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .kop-brand { font-size: 12pt; font-weight: bold; color: #047857; }
          .kop-addr { font-size: 9.5pt; color: #334155; margin-top: 3px; }
          .title-block { text-align: center; margin-bottom: 18px; }
          .title-text { font-size: 13pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; }
          .nomor-text { font-size: 10.5pt; font-weight: bold; margin-top: 3px; }
          table.meta-table { width: 100%; border-collapse: collapse; margin: 10px 0 14px 0; }
          table.meta-table td { padding: 3px 6px; vertical-align: top; font-size: 11pt; }
          table.meta-table td.label-col { width: 190px; font-weight: bold; }
          table.meta-table td.sep-col { width: 14px; }
          .section-heading { font-weight: bold; text-transform: uppercase; margin-top: 12px; margin-bottom: 4px; font-size: 11pt; }
          .paragraph { text-align: justify; margin-bottom: 10px; }
          .box-highlight {
            border: 1px solid #94a3b8;
            background: #f8fafc;
            padding: 10px 14px;
            border-radius: 6px;
            margin: 10px 0;
          }
          .sig-grid {
            display: table;
            width: 100%;
            margin-top: 28px;
          }
          .sig-col {
            display: table-cell;
            width: 50%;
            text-align: center;
            vertical-align: top;
          }
          .sig-space { height: 68px; }
          .sig-name { font-weight: bold; text-decoration: underline; }
        </style>
      </head>
      <body>
        ${printEl.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1500);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        {/* Sticky Header */}
        <div className="shrink-0 px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Digital Document Archive &amp; Automated HR Letter Generator
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  WIB Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {currentEmp.fullName} ({currentEmp.nik}) • {currentEmp.role} — Divisi{' '}
                {currentEmp.department}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {employees.length > 1 && (
              <select
                value={currentEmp.id}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.nik})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-tabs */}
        <div className="shrink-0 px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'generator'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generator Surat Otomatis (PKWT / PKWTT / SP1-SP3)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Arsip Dokumen Digital (KTP, NPWP, Kontrak)</span>
            </button>
          </div>

          {toastMsg && (
            <div className="px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{toastMsg}</span>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'documents' ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Brankas Arsip Dokumen Digital Karyawan (Cloud-First Supabase)</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Unggah dan kelola salinan digital e-KTP, Kartu NPWP, dan Dokumen Kontrak Kerja{' '}
                    <strong>{currentEmp.fullName}</strong>. Tersinkronisasi otomatis antar-perangkat.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: e-KTP */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <span>1. Arsip Foto / Scan e-KTP</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          currentEmp.ktpPhotoUrl
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {currentEmp.ktpPhotoUrl ? '✓ Tersimpan' : 'Belum Upload'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-600">
                      NIK KTP: <strong>{currentEmp.ktpNumber || 'Belum diisi'}</strong>
                    </p>
                    {currentEmp.ktpPhotoUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-36 flex items-center justify-center">
                        <img
                          src={currentEmp.ktpPhotoUrl}
                          alt="e-KTP"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 h-36 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <CreditCard className="w-7 h-7 mb-1 opacity-60" />
                        <span>Belum ada dokumen KTP</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <label className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDocType === 'ktp'
                          ? 'Mengunggah...'
                          : currentEmp.ktpPhotoUrl
                          ? 'Ganti KTP'
                          : 'Upload KTP'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadArchiveDoc('ktp', f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {currentEmp.ktpPhotoUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: `Arsip e-KTP — ${currentEmp.fullName}`,
                              url: currentEmp.ktpPhotoUrl!,
                              fileName: `KTP-${currentEmp.nik}.jpg`,
                            })
                          }
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          title="Lihat Dokumen KTP"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveArchiveDoc('ktp')}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Hapus Dokumen KTP"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card 2: NPWP */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span>2. Arsip Kartu NPWP</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          currentEmp.npwpPhotoUrl
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {currentEmp.npwpPhotoUrl ? '✓ Tersimpan' : 'Belum Upload'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-600">
                      No. NPWP: <strong>{currentEmp.npwp || '-'}</strong>
                    </p>
                    {currentEmp.npwpPhotoUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-36 flex items-center justify-center">
                        <img
                          src={currentEmp.npwpPhotoUrl}
                          alt="NPWP"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 h-36 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <Building2 className="w-7 h-7 mb-1 opacity-60" />
                        <span>Belum ada dokumen NPWP</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <label className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDocType === 'npwp'
                          ? 'Mengunggah...'
                          : currentEmp.npwpPhotoUrl
                          ? 'Ganti NPWP'
                          : 'Upload NPWP'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadArchiveDoc('npwp', f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {currentEmp.npwpPhotoUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: `Arsip Kartu NPWP — ${currentEmp.fullName}`,
                              url: currentEmp.npwpPhotoUrl!,
                              fileName: `NPWP-${currentEmp.nik}.jpg`,
                            })
                          }
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          title="Lihat Dokumen NPWP"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveArchiveDoc('npwp')}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Hapus Dokumen NPWP"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card 3: Kontrak Kerja */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-emerald-600" />
                        <span>3. Arsip Dokumen Kontrak</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          currentEmp.contractDocumentUrl
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {currentEmp.contractDocumentUrl ? '✓ Tersimpan' : 'Belum Upload'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-600 truncate">
                      No. SK/Kontrak:{' '}
                      <strong>{currentEmp.contractDocumentNumber || currentEmp.employmentStatus}</strong>
                    </p>
                    {currentEmp.contractDocumentUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-36 flex items-center justify-center">
                        <img
                          src={currentEmp.contractDocumentUrl}
                          alt="Kontrak Kerja"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 h-36 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <FileCheck2 className="w-7 h-7 mb-1 opacity-60" />
                        <span>Belum ada scan kontrak bertandatangan</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <label className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDocType === 'contract'
                          ? 'Mengunggah...'
                          : currentEmp.contractDocumentUrl
                          ? 'Ganti Kontrak'
                          : 'Upload Kontrak'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadArchiveDoc('contract', f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {currentEmp.contractDocumentUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: `Arsip Kontrak Kerja — ${currentEmp.fullName}`,
                              url: currentEmp.contractDocumentUrl!,
                              fileName: `Kontrak-${currentEmp.nik}.jpg`,
                            })
                          }
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          title="Lihat Dokumen Kontrak"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveArchiveDoc('contract')}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Hapus Dokumen Kontrak"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Riwayat Surat HR yang Pernah Diterbitkan */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>
                      Riwayat Penerbitan Surat Resmi Karyawan ({(currentEmp.generatedLetters || []).length})
                    </span>
                  </h5>
                </div>
                {(!currentEmp.generatedLetters || currentEmp.generatedLetters.length === 0) ? (
                  <p className="text-xs text-slate-500 italic">
                    Belum ada riwayat surat (PKWT/PKWTT/SP) yang digenerate untuk karyawan ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {currentEmp.generatedLetters.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                item.letter_type.startsWith('SP')
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {item.letter_type}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {item.letter_number}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Diterbitkan: {formatIndoDate(item.issued_date)} oleh {item.created_by}
                            {item.violation_summary ? ` • ${item.violation_summary}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLetterType(item.letter_type);
                            setLetterNumber(item.letter_number);
                            setIssuedDate(item.issued_date);
                            if (item.effective_start_date) setEffectiveStartDate(item.effective_start_date);
                            if (item.effective_end_date) setEffectiveEndDate(item.effective_end_date);
                            if (item.violation_summary) setViolationSummary(item.violation_summary);
                            if (item.consequence_notes) setConsequenceNotes(item.consequence_notes);
                            setActiveTab('generator');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer"
                        >
                          Buka &amp; Cetak Ulang
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Letter Controls */}
              <div className="lg:col-span-5 space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">
                      1. Pilih Jenis Dokumen / Surat Resmi
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(
                        [
                          { code: 'PKWT', label: 'Kontrak PKWT', color: 'indigo' },
                          { code: 'PKWTT', label: 'SK Tetap PKWTT', color: 'emerald' },
                          { code: 'SP1', label: 'Surat SP-1', color: 'amber' },
                          { code: 'SP2', label: 'Surat SP-2', color: 'orange' },
                          { code: 'SP3', label: 'Surat SP-3', color: 'rose' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setLetterType(opt.code)}
                          className={`py-2 px-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                            letterType === opt.code
                              ? opt.code.startsWith('SP')
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800">
                        2. Nomor Surat Otomatis (Auto-Numbering)
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setLetterNumber(
                            generateAutoHrLetterNumber(
                              letterType,
                              totalLettersCount + 1,
                              issuedDate
                            )
                          )
                        }
                        className="text-[11px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Otomatis</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={letterNumber}
                      onChange={(e) => setLetterNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Tanggal Terbit (WIB)
                      </label>
                      <input
                        type="date"
                        value={issuedDate}
                        onChange={(e) => setIssuedDate(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Tanggal Mulai Efektif
                      </label>
                      <input
                        type="date"
                        value={effectiveStartDate}
                        onChange={(e) => setEffectiveStartDate(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  {letterType === 'PKWT' && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <div>
                        <label className="block font-bold text-indigo-950 mb-1">
                          Tanggal Berakhir Kontrak
                        </label>
                        <input
                          type="date"
                          value={effectiveEndDate}
                          onChange={(e) => setEffectiveEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-indigo-950 mb-1">
                          Akhir Evaluasi / Probation
                        </label>
                        <input
                          type="date"
                          value={probationEndDate}
                          onChange={(e) => setProbationEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white font-semibold text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {letterType.startsWith('SP') && (
                    <div className="space-y-3 p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                      <div>
                        <label className="block font-bold text-rose-950 mb-1">
                          Uraian Pelanggaran / Kesalahan Karyawan
                        </label>
                        <textarea
                          rows={3}
                          value={violationSummary}
                          onChange={(e) => setViolationSummary(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-rose-300 bg-white text-slate-800"
                        />
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {[
                            'Terlambat hadir berulang melebihi batas toleransi shift kerja',
                            'Mangkir / Tanpa Keterangan (Alpa) tanpa izin tertulis atasan',
                            'Kesalahan berulang pada SOP Packing / Input Resi Gudang',
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setViolationSummary(preset)}
                              className="px-2 py-0.5 rounded bg-white border border-rose-200 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                            >
                              Preset {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-rose-950 mb-1">
                          Sanksi &amp; Ketentuan Pembinaan
                        </label>
                        <textarea
                          rows={3}
                          value={consequenceNotes}
                          onChange={(e) => setConsequenceNotes(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-rose-300 bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Pejabat HRD Penandatangan
                      </label>
                      <input
                        type="text"
                        value={hrSignatoryName}
                        onChange={(e) => setHrSignatoryName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Jabatan Penandatangan
                      </label>
                      <input
                        type="text"
                        value={hrSignatoryRole}
                        onChange={(e) => setHrSignatoryRole(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handlePrintLetter}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak / Download PDF ({letterType})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLetterToArchive}
                    className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan ke Profil</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Printable A4 Preview */}
              <div className="lg:col-span-7">
                <div className="bg-slate-100 p-3 sm:p-5 rounded-2xl border border-slate-300 overflow-x-auto">
                  <div
                    id="hr-official-letter-print-area"
                    className="bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-8 text-slate-900 text-xs leading-relaxed mx-auto max-w-[720px]"
                  >
                    {/* Kop Surat */}
                    <div className="kop-header border-b-4 border-double border-slate-900 pb-3 mb-4 text-center">
                      <div className="kop-company text-base sm:text-lg font-black uppercase tracking-wide text-slate-900">
                        PT LUPYTA MAJU PERKASA ({companyConfig.companyName})
                      </div>
                      <div className="kop-brand text-xs font-bold text-emerald-700">
                        Divisi Human Resources &amp; Legal Compliance
                      </div>
                      <div className="kop-addr text-[11px] text-slate-600 mt-0.5">
                        {companyConfig.address} • Telp: {companyConfig.phone} • NPWP:{' '}
                        {companyConfig.npwpCompany}
                      </div>
                    </div>

                    {/* Judul & Nomor Surat */}
                    <div className="title-block text-center mb-5">
                      <div className="title-text text-sm sm:text-base font-black underline uppercase tracking-wide">
                        {letterType === 'PKWT'
                          ? 'SURAT PERJANJIAN KERJA WAKTU TERTENTU (PKWT)'
                          : letterType === 'PKWTT'
                          ? 'SURAT KEPUTUSAN PENGANGKATAN KARYAWAN TETAP (PKWTT)'
                          : letterType === 'SP1'
                          ? 'SURAT PERINGATAN PERTAMA (SP-1)'
                          : letterType === 'SP2'
                          ? 'SURAT PERINGATAN KEDUA (SP-2)'
                          : 'SURAT PERINGATAN KETIGA / TERAKHIR (SP-3)'}
                      </div>
                      <div className="nomor-text text-xs font-mono font-bold text-slate-700 mt-1">
                        Nomor: {letterNumber}
                      </div>
                    </div>

                    {letterType === 'PKWT' || letterType === 'PKWTT' ? (
                      <div className="space-y-3">
                        <p className="paragraph">
                          Pada hari ini, tanggal <strong>{formatIndoDate(issuedDate)}</strong>, bertempat
                          di kantor operasional <strong>{companyConfig.companyName}</strong>, telah
                          dibuat dan disepakati ketentuan hubungan kerja untuk karyawan dengan
                          identitas di bawah ini:
                        </p>

                        <table className="meta-table w-full text-xs">
                          <tbody>
                            <tr>
                              <td className="label-col font-bold w-44 py-0.5">Nama Lengkap</td>
                              <td className="sep-col w-3">:</td>
                              <td className="font-bold">{currentEmp.fullName}</td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Nomor Induk Karyawan (NIK)</td>
                              <td className="sep-col">:</td>
                              <td className="font-mono">{currentEmp.nik}</td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Nomor KTP / NPWP</td>
                              <td className="sep-col">:</td>
                              <td className="font-mono">
                                {currentEmp.ktpNumber || '-'} / {currentEmp.npwp || '-'}
                              </td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Jabatan / Divisi</td>
                              <td className="sep-col">:</td>
                              <td>
                                <strong>{currentEmp.role}</strong> — Divisi{' '}
                                <strong>{currentEmp.department}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Status Kepegawaian</td>
                              <td className="sep-col">:</td>
                              <td className="font-bold text-indigo-900">
                                {letterType === 'PKWT'
                                  ? 'Karyawan Kontrak (PKWT)'
                                  : 'Karyawan Tetap (PKWTT)'}
                              </td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Masa Berlaku Kerja</td>
                              <td className="sep-col">:</td>
                              <td>
                                {letterType === 'PKWT' ? (
                                  <span>
                                    <strong>{formatIndoDate(effectiveStartDate)}</strong> s/d{' '}
                                    <strong>{formatIndoDate(effectiveEndDate)}</strong>
                                  </span>
                                ) : (
                                  <span>
                                    Efektif mulai <strong>{formatIndoDate(effectiveStartDate)}</strong>{' '}
                                    (Berlaku Tetap / PKWTT)
                                  </span>
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Standar Jam Kerja</td>
                              <td className="sep-col">:</td>
                              <td>
                                <strong>{stdHours} Jam / Hari</strong> (Sesuai Jadwal Shift Operasional)
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="box-highlight p-3 rounded-lg bg-slate-50 border border-slate-300 space-y-1">
                          <div className="font-bold text-slate-900 uppercase text-[11px]">
                            Rincian Kompensasi &amp; Hak Upah Karyawan:
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            <div>
                              • Gaji Pokok Acuan (25 Hari):{' '}
                              <strong>{formatRupiah(currentEmp.baseSalary)}</strong>
                            </div>
                            <div>
                              • Tarif Gaji Harian / Jam:{' '}
                              <strong>
                                {formatRupiah(dailySalary)}/hr ({formatRupiah(hourlyRate)}/jam)
                              </strong>
                            </div>
                            <div>
                              • Tunjangan Jabatan:{' '}
                              <strong>{formatRupiah(currentEmp.allowances?.position || 0)}</strong>
                            </div>
                            <div>
                              • Total Tunjangan Operasional:{' '}
                              <strong>{formatRupiah(totalFixedAllowances)}</strong>
                            </div>
                          </div>
                        </div>

                        <p className="paragraph">
                          <strong>Pasal Kewajiban &amp; Disiplin Kerja:</strong> Karyawan wajib mematuhi
                          Peraturan Perusahaan PT Lupyta Maju Perkasa ({companyConfig.companyName}),
                          melakukan presensi wajah &amp; GPS tepat waktu sesuai jadwal shift, serta menjaga
                          kerahasiaan data dan ketelitian operasional perusahaan.
                        </p>

                        <p className="paragraph">
                          Demikian surat{' '}
                          {letterType === 'PKWT'
                            ? 'Perjanjian Kerja Waktu Tertentu (PKWT)'
                            : 'Keputusan Pengangkatan Karyawan Tetap (PKWTT)'}{' '}
                          ini dibuat dalam keadaan sadar untuk dilaksanakan sebagaimana mestinya.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="paragraph">
                          Berdasarkan hasil evaluasi kedisiplinan dan catatan kinerja operasional,
                          Manajemen HRD <strong>PT Lupyta Maju Perkasa ({companyConfig.companyName})</strong>{' '}
                          dengan ini menerbitkan{' '}
                          <strong>
                            {letterType === 'SP1'
                              ? 'SURAT PERINGATAN PERTAMA (SP-1)'
                              : letterType === 'SP2'
                              ? 'SURAT PERINGATAN KEDUA (SP-2)'
                              : 'SURAT PERINGATAN KETIGA / TERAKHIR (SP-3)'}
                          </strong>{' '}
                          kepada:
                        </p>

                        <table className="meta-table w-full text-xs">
                          <tbody>
                            <tr>
                              <td className="label-col font-bold w-44 py-0.5">Nama Karyawan</td>
                              <td className="sep-col w-3">:</td>
                              <td className="font-bold">{currentEmp.fullName}</td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">NIK Karyawan</td>
                              <td className="sep-col">:</td>
                              <td className="font-mono">{currentEmp.nik}</td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Jabatan / Divisi</td>
                              <td className="sep-col">:</td>
                              <td>
                                {currentEmp.role} — Divisi {currentEmp.department}
                              </td>
                            </tr>
                            <tr>
                              <td className="label-col font-bold py-0.5">Masa Berlaku Surat</td>
                              <td className="sep-col">:</td>
                              <td>
                                <strong>{formatIndoDate(issuedDate)}</strong> s/d{' '}
                                <strong>{formatIndoDate(spExpiryDateWib)}</strong> (6 Bulan)
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="box-highlight p-3 rounded-lg bg-rose-50/60 border border-rose-300 space-y-1">
                          <div className="font-bold text-rose-950 uppercase text-[11px]">
                            Alasan / Rincian Pelanggaran Disiplin:
                          </div>
                          <p className="text-slate-900 font-medium">{violationSummary}</p>
                        </div>

                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 uppercase text-[11px]">
                            Ketentuan Sanksi &amp; Evaluasi Pembinaan:
                          </div>
                          <p className="paragraph">{consequenceNotes}</p>
                        </div>

                        <p className="paragraph">
                          Demikian Surat Peringatan ini diterbitkan agar menjadi perhatian serius dan
                          dasar perbaikan kinerja serta kedisiplinan Saudara/i di lingkungan kerja{' '}
                          <strong>{companyConfig.companyName}</strong>.
                        </p>
                      </div>
                    )}

                    {/* Tanda Tangan */}
                    <div className="sig-grid grid grid-cols-2 gap-6 mt-8 pt-4 text-center">
                      <div className="sig-col">
                        <p className="text-[11px] text-slate-600">
                          Tangerang, {formatIndoDate(issuedDate)}
                        </p>
                        <p className="font-bold text-slate-800">
                          Manajemen {companyConfig.companyName}
                        </p>
                        <div className="sig-space h-16" />
                        <p className="sig-name font-bold underline text-slate-900">
                          {hrSignatoryName}
                        </p>
                        <p className="text-[11px] text-slate-600">{hrSignatoryRole}</p>
                      </div>

                      <div className="sig-col">
                        <p className="text-[11px] text-slate-600">
                          Telah Membaca &amp; Menyetujui,
                        </p>
                        <p className="font-bold text-slate-800">Karyawan Bersangkutan</p>
                        <div className="sig-space h-16" />
                        <p className="sig-name font-bold underline text-slate-900">
                          {currentEmp.fullName}
                        </p>
                        <p className="text-[11px] font-mono text-slate-600">NIK: {currentEmp.nik}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Seluruh dokumen &amp; riwayat surat otomatis tersimpan di Supabase Cloud.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            Tutup Panel Dokumen
          </button>
        </div>
      </div>

      {/* Modal Preview Dokumen Gambar */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h4 className="font-bold text-sm text-slate-900">{previewDoc.title}</h4>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 max-h-[65vh] flex items-center justify-center">
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-h-[62vh] w-full object-contain"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <a
                href={previewDoc.url}
                download={previewDoc.fileName}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Dokumen</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
