#pragma once

#include <Arduino.h>

// ==========================================
// 1. PIN CONFIGURATION (ESP32 DevKit V4)
// ==========================================
#define PIN_POT_GAS        34   // ADC1 Channel 6 (GPIO34 - Input Only)
#define PIN_LED_GREEN      25   // Green LED (Normal state)
#define PIN_LED_YELLOW     26   // Yellow LED (Warning / Recovery state)
#define PIN_LED_RED        27   // Red LED (Danger / Fault state)
#define PIN_BUZZER         23   // Active/Passive Buzzer output
#define PIN_SERVO          18   // PWM output for SG90 Servo

// ==========================================
// 2. THRESHOLDS & HYSTERESIS (ADC 12-bit: 0 - 4095)
// ==========================================
#define THRESHOLD_WARN_ON      1500  // ADC >= 1500 -> Transition into WARNING
#define THRESHOLD_WARN_OFF     1300  // ADC < 1300  -> Return to NORMAL (Hysteresis 200)
#define THRESHOLD_DANGER_ON    2500  // ADC >= 2500 -> Transition into DANGER
#define THRESHOLD_DANGER_OFF   2200  // ADC < 2200  -> Transition into RECOVERY (Hysteresis 300)
#define SAFE_RESET_THRESHOLD   1300  // Maximum gas level allowed to perform Reset

// Fault Detection Bounds (Heuristic ADC rail check)
#define FAULT_ADC_MIN          -1    // Set to -1 for potentiometer simulation (0 = 0% gas)
#define FAULT_ADC_MAX          5000  // Set to 5000 for potentiometer simulation

// ==========================================
// 3. ACTUATOR SETTINGS
// ==========================================
#define SERVO_WINDOW_CLOSED    0     // Degree for closed window
#define SERVO_WINDOW_OPEN      90    // Degree for open window (emergency ventilation)

// ==========================================
// 4. TIMING INTERVALS (milliseconds)
// ==========================================
#define SAMPLING_INTERVAL_MS        100   // Sensor ADC sampling period
#define TELEMETRY_INTERVAL_MS       2000  // Periodic MQTT telemetry publish
#define STATUS_HEARTBEAT_MS         30000 // Periodic MQTT status publish
#define MQTT_RECONNECT_INTERVAL_MS  5000  // Non-blocking reconnect backoff

// Moving Average Filter Size
#define FILTER_WINDOW_SIZE          10

// ==========================================
// 5. NETWORK & MQTT CONFIGURATION
// ==========================================
// Default Wi-Fi credentials (Wokwi-GUEST connects out-of-the-box on Wokwi)
#define DEFAULT_WIFI_SSID           "Wokwi-GUEST"
#define DEFAULT_WIFI_PASS           ""

// Public MQTT Broker for testing and demonstration
#define MQTT_BROKER_HOST            "broker.hivemq.com"
#define MQTT_BROKER_PORT            1883
#define DEVICE_ID                   "n19-gascheck-01"

// MQTT Topic Map
#define TOPIC_TELEMETRY             "gascheck/n19/telemetry"
#define TOPIC_EVENT                 "gascheck/n19/event"
#define TOPIC_STATUS                "gascheck/n19/status"
#define TOPIC_CMD                   "gascheck/n19/cmd"
