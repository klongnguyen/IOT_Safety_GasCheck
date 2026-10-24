import React, { useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';
import {
  AlertEvent,
  EffectiveDisplayState,
  TelemetryPayload,
  ThresholdConfig,
} from '../../shared/gascheckCore';
import { GasGauge } from '../GasGauge';
import { GasHistoryChart, TimeRangeOption } from '../GasHistoryChart';

interface GasMonitorPageProps {
  telemetry: TelemetryPayload | null;
  effectiveState: EffectiveDisplayState;
  thresholds: ThresholdConfig;
  historyPoints: TelemetryPayload[];
  alerts: AlertEvent[];
  selectedRangeMinutes: TimeRangeOption;
  onSelectRangeMinutes: (range: TimeRangeOption) => void;
}

export const GasMonitorPage: React.FC<GasMonitorPageProps> = ({
  telemetry,
  effectiveState,
  thresholds,
  historyPoints,
  alerts,
  selectedRangeMinutes,
  onSelectRangeMinutes,
}) => {
  const analytics = useMemo(() => {
    const total = historyPoints.length;
    if (total === 0) {
      return {
        warningCount: 0,
        dangerCount: 0,
        faultCount: 0,
        avgNoiseDelta: 0,
        exceedancePoints: [] as TelemetryPayload[],
      };
    }

    let warningCount = 0;
    let dangerCount = 0;
    let faultCount = 0;
    let noiseSum = 0;
    const exceedancePoints: TelemetryPayload[] = [];

    for (const pt of historyPoints) {
      noiseSum += Math.abs(pt.gas_raw - pt.gas_filtered);
      if (pt.sensor_fault || pt.state === 'FAULT') {
        faultCount += 1;
        exceedancePoints.push(pt);
      } else if (pt.gas_raw >= thresholds.danger || pt.state === 'DANGER') {
        dangerCount += 1;
        exceedancePoints.push(pt);
      } else if (pt.gas_raw >= thresholds.warning || pt.state === 'WARNING') {
        warningCount += 1;
        exceedancePoints.push(pt);
      }
    }

    return {
      warningCount,
      dangerCount,
      faultCount,
      avgNoiseDelta: Math.round(noiseSum / total),
      exceedancePoints: exceedancePoints.slice(-15).reverse(),
    };
  }, [historyPoints, thresholds]);

  const alertStats = useMemo(() => {
    const warnEvents = alerts.filter((a) => a.severity === 'WARNING').length;
    const critEvents = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const faultEvents = alerts.filter((a) => a.severity === 'FAULT').length;
    return { warnEvents, critEvents, faultEvents };
  }, [alerts]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Giám sát Chuyên sâu Cảm biến Khí Gas MQ2
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Phân tích tín hiệu 12-bit ADC thô (Raw), bộ lọc EMA (Filtered), ngưỡng bảo vệ và nhật ký vượt ngưỡng.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Trạng thái cảm biến:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            {telemetry?.sensor_fault ? 'SENSOR FAULT' : effectiveState}
          </span>
        </div>
      </div>

      {/* Disconnect or Sensor Fault Diagnostic Banner */}
      {(effectiveState === 'OFFLINE' || effectiveState === 'STALE' || telemetry?.sensor_fault) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            {telemetry?.sensor_fault ? (
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-sm">
                {telemetry?.sensor_fault
                  ? 'Cảnh báo Lỗi Phần cứng Cảm biến MQ2 (Sensor Fault Detected)'
                  : `Cảnh báo Gián đoạn Tín hiệu (${effectiveState})`}
              </p>
              <p className="mt-1">
                {telemetry?.sensor_fault
                  ? 'Giá trị ADC đọc về bị bão hòa (4095) hoặc đứt dây tín hiệu Analog trên chân GPIO ESP32. Hệ thống tự động kích hoạt chế độ FAULT để đảm bảo an toàn.'
                  : 'Hệ thống đang mất kết nối hoặc dữ liệu quá hạn (> 15 giây). Tuyệt đối không coi giá trị ADC cuối cùng là an toàn.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Row: Gauge + Raw vs Filtered Comparison + Threshold Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <GasGauge
            telemetry={telemetry}
            effectiveState={effectiveState}
            thresholds={thresholds}
            historyPoints={historyPoints}
          />
        </div>

        <div className="flex flex-col justify-between gap-4 lg:col-span-7">
          {/* Raw vs Filtered Signal Comparison Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              So sánh Tín hiệu Thô (Raw ADC) & Đã lọc nhiễu (Filtered EMA)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Bộ lọc trung bình trượt hàm mũ (EMA α=0.35) giúp loại bỏ xung nhiễu tức thời trên ADC của ESP32 trước khi kích hoạt cảnh báo.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400">ADC Thô (Raw)</span>
                <p className="mt-1 font-mono text-xl font-bold text-cyan-700 dark:text-cyan-400 tabular-nums">
                  {telemetry?.gas_raw ?? '--'}
                </p>
                <span className="text-[11px] text-slate-400">Dải đo 0–4095</span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400">ADC Đã lọc (EMA)</span>
                <p className="mt-1 font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {telemetry?.gas_filtered ?? '--'}
                </p>
                <span className="text-[11px] text-slate-400">Đã khử nhiễu</span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400">Độ lệch nhiễu</span>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {telemetry
                    ? `±${Math.abs(telemetry.gas_raw - telemetry.gas_filtered)}`
                    : '--'}
                </p>
                <span className="text-[11px] text-slate-400">
                  TB: ±{analytics.avgNoiseDelta} ADC
                </span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400">Điện áp tương đương</span>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {telemetry ? `${((telemetry.gas_raw / 4095) * 3.3).toFixed(2)} V` : '--'}
                </p>
                <span className="text-[11px] text-slate-400">Chuẩn 3.3V ESP32</span>
              </div>
            </div>
          </div>

          {/* Threshold & Event Statistics Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Cấu hình Ngưỡng Trạng thái & Thống kê Vượt ngưỡng
            </h3>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/30 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Ngưỡng NORMAL
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    0 – {thresholds.warning - 1} ADC
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Trễ phục hồi: -{thresholds.hysteresis} ADC
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-amber-200/70 bg-amber-50/30 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                    Ngưỡng WARNING
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {thresholds.warning} – {thresholds.danger - 1} ADC
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {analytics.warningCount} mẫu · {alertStats.warnEvents} sự kiện
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-red-200/70 bg-red-50/30 p-3 dark:border-red-900/50 dark:bg-red-950/20">
                <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <span className="text-xs font-semibold text-red-900 dark:text-red-300">
                    Ngưỡng DANGER
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    &ge; {thresholds.danger} ADC
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {analytics.dangerCount} mẫu · {alertStats.critEvents} sự kiện
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Realtime Chart */}
      <GasHistoryChart
        points={historyPoints}
        thresholds={thresholds}
        selectedRangeMinutes={selectedRangeMinutes}
        onSelectRangeMinutes={onSelectRangeMinutes}
      />

      {/* Threshold Exceedance Analysis Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Phân tích Các Mẫu Tín hiệu Vượt Ngưỡng Gần nhất
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Hiển thị {analytics.exceedancePoints.length} mẫu vượt ngưỡng gần nhất
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">Thời gian</th>
                <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-semibold">ADC Thô</th>
                <th className="px-4 py-2.5 text-right font-semibold">ADC Lọc EMA</th>
                <th className="px-4 py-2.5 text-right font-semibold">Vượt ngưỡng</th>
                <th className="pl-4 py-2.5 font-semibold">Đáp ứng Phần cứng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {analytics.exceedancePoints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Chưa có mẫu dữ liệu nào vượt ngưỡng WARNING ({thresholds.warning} ADC).
                  </td>
                </tr>
              ) : (
                analytics.exceedancePoints.map((pt, idx) => {
                  const delta =
                    pt.gas_raw >= thresholds.danger
                      ? pt.gas_raw - thresholds.danger
                      : pt.gas_raw - thresholds.warning;
                  return (
                    <tr
                      key={`${pt.timestamp}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 pr-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                        {new Date(pt.timestamp).toLocaleTimeString('vi-VN')}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold">
                        <span
                          className={
                            pt.state === 'DANGER' || pt.state === 'FAULT'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {pt.state}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {pt.gas_raw} ADC
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {pt.gas_filtered} ADC
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-600 dark:text-red-400 tabular-nums">
                        +{Math.max(0, delta)} ADC
                      </td>
                      <td className="pl-4 py-2.5 text-slate-600 dark:text-slate-300">
                        LED {pt.led} · Buzzer {pt.buzzer ? 'ON' : 'OFF'} · Cửa sổ {pt.window}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
