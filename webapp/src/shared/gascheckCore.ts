/**
 * GasCheck V2 Shared Core Types, Telemetry Parser, State Mapping,
 * Alert Lifecycle Engine & Safety Command Validator.
 */

export type GasSystemState = 'NORMAL' | 'WARNING' | 'DANGER' | 'RECOVERY' | 'FAULT';
export type EffectiveDisplayState = GasSystemState | 'OFFLINE' | 'STALE';

export type LedColor = 'GREEN' | 'YELLOW' | 'RED' | 'OFF' | 'YELLOW_BLINK' | 'RED_BLINK';
export type WindowServoState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type DataSourceMode = 'DEMO' | 'LIVE';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'FAULT';
export type AlertLifecycleStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface ThresholdConfig {
  warning: number; // Default 1500 ADC
  danger: number;  // Default 2400 ADC
  hysteresis: number; // Default 120 ADC for safe recovery
  staleTimeoutMs: number; // Default 45000 ms to comfortably support Wokwi simulation
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  warning: 1500,
  danger: 2400,
  hysteresis: 120,
  staleTimeoutMs: 45000,
};

export const MQTT_TOPICS = {
  telemetry: 'gascheck/n19/telemetry',
  event: 'gascheck/n19/event',
  status: 'gascheck/n19/status',
  cmd: 'gascheck/n19/cmd',
} as const;

export interface TelemetryPayload {
  device_id: string;
  gas_raw: number;
  gas_filtered: number;
  state: GasSystemState;
  led: LedColor;
  buzzer: boolean;
  window: WindowServoState;
  servo_angle: number | null;
  sensor_fault: boolean;
  rssi: number | null;
  uptime_sec: number | null;
  timestamp: number;
  is_simulation: boolean;
  seq_id?: number;
}

export interface Esp32HealthStatus {
  online: boolean;
  lastSeen: number | null;
  rssi: number | null;
  uptimeSec: number | null;
  firmwareVersion: string;
  ipAddress: string | null;
  freeHeapBytes: number | null;
}

export interface MqttConnectionStatus {
  connected: boolean;
  brokerUrl: string;
  lastMessageAt: number | null;
  reconnectCount: number;
  subscribedTopics: string[];
  error: string | null;
}

export interface AlertEvent {
  id: string;
  eventCode: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  gasRawAtTrigger: number;
  peakGasRaw: number;
  stateAtTrigger: GasSystemState;
  timestamp: number;
  updatedAt: number;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  resolvedAt: number | null;
  read: boolean;
  lifecycle: AlertLifecycleStatus;
  isSimulation: boolean;
  deviceId: string;
}

export type DeviceCommandType = 'TEST_ALARM' | 'REQUEST_RESET' | 'PING_STATUS' | 'FORCE_CLOSE_WINDOW' | 'SILENCE_BUZZER';

export interface CommandRequest {
  command: DeviceCommandType;
  deviceId: string;
  requestedAt: number;
  reason?: string;
}

export interface CommandValidationResult {
  allowed: boolean;
  status: 'ACK' | 'REJECTED';
  code: string;
  reasonVi: string;
}

export interface TelemetryParseResult {
  valid: boolean;
  data?: TelemetryPayload;
  errors: string[];
  isDuplicate?: boolean;
  isStaleTimestamp?: boolean;
}

/**
 * Computes exponential moving average (EMA) for MQ2 ADC filtering
 */
export function computeFilteredAdc(rawAdc: number, previousFiltered: number | null, alpha = 0.35): number {
  const clamped = Math.max(0, Math.min(4095, Math.round(rawAdc)));
  if (previousFiltered === null || Number.isNaN(previousFiltered)) {
    return clamped;
  }
  return Math.round(alpha * clamped + (1 - alpha) * previousFiltered);
}

/**
 * Maps raw ADC and previous state to GasCheck V2 deterministic hardware state
 */
export function deriveHardwareStateFromAdc(
  gasRaw: number,
  sensorFault: boolean,
  previousState: GasSystemState,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): {
  state: GasSystemState;
  led: LedColor;
  buzzer: boolean;
  window: WindowServoState;
  servoAngle: number;
} {
  if (sensorFault || gasRaw < 0 || gasRaw > 4095 || Number.isNaN(gasRaw)) {
    return {
      state: 'FAULT',
      led: 'RED',
      buzzer: true,
      window: 'OPEN',
      servoAngle: 90,
    };
  }

  if (gasRaw >= thresholds.danger) {
    return {
      state: 'DANGER',
      led: 'RED',
      buzzer: true,
      window: 'OPEN',
      servoAngle: 90,
    };
  }

  // If transitioning down from DANGER, enter RECOVERY until safely below warning - hysteresis
  if (previousState === 'DANGER' || previousState === 'RECOVERY') {
    if (gasRaw >= thresholds.warning) {
      return {
        state: 'RECOVERY',
        led: 'YELLOW',
        buzzer: false,
        window: 'OPEN',
        servoAngle: 90,
      };
    }
    if (gasRaw >= thresholds.warning - thresholds.hysteresis) {
      return {
        state: 'RECOVERY',
        led: 'YELLOW',
        buzzer: false,
        window: 'OPEN',
        servoAngle: 90,
      };
    }
  }

  if (gasRaw >= thresholds.warning) {
    return {
      state: 'WARNING',
      led: 'YELLOW',
      buzzer: true,
      window: 'CLOSED',
      servoAngle: 0,
    };
  }

  return {
    state: 'NORMAL',
    led: 'GREEN',
    buzzer: false,
    window: 'CLOSED',
    servoAngle: 0,
  };
}

/**
 * Determines the effective display state.
 * CRITICAL SAFETY RULE: Offline or stale telemetry must NEVER be displayed as NORMAL.
 */
export function resolveEffectiveSystemState(params: {
  telemetry: TelemetryPayload | null;
  esp32Online: boolean;
  mqttConnected: boolean;
  mode: DataSourceMode;
  now?: number;
  staleTimeoutMs?: number;
}): {
  effectiveState: EffectiveDisplayState;
  isStale: boolean;
  ageMs: number | null;
  statusLabelVi: string;
  descriptionVi: string;
} {
  const now = params.now ?? Date.now();
  const timeout = params.staleTimeoutMs ?? DEFAULT_THRESHOLDS.staleTimeoutMs;

  if (!params.mqttConnected) {
    return {
      effectiveState: 'OFFLINE',
      isStale: true,
      ageMs: params.telemetry ? Math.max(0, now - params.telemetry.timestamp) : null,
      statusLabelVi: 'MẤT KẾT NỐI MQTT',
      descriptionVi: 'Backend hiện mất kết nối tới MQTT Broker. Không coi dữ liệu cuối cùng là an toàn.',
    };
  }

  if (!params.esp32Online || !params.telemetry) {
    return {
      effectiveState: 'OFFLINE',
      isStale: true,
      ageMs: params.telemetry ? Math.max(0, now - params.telemetry.timestamp) : null,
      statusLabelVi: 'ESP32 NGOẠI TUYẾN (OFFLINE)',
      descriptionVi: 'Không nhận được phản hồi từ bộ điều khiển ESP32. Cần kiểm tra nguồn điện và Wi-Fi.',
    };
  }

  const ageMs = Math.max(0, now - params.telemetry.timestamp);
  if (ageMs > timeout) {
    return {
      effectiveState: 'STALE',
      isStale: true,
      ageMs,
      statusLabelVi: 'DỮ LIỆU CŨ (STALE)',
      descriptionVi: `Dữ liệu cảm biến MQ2 đã quá hạn (${Math.round(ageMs / 1000)}s không cập nhật). Không thể khẳng định an toàn.`,
    };
  }

  const stateMap: Record<GasSystemState, { label: string; desc: string }> = {
    NORMAL: {
      label: 'BÌNH THƯỜNG (NORMAL)',
      desc: 'Tín hiệu ADC từ cảm biến MQ2 nằm trong ngưỡng an toàn. Hệ thống giám sát ổn định.',
    },
    WARNING: {
      label: 'CẢNH BÁO SỚM (WARNING)',
      desc: 'Giá trị MQ2 vượt ngưỡng cảnh báo. LED vàng và còi Buzzer đã kích hoạt.',
    },
    DANGER: {
      label: 'NGUY HIỂM – RÒ RỈ KHÍ GAS (DANGER)',
      desc: 'Phát hiện tín hiệu khí gas vượt ngưỡng nguy hiểm! Còi hú liên tục, LED đỏ sáng, Servo đã mở cửa sổ.',
    },
    RECOVERY: {
      label: 'ĐANG CHỜ PHỤC HỒI (RECOVERY)',
      desc: 'Tín hiệu MQ2 đã giảm sau sự cố nguy hiểm. Cửa sổ vẫn mở thông thoáng, chờ xác nhận an toàn.',
    },
    FAULT: {
      label: 'LỖI CẢM BIẾN / HỆ THỐNG (FAULT)',
      desc: 'Cảm biến MQ2 báo lỗi phần cứng hoặc giá trị ADC ngoài dải đo hợp lệ (0–4095).',
    },
  };

  const info = stateMap[params.telemetry.state];
  return {
    effectiveState: params.telemetry.state,
    isStale: false,
    ageMs,
    statusLabelVi: info.label,
    descriptionVi: info.desc,
  };
}

/**
 * Validates and parses raw MQTT JSON payload from gascheck/n19/telemetry
 */
export function parseAndValidateTelemetry(
  rawInput: unknown,
  options: {
    now?: number;
    previousFiltered?: number | null;
    lastSeqId?: number;
    lastTimestamp?: number;
    isSimulation?: boolean;
    maxStaleAgeMs?: number;
  } = {}
): TelemetryParseResult {
  const errors: string[] = [];
  const now = options.now ?? Date.now();
  const maxStaleAgeMs = options.maxStaleAgeMs ?? 60_000;

  let obj: Record<string, unknown>;
  if (typeof rawInput === 'string') {
    try {
      const parsed = JSON.parse(rawInput);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, errors: ['Payload JSON phải là một object hợp lệ.'] };
      }
      obj = parsed as Record<string, unknown>;
    } catch {
      return { valid: false, errors: ['Không thể phân tích cú pháp JSON từ payload MQTT.'] };
    }
  } else if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    obj = rawInput as Record<string, unknown>;
  } else {
    return { valid: false, errors: ['Payload đầu vào trống hoặc sai định dạng.'] };
  }

  const deviceId = typeof obj.device_id === 'string' && obj.device_id.trim().length > 0
    ? obj.device_id.trim()
    : '';
  if (!deviceId) {
    errors.push('Thiếu hoặc sai định dạng trường bắt buộc: device_id.');
  }

  const gasRaw = typeof obj.gas_raw === 'number' && Number.isFinite(obj.gas_raw)
    ? Math.round(obj.gas_raw)
    : NaN;
  if (Number.isNaN(gasRaw) || gasRaw < 0 || gasRaw > 4095) {
    errors.push('Trường gas_raw phải là số nguyên ADC trong khoảng 0–4095.');
  }

  const validStates: GasSystemState[] = ['NORMAL', 'WARNING', 'DANGER', 'RECOVERY', 'FAULT'];
  const state = typeof obj.state === 'string' && validStates.includes(obj.state as GasSystemState)
    ? (obj.state as GasSystemState)
    : null;
  if (!state) {
    errors.push(`Trường state không hợp lệ. Phải thuộc: ${validStates.join(', ')}.`);
  }

  const validLeds: LedColor[] = ['GREEN', 'YELLOW', 'RED', 'OFF', 'YELLOW_BLINK', 'RED_BLINK'];
  const led = typeof obj.led === 'string' && validLeds.includes(obj.led as LedColor)
    ? (obj.led as LedColor)
    : null;
  if (!led) {
    errors.push(`Trường led không hợp lệ. Phải thuộc: ${validLeds.join(', ')}.`);
  }

  const buzzer = typeof obj.buzzer === 'boolean'
    ? obj.buzzer
    : typeof obj.buzzer === 'number'
      ? obj.buzzer > 0
      : null;
  if (buzzer === null) {
    errors.push('Trường buzzer phải có kiểu boolean hoặc số (true/false, 0/1).');
  }

  const validWindows: WindowServoState[] = ['OPEN', 'CLOSED', 'UNKNOWN'];
  const windowState = typeof obj.window === 'string' && validWindows.includes(obj.window as WindowServoState)
    ? (obj.window as WindowServoState)
    : null;
  if (!windowState) {
    errors.push(`Trường window không hợp lệ. Phải thuộc: ${validWindows.join(', ')}.`);
  }

  const sensorFault = typeof obj.sensor_fault === 'boolean' ? obj.sensor_fault : false;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const timestamp = typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp) && obj.timestamp > 0
    ? obj.timestamp
    : now;

  const isStaleTimestamp = now - timestamp > maxStaleAgeMs;

  const seqId = typeof obj.seq_id === 'number' && Number.isFinite(obj.seq_id) ? obj.seq_id : undefined;
  const isDuplicate =
    (seqId !== undefined && options.lastSeqId !== undefined && seqId === options.lastSeqId) ||
    (options.lastTimestamp !== undefined && obj.timestamp === options.lastTimestamp && seqId === options.lastSeqId);

  const gasFiltered = typeof obj.gas_filtered === 'number' && Number.isFinite(obj.gas_filtered)
    ? Math.max(0, Math.min(4095, Math.round(obj.gas_filtered)))
    : computeFilteredAdc(gasRaw, options.previousFiltered ?? null);

  const servoAngle = typeof obj.servo_angle === 'number' && Number.isFinite(obj.servo_angle)
    ? Math.max(0, Math.min(180, Math.round(obj.servo_angle)))
    : windowState === 'OPEN'
      ? 90
      : windowState === 'CLOSED'
        ? 0
        : null;

  const rssi = typeof obj.rssi === 'number' && Number.isFinite(obj.rssi) ? Math.round(obj.rssi) : null;
  const uptimeSec = typeof obj.uptime_sec === 'number' && Number.isFinite(obj.uptime_sec) ? Math.round(obj.uptime_sec) : null;

  return {
    valid: true,
    errors: [],
    isDuplicate,
    isStaleTimestamp,
    data: {
      device_id: deviceId,
      gas_raw: gasRaw,
      gas_filtered: gasFiltered,
      state: state!,
      led: led!,
      buzzer: buzzer!,
      window: windowState!,
      servo_angle: servoAngle,
      sensor_fault: sensorFault,
      rssi,
      uptime_sec: uptimeSec,
      timestamp,
      is_simulation: Boolean(options.isSimulation ?? obj.is_simulation ?? false),
      seq_id: seqId,
    },
  };
}

/**
 * Alert Lifecycle Manager (Pure State Transition Function)
 * Lifecycle: NEW -> ACKNOWLEDGED -> RESOLVED
 * Rules:
 * - Avoid spam: if an active (NEW or ACKNOWLEDGED) alert of the same severity/state exists, update its peakGasRaw instead of creating a duplicate alert.
 * - ACKNOWLEDGED only marks user awareness; it never resolves the alert while danger/warning continues.
 * - RESOLVED occurs only when telemetry returns to NORMAL.
 * - If hazard escalates (e.g. WARNING -> DANGER) or recurs after RESOLVED, create/reopen a CRITICAL alert.
 */
export function processTelemetryForAlerts(
  telemetry: TelemetryPayload,
  existingAlerts: AlertEvent[],
  now: number = Date.now()
): {
  alerts: AlertEvent[];
  newlyCreatedAlert: AlertEvent | null;
  resolvedAlertIds: string[];
} {
  const updatedAlerts = existingAlerts.map((a) => ({ ...a }));
  let newlyCreatedAlert: AlertEvent | null = null;
  const resolvedAlertIds: string[] = [];

  // 1. If telemetry is NORMAL, resolve all active (NEW or ACKNOWLEDGED) alerts
  if (telemetry.state === 'NORMAL' && !telemetry.sensor_fault) {
    for (const alert of updatedAlerts) {
      if (alert.lifecycle !== 'RESOLVED') {
        alert.lifecycle = 'RESOLVED';
        alert.resolvedAt = now;
        alert.updatedAt = now;
        resolvedAlertIds.push(alert.id);
      }
    }
    return { alerts: updatedAlerts, newlyCreatedAlert: null, resolvedAlertIds };
  }

  // 2. Determine target severity for non-normal state
  let targetSeverity: AlertSeverity | null = null;
  let title = '';
  let message = '';
  let eventCode = '';

  if (telemetry.state === 'FAULT' || telemetry.sensor_fault) {
    targetSeverity = 'FAULT';
    eventCode = 'SENSOR_FAULT';
    title = 'Lỗi cảm biến khí gas MQ2 (Sensor Fault)';
    message = `Phát hiện lỗi tín hiệu cảm biến MQ2 trên thiết bị ${telemetry.device_id} (ADC: ${telemetry.gas_raw}). Cần kiểm tra kết nối dây hoặc thay thế cảm biến.`;
  } else if (telemetry.state === 'DANGER') {
    targetSeverity = 'CRITICAL';
    eventCode = 'GAS_DANGER';
    title = 'NGUY HIỂM: Phát hiện dấu hiệu rò rỉ khí gas!';
    message = `Giá trị MQ2 đạt mức nguy hiểm (${telemetry.gas_raw} ADC). Còi báo động Buzzer đã bật, LED đỏ sáng và cửa sổ Servo đã tự động mở.`;
  } else if (telemetry.state === 'WARNING') {
    targetSeverity = 'WARNING';
    eventCode = 'GAS_WARNING';
    title = 'Cảnh báo sớm: Tín hiệu khí gas vượt ngưỡng WARNING';
    message = `Giá trị MQ2 tăng lên ${telemetry.gas_raw} ADC (vượt ngưỡng cảnh báo). Hãy kiểm tra khu vực bếp và van bình gas.`;
  }

  if (!targetSeverity) {
    // e.g. RECOVERY state keeps existing alerts open until NORMAL is reached
    return { alerts: updatedAlerts, newlyCreatedAlert: null, resolvedAlertIds };
  }

  // 3. Check if there is already an unresolved alert with the same eventCode
  const activeSameAlert = updatedAlerts.find(
    (a) => a.lifecycle !== 'RESOLVED' && a.eventCode === eventCode && a.deviceId === telemetry.device_id
  );

  if (activeSameAlert) {
    // Update peak ADC without spamming a new notification
    if (telemetry.gas_raw > activeSameAlert.peakGasRaw) {
      activeSameAlert.peakGasRaw = telemetry.gas_raw;
      activeSameAlert.updatedAt = now;
    }
    return { alerts: updatedAlerts, newlyCreatedAlert: null, resolvedAlertIds };
  }

  // 4. Create new alert event
  const newAlert: AlertEvent = {
    id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
    eventCode,
    severity: targetSeverity,
    title,
    message,
    gasRawAtTrigger: telemetry.gas_raw,
    peakGasRaw: telemetry.gas_raw,
    stateAtTrigger: telemetry.state,
    timestamp: telemetry.timestamp || now,
    updatedAt: now,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    read: false,
    lifecycle: 'NEW',
    isSimulation: telemetry.is_simulation,
    deviceId: telemetry.device_id,
  };

  updatedAlerts.unshift(newAlert);
  newlyCreatedAlert = newAlert;

  return {
    alerts: updatedAlerts,
    newlyCreatedAlert,
    resolvedAlertIds,
  };
}

/**
 * Acknowledge an alert event.
 * CRITICAL RULE: Acknowledging an alert only transitions NEW -> ACKNOWLEDGED.
 * It NEVER resolves an active hazard or turns off hardware safety mechanisms.
 */
export function acknowledgeAlertEvent(
  alert: AlertEvent,
  userLabel = 'Người vận hành',
  now: number = Date.now()
): AlertEvent {
  if (alert.lifecycle === 'RESOLVED') {
    return { ...alert, read: true };
  }
  return {
    ...alert,
    lifecycle: 'ACKNOWLEDGED',
    acknowledgedAt: alert.acknowledgedAt ?? now,
    acknowledgedBy: alert.acknowledgedBy ?? userLabel,
    read: true,
    updatedAt: now,
  };
}

/**
 * Validates safety commands before sending or executing on ESP32.
 * Hardware Safety Rules:
 * - NEVER allow forcing window closed or silencing buzzer during DANGER.
 * - REQUEST_RESET is only accepted when current state is not DANGER/WARNING/FAULT and gas_raw is below warning threshold.
 */
export function validateSafetyCommand(
  cmd: CommandRequest,
  currentTelemetry: TelemetryPayload | null,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): CommandValidationResult {
  if (cmd.command === 'FORCE_CLOSE_WINDOW' || cmd.command === 'SILENCE_BUZZER') {
    return {
      allowed: false,
      status: 'REJECTED',
      code: 'UNSAFE_OVERRIDE_FORBIDDEN',
      reasonVi: 'Từ chối lệnh: Hệ thống bảo vệ phần cứng GasCheck V2 nghiêm cấm đóng cửa sổ hoặc tắt còi cưỡng bức từ giao diện web.',
    };
  }

  if (!currentTelemetry) {
    return {
      allowed: false,
      status: 'REJECTED',
      code: 'DEVICE_OFFLINE',
      reasonVi: 'Từ chối lệnh: Không có dữ liệu kết nối từ ESP32.',
    };
  }

  if (cmd.command === 'REQUEST_RESET') {
    if (
      currentTelemetry.state === 'DANGER' ||
      currentTelemetry.state === 'WARNING' ||
      currentTelemetry.state === 'FAULT' ||
      currentTelemetry.sensor_fault ||
      currentTelemetry.gas_raw >= thresholds.warning
    ) {
      return {
        allowed: false,
        status: 'REJECTED',
        code: 'HAZARD_STILL_PRESENT',
        reasonVi: `ESP32 từ chối REQUEST_RESET: Tín hiệu MQ2 hiện tại (${currentTelemetry.gas_raw} ADC, trạng thái ${currentTelemetry.state}) chưa về ngưỡng an toàn (< ${thresholds.warning} ADC).`,
      };
    }

    return {
      allowed: true,
      status: 'ACK',
      code: 'RESET_ACCEPTED',
      reasonVi: 'ESP32 đã xác nhận (ACK) lệnh REQUEST_RESET: Nồng độ khí đã an toàn, đóng cửa sổ Servo và đưa hệ thống về NORMAL.',
    };
  }

  if (cmd.command === 'TEST_ALARM') {
    if (currentTelemetry.state === 'DANGER') {
      return {
        allowed: false,
        status: 'REJECTED',
        code: 'ALREADY_IN_DANGER',
        reasonVi: 'ESP32 đang trong trạng thái báo động NGUY HIỂM thực tế, không cần chạy kiểm tra còi.',
      };
    }
    return {
      allowed: true,
      status: 'ACK',
      code: 'TEST_ALARM_ACK',
      reasonVi: 'ESP32 đã xác nhận (ACK) lệnh TEST_ALARM: Kích hoạt kiểm tra còi Buzzer và cụm đèn LED trong 3 giây.',
    };
  }

  return {
    allowed: true,
    status: 'ACK',
    code: 'STATUS_SYNC_ACK',
    reasonVi: 'ESP32 đã xác nhận (ACK) đồng bộ trạng thái thiết bị.',
  };
}
