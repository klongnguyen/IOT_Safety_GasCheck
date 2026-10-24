import mqtt, { MqttClient } from 'mqtt';
import {
  AlertEvent,
  CommandRequest,
  CommandValidationResult,
  DataSourceMode,
  Esp32HealthStatus,
  GasSystemState,
  MQTT_TOPICS,
  MqttConnectionStatus,
  TelemetryPayload,
  ThresholdConfig,
  acknowledgeAlertEvent,
  computeFilteredAdc,
  deriveHardwareStateFromAdc,
  parseAndValidateTelemetry,
  processTelemetryForAlerts,
  resolveEffectiveSystemState,
  validateSafetyCommand,
} from '../shared/gascheckCore.ts';
import { StateLogEntry, StorageService } from './storageService.ts';

export type DemoPresetScenario =
  | 'NORMAL'
  | 'WARNING'
  | 'DANGER'
  | 'RECOVERY'
  | 'FAULT'
  | 'ESP32_OFFLINE'
  | 'MQTT_DISCONNECTED'
  | 'STALE_DATA'
  | 'RECOVERY_AFTER_DANGER';

export interface LeakScenarioRunnerState {
  active: boolean;
  stepIndex: number;
  totalSteps: number;
  stepLabelVi: string;
  startedAt: number | null;
}

export interface FullSystemSnapshot {
  mode: DataSourceMode;
  demoScenario: DemoPresetScenario;
  scenarioRunner: LeakScenarioRunnerState;
  telemetry: TelemetryPayload | null;
  effectiveState: ReturnType<typeof resolveEffectiveSystemState>;
  esp32Health: Esp32HealthStatus;
  mqttStatus: MqttConnectionStatus;
  thresholds: ThresholdConfig;
  alerts: AlertEvent[];
  unreadAlertCount: number;
  stateLogs: StateLogEntry[];
  lastCommandResult: (CommandValidationResult & { command: string; timestamp: number }) | null;
}

export class GasCheckEngine {
  private storage: StorageService;
  private mode: DataSourceMode = 'LIVE';
  private demoScenario: DemoPresetScenario = 'NORMAL';
  private demoTargetAdc = 685;
  private demoSensorFault = false;
  private demoEsp32Online = true;
  private demoMqttConnected = true;
  private demoFreezeTimestamp = false;
  private seqCounter = 3000;
  private uptimeCounter = 29200;

  private currentTelemetry: TelemetryPayload | null = null;
  private liveTelemetry: TelemetryPayload | null = null;
  private liveEsp32Online = false;
  private liveLastSeen: number | null = null;

  private mqttClient: MqttClient | null = null;
  private mqttBrokerConnected = false;
  private mqttLastMessageAt: number | null = null;
  private mqttReconnectCount = 0;
  private mqttError: string | null = null;

  private scenarioTimer: ReturnType<typeof setTimeout> | null = null;
  private simulationTickTimer: ReturnType<typeof setInterval> | null = null;
  private scenarioRunner: LeakScenarioRunnerState = {
    active: false,
    stepIndex: 0,
    totalSteps: 5,
    stepLabelVi: 'Chế độ Trực tiếp (LIVE)',
    startedAt: null,
  };

  private lastCommandResult: (CommandValidationResult & { command: string; timestamp: number }) | null = null;
  private listeners: Set<(event: { type: string; payload: unknown }) => void> = new Set();

  constructor(storage: StorageService) {
    this.storage = storage;
    this.mode = 'LIVE';
    this.currentTelemetry = null;
    this.initMqttClient();
  }

  public subscribe(listener: (event: { type: string; payload: unknown }) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(type: string, payload: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener({ type, payload });
      } catch (err) {
        console.error('[GasCheckEngine] Broadcast listener error:', err);
      }
    }
  }

  private initMqttClient(): void {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
    const username = process.env.MQTT_USERNAME || undefined;
    const password = process.env.MQTT_PASSWORD || undefined;

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        username,
        password,
        connectTimeout: 5000,
        reconnectPeriod: 8000,
        clientId: `gascheck-web-backend-${Math.random().toString(16).slice(2, 8)}`,
      });

      this.mqttClient.on('connect', () => {
        this.mqttBrokerConnected = true;
        this.mqttError = null;
        const topics = [MQTT_TOPICS.telemetry, MQTT_TOPICS.event, MQTT_TOPICS.status];
        this.mqttClient?.subscribe(topics, (err) => {
          if (err) {
            this.mqttError = `Lỗi đăng ký topic: ${err.message}`;
          }
        });
        this.broadcastSnapshot();
      });

      this.mqttClient.on('reconnect', () => {
        this.mqttReconnectCount += 1;
      });

      this.mqttClient.on('offline', () => {
        this.mqttBrokerConnected = false;
        if (this.mode === 'LIVE') {
          this.broadcastSnapshot();
        }
      });

      this.mqttClient.on('error', (err) => {
        this.mqttError = err.message;
        this.mqttBrokerConnected = false;
      });

      this.mqttClient.on('message', (topic, messageBuffer) => {
        const rawString = messageBuffer.toString('utf-8');
        this.mqttLastMessageAt = Date.now();

        if (topic === MQTT_TOPICS.telemetry) {
          this.handleIncomingLiveTelemetry(rawString);
        } else if (topic === MQTT_TOPICS.status) {
          this.handleIncomingLiveStatus(rawString);
        }
      });
    } catch (err) {
      this.mqttError = err instanceof Error ? err.message : 'Không thể khởi tạo MQTT client';
    }
  }

  private handleIncomingLiveTelemetry(rawString: string): void {
    const parseRes = parseAndValidateTelemetry(rawString, {
      now: Date.now(),
      previousFiltered: this.liveTelemetry?.gas_filtered ?? null,
      lastSeqId: this.liveTelemetry?.seq_id,
      lastTimestamp: this.liveTelemetry?.timestamp,
      isSimulation: false,
    });

    if (!parseRes.valid || !parseRes.data || parseRes.isDuplicate) {
      return;
    }

    const previousState = this.liveTelemetry?.state ?? 'NORMAL';
    this.liveTelemetry = parseRes.data;
    this.liveEsp32Online = true;
    this.liveLastSeen = Date.now();

    if (this.mode === 'LIVE') {
      this.ingestValidTelemetry(parseRes.data, previousState);
    }
  }

  private handleIncomingLiveStatus(rawString: string): void {
    try {
      const parsed = JSON.parse(rawString);
      if (parsed && typeof parsed.online === 'boolean') {
        this.liveEsp32Online = parsed.online;
        this.liveLastSeen = Date.now();
        if (this.mode === 'LIVE') {
          this.broadcastSnapshot();
        }
      }
    } catch {
      // Ignore malformed status packet
    }
  }

  private startSimulationLoop(): void {
    if (this.simulationTickTimer) {
      clearInterval(this.simulationTickTimer);
    }

    this.simulationTickTimer = setInterval(() => {
      if (this.mode !== 'DEMO') {
        return;
      }

      this.uptimeCounter += 2;

      // If ESP32 is simulated offline, MQTT disconnected, or STALE_DATA is active, do not emit fresh timestamps
      if (!this.demoEsp32Online || !this.demoMqttConnected || this.demoFreezeTimestamp) {
        this.broadcastSnapshot();
        return;
      }

      const prevState = this.currentTelemetry?.state ?? 'NORMAL';
      const thresholds = this.storage.getThresholds();

      // Add subtle realistic sensor noise (+/- 12 ADC) unless fault
      const jitter = this.demoSensorFault ? 0 : Math.round((Math.random() - 0.5) * 18);
      const rawAdc = this.demoSensorFault
        ? 4095
        : Math.max(80, Math.min(4095, this.demoTargetAdc + jitter));

      const filteredAdc = computeFilteredAdc(rawAdc, this.currentTelemetry?.gas_filtered ?? rawAdc);
      const hw = deriveHardwareStateFromAdc(rawAdc, this.demoSensorFault, prevState, thresholds);

      const nextTelemetry: TelemetryPayload = {
        device_id: 'n19-gascheck-01',
        gas_raw: rawAdc,
        gas_filtered: filteredAdc,
        state: hw.state,
        led: hw.led,
        buzzer: hw.buzzer,
        window: hw.window,
        servo_angle: hw.servoAngle,
        sensor_fault: this.demoSensorFault,
        rssi: -57 - Math.floor(Math.random() * 4),
        uptime_sec: this.uptimeCounter,
        timestamp: Date.now(),
        is_simulation: true,
        seq_id: this.seqCounter++,
      };

      this.ingestValidTelemetry(nextTelemetry, prevState);
    }, 2000);
  }

  private ingestValidTelemetry(telemetry: TelemetryPayload, previousState: GasSystemState): void {
    this.currentTelemetry = telemetry;
    this.storage.addTelemetry(telemetry);

    if (telemetry.state !== previousState) {
      const noteMap: Record<GasSystemState, string> = {
        NORMAL: 'Tín hiệu MQ2 ổn định trong ngưỡng an toàn. Đóng cửa sổ Servo, bật LED xanh.',
        WARNING: `Tín hiệu MQ2 (${telemetry.gas_raw} ADC) vượt ngưỡng WARNING. Kích hoạt LED vàng và còi cảnh báo.`,
        DANGER: `NGUY HIỂM! Giá trị MQ2 đạt ${telemetry.gas_raw} ADC. Bật LED đỏ, hú còi Buzzer liên tục, mở cửa sổ Servo 90°.`,
        RECOVERY: `Tín hiệu giảm xuống ${telemetry.gas_raw} ADC sau báo động đỏ. Duy trì mở cửa sổ Servo để thoát khí.`,
        FAULT: 'Phát hiện lỗi phần cứng cảm biến MQ2 (Sensor Fault). Kích hoạt chế độ bảo vệ an toàn.',
      };

      this.storage.addStateLog({
        fromState: previousState,
        toState: telemetry.state,
        gasRaw: telemetry.gas_raw,
        timestamp: telemetry.timestamp,
        isSimulation: telemetry.is_simulation,
        note: noteMap[telemetry.state],
      });
    }

    const alertOutcome = processTelemetryForAlerts(telemetry, this.storage.getAlerts(), Date.now());
    this.storage.setAlerts(alertOutcome.alerts);

    if (alertOutcome.newlyCreatedAlert) {
      this.broadcast('alert:created', alertOutcome.newlyCreatedAlert);
    }
    if (alertOutcome.resolvedAlertIds.length > 0) {
      this.broadcast('alert:resolved', { ids: alertOutcome.resolvedAlertIds });
    }

    this.broadcastSnapshot();
  }

  public setMode(nextMode: DataSourceMode): FullSystemSnapshot {
    this.stopScenarioRunner();
    this.mode = nextMode;
    this.broadcastSnapshot();
    return this.getSnapshot();
  }

  public applyDemoScenario(scenario: DemoPresetScenario, stopRunner = true): FullSystemSnapshot {
    if (stopRunner) {
      this.stopScenarioRunner();
    }
    this.mode = 'DEMO';
    this.demoScenario = scenario;
    const thresholds = this.storage.getThresholds();

    // Reset connection flags by default
    this.demoEsp32Online = true;
    this.demoMqttConnected = true;
    this.demoFreezeTimestamp = false;
    this.demoSensorFault = false;

    const prevState = this.currentTelemetry?.state ?? 'NORMAL';

    switch (scenario) {
      case 'NORMAL':
        this.demoTargetAdc = 680;
        // Force immediate clean transition to NORMAL
        if (this.currentTelemetry) {
          this.currentTelemetry.state = 'NORMAL';
        }
        break;
      case 'WARNING':
        this.demoTargetAdc = Math.min(thresholds.danger - 180, thresholds.warning + 360); // ~1860
        if (this.currentTelemetry) {
          this.currentTelemetry.state = 'NORMAL';
        }
        break;
      case 'DANGER':
        this.demoTargetAdc = Math.min(3900, thresholds.danger + 480); // ~2880
        break;
      case 'RECOVERY':
        this.demoTargetAdc = thresholds.warning - 60; // ~1440 (in hysteresis zone)
        if (this.currentTelemetry) {
          this.currentTelemetry.state = 'DANGER';
        }
        break;
      case 'RECOVERY_AFTER_DANGER':
        this.demoTargetAdc = thresholds.warning - 75; // ~1425
        if (this.currentTelemetry) {
          this.currentTelemetry.state = 'DANGER';
        }
        break;
      case 'FAULT':
        this.demoSensorFault = true;
        this.demoTargetAdc = 4095;
        break;
      case 'ESP32_OFFLINE':
        this.demoEsp32Online = false;
        break;
      case 'MQTT_DISCONNECTED':
        this.demoMqttConnected = false;
        break;
      case 'STALE_DATA':
        this.demoFreezeTimestamp = true;
        if (this.currentTelemetry) {
          // Push timestamp back by 25 seconds so it immediately triggers STALE state
          this.currentTelemetry = {
            ...this.currentTelemetry,
            timestamp: Date.now() - (thresholds.staleTimeoutMs + 10000),
          };
        }
        break;
    }

    // Trigger immediate evaluation if online and not stale
    if (this.demoEsp32Online && this.demoMqttConnected && !this.demoFreezeTimestamp) {
      const hw = deriveHardwareStateFromAdc(
        this.demoTargetAdc,
        this.demoSensorFault,
        scenario === 'NORMAL' ? 'NORMAL' : this.currentTelemetry?.state ?? prevState,
        thresholds
      );
      const filtered = computeFilteredAdc(this.demoTargetAdc, this.currentTelemetry?.gas_filtered ?? null);
      const immediatePayload: TelemetryPayload = {
        device_id: 'n19-gascheck-01',
        gas_raw: this.demoTargetAdc,
        gas_filtered: filtered,
        state: hw.state,
        led: hw.led,
        buzzer: hw.buzzer,
        window: hw.window,
        servo_angle: hw.servoAngle,
        sensor_fault: this.demoSensorFault,
        rssi: -58,
        uptime_sec: this.uptimeCounter,
        timestamp: Date.now(),
        is_simulation: true,
        seq_id: this.seqCounter++,
      };
      this.ingestValidTelemetry(immediatePayload, prevState);
    } else {
      this.broadcastSnapshot();
    }

    return this.getSnapshot();
  }

  public setDemoCustomAdc(adcValue: number): FullSystemSnapshot {
    this.stopScenarioRunner();
    this.mode = 'DEMO';
    this.demoEsp32Online = true;
    this.demoMqttConnected = true;
    this.demoFreezeTimestamp = false;
    this.demoSensorFault = false;

    const clamped = Math.max(0, Math.min(4095, Math.round(adcValue)));
    this.demoTargetAdc = clamped;

    const thresholds = this.storage.getThresholds();
    const prevState = this.currentTelemetry?.state ?? 'NORMAL';
    const hw = deriveHardwareStateFromAdc(clamped, false, prevState, thresholds);
    this.demoScenario = hw.state;

    const filtered = computeFilteredAdc(clamped, this.currentTelemetry?.gas_filtered ?? null);
    const immediatePayload: TelemetryPayload = {
      device_id: 'n19-gascheck-01',
      gas_raw: clamped,
      gas_filtered: filtered,
      state: hw.state,
      led: hw.led,
      buzzer: hw.buzzer,
      window: hw.window,
      servo_angle: hw.servoAngle,
      sensor_fault: false,
      rssi: -58,
      uptime_sec: this.uptimeCounter,
      timestamp: Date.now(),
      is_simulation: true,
      seq_id: this.seqCounter++,
    };

    this.ingestValidTelemetry(immediatePayload, prevState);
    return this.getSnapshot();
  }

  public startGasLeakScenarioRunner(): FullSystemSnapshot {
    this.stopScenarioRunner();
    this.mode = 'DEMO';

    const steps: Array<{ scenario: DemoPresetScenario; label: string; delayMs: number }> = [
      {
        scenario: 'NORMAL',
        label: 'Bước 1/5: Trạng thái BÌNH THƯỜNG (NORMAL – 680 ADC, LED Xanh)',
        delayMs: 3500,
      },
      {
        scenario: 'WARNING',
        label: 'Bước 2/5: Phát hiện nồng độ khí tăng (WARNING – 1860 ADC, LED Vàng, Buzzer cảnh báo)',
        delayMs: 4500,
      },
      {
        scenario: 'DANGER',
        label: 'Bước 3/5: BÁO ĐỘNG ĐỎ (DANGER – 2880 ADC, LED Đỏ, Buzzer hú, Mở cửa sổ Servo 90°)',
        delayMs: 5500,
      },
      {
        scenario: 'RECOVERY',
        label: 'Bước 4/5: Khí gas khuếch tán dần (RECOVERY – 1440 ADC, Cửa sổ vẫn mở thông gió)',
        delayMs: 4500,
      },
      {
        scenario: 'NORMAL',
        label: 'Bước 5/5: Hệ thống phục hồi an toàn (NORMAL – 680 ADC, Đóng cửa sổ, RESOLVED cảnh báo)',
        delayMs: 0,
      },
    ];

    const runStep = (idx: number) => {
      if (idx >= steps.length) {
        this.scenarioRunner = {
          active: false,
          stepIndex: steps.length,
          totalSteps: steps.length,
          stepLabelVi: 'Hoàn tất kịch bản diễn tập rò rỉ khí gas.',
          startedAt: null,
        };
        this.broadcastSnapshot();
        return;
      }

      const current = steps[idx];
      this.scenarioRunner = {
        active: idx < steps.length - 1,
        stepIndex: idx + 1,
        totalSteps: steps.length,
        stepLabelVi: current.label,
        startedAt: this.scenarioRunner.startedAt ?? Date.now(),
      };

      this.applyDemoScenario(current.scenario, false);

      if (current.delayMs > 0) {
        this.scenarioTimer = setTimeout(() => {
          runStep(idx + 1);
        }, current.delayMs);
      }
    };

    this.scenarioRunner.startedAt = Date.now();
    runStep(0);
    return this.getSnapshot();
  }

  public stopScenarioRunner(): void {
    if (this.scenarioTimer) {
      clearTimeout(this.scenarioTimer);
      this.scenarioTimer = null;
    }
    this.scenarioRunner = {
      active: false,
      stepIndex: 0,
      totalSteps: 5,
      stepLabelVi: 'Sẵn sàng chạy kịch bản mô phỏng',
      startedAt: null,
    };
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy = 'Người vận hành'): FullSystemSnapshot {
    const alerts = this.storage.getAlerts();
    const updated = alerts.map((a) => (a.id === alertId ? acknowledgeAlertEvent(a, acknowledgedBy, Date.now()) : a));
    this.storage.setAlerts(updated);
    this.broadcastSnapshot();
    return this.getSnapshot();
  }

  public markAllAlertsRead(): FullSystemSnapshot {
    const alerts = this.storage.getAlerts().map((a) => ({ ...a, read: true }));
    this.storage.setAlerts(alerts);
    this.broadcastSnapshot();
    return this.getSnapshot();
  }

  public executeDeviceCommand(cmdReq: CommandRequest): {
    validation: CommandValidationResult;
    snapshot: FullSystemSnapshot;
  } {
    const activeTelemetry = this.mode === 'DEMO' ? this.currentTelemetry : this.liveTelemetry;
    const thresholds = this.storage.getThresholds();
    const validation = validateSafetyCommand(cmdReq, activeTelemetry, thresholds);

    this.lastCommandResult = {
      ...validation,
      command: cmdReq.command,
      timestamp: Date.now(),
    };

    if (validation.allowed) {
      if (this.mode === 'DEMO') {
        if (cmdReq.command === 'REQUEST_RESET' && this.currentTelemetry) {
          this.demoTargetAdc = 680;
          this.demoSensorFault = false;
          this.demoScenario = 'NORMAL';
          const prev = this.currentTelemetry.state;
          const nextTelemetry: TelemetryPayload = {
            ...this.currentTelemetry,
            gas_raw: 680,
            gas_filtered: 680,
            state: 'NORMAL',
            led: 'GREEN',
            buzzer: false,
            window: 'CLOSED',
            servo_angle: 0,
            sensor_fault: false,
            timestamp: Date.now(),
            seq_id: this.seqCounter++,
          };
          this.ingestValidTelemetry(nextTelemetry, prev);
        }
      } else if (this.mqttClient && this.mqttBrokerConnected) {
        this.mqttClient.publish(
          MQTT_TOPICS.cmd,
          JSON.stringify({
            cmd: cmdReq.command,
            command: cmdReq.command,
            device_id: cmdReq.deviceId,
            requested_at: cmdReq.requestedAt,
          })
        );
      }
    }

    this.broadcastSnapshot();
    return {
      validation,
      snapshot: this.getSnapshot(),
    };
  }

  public updateThresholds(next: Partial<ThresholdConfig>): {
    ok: boolean;
    error?: string;
    snapshot: FullSystemSnapshot;
  } {
    const current = this.storage.getThresholds();
    const warning = next.warning ?? current.warning;
    const danger = next.danger ?? current.danger;
    const hysteresis = next.hysteresis ?? current.hysteresis;
    const staleTimeoutMs = next.staleTimeoutMs ?? current.staleTimeoutMs;

    if (warning < 300 || warning > 3500) {
      return {
        ok: false,
        error: 'Ngưỡng WARNING phải nằm trong khoảng 300 – 3500 ADC.',
        snapshot: this.getSnapshot(),
      };
    }
    if (danger <= warning + 200 || danger > 4050) {
      return {
        ok: false,
        error: 'Ngưỡng DANGER phải lớn hơn ngưỡng WARNING ít nhất 200 ADC và không vượt quá 4050 ADC.',
        snapshot: this.getSnapshot(),
      };
    }

    this.storage.updateThresholds({ warning, danger, hysteresis, staleTimeoutMs });
    this.broadcastSnapshot();
    return {
      ok: true,
      snapshot: this.getSnapshot(),
    };
  }

  public getSnapshot(): FullSystemSnapshot {
    const thresholds = this.storage.getThresholds();
    const isDemo = this.mode === 'DEMO';
    const activeTelemetry = isDemo ? this.currentTelemetry : this.liveTelemetry;
    const esp32Online = isDemo ? this.demoEsp32Online : this.liveEsp32Online;
    const mqttConnected = isDemo ? this.demoMqttConnected : this.mqttBrokerConnected;

    const effectiveState = resolveEffectiveSystemState({
      telemetry: activeTelemetry,
      esp32Online,
      mqttConnected,
      mode: this.mode,
      now: Date.now(),
      staleTimeoutMs: thresholds.staleTimeoutMs,
    });

    const alerts = this.storage.getAlerts();
    const unreadAlertCount = alerts.filter((a) => !a.read).length;

    return {
      mode: this.mode,
      demoScenario: this.demoScenario,
      scenarioRunner: this.scenarioRunner,
      telemetry: activeTelemetry,
      effectiveState,
      esp32Health: {
        online: esp32Online,
        lastSeen: activeTelemetry?.timestamp ?? this.liveLastSeen,
        rssi: activeTelemetry?.rssi ?? null,
        uptimeSec: activeTelemetry?.uptime_sec ?? null,
        firmwareVersion: 'v2.4.0-esp32-n19',
        ipAddress: esp32Online ? '192.168.1.119' : null,
        freeHeapBytes: esp32Online ? 214580 : null,
      },
      mqttStatus: {
        connected: mqttConnected,
        brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
        lastMessageAt: isDemo ? activeTelemetry?.timestamp ?? null : this.mqttLastMessageAt,
        reconnectCount: this.mqttReconnectCount,
        subscribedTopics: [MQTT_TOPICS.telemetry, MQTT_TOPICS.event, MQTT_TOPICS.status],
        error: isDemo && !this.demoMqttConnected ? 'Giả lập ngắt kết nối MQTT Broker (DEMO)' : this.mqttError,
      },
      thresholds,
      alerts,
      unreadAlertCount,
      stateLogs: this.storage.getStateLogs(),
      lastCommandResult: this.lastCommandResult,
    };
  }

  private broadcastSnapshot(): void {
    this.broadcast('system:snapshot', this.getSnapshot());
  }
}
