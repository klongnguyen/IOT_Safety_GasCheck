import React, { useState } from 'react';
import { Gauge, Info } from 'lucide-react';
import { EffectiveDisplayState, TelemetryPayload, ThresholdConfig } from '../shared/gascheckCore';

interface GasGaugeProps {
  telemetry: TelemetryPayload | null;
  effectiveState: EffectiveDisplayState;
  thresholds: ThresholdConfig;
  historyPoints: TelemetryPayload[];
}

export const GasGauge: React.FC<GasGaugeProps> = ({
  telemetry,
  effectiveState,
  thresholds,
  historyPoints,
}) => {
  const [displayMode, setDisplayMode] = useState<'RAW' | 'FILTERED'>('RAW');

  const isOfflineOrStale = effectiveState === 'OFFLINE' || effectiveState === 'STALE';
  const rawVal = telemetry?.gas_raw ?? 0;
  const filteredVal = telemetry?.gas_filtered ?? 0;
  const activeValue = displayMode === 'RAW' ? rawVal : filteredVal;

  const maxAdc = 4095;
  const ratio = Math.max(0, Math.min(1, activeValue / maxAdc));

  // Stats from historyPoints
  const validValues = historyPoints.map((p) => (displayMode === 'RAW' ? p.gas_raw : p.gas_filtered));
  const peakAdc = validValues.length > 0 ? Math.max(...validValues, activeValue) : activeValue;
  const avgAdc =
    validValues.length > 0
      ? Math.round(validValues.reduce((acc, v) => acc + v, 0) / validValues.length)
      : activeValue;

  // Semicircle SVG percentage math (0..100)
  const arcPercent = Math.max(0, Math.min(100, ratio * 100));

  // Determine gauge arc color
  const getGaugeColor = () => {
    if (isOfflineOrStale) return '#94a3b8'; // slate-400
    if (effectiveState === 'FAULT' || activeValue >= thresholds.danger) return '#dc2626'; // red-600
    if (activeValue >= thresholds.warning) return '#d97706'; // amber-600
    return '#0891b2'; // cyan-600
  };

  const warnPercent = Math.round((thresholds.warning / maxAdc) * 100);
  const dangerPercent = Math.round((thresholds.danger / maxAdc) * 100);

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Cảm biến Khí Gas MQ2 (ADC)
          </h3>
        </div>

        {/* Segmented toggle between Raw and Filtered ADC */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setDisplayMode('RAW')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              displayMode === 'RAW'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Tín hiệu Thô (Raw)
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('FILTERED')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              displayMode === 'FILTERED'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Đã lọc nhiễu (EMA)
          </button>
        </div>
      </div>

      {/* Semicircle Gauge SVG */}
      <div className="my-4 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg
            viewBox="0 0 260 150"
            className="w-full max-w-[270px] overflow-visible"
            aria-label={`Đồng hồ đo cảm biến MQ2 hiện tại ${activeValue} trên 4095 ADC`}
          >
            {/* Background Track Arc */}
            <path
              d="M 22 132 A 108 108 0 0 1 238 132"
              pathLength={100}
              fill="none"
              stroke="currentColor"
              strokeWidth="18"
              strokeLinecap="round"
              className="text-slate-100 dark:text-slate-800"
            />

            {/* Value Arc */}
            <path
              d="M 22 132 A 108 108 0 0 1 238 132"
              pathLength={100}
              fill="none"
              stroke={getGaugeColor()}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray="100"
              strokeDashoffset={100 - arcPercent}
              style={{ transition: 'stroke-dashoffset 350ms cubic-bezier(0.16, 1, 0.3, 1), stroke 250ms ease' }}
            />

            {/* Scale labels */}
            <text x="16" y="148" className="fill-slate-400 font-mono text-[11px]">
              0
            </text>
            <text x="225" y="148" className="fill-slate-400 font-mono text-[11px]">
              4095
            </text>
          </svg>

          {/* Center Numeric Readout */}
          <div className="absolute bottom-2 flex flex-col items-center text-center">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {displayMode === 'RAW' ? 'GIÁ TRỊ ADC THÔ' : 'GIÁ TRỊ ĐÃ LỌC EMA'}
            </span>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {isOfflineOrStale && !telemetry ? '--' : activeValue}
              </span>
              <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
                / 4095
              </span>
            </div>
            <span className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {displayMode === 'RAW' ? `Đã lọc: ${filteredVal} ADC` : `Thô: ${rawVal} ADC`}
            </span>
          </div>
        </div>

        {/* Multi-zone Threshold Bar */}
        <div className="mt-3 w-full">
          <div className="flex justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            <span>An toàn (&lt;{thresholds.warning})</span>
            <span className="text-amber-600 dark:text-amber-400">
              WARNING ({thresholds.warning})
            </span>
            <span className="text-red-600 dark:text-red-400">
              DANGER ({thresholds.danger})
            </span>
          </div>
          <div className="relative mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              style={{ width: `${warnPercent}%` }}
              className="h-full bg-emerald-500/85"
              title={`Ngưỡng an toàn: 0 - ${thresholds.warning - 1} ADC`}
            />
            <div
              style={{ width: `${ Math.max(0, dangerPercent - warnPercent) }%` }}
              className="h-full bg-amber-500/85"
              title={`Ngưỡng cảnh báo: ${thresholds.warning} - ${thresholds.danger - 1} ADC`}
            />
            <div
              style={{ width: `${ Math.max(0, 100 - dangerPercent) }%` }}
              className="h-full bg-red-600/90"
              title={`Ngưỡng nguy hiểm: >= ${thresholds.danger} ADC`}
            />
          </div>
        </div>
      </div>

      {/* Metrics Footer */}
      <div className="space-y-3 border-t border-slate-100 pt-3.5 dark:border-slate-800/80">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Trung bình</span>
            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {avgAdc} ADC
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Cao nhất</span>
            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {peakAdc} ADC
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Lỗi cảm biến</span>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                telemetry?.sensor_fault
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {telemetry?.sensor_fault ? 'FAULT' : 'KHÔNG'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <span>
            Hiển thị giá trị 12-bit ADC thô (0–4095) từ ESP32. Không quy đổi sang ppm hoặc %LEL khi cảm biến MQ2 chưa hiệu chuẩn phòng thí nghiệm.
          </span>
        </div>
      </div>
    </div>
  );
};
