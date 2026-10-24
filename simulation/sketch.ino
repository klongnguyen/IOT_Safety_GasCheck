/*
 * =========================================================================
 *  DU AN IOT: IOT-SAFETY-GASCHECK (NHOM N19 - DETAI 06 - SAFETY)
 *  He thong giam sat canh bao ro ri khi Gas & dieu khien thong thoang mo hinh
 *  Single-File Sketch danh cho Wokwi Simulator & ESP32 DevKit V4
 * =========================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#if __has_include(<ESP32Servo.h>)
  #include <ESP32Servo.h>
  #define USE_EXTERNAL_SERVO_LIB 1
#else
  #define USE_EXTERNAL_SERVO_LIB 0
#endif

// ==========================================
// 1. PIN CONFIGURATION (ESP32 DevKit V4)
// ==========================================
#define PIN_POT_GAS        34   // ADC1 Channel 6 (GPIO34)
#define PIN_LED_GREEN      25   // Green LED (Normal state)
#define PIN_LED_YELLOW     26   // Yellow LED (Warning / Recovery state)
#define PIN_LED_RED        27   // Red LED (Danger / Fault state)
#define PIN_BUZZER         23   // Active/Passive Buzzer output
#define PIN_SERVO          18   // PWM output for SG90 Servo

// ==========================================
// 2. THRESHOLDS & HYSTERESIS (ADC 12-bit: 0 - 4095)
// ==========================================
#define THRESHOLD_WARN_ON      1500  // ADC >= 1500 -> WARNING
#define THRESHOLD_WARN_OFF     1300  // ADC < 1300  -> NORMAL
#define THRESHOLD_DANGER_ON    2500  // ADC >= 2500 -> DANGER
#define THRESHOLD_DANGER_OFF   2200  // ADC < 2200  -> RECOVERY
#define SAFE_RESET_THRESHOLD   1300  // Maximum gas level allowed to perform Reset

#define FAULT_ADC_MIN          -1    // Set to -1 for Wokwi simulation (potentiometer 0 = 0% gas, not wire cut)
#define FAULT_ADC_MAX          5000  // Set to 5000 for Wokwi simulation

#define SERVO_WINDOW_CLOSED    0     // Degree for closed window
#define SERVO_WINDOW_OPEN      90    // Degree for open window

#define SAMPLING_INTERVAL_MS        100
#define TELEMETRY_INTERVAL_MS       2000
#define MQTT_RECONNECT_INTERVAL_MS  5000
#define FILTER_WINDOW_SIZE          10

// Network Configuration
#define DEFAULT_WIFI_SSID           "Wokwi-GUEST"
#define DEFAULT_WIFI_PASS           ""
#define MQTT_BROKER_HOST            "broker.hivemq.com"
#define MQTT_BROKER_PORT            1883
#define DEVICE_ID                   "n19-gascheck-01"

#define TOPIC_TELEMETRY             "gascheck/n19/telemetry"
#define TOPIC_EVENT                 "gascheck/n19/event"
#define TOPIC_STATUS                "gascheck/n19/status"
#define TOPIC_CMD                   "gascheck/n19/cmd"

// ==========================================
// 3. FSM & LOGIC STATE
// ==========================================
enum SystemState {
  STATE_NORMAL,
  STATE_WARNING,
  STATE_DANGER,
  STATE_RECOVERY,
  STATE_FAULT
};

inline const char* stateToString(SystemState state) {
  switch (state) {
    case STATE_NORMAL:   return "NORMAL";
    case STATE_WARNING:  return "WARNING";
    case STATE_DANGER:   return "DANGER";
    case STATE_RECOVERY: return "RECOVERY";
    case STATE_FAULT:    return "FAULT";
    default:             return "UNKNOWN";
  }
}

// Variables
SystemState currentState = STATE_NORMAL;
SystemState previousState = STATE_NORMAL;

#if USE_EXTERNAL_SERVO_LIB
  Servo windowServo;
#else
  #define SERVO_LEDC_CH   0
  #define SERVO_LEDC_FREQ 50
  #define SERVO_LEDC_RES  12
#endif

int samples[FILTER_WINDOW_SIZE];
int sampleIndex = 0;
long sampleSum = 0;

unsigned long lastSampleTime = 0;
unsigned long lastTelemetryPublish = 0;
unsigned long lastSerialPrint = 0;
unsigned long lastReconnectAttempt = 0;

unsigned long lastBuzzerToggle = 0;
bool buzzerState = false;
bool buzzerActive = false;

unsigned long lastLedToggle = 0;
bool ledBlinkState = false;

unsigned long faultTriggerTime = 0;
bool faultCandidate = false;

int currentWindowAngle = SERVO_WINDOW_CLOSED;
int globalRawADC = 0;
int globalFilteredADC = 0;

bool isTestAlarmRunning = false;
unsigned long testAlarmStartTime = 0;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Forward declarations
void setWindow(int angle);
bool attemptReset(int filteredADC);
void reconnectMqtt();
void publishTelemetry(unsigned long currentMillis);
void publishEvent(const char* eventType, const char* fromState, const char* toState, int filteredADC);
void publishStatus(const char* statusStr);
void mqttCallback(char* topic, byte* payload, unsigned int length);

// Filter
int updateFilter(int rawADC) {
  sampleSum -= samples[sampleIndex];
  samples[sampleIndex] = rawADC;
  sampleSum += rawADC;
  sampleIndex = (sampleIndex + 1) % FILTER_WINDOW_SIZE;
  return (int)(sampleSum / FILTER_WINDOW_SIZE);
}

void setWindow(int angle) {
  if (currentWindowAngle != angle) {
    currentWindowAngle = angle;
#if USE_EXTERNAL_SERVO_LIB
    windowServo.write(angle);
#else
    int pulseUs = map(angle, 0, 180, 500, 2400);
    int duty = (pulseUs * 4095) / 20000;
    #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      ledcWrite(PIN_SERVO, duty);
    #else
      ledcWrite(SERVO_LEDC_CH, duty);
    #endif
#endif
  }
}

bool attemptReset(int filteredADC) {
  if ((currentState == STATE_RECOVERY || currentState == STATE_FAULT) && 
      filteredADC < SAFE_RESET_THRESHOLD) {
    currentState = STATE_NORMAL;
    setWindow(SERVO_WINDOW_CLOSED);
    return true;
  }
  return false;
}

// Evaluate FSM transitions
bool evaluateState(int rawADC, int filteredADC, unsigned long currentMillis) {
  previousState = currentState;

  // Bo qua 2 giay dau sau khi khoi dong de ADC tren Wokwi on dinh, tranh xung ao
  if (currentMillis < 2000) {
    return false;
  }

  // 1. Fault check
  bool isOutOfBounds = (rawADC <= FAULT_ADC_MIN || rawADC >= FAULT_ADC_MAX);
  if (isOutOfBounds) {
    if (!faultCandidate) {
      faultCandidate = true;
      faultTriggerTime = currentMillis;
    } else if (currentMillis - faultTriggerTime > 2000) {
      currentState = STATE_FAULT;
    }
  } else {
    faultCandidate = false;
    if (currentState == STATE_FAULT) {
      currentState = STATE_NORMAL;
    }
  }

  // 2. FSM transitions
  if (currentState != STATE_FAULT) {
    switch (currentState) {
      case STATE_NORMAL:
        if (filteredADC >= THRESHOLD_DANGER_ON) {
          currentState = STATE_DANGER;
        } else if (filteredADC >= THRESHOLD_WARN_ON) {
          currentState = STATE_WARNING;
        }
        break;

      case STATE_WARNING:
        if (filteredADC >= THRESHOLD_DANGER_ON) {
          currentState = STATE_DANGER;
        } else if (filteredADC < THRESHOLD_WARN_OFF) {
          currentState = STATE_NORMAL;
        }
        break;

      case STATE_DANGER:
        setWindow(SERVO_WINDOW_OPEN);
        if (filteredADC < THRESHOLD_DANGER_OFF) {
          currentState = STATE_RECOVERY;
        }
        break;

      case STATE_RECOVERY:
        if (filteredADC >= THRESHOLD_DANGER_ON) {
          currentState = STATE_DANGER;
        }
        setWindow(SERVO_WINDOW_OPEN);
        break;

      default:
        break;
    }
  }

  return (currentState != previousState);
}

// Update LEDs, Buzzer, Servo
void updateActuators(unsigned long currentMillis) {
  // LED
  switch (currentState) {
    case STATE_NORMAL:
      digitalWrite(PIN_LED_GREEN, HIGH);
      digitalWrite(PIN_LED_YELLOW, LOW);
      digitalWrite(PIN_LED_RED, LOW);
      break;

    case STATE_WARNING:
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_YELLOW, HIGH);
      digitalWrite(PIN_LED_RED, LOW);
      break;

    case STATE_DANGER:
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_YELLOW, LOW);
      digitalWrite(PIN_LED_RED, HIGH);
      break;

    case STATE_RECOVERY:
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_RED, LOW);
      if (currentMillis - lastLedToggle >= 500) {
        lastLedToggle = currentMillis;
        ledBlinkState = !ledBlinkState;
        digitalWrite(PIN_LED_YELLOW, ledBlinkState ? HIGH : LOW);
      }
      break;

    case STATE_FAULT:
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_YELLOW, LOW);
      if (currentMillis - lastLedToggle >= 200) {
        lastLedToggle = currentMillis;
        ledBlinkState = !ledBlinkState;
        digitalWrite(PIN_LED_RED, ledBlinkState ? HIGH : LOW);
      }
      break;
  }

  // Buzzer
  if (isTestAlarmRunning) {
    if (currentMillis - testAlarmStartTime >= 2000) {
      isTestAlarmRunning = false;
      digitalWrite(PIN_BUZZER, LOW);
      Serial.println("[COMMAND] Test Alarm ket thuc.");
    } else {
      digitalWrite(PIN_BUZZER, HIGH);
      buzzerActive = true;
      return;
    }
  }

  switch (currentState) {
    case STATE_NORMAL:
      buzzerActive = false;
      digitalWrite(PIN_BUZZER, LOW);
      noTone(PIN_BUZZER);
      break;

    case STATE_WARNING:
      if (buzzerState) {
        if (currentMillis - lastBuzzerToggle >= 300) {
          buzzerState = false;
          lastBuzzerToggle = currentMillis;
          digitalWrite(PIN_BUZZER, LOW);
          noTone(PIN_BUZZER);
        }
      } else {
        if (currentMillis - lastBuzzerToggle >= 700) {
          buzzerState = true;
          lastBuzzerToggle = currentMillis;
          digitalWrite(PIN_BUZZER, HIGH);
          tone(PIN_BUZZER, 1500);
        }
      }
      buzzerActive = buzzerState;
      break;

    case STATE_DANGER:
      buzzerActive = true;
      digitalWrite(PIN_BUZZER, HIGH);
      tone(PIN_BUZZER, 2500);
      break;

    case STATE_RECOVERY:
      if (buzzerState) {
        if (currentMillis - lastBuzzerToggle >= 100) {
          buzzerState = false;
          lastBuzzerToggle = currentMillis;
          digitalWrite(PIN_BUZZER, LOW);
          noTone(PIN_BUZZER);
        }
      } else {
        if (currentMillis - lastBuzzerToggle >= 1900) {
          buzzerState = true;
          lastBuzzerToggle = currentMillis;
          digitalWrite(PIN_BUZZER, HIGH);
          tone(PIN_BUZZER, 1000);
        }
      }
      buzzerActive = buzzerState;
      break;

    case STATE_FAULT:
      if (buzzerState) {
        if (currentMillis - lastBuzzerToggle >= 100) {
          buzzerState = false;
          lastBuzzerToggle = currentMillis;
          digitalWrite(PIN_BUZZER, LOW);
          noTone(PIN_BUZZER);
        }
      } else {
        if (currentMillis - lastBuzzerToggle >= 400) {
          buzzerState = true;
          lastBuzzerToggle = currentMillis;
          digitalWrite(PIN_BUZZER, HIGH);
          tone(PIN_BUZZER, 2000);
        }
      }
      buzzerActive = buzzerState;
      break;
  }


  // Servo
  if (currentState == STATE_NORMAL) {
    setWindow(SERVO_WINDOW_CLOSED);
  } else if (currentState == STATE_DANGER || currentState == STATE_RECOVERY) {
    setWindow(SERVO_WINDOW_OPEN);
  }
}

// MQTT Downlink Callback
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char jsonStr[length + 1];
  memcpy(jsonStr, payload, length);
  jsonStr[length] = '\0';
  Serial.printf("[MQTT-DOWNLINK] Nhan lenh: %s\n", jsonStr);

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) {
    Serial.printf("[MQTT-DOWNLINK] Loi parse JSON: %s\n", error.c_str());
    return;
  }

  const char* cmd = doc["cmd"] | "";

  if (strcmp(cmd, "REQUEST_RESET") == 0) {
    bool resetOk = attemptReset(globalFilteredADC);
    JsonDocument resp;
    resp["device_id"] = DEVICE_ID;
    resp["command"] = "REQUEST_RESET";

    if (resetOk) {
      resp["result"] = "ACCEPTED";
      resp["message"] = "An toan, da reset he thong va dong cua so.";
      resp["state"] = "NORMAL";
      Serial.println("[SAFETY-INTERLOCK] => DONG Y: Reset thanh cong!");
    } else {
      resp["result"] = "REJECTED";
      resp["message"] = "TU CHOI RESET: Gas con nguy hiem hoac he thong dang DANGER!";
      resp["current_gas"] = globalFilteredADC;
      resp["safe_limit"] = SAFE_RESET_THRESHOLD;
      resp["state"] = stateToString(currentState);
      Serial.println("[SAFETY-INTERLOCK] => TU CHOI: Gas van nguy hiem!");
    }

    char respBuf[256];
    serializeJson(resp, respBuf);
    mqttClient.publish(TOPIC_EVENT, respBuf);
  } else if (strcmp(cmd, "TEST_ALARM") == 0) {
    Serial.println("[COMMAND] Bat Test Alarm 2s...");
    isTestAlarmRunning = true;
    testAlarmStartTime = millis();

    JsonDocument resp;
    resp["device_id"] = DEVICE_ID;
    resp["command"] = "TEST_ALARM";
    resp["result"] = "EXECUTING";
    char respBuf[128];
    serializeJson(resp, respBuf);
    mqttClient.publish(TOPIC_EVENT, respBuf);
  } else if (strcmp(cmd, "PING") == 0) {
    JsonDocument resp;
    resp["device_id"] = DEVICE_ID;
    resp["response"] = "PONG";
    resp["uptime_sec"] = millis() / 1000;
    char respBuf[128];
    serializeJson(resp, respBuf);
    mqttClient.publish(TOPIC_EVENT, respBuf);
  }
}

void reconnectMqtt() {
  Serial.printf("[MQTT] Ket noi Broker %s:%d...\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  const char* lwtTopic = TOPIC_STATUS;
  const char* lwtPayload = "{\"device_id\":\"" DEVICE_ID "\",\"status\":\"offline\"}";
  String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

  if (mqttClient.connect(clientId.c_str(), lwtTopic, 1, true, lwtPayload)) {
    Serial.println("[MQTT] Ket noi thanh cong!");
    publishStatus("online");
    mqttClient.subscribe(TOPIC_CMD);
    Serial.printf("[MQTT] Da subscribe: %s\n", TOPIC_CMD);
  } else {
    Serial.printf("[MQTT] That bai, rc=%d. Thu lai sau 5s.\n", mqttClient.state());
  }
}

void publishTelemetry(unsigned long currentMillis) {
  if (!mqttClient.connected()) return;

  if (currentMillis - lastTelemetryPublish >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryPublish = currentMillis;

    JsonDocument doc;
    doc["device_id"] = DEVICE_ID;
    doc["gas_raw"] = globalRawADC;
    doc["gas_filtered"] = globalFilteredADC;
    doc["state"] = stateToString(currentState);
    doc["led"] = (currentState == STATE_NORMAL) ? "GREEN" :
                 (currentState == STATE_WARNING) ? "YELLOW" :
                 (currentState == STATE_DANGER) ? "RED" :
                 (currentState == STATE_RECOVERY) ? "YELLOW_BLINK" : "RED_BLINK";
    doc["buzzer"] = buzzerActive;
    doc["window"] = (currentWindowAngle == SERVO_WINDOW_OPEN) ? "OPEN" : "CLOSED";
    doc["sensor_fault"] = (currentState == STATE_FAULT);
    doc["uptime_sec"] = currentMillis / 1000;

    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_TELEMETRY, buffer);
    Serial.printf("[MQTT-UPLINK] Telemetry -> %s\n", buffer);
  }
}

void publishEvent(const char* eventType, const char* fromState, const char* toState, int filteredADC) {
  if (!mqttClient.connected()) return;

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["event"] = eventType;
  doc["from_state"] = fromState;
  doc["to_state"] = toState;
  doc["gas_filtered"] = filteredADC;
  doc["timestamp_ms"] = millis();

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_EVENT, buffer, true);
  Serial.printf("[MQTT-EVENT] %s\n", buffer);
}

void publishStatus(const char* statusStr) {
  if (!mqttClient.connected()) return;

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["status"] = statusStr;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["uptime_sec"] = millis() / 1000;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_STATUS, buffer, true);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==============================================================");
  Serial.println("  IOT-SAFETY-GASCHECK: FIRMWARE HOAN CHINH (TUAN 1 - TUAN 5)  ");
  Serial.println("  Nhom: N19  |  De tai 06  |  MQ2 -> ESP32 -> MQTT -> NodeRED ");
  Serial.println("==============================================================\n");

  pinMode(PIN_POT_GAS, INPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

#if USE_EXTERNAL_SERVO_LIB
  ESP32PWM::allocateTimer(0);
  windowServo.setPeriodHertz(50);
  windowServo.attach(PIN_SERVO, 500, 2400);
#else
  #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
    ledcAttach(PIN_SERVO, SERVO_LEDC_FREQ, SERVO_LEDC_RES);
  #else
    ledcSetup(SERVO_LEDC_CH, SERVO_LEDC_FREQ, SERVO_LEDC_RES);
    ledcAttachPin(PIN_SERVO, SERVO_LEDC_CH);
  #endif
#endif
  setWindow(SERVO_WINDOW_CLOSED);

  // Warmup ADC de tranh xung ao tren Wokwi khi khoi dong
  for (int i = 0; i < 5; i++) {
    analogRead(PIN_POT_GAS);
    delay(20);
  }
  int initVal = analogRead(PIN_POT_GAS);
  if (initVal >= 4000) initVal = 0;
  for (int i = 0; i < FILTER_WINDOW_SIZE; ++i) {
    samples[i] = initVal;
  }
  sampleSum = (long)initVal * FILTER_WINDOW_SIZE;

  // Setup Network
  WiFi.mode(WIFI_STA);
  Serial.print("[WIFI] Dang ket noi Wokwi-GUEST");
  WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS, 6);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(200);
    Serial.print(".");
    wifiAttempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Ket noi thanh cong! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Cho ket noi trong loop()...");
  }

  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  mqttClient.setCallback(mqttCallback);

  if (WiFi.status() == WL_CONNECTED) {
    reconnectMqtt();
  }

  Serial.println("[SETUP] Khoi tao phan cung va mang hoan tat.\n");
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Sampling & Filter every 100ms
  if (currentMillis - lastSampleTime >= SAMPLING_INTERVAL_MS) {
    lastSampleTime = currentMillis;
    globalRawADC = analogRead(PIN_POT_GAS);
    globalFilteredADC = updateFilter(globalRawADC);

    bool stateChanged = evaluateState(globalRawADC, globalFilteredADC, currentMillis);
    if (stateChanged) {
      const char* fromState = stateToString(previousState);
      const char* toState = stateToString(currentState);
      Serial.printf("\n>>> [CHUYEN TRANG THAI] %s -> %s | Gas: %d <<<\n\n",
                    fromState, toState, globalFilteredADC);
      publishEvent("STATE_CHANGED", fromState, toState, globalFilteredADC);
    }
  }

  // 2. Actuators
  updateActuators(currentMillis);

  // 3. Network Non-blocking maintenance
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      if (currentMillis - lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL_MS) {
        lastReconnectAttempt = currentMillis;
        reconnectMqtt();
      }
    } else {
      mqttClient.loop();
    }
  } else {
    if (currentMillis - lastReconnectAttempt >= 10000) {
      lastReconnectAttempt = currentMillis;
      WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS, 6);
    }
  }

  // 4. Telemetry publish
  publishTelemetry(currentMillis);

  // 5. Serial Log
  if (currentMillis - lastSerialPrint >= 1000) {
    lastSerialPrint = currentMillis;
    Serial.printf("[LOG] ADC: %4d | Filter: %4d | State: %-12s | Window: %-6s | Buzzer: %d | LED: %s | MQTT: %s\n",
                  globalRawADC,
                  globalFilteredADC,
                  stateToString(currentState),
                  (currentWindowAngle == SERVO_WINDOW_OPEN) ? "OPEN" : "CLOSED",
                  buzzerActive,
                  (currentState == STATE_NORMAL) ? "GREEN" :
                  (currentState == STATE_WARNING) ? "YELLOW" :
                  (currentState == STATE_DANGER) ? "RED" :
                  (currentState == STATE_RECOVERY) ? "YEL_BLINK" : "RED_BLINK",
                  mqttClient.connected() ? "CONNECTED" : "OFFLINE");
  }
}
