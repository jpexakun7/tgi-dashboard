import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Clock,
  Award,
  Sparkles,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  Trash2,
  ExternalLink,
  Shield,
  User,
  Info,
  Send,
  Zap,
} from 'lucide-react';
import { AppNotification, NotificationCategory, Employee } from '../types';
import { formatRupiah } from '../utils/formatters';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  recipientMode: 'admin' | 'employee';
  currentEmployee?: Employee | null;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification?: (id: string) => void;
  onClearAll?: () => void;
  onNavigateAction?: (actionUrl: string, metadata?: any) => void;
  onQuickBroadcastReminder?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  recipientMode,
  currentEmployee,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onNavigateAction,
  onQuickBroadcastReminder,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'performance' | 'payroll' | 'deadline'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter notifications relevant to current viewer
  const relevantNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (recipientMode === 'admin') {
        // Admin sees admin and all-broadcast notifications
        return n.recipientType === 'admin' || n.recipientType === 'all';
      } else {
        // Employee sees notifications addressed to them or all-broadcast
        if (!currentEmployee) return false;
        return (
          (n.recipientType === 'employee' && n.recipientEmployeeId === currentEmployee.id) ||
          n.recipientType === 'all'
        );
      }
    });
  }, [notifications, recipientMode, currentEmployee]);

  const unreadCount = useMemo(() => {
    return relevantNotifications.filter((n) => !n.isRead).length;
  }, [relevantNotifications]);

  // Apply sub-filters and search
  const filteredList = useMemo(() => {
    return relevantNotifications.filter((n) => {
      // Category filter
      if (activeFilter === 'unread' && n.isRead) return false;
      if (activeFilter === 'performance' && n.category !== 'PERFORMANCE_REVIEW' && n.category !== 'PERIOD_OPENED') return false;
      if (activeFilter === 'payroll' && n.category !== 'PAYROLL_BONUS') return false;
      if (activeFilter === 'deadline' && n.category !== 'DEADLINE_REMINDER') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchMsg = n.message.toLowerCase().includes(q);
        const matchPeriod = n.metadata?.period?.toLowerCase().includes(q);
        return matchTitle || matchMsg || matchPeriod;
      }
      return true;
    });
  }, [relevantNotifications, activeFilter, searchQuery]);

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Baru saja';
      if (diffMin < 60) return `${diffMin} menit yang lalu`;
      if (diffHour < 24) return `${diffHour} jam yang lalu`;
      if (diffDay === 1) return 'Kemarin';
      if (diffDay < 7) return `${diffDay} hari yang lalu`;
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'Beberapa saat lalu';
    }
  };

  const getCategoryVisuals = (category: NotificationCategory, priority: string) => {
    switch (category) {
      case 'PERFORMANCE_REVIEW':
        return {
          icon: Award,
          bgColor: 'bg-violet-100 text-violet-700 border-violet-200',
          badgeText: 'Rapor Kinerja & KPI',
          tagBg: 'bg-violet-50 text-violet-700 border-violet-200',
        };
      case 'PAYROLL_BONUS':
        return {
          icon: Sparkles,
          bgColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          badgeText: 'Bonus Masuk Payroll',
          tagBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'DEADLINE_REMINDER':
        return {
          icon: AlertTriangle,
          bgColor: priority === 'urgent' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200',
          badgeText: 'Pengingat Deadline',
          tagBg: priority === 'urgent' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'PERIOD_OPENED':
        return {
          icon: Calendar,
          bgColor: 'bg-blue-100 text-blue-700 border-blue-200',
          badgeText: 'Periode Dibuka',
          tagBg: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      default:
        return {
          icon: Bell,
          bgColor: 'bg-slate-100 text-slate-700 border-slate-200',
          badgeText: 'Notifikasi Sistem',
          tagBg: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl relative shadow-2xs">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">Pusat Notifikasi</h2>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500 text-white shadow-2xs">
                        {unreadCount} baru
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    {recipientMode === 'admin' ? (
                      <>
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Notifikasi Atasan, HRD & Evaluasi KPI</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Portal: {currentEmployee?.fullName || 'Karyawan'}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                title="Tutup Panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-200/70">
              <div className="flex items-center gap-2">
                <button
                  onClick={onMarkAllAsRead}
                  disabled={unreadCount === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tandai Semua Dibaca</span>
                </button>
                {onClearAll && (
                  <button
                    onClick={onClearAll}
                    disabled={relevantNotifications.length === 0}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Bersihkan Semua Pesan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Bersihkan</span>
                  </button>
                )}
              </div>

              {recipientMode === 'admin' && onQuickBroadcastReminder && (
                <button
                  onClick={onQuickBroadcastReminder}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                  title="Kirim Peringatan Deadline Penilaian Kinerja ke Semua Atasan"
                >
                  <Send className="w-3 h-3 text-indigo-600" />
                  <span>Kirim Reminder</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mt-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari notifikasi, periode, atau pesan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Semua ({relevantNotifications.length})
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'unread'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Belum Dibaca
                {unreadCount > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${activeFilter === 'unread' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700 font-bold'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveFilter('performance')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'performance'
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Kinerja & KPI
              </button>
              <button
                onClick={() => setActiveFilter('payroll')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'payroll'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Bonus Payroll
              </button>
              <button
                onClick={() => setActiveFilter('deadline')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'deadline'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Deadline
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredList.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-200">
                  <Bell className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Tidak ada notifikasi</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? `Tidak ditemukan pesan dengan kata kunci "${searchQuery}".`
                    : activeFilter === 'unread'
                    ? 'Seluruh pesan notifikasi sudah Anda baca.'
                    : 'Belum ada notifikasi baru untuk kategori ini.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              filteredList.map((notif) => {
                const visual = getCategoryVisuals(notif.category, notif.priority);
                const IconComponent = visual.icon;

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 relative ${
                      notif.isRead
                        ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        : 'bg-emerald-50/40 border-emerald-200/80 shadow-xs hover:border-emerald-300'
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {!notif.isRead && (
                      <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
                    )}

                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`p-2 rounded-xl shrink-0 border ${visual.bgColor}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${visual.tagBg}`}>
                            {visual.badgeText}
                          </span>
                          {notif.priority === 'urgent' && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-600 text-white animate-pulse">
                              PENTING
                            </span>
                          )}
                          {notif.metadata?.period && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              • Periode: {notif.metadata.period}
                            </span>
                          )}
                        </div>

                        <h4 className={`text-xs font-bold mt-1 leading-snug ${notif.isRead ? 'text-slate-800' : 'text-slate-900'}`}>
                          {notif.title}
                        </h4>

                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {notif.message}
                        </p>

                        {/* Metadata badges if available */}
                        {notif.metadata && (notif.metadata.bonusAmount || notif.metadata.grade || notif.metadata.deadlineDate) && (
                          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                            {notif.metadata.grade && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-md border border-violet-200">
                                <Award className="w-3 h-3" />
                                Grade: {notif.metadata.grade}
                              </span>
                            )}
                            {notif.metadata.bonusAmount !== undefined && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                +{formatRupiah(notif.metadata.bonusAmount)}
                              </span>
                            )}
                            {notif.metadata.deadlineDate && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Tenggat: {notif.metadata.deadlineDate}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Timestamp & Action footer */}
                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100/80 text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getRelativeTime(notif.createdAt)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Action navigation button */}
                            {notif.actionUrl && onNavigateAction && (
                              <button
                                onClick={() => {
                                  if (!notif.isRead) onMarkAsRead(notif.id);
                                  onNavigateAction(notif.actionUrl!, notif.metadata);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                              >
                                <span>{notif.actionLabel || 'Lihat Detail'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {/* Mark as read toggle */}
                            {!notif.isRead ? (
                              <button
                                onClick={() => onMarkAsRead(notif.id)}
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-slate-100 transition-colors"
                                title="Tandai telah dibaca"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Dibaca</span>
                            )}

                            {/* Delete single */}
                            {onDeleteNotification && (
                              <button
                                onClick={() => onDeleteNotification(notif.id)}
                                className="p-1 text-slate-300 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                                title="Hapus notifikasi ini"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer status */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Sistem Notifikasi Real-time Terintegrasi</span>
            </div>
            <span>Audit Trail Tercatat</span>
          </div>
        </div>
      </div>
    </div>
  );
};
