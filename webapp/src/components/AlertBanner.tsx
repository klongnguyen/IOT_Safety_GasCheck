import React from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Eye, ShieldAlert, Volume2 } from 'lucide-react';
import { AlertEvent, EffectiveDisplayState, TelemetryPayload } from '../shared/gascheckCore';

interface AlertBannerProps {
  effectiveState: EffectiveDisplayState;
  telemetry: TelemetryPayload | null;
  alerts: AlertEvent[];
  onAcknowledgeAlert: (alertId: string) => void;
  onOpenNotificationCenter: () => void;
  onNavigateToAlerts: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  effectiveState,
  telemetry,
  alerts,
  onAcknowledgeAlert,
  onOpenNotificationCenter,
  onNavigateToAlerts,
}) => {
  const activeCriticalAlert = alerts.find(
    (a) => a.lifecycle !== 'RESOLVED' && (a.severity === 'CRITICAL' || a.severity === 'FAULT')
  );

  const newCriticalToastAlert = alerts.find(
    (a) => a.lifecycle === 'NEW' && a.severity === 'CRITICAL'
  );

  const isDangerOrFault = effectiveState === 'DANGER' || effectiveState === 'FAULT' || Boolean(activeCriticalAlert);

  if (!isDangerOrFault && !newCriticalToastAlert) {
    return null;
  }

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <>
      {/* Top Danger Alert Banner */}
      {isDangerOrFault && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 rounded-xl border border-red-300 bg-red-50/95 p-4 text-red-950 shadow-sm dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-100"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-xs">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-red-700 dark:text-red-300">
                  <span>CẢNH BÁO AN TOÀN KHẨN CẤP</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {telemetry?.is_simulation ? 'CHẾ ĐỘ MÔ PHỎNG (SIMULATION)' : 'THIẾT BỊ THỰC TẾ (LIVE)'}
                  </span>
                  {activeCriticalAlert && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Trạng thái sự kiện: {activeCriticalAlert.lifecycle === 'NEW' ? 'MỚI (NEW)' : 'ĐÃ XÁC NHẬN XEM (ACKNOWLEDGED)'}
                      </span>
                    </>
                  )}
                </div>

                <h2 className="mt-1 text-base font-bold tracking-tight text-red-950 dark:text-white">
                  {effectiveState === 'FAULT'
                    ? 'LỖI PHẦN CỨNG: Phát hiện lỗi tín hiệu cảm biến MQ2 (Sensor Fault)!'
                    : 'NGUY HIỂM: Phát hiện dấu hiệu rò rỉ khí gas!'}
                </h2>

                <p className="mt-1 text-sm text-red-800 dark:text-red-200">
                  Giá trị MQ2 hiện tại:{' '}
                  <strong className="font-mono font-bold tabular-nums">
                    {telemetry?.gas_raw ?? activeCriticalAlert?.gasRawAtTrigger ?? '--'} ADC
                  </strong>{' '}
                  (Đỉnh ghi nhận:{' '}
                  <strong className="font-mono tabular-nums">
                    {activeCriticalAlert?.peakGasRaw ?? telemetry?.gas_raw ?? '--'} ADC
                  </strong>
                  ) · Phát hiện lúc{' '}
                  <span className="font-mono tabular-nums">
                    {formatTime(activeCriticalAlert?.timestamp ?? telemetry?.timestamp ?? Date.now())}
                  </span>
                  . Còi Buzzer đang bật, LED Đỏ sáng và cửa sổ Servo đã mở 90°.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {activeCriticalAlert && activeCriticalAlert.lifecycle === 'NEW' && (
                <button
                  type="button"
                  onClick={() => onAcknowledgeAlert(activeCriticalAlert.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Xác nhận đã xem (ACK)
                </button>
              )}
              <button
                type="button"
                onClick={onOpenNotificationCenter}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-900 transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-900/50 dark:text-red-100 dark:hover:bg-red-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BellRing className="h-4 w-4" />
                Trung tâm thông báo
              </button>
              <button
                type="button"
                onClick={onNavigateToAlerts}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/80 bg-transparent px-3 py-2 text-xs font-medium text-red-900 transition-colors hover:bg-red-100/70 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Eye className="h-4 w-4" />
                Chi tiết sự kiện
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Floating Critical Toast Alert when a NEW critical gas leak event is unacknowledged */}
      {newCriticalToastAlert && (
        <div
          role="dialog"
          aria-label="Cảnh báo khẩn cấp phát hiện rò rỉ khí gas"
          className="fixed bottom-3 left-3 right-3 z-50 rounded-xl border border-red-400 bg-white p-4 shadow-xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-full sm:max-w-md dark:border-red-700 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                  CẢNH BÁO MỨC CRITICAL · {newCriticalToastAlert.isSimulation ? 'SIMULATION' : 'LIVE'}
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {formatTime(newCriticalToastAlert.timestamp)}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                NGUY HIỂM: Phát hiện dấu hiệu rò rỉ khí gas!
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Cảm biến MQ2 ghi nhận{' '}
                <strong className="font-mono font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  {newCriticalToastAlert.gasRawAtTrigger} ADC
                </strong>
                . Xác nhận đã xem (ACK) chỉ ghi nhận người trực đã biết sự cố, không tự động tắt Buzzer trên ESP32.
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Volume2 className="h-3.5 w-3.5 text-red-500" />
                  Còi cảnh báo đang kích hoạt
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAcknowledgeAlert(newCriticalToastAlert.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Xác nhận đã xem (ACK)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
