import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  AlertEvent,
  AlertLifecycleStatus,
  AlertSeverity,
} from '../../shared/gascheckCore';

interface AlertsPageProps {
  alerts: AlertEvent[];
  selectedAlertId: string | null;
  onSelectAlertId: (id: string | null) => void;
  onAcknowledgeAlert: (id: string) => void;
  onMarkAllRead: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlertId,
  onAcknowledgeAlert,
  onMarkAllRead,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState<'ALL' | AlertLifecycleStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (lifecycleFilter !== 'ALL' && a.lifecycle !== lifecycleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          String(a.gasRawAtTrigger).includes(q)
        );
      }
      return true;
    });
  }, [alerts, severityFilter, lifecycleFilter, searchQuery]);

  const activeDetailAlert = useMemo(() => {
    if (selectedAlertId) {
      const found = alerts.find((a) => a.id === selectedAlertId);
      if (found) return found;
    }
    return filteredAlerts[0] ?? null;
  }, [alerts, selectedAlertId, filteredAlerts]);

  const counts = useMemo(() => {
    return {
      newCount: alerts.filter((a) => a.lifecycle === 'NEW').length,
      ackCount: alerts.filter((a) => a.lifecycle === 'ACKNOWLEDGED').length,
      resolvedCount: alerts.filter((a) => a.lifecycle === 'RESOLVED').length,
    };
  }, [alerts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Cảnh báo & Vòng đời Sự kiện Khẩn cấp
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Theo dõi, xác nhận (ACK) và tra cứu chi tiết toàn bộ sự kiện rò rỉ khí gas theo chuẩn an toàn công nghiệp.
          </p>
        </div>

        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <CheckCheck className="h-4 w-4" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Alert Lifecycle Architecture Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Cơ chế Vòng đời Cảnh báo (Alert Lifecycle State Machine)
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 dark:border-red-900/60 dark:bg-red-950/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-red-700 dark:text-red-400">
                1. NEW (MỚI PHÁT HIỆN)
              </span>
              <span className="font-mono text-sm font-bold text-red-700 dark:text-red-400 tabular-nums">
                {counts.newCount}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              Khi ESP32 phát hiện vượt ngưỡng WARNING/DANGER hoặc lỗi cảm biến. Hiển thị Banner đỏ và Toast khẩn cấp.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                2. ACKNOWLEDGED (ĐÃ XEM)
              </span>
              <span className="font-mono text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {counts.ackCount}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              Người trực xác nhận đã nhìn thấy cảnh báo. <strong>Không tự động tắt Buzzer</strong> hoặc đóng cửa sổ khi khí gas còn nguy hiểm.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                3. RESOLVED (ĐÃ PHỤC HỒI)
              </span>
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {counts.resolvedCount}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              Chỉ chuyển sang RESOLVED khi nồng độ khí thực sự trở về NORMAL trên ESP32 và điều kiện an toàn được khôi phục.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo ID sự kiện, tiêu đề, giá trị ADC..."
            aria-label="Tìm kiếm lịch sử cảnh báo"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-cyan-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['ALL', 'CRITICAL', 'WARNING', 'FAULT'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {sev === 'ALL' ? 'Tất cả mức độ' : sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['ALL', 'NEW', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setLifecycleFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  lifecycleFilter === st
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {st === 'ALL' ? 'Tất cả trạng thái' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split: Event List + Inspector Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {filteredAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <Bell className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Không tìm thấy sự kiện cảnh báo nào
              </p>
            </div>
          ) : (
            filteredAlerts.map((item) => {
              const isSelected = activeDetailAlert?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectAlertId(item.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/20 dark:border-cyan-500 dark:bg-cyan-950/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          item.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                            : item.severity === 'FAULT'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        }`}
                      >
                        {item.severity === 'CRITICAL' ? (
                          <AlertOctagon className="h-4 w-4" />
                        ) : item.severity === 'FAULT' ? (
                          <Wrench className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.severity}
                          </span>
                          <span>·</span>
                          <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                            {item.lifecycle}
                          </span>
                          <span>·</span>
                          <span className="font-mono">{item.isSimulation ? 'SIMULATION' : 'LIVE'}</span>
                        </div>
                        <h4 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                        {item.gasRawAtTrigger} ADC
                      </span>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                        {new Date(item.timestamp).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Event Detail Inspector */}
        <div className="lg:col-span-5">
          {activeDetailAlert ? (
            <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-500">CHI TIẾT SỰ KIỆN</span>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {activeDetailAlert.id}
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-400">
                  {activeDetailAlert.lifecycle}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Tiêu đề sự kiện:</span>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                    {activeDetailAlert.title}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400">Mô tả chi tiết:</span>
                  <p className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">
                    {activeDetailAlert.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div>
                    <span className="text-slate-500">MQ2 lúc phát hiện:</span>
                    <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {activeDetailAlert.gasRawAtTrigger} ADC
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Đỉnh MQ2 ghi nhận:</span>
                    <p className="mt-0.5 font-mono text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                      {activeDetailAlert.peakGasRaw} ADC
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Thời điểm kích hoạt:</span>
                    <p className="mt-0.5 font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                      {new Date(activeDetailAlert.timestamp).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Nguồn dữ liệu:</span>
                    <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      ESP32 LIVE
                    </p>
                  </div>
                </div>

                {/* Lifecycle Timeline */}
                <div className="space-y-2 pt-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Tiến trình Vòng đời (Lifecycle Timeline):
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-red-600">NEW</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className={
                        activeDetailAlert.acknowledgedAt
                          ? 'font-bold text-amber-600'
                          : 'text-slate-400'
                      }
                    >
                      ACKNOWLEDGED
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className={
                        activeDetailAlert.resolvedAt
                          ? 'font-bold text-emerald-600'
                          : 'text-slate-400'
                      }
                    >
                      RESOLVED
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <p>
                      • Xác nhận xem (ACK):{' '}
                      {activeDetailAlert.acknowledgedAt
                        ? `${new Date(activeDetailAlert.acknowledgedAt).toLocaleTimeString('vi-VN')} (${activeDetailAlert.acknowledgedBy})`
                        : 'Chưa xác nhận'}
                    </p>
                    <p>
                      • Phục hồi an toàn (RESOLVED):{' '}
                      {activeDetailAlert.resolvedAt
                        ? new Date(activeDetailAlert.resolvedAt).toLocaleTimeString('vi-VN')
                        : 'Đang chờ nồng độ khí trở về NORMAL'}
                    </p>
                  </div>
                </div>

                {activeDetailAlert.lifecycle === 'NEW' && (
                  <button
                    type="button"
                    onClick={() => onAcknowledgeAlert(activeDetailAlert.id)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Xác nhận đã xem cảnh báo này (ACK)
                  </button>
                )}

                <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-[11px] text-slate-500 dark:border-slate-800">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Xác nhận (ACK) không tắt Buzzer hay đóng cửa sổ trên ESP32. Còi báo động chỉ tắt khi nồng độ khí thực tế hạ xuống mức an toàn.
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
