import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Play,
  Radio,
  RefreshCw,
  Sliders,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { DataSourceMode, ThresholdConfig } from '../shared/gascheckCore';
import { DemoPresetScenario, LeakScenarioRunnerState } from '../backend/mqttAndSimulationEngine';

interface DemoControlsProps {
  mode: DataSourceMode;
  activeScenario: DemoPresetScenario;
  currentAdc: number;
  thresholds: ThresholdConfig;
  scenarioRunner: LeakScenarioRunnerState;
  onSelectMode: (mode: DataSourceMode) => void;
  onTriggerScenario: (scenario: DemoPresetScenario) => void;
  onChangeCustomAdc: (adc: number) => void;
  onRunGasLeakScenario: () => void;
}

const SCENARIO_PRESETS: Array<{
  id: DemoPresetScenario;
  label: string;
  subLabel: string;
  tone: 'emerald' | 'amber' | 'red' | 'rose' | 'slate';
}> = [
  { id: 'NORMAL', label: 'NORMAL', subLabel: 'Bình thường (~680 ADC)', tone: 'emerald' },
  { id: 'WARNING', label: 'WARNING', subLabel: 'Cảnh báo sớm (~1860 ADC)', tone: 'amber' },
  { id: 'DANGER', label: 'DANGER', subLabel: 'Nguy hiểm (~2880 ADC)', tone: 'red' },
  { id: 'RECOVERY', label: 'RECOVERY', subLabel: 'Chờ phục hồi (~1440 ADC)', tone: 'amber' },
  { id: 'RECOVERY_AFTER_DANGER', label: 'RECOVERY AFTER DANGER', subLabel: 'Thoát khí sau báo động', tone: 'amber' },
  { id: 'FAULT', label: 'SENSOR FAULT', subLabel: 'Lỗi cảm biến MQ2', tone: 'rose' },
  { id: 'ESP32_OFFLINE', label: 'ESP32 OFFLINE', subLabel: 'Mất kết nối vi điều khiển', tone: 'slate' },
  { id: 'MQTT_DISCONNECTED', label: 'MQTT DISCONNECTED', subLabel: 'Ngắt kết nối Broker', tone: 'slate' },
  { id: 'STALE_DATA', label: 'STALE DATA', subLabel: 'Dữ liệu quá hạn >15s', tone: 'slate' },
];

export const DemoControls: React.FC<DemoControlsProps> = ({
  mode,
  activeScenario,
  currentAdc,
  thresholds,
  scenarioRunner,
  onSelectMode,
  onTriggerScenario,
  onChangeCustomAdc,
  onRunGasLeakScenario,
}) => {
  const [sliderValue, setSliderValue] = useState<number>(currentAdc || 680);

  useEffect(() => {
    setSliderValue(currentAdc || 680);
  }, [currentAdc]);

  const getPresetButtonClass = (presetId: DemoPresetScenario, tone: string) => {
    const isActive = mode === 'DEMO' && activeScenario === presetId;
    if (isActive) {
      switch (tone) {
        case 'emerald':
          return 'border-emerald-600 bg-emerald-600 text-white shadow-xs';
        case 'amber':
          return 'border-amber-600 bg-amber-600 text-white shadow-xs';
        case 'red':
          return 'border-red-600 bg-red-600 text-white shadow-xs';
        case 'rose':
          return 'border-rose-700 bg-rose-700 text-white shadow-xs';
        default:
          return 'border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900';
      }
    }
    return 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800';
  };

  return (
    <section
      aria-label="Bảng điều khiển mô phỏng DEMO MODE"
      className="rounded-xl border border-cyan-200 bg-cyan-50/35 p-5 dark:border-cyan-900/60 dark:bg-cyan-950/15"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-cyan-200/70 pb-4 lg:flex-row lg:items-center dark:border-cyan-900/50">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cyan-800 dark:text-cyan-300">
              <span>BẢNG ĐIỀU KHIỂN MÔ PHỎNG ĐỘC LẬP</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">SIMULATION WORKBENCH</span>
            </div>
            <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
              Kiểm thử Kịch bản Rò rỉ Khí Gas & Trạng thái Phần cứng (DEMO MODE)
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              Dữ liệu tạo từ bảng này luôn được gắn nhãn <strong>SIMULATION</strong> và tuyệt đối không gửi lệnh giả tới thiết bị gas thật.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {mode === 'LIVE' && (
            <button
              type="button"
              onClick={() => onSelectMode('DEMO')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600 bg-white px-3.5 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:bg-slate-900 dark:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Radio className="h-4 w-4" />
              Chuyển sang DEMO MODE
            </button>
          )}

          <button
            type="button"
            onClick={onRunGasLeakScenario}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-cyan-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            Chạy kịch bản rò rỉ khí gas (Run Gas Leak Scenario)
          </button>
        </div>
      </div>

      {/* Automated Scenario Runner Progress Bar */}
      {(scenarioRunner.active || scenarioRunner.stepIndex > 0) && (
        <div className="mt-4 rounded-lg border border-cyan-200 bg-white p-3 dark:border-cyan-800/60 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-200">
            <span>{scenarioRunner.stepLabelVi}</span>
            <span className="font-mono tabular-nums">
              Bước {scenarioRunner.stepIndex}/{scenarioRunner.totalSteps}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              style={{
                width: `${Math.round((scenarioRunner.stepIndex / scenarioRunner.totalSteps) * 100)}%`,
              }}
              className="h-full bg-cyan-600 transition-all duration-300"
            />
          </div>
        </div>
      )}

      {/* Grid of 9 Scenario Presets + ADC Slider */}
      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* 9 Scenario Buttons */}
        <div className="xl:col-span-8">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Kích hoạt nhanh tình huống kiểm thử (Đồng bộ Gauge, LED, Buzzer, Servo & Alert):
          </span>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SCENARIO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onTriggerScenario(preset.id)}
                className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all cursor-pointer ${getPresetButtonClass(
                  preset.id,
                  preset.tone
                )}`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold whitespace-nowrap truncate">
                    {preset.label}
                  </span>
                  {preset.id === 'NORMAL' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                  {(preset.id === 'WARNING' || preset.id === 'RECOVERY' || preset.id === 'RECOVERY_AFTER_DANGER') && (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  )}
                  {preset.id === 'DANGER' && <AlertOctagon className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                  {preset.id === 'FAULT' && <Wrench className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                  {(preset.id === 'ESP32_OFFLINE' || preset.id === 'MQTT_DISCONNECTED' || preset.id === 'STALE_DATA') && (
                    <WifiOff className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  )}
                </div>
                <span className="mt-1 text-[11px] opacity-85 truncate w-full">
                  {preset.subLabel}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual MQ2 ADC Slider */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="demo-mq2-slider"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <Sliders className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                Giả lập tín hiệu MQ2 ADC (0–4095)
              </label>
              <span className="font-mono text-sm font-bold text-cyan-700 dark:text-cyan-400 tabular-nums">
                {sliderValue} ADC
              </span>
            </div>

            <input
              id="demo-mq2-slider"
              type="range"
              min={0}
              max={4095}
              step={15}
              value={sliderValue}
              onChange={(e) => {
                const next = Number(e.target.value);
                setSliderValue(next);
              }}
              onMouseUp={() => onChangeCustomAdc(sliderValue)}
              onTouchEnd={() => onChangeCustomAdc(sliderValue)}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-cyan-600 dark:bg-slate-700"
            />

            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500 tabular-nums">
              <span>0 (Sạch)</span>
              <span className="text-amber-600">WARN: {thresholds.warning}</span>
              <span className="text-red-600">DANGER: {thresholds.danger}</span>
              <span>4095</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              {[550, 1860, 2950].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setSliderValue(val);
                    onChangeCustomAdc(val);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer tabular-nums"
                >
                  {val}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onChangeCustomAdc(sliderValue)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Áp dụng ADC
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
