import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAndValidateTelemetry,
  deriveHardwareStateFromAdc,
  resolveEffectiveSystemState,
  processTelemetryForAlerts,
  acknowledgeAlertEvent,
  validateSafetyCommand,
  DEFAULT_THRESHOLDS,
} from './gascheckCore.ts';

test('parseAndValidateTelemetry parses valid GasCheck V2 payload', () => {
  const payload = {
    device_id: 'n19-gascheck-01',
    gas_raw: 1860,
    state: 'WARNING',
    led: 'YELLOW',
    buzzer: true,
    window: 'CLOSED',
    sensor_fault: false,
  };

  const result = parseAndValidateTelemetry(JSON.stringify(payload), {
    now: 1700000000000,
    previousFiltered: 1800,
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.data);
  assert.equal(result.data.device_id, 'n19-gascheck-01');
  assert.equal(result.data.gas_raw, 1860);
  assert.equal(result.data.state, 'WARNING');
  assert.equal(result.data.led, 'YELLOW');
  assert.equal(result.data.buzzer, true);
  assert.equal(result.data.window, 'CLOSED');
  assert.equal(result.data.servo_angle, 0);
});

test('parseAndValidateTelemetry rejects invalid ADC range and missing fields', () => {
  const invalidPayload = {
    device_id: '',
    gas_raw: 5000,
    state: 'INVALID_STATE',
    led: 'BLUE',
    buzzer: 'yes',
    window: 'HALF',
  };

  const result = parseAndValidateTelemetry(invalidPayload);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4);
});

test('deriveHardwareStateFromAdc maps NORMAL, WARNING, DANGER, RECOVERY, and FAULT accurately', () => {
  const normal = deriveHardwareStateFromAdc(850, false, 'NORMAL');
  assert.equal(normal.state, 'NORMAL');
  assert.equal(normal.led, 'GREEN');
  assert.equal(normal.buzzer, false);
  assert.equal(normal.window, 'CLOSED');

  const warning = deriveHardwareStateFromAdc(1860, false, 'NORMAL');
  assert.equal(warning.state, 'WARNING');
  assert.equal(warning.led, 'YELLOW');
  assert.equal(warning.buzzer, true);
  assert.equal(warning.window, 'CLOSED');

  const danger = deriveHardwareStateFromAdc(2850, false, 'WARNING');
  assert.equal(danger.state, 'DANGER');
  assert.equal(danger.led, 'RED');
  assert.equal(danger.buzzer, true);
  assert.equal(danger.window, 'OPEN');
  assert.equal(danger.servoAngle, 90);

  // Coming down from DANGER to 1420 (within hysteresis band 1380-1500) -> RECOVERY
  const recovery = deriveHardwareStateFromAdc(1420, false, 'DANGER');
  assert.equal(recovery.state, 'RECOVERY');
  assert.equal(recovery.led, 'YELLOW');
  assert.equal(recovery.window, 'OPEN');

  // Sensor fault overrides state to FAULT and opens window
  const fault = deriveHardwareStateFromAdc(500, true, 'NORMAL');
  assert.equal(fault.state, 'FAULT');
  assert.equal(fault.led, 'RED');
  assert.equal(fault.buzzer, true);
  assert.equal(fault.window, 'OPEN');
});

test('resolveEffectiveSystemState never marks OFFLINE or STALE telemetry as NORMAL', () => {
  const now = 1700000050000;
  const staleTelemetry = {
    device_id: 'n19-gascheck-01',
    gas_raw: 600,
    gas_filtered: 600,
    state: 'NORMAL' as const,
    led: 'GREEN' as const,
    buzzer: false,
    window: 'CLOSED' as const,
    servo_angle: 0,
    sensor_fault: false,
    rssi: -62,
    uptime_sec: 1200,
    timestamp: now - 30000, // 30s old > 15s threshold
    is_simulation: true,
  };

  const staleRes = resolveEffectiveSystemState({
    telemetry: staleTelemetry,
    esp32Online: true,
    mqttConnected: true,
    mode: 'DEMO',
    now,
    staleTimeoutMs: 15000,
  });
  assert.equal(staleRes.effectiveState, 'STALE');
  assert.equal(staleRes.isStale, true);

  const offlineRes = resolveEffectiveSystemState({
    telemetry: { ...staleTelemetry, timestamp: now },
    esp32Online: false,
    mqttConnected: true,
    mode: 'DEMO',
    now,
  });
  assert.equal(offlineRes.effectiveState, 'OFFLINE');
});

test('Alert lifecycle: NEW -> ACKNOWLEDGED -> RESOLVED and anti-spam deduplication', () => {
  const t0 = 1700000000000;
  const dangerTelemetry = {
    device_id: 'n19-gascheck-01',
    gas_raw: 2650,
    gas_filtered: 2500,
    state: 'DANGER' as const,
    led: 'RED' as const,
    buzzer: true,
    window: 'OPEN' as const,
    servo_angle: 90,
    sensor_fault: false,
    rssi: -58,
    uptime_sec: 500,
    timestamp: t0,
    is_simulation: true,
  };

  // 1. Trigger DANGER -> creates NEW CRITICAL alert
  const step1 = processTelemetryForAlerts(dangerTelemetry, [], t0);
  assert.equal(step1.alerts.length, 1);
  assert.ok(step1.newlyCreatedAlert);
  assert.equal(step1.newlyCreatedAlert.lifecycle, 'NEW');
  assert.equal(step1.newlyCreatedAlert.severity, 'CRITICAL');

  // 2. Subsequent DANGER packet -> deduplicates, updates peakGasRaw, no new alert spam
  const step2 = processTelemetryForAlerts(
    { ...dangerTelemetry, gas_raw: 3100, timestamp: t0 + 2000 },
    step1.alerts,
    t0 + 2000
  );
  assert.equal(step2.alerts.length, 1);
  assert.equal(step2.newlyCreatedAlert, null);
  assert.equal(step2.alerts[0].peakGasRaw, 3100);

  // 3. Operator acknowledges alert -> lifecycle becomes ACKNOWLEDGED, NOT RESOLVED
  const ackedAlert = acknowledgeAlertEvent(step2.alerts[0], 'Kỹ sư trực ca', t0 + 5000);
  assert.equal(ackedAlert.lifecycle, 'ACKNOWLEDGED');
  assert.equal(ackedAlert.resolvedAt, null);

  // 4. System recovers to NORMAL -> alert transitions to RESOLVED
  const step4 = processTelemetryForAlerts(
    {
      ...dangerTelemetry,
      gas_raw: 720,
      state: 'NORMAL',
      led: 'GREEN',
      buzzer: false,
      window: 'CLOSED',
      timestamp: t0 + 20000,
    },
    [ackedAlert],
    t0 + 20000
  );
  assert.equal(step4.alerts[0].lifecycle, 'RESOLVED');
  assert.ok(step4.alerts[0].resolvedAt);
  assert.equal(step4.resolvedAlertIds.length, 1);
});

test('validateSafetyCommand blocks unsafe overrides and rejects REQUEST_RESET during DANGER', () => {
  const dangerTelemetry = {
    device_id: 'n19-gascheck-01',
    gas_raw: 2700,
    gas_filtered: 2600,
    state: 'DANGER' as const,
    led: 'RED' as const,
    buzzer: true,
    window: 'OPEN' as const,
    servo_angle: 90,
    sensor_fault: false,
    rssi: -60,
    uptime_sec: 100,
    timestamp: Date.now(),
    is_simulation: true,
  };

  // Unsafe override must always be rejected
  const forceClose = validateSafetyCommand(
    { command: 'FORCE_CLOSE_WINDOW', deviceId: 'n19-gascheck-01', requestedAt: Date.now() },
    dangerTelemetry,
    DEFAULT_THRESHOLDS
  );
  assert.equal(forceClose.allowed, false);
  assert.equal(forceClose.status, 'REJECTED');

  // REQUEST_RESET during DANGER must be rejected by safety logic
  const resetDuringDanger = validateSafetyCommand(
    { command: 'REQUEST_RESET', deviceId: 'n19-gascheck-01', requestedAt: Date.now() },
    dangerTelemetry,
    DEFAULT_THRESHOLDS
  );
  assert.equal(resetDuringDanger.allowed, false);
  assert.equal(resetDuringDanger.status, 'REJECTED');

  // REQUEST_RESET during RECOVERY when gas_raw < warningThreshold is accepted (ACK)
  const recoveryTelemetry = {
    ...dangerTelemetry,
    gas_raw: 1150,
    state: 'RECOVERY' as const,
    led: 'YELLOW' as const,
    buzzer: false,
  };
  const resetDuringRecovery = validateSafetyCommand(
    { command: 'REQUEST_RESET', deviceId: 'n19-gascheck-01', requestedAt: Date.now() },
    recoveryTelemetry,
    DEFAULT_THRESHOLDS
  );
  assert.equal(resetDuringRecovery.allowed, true);
  assert.equal(resetDuringRecovery.status, 'ACK');
});
