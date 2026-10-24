#pragma once

#include <Arduino.h>
#if __has_include(<ESP32Servo.h>)
  #include <ESP32Servo.h>
  #define USE_EXTERNAL_SERVO_LIB 1
#else
  #define USE_EXTERNAL_SERVO_LIB 0
#endif
#include "config.h"

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

class GasStateManager {
private:
  SystemState currentState;
#if USE_EXTERNAL_SERVO_LIB
  Servo windowServo;
#else
  #define SERVO_LEDC_CH   0
  #define SERVO_LEDC_FREQ 50
  #define SERVO_LEDC_RES  12
#endif

  // Filter buffer
  int samples[FILTER_WINDOW_SIZE];
  int sampleIndex;
  int sampleCount;
  long sampleSum;

  // Timers for non-blocking operations
  unsigned long lastBuzzerToggle;
  bool buzzerState;
  unsigned long lastLedToggle;
  bool ledBlinkState;
  unsigned long faultTriggerTime;
  bool faultCandidate;

  // Actuator status
  bool buzzerActive;
  int currentWindowAngle;

public:
  GasStateManager() : 
    currentState(STATE_NORMAL),
    previousState(STATE_NORMAL),
    sampleIndex(0),
    sampleCount(0),
    sampleSum(0),
    lastBuzzerToggle(0),
    buzzerState(false),
    lastLedToggle(0),
    ledBlinkState(false),
    faultTriggerTime(0),
    faultCandidate(false),
    buzzerActive(false),
    currentWindowAngle(SERVO_WINDOW_CLOSED) {}

  void init() {
    pinMode(PIN_POT_GAS, INPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_YELLOW, OUTPUT);
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);

    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_BUZZER, LOW);

    // Setup Servo
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

    // Prime filter with initial reading
    int initVal = analogRead(PIN_POT_GAS);
    for (int i = 0; i < FILTER_WINDOW_SIZE; ++i) {
      samples[i] = initVal;
    }
    sampleSum = (long)initVal * FILTER_WINDOW_SIZE;
    sampleCount = FILTER_WINDOW_SIZE;
  }

  // Update filter with new raw ADC sample
  int updateFilter(int rawADC) {
    sampleSum -= samples[sampleIndex];
    samples[sampleIndex] = rawADC;
    sampleSum += rawADC;
    sampleIndex = (sampleIndex + 1) % FILTER_WINDOW_SIZE;
    return (int)(sampleSum / FILTER_WINDOW_SIZE);
  }

  // Evaluate transitions
  bool evaluate(int rawADC, int filteredADC, unsigned long currentMillis) {
    previousState = currentState;

    // Bo qua 2 giay dau sau khi khoi dong de ADC on dinh, tranh xung ao
    if (currentMillis < 2000) {
      return false;
    }

    // 1. Check Sensor Hardware Fault Heuristics
    bool isOutOfBounds = (rawADC <= FAULT_ADC_MIN || rawADC >= FAULT_ADC_MAX);
    if (isOutOfBounds) {
      if (!faultCandidate) {
        faultCandidate = true;
        faultTriggerTime = currentMillis;
      } else if (currentMillis - faultTriggerTime > 2000) {
        // Sustained out of bounds for 2s -> FAULT
        currentState = STATE_FAULT;
      }
    } else {
      faultCandidate = false;
      if (currentState == STATE_FAULT) {
        // Recover from fault
        currentState = STATE_NORMAL;
      }
    }

    // 2. FSM Logic (if not in fault)
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
          // Emergency ventilation must open immediately
          setWindow(SERVO_WINDOW_OPEN);
          // Hysteresis exit: only leave DANGER once gas drops below 2200
          if (filteredADC < THRESHOLD_DANGER_OFF) {
            currentState = STATE_RECOVERY;
          }
          break;

        case STATE_RECOVERY:
          // Re-escalate if gas surges back to Danger
          if (filteredADC >= THRESHOLD_DANGER_ON) {
            currentState = STATE_DANGER;
          }
          // Window MUST remain open during RECOVERY until explicit ACK reset
          setWindow(SERVO_WINDOW_OPEN);
          break;

        default:
          break;
      }
    }

    // Return true if state changed
    return (currentState != previousState);
  }

  // Non-blocking actuation loop
  void updateActuators(unsigned long currentMillis) {
    // 1. LED Control
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
        // Yellow blinking 500ms
        if (currentMillis - lastLedToggle >= 500) {
          lastLedToggle = currentMillis;
          ledBlinkState = !ledBlinkState;
          digitalWrite(PIN_LED_YELLOW, ledBlinkState ? HIGH : LOW);
        }
        break;

      case STATE_FAULT:
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, LOW);
        // Red fast blinking 200ms
        if (currentMillis - lastLedToggle >= 200) {
          lastLedToggle = currentMillis;
          ledBlinkState = !ledBlinkState;
          digitalWrite(PIN_LED_RED, ledBlinkState ? HIGH : LOW);
        }
        break;
    }

    // 2. Buzzer Control
    switch (currentState) {
      case STATE_NORMAL:
        buzzerActive = false;
        digitalWrite(PIN_BUZZER, LOW);
        break;

      case STATE_WARNING:
        // Intermittent beep: 300ms ON, 700ms OFF
        if (buzzerState) {
          if (currentMillis - lastBuzzerToggle >= 300) {
            buzzerState = false;
            lastBuzzerToggle = currentMillis;
            digitalWrite(PIN_BUZZER, LOW);
          }
        } else {
          if (currentMillis - lastBuzzerToggle >= 700) {
            buzzerState = true;
            lastBuzzerToggle = currentMillis;
            digitalWrite(PIN_BUZZER, HIGH);
          }
        }
        buzzerActive = buzzerState;
        break;

      case STATE_DANGER:
        buzzerActive = true;
        digitalWrite(PIN_BUZZER, HIGH); // Continuous alarm
        break;

      case STATE_RECOVERY:
        // Periodic short chirp: 100ms ON, 1900ms OFF
        if (buzzerState) {
          if (currentMillis - lastBuzzerToggle >= 100) {
            buzzerState = false;
            lastBuzzerToggle = currentMillis;
            digitalWrite(PIN_BUZZER, LOW);
          }
        } else {
          if (currentMillis - lastBuzzerToggle >= 1900) {
            buzzerState = true;
            lastBuzzerToggle = currentMillis;
            digitalWrite(PIN_BUZZER, HIGH);
          }
        }
        buzzerActive = buzzerState;
        break;

      case STATE_FAULT:
        // Fast fault pattern: 100ms ON, 400ms OFF
        if (buzzerState) {
          if (currentMillis - lastBuzzerToggle >= 100) {
            buzzerState = false;
            lastBuzzerToggle = currentMillis;
            digitalWrite(PIN_BUZZER, LOW);
          }
        } else {
          if (currentMillis - lastBuzzerToggle >= 400) {
            buzzerState = true;
            lastBuzzerToggle = currentMillis;
            digitalWrite(PIN_BUZZER, HIGH);
          }
        }
        buzzerActive = buzzerState;
        break;
    }

    // 3. Servo Window Control
    if (currentState == STATE_NORMAL) {
      setWindow(SERVO_WINDOW_CLOSED);
    } else if (currentState == STATE_DANGER || currentState == STATE_RECOVERY) {
      setWindow(SERVO_WINDOW_OPEN);
    }
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

  // Safety Interlock: Attempt to reset system back to NORMAL
  // Returns: true if successfully reset, false if denied due to safety interlock
  bool attemptReset(int filteredADC) {
    // Can ONLY reset if currently in RECOVERY or FAULT and gas is below SAFE threshold
    if ((currentState == STATE_RECOVERY || currentState == STATE_FAULT) && 
        filteredADC < SAFE_RESET_THRESHOLD) {
      currentState = STATE_NORMAL;
      setWindow(SERVO_WINDOW_CLOSED);
      return true;
    }
    // Rejected: gas is still hazardous or state is DANGER
    return false;
  }

  // Getters
  SystemState getState() const { return currentState; }
  SystemState getPreviousState() const { return previousState; }
  bool isBuzzerActive() const { return buzzerActive; }
  const char* getWindowStatus() const { return (currentWindowAngle == SERVO_WINDOW_OPEN) ? "OPEN" : "CLOSED"; }
  const char* getLedColor() const {
    switch (currentState) {
      case STATE_NORMAL:   return "GREEN";
      case STATE_WARNING:  return "YELLOW";
      case STATE_DANGER:   return "RED";
      case STATE_RECOVERY: return "YELLOW_BLINK";
      case STATE_FAULT:    return "RED_BLINK";
      default:             return "UNKNOWN";
    }
  }
};
