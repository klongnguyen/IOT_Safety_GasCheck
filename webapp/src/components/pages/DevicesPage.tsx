import React from 'react';
import {
  CheckCircle2,
  Cpu,
  Gauge,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  Wind,
  XCircle,
} from 'lucide-react';
import {
  CommandValidationResult,
  DeviceCommandType,
  EffectiveDisplayState,
  Esp32HealthStatus,
  TelemetryPayload,
  ThresholdConfig,
} from '../../shared/gascheckCore';
import { DeviceStatusCards } from '../DeviceStatusCard';

interface DevicesPageProps {
  telemetry: TelemetryPayload | null;
  esp32Health: Esp32HealthStatus;
  effectiveState: EffectiveDisplayState;
  thresholds: ThresholdConfig;
  lastCommandResult: (CommandValidationResult & { command: string; timestamp: number }) | null;
  onSendCommand: (command: DeviceCommandType) => void;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  telemetry,
  esp32Health,
  effectiveState,
  thresholds,
  lastCommandResult,
  onSendCommand,
}) => {
  const updatedTimeStr = telemetry?.timestamp
    ? new Date(telemetry.timestamp).toLocaleTimeString('vi-VN')
    : 'Chưa kết nối';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Thực thể Thiết bị (Home Assistant Entities)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cấu hình phần cứng GasCheck V2: ESP32 Controller, Cảm biến MQ2, 3 LED đơn, Còi Buzzer và Servo Cửa sổ.
          </p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Đồng bộ lúc: <span className="font-mono font-semibold tabular-nums">{updatedTimeStr}</span>
        </div>
      </div>

      {/* Hardware Architecture Safety Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Nguyên tắc An toàn Phần cứng GasCheck V2:
            </span>{' '}
            Hệ thống chỉ bao gồm <strong>ESP32, cảm biến MQ2, 3 LED (Xanh/Vàng/Đỏ), Buzzer và Servo mở cửa sổ mô phỏng</strong> (không sử dụng MQ135, quạt thông gió, relay hay van ngắt gas). Giao diện web tuyệt đối không cung cấp nút ép đóng cửa sổ hoặc tắt còi Buzzer khi đang ở trạng thái <strong>DANGER</strong>.
          </div>
        </div>
      </div>

      {/* Live Visual Entity Cards */}
      <DeviceStatusCards
        telemetry={telemetry}
        esp32Health={esp32Health}
        effectiveState={effectiveState}
      />

      {/* Home Assistant Entity Registry Table + Safe Command Dispatch */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Entity Registry List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Danh sách Thực thể Phần cứng (Entity Registry)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Trạng thái thời gian thực được ánh xạ từ gói tin MQTT `gascheck/n19/telemetry`.
          </p>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {/* Entity 1: ESP32 */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    ESP32 Central Controller
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    binary_sensor.n19_esp32_status · {esp32Health.firmwareVersion}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {esp32Health.online ? 'ONLINE' : 'OFFLINE'}
                </span>
                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {esp32Health.rssi ? `${esp32Health.rssi} dBm` : '--'}
                </p>
              </div>
            </div>

            {/* Entity 2: MQ2 Sensor */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    MQ2 Gas Analog Sensor
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    sensor.n19_mq2_adc_raw · GPIO34 (12-bit ADC)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                  {telemetry?.gas_raw ?? '--'} ADC
                </span>
                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                  EMA: {telemetry?.gas_filtered ?? '--'} ADC
                </p>
              </div>
            </div>

            {/* Entity 3: LED Triad */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Lightbulb className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Cụm Đèn báo Trạng thái (Xanh / Vàng / Đỏ)
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    light.n19_status_leds · GPIO25 / GPIO26 / GPIO27
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  LED {telemetry?.led ?? 'OFF'}
                </span>
                <p className="text-[11px] text-slate-500">Cập nhật: {updatedTimeStr}</p>
              </div>
            </div>

            {/* Entity 4: Alarm Buzzer */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Còi báo động (Active Buzzer)
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    binary_sensor.n19_alarm_buzzer · GPIO14
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {telemetry?.buzzer ? 'ON (ACTIVE)' : 'OFF'}
                </span>
                <p className="text-[11px] text-slate-500">Khóa an toàn tự động</p>
              </div>
            </div>

            {/* Entity 5: Window Servo */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Wind className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Cửa sổ Mô phỏng (SG90 Micro Servo)
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    cover.n19_window_servo · GPIO13 PWM
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {telemetry?.window ?? 'UNKNOWN'} ({telemetry?.servo_angle ?? 0}°)
                </span>
                <p className="text-[11px] text-slate-500">Mô phỏng cửa sổ thoát khí</p>
              </div>
            </div>
          </div>
        </div>

        {/* Safe Command Dispatch Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Lệnh Kiểm tra & Yêu cầu Phục hồi (MQTT Command)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Gửi lệnh qua topic <code className="font-mono">gascheck/n19/cmd</code>. Firmware ESP32 tự kiểm tra điều kiện an toàn trước khi phản hồi <strong>ACK</strong> hoặc <strong>REJECTED</strong>.
            </p>

            <div className="mt-4 space-y-3">
              {/* TEST_ALARM */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      1. Kiểm tra Còi & Đèn (TEST_ALARM)
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Kích hoạt kiểm tra còi Buzzer và 3 đèn LED trong 3 giây khi hệ thống đang bình thường.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSendCommand('TEST_ALARM')}
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Gửi TEST_ALARM
                  </button>
                </div>
              </div>

              {/* REQUEST_RESET */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      2. Yêu cầu Đặt lại An toàn (REQUEST_RESET)
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Đóng cửa sổ Servo và đưa hệ thống từ RECOVERY về NORMAL. Sẽ bị <strong>từ chối (REJECT)</strong> nếu MQ2 &ge; {thresholds.warning} ADC.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSendCommand('REQUEST_RESET')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gửi REQUEST_RESET
                  </button>
                </div>
              </div>
            </div>

            {/* Command Feedback Result Box */}
            {lastCommandResult && (
              <div
                role="status"
                className={`mt-4 rounded-xl border p-3.5 text-xs ${
                  lastCommandResult.status === 'ACK'
                    ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-red-300 bg-red-50/80 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {lastCommandResult.status === 'ACK' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 font-mono font-bold">
                      <span>PHẢN HỒI TỪ ESP32: {lastCommandResult.status}</span>
                      <span>·</span>
                      <span>{lastCommandResult.command}</span>
                    </div>
                    <p className="mt-1 leading-relaxed">{lastCommandResult.reasonVi}</p>
                    <p className="mt-1 font-mono text-[11px] opacity-75 tabular-nums">
                      Mã phản hồi: {lastCommandResult.code} · Lúc{' '}
                      {new Date(lastCommandResult.timestamp).toLocaleTimeString('vi-VN')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Các thao tác cưỡng bức đóng cửa sổ hoặc tắt còi Buzzer khi đang rò rỉ khí gas đã bị khóa hoàn toàn để bảo vệ an toàn.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
