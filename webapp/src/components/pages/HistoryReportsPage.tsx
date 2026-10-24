import React, { useMemo, useState } from 'react';
import { Calendar, Clock, Download, FileSpreadsheet, History } from 'lucide-react';
import { AlertEvent, TelemetryPayload } from '../../shared/gascheckCore';
import { StateLogEntry } from '../../backend/storageService';

interface HistoryReportsPageProps {
  historyPoints: TelemetryPayload[];
  alerts: AlertEvent[];
  stateLogs: StateLogEntry[];
}

export const HistoryReportsPage: React.FC<HistoryReportsPageProps> = ({
  historyPoints,
  alerts,
  stateLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'STATE_LOGS' | 'TELEMETRY'>('EVENTS');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const now = Date.now();
  const summaryStats = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    const inDay = alerts.filter((a) => now - a.timestamp <= dayMs).length;
    const inWeek = alerts.filter((a) => now - a.timestamp <= weekMs).length;
    const inMonth = alerts.filter((a) => now - a.timestamp <= monthMs).length;

    return { inDay, inWeek, inMonth };
  }, [alerts, now]);

  const filteredEvents = useMemo(() => {
    if (severityFilter === 'ALL') return alerts;
    return alerts.filter((a) => a.severity === severityFilter);
  }, [alerts, severityFilter]);

  const formatDuration = (startMs: number, endMs: number | null) => {
    if (!endMs) return 'Đang diễn ra';
    const diffSec = Math.max(1, Math.round((endMs - startMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins === 0) return `${secs} giây`;
    return `${mins} phút ${secs} giây`;
  };

  const downloadCsv = (filename: string, csvContent: string) => {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTelemetryCsv = () => {
    const headers = [
      'timestamp_iso',
      'device_id',
      'gas_raw_adc',
      'gas_filtered_adc',
      'state',
      'led',
      'buzzer',
      'window_servo',
      'servo_angle',
      'sensor_fault',
      'source_mode',
    ];
    const rows = historyPoints.map((p) =>
      [
        new Date(p.timestamp).toISOString(),
        p.device_id,
        p.gas_raw,
        p.gas_filtered,
        p.state,
        p.led,
        p.buzzer,
        p.window,
        p.servo_angle ?? 0,
        p.sensor_fault,
        p.is_simulation ? 'SIMULATION' : 'LIVE',
      ].join(',')
    );
    downloadCsv('gascheck-telemetry-history.csv', [headers.join(','), ...rows].join('\n'));
  };

  const handleExportEventsCsv = () => {
    const headers = [
      'event_id',
      'severity',
      'lifecycle',
      'title',
      'gas_raw_trigger',
      'peak_gas_raw',
      'started_at_iso',
      'acknowledged_at_iso',
      'resolved_at_iso',
      'duration_sec',
      'source_mode',
    ];
    const rows = alerts.map((a) =>
      [
        a.id,
        a.severity,
        a.lifecycle,
        `"${a.title.replace(/"/g, '""')}"`,
        a.gasRawAtTrigger,
        a.peakGasRaw,
        new Date(a.timestamp).toISOString(),
        a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString() : '',
        a.resolvedAt ? new Date(a.resolvedAt).toISOString() : '',
        a.resolvedAt ? Math.round((a.resolvedAt - a.timestamp) / 1000) : '',
        a.isSimulation ? 'SIMULATION' : 'LIVE',
      ].join(',')
    );
    downloadCsv('gascheck-alert-events.csv', [headers.join(','), ...rows].join('\n'));
  };

  return (
    <div className="space-y-6">
      {/* Header & CSV Export Buttons */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Lịch sử Dữ liệu & Báo cáo Thống kê (History & Logbook)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nhật ký sự kiện rò rỉ khí gas, lịch sử chuyển đổi trạng thái phần cứng và trích xuất CSV phục vụ báo cáo đồ án.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportTelemetryCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Export CSV Telemetry ({historyPoints.length})
          </button>
          <button
            type="button"
            onClick={handleExportEventsCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV Sự kiện ({alerts.length})
          </button>
        </div>
      </div>

      {/* Summary Statistics Strip (Day / Week / Month) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="h-4 w-4 text-cyan-600" />
            <span>Sự kiện trong 24 giờ</span>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summaryStats.inDay}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="h-4 w-4 text-cyan-600" />
            <span>Sự kiện trong 7 ngày</span>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summaryStats.inWeek}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="h-4 w-4 text-cyan-600" />
            <span>Sự kiện trong 30 ngày</span>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summaryStats.inMonth}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <History className="h-4 w-4 text-cyan-600" />
            <span>Tổng bản ghi Telemetry</span>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {historyPoints.length}
          </p>
        </div>
      </div>

      {/* View Selector Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('EVENTS')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'EVENTS'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Lịch sử Sự kiện Cảnh báo ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STATE_LOGS')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'STATE_LOGS'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Nhật ký Chuyển Trạng thái ({stateLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TELEMETRY')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'TELEMETRY'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Bản ghi Telemetry MQ2 Gần nhất
            </button>
          </div>

          {activeTab === 'EVENTS' && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {['ALL', 'CRITICAL', 'WARNING', 'FAULT'].map((sev) => (
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
                  {sev === 'ALL' ? 'Tất cả' : sev}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Alert Events with Duration */}
        {activeTab === 'EVENTS' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-semibold">Mã sự kiện</th>
                  <th className="px-3 py-2.5 font-semibold">Mức độ</th>
                  <th className="px-3 py-2.5 font-semibold">Bắt đầu</th>
                  <th className="px-3 py-2.5 font-semibold">Kết thúc (Resolved)</th>
                  <th className="px-3 py-2.5 font-semibold">Thời gian kéo dài</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Đỉnh MQ2</th>
                  <th className="pl-3 py-2.5 font-semibold">Vòng đời</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {ev.id}
                      <span className="ml-1.5 text-[10px] text-slate-400">
                        ({ev.isSimulation ? 'SIM' : 'LIVE'})
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono font-bold">
                      <span
                        className={
                          ev.severity === 'CRITICAL'
                            ? 'text-red-600 dark:text-red-400'
                            : ev.severity === 'FAULT'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {new Date(ev.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {ev.resolvedAt ? new Date(ev.resolvedAt).toLocaleString('vi-VN') : '--'}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatDuration(ev.timestamp, ev.resolvedAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {ev.peakGasRaw} ADC
                    </td>
                    <td className="pl-3 py-3 font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                      {ev.lifecycle}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: State Transition Logbook */}
        {activeTab === 'STATE_LOGS' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold">Thời điểm</th>
                  <th className="px-4 py-2.5 font-semibold">Chuyển đổi trạng thái</th>
                  <th className="px-4 py-2.5 text-right font-semibold">MQ2 ADC</th>
                  <th className="pl-4 py-2.5 font-semibold">Ghi chú vận hành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {stateLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {log.fromState} → {log.toState}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-cyan-700 dark:text-cyan-400 tabular-nums">
                      {log.gasRaw} ADC
                    </td>
                    <td className="pl-4 py-3 text-slate-600 dark:text-slate-300">{log.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Telemetry Log */}
        {activeTab === 'TELEMETRY' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold">Thời gian</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ADC Thô</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ADC Lọc EMA</th>
                  <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                  <th className="px-4 py-2.5 font-semibold">LED / Buzzer / Cửa sổ</th>
                  <th className="pl-4 py-2.5 font-semibold">Nguồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {historyPoints
                  .slice(-25)
                  .reverse()
                  .map((pt, idx) => (
                    <tr
                      key={`${pt.timestamp}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 pr-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                        {new Date(pt.timestamp).toLocaleTimeString('vi-VN')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {pt.gas_raw}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {pt.gas_filtered}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        {pt.state}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        LED {pt.led} · Buzzer {pt.buzzer ? 'ON' : 'OFF'} · Cửa sổ {pt.window}
                      </td>
                      <td className="pl-4 py-2.5 font-mono text-slate-500">
                        {pt.is_simulation ? 'SIMULATION' : 'LIVE'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
