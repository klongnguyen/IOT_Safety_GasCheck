import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { StorageService } from './src/backend/storageService.ts';
import { DemoPresetScenario, GasCheckEngine } from './src/backend/mqttAndSimulationEngine.ts';
import { DataSourceMode, DeviceCommandType } from './src/shared/gascheckCore.ts';

async function startServer() {
  const app = express();
  app.use(express.json());

  const storage = new StorageService();
  const engine = new GasCheckEngine(storage);

  // REST API Endpoints
  app.get('/api/snapshot', (_req, res) => {
    res.json(engine.getSnapshot());
  });

  app.get('/api/history', (req, res) => {
    const rangeMinutes = Number(req.query.rangeMinutes) || 60;
    const since = Date.now() - rangeMinutes * 60 * 1000;
    const points = storage.getTelemetryHistory(since, 800);
    res.json({
      rangeMinutes,
      count: points.length,
      points,
    });
  });

  app.post('/api/mode', (req, res) => {
    const mode = req.body?.mode as DataSourceMode;
    if (mode !== 'DEMO' && mode !== 'LIVE') {
      res.status(400).json({ error: 'Chế độ không hợp lệ. Chỉ chấp nhận DEMO hoặc LIVE.' });
      return;
    }
    const snapshot = engine.setMode(mode);
    res.json(snapshot);
  });

  app.post('/api/demo/scenario', (req, res) => {
    const scenario = req.body?.scenario as DemoPresetScenario;
    const validScenarios: DemoPresetScenario[] = [
      'NORMAL',
      'WARNING',
      'DANGER',
      'RECOVERY',
      'FAULT',
      'ESP32_OFFLINE',
      'MQTT_DISCONNECTED',
      'STALE_DATA',
      'RECOVERY_AFTER_DANGER',
    ];
    if (!validScenarios.includes(scenario)) {
      res.status(400).json({ error: 'Kịch bản DEMO không hợp lệ.' });
      return;
    }
    const snapshot = engine.applyDemoScenario(scenario);
    res.json(snapshot);
  });

  app.post('/api/demo/adc', (req, res) => {
    const adc = Number(req.body?.adc);
    if (Number.isNaN(adc) || adc < 0 || adc > 4095) {
      res.status(400).json({ error: 'Giá trị ADC phải nằm trong khoảng 0–4095.' });
      return;
    }
    const snapshot = engine.setDemoCustomAdc(adc);
    res.json(snapshot);
  });

  app.post('/api/demo/run-leak-scenario', (_req, res) => {
    const snapshot = engine.startGasLeakScenarioRunner();
    res.json(snapshot);
  });

  app.post('/api/alerts/:id/ack', (req, res) => {
    const alertId = req.params.id;
    const acknowledgedBy = typeof req.body?.acknowledgedBy === 'string'
      ? req.body.acknowledgedBy
      : 'Người vận hành';
    const snapshot = engine.acknowledgeAlert(alertId, acknowledgedBy);
    res.json(snapshot);
  });

  app.post('/api/alerts/read-all', (_req, res) => {
    const snapshot = engine.markAllAlertsRead();
    res.json(snapshot);
  });

  app.post('/api/command', (req, res) => {
    const command = req.body?.command as DeviceCommandType;
    const validCommands: DeviceCommandType[] = [
      'TEST_ALARM',
      'REQUEST_RESET',
      'PING_STATUS',
      'FORCE_CLOSE_WINDOW',
      'SILENCE_BUZZER',
    ];
    if (!validCommands.includes(command)) {
      res.status(400).json({ error: 'Lệnh thiết bị không hợp lệ.' });
      return;
    }
    const result = engine.executeDeviceCommand({
      command,
      deviceId: req.body?.deviceId || 'n19-gascheck-01',
      requestedAt: Date.now(),
    });
    res.json(result);
  });

  app.post('/api/thresholds', (req, res) => {
    const result = engine.updateThresholds({
      warning: req.body?.warning !== undefined ? Number(req.body.warning) : undefined,
      danger: req.body?.danger !== undefined ? Number(req.body.danger) : undefined,
      hysteresis: req.body?.hysteresis !== undefined ? Number(req.body.hysteresis) : undefined,
      staleTimeoutMs: req.body?.staleTimeoutMs !== undefined ? Number(req.body.staleTimeoutMs) : undefined,
    });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  const httpServer = http.createServer(app);

  // WebSocket Server for Real-time Push on /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket: WebSocket) => {
    // Send initial authoritative state immediately
    socket.send(
      JSON.stringify({
        type: 'system:snapshot',
        payload: engine.getSnapshot(),
      })
    );
  });

  engine.subscribe((event) => {
    const msg = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[GasCheck Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start GasCheck server:', err);
  process.exit(1);
});
