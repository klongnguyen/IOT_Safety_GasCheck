import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { AlertEvent, AlertSeverity } from '../shared/gascheckCore';

interface NotificationCenterProps {
  open: boolean;
  alerts: AlertEvent[];
  onClose: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onMarkAllRead: () => void;
  onViewAlertDetail: (alertId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  alerts,
  onClose,
  onAcknowledgeAlert,
  onMarkAllRead,
  onViewAlertDetail,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchMsg = item.message.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        return matchTitle || matchMsg || matchId;
      }
      return true;
    });
  }, [alerts, severityFilter, searchQuery]);

  if (!open) return null;

  const getSeverityStyle = (sev: AlertSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          icon: AlertOctagon,
          text: 'text-red-700 dark:text-red-400',
          iconBg: 'bg-red-100 text-red-600 dark:bg-red-950/80 dark:text-red-400',
          label: 'CRITICAL · NGUY HIỂM',
        };
      case 'FAULT':
        return {
          icon: Wrench,
          text: 'text-rose-700 dark:text-rose-400',
          iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400',
          label: 'FAULT · LỖI PHẦN CỨNG',
        };
      case 'WARNING':
        return {
          icon: AlertTriangle,
          text: 'text-amber-700 dark:text-amber-400',
          iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400',
          label: 'WARNING · CẢNH BÁO',
        };
      default:
        return {
          icon: Bell,
          text: 'text-cyan-700 dark:text-cyan-400',
          iconBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-400',
          label: 'INFO · THÔNG TIN',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-label="Trung tâm thông báo cảnh báo khí gas"
        className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Trung tâm Thông báo & Sự kiện
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vòng đời sự kiện: NEW → ACKNOWLEDGED → RESOLVED
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đánh dấu đã đọc
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trung tâm thông báo"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã sự kiện, tiêu đề, giá trị ADC..."
              aria-label="Tìm kiếm thông báo cảnh báo"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
            {(['ALL', 'CRITICAL', 'WARNING', 'FAULT'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {sev === 'ALL' ? 'Tất cả' : sev}
              </button>
            ))}
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {filteredAlerts.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center text-center">
              <Bell className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Không có thông báo nào khớp bộ lọc
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Các cảnh báo WARNING, CRITICAL và FAULT sẽ xuất hiện tức thì tại đây.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const style = getSeverityStyle(alert.severity);
              const SevIcon = style.icon;

              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    !alert.read
                      ? 'border-cyan-300 bg-cyan-50/20 dark:border-cyan-800 dark:bg-cyan-950/15'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}>
                      <SevIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`font-mono font-bold ${style.text}`}>{style.label}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{alert.isSimulation ? 'SIMULATION' : 'LIVE'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {alert.lifecycle}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums">
                          {new Date(alert.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      <h4 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {alert.title}
                      </h4>

                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {alert.message}
                      </p>

                      {/* Metadata row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono">ID: {alert.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Khi phát hiện:{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                            {alert.gasRawAtTrigger} ADC
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Đỉnh:{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                            {alert.peakGasRaw} ADC
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{alert.read ? 'Đã đọc' : 'Chưa đọc'}</span>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {alert.lifecycle === 'NEW' && 'Chưa xác nhận (NEW)'}
                          {alert.lifecycle === 'ACKNOWLEDGED' &&
                            `Đã xác nhận xem lúc ${
                              alert.acknowledgedAt
                                ? new Date(alert.acknowledgedAt).toLocaleTimeString('vi-VN')
                                : '--'
                            }`}
                          {alert.lifecycle === 'RESOLVED' &&
                            `Đã phục hồi an toàn lúc ${
                              alert.resolvedAt
                                ? new Date(alert.resolvedAt).toLocaleTimeString('vi-VN')
                                : '--'
                            }`}
                        </div>

                        <div className="flex items-center gap-2">
                          {alert.lifecycle === 'NEW' && (
                            <button
                              type="button"
                              onClick={() => onAcknowledgeAlert(alert.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Xác nhận (ACK)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onViewAlertDetail(alert.id);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>Chi tiết</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Safety Note */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Lưu ý an toàn: Nút <strong>Xác nhận (ACK)</strong> chỉ đánh dấu người vận hành đã nhận thông báo, không tắt còi Buzzer hoặc đóng cửa sổ Servo khi khí gas chưa về ngưỡng NORMAL.
        </div>
      </aside>
    </div>
  );
};
