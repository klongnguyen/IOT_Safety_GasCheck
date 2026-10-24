import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileBarChart2,
  Flame,
  Gauge,
  LayoutDashboard,
  Menu,
  Moon,
  Radio,
  Settings,
  ShieldAlert,
  Sun,
  X,
} from 'lucide-react';
import {
  AlertEvent,
  DataSourceMode,
  DEFAULT_THRESHOLDS,
  DeviceCommandType,
  TelemetryPayload,
  ThresholdConfig,
} from './shared/gascheckCore';
import {
  DemoPresetScenario,
  FullSystemSnapshot,
} from './backend/mqttAndSimulationEngine';
import { soundAndNotificationService } from './services/soundAndNotification';
import { AlertBanner } from './components/AlertBanner';
import { SystemStatusCard } from './components/SystemStatusCard';
import { GasGauge } from './components/GasGauge';
import { DeviceStatusCards } from './components/DeviceStatusCard';
import { GasHistoryChart, TimeRangeOption } from './components/GasHistoryChart';
import { NotificationCenter } from './components/NotificationCenter';
import { GasMonitorPage } from './components/pages/GasMonitorPage';
import { DevicesPage } from './components/pages/DevicesPage';
import { AlertsPage } from './components/pages/AlertsPage';
import { HistoryReportsPage } from './components/pages/HistoryReportsPage';
import { SettingsPage } from './components/pages/SettingsPage';

export type NavSectionId =
  | 'overview'
  | 'gas-monitor'
  | 'devices'
  | 'alerts'
  | 'history'
  | 'settings';

const NAV_ITEMS: Array<{
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'gas-monitor', label: 'Giám sát khí gas', icon: Gauge },
  { id: 'devices', label: 'Thiết bị', icon: Cpu },
  { id: 'alerts', label: 'Cảnh báo & Thông báo', icon: ShieldAlert },
  { id: 'history', label: 'Lịch sử & Báo cáo', icon: FileBarChart2 },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gascheck_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [snapshot, setSnapshot] = useState<FullSystemSnapshot | null>(null);
  const [historyPoints, setHistoryPoints] = useState<TelemetryPayload[]>([]);
  const [selectedRangeMinutes, setSelectedRangeMinutes] = useState<TimeRangeOption>(60);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('gascheck_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [darkMode]);

  const fetchHistory = useCallback(async (rangeMins: number) => {
    try {
      const res = await fetch(`/api/history?rangeMinutes=${rangeMins}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.points)) {
          setHistoryPoints(data.points);
        }
      }
    } catch {
      // Ignore transient network error
    }
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshot');
      if (res.ok) {
        const data: FullSystemSnapshot = await res.json();
        setSnapshot(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Connect WebSocket for realtime updates
  useEffect(() => {
    fetchSnapshot();
    fetchHistory(selectedRangeMinutes);

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isUnmounted) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'system:snapshot' && msg.payload) {
            const nextSnap = msg.payload as FullSystemSnapshot;
            setSnapshot(nextSnap);
            if (nextSnap.telemetry) {
              setHistoryPoints((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.timestamp === nextSnap.telemetry!.timestamp) {
                  return prev;
                }
                return [...prev.slice(-799), nextSnap.telemetry!];
              });
            }
          } else if (msg.type === 'alert:created' && msg.payload) {
            const alert = msg.payload as AlertEvent;
            soundAndNotificationService.notifyNewAlert(alert);
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchSnapshot, fetchHistory, selectedRangeMinutes]);

  // Refetch history when time range changes
  const handleSelectRangeMinutes = (range: TimeRangeOption) => {
    setSelectedRangeMinutes(range);
    fetchHistory(range);
  };

  // API Handlers
  const handleSelectMode = async (mode: DataSourceMode) => {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      setSnapshot(await res.json());
    }
  };

  const handleTriggerScenario = async (scenario: DemoPresetScenario) => {
    const res = await fetch('/api/demo/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (res.ok) {
      setSnapshot(await res.json());
    }
  };

  const handleChangeCustomAdc = async (adc: number) => {
    const res = await fetch('/api/demo/adc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adc }),
    });
    if (res.ok) {
      setSnapshot(await res.json());
    }
  };

  const handleRunGasLeakScenario = async () => {
    const res = await fetch('/api/demo/run-leak-scenario', {
      method: 'POST',
    });
    if (res.ok) {
      setSnapshot(await res.json());
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgedBy: 'Trực ban Hệ thống' }),
    });
    if (res.ok) {
      setSnapshot(await res.json());
    }
  };

  const handleMarkAllRead = async () => {
    const res = await fetch('/api/alerts/read-all', { method: 'POST' });
    if (res.ok) {
      setSnapshot(await res.json());
    }
  };

  const handleSendCommand = async (command: DeviceCommandType) => {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, deviceId: 'n19-gascheck-01' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.snapshot) setSnapshot(data.snapshot);
    }
  };

  const handleSaveThresholds = async (
    next: Partial<ThresholdConfig>
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    const data = await res.json();
    if (res.ok && data.snapshot) {
      setSnapshot(data.snapshot);
      return { ok: true };
    }
    return { ok: false, error: data.error };
  };

  const effectiveStateInfo = snapshot?.effectiveState ?? {
    effectiveState: 'OFFLINE' as const,
    isStale: true,
    ageMs: null,
    statusLabelVi: 'ĐANG KẾT NỐI...',
    descriptionVi: 'Đang đồng bộ trạng thái từ máy chủ GasCheck...',
  };

  const telemetry = snapshot?.telemetry ?? null;
  const thresholds = snapshot?.thresholds ?? DEFAULT_THRESHOLDS;
  const alerts = snapshot?.alerts ?? [];
  const unreadCount = snapshot?.unreadAlertCount ?? 0;
  const mode = snapshot?.mode ?? 'DEMO';
  const esp32Online = snapshot?.esp32Health.online ?? false;
  const mqttConnected = snapshot?.mqttStatus.connected ?? false;

  const lastUpdateStr = telemetry?.timestamp
    ? new Date(telemetry.timestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        {/* Desktop Left Sidebar (Home Assistant Style) */}
        <aside
          aria-label="Thanh điều hướng chính"
          className={`hidden flex-col justify-between border-r border-slate-200 bg-white transition-all duration-200 lg:flex dark:border-slate-800 dark:bg-slate-900 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          <div>
            {/* Sidebar Brand Header */}
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs">
                  <Flame className="h-5 w-5" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <span className="block truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
                      GasCheck
                    </span>
                    <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      IoT Safety Dashboard V2
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          isActive ? 'text-cyan-600 dark:text-cyan-400' : ''
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      )}
                    </div>

                    {!sidebarCollapsed && item.id === 'alerts' && unreadCount > 0 && (
                      <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Hardware Node Info */}
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            {!sidebarCollapsed ? (
              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Thiết bị:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    n19-gascheck-01
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>WebSocket:</span>
                  <span
                    className={`font-mono font-semibold ${
                      wsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
                    }`}
                  >
                    {wsConnected ? 'REALTIME' : 'RECONNECTING'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Activity
                  className={`h-4 w-4 ${
                    wsConnected ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex bg-slate-950/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="flex h-full w-64 flex-col justify-between bg-white p-4 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white">
                      <Flame className="h-4 w-4" />
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      GasCheck V2
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Đóng menu điều hướng"
                    className="rounded-lg p-1 text-slate-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="mt-4 space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveNav(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </div>
                        {item.id === 'alerts' && unreadCount > 0 && (
                          <span className="font-mono text-xs font-bold text-red-600 tabular-nums">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Right Main Column (Top Navigation + Viewport Content) */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
            {/* Left Zone: Mobile Menu Button + Page Title / Brand */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Mở menu điều hướng"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Tổng quan'}
                </span>
                <span aria-hidden="true" className="hidden text-slate-300 sm:inline dark:text-slate-700">
                  /
                </span>
                <span className="hidden truncate text-xs text-slate-500 sm:inline dark:text-slate-400">
                  ESP32 · MQ2 · LED · Buzzer · Window Servo
                </span>
              </div>
            </div>

            {/* Center Zone: Connection Telemetry Text Status (Unboxed clean metadata) */}
            <div className="hidden xl:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span>
                ESP32:{' '}
                <strong
                  className={`font-mono ${
                    esp32Online
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {esp32Online ? 'ONLINE' : 'OFFLINE'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                MQTT:{' '}
                <strong
                  className={`font-mono ${
                    mqttConnected
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {mqttConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Cập nhật:{' '}
                <strong className="font-mono text-slate-900 dark:text-white tabular-nums">
                  {lastUpdateStr}
                </strong>
              </span>
            </div>

            {/* Right Zone: Mode Switch + Notification Bell + Dark Mode Toggle */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* LIVE MQTT Mode Indicator */}
              <div
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>CHẾ ĐỘ TRỰC TIẾP (LIVE)</span>
              </div>

              {/* Notification Center Bell Button */}
              <button
                type="button"
                onClick={() => setNotificationDrawerOpen(true)}
                aria-label={`Trung tâm thông báo (${unreadCount} chưa đọc)`}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Light / Dark Mode Button */}
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                aria-label={darkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* Main Workspace Content */}
          <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
            {/* Global Real-time Danger Alert Banner & Persistent Critical Toast */}
            <AlertBanner
              effectiveState={effectiveStateInfo.effectiveState}
              telemetry={telemetry}
              alerts={alerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onOpenNotificationCenter={() => setNotificationDrawerOpen(true)}
              onNavigateToAlerts={() => setActiveNav('alerts')}
            />

            {/* View 1: Overview Dashboard */}
            {activeNav === 'overview' && (
              <div className="space-y-6">
                {/* 4.1 System Status Card */}
                <SystemStatusCard
                  effectiveState={effectiveStateInfo.effectiveState}
                  statusLabelVi={effectiveStateInfo.statusLabelVi}
                  descriptionVi={effectiveStateInfo.descriptionVi}
                  ageMs={effectiveStateInfo.ageMs}
                  telemetry={telemetry}
                  mode={mode}
                  onReset={() => handleSendCommand('REQUEST_RESET')}
                />

                {/* 4.2 MQ2 Gas Monitoring Gauge + 4.3 Device Status Cards */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-5">
                    <GasGauge
                      telemetry={telemetry}
                      effectiveState={effectiveStateInfo.effectiveState}
                      thresholds={thresholds}
                      historyPoints={historyPoints}
                    />
                  </div>
                  <div className="xl:col-span-7">
                    <DeviceStatusCards
                      telemetry={telemetry}
                      esp32Health={
                        snapshot?.esp32Health ?? {
                          online: false,
                          lastSeen: null,
                          rssi: null,
                          uptimeSec: null,
                          firmwareVersion: 'v2.4.0-esp32-n19',
                          ipAddress: null,
                          freeHeapBytes: null,
                        }
                      }
                      effectiveState={effectiveStateInfo.effectiveState}
                    />
                  </div>
                </div>

                {/* 4.4 Gas History Chart */}
                <GasHistoryChart
                  points={historyPoints}
                  thresholds={thresholds}
                  selectedRangeMinutes={selectedRangeMinutes}
                  onSelectRangeMinutes={handleSelectRangeMinutes}
                />
              </div>
            )}

            {/* View 2: Detailed Gas Monitoring */}
            {activeNav === 'gas-monitor' && (
              <GasMonitorPage
                telemetry={telemetry}
                effectiveState={effectiveStateInfo.effectiveState}
                thresholds={thresholds}
                historyPoints={historyPoints}
                alerts={alerts}
                selectedRangeMinutes={selectedRangeMinutes}
                onSelectRangeMinutes={handleSelectRangeMinutes}
              />
            )}

            {/* View 3: Devices & Safe Hardware Commands */}
            {activeNav === 'devices' && (
              <DevicesPage
                telemetry={telemetry}
                esp32Health={
                  snapshot?.esp32Health ?? {
                    online: false,
                    lastSeen: null,
                    rssi: null,
                    uptimeSec: null,
                    firmwareVersion: 'v2.4.0-esp32-n19',
                    ipAddress: null,
                    freeHeapBytes: null,
                  }
                }
                effectiveState={effectiveStateInfo.effectiveState}
                thresholds={thresholds}
                lastCommandResult={snapshot?.lastCommandResult ?? null}
                onSendCommand={handleSendCommand}
              />
            )}

            {/* View 4: Alerts & Lifecycle Management */}
            {activeNav === 'alerts' && (
              <AlertsPage
                alerts={alerts}
                selectedAlertId={selectedAlertId}
                onSelectAlertId={setSelectedAlertId}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onMarkAllRead={handleMarkAllRead}
              />
            )}

            {/* View 5: History & CSV Reports */}
            {activeNav === 'history' && (
              <HistoryReportsPage
                historyPoints={historyPoints}
                alerts={alerts}
                stateLogs={snapshot?.stateLogs ?? []}
              />
            )}

            {/* View 6: Settings */}
            {activeNav === 'settings' && (
              <SettingsPage
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode((d) => !d)}
                mode={mode}
                onSelectMode={handleSelectMode}
                mqttStatus={
                  snapshot?.mqttStatus ?? {
                    connected: false,
                    brokerUrl: 'mqtt://broker.hivemq.com:1883',
                    lastMessageAt: null,
                    reconnectCount: 0,
                    subscribedTopics: [],
                    error: null,
                  }
                }
                thresholds={thresholds}
                onSaveThresholds={handleSaveThresholds}
              />
            )}
          </main>
        </div>
      </div>

      {/* Notification Center Drawer */}
      <NotificationCenter
        open={notificationDrawerOpen}
        alerts={alerts}
        onClose={() => setNotificationDrawerOpen(false)}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        onMarkAllRead={handleMarkAllRead}
        onViewAlertDetail={(alertId) => {
          setSelectedAlertId(alertId);
          setActiveNav('alerts');
        }}
      />
    </div>
  );
}
