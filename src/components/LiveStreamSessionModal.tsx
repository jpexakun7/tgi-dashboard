import React, { useState, useEffect } from 'react';
import {
  Video,
  X,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Calculator,
  Sparkles,
  Lock,
  ShoppingBag,
  Percent,
  Coins,
  UserCheck,
  Calendar,
  Save,
  Database,
  Copy,
  Check,
} from 'lucide-react';
import { Employee, LiveStreamPlatform, LiveStreamSalesRecord } from '../types';
import {
  calculateEmployeeLiveSalesCommission,
  formatIndoDate,
  formatRupiah,
  getJakartaDateString,
  getJakartaIsoTimestamp,
  getCurrentRealTimePayrollPeriod,
} from '../utils/formatters';
import {
  generateSessionUuid,
  upsertLivestreamSessionToSupabase,
  deleteLivestreamSessionFromSupabase,
  TGI_LIVESTREAM_SQL_MIGRATION,
} from '../services/supabaseService';

interface LiveStreamSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployeeId?: string | null;
  currentPeriod?: string;
  onUpdateEmployee: (updated: Employee) => void;
  onNotify?: (message: string) => void;
}

export const LiveStreamSessionModal: React.FC<LiveStreamSessionModalProps> = ({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  currentPeriod = getCurrentRealTimePayrollPeriod(),
  onUpdateEmployee,
  onNotify,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [sessionRole, setSessionRole] = useState<'Host' | 'Co-Host'>('Host');
  const [platform, setPlatform] = useState<LiveStreamPlatform>('TikTok Shop Live');
  const [sessionDate, setSessionDate] = useState<string>(
    () => getJakartaDateString()
  );
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [durationHours, setDurationHours] = useState<number>(3);
  const [omsetAmount, setOmsetAmount] = useState<number>(0);
  const [pcsSold, setPcsSold] = useState<number>(0);

  // Tarif Komisi Fleksibel (Per Sesi atau Per Karyawan)
  const [commissionPctInput, setCommissionPctInput] = useState<number>(2.5);
  const [commissionPerPcsInput, setCommissionPerPcsInput] = useState<number>(2000);
  const [saveAsEmployeeDefaultRate, setSaveAsEmployeeDefaultRate] = useState<boolean>(true);
  const [applyRateToAllRoleSessions, setApplyRateToAllRoleSessions] = useState<boolean>(false);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [localBanner, setLocalBanner] = useState<string | null>(null);
  const [showSqlSchema, setShowSqlSchema] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const selectedEmployee =
    employees.find((e) => e.id === selectedEmployeeId) || employees[0] || null;

  // Initialize selected employee when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const targetEmp =
      (initialEmployeeId && employees.find((e) => e.id === initialEmployeeId)) ||
      employees.find(
        (e) => e.isLiveStreamHost || e.is_host || e.isCoHostLiveStream || e.is_co_host
      ) ||
      employees[0];

    if (targetEmp) {
      setSelectedEmployeeId(targetEmp.id);
      const isEmpHost = Boolean(targetEmp.is_host === true || targetEmp.isLiveStreamHost === true);
      const isEmpCoHost = Boolean(
        targetEmp.is_co_host === true || targetEmp.isCoHostLiveStream === true
      );
      const defaultRole: 'Host' | 'Co-Host' =
        isEmpCoHost && !isEmpHost ? 'Co-Host' : 'Host';
      setSessionRole(defaultRole);
      syncRatesFromEmployee(targetEmp, defaultRole);
      setEditingLogId(null);
      setOmsetAmount(0);
      setPcsSold(0);
      setSessionTitle('');
    }
  }, [isOpen, initialEmployeeId]);

  const syncRatesFromEmployee = (emp: Employee, role: 'Host' | 'Co-Host') => {
    if (role === 'Co-Host') {
      const empCoPct =
        Number(emp.co_host_commission_pct ?? emp.coHostCommissionPercentage) || 0;
      const empCoPcs =
        Number(emp.co_host_commission_per_pcs ?? emp.coHostCommissionPerPcs) || 0;
      setCommissionPctInput(empCoPct > 0 ? empCoPct : 1.0);
      setCommissionPerPcsInput(empCoPcs > 0 ? empCoPcs : 1000);
    } else {
      const empHostPct =
        Number(emp.host_commission_pct ?? emp.salesCommissionPercentage) || 0;
      const empHostPcs =
        Number(emp.host_commission_per_pcs ?? emp.salesCommissionPerPcs) || 0;
      setCommissionPctInput(empHostPct > 0 ? empHostPct : 2.5);
      setCommissionPerPcsInput(empHostPcs > 0 ? empHostPcs : 2000);
    }
  };

  if (!isOpen || !selectedEmployee) return null;

  const isSelectedEmpHost = Boolean(
    selectedEmployee.is_host === true || selectedEmployee.isLiveStreamHost === true
  );
  const isSelectedEmpCoHost = Boolean(
    selectedEmployee.is_co_host === true || selectedEmployee.isCoHostLiveStream === true
  );

  const liveSummary = calculateEmployeeLiveSalesCommission(selectedEmployee, currentPeriod);
  const uniqueLiveDaysCount = new Set(liveSummary.filteredLogs.map((l) => l.date)).size;

  // Kalkulasi Otomatis Real-Time: (Omset × Komisi %) + (Jumlah Tas Terjual × Komisi per Pcs)
  const cleanOmset = Math.max(0, Math.round(Number(omsetAmount) || 0));
  const cleanPcs = Math.max(0, Math.round(Number(pcsSold) || 0));
  const cleanPct = Math.max(0, Number(commissionPctInput) || 0);
  const cleanPerPcs = Math.max(0, Math.round(Number(commissionPerPcsInput) || 0));

  const commissionFromOmset = Math.round((cleanOmset * cleanPct) / 100);
  const commissionFromPcsSold = Math.round(cleanPcs * cleanPerPcs);
  const totalSessionCommission = commissionFromOmset + commissionFromPcsSold;

  // Proyeksi Total Insentif / Komisi Penjualan di Slip Gaji setelah sesi ini disimpan
  const existingEditingLogComm = editingLogId
    ? liveSummary.filteredLogs.find((l) => l.id === editingLogId)?.calculatedCommission || 0
    : 0;
  const projectedMonthlyCommission = Math.max(
    0,
    liveSummary.totalCommission - existingEditingLogComm + totalSessionCommission
  );

  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(TGI_LIVESTREAM_SQL_MIGRATION).catch(() => {});
    }
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const resetForm = () => {
    setEditingLogId(null);
    setOmsetAmount(0);
    setPcsSold(0);
    setSessionTitle('');
    setDurationHours(3);
    if (selectedEmployee) {
      syncRatesFromEmployee(selectedEmployee, sessionRole);
    }
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    setEditingLogId(null);
    setOmsetAmount(0);
    setPcsSold(0);
    setSessionTitle('');
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const isEmpHost = Boolean(emp.is_host === true || emp.isLiveStreamHost === true);
      const isEmpCoHost = Boolean(emp.is_co_host === true || emp.isCoHostLiveStream === true);
      const nextRole: 'Host' | 'Co-Host' = isEmpCoHost && !isEmpHost ? 'Co-Host' : 'Host';
      setSessionRole(nextRole);
      syncRatesFromEmployee(emp, nextRole);
    }
  };

  const handleSelectRole = (role: 'Host' | 'Co-Host') => {
    setSessionRole(role);
    if (!editingLogId && selectedEmployee) {
      syncRatesFromEmployee(selectedEmployee, role);
    }
  };

  const handleToggleEmployeePortalRoleFlag = (flagType: 'is_host' | 'is_co_host') => {
    const nextIsHost =
      flagType === 'is_host' ? !isSelectedEmpHost : isSelectedEmpHost;
    const nextIsCoHost =
      flagType === 'is_co_host' ? !isSelectedEmpCoHost : isSelectedEmpCoHost;

    const updatedEmployee: Employee = {
      ...selectedEmployee,
      isLiveStreamHost: nextIsHost,
      is_host: nextIsHost,
      isCoHostLiveStream: nextIsCoHost,
      is_co_host: nextIsCoHost,
    };
    onUpdateEmployee(updatedEmployee);
    const msg = `Status akses Portal Karyawan (tgi_employees) untuk ${selectedEmployee.fullName} diperbarui: is_host=${nextIsHost}, is_co_host=${nextIsCoHost}.`;
    setLocalBanner(msg);
    onNotify?.(msg);
  };

  const handleApplyRatesOnly = () => {
    const updatedLogs = (selectedEmployee.liveStreamSalesLogs || []).map((log) => {
      if (applyRateToAllRoleSessions && (log.sessionRole || 'Host') === sessionRole) {
        const logOmset = Math.max(0, Number(log.omsetAmount ?? log.omset) || 0);
        const logPcs = Math.max(0, Number(log.pcsSold ?? log.pcs_sold) || 0);
        const newCalcComm = Math.round((logOmset * cleanPct) / 100 + logPcs * cleanPerPcs);
        const updatedLog: LiveStreamSalesRecord = {
          ...log,
          commissionPercentageSnapshot: cleanPct,
          commission_pct_used: cleanPct,
          commissionPerPcsSnapshot: cleanPerPcs,
          commission_per_pcs_used: cleanPerPcs,
          calculatedCommission: newCalcComm,
          total_commission: newCalcComm,
        };
        upsertLivestreamSessionToSupabase(updatedLog).catch(() => {});
        return updatedLog;
      }
      return log;
    });

    const nextIsHost = sessionRole === 'Host' ? true : isSelectedEmpHost;
    const nextIsCoHost = sessionRole === 'Co-Host' ? true : isSelectedEmpCoHost;

    const nextHostPct =
      sessionRole === 'Host'
        ? cleanPct
        : Number(selectedEmployee.host_commission_pct ?? selectedEmployee.salesCommissionPercentage) || 2.5;
    const nextHostPerPcs =
      sessionRole === 'Host'
        ? cleanPerPcs
        : Number(selectedEmployee.host_commission_per_pcs ?? selectedEmployee.salesCommissionPerPcs) || 2000;
    const nextCoHostPct =
      sessionRole === 'Co-Host'
        ? cleanPct
        : Number(selectedEmployee.co_host_commission_pct ?? selectedEmployee.coHostCommissionPercentage) || 1.0;
    const nextCoHostPerPcs =
      sessionRole === 'Co-Host'
        ? cleanPerPcs
        : Number(selectedEmployee.co_host_commission_per_pcs ?? selectedEmployee.coHostCommissionPerPcs) || 1000;

    const updatedEmployee: Employee = {
      ...selectedEmployee,
      isLiveStreamHost: nextIsHost,
      is_host: nextIsHost,
      isCoHostLiveStream: nextIsCoHost,
      is_co_host: nextIsCoHost,
      salesCommissionPercentage: nextHostPct,
      host_commission_pct: nextHostPct,
      salesCommissionPerPcs: nextHostPerPcs,
      host_commission_per_pcs: nextHostPerPcs,
      coHostCommissionPercentage: nextCoHostPct,
      co_host_commission_pct: nextCoHostPct,
      coHostCommissionPerPcs: nextCoHostPerPcs,
      co_host_commission_per_pcs: nextCoHostPerPcs,
      liveStreamSalesLogs: updatedLogs,
    };

    onUpdateEmployee(updatedEmployee);
    const msg = `Tarif komisi ${sessionRole} (${cleanPct}% Omset + ${formatRupiah(cleanPerPcs)}/pcs) berhasil disimpan ke profil ${selectedEmployee.fullName}${applyRateToAllRoleSessions ? ' & diterapkan ke seluruh sesi periode ini' : ''}!`;
    setLocalBanner(msg);
    onNotify?.(msg);
  };

  const handleStartEditLog = (log: LiveStreamSalesRecord) => {
    setEditingLogId(log.id);
    const inferredRole: 'Host' | 'Co-Host' =
      log.sessionRole === 'Co-Host' ||
      log.role_type === 'co_host' ||
      (!log.sessionRole && isSelectedEmpCoHost && !isSelectedEmpHost)
        ? 'Co-Host'
        : 'Host';
    setSessionRole(inferredRole);
    setPlatform(log.platform || 'TikTok Shop Live');
    setSessionDate(log.date || log.session_date || getJakartaDateString());
    setSessionTitle(log.sessionTitle || log.notes || '');
    setDurationHours(Number(log.durationHours) || 3);
    setOmsetAmount(Number(log.omsetAmount ?? log.omset) || 0);
    setPcsSold(Number(log.pcsSold ?? log.pcs_sold) || 0);
    setCommissionPctInput(
      Number(log.commissionPercentageSnapshot ?? log.commission_pct_used) ||
        (inferredRole === 'Co-Host'
          ? Number(selectedEmployee.co_host_commission_pct ?? selectedEmployee.coHostCommissionPercentage) || 1.0
          : Number(selectedEmployee.host_commission_pct ?? selectedEmployee.salesCommissionPercentage) || 2.5)
    );
    setCommissionPerPcsInput(
      Number(log.commissionPerPcsSnapshot ?? log.commission_per_pcs_used) ||
        (inferredRole === 'Co-Host'
          ? Number(selectedEmployee.co_host_commission_per_pcs ?? selectedEmployee.coHostCommissionPerPcs) || 1000
          : Number(selectedEmployee.host_commission_per_pcs ?? selectedEmployee.salesCommissionPerPcs) || 2000)
    );
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanOmset <= 0 && cleanPcs <= 0) {
      const msg =
        'Mohon isi Nilai Omset Penjualan (IDR) atau Jumlah Tas yang Terjual (Pcs) terlebih dahulu.';
      setLocalBanner(msg);
      onNotify?.(msg);
      return;
    }

    const sqlRoleType: 'host' | 'co_host' = sessionRole === 'Co-Host' ? 'co_host' : 'host';
    const effectiveDate = sessionDate || getJakartaDateString();
    const effectiveTitle =
      sessionTitle.trim() || `Sesi ${sessionRole} ${platform} (${effectiveDate})`;

    let updatedLogs: LiveStreamSalesRecord[] = [];

    if (editingLogId) {
      updatedLogs = (selectedEmployee.liveStreamSalesLogs || []).map((log) => {
        if (log.id === editingLogId) {
          const editedRecord: LiveStreamSalesRecord = {
            ...log,
            employeeId: selectedEmployee.id,
            employee_id: selectedEmployee.id,
            employeeName: selectedEmployee.fullName,
            employee_name: selectedEmployee.fullName,
            date: effectiveDate,
            session_date: effectiveDate,
            period: currentPeriod,
            platform,
            sessionRole,
            role_type: sqlRoleType,
            sessionTitle: effectiveTitle,
            notes: effectiveTitle,
            durationHours: Math.max(0.5, Number(durationHours) || 1),
            omsetAmount: cleanOmset,
            omset: cleanOmset,
            pcsSold: cleanPcs,
            pcs_sold: cleanPcs,
            commissionPercentageSnapshot: cleanPct,
            commission_pct_used: cleanPct,
            commissionPerPcsSnapshot: cleanPerPcs,
            commission_per_pcs_used: cleanPerPcs,
            calculatedCommission: totalSessionCommission,
            total_commission: totalSessionCommission,
          };
          upsertLivestreamSessionToSupabase(editedRecord).catch(() => {});
          return editedRecord;
        }
        if (applyRateToAllRoleSessions && (log.sessionRole || 'Host') === sessionRole) {
          const logOmset = Math.max(0, Number(log.omsetAmount ?? log.omset) || 0);
          const logPcs = Math.max(0, Number(log.pcsSold ?? log.pcs_sold) || 0);
          const recalcComm = Math.round((logOmset * cleanPct) / 100 + logPcs * cleanPerPcs);
          const updatedLog: LiveStreamSalesRecord = {
            ...log,
            commissionPercentageSnapshot: cleanPct,
            commission_pct_used: cleanPct,
            commissionPerPcsSnapshot: cleanPerPcs,
            commission_per_pcs_used: cleanPerPcs,
            calculatedCommission: recalcComm,
            total_commission: recalcComm,
          };
          upsertLivestreamSessionToSupabase(updatedLog).catch(() => {});
          return updatedLog;
        }
        return log;
      });
    } else {
      const newRecord: LiveStreamSalesRecord = {
        id: generateSessionUuid(),
        employeeId: selectedEmployee.id,
        employee_id: selectedEmployee.id,
        employeeName: selectedEmployee.fullName,
        employee_name: selectedEmployee.fullName,
        employeeNik: selectedEmployee.nik,
        date: effectiveDate,
        session_date: effectiveDate,
        period: currentPeriod,
        platform,
        sessionRole,
        role_type: sqlRoleType,
        sessionTitle: effectiveTitle,
        notes: effectiveTitle,
        durationHours: Math.max(0.5, Number(durationHours) || 1),
        omsetAmount: cleanOmset,
        omset: cleanOmset,
        pcsSold: cleanPcs,
        pcs_sold: cleanPcs,
        commissionPercentageSnapshot: cleanPct,
        commission_pct_used: cleanPct,
        commissionPerPcsSnapshot: cleanPerPcs,
        commission_per_pcs_used: cleanPerPcs,
        calculatedCommission: totalSessionCommission,
        total_commission: totalSessionCommission,
        status: 'Terverifikasi',
        createdAt: getJakartaIsoTimestamp(),
        created_at: getJakartaIsoTimestamp(),
      };

      upsertLivestreamSessionToSupabase(newRecord).catch(() => {});

      const existingLogs = (selectedEmployee.liveStreamSalesLogs || []).map((log) => {
        if (applyRateToAllRoleSessions && (log.sessionRole || 'Host') === sessionRole) {
          const logOmset = Math.max(0, Number(log.omsetAmount ?? log.omset) || 0);
          const logPcs = Math.max(0, Number(log.pcsSold ?? log.pcs_sold) || 0);
          const recalcComm = Math.round((logOmset * cleanPct) / 100 + logPcs * cleanPerPcs);
          const updatedLog: LiveStreamSalesRecord = {
            ...log,
            commissionPercentageSnapshot: cleanPct,
            commission_pct_used: cleanPct,
            commissionPerPcsSnapshot: cleanPerPcs,
            commission_per_pcs_used: cleanPerPcs,
            calculatedCommission: recalcComm,
            total_commission: recalcComm,
          };
          upsertLivestreamSessionToSupabase(updatedLog).catch(() => {});
          return updatedLog;
        }
        return log;
      });

      updatedLogs = [newRecord, ...existingLogs];
    }

    const nextIsHost = sessionRole === 'Host' ? true : isSelectedEmpHost;
    const nextIsCoHost = sessionRole === 'Co-Host' ? true : isSelectedEmpCoHost;

    const nextHostPct =
      sessionRole === 'Host' && saveAsEmployeeDefaultRate
        ? cleanPct
        : Number(selectedEmployee.host_commission_pct ?? selectedEmployee.salesCommissionPercentage) || 2.5;
    const nextHostPerPcs =
      sessionRole === 'Host' && saveAsEmployeeDefaultRate
        ? cleanPerPcs
        : Number(selectedEmployee.host_commission_per_pcs ?? selectedEmployee.salesCommissionPerPcs) || 2000;
    const nextCoHostPct =
      sessionRole === 'Co-Host' && saveAsEmployeeDefaultRate
        ? cleanPct
        : Number(selectedEmployee.co_host_commission_pct ?? selectedEmployee.coHostCommissionPercentage) || 1.0;
    const nextCoHostPerPcs =
      sessionRole === 'Co-Host' && saveAsEmployeeDefaultRate
        ? cleanPerPcs
        : Number(selectedEmployee.co_host_commission_per_pcs ?? selectedEmployee.coHostCommissionPerPcs) || 1000;

    const updatedEmployee: Employee = {
      ...selectedEmployee,
      isLiveStreamHost: nextIsHost,
      is_host: nextIsHost,
      isCoHostLiveStream: nextIsCoHost,
      is_co_host: nextIsCoHost,
      salesCommissionPercentage: nextHostPct,
      host_commission_pct: nextHostPct,
      salesCommissionPerPcs: nextHostPerPcs,
      host_commission_per_pcs: nextHostPerPcs,
      coHostCommissionPercentage: nextCoHostPct,
      co_host_commission_pct: nextCoHostPct,
      coHostCommissionPerPcs: nextCoHostPerPcs,
      co_host_commission_per_pcs: nextCoHostPerPcs,
      liveStreamSalesLogs: updatedLogs,
    };

    onUpdateEmployee(updatedEmployee);

    const successMsg = editingLogId
      ? `Sesi ${sessionRole} (${platform}) untuk ${selectedEmployee.fullName} berhasil diperbarui di tgi_livestream_sessions & Slip Gaji (+${formatRupiah(totalSessionCommission)})!`
      : `Sesi ${sessionRole} (${platform}) — Omset ${formatRupiah(cleanOmset)} & ${cleanPcs} Pcs Tas untuk ${selectedEmployee.fullName} berhasil disimpan ke tgi_livestream_sessions! Komisi +${formatRupiah(totalSessionCommission)} otomatis masuk ke Slip Gaji.`;

    setLocalBanner(successMsg);
    onNotify?.(successMsg);
    setEditingLogId(null);
    setOmsetAmount(0);
    setPcsSold(0);
    setSessionTitle('');
  };

  const handleDeleteLog = (logId: string) => {
    deleteLivestreamSessionFromSupabase(logId).catch(() => {});
    const updatedLogs = (selectedEmployee.liveStreamSalesLogs || []).filter(
      (item) => item.id !== logId
    );
    const updatedEmployee: Employee = {
      ...selectedEmployee,
      liveStreamSalesLogs: updatedLogs,
    };
    onUpdateEmployee(updatedEmployee);
    if (editingLogId === logId) {
      resetForm();
    }
    const msg = `Catatan sesi live streaming untuk ${selectedEmployee.fullName} berhasil dihapus dari tgi_livestream_sessions & Slip Gaji diperbarui.`;
    setLocalBanner(msg);
    onNotify?.(msg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-600 to-violet-600 text-white shrink-0 shadow-sm">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Input Manual Sesi Live Streaming &amp; Komisi (Host / Co-Host)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-bold">
                  <Lock className="w-3 h-3" />
                  <span>Portal Karyawan: Read-Only (is_host / is_co_host)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tas Grosir Import • Tabel Supabase: <code className="font-mono font-bold text-pink-700">tgi_employees</code> &amp;{' '}
                <code className="font-mono font-bold text-indigo-700">tgi_livestream_sessions</code> • Periode:{' '}
                <strong>{currentPeriod}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-start">
            <button
              type="button"
              onClick={() => setShowSqlSchema((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>{showSqlSchema ? 'Tutup SQL' : 'Skrip SQL Supabase'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible SQL Migration Schema Helper */}
        {showSqlSchema && (
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-700 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">
                  Skrip Migrasi SQL Supabase (tgi_employees &amp; tgi_livestream_sessions)
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Skrip SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {TGI_LIVESTREAM_SQL_MIGRATION}
            </pre>
          </div>
        )}

        {/* Ringkasan Akumulasi Berkala Bulanan / 25 Hari Kerja */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Akumulasi Sesi (Siklus 25 Hari)
            </span>
            <span className="font-extrabold text-slate-900 text-sm block mt-0.5">
              {uniqueLiveDaysCount} Hari / {liveSummary.sessionsCount} Sesi
            </span>
            <span className="text-[10px] text-slate-500">
              Host: {liveSummary.hostSessionsCount} • Co-Host: {liveSummary.coHostSessionsCount}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Total Omset ({currentPeriod})
            </span>
            <span className="font-mono font-extrabold text-slate-900 text-sm block mt-0.5">
              {formatRupiah(liveSummary.totalOmset)}
            </span>
            <span className="text-[10px] text-pink-700 font-semibold">
              Komisi %: +{formatRupiah(liveSummary.commissionFromPercentage)}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Total Tas Terjual (Pcs)
            </span>
            <span className="font-mono font-extrabold text-indigo-800 text-sm block mt-0.5">
              {liveSummary.totalPcs.toLocaleString('id-ID')} Pcs
            </span>
            <span className="text-[10px] text-violet-700 font-semibold">
              Komisi Pcs: +{formatRupiah(liveSummary.commissionFromPcs)}
            </span>
          </div>
          <div className="bg-gradient-to-br from-pink-600 to-violet-700 text-white p-2.5 rounded-lg shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-pink-100 block">
              Total Masuk Slip Gaji
            </span>
            <span className="font-mono font-extrabold text-white text-sm block mt-0.5">
              +{formatRupiah(liveSummary.totalCommission)}
            </span>
            <span className="text-[10px] text-emerald-200 font-semibold">
              Sinkron Real-Time Payroll
            </span>
          </div>
        </div>

        {localBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{localBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setLocalBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* FORM UTAMA INPUT MANUAL 4 LANGKAH */}
        <form
          onSubmit={handleSaveSession}
          className={`p-4 sm:p-5 rounded-2xl border space-y-5 text-xs ${
            editingLogId
              ? 'bg-amber-50/60 border-amber-300'
              : 'bg-gradient-to-br from-pink-50/40 via-white to-violet-50/40 border-pink-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
            <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
              {editingLogId ? (
                <>
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Mode Edit Data Sesi Live Streaming ({selectedEmployee.fullName})</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-pink-600" />
                  <span>Formulir Input Berkala Sesi Live &amp; Kalkulasi Komisi Otomatis</span>
                </>
              )}
            </span>
            {editingLogId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-[11px] cursor-pointer"
              >
                Batal Edit (Input Baru)
              </button>
            )}
          </div>

          {/* 1. PILIH KARYAWAN & PERAN (ROLE) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                <span className="w-5 h-5 rounded-full bg-pink-600 text-white inline-flex items-center justify-center text-[11px]">
                  1
                </span>
                <UserCheck className="w-4 h-4 text-pink-600" />
                <span>Pilih Karyawan &amp; Peran Sesi Live (Role)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-500 font-semibold">Visibilitas Portal Karyawan:</span>
                <button
                  type="button"
                  onClick={() => handleToggleEmployeePortalRoleFlag('is_host')}
                  className={`px-2 py-0.5 rounded-md border font-bold cursor-pointer transition-all ${
                    isSelectedEmpHost
                      ? 'bg-pink-100 text-pink-800 border-pink-300'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  is_host: {isSelectedEmpHost ? 'TRUE' : 'FALSE'}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleEmployeePortalRoleFlag('is_co_host')}
                  className={`px-2 py-0.5 rounded-md border font-bold cursor-pointer transition-all ${
                    isSelectedEmpCoHost
                      ? 'bg-violet-100 text-violet-800 border-violet-300'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  is_co_host: {isSelectedEmpCoHost ? 'TRUE' : 'FALSE'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              {/* Dropdown Pilih Karyawan */}
              <div className="md:col-span-6">
                <label className="block text-slate-700 font-bold mb-1">
                  Pilih Karyawan yang Bertugas <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedEmployee.id}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 cursor-pointer"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nik}) — {emp.role}
                      {emp.isLiveStreamHost || emp.is_host ? ' [Host]' : ''}
                      {emp.isCoHostLiveStream || emp.is_co_host ? ' [Co-Host]' : ''}
                    </option>
                  ))}
                </select>
                <span className="block text-[10px] text-slate-500 mt-1">
                  Departemen: <strong>{selectedEmployee.department}</strong> • Tarif Profil:{' '}
                  Host ({selectedEmployee.host_commission_pct ?? selectedEmployee.salesCommissionPercentage ?? 2.5}% +{' '}
                  {formatRupiah(selectedEmployee.host_commission_per_pcs ?? selectedEmployee.salesCommissionPerPcs ?? 2000)}/pcs) | Co-Host (
                  {selectedEmployee.co_host_commission_pct ?? selectedEmployee.coHostCommissionPercentage ?? 1.0}% +{' '}
                  {formatRupiah(selectedEmployee.co_host_commission_per_pcs ?? selectedEmployee.coHostCommissionPerPcs ?? 1000)}/pcs)
                </span>
              </div>

              {/* Pilihan Peran Sesi Live: [ ] Host Utama atau [ ] Co-Host */}
              <div className="md:col-span-6">
                <label className="block text-slate-700 font-bold mb-1">
                  Pilihan Peran Sesi Live (role_type) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectRole('Host')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      sessionRole === 'Host'
                        ? 'bg-pink-50 border-pink-500 ring-2 ring-pink-500/20 text-pink-950'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={sessionRole === 'Host'}
                      className="mt-0.5 w-4 h-4 rounded text-pink-600 pointer-events-none"
                    />
                    <div>
                      <span className="font-extrabold block text-xs">Host Utama (host)</span>
                      <span className="text-[10px] text-slate-500 block">
                        Default: {selectedEmployee.host_commission_pct ?? selectedEmployee.salesCommissionPercentage ?? 2.5}% Omset +{' '}
                        {formatRupiah(selectedEmployee.host_commission_per_pcs ?? selectedEmployee.salesCommissionPerPcs ?? 2000)}/pcs
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRole('Co-Host')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      sessionRole === 'Co-Host'
                        ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-500/20 text-violet-950'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={sessionRole === 'Co-Host'}
                      className="mt-0.5 w-4 h-4 rounded text-violet-600 pointer-events-none"
                    />
                    <div>
                      <span className="font-extrabold block text-xs">Co-Host (co_host)</span>
                      <span className="text-[10px] text-slate-500 block">
                        Default: {selectedEmployee.co_host_commission_pct ?? selectedEmployee.coHostCommissionPercentage ?? 1.0}% Omset +{' '}
                        {formatRupiah(selectedEmployee.co_host_commission_per_pcs ?? selectedEmployee.coHostCommissionPerPcs ?? 1000)}/pcs
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. INPUT SESI LIVE SECARA MANUAL */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                <span className="w-5 h-5 rounded-full bg-pink-600 text-white inline-flex items-center justify-center text-[11px]">
                  2
                </span>
                <ShoppingBag className="w-4 h-4 text-pink-600" />
                <span>
                  Input Sesi Live Secara Manual (tgi_livestream_sessions: platform, omset, pcs_sold)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {(['TikTok Shop Live', 'Shopee Live', 'Lainnya'] as LiveStreamPlatform[]).map(
                  (plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setPlatform(plat)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                        platform === plat
                          ? 'bg-pink-600 text-white border-pink-600'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {plat}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Platform Live */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Platform Live <span className="text-rose-500">*</span>
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as LiveStreamPlatform)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                >
                  <option value="TikTok Shop Live">TikTok Shop Live</option>
                  <option value="Shopee Live">Shopee Live</option>
                  <option value="Lainnya">Lainnya</option>
                  <option value="Tokopedia Play">Tokopedia Play</option>
                  <option value="Instagram / FB Live">Instagram / FB Live</option>
                </select>
              </div>

              {/* Nilai Omset Penjualan (IDR) */}
              <div>
                <label className="block text-pink-900 font-extrabold mb-1">
                  Nilai Omset Penjualan (IDR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    placeholder="Contoh: 25000000"
                    value={omsetAmount || ''}
                    onChange={(e) => setOmsetAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full pl-9 pr-3 py-2 bg-pink-50/40 border border-pink-400 rounded-xl font-mono font-extrabold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-500/20"
                  />
                </div>
                <span className="block text-[10px] text-pink-700 font-semibold mt-1">
                  Terbaca: <strong>{formatRupiah(cleanOmset)}</strong>
                </span>
              </div>

              {/* Jumlah Tas yang Terjual (Pcs) */}
              <div>
                <label className="block text-indigo-900 font-extrabold mb-1">
                  Jumlah Tas yang Terjual (Pcs) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Contoh: 150"
                    value={pcsSold || ''}
                    onChange={(e) => setPcsSold(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 pr-12 py-2 bg-indigo-50/40 border border-indigo-400 rounded-xl font-mono font-extrabold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-700 font-extrabold text-[11px]">
                    Pcs
                  </span>
                </div>
                <span className="block text-[10px] text-indigo-700 font-semibold mt-1">
                  Total Produk: <strong>{cleanPcs.toLocaleString('id-ID')} Pcs Tas</strong>
                </span>
              </div>

              {/* Tanggal & Judul Sesi */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Tanggal (session_date) &amp; Notes</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px]"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Catatan / Judul sesi (opsional)"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. PENGATURAN TARIF KOMISI FLEKSIBEL (PER SESI ATAU PER KARYAWAN) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                <span className="w-5 h-5 rounded-full bg-pink-600 text-white inline-flex items-center justify-center text-[11px]">
                  3
                </span>
                <Coins className="w-4 h-4 text-pink-600" />
                <span>
                  Pengaturan Tarif Komisi Fleksibel — Peran Aktif:{' '}
                  <strong className={sessionRole === 'Co-Host' ? 'text-violet-700' : 'text-pink-700'}>
                    {sessionRole === 'Co-Host' ? 'Co-Host (co_host)' : 'Host Utama (host)'}
                  </strong>
                </span>
              </div>

              {/* Preset Cepat Tarif Host & Co-Host */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold">Preset Cepat:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCommissionPctInput(2.5);
                    setCommissionPerPcsInput(2000);
                  }}
                  className="px-2 py-0.5 rounded bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 text-[10px] font-bold cursor-pointer"
                >
                  Host (2.5% + Rp 2.000/pcs)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommissionPctInput(1.0);
                    setCommissionPerPcsInput(1000);
                  }}
                  className="px-2 py-0.5 rounded bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 text-[10px] font-bold cursor-pointer"
                >
                  Co-Host (1% + Rp 1.000/pcs)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommissionPctInput(1.5);
                    setCommissionPerPcsInput(1000);
                  }}
                  className="px-2 py-0.5 rounded bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-[10px] font-bold cursor-pointer"
                >
                  Co-Host (1.5% + Rp 1.000/pcs)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Komisi dari Omset (%) */}
              <div className="p-3 rounded-xl bg-pink-50/40 border border-pink-200">
                <label className="block text-slate-800 font-extrabold mb-1 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-pink-600" />
                  <span>
                    Komisi dari Omset (%) —{' '}
                    <code className="text-[10px] font-mono">
                      {sessionRole === 'Co-Host' ? 'co_host_commission_pct' : 'host_commission_pct'}
                    </code>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="Contoh: 2.5 untuk Host, 1.0 untuk Co-Host"
                    value={commissionPctInput}
                    onChange={(e) =>
                      setCommissionPctInput(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full px-3 pr-9 py-2 bg-white border border-pink-400 rounded-xl font-mono font-extrabold text-pink-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-extrabold text-pink-700">
                    %
                  </span>
                </div>
                <span className="block text-[10px] text-slate-600 mt-1">
                  Hasil Komisi Omset: {formatRupiah(cleanOmset)} × {cleanPct}% ={' '}
                  <strong className="text-pink-700">{formatRupiah(commissionFromOmset)}</strong>
                </span>
              </div>

              {/* Komisi per Pcs Terjual (IDR / Pcs) */}
              <div className="p-3 rounded-xl bg-violet-50/40 border border-violet-200">
                <label className="block text-slate-800 font-extrabold mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-violet-600" />
                  <span>
                    Komisi per Pcs (IDR / Pcs) —{' '}
                    <code className="text-[10px] font-mono">
                      {sessionRole === 'Co-Host'
                        ? 'co_host_commission_per_pcs'
                        : 'host_commission_per_pcs'}
                    </code>
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-violet-700">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    placeholder="Contoh: 2000 untuk Host, 1000 untuk Co-Host"
                    value={commissionPerPcsInput}
                    onChange={(e) =>
                      setCommissionPerPcsInput(
                        Math.max(0, Math.round(Number(e.target.value) || 0))
                      )
                    }
                    className="w-full pl-9 pr-14 py-2 bg-white border border-violet-400 rounded-xl font-mono font-extrabold text-violet-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-violet-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-violet-700 text-[11px]">
                    / Pcs
                  </span>
                </div>
                <span className="block text-[10px] text-slate-600 mt-1">
                  Hasil Komisi Pcs: {cleanPcs.toLocaleString('id-ID')} Pcs ×{' '}
                  {formatRupiah(cleanPerPcs)} ={' '}
                  <strong className="text-violet-700">{formatRupiah(commissionFromPcsSold)}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsEmployeeDefaultRate}
                    onChange={(e) => setSaveAsEmployeeDefaultRate(e.target.checked)}
                    className="rounded text-pink-600"
                  />
                  <span>
                    Simpan tarif ({cleanPct}% + {formatRupiah(cleanPerPcs)}/pcs) sebagai default profil{' '}
                    <strong>{sessionRole}</strong>
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyRateToAllRoleSessions}
                    onChange={(e) => setApplyRateToAllRoleSessions(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Terapkan ke seluruh sesi {sessionRole} periode berjalan</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleApplyRatesOnly}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[11px] inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5 text-pink-600" />
                <span>Simpan Tarif Default Saja</span>
              </button>
            </div>
          </div>

          {/* 4. SINKRONISASI OTOMATIS KE SLIP GAJI (KALKULATOR REAL-TIME) */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-extrabold inline-flex items-center justify-center text-[11px]">
                  4
                </span>
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs sm:text-sm">
                  Kalkulasi Otomatis &amp; Sinkronisasi Real-Time ke Slip Gaji
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                Komponen: &ldquo;Insentif / Komisi Penjualan&rdquo;
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">
                  1. Omset × Komisi % ({cleanPct}%)
                </span>
                <span className="font-mono font-bold text-pink-300 text-sm block mt-0.5">
                  {formatRupiah(commissionFromOmset)}
                </span>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">
                  2. Tas Terjual ({cleanPcs} Pcs) × {formatRupiah(cleanPerPcs)}
                </span>
                <span className="font-mono font-bold text-violet-300 text-sm block mt-0.5">
                  + {formatRupiah(commissionFromPcsSold)}
                </span>
              </div>
              <div className="bg-pink-950/80 p-2.5 rounded-lg border border-pink-500/50">
                <span className="text-[10px] text-pink-200 block font-semibold">
                  Total Komisi Sesi (total_commission)
                </span>
                <span className="font-mono font-extrabold text-white text-base block mt-0.5">
                  = {formatRupiah(totalSessionCommission)}
                </span>
              </div>
              <div className="bg-emerald-950/80 p-2.5 rounded-lg border border-emerald-500/50">
                <span className="text-[10px] text-emerald-200 block font-semibold">
                  Akumulasi di Slip Gaji ({currentPeriod})
                </span>
                <span className="font-mono font-extrabold text-emerald-300 text-base block mt-0.5">
                  {formatRupiah(projectedMonthlyCommission)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-300">
                Rumus: <strong>({formatRupiah(cleanOmset)} × {cleanPct}%)</strong> +{' '}
                <strong>({cleanPcs} Pcs × {formatRupiah(cleanPerPcs)})</strong> ={' '}
                <strong className="text-emerald-300">{formatRupiah(totalSessionCommission)}</strong>
              </span>
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl font-extrabold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0 transition-all ${
                  editingLogId
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingLogId
                    ? `Simpan Perubahan Sesi & Update Slip Gaji`
                    : `Simpan Sesi Live & Masukkan ke Slip Gaji (+${formatRupiah(totalSessionCommission)})`}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* TABEL RIWAYAT SESI LIVE YANG TERCATAT UNTUK KARYAWAN INI */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <h4 className="font-extrabold text-slate-900">
                Daftar Akumulasi Sesi Live (tgi_livestream_sessions) — {selectedEmployee.fullName} ({liveSummary.sessionsCount} Sesi / {uniqueLiveDaysCount} Hari)
              </h4>
              <p className="text-[11px] text-slate-500">
                Total Omset: <strong>{formatRupiah(liveSummary.totalOmset)}</strong> • Total Tas Terjual:{' '}
                <strong>{liveSummary.totalPcs.toLocaleString('id-ID')} Pcs</strong> • Total Masuk Slip Gaji:{' '}
                <strong className="text-pink-700">{formatRupiah(liveSummary.totalCommission)}</strong>
              </p>
            </div>
          </div>

          {liveSummary.filteredLogs.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Belum ada sesi live streaming yang dicatat untuk <strong>{selectedEmployee.fullName}</strong> pada periode{' '}
              <strong>{currentPeriod}</strong>. Gunakan form di atas untuk menginput sesi live secara manual.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal &amp; Platform</th>
                      <th className="py-2.5 px-3">Peran (role_type) &amp; Notes</th>
                      <th className="py-2.5 px-3 text-right">Omset (IDR)</th>
                      <th className="py-2.5 px-3 text-right">Tas Terjual (pcs_sold)</th>
                      <th className="py-2.5 px-3 text-right">Tarif (% &amp; Rp/Pcs)</th>
                      <th className="py-2.5 px-3 text-right">Total Komisi</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveSummary.filteredLogs.map((log) => {
                      const isCoHostRow =
                        log.sessionRole === 'Co-Host' || log.role_type === 'co_host';
                      const rowPct =
                        Number(log.commissionPercentageSnapshot ?? log.commission_pct_used) || 0;
                      const rowPerPcs =
                        Number(log.commissionPerPcsSnapshot ?? log.commission_per_pcs_used) || 0;
                      const rowComm =
                        Number(log.calculatedCommission ?? log.total_commission) || 0;
                      return (
                        <tr
                          key={log.id}
                          className={
                            editingLogId === log.id ? 'bg-amber-50/90' : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 block">
                              {formatIndoDate(log.date || log.session_date || '')}
                            </span>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-bold">
                              {log.platform}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block mr-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                isCoHostRow
                                  ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                  : 'bg-pink-100 text-pink-800 border border-pink-200'
                              }`}
                            >
                              {isCoHostRow ? 'co_host (Co-Host)' : 'host (Host Utama)'}
                            </span>
                            <span className="font-medium text-slate-800">
                              {log.sessionTitle || log.notes}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatRupiah(log.omsetAmount ?? log.omset ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800">
                            {(log.pcsSold ?? log.pcs_sold ?? 0).toLocaleString('id-ID')} Pcs
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-600">
                            {rowPct}% Omset
                            {rowPerPcs > 0 ? ` + ${formatRupiah(rowPerPcs)}/pcs` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-pink-700">
                            +{formatRupiah(rowComm)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditLog(log)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                                title="Edit sesi live ini"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Hapus sesi live ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 font-extrabold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3">
                        Total Akumulasi Periode {currentPeriod} ({liveSummary.sessionsCount} Sesi)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {formatRupiah(liveSummary.totalOmset)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-800">
                        {liveSummary.totalPcs.toLocaleString('id-ID')} Pcs
                      </td>
                      <td className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                        Omset % + Rp/Pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-pink-700 text-sm">
                        +{formatRupiah(liveSummary.totalCommission)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[10px] text-emerald-700">
                        Sinkron Slip Gaji
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Selesai &amp; Tutup Modal
          </button>
        </div>
      </div>
    </div>
  );
};
