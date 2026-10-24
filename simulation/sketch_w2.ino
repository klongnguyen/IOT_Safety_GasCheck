/*
 * ==============================================================================================
 *  DỰ ÁN: IOT-SAFETY-GASCHECK (NHÓM N19 - ĐỀ TÀI 06 - SAFETY)
 *  Tuần 2: Prototype Simulation Tầng 1 (Sensing/Physical) trên Wokwi
 *  Cơ cấu: MQ2 (Potentiometer) -> ESP32 -> 3 LED + Buzzer + Servo mở cửa sổ mini sa bàn
 *
 *  LƯU Ý KHẮC PHỤC LỖI "ESP32Servo.h: No such file or directory":
 *  - Cách 1 (Chuẩn Wokwi): Bấm vào tab "Library Manager" (bên cạnh tab diagram.json),
 *                          gõ tìm "ESP32Servo" rồi bấm thêm vào.
 *  - Cách 2: Code đã tích hợp sẵn cơ chế Auto-Fallback sang Hardware PWM (LEDC) của ESP32.
 *            Nếu bạn không cài thư viện, code vẫn BIÊN DỊCH VÀ CHẠY 100% THÀNH CÔNG!
 *
 *  CHÚ Ý VỀ CƠ CẤU CHẤP HÀNH (ĐÃ THỐNG NHẤT V2):
 *  - Đồ án KHÔNG DÙNG VAN GAS, KHÔNG DÙNG QUẠT THÔNG GIÓ, KHÔNG DÙNG RELAY.
 *  - Cơ cấu Servo SG90 duy nhất dùng để: MÔ PHỎNG MỞ CỬA SỔ SA BÀN (0° Đóng, 90° Mở).
 * ==============================================================================================
 */

#include <Arduino.h>

// Kiểm tra sự tồn tại của thư viện ESP32Servo
#if __has_include(<ESP32Servo.h>)
  #include <ESP32Servo.h>
  #define USE_EXTERNAL_SERVO_LIB 1
#else
  #define USE_EXTERNAL_SERVO_LIB 0
#endif

// ==========================================
// 1. ĐỊNH NGHĨA CHÂN GPIO (ESP32 DevKit V4)
// ==========================================
#define PIN_POT_GAS    34   // ADC1 - Đọc analog từ biến trở (giả lập MQ2)
#define PIN_LED_GREEN  25   // LED Xanh - NORMAL
#define PIN_LED_YELLOW 26   // LED Vàng - WARNING
#define PIN_LED_RED    27   // LED Đỏ - DANGER
#define PIN_BUZZER     23   // Buzzer cảnh báo
#define PIN_SERVO      18   // Servo SG90 điều khiển mở cửa sổ mini

// ==========================================
// 2. NGƯỠNG KIỂM THỬ TUẦN 2 (ADC 12-bit: 0 - 4095)
// ==========================================
#define THRESHOLD_WARNING 1500
#define THRESHOLD_DANGER  2500

// Quy ước góc Servo mở cửa sổ sa bàn (KHÔNG PHẢI VAN GAS)
#define SERVO_WINDOW_CLOSED 0    // 0°: Cửa sổ đóng
#define SERVO_WINDOW_OPEN   90   // 90°: Cửa sổ mở thông thoáng

// ==========================================
// 3. ĐIỀU KHIỂN SERVO THÍCH ỨNG
// ==========================================
#if USE_EXTERNAL_SERVO_LIB
  Servo windowServo;
  void initWindowServo() {
    ESP32PWM::allocateTimer(0);
    windowServo.setPeriodHertz(50);
    windowServo.attach(PIN_SERVO, 500, 2400);
    windowServo.write(SERVO_WINDOW_CLOSED);
    Serial.println("[SERVO] Khoi tao bang thu vien ESP32Servo thanh cong.");
  }
  void setWindowAngle(int angle) {
    windowServo.write(angle);
  }
#else
  // Fallback: Điều khiển PWM phần cứng (LEDC) không cần bất kỳ thư viện ngoài nào
  #define SERVO_PWM_CH   0
  #define SERVO_PWM_FREQ 50
  #define SERVO_PWM_RES  12  // 12-bit (0 - 4095)

  void initWindowServo() {
    #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      ledcAttach(PIN_SERVO, SERVO_PWM_FREQ, SERVO_PWM_RES);
    #else
      ledcSetup(SERVO_PWM_CH, SERVO_PWM_FREQ, SERVO_PWM_RES);
      ledcAttachPin(PIN_SERVO, SERVO_PWM_CH);
    #endif
    // Đóng cửa sổ ban đầu (0 độ)
    int pulseUs = map(SERVO_WINDOW_CLOSED, 0, 180, 500, 2400);
    int duty = (pulseUs * 4095) / 20000;
    #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      ledcWrite(PIN_SERVO, duty);
    #else
      ledcWrite(SERVO_PWM_CH, duty);
    #endif
    Serial.println("[SERVO] Khoi tao bang LEDC PWM phan cung (Khong can thu vien ngoai) thanh cong.");
  }

  void setWindowAngle(int angle) {
    int pulseUs = map(angle, 0, 180, 500, 2400);
    int duty = (pulseUs * 4095) / 20000;
    #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      ledcWrite(PIN_SERVO, duty);
    #else
      ledcWrite(SERVO_PWM_CH, duty);
    #endif
  }
#endif

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==============================================================");
  Serial.println("  IOT-SAFETY-GASCHECK: PROTOTYPE TUAN 2 (V2 HIEN HANH)        ");
  Serial.println("  Co cau: MQ2 -> ESP32 -> 3 LED + Buzzer + Servo Cua So Mini ");
  Serial.println("  (KHONG VAN GAS - KHONG QUAT - KHONG RELAY)                 ");
  Serial.println("==============================================================");

  // Cấu hình chân vào/ra
  pinMode(PIN_POT_GAS, INPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Khởi tạo trạng thái ban đầu cho LED và Buzzer
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Khởi tạo Servo cửa sổ sa bàn
  initWindowServo();

  Serial.println("[SETUP] Khoi tao hoan tat. Bat dau giam sat cam bien...\n");
}

// Biến đếm thời gian in log (không dùng delay nghẽn vi điều khiển)
unsigned long lastLogTime = 0;
int lastPrintedState = -1;

void loop() {
  unsigned long currentMillis = millis();

  // 1. Đọc giá trị ADC từ cảm biến gas giả lập (0 - 4095)
  int rawADC = analogRead(PIN_POT_GAS);
  int percent = map(rawADC, 0, 4095, 0, 100);

  // Xác định trạng thái hiện tại (0: NORMAL, 1: WARNING, 2: DANGER)
  int currentState = 0;
  if (rawADC >= THRESHOLD_DANGER) {
    currentState = 2; // DANGER
  } else if (rawADC >= THRESHOLD_WARNING) {
    currentState = 1; // WARNING
  } else {
    currentState = 0; // NORMAL
  }

  // 2. Phân loại trạng thái và điều khiển Actuator CỤC BỘ (Tức thời không trễ)
  if (currentState == 0) {
    // NORMAL: An toàn (< 1500)
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    noTone(PIN_BUZZER); // Tắt âm thanh
    setWindowAngle(SERVO_WINDOW_CLOSED);
  } 
  else if (currentState == 1) {
    // WARNING: Cảnh báo sớm (1500 - 2499)
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
    
    // Buzzer kêu ngắt quãng (nhịp 300ms kêu / 700ms nghỉ)
    if ((currentMillis / 300) % 3 == 0) {
      digitalWrite(PIN_BUZZER, HIGH);
      tone(PIN_BUZZER, 1500); // Phát âm tần số 1500Hz
    } else {
      digitalWrite(PIN_BUZZER, LOW);
      noTone(PIN_BUZZER);
    }
    setWindowAngle(SERVO_WINDOW_CLOSED);
  } 
  else {
    // DANGER: Nguy cấp (>= 2500)
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_BUZZER, HIGH);
    tone(PIN_BUZZER, 2500); // Còi hú báo động liên tục tần số 2500Hz
    setWindowAngle(SERVO_WINDOW_OPEN); // Mở cửa sổ 90 độ
  }

  // 3. In log ra Serial Monitor:
  // - Định kỳ mỗi 1000ms (1 giây/lần) để màn hình êm ái, dễ đọc
  // - HOẶC in NGAY LẬP TỨC khi có sự thay đổi trạng thái (Xanh -> Vàng -> Đỏ)
  if (currentMillis - lastLogTime >= 1000 || currentState != lastPrintedState) {
    lastLogTime = currentMillis;
    lastPrintedState = currentState;

    if (currentState == 0) {
      Serial.printf("[NORMAL] Gas: %4d (%2d%%) | LED: XANH | Còi: OFF | Cửa sổ: ĐÓNG (0°) -> Kéo núm sang phải để tăng gas!\n",
                    rawADC, percent);
    } else if (currentState == 1) {
      Serial.printf("[WARNING] Gas: %4d (%2d%%) | LED: VÀNG | Còi: BEEP | Cửa sổ: ĐÓNG -> Kéo tiếp qua 61%% (>2500) để vào DANGER!\n",
                    rawADC, percent);
    } else {
      Serial.printf("[DANGER!] Gas: %4d (%2d%%) | LED: ĐỎ | Còi: LIÊN TỤC | CỬA SỔ: MỞ (90°) [BÁO ĐỘNG KHẨN CẤP!]\n",
                    rawADC, percent);
    }
  }

  delay(50); // Chu kỳ lấy mẫu 50ms rất nhạy
}

