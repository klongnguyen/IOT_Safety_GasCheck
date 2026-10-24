import fs from 'node:fs';
import path from 'node:path';
import {
  AlertEvent,
  DEFAULT_THRESHOLDS,
  TelemetryPayload,
  ThresholdConfig,
  computeFilteredAdc,
} from '../shared/gascheckCore.ts';

export interface StateLogEntry {
  id: string;
  fromState: string;
  toState: string;
  gasRaw: number;
  timestamp: number;
  isSimulation: boolean;
  note: string;
}

export interface PersistedDatabase {
  telemetryHistory: TelemetryPayload[];
  alerts: AlertEvent[];
  stateLogs: StateLogEntry[];
  thresholds: ThresholdConfig;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'gascheck-db.json');
const MAX_TELEMETRY_RECORDS = 1500;
const MAX_ALERT_RECORDS = 300;
const MAX_STATE_LOGS = 300;

function generateInitialSeedData(): PersistedDatabase {
  return {
    telemetryHistory: [],
    alerts: [],
    stateLogs: [],
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
}

export class StorageService {
  private data: PersistedDatabase;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): PersistedDatabase {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
        if (
          parsed &&
          Array.isArray(parsed.telemetryHistory) &&
          parsed.telemetryHistory.length > 0 &&
          Array.isArray(parsed.alerts)
        ) {
          return {
            telemetryHistory: parsed.telemetryHistory,
            alerts: parsed.alerts,
            stateLogs: Array.isArray(parsed.stateLogs) ? parsed.stateLogs : [],
            thresholds: parsed.thresholds ?? { ...DEFAULT_THRESHOLDS },
          };
        }
      }
    } catch (err) {
      console.warn('[GasCheck Storage] Khởi tạo lại dữ liệu mẫu do lỗi đọc file:', err);
    }

    const seeded = generateInitialSeedData();
    this.writeImmediately(seeded);
    return seeded;
  }

  private writeImmediately(payload: PersistedDatabase): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('[GasCheck Storage] Lỗi ghi dữ liệu:', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.writeImmediately(this.data);
    }, 300);
  }

  public addTelemetry(point: TelemetryPayload): void {
    this.data.telemetryHistory.push(point);
    if (this.data.telemetryHistory.length > MAX_TELEMETRY_RECORDS) {
      this.data.telemetryHistory = this.data.telemetryHistory.slice(
        this.data.telemetryHistory.length - MAX_TELEMETRY_RECORDS
      );
    }
    this.scheduleSave();
  }

  public getTelemetryHistory(sinceTimestamp?: number, limit = 600): TelemetryPayload[] {
    let list = this.data.telemetryHistory;
    if (typeof sinceTimestamp === 'number' && sinceTimestamp > 0) {
      list = list.filter((p) => p.timestamp >= sinceTimestamp);
    }
    if (list.length > limit) {
      return list.slice(list.length - limit);
    }
    return list;
  }

  public getAlerts(): AlertEvent[] {
    return this.data.alerts;
  }

  public setAlerts(alerts: AlertEvent[]): void {
    this.data.alerts = alerts.slice(0, MAX_ALERT_RECORDS);
    this.writeImmediately(this.data);
  }

  public addStateLog(entry: Omit<StateLogEntry, 'id'>): StateLogEntry {
    const newEntry: StateLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    this.data.stateLogs.unshift(newEntry);
    if (this.data.stateLogs.length > MAX_STATE_LOGS) {
      this.data.stateLogs = this.data.stateLogs.slice(0, MAX_STATE_LOGS);
    }
    this.scheduleSave();
    return newEntry;
  }

  public getStateLogs(): StateLogEntry[] {
    return this.data.stateLogs;
  }

  public getThresholds(): ThresholdConfig {
    return { ...this.data.thresholds };
  }

  public updateThresholds(next: Partial<ThresholdConfig>): ThresholdConfig {
    this.data.thresholds = {
      ...this.data.thresholds,
      ...next,
    };
    this.writeImmediately(this.data);
    return { ...this.data.thresholds };
  }
}
