/*
 * =========================================================================
 *  DU AN IOT: IOT-SAFETY-GASCHECK (NHOM N19 - DETAI 06 - SAFETY)
 *  He thong giam sat canh bao ro ri khi Gas & dieu khien thong thoang mo hinh
 *  Firmware ESP32 DevKit V4 - Kien truc IoT 4 tang
 * =========================================================================
 */

#include <Arduino.h>
#include "config.h"
#include "state_machine.h"
#include "mqtt_manager.h"

// Doi tuong quan ly trang thai va mang
GasStateManager stateManager;
MqttNetworkManager mqttManager(stateManager);

// Bien toan cuc luu gia tri cam bien
int globalRawADC = 0;
int globalFilteredADC = 0;
unsigned long lastSampleTime = 0;
unsigned long lastSerialPrint = 0;

// Callback xu ly goi tin downlink tu MQTT Broker
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  mqttManager.handleCommand(topic, payload, length, globalFilteredADC);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n**************************************************************");
  Serial.println("*      HE THONG IOT CANH BAO RO RI GAS - GASCHECK V2        *");
  Serial.println("*      Nhom: N19  |  De tai: 06  |  Linh vuc: Safety         *");
  Serial.println("*      Phien ban: Firmware Tuan 3-4-5 Hoan chinh            *");
  Serial.println("**************************************************************\n");

  // 1. Khoi tao phan cung cuc bo (Sensing / Physical - Tang 1)
  stateManager.init();
  Serial.println("[SYSTEM] Khoi tao phan cung cuc bo thanh cong.");

  // 2. Khoi tao mang Wi-Fi va MQTT (Network - Tang 2)
  mqttManager.setCallback(mqttCallback);
  mqttManager.init();

  Serial.println("[SYSTEM] He thong san sang hoat dong. Bat dau chu ky giam sat.\n");
}

void loop() {
  unsigned long currentMillis = millis();

  // =========================================================================
  // 1. CHU KY DOC VA LOC DU LIEU CAM BIEN (Moi 100ms)
  // =========================================================================
  if (currentMillis - lastSampleTime >= SAMPLING_INTERVAL_MS) {
    lastSampleTime = currentMillis;

    // Doc ADC tu GPIO34 (0 - 4095)
    globalRawADC = analogRead(PIN_POT_GAS);

    // Loc trung binh dong 10 mau de khu nhieu
    globalFilteredADC = stateManager.updateFilter(globalRawADC);

    // Danh gia chuyen doi trang thai (FSM + Hysteresis + Safety Latch)
    bool stateChanged = stateManager.evaluate(globalRawADC, globalFilteredADC, currentMillis);

    // Neu co su kien thay doi trang thai -> Phat canh bao ngay lap tuc
    if (stateChanged) {
      const char* fromState = stateToString(stateManager.getPreviousState());
      const char* toState = stateToString(stateManager.getState());

      Serial.printf("\n>>> [CHUYEN TRANG THAI] %s ---> %s | Gas Filtered: %d <<<\n\n",
                    fromState, toState, globalFilteredADC);

      // Publish event khan cap len MQTT
      mqttManager.publishEvent("STATE_CHANGED", fromState, toState, globalFilteredADC);
    }
  }

  // =========================================================================
  // 2. DIEU KHIEN ACTUATOR CUC BO (Non-blocking: LED, Buzzer, Servo)
  // =========================================================================
  stateManager.updateActuators(currentMillis);

  // =========================================================================
  // 3. XU LY MANG WI-FI & MQTT (Tang 2 - Connectivity)
  // =========================================================================
  mqttManager.loop(currentMillis, globalFilteredADC);

  // =========================================================================
  // 4. PUBLISH TELEMETRY DINH KY (Moi 2 giay)
  // =========================================================================
  mqttManager.publishTelemetry(globalRawADC, globalFilteredADC, currentMillis);

  // =========================================================================
  // 5. IN LOG SERIAL JSON RA MAN HINH
  // =========================================================================
  if (currentMillis - lastSerialPrint >= 1000) {
    lastSerialPrint = currentMillis;
    
    // In dinh dang de quan sat truc tiep tren Serial Monitor
    Serial.printf("[LOCAL-LOG] Gas Raw: %4d | Filtered: %4d | State: %-12s | Window: %-6s | Buzzer: %d | LED: %s\n",
                  globalRawADC,
                  globalFilteredADC,
                  stateToString(stateManager.getState()),
                  stateManager.getWindowStatus(),
                  stateManager.isBuzzerActive(),
                  stateManager.getLedColor());
  }
}
