import React, { useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Moon,
  Network,
  Save,
  ShieldCheck,
  Sliders,
  Sun,
  Volume2,
} from 'lucide-react';
import {
  DataSourceMode,
  MQTT_TOPICS,
  MqttConnectionStatus,
  ThresholdConfig,
} from '../../shared/gascheckCore';
import { soundAndNotificationService } from '../../services/soundAndNotification';

interface SettingsPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  mode: DataSourceMode;
  onSelectMode: (mode: DataSourceMode) => void;
  mqttStatus: MqttConnectionStatus;
  thresholds: ThresholdConfig;
  onSaveThresholds: (next: Partial<ThresholdConfig>) => Promise<{ ok: boolean; error?: string }>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  darkMode,
  onToggleDarkMode,
  mode,
  onSelectMode,
  mqttStatus,
  thresholds,
  onSaveThresholds,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(soundAndNotificationService.isSoundEnabled());
  const [permissionState, setPermissionState] = useState(
    soundAndNotificationService.getPermissionStatus()
  );
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const [warningInput, setWarningInput] = useState(thresholds.warning);
  const [dangerInput, setDangerInput] = useState(thresholds.danger);
  const [thresholdFeedback, setThresholdFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleRequestPermission = async () => {
    const res = await soundAndNotificationService.requestBrowserPermission();
    setPermissionState(res);
    if (res === 'granted') {
      setTestFeedback('Đã cấp quyền Browser Notification thành công.');
    } else if (res === 'denied') {
      setTestFeedback(
        'Trình duyệt đã từ chối quyền thông báo. Hãy bật lại quyền Notification trong cài đặt thanh địa chỉ của trình duyệt.'
      );
    }
  };

  const handleTestNotification = () => {
    const res = soundAndNotificationService.sendTestNotification();
    setTestFeedback(res.messageVi);
  };

  const handleSubmitThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSaveThresholds({
      warning: Number(warningInput),
      danger: Number(dangerInput),
    });
    if (res.ok) {
      setThresholdFeedback({
        ok: true,
        message: 'Đã lưu cấu hình ngưỡng mô phỏng và đồng bộ với bộ kiểm tra an toàn.',
      });
    } else {
      setThresholdFeedback({
        ok: false,
        message: res.error || 'Ngưỡng không hợp lệ.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cài đặt Hệ thống & Cấu hình Kết nối
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Quản lý giao diện, thông báo trình duyệt, kết nối MQTT Broker và ngưỡng cảnh báo GasCheck V2.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 1. Appearance & System Mode */}
        <div className="space-y-6 lg:col-span-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              1. Giao diện & Hiển thị (Appearance)
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Chế độ Giao diện Sáng / Tối
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tối ưu độ tương phản theo phong cách Home Assistant Dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                  <span>{darkMode ? 'Đang dùng Dark Mode' : 'Đang dùng Light Mode'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Đơn vị Đo Cảm biến MQ2
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sử dụng giá trị 12-bit ADC (0–4095) chuẩn ESP32 để đảm bảo tính trung thực kỹ thuật.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-400">
                  12-bit ADC (0–4095)
                </span>
              </div>
            </div>
          </section>

          {/* 2. Browser Notifications & Sound */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                2. Thông báo Trình duyệt & Âm thanh (Notifications)
              </h2>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Âm thanh Cảnh báo trên Giao diện Web
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Phát âm thanh cảnh báo qua Web Audio API khi phát hiện trạng thái DANGER / WARNING.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    soundAndNotificationService.setSoundEnabled(next);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    soundEnabled
                      ? 'bg-cyan-600 text-white'
                      : 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Volume2 className="h-4 w-4" />
                  <span>{soundEnabled ? 'Âm thanh: BẬT' : 'Âm thanh: TẮT'}</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Quyền Browser Notification
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Trạng thái quyền hiện tại:{' '}
                      <strong className="font-mono">{permissionState.toUpperCase()}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRequestPermission}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Cấp quyền Thông báo
                    </button>
                    <button
                      type="button"
                      onClick={handleTestNotification}
                      className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Test Notification
                    </button>
                  </div>
                </div>

                {permissionState === 'denied' && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Trình duyệt đang chặn quyền thông báo. Để nhận cảnh báo khi chuyển sang tab khác, vui lòng mở cài đặt trang web trên thanh địa chỉ trình duyệt và chuyển Notification sang &ldquo;Allow&rdquo;.
                  </p>
                )}

                {testFeedback && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/60 p-2.5 text-xs text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-600" />
                    <span>{testFeedback}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* 3. Connection & 4. Thresholds */}
        <div className="space-y-6 lg:col-span-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                3. Kết nối MQTT Broker & Kiến trúc Node-RED
              </h2>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Chế độ Nguồn Dữ liệu:</span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  LIVE (MQTT TRỰC TIẾP)
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">MQTT Broker Server:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {mqttStatus.brokerUrl}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Trạng thái Kết nối Backend MQTT:</span>
                <span
                  className={`font-mono font-bold ${
                    mqttStatus.connected ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {mqttStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <span className="block font-semibold text-slate-700 dark:text-slate-300">
                  Danh sách MQTT Topics tích hợp Node-RED & ESP32:
                </span>
                <ul className="mt-1.5 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <li>• Telemetry: {MQTT_TOPICS.telemetry}</li>
                  <li>• Event: {MQTT_TOPICS.event}</li>
                  <li>• Status: {MQTT_TOPICS.status}</li>
                  <li>• Command: {MQTT_TOPICS.cmd}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 4. Threshold Configuration */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                4. Cấu hình Ngưỡng Cảnh báo (Thresholds)
              </h2>
            </div>

            <form onSubmit={handleSubmitThresholds} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="input-warning-threshold"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Ngưỡng WARNING (ADC)
                  </label>
                  <input
                    id="input-warning-threshold"
                    type="number"
                    min={300}
                    max={3500}
                    value={warningInput}
                    onChange={(e) => setWarningInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-danger-threshold"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Ngưỡng DANGER (ADC)
                  </label>
                  <input
                    id="input-danger-threshold"
                    type="number"
                    min={500}
                    max={4050}
                    value={dangerInput}
                    onChange={(e) => setDangerInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {thresholdFeedback && (
                <p
                  className={`text-xs font-medium ${
                    thresholdFeedback.ok ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {thresholdFeedback.message}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-600" />
                  Không cho phép vô hiệu hóa quy tắc bảo vệ cục bộ trên ESP32.
                </span>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  Lưu Ngưỡng
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
