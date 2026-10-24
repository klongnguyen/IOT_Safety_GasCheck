import React, { useMemo, useState } from 'react';
import { LineChart, Maximize2, Minimize2 } from 'lucide-react';
import { TelemetryPayload, ThresholdConfig } from '../shared/gascheckCore';

export type TimeRangeOption = 15 | 60 | 360 | 1440 | 10080;

interface GasHistoryChartProps {
  points: TelemetryPayload[];
  thresholds: ThresholdConfig;
  selectedRangeMinutes: TimeRangeOption;
  onSelectRangeMinutes: (range: TimeRangeOption) => void;
  loading?: boolean;
}

const RANGE_OPTIONS: Array<{ value: TimeRangeOption; label: string }> = [
  { value: 15, label: '15 phút' },
  { value: 60, label: '1 giờ' },
  { value: 360, label: '6 giờ' },
  { value: 1440, label: '24 giờ' },
  { value: 10080, label: '7 ngày' },
];

export const GasHistoryChart: React.FC<GasHistoryChartProps> = ({
  points,
  thresholds,
  selectedRangeMinutes,
  onSelectRangeMinutes,
  loading = false,
}) => {
  const [showFiltered, setShowFiltered] = useState(true);
  const [autoZoomY, setAutoZoomY] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const filteredPoints = useMemo(() => {
    const cutoff = Date.now() - selectedRangeMinutes * 60 * 1000;
    const inWindow = points.filter((p) => p.timestamp >= cutoff);
    return inWindow.length > 0 ? inWindow : points.slice(-60);
  }, [points, selectedRangeMinutes]);

  const width = 820;
  const height = 285;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yMax = useMemo(() => {
    if (!autoZoomY || filteredPoints.length === 0) return 4095;
    const maxPoint = Math.max(...filteredPoints.map((p) => p.gas_raw), thresholds.danger + 300);
    return Math.min(4095, Math.ceil(maxPoint / 500) * 500);
  }, [autoZoomY, filteredPoints, thresholds.danger]);

  const yToPx = (val: number) => {
    const clamped = Math.max(0, Math.min(yMax, val));
    return padTop + plotH - (clamped / yMax) * plotH;
  };

  const xToPx = (idx: number, total: number) => {
    if (total <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (total - 1)) * plotW;
  };

  const rawPath = useMemo(() => {
    if (filteredPoints.length === 0) return '';
    return filteredPoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(i, filteredPoints.length).toFixed(1)} ${yToPx(pt.gas_raw).toFixed(1)}`)
      .join(' ');
  }, [filteredPoints, yMax]);

  const rawAreaPath = useMemo(() => {
    if (filteredPoints.length < 2) return '';
    const firstX = xToPx(0, filteredPoints.length).toFixed(1);
    const lastX = xToPx(filteredPoints.length - 1, filteredPoints.length).toFixed(1);
    const bottomY = (padTop + plotH).toFixed(1);
    return `${rawPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [rawPath, filteredPoints.length]);

  const filteredLinePath = useMemo(() => {
    if (filteredPoints.length === 0) return '';
    return filteredPoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(i, filteredPoints.length).toFixed(1)} ${yToPx(pt.gas_filtered).toFixed(1)}`)
      .join(' ');
  }, [filteredPoints, yMax]);

  const warnY = yToPx(thresholds.warning);
  const dangerY = yToPx(thresholds.danger);

  const activePoint =
    hoveredIdx !== null && filteredPoints[hoveredIdx]
      ? filteredPoints[hoveredIdx]
      : filteredPoints[filteredPoints.length - 1] ?? null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Biểu đồ Lịch sử Tín hiệu Khí Gas MQ2 (Realtime Telemetry)
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Theo dõi biến thiên ADC theo thời gian thực cùng vạch ngưỡng WARNING ({thresholds.warning} ADC) và DANGER ({thresholds.danger} ADC).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div
            role="group"
            aria-label="Chọn khoảng thời gian biểu đồ"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelectRangeMinutes(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedRangeMinutes === opt.value
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Toggle EMA Filtered Line */}
          <button
            type="button"
            onClick={() => setShowFiltered((prev) => !prev)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showFiltered
                ? 'border-cyan-200 bg-cyan-50/70 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {showFiltered ? 'Đang hiện đường lọc EMA' : 'Hiện đường lọc EMA'}
          </button>

          {/* Toggle Auto-Zoom Y */}
          <button
            type="button"
            onClick={() => setAutoZoomY((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
            title="Chuyển đổi dải trục Y (0-4095 hoặc thu phóng chi tiết)"
          >
            {autoZoomY ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{autoZoomY ? 'Full 4095' : 'Zoom'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Readout Strip */}
      {activePoint && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Thời điểm: </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {new Date(activePoint.timestamp).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">MQ2 Thô (Raw): </span>
              <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400 tabular-nums">
                {activePoint.gas_raw} ADC
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Đã lọc (EMA): </span>
              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {activePoint.gas_filtered} ADC
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Trạng thái: </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {activePoint.state}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-xs bg-cyan-600" />
              ADC Thô
            </span>
            {showFiltered && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-indigo-500" />
                ADC Lọc EMA
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t border-dashed border-amber-500" />
              WARNING ({thresholds.warning})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t border-dashed border-red-500" />
              DANGER ({thresholds.danger})
            </span>
          </div>
        </div>
      )}

      {/* Chart Area */}
      <div className="relative mt-3">
        {loading ? (
          <div className="flex h-[285px] w-full animate-pulse items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500">Đang tải lịch sử cảm biến...</span>
          </div>
        ) : filteredPoints.length === 0 ? (
          <div className="flex h-[285px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Chưa có dữ liệu lịch sử trong khoảng thời gian này
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Hệ thống sẽ tự động vẽ đồ thị ngay khi nhận gói tin từ ESP32 hoặc bộ mô phỏng.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[275px] w-full select-none overflow-visible"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="gasAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0891b2" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Shaded Danger Zone (>= thresholds.danger) */}
            {dangerY > padTop && (
              <rect
                x={padLeft}
                y={padTop}
                width={plotW}
                height={Math.max(0, dangerY - padTop)}
                className="fill-red-500/8 dark:fill-red-500/12"
              />
            )}

            {/* Shaded Warning Zone */}
            {warnY > dangerY && (
              <rect
                x={padLeft}
                y={Math.max(padTop, dangerY)}
                width={plotW}
                height={Math.max(0, warnY - Math.max(padTop, dangerY))}
                className="fill-amber-500/6 dark:fill-amber-500/10"
              />
            )}

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const val = Math.round(step * yMax);
              const y = yToPx(val);
              return (
                <g key={step}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotW}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 font-mono text-[10px]"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Threshold Line: WARNING */}
            {warnY >= padTop && warnY <= padTop + plotH && (
              <g>
                <line
                  x1={padLeft}
                  y1={warnY}
                  x2={padLeft + plotW}
                  y2={warnY}
                  stroke="#d97706"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <text
                  x={padLeft + plotW - 4}
                  y={warnY - 5}
                  textAnchor="end"
                  className="fill-amber-600 font-mono text-[10px] font-semibold dark:fill-amber-400"
                >
                  WARNING ({thresholds.warning})
                </text>
              </g>
            )}

            {/* Threshold Line: DANGER */}
            {dangerY >= padTop && dangerY <= padTop + plotH && (
              <g>
                <line
                  x1={padLeft}
                  y1={dangerY}
                  x2={padLeft + plotW}
                  y2={dangerY}
                  stroke="#dc2626"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <text
                  x={padLeft + plotW - 4}
                  y={dangerY - 5}
                  textAnchor="end"
                  className="fill-red-600 font-mono text-[10px] font-semibold dark:fill-red-400"
                >
                  DANGER ({thresholds.danger})
                </text>
              </g>
            )}

            {/* Area under Raw ADC curve */}
            {rawAreaPath && <path d={rawAreaPath} fill="url(#gasAreaGrad)" />}

            {/* Raw ADC Curve */}
            {rawPath && (
              <path
                d={rawPath}
                fill="none"
                stroke="#0891b2"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Filtered EMA Curve */}
            {showFiltered && filteredLinePath && (
              <path
                d={filteredLinePath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.75"
                strokeDasharray="3 3"
              />
            )}

            {/* X-axis Timestamp Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
              const ptIdx = Math.min(
                filteredPoints.length - 1,
                Math.floor(frac * (filteredPoints.length - 1))
              );
              const pt = filteredPoints[ptIdx];
              if (!pt) return null;
              const x = xToPx(ptIdx, filteredPoints.length);
              return (
                <text
                  key={idx}
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  {new Date(pt.timestamp).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </text>
              );
            })}

            {/* Hover Indicator */}
            {hoveredIdx !== null && filteredPoints[hoveredIdx] && (
              <g>
                <line
                  x1={xToPx(hoveredIdx, filteredPoints.length)}
                  y1={padTop}
                  x2={xToPx(hoveredIdx, filteredPoints.length)}
                  y2={padTop + plotH}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={xToPx(hoveredIdx, filteredPoints.length)}
                  cy={yToPx(filteredPoints[hoveredIdx].gas_raw)}
                  r="4.5"
                  className="fill-cyan-600 stroke-white stroke-2 dark:stroke-slate-900"
                />
              </g>
            )}

            {/* Invisible Interactive Hover Overlay */}
            <rect
              x={padLeft}
              y={padTop}
              width={plotW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const idx = Math.round(relX * (filteredPoints.length - 1));
                setHoveredIdx(idx);
              }}
            />
          </svg>
        )}
      </div>
    </div>
  );
};
