import React from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { DataSourceMode, EffectiveDisplayState, TelemetryPayload } from '../shared/gascheckCore';

interface SystemStatusCardProps {
  effectiveState: EffectiveDisplayState;
  statusLabelVi: string;
  descriptionVi: string;
  ageMs: number | null;
  telemetry: TelemetryPayload | null;
  mode: DataSourceMode;
  onReset?: () => void;
}

export const SystemStatusCard: React.FC<SystemStatusCardProps> = ({
  effectiveState,
  statusLabelVi,
  descriptionVi,
  ageMs,
  telemetry,
  mode,
  onReset,
}) => {
  const getVisualConfig = (state: EffectiveDisplayState) => {
    switch (state) {
      case 'NORMAL':
        return {
          containerBg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
          iconWrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60',
          stateText: 'text-emerald-700 dark:text-emerald-400',
          icon: CheckCircle2,
          codeLabel: 'NORMAL · AN TOÀN',
        };
      case 'WARNING':
        return {
          containerBg: 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/70',
          iconWrap: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
          stateText: 'text-amber-700 dark:text-amber-400',
          icon: AlertTriangle,
          codeLabel: 'WARNING · CẢNH BÁO SỚM',
        };
      case 'DANGER':
        return {
          containerBg: 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-800',
          iconWrap: 'bg-red-600 text-white border border-red-700',
          stateText: 'text-red-700 dark:text-red-400',
          icon: AlertOctagon,
          codeLabel: 'DANGER · BÁO ĐỘNG NGUY HIỂM',
        };
      case 'RECOVERY':
        return {
          containerBg: 'bg-amber-50/30 dark:bg-amber-950/15 border-amber-200 dark:border-amber-800/60',
          iconWrap: 'bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
          stateText: 'text-amber-700 dark:text-amber-400',
          icon: RefreshCw,
          codeLabel: 'RECOVERY · CHỜ PHỤC HỒI AN TOÀN',
        };
      case 'FAULT':
        return {
          containerBg: 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800',
          iconWrap: 'bg-rose-700 text-white border border-rose-800',
          stateText: 'text-rose-800 dark:text-rose-300',
          icon: AlertOctagon,
          codeLabel: 'FAULT · LỖI CẢM BIẾN / HỆ THỐNG',
        };
      case 'OFFLINE':
      case 'STALE':
      default:
        return {
          containerBg: 'bg-slate-100/80 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700',
          iconWrap: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700',
          stateText: 'text-slate-700 dark:text-slate-300',
          icon: WifiOff,
          codeLabel: state === 'STALE' ? 'STALE · DỮ LIỆU QUÁ HẠN' : 'OFFLINE · MẤT KẾT NỐI',
        };
    }
  };

  const cfg = getVisualConfig(effectiveState);
  const StateIcon = cfg.icon;

  const formattedLastUpdate = telemetry?.timestamp
    ? new Date(telemetry.timestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Chưa có dữ liệu';

  return (
    <section
      aria-label="Trạng thái tổng thể hệ thống GasCheck"
      className={`rounded-xl border p-5 transition-colors ${cfg.containerBg}`}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${cfg.iconWrap}`}>
            <StateIcon className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>TRẠNG THÁI HỆ THỐNG</span>
              <span aria-hidden="true">·</span>
              <span className={`font-mono font-semibold ${cfg.stateText}`}>{cfg.codeLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                NGUỒN: ESP32 MQTT (LIVE)
              </span>
            </div>

            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {statusLabelVi}
            </h2>

            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              {descriptionVi}
            </p>

            {effectiveState === 'RECOVERY' && onReset && (
              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-amber-600 active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>XÁC NHẬN AN TOÀN & ĐÓNG CỬA SỔ (RESET)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 border-t border-slate-200/70 pt-3 md:border-t-0 md:pt-0 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Mã thiết bị</span>
            </div>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {telemetry?.device_id ?? 'n19-gascheck-01'}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Cập nhật gần nhất</span>
            </div>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {formattedLastUpdate}
              {ageMs !== null && (
                <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({Math.round(ageMs / 1000)}s trước)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
