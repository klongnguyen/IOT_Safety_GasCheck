#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "state_machine.h"

class MqttNetworkManager {
private:
  WiFiClient espClient;
  PubSubClient client;
  GasStateManager& stateMgr;

  unsigned long lastReconnectAttempt;
  unsigned long lastTelemetryPublish;
  unsigned long lastStatusHeartbeat;
  bool isTestAlarmRunning;
  unsigned long testAlarmStartTime;

public:
  MqttNetworkManager(GasStateManager& sm) : 
    client(espClient),
    stateMgr(sm),
    lastReconnectAttempt(0),
    lastTelemetryPublish(0),
    lastStatusHeartbeat(0),
    isTestAlarmRunning(false),
    testAlarmStartTime(0) {}

  void init() {
    Serial.println("\n[NETWORK] Khoi tao ket noi Wi-Fi va MQTT...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);

    client.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    // Callback must be bound via static or lambda wrapper in main
  }

  void setCallback(MQTT_CALLBACK_SIGNATURE) {
    client.setCallback(callback);
  }

  // Non-blocking loop for maintaining Wi-Fi and MQTT connection
  void loop(unsigned long currentMillis, int filteredADC) {
    // 1. Check Wi-Fi Status
    if (WiFi.status() != WL_CONNECTED) {
      if (currentMillis - lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL_MS) {
        lastReconnectAttempt = currentMillis;
        Serial.printf("[WIFI] Dang ket noi Wi-Fi '%s'...\n", DEFAULT_WIFI_SSID);
        WiFi.reconnect();
      }
      return; // Do not attempt MQTT if Wi-Fi is not connected
    }

    // 2. Check MQTT Status
    if (!client.connected()) {
      if (currentMillis - lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL_MS) {
        lastReconnectAttempt = currentMillis;
        reconnectMqtt();
      }
    } else {
      client.loop(); // Process incoming MQTT packets
    }

    // 3. Handle temporary Test Alarm timeout
    if (isTestAlarmRunning) {
      if (currentMillis - testAlarmStartTime >= 2000) {
        isTestAlarmRunning = false;
        digitalWrite(PIN_BUZZER, LOW);
        Serial.println("[COMMAND] Test Alarm ket thuc sau 2s.");
      } else {
        digitalWrite(PIN_BUZZER, HIGH);
      }
    }
  }

  void reconnectMqtt() {
    Serial.printf("[MQTT] Dang ket noi toi Broker %s:%d...\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    
    // LWT Payload
    const char* lwtTopic = TOPIC_STATUS;
    const char* lwtPayload = "{\"device_id\":\"" DEVICE_ID "\",\"status\":\"offline\"}";
    
    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), lwtTopic, 1, true, lwtPayload)) {
      Serial.println("[MQTT] Ket noi thanh cong! Client ID: " + clientId);

      // Publish Online Status
      publishStatus("online");

      // Subscribe to command topic
      client.subscribe(TOPIC_CMD);
      Serial.printf("[MQTT] Da subscribe topic dieu khien: %s\n", TOPIC_CMD);
    } else {
      Serial.printf("[MQTT] Ket noi that bai, rc=%d. Se thu lai sau 5s.\n", client.state());
    }
  }

  // Publish periodic telemetry
  void publishTelemetry(int rawADC, int filteredADC, unsigned long currentMillis) {
    if (!client.connected()) return;

    if (currentMillis - lastTelemetryPublish >= TELEMETRY_INTERVAL_MS) {
      lastTelemetryPublish = currentMillis;

      JsonDocument doc;
      doc["device_id"] = DEVICE_ID;
      doc["gas_raw"] = rawADC;
      doc["gas_filtered"] = filteredADC;
      doc["state"] = stateToString(stateMgr.getState());
      doc["led"] = stateMgr.getLedColor();
      doc["buzzer"] = stateMgr.isBuzzerActive();
      doc["window"] = stateMgr.getWindowStatus();
      doc["sensor_fault"] = (stateMgr.getState() == STATE_FAULT);
      doc["uptime_sec"] = currentMillis / 1000;

      char buffer[256];
      serializeJson(doc, buffer);
      client.publish(TOPIC_TELEMETRY, buffer);
      
      // Also log locally to Serial
      Serial.printf("[MQTT-UPLINK] Telemetry -> %s\n", buffer);
    }
  }

  // Publish state change event immediately
  void publishEvent(const char* eventType, const char* fromState, const char* toState, int filteredADC) {
    if (!client.connected()) return;

    JsonDocument doc;
    doc["device_id"] = DEVICE_ID;
    doc["event"] = eventType;
    doc["from_state"] = fromState;
    doc["to_state"] = toState;
    doc["gas_filtered"] = filteredADC;
    doc["timestamp_ms"] = millis();

    char buffer[256];
    serializeJson(doc, buffer);
    client.publish(TOPIC_EVENT, buffer, true); // Retain alert event if needed
    Serial.printf("[MQTT-EVENT] Event -> %s\n", buffer);
  }

  // Publish device lifecycle status
  void publishStatus(const char* statusStr) {
    if (!client.connected()) return;

    JsonDocument doc;
    doc["device_id"] = DEVICE_ID;
    doc["status"] = statusStr;
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["uptime_sec"] = millis() / 1000;

    char buffer[256];
    serializeJson(doc, buffer);
    client.publish(TOPIC_STATUS, buffer, true);
  }

  // Process incoming downlink command from Node-RED or MQTTX
  void handleCommand(char* topic, byte* payload, unsigned int length, int currentGas) {
    Serial.printf("[MQTT-DOWNLINK] Nhan lenh tu topic: %s (do dai: %u bytes)\n", topic, length);
    
    char jsonStr[length + 1];
    memcpy(jsonStr, payload, length);
    jsonStr[length] = '\0';
    Serial.printf("[MQTT-DOWNLINK] Noi dung raw: %s\n", jsonStr);

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, jsonStr);
    if (error) {
      Serial.printf("[MQTT-DOWNLINK] Loi parse JSON: %s\n", error.c_str());
      return;
    }

    const char* cmd = doc["cmd"] | "";

    // 1. Command: REQUEST_RESET
    if (strcmp(cmd, "REQUEST_RESET") == 0) {
      Serial.println("[SAFETY-INTERLOCK] Dang kiem tra dieu kien an toan de RESET...");
      bool resetOk = stateMgr.attemptReset(currentGas);

      JsonDocument resp;
      resp["device_id"] = DEVICE_ID;
      resp["command"] = "REQUEST_RESET";

      if (resetOk) {
        resp["result"] = "ACCEPTED";
        resp["message"] = "He thong an toan, da reset ve NORMAL va dong cua so.";
        resp["state"] = "NORMAL";
        Serial.println("[SAFETY-INTERLOCK] => DONG Y: Reset thanh cong!");
      } else {
        resp["result"] = "REJECTED";
        resp["message"] = "TU CHOI RESET: Nong do gas van cao hoac he thong dang DANGER!";
        resp["current_gas"] = currentGas;
        resp["safe_limit"] = SAFE_RESET_THRESHOLD;
        resp["state"] = stateToString(stateMgr.getState());
        Serial.println("[SAFETY-INTERLOCK] => TU CHOI: Gas van nguy hiem, khoa reset an toan!");
      }

      char respBuf[256];
      serializeJson(resp, respBuf);
      client.publish(TOPIC_EVENT, respBuf);
    }
    // 2. Command: TEST_ALARM
    else if (strcmp(cmd, "TEST_ALARM") == 0) {
      Serial.println("[COMMAND] Kich hoat TEST ALARM trong 2 giay...");
      isTestAlarmRunning = true;
      testAlarmStartTime = millis();

      JsonDocument resp;
      resp["device_id"] = DEVICE_ID;
      resp["command"] = "TEST_ALARM";
      resp["result"] = "EXECUTING";
      resp["duration_ms"] = 2000;
      char respBuf[160];
      serializeJson(resp, respBuf);
      client.publish(TOPIC_EVENT, respBuf);
    }
    // 3. Command: PING
    else if (strcmp(cmd, "PING") == 0) {
      JsonDocument resp;
      resp["device_id"] = DEVICE_ID;
      resp["response"] = "PONG";
      resp["uptime_sec"] = millis() / 1000;
      char respBuf[128];
      serializeJson(resp, respBuf);
      client.publish(TOPIC_EVENT, respBuf);
    } else {
      Serial.printf("[COMMAND] Lenh khong xac dinh: '%s'\n", cmd);
    }
  }

  bool isConnected() { return client.connected(); }
};
