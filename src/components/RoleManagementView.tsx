import React, { useState } from 'react';
import { Shield, Eye, Sliders } from 'lucide-react';
import {
  ActivityActionType,
  ActivityCategory,
  CompanyConfig,
  GoogleAdminUser,
} from '../types';
import { GranularRbacPanel } from './GranularRbacPanel';
import { RoleModuleVisibilityPanel } from './RoleModuleVisibilityPanel';

interface RoleManagementViewProps {
  onLogAudit?: (
    actionType: ActivityActionType,
    category: ActivityCategory,
    description: string,
    meta?: any
  ) => void;
  onSendNotification?: (notif: any) => void;
  adminUser?: GoogleAdminUser | null;
  companyConfig?: CompanyConfig;
  onUpdateConfig?: (newConfig: CompanyConfig) => void;
  onSwitchAdminUserRole?: (roleName: string) => void;
  initialTab?: 'module_visibility' | 'granular_rbac';
}

export function RoleManagementView({
  onLogAudit,
  onSendNotification,
  adminUser,
  companyConfig,
  onUpdateConfig,
  onSwitchAdminUserRole,
  initialTab = 'module_visibility',
}: RoleManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'module_visibility' | 'granular_rbac'>(initialTab);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            Manajemen Role & Hak Akses Terpusat (RBAC)
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Atur apa yang bisa dilihat oleh setiap role tertentu di sidebar serta konfigurasi matriks izin operasi (CRUD & Approval).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sliders className="w-4 h-4" />
            Kontrol Akses Multi-Role
          </span>
        </div>
      </div>

      {/* Subtabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('module_visibility')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'module_visibility'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Visibilitas Menu & Role (Atur Tampilan)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
            Live Simulator
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('granular_rbac')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'granular_rbac'
              ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Matriks Granular RBAC (Operasi CRUD & Approval)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-bold">
            Granular
          </span>
        </button>
      </div>

      {/* Content Rendering */}
      {activeSubTab === 'module_visibility' && companyConfig && onUpdateConfig ? (
        <RoleModuleVisibilityPanel
          companyConfig={companyConfig}
          onUpdateConfig={onUpdateConfig}
          onLogAudit={onLogAudit}
          adminUser={adminUser}
          onSwitchAdminUserRole={onSwitchAdminUserRole}
        />
      ) : activeSubTab === 'module_visibility' ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 text-sm">Konfigurasi perusahaan sedang dimuat...</p>
        </div>
      ) : null}

      {activeSubTab === 'granular_rbac' && (
        <GranularRbacPanel
          onLogAudit={onLogAudit}
          onSendNotification={onSendNotification}
          adminUser={adminUser}
        />
      )}
    </div>
  );
}
