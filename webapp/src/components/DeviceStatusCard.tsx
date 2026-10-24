import React from 'react';
import { Cpu, Lightbulb, Volume2, VolumeX, Wifi, Wind } from 'lucide-react';
import {
  EffectiveDisplayState,
  Esp32HealthStatus,
  TelemetryPayload,
} from '../shared/gascheckCore';

interface DeviceStatusCardsProps {
  telemetry: TelemetryPayload | null;
  esp32Health: Esp32HealthStatus;
  effectiveState: EffectiveDisplayState;
}

export const DeviceStatusCards: React.FC<DeviceStatusCardsProps> = ({
  telemetry,
  esp32Health,
  effectiveState,
}) => {
  const isOffline = effectiveState === 'OFFLINE';
  const activeLed = isOffline ? 'OFF' : telemetry?.led ?? 'OFF';
  const buzzerActive = !isOffline && Boolean(telemetry?.buzzer);
  const windowState = isOffline ? 'UNKNOWN' : telemetry?.window ?? 'UNKNOWN';
  const servoAngle = isOffline ? null : telemetry?.servo_angle ?? (windowState === 'OPEN' ? 90 : 0);

  const formatUptime = (sec: number | null) => {
    if (sec === null || Number.isNaN(sec)) return '--';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}g ${m}p ${s}s`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* 1. LED Status Card */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Cụm Đèn LED Cảnh báo
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                GPIO 3 đèn đơn (Xanh · Vàng · Đỏ)
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
            {activeLed}
          </span>
        </div>

        <div className="my-4 grid grid-cols-3 gap-2.5">
          {/* Green LED */}
          <div
            className={`flex flex-col items-center rounded-lg border p-2.5 transition-all ${
              activeLed === 'GREEN'
                ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-600 dark:bg-emerald-950/50'
                : 'border-slate-200 bg-slate-50/60 opacity-55 dark:border-slate-800 dark:bg-slate-800/30'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full border ${
                activeLed === 'GREEN'
                  ? 'border-emerald-300 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.85)]'
                  : 'border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700'
              }`}
            />
            <span className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              LED Xanh
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {activeLed === 'GREEN' ? 'Đang sáng' : 'Tắt'}
            </span>
          </div>

          {/* Yellow LED */}
          <div
            className={`flex flex-col items-center rounded-lg border p-2.5 transition-all ${
              activeLed === 'YELLOW' || activeLed === 'YELLOW_BLINK'
                ? 'border-amber-400 bg-amber-50/80 dark:border-amber-600 dark:bg-amber-950/50'
                : 'border-slate-200 bg-slate-50/60 opacity-55 dark:border-slate-800 dark:bg-slate-800/30'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full border ${
                activeLed === 'YELLOW' || activeLed === 'YELLOW_BLINK'
                  ? 'border-amber-200 bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.85)]'
                  : 'border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700'
              } ${activeLed === 'YELLOW_BLINK' ? 'animate-pulse' : ''}`}
            />
            <span className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              LED Vàng
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {activeLed === 'YELLOW_BLINK' ? 'Chớp nháy' : activeLed === 'YELLOW' ? 'Đang sáng' : 'Tắt'}
            </span>
          </div>

          {/* Red LED */}
          <div
            className={`flex flex-col items-center rounded-lg border p-2.5 transition-all ${
              activeLed === 'RED' || activeLed === 'RED_BLINK'
                ? 'border-red-400 bg-red-50/80 dark:border-red-600 dark:bg-red-950/50'
                : 'border-slate-200 bg-slate-50/60 opacity-55 dark:border-slate-800 dark:bg-slate-800/30'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full border ${
                activeLed === 'RED' || activeLed === 'RED_BLINK'
                  ? 'border-red-200 bg-red-600 shadow-[0_0_14px_rgba(220,38,38,0.9)]'
                  : 'border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700'
              } ${activeLed === 'RED_BLINK' ? 'animate-pulse' : ''}`}
            />
            <span className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              LED Đỏ
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {activeLed === 'RED_BLINK' ? 'Chớp nháy' : activeLed === 'RED' ? 'Đang sáng' : 'Tắt'}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Trạng thái đồng bộ trực tiếp từ chân GPIO ESP32.
        </div>
      </div>

      {/* 2. Buzzer Card */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                buzzerActive
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {buzzerActive ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                Còi Báo động (Buzzer)
              </h4>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Cảnh báo âm thanh tại chỗ
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs font-bold whitespace-nowrap shrink-0 ${
              buzzerActive
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isOffline ? 'OFFLINE' : buzzerActive ? 'ON · ĐANG HÚ' : 'OFF · IM LẶNG'}
          </span>
        </div>

        <div className="my-4 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Kiểu phát âm thanh:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {!buzzerActive
                ? 'NONE (Tắt)'
                : effectiveState === 'DANGER'
                  ? 'CONTINUOUS (Liên tục khẩn cấp)'
                  : effectiveState === 'FAULT'
                    ? 'FAULT_BEEP (Cảnh báo lỗi)'
                    : 'INTERMITTENT (Bíp ngắt quãng)'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Khóa an toàn phần cứng:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Tự động theo ngưỡng ESP32
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Không thể tắt cưỡng bức từ web khi nồng độ khí đang ở mức DANGER.
        </div>
      </div>

      {/* 3. Window Servo Card */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                windowState === 'OPEN'
                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Wind className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                Cửa sổ Mô phỏng (Servo)
              </h4>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Mở tự động để thoát khí khi DANGER
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs font-bold whitespace-nowrap shrink-0 ${
              windowState === 'OPEN'
                ? 'text-cyan-700 dark:text-cyan-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {windowState === 'OPEN'
              ? 'OPEN · ĐANG MỞ'
              : windowState === 'CLOSED'
                ? 'CLOSED · ĐÓNG'
                : 'UNKNOWN'}
          </span>
        </div>

        {/* Visual SVG Window Illustration */}
        <div className="my-3 flex items-center gap-4 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <svg
            viewBox="0 0 88 64"
            className="h-14 w-20 shrink-0"
            aria-label={`Minh họa cửa sổ đang ${windowState === 'OPEN' ? 'mở' : 'đóng'}`}
          >
            {/* Outer Window Frame */}
            <rect
              x="8"
              y="6"
              width="64"
              height="52"
              rx="4"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-slate-400 dark:text-slate-500"
            />
            {/* Center Mullion */}
            <line
              x1="40"
              y1="6"
              x2="40"
              y2="58"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-300 dark:text-slate-600"
            />
            {/* Window Casement Leaf */}
            {windowState === 'OPEN' ? (
              <>
                <polygon
                  points="40,8 78,18 78,48 40,56"
                  className="fill-cyan-500/25 stroke-cyan-600 dark:stroke-cyan-400"
                  strokeWidth="2.5"
                />
                {/* Airflow arrows */}
                <path
                  d="M 16 24 Q 28 20 36 24 M 16 38 Q 28 34 36 38"
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <rect
                x="42"
                y="9"
                width="27"
                height="46"
                className="fill-slate-200/70 stroke-slate-500 dark:fill-slate-700/60 dark:stroke-slate-400"
                strokeWidth="2"
              />
            )}
          </svg>

          <div className="flex-1 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Góc quay Servo:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {servoAngle !== null ? `${servoAngle}°` : '--'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Cơ cấu chấp hành:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Cửa sổ thông gió
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Servo chỉ mô phỏng mở cửa sổ thông thoáng, không điều khiển van gas.
        </div>
      </div>

      {/* 4. ESP32 Health Card */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                esp32Health.online
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
              }`}
            >
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Bộ điều khiển ESP32
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Node: {telemetry?.device_id ?? 'n19-gascheck-01'}
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs font-bold ${
              esp32Health.online
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {esp32Health.online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="my-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Tín hiệu Wi-Fi:</span>
            <p className="mt-0.5 flex items-center gap-1 font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              <Wifi className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              {esp32Health.online && esp32Health.rssi !== null ? `${esp32Health.rssi} dBm` : '--'}
            </p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Thời gian hoạt động:</span>
            <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {esp32Health.online ? formatUptime(esp32Health.uptimeSec) : '--'}
            </p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Địa chỉ IP:</span>
            <p className="mt-0.5 font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {esp32Health.ipAddress ?? 'Chưa kết nối'}
            </p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Firmware:</span>
            <p className="mt-0.5 font-mono font-medium text-slate-800 dark:text-slate-200">
              {esp32Health.firmwareVersion}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Lần cuối nhận gói tin:{' '}
          <span className="font-mono tabular-nums">
            {esp32Health.lastSeen
              ? new Date(esp32Health.lastSeen).toLocaleTimeString('vi-VN')
              : 'Chưa ghi nhận'}
          </span>
        </div>
      </div>
    </div>
  );
};
