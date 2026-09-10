# IOT-Safety-GasCheck

## Kế hoạch thực hiện đề tài: Cảnh báo rò rỉ Gas & chất lượng không khí

> **Nhóm:** N19  
> **Thành viên:** Trình Quốc An – Nguyễn Kim Long – Nguyễn Long Vỹ  
> **Mã đề tài:** 06  
> **Nhóm ứng dụng:** Safety  
> **Thời gian:** 10 tuần × tối thiểu 6 giờ/tuần/SV = tối thiểu 60 giờ/SV  
> **Mục tiêu bắt buộc:** Simulation hoạt động + đủ kiến trúc IoT 4 tầng + có uplink/downlink + automation + application/remote integration.

---

# 1. Tổng quan đề tài

## 1.1. Bài toán cần giải quyết

Đề tài xây dựng một hệ thống IoT có khả năng:

- Giám sát mức khí gas/khói trong môi trường.
- Theo dõi một chỉ số đại diện cho chất lượng không khí.
- Tự động phát hiện trạng thái bất thường dựa trên ngưỡng cảm biến.
- Tự động thực hiện các biện pháp an toàn khi phát hiện nguy hiểm:
  - đóng van gas mô phỏng;
  - bật quạt thông gió;
  - kích hoạt còi cảnh báo.
- Gửi dữ liệu và trạng thái hệ thống lên middleware thông qua MQTT.
- Hiển thị trạng thái trên dashboard/application.
- Gửi cảnh báo từ xa khi xảy ra sự cố.
- Cho phép người dùng gửi lệnh điều khiển từ Application xuống thiết bị.
- Ghi nhận dữ liệu, sự kiện và trạng thái để phục vụ kiểm thử và demo.

## 1.2. Định hướng sản phẩm cuối

Sản phẩm cuối không chỉ là một mạch đọc cảm biến mà phải là một hệ thống IoT hoàn chỉnh:

```text
Sensor/Input
    ↓
ESP32
    ↓
Wi-Fi / MQTT
    ↓
MQTT Broker
    ↓
Node-RED / Automation Engine
    ↓
Dashboard / Telegram / Application
    ↓
MQTT Command
    ↓
ESP32
    ↓
Actuator
```

Hệ thống phải chứng minh được hai chiều:

```text
UPLINK:
Sensor → ESP32 → MQTT → Middleware → Application

DOWNLINK:
Application → Middleware → MQTT → ESP32 → Actuator
```

---

# 2. Mục tiêu thực hiện

## 2.1. Mục tiêu bắt buộc

Nhóm phải hoàn thành các mục tiêu sau:

1. Có **simulation hoạt động**.
2. Có ít nhất:
   - 01 sensor/input;
   - 01 actuator/output.
3. Thể hiện đủ kiến trúc IoT 4 tầng:
   - Tầng 1 – Sensing / Physical;
   - Tầng 2 – Network / Connectivity;
   - Tầng 3 – Middleware;
   - Tầng 4 – Application.
4. Có ít nhất một luồng **uplink**.
5. Có ít nhất một luồng **downlink/remote interaction**.
6. Có logic automation thay vì chỉ bật/tắt thủ công.
7. Có dashboard/application hoặc chức năng tích hợp từ xa.
8. Có kịch bản demo bình thường và kịch bản cảnh báo.
9. Có đầy đủ source code, sơ đồ, flow, MQTT topics, test report, video và báo cáo.

## 2.2. Mục tiêu chất lượng

Hệ thống nên đạt các tiêu chí:

- Chạy ổn định và có thể demo lặp lại.
- Logic xử lý rõ ràng.
- Không hard-code một kịch bản duy nhất.
- Không thay đổi trạng thái liên tục khi giá trị cảm biến dao động gần ngưỡng.
- Có xử lý mất kết nối MQTT cơ bản.
- Có phản hồi khi lệnh điều khiển không hợp lệ.
- Mỗi thành viên có thể giải thích toàn bộ luồng end-to-end.

---

# 3. Phạm vi hệ thống

## 3.1. Phạm vi bắt buộc

### Sensor/Input

- MQ2 – đại diện cho mức khí gas/khói.
- MQ135 – đại diện cho chất lượng không khí.

Nếu simulator không hỗ trợ đầy đủ một cảm biến, có thể dùng input analog tương đương hoặc phương án Hybrid, nhưng phải giải thích rõ trong báo cáo.

### Actuator/Output

- Servo – mô phỏng van gas.
- Fan/DC Motor – mô phỏng quạt thông gió.
- Buzzer – cảnh báo tại chỗ.
- LED trạng thái – tùy chọn nhưng nên có để dễ demo.

### Network

- ESP32.
- Wi-Fi.
- MQTT.

### Middleware

- MQTT Broker.
- Node-RED hoặc automation engine tương đương.

### Application

Khuyến nghị sử dụng:

- Node-RED Dashboard để giám sát/điều khiển.
- Telegram Bot để gửi cảnh báo khẩn.

Có thể thay thế bằng Home Assistant, Blynk hoặc nền tảng tương đương.

## 3.2. Ngoài phạm vi bắt buộc

Các phần sau chỉ nên thực hiện sau khi hệ thống chính đã ổn định:

- Prototype phần cứng thật.
- Database lớn.
- AI/ML.
- Mobile App riêng.
- Web App riêng với backend phức tạp.
- Authentication nhiều cấp.
- Cloud deployment phức tạp.

Mục tiêu ưu tiên là hoàn thiện chắc chắn **Simulation + 4 Layer + Automation + E2E** trước.

---

# 4. Kiến trúc IoT 4 tầng

## 4.1. Tầng 1 – Sensing / Physical

### Thành phần

| Thành phần   | Vai trò                         |
| ------------ | ------------------------------- |
| ESP32        | Vi điều khiển trung tâm         |
| MQ2          | Đọc tín hiệu gas/khói           |
| MQ135        | Đọc chỉ số chất lượng không khí |
| Servo        | Mô phỏng van gas                |
| Fan/DC Motor | Mô phỏng quạt                   |
| Buzzer       | Cảnh báo âm thanh               |
| LED          | Hiển thị trạng thái cục bộ      |

### Trách nhiệm của tầng

- Đọc dữ liệu sensor.
- Lọc dữ liệu.
- Xác định trạng thái cơ bản.
- Điều khiển actuator.
- Publish telemetry.
- Nhận MQTT command.
- Thực hiện command nếu hợp lệ.

---

## 4.2. Tầng 2 – Network / Connectivity

### Công nghệ đề xuất

```text
ESP32
  ↓ Wi-Fi
MQTT Broker
```

### Trách nhiệm

- Kết nối ESP32 với Wi-Fi.
- Kết nối MQTT Broker.
- Publish dữ liệu cảm biến.
- Publish trạng thái thiết bị.
- Publish event cảnh báo.
- Subscribe command.
- Tự reconnect khi MQTT bị mất kết nối.

---

## 4.3. Tầng 3 – Middleware / Automation

### Công nghệ

- MQTT Broker.
- Node-RED.

### Trách nhiệm

Node-RED không chỉ forward dữ liệu mà phải xử lý:

- Parse JSON.
- Validate payload.
- Theo dõi trạng thái thiết bị.
- Áp dụng rule/threshold.
- Nhận event.
- Ghi log.
- Gửi cảnh báo.
- Gửi command xuống ESP32.
- Kết nối Application.

---

## 4.4. Tầng 4 – Application

### Chức năng đề xuất

Dashboard:

- Gas Gauge.
- Air Quality Gauge.
- System State.
- Valve State.
- Fan State.
- Buzzer State.
- Gas History Chart.
- Air Quality History Chart.
- Emergency Close.
- Reset.
- Cấu hình threshold nếu kịp triển khai.

Telegram:

- Warning alert.
- Danger alert.
- Recovery alert.
- Thông báo trạng thái hệ thống.

---

# 5. Thiết kế luồng dữ liệu End-to-End

## 5.1. Uplink telemetry

```text
MQ2 / MQ135
     ↓
   ESP32
     ↓
Đọc + Filter
     ↓
JSON Telemetry
     ↓
MQTT Publish
     ↓
MQTT Broker
     ↓
Node-RED
     ↓
Dashboard / Logging
```

## 5.2. Uplink cảnh báo

```text
Gas vượt ngưỡng
      ↓
ESP32 / Node-RED phát hiện
      ↓
Event = GAS_LEAK
      ↓
MQTT
      ↓
Node-RED
      ↓
Telegram Alert
```

## 5.3. Downlink điều khiển

```text
Dashboard
    ↓
Người dùng nhấn Command
    ↓
Node-RED
    ↓
MQTT Publish
    ↓
ESP32 Subscribe
    ↓
Kiểm tra điều kiện an toàn
    ↓
Actuator
```

---

# 6. Thiết kế phần cứng mô phỏng

## 6.1. Danh sách linh kiện

| STT | Thiết bị                         | Số lượng | Bắt buộc    |
| --- | -------------------------------- | -------: | ----------- |
| 1   | ESP32                            |        1 | Có          |
| 2   | MQ2                              |        1 | Có          |
| 3   | MQ135 hoặc analog input thay thế |        1 | Có          |
| 4   | Servo                            |        1 | Có          |
| 5   | Fan/DC Motor mô phỏng            |        1 | Có          |
| 6   | Buzzer                           |        1 | Có          |
| 7   | LED xanh                         |        1 | Khuyến nghị |
| 8   | LED vàng                         |        1 | Khuyến nghị |
| 9   | LED đỏ                           |        1 | Khuyến nghị |

## 6.2. Quy ước actuator

### Servo van gas

```text
OPEN   → van đang mở
CLOSED → van đã đóng
```

Servo chỉ đại diện cho trạng thái cơ khí, không cần mô phỏng van gas thật.

### Fan

```text
OFF → môi trường bình thường
ON  → hệ thống đang thông gió
```

### Buzzer

```text
OFF → không có cảnh báo khẩn
ON  → Danger
```

---

# 7. Thiết kế Firmware ESP32

## 7.1. Cấu trúc module

Không viết toàn bộ logic vào một `loop()` lớn.

Đề xuất:

```text
main.cpp
│
├── setupPins()
├── setupSensors()
├── setupActuators()
├── connectWiFi()
├── connectMQTT()
│
├── readSensors()
├── filterSensorData()
├── evaluateSafetyState()
├── controlActuators()
├── publishTelemetry()
├── publishEvent()
├── processMQTTCommand()
└── handleReconnect()
```

Nếu muốn tổ chức tốt hơn:

```text
src/
├── main.cpp
├── config.h
├── sensors.cpp
├── sensors.h
├── actuators.cpp
├── actuators.h
├── mqtt_manager.cpp
├── mqtt_manager.h
├── safety_controller.cpp
└── safety_controller.h
```

## 7.2. Chu kỳ xử lý chính

```text
START
  ↓
Connect Wi-Fi
  ↓
Connect MQTT
  ↓
Read Sensor
  ↓
Filter
  ↓
Evaluate State
  ↓
Control Actuator
  ↓
Publish Telemetry
  ↓
Handle MQTT Command
  ↓
Repeat
```

## 7.3. Cấu hình hệ thống

Đề xuất gom các thông số vào `config.h`:

```cpp
#define GAS_WARNING_THRESHOLD ...
#define GAS_DANGER_THRESHOLD ...
#define AIR_WARNING_THRESHOLD ...
#define RECOVERY_THRESHOLD ...
#define RECOVERY_TIME_MS ...
#define TELEMETRY_INTERVAL_MS ...
```

Không nên rải các magic number trong source code.

---

# 8. Phương pháp xử lý dữ liệu cảm biến

## 8.1. Đọc nhiều mẫu

Không nên lấy một lần `analogRead()` rồi quyết định ngay.

Đề xuất:

```text
Sensor
  ↓
5–10 Samples
  ↓
Moving Average
  ↓
Filtered Value
  ↓
Automation Logic
```

Ví dụ:

```cpp
filteredGas = (
    sample1 +
    sample2 +
    sample3 +
    sample4 +
    sample5
) / 5;
```

## 8.2. Hysteresis

Mục tiêu là tránh trạng thái nhảy liên tục tại ngưỡng.

Ví dụ:

```text
Gas > 2000
→ DANGER

Gas phải giảm xuống < 1700
→ mới cho phép RECOVERY
```

Không nên:

```text
> 2000 → Danger
< 2000 → Normal
```

vì sensor dao động gần 2000 sẽ gây bật/tắt liên tục.

## 8.3. Calibration

Trong Simulation, nhóm cần:

1. Xác định khoảng giá trị sensor.
2. Chọn các mức:
   - Normal.
   - Warning.
   - Danger.
3. Ghi threshold vào bảng test.
4. Không tuyên bố các giá trị simulation là ppm thực tế nếu chưa có calibration phần cứng thật.

---

# 9. State Machine cho hệ thống an toàn

## 9.1. Các trạng thái

Đề xuất sử dụng 5 trạng thái:

```text
NORMAL
WARNING
DANGER
RECOVERY
READY
```

## 9.2. Ý nghĩa

### NORMAL

Điều kiện:

- Gas an toàn.
- Air Quality bình thường.

Hành động:

```text
Valve  = OPEN
Fan    = OFF
Buzzer = OFF
LED    = GREEN
```

### WARNING

Điều kiện:

- Air Quality xấu; hoặc
- Gas tăng nhưng chưa tới mức nguy hiểm.

Hành động:

```text
Valve  = OPEN
Fan    = ON
Buzzer = OFF
LED    = YELLOW
```

Có thể gửi cảnh báo mức Warning.

### DANGER

Điều kiện:

- Gas vượt ngưỡng nguy hiểm.

Hành động:

```text
Valve  = CLOSED
Fan    = ON
Buzzer = ON
LED    = RED
```

Đồng thời:

- Publish event.
- Cập nhật dashboard.
- Gửi Telegram khẩn.

### RECOVERY

Điều kiện:

- Gas đã giảm xuống dưới recovery threshold.

Hành động:

```text
Valve  = CLOSED
Fan    = ON
Buzzer = OFF
```

Hệ thống phải tiếp tục kiểm tra trong một khoảng thời gian ổn định.

### READY

Điều kiện:

- Giá trị đã an toàn liên tục trong thời gian recovery.

Hành động:

```text
Valve = CLOSED
Fan   = OFF
```

Chờ người dùng Reset/Confirm trước khi trở lại NORMAL.

## 9.3. Sơ đồ chuyển trạng thái

```text
              Gas tăng
NORMAL ───────────────────► WARNING
   │                           │
   │ Gas nguy hiểm             │ Gas nguy hiểm
   └───────────────┐           │
                   ▼           ▼
                    DANGER
                       │
                       │ Gas giảm dưới recovery threshold
                       ▼
                    RECOVERY
                       │
                       │ Safe liên tục đủ thời gian
                       ▼
                     READY
                       │
                       │ User RESET
                       ▼
                     NORMAL
```

## 9.4. Nguyên tắc an toàn

Sau sự cố gas:

**Không tự động mở lại van ngay khi sensor vừa giảm.**

Van chỉ mở trở lại khi:

1. Hệ thống đã về trạng thái READY.
2. Người dùng gửi Reset/Confirm.
3. Giá trị cảm biến vẫn nằm trong vùng an toàn.

---

# 10. Thiết kế Automation Rules

Ít nhất phải có 2 automation rules và 1 abnormal scenario theo kế hoạch W7.

## Rule 01 – Air Quality Warning

```text
IF airQuality >= AIR_WARNING_THRESHOLD
THEN
    state = WARNING
    fan = ON
    send warning
```

## Rule 02 – Gas Emergency

```text
IF gas >= GAS_DANGER_THRESHOLD
THEN
    state = DANGER
    valve = CLOSED
    fan = ON
    buzzer = ON
    publish emergency event
    send Telegram alert
```

## Rule 03 – Recovery

```text
IF state == DANGER
AND gas <= RECOVERY_THRESHOLD
THEN
    state = RECOVERY
```

## Rule 04 – Safe Recovery Timer

```text
IF state == RECOVERY
AND sensor remains safe for N seconds
THEN
    state = READY
```

## Rule 05 – Command Safety Interlock

```text
IF command == OPEN_VALVE
AND state != NORMAL
THEN
    reject command
```

---

# 11. Thiết kế MQTT

## 11.1. Quy ước topic

Đề xuất prefix:

```text
gascheck/device01/
```

### Uplink topics

| Topic                            | Hướng          | Nội dung                |
| -------------------------------- | -------------- | ----------------------- |
| `gascheck/device01/telemetry`    | ESP32 → Broker | Sensor telemetry        |
| `gascheck/device01/status`       | ESP32 → Broker | Device status           |
| `gascheck/device01/event`        | ESP32 → Broker | Warning/Danger/Recovery |
| `gascheck/device01/availability` | ESP32 → Broker | Online/Offline          |

### Downlink topics

| Topic                          | Hướng       | Nội dung         |
| ------------------------------ | ----------- | ---------------- |
| `gascheck/device01/cmd/fan`    | App → ESP32 | Fan command      |
| `gascheck/device01/cmd/valve`  | App → ESP32 | Valve command    |
| `gascheck/device01/cmd/buzzer` | App → ESP32 | Buzzer command   |
| `gascheck/device01/cmd/reset`  | App → ESP32 | Reset            |
| `gascheck/device01/config`     | App → ESP32 | Threshold/config |

## 11.2. Telemetry payload

```json
{
  "device_id": "device01",
  "gas_raw": 850,
  "gas_filtered": 820,
  "air_quality": 620,
  "state": "NORMAL",
  "valve": "OPEN",
  "fan": false,
  "buzzer": false
}
```

## 11.3. Event payload

```json
{
  "device_id": "device01",
  "type": "GAS_LEAK",
  "level": "DANGER",
  "gas": 2850,
  "state": "DANGER",
  "message": "Gas concentration exceeded danger threshold"
}
```

## 11.4. Command payload

Có thể dùng topic riêng với payload đơn giản:

```text
gascheck/device01/cmd/valve

CLOSE
```

Hoặc JSON:

```json
{
  "action": "CLOSE"
}
```

Nhóm nên chọn một chuẩn và dùng thống nhất.

---

# 12. Thiết kế Node-RED

## 12.1. Flow telemetry

```text
MQTT IN
   ↓
JSON
   ↓
Validate Payload
   ↓
Update Global State
   ↓
Dashboard Gauge
   ↓
Chart / Log
```

## 12.2. Flow automation

```text
MQTT IN
   ↓
Parse
   ↓
Switch State/Event
   ├── NORMAL
   ├── WARNING
   ├── DANGER
   └── RECOVERY
           ↓
      Rule Processing
           ↓
     Notification/Command
```

## 12.3. Flow Telegram

```text
Danger Event
    ↓
Check duplicate alert
    ↓
Build Message
    ↓
Telegram Bot
```

Cần tránh gửi hàng chục tin nhắn liên tục nếu sensor vẫn giữ ở Danger.

Có thể dùng:

- biến trạng thái;
- cooldown timer;
- chỉ gửi khi state transition xảy ra.

## 12.4. Flow command

```text
Dashboard Button
    ↓
Validate Request
    ↓
Check System State
    ↓
MQTT OUT
    ↓
ESP32
```

---

# 13. Thiết kế Dashboard

## 13.1. Khu vực System Overview

Hiển thị:

```text
DEVICE: device01
STATUS: ONLINE
SYSTEM STATE: NORMAL
```

## 13.2. Khu vực Sensor Monitoring

- Gas Gauge.
- Air Quality Gauge.
- Giá trị hiện tại.
- Threshold tương ứng.

## 13.3. Khu vực Actuator

```text
Valve  : OPEN / CLOSED
Fan    : ON / OFF
Buzzer : ON / OFF
```

## 13.4. Khu vực Chart

- Gas theo thời gian.
- Air Quality theo thời gian.

## 13.5. Khu vực Command

Nên có:

- Emergency Close Valve.
- Fan ON/OFF.
- Reset System.

Không nên cho phép `OPEN VALVE` tự do khi hệ thống đang Danger/Recovery.

---

# 14. Telegram Alert

## 14.1. Warning

```text
⚠️ AIR QUALITY WARNING

Device: device01
State: WARNING
Gas: ...
Air Quality: ...

Ventilation fan has been activated.
```

## 14.2. Danger

```text
🚨 GAS LEAK DETECTED

Device: device01
Gas: ...
State: DANGER

✓ Gas valve CLOSED
✓ Ventilation fan ON
✓ Alarm ON
```

## 14.3. Recovery

```text
✅ GAS LEVEL RECOVERED

Device: device01
Current Gas: ...
State: READY

Valve remains CLOSED.
Please verify the area before resetting the system.
```

---

# 15. Xử lý các tình huống bất thường

## 15.1. MQTT mất kết nối

Firmware:

```text
MQTT disconnected
      ↓
Retry after interval
      ↓
Reconnect
      ↓
Resubscribe command topics
      ↓
Continue telemetry
```

Không nên dùng vòng lặp reconnect blocking quá lâu.

## 15.2. Wi-Fi mất kết nối

- Phát hiện Wi-Fi disconnected.
- Thử reconnect.
- Thiết bị vẫn phải tiếp tục chạy local safety logic.

**Automation an toàn không được phụ thuộc hoàn toàn vào Internet.**

Nếu gas nguy hiểm nhưng MQTT mất kết nối:

```text
ESP32 vẫn phải:
- đóng van;
- bật quạt;
- bật buzzer.
```

## 15.3. Sensor dao động gần threshold

Giải pháp:

- Moving Average.
- Hysteresis.
- State machine.
- Recovery timer.

## 15.4. Lệnh nguy hiểm từ remote

Ví dụ:

```text
OPEN_VALVE
```

khi:

```text
state = DANGER
```

Kết quả:

```text
COMMAND REJECTED
```

---

# 16. Chiến lược kiểm thử

## 16.1. Unit/Module Test

Kiểm tra riêng:

- MQ2 reading.
- MQ135/input reading.
- Servo.
- Fan.
- Buzzer.
- MQTT Publish.
- MQTT Subscribe.
- Node-RED parsing.
- Telegram.

## 16.2. Integration Test

### Integration 1

```text
Sensor → ESP32 → Actuator
```

### Integration 2

```text
ESP32 → MQTT Broker
```

### Integration 3

```text
MQTT → Node-RED → Dashboard
```

### Integration 4

```text
Dashboard → MQTT → ESP32
```

### Integration 5

```text
Danger → Telegram
```

## 16.3. End-to-End Test

```text
Sensor
 ↓
ESP32
 ↓
MQTT
 ↓
Node-RED
 ↓
Application
 ↓
Command
 ↓
MQTT
 ↓
ESP32
 ↓
Actuator
```

---

# 17. Bộ Test Case đề xuất

| ID   | Scenario         | Input                      | Expected Result        |
| ---- | ---------------- | -------------------------- | ---------------------- |
| TC01 | Normal           | Gas thấp, Air tốt          | State = NORMAL         |
| TC02 | Air Warning      | Air vượt Warning           | Fan ON, WARNING        |
| TC03 | Gas Warning      | Gas tăng                   | WARNING                |
| TC04 | Gas Danger       | Gas vượt Danger            | DANGER                 |
| TC05 | Auto Valve       | DANGER                     | Valve CLOSED           |
| TC06 | Auto Fan         | DANGER                     | Fan ON                 |
| TC07 | Auto Buzzer      | DANGER                     | Buzzer ON              |
| TC08 | Telegram Alert   | DANGER                     | Telegram nhận cảnh báo |
| TC09 | Recovery         | Gas giảm                   | RECOVERY               |
| TC10 | Stable Recovery  | Safe đủ thời gian          | READY                  |
| TC11 | Reset            | READY + Reset              | NORMAL                 |
| TC12 | Remote Close     | Command CLOSE              | Valve CLOSED           |
| TC13 | Unsafe Open      | OPEN khi DANGER            | Reject                 |
| TC14 | MQTT Lost        | Ngắt broker                | ESP32 vẫn xử lý local  |
| TC15 | MQTT Reconnect   | Broker trở lại             | Reconnect + telemetry  |
| TC16 | Threshold Noise  | Sensor dao động sát ngưỡng | Không flicker liên tục |
| TC17 | Dashboard Update | Sensor đổi                 | Gauge/chart đổi        |
| TC18 | Downlink         | Dashboard command          | Actuator phản ứng      |

---

# 18. Phương pháp phát triển

## 18.1. Không triển khai theo kiểu Big Bang

Không nên:

```text
Code toàn bộ ESP32
→ Code toàn bộ Node-RED
→ Làm Dashboard
→ Tuần cuối mới ghép
```

Rủi ro lỗi integration rất cao.

## 18.2. Phương pháp đề xuất: Simulation-First + Incremental Integration

```text
Prototype nhỏ
    ↓
Test
    ↓
Commit
    ↓
Kết nối thêm 1 thành phần
    ↓
Integration Test
    ↓
Commit
    ↓
Tiếp tục
```

Trình tự:

```text
1. ESP32 + MQ2
2. ESP32 + Sensor + Actuator
3. State Machine local
4. ESP32 + MQTT Publish
5. MQTT Subscribe
6. Node-RED
7. Dashboard
8. Telegram
9. Full Automation
10. E2E Test
```

---

# 19. Kế hoạch chi tiết 10 tuần

# Tuần 1 – Phân tích yêu cầu và thiết kế hệ thống

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Chốt toàn bộ phạm vi và kiến trúc trước khi code.

## Công việc

### 1. Phân tích bài toán

- Xác định vấn đề cần giải quyết.
- Xác định đầu vào.
- Xác định đầu ra.
- Xác định user.
- Xác định các tình huống nguy hiểm.

### 2. Xác định use case

Tối thiểu:

- Monitor gas.
- Monitor air quality.
- Receive warning.
- Emergency response.
- View dashboard.
- Send remote command.
- Reset after incident.

### 3. Thiết kế kiến trúc 4 tầng V1

Hoàn thành sơ đồ:

```text
Sensor → ESP32 → MQTT → Node-RED → Dashboard
```

và chiều ngược.

### 4. Chốt công nghệ

- ESP32.
- Simulator.
- MQTT Broker.
- Node-RED.
- Dashboard.
- Telegram.

### 5. Chốt MQTT topic convention

Tạo file:

```text
docs/mqtt-topics.md
```

### 6. Chốt State Machine

Tạo:

```text
NORMAL
WARNING
DANGER
RECOVERY
READY
```

## Deliverable W1

- Problem Statement.
- Use Case.
- BOM.
- Architecture V1.
- State Machine V1.
- MQTT topic draft.
- Bảng phân công nhóm.
- GitHub repository.

## Milestone

Mỗi thành viên phải giải thích được kiến trúc toàn hệ thống.

---

# Tuần 2 – Simulation tầng Sensing/Physical

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Có simulation sensor → actuator chạy được.

## Công việc

### Circuit

Kết nối:

- ESP32.
- MQ2.
- MQ135/input thay thế.
- Servo.
- Fan.
- Buzzer.

### Firmware V1

- Đọc sensor.
- In Serial.
- Điều khiển actuator.
- Test từng output.

### Test

Ví dụ:

```text
Gas thấp → Buzzer OFF
Gas cao  → Buzzer ON
```

## Deliverable W2

- Link/project simulation V1.
- Circuit/Wiring.
- Source code V1.
- Video ngắn chứng minh sensor → actuator.
- Pin Mapping.

## Milestone M1 – Device Prototype

**Simulation là bắt buộc.**

---

# Tuần 3 – Firmware và Embedded Logic

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Biến prototype thành firmware ổn định.

## Công việc

### Refactor firmware

Tách:

- sensor;
- actuator;
- controller;
- config.

### Filtering

- Moving Average.
- Sample interval.

### State Machine

Implement:

- NORMAL.
- WARNING.
- DANGER.
- RECOVERY.
- READY.

### Hysteresis

Thêm threshold vào/ra trạng thái.

### Recovery Timer

Không chuyển trạng thái ngay lập tức.

## Deliverable W3

- Simulation V2.
- Firmware V2.
- State Machine code.
- Threshold table.
- Calibration note.
- Bảng test Input → Processing → Output.

---

# Tuần 4 – Network / MQTT

**Thời lượng:** 6 giờ/SV

## Mục tiêu

ESP32 giao tiếp hai chiều thông qua MQTT.

## Công việc

### Wi-Fi

- Connect.
- Reconnect.

### MQTT Publish

Publish:

- telemetry;
- status;
- event.

### MQTT Subscribe

Subscribe:

- valve;
- fan;
- buzzer;
- reset.

### Payload

Chuẩn hóa JSON.

### Test

Dùng MQTT client test:

```text
ESP32 → Broker
Broker → ESP32
```

## Deliverable W4

- MQTT topic map.
- Payload samples.
- Publish log.
- Subscribe log.
- Reconnect test.
- Video uplink/downlink.

## Milestone M2 – Connected Device

Phải chứng minh:

```text
ESP32 Publish
+
ESP32 Subscribe
```

---

# Tuần 5 – Middleware / Node-RED

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Node-RED thực hiện xử lý dữ liệu và automation.

## Công việc

### Flow 1 – Telemetry

```text
MQTT IN → JSON → Validate → Store → Output
```

### Flow 2 – Event

```text
MQTT IN → Switch → Event Handler
```

### Flow 3 – Command

```text
Input → Validate → MQTT OUT
```

### Logging

Lưu:

- timestamp;
- gas;
- air quality;
- state;
- event.

## Deliverable W5

- `node-red/flow.json`.
- Ảnh flow.
- Tài liệu giải thích từng node chính.
- Log/event history.
- Ít nhất 1 automation rule.

## Điều kiện

Middleware phải xử lý dữ liệu, không chỉ forward.

---

# Tuần 6 – Application / Remote Integration

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Hoàn thành đủ kiến trúc 4 tầng.

## Công việc

### Dashboard

Tạo:

- Gas Gauge.
- Air Quality Gauge.
- State.
- Actuator status.
- Charts.
- Command controls.

### Telegram

- Bot.
- Warning.
- Danger.
- Recovery.

### Remote Command

Demo ít nhất:

```text
Application → MQTT → ESP32 → Actuator
```

## Deliverable W6

- Dashboard hoạt động.
- Telegram Alert.
- Remote Command.
- Ảnh/video application.
- Full Architecture evidence.

## Milestone M3 – Full 4-Layer IoT

```text
Sensing
  ↓
Network
  ↓
Middleware
  ↓
Application
```

đầy đủ.

---

# Tuần 7 – Automation và tình huống bất thường

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Tăng độ an toàn và tính thông minh của hệ thống.

## Công việc

### Automation Rule 1

Air warning → Fan ON.

### Automation Rule 2

Gas danger →

```text
Valve CLOSED
Fan ON
Buzzer ON
Alert
```

### Automation Rule 3

Recovery.

### Safety Interlock

Reject `OPEN_VALVE` khi không an toàn.

### Error Scenario

Test:

- MQTT disconnected.
- Sensor threshold noise.
- Invalid command.

## Deliverable W7

- Tối thiểu 2 automation rules.
- 1 abnormal scenario.
- Evidence test.
- State transition logs.

---

# Tuần 8 – End-to-End Integration

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Toàn bộ hệ thống chạy như một sản phẩm thống nhất.

## Công việc

Ghép:

```text
Sensor
→ ESP32
→ MQTT
→ Node-RED
→ Dashboard/Telegram
```

và:

```text
Dashboard
→ Node-RED
→ MQTT
→ ESP32
→ Actuator
```

### Regression Test

Chạy lại:

- NORMAL.
- WARNING.
- DANGER.
- RECOVERY.
- READY.
- RESET.

## Deliverable W8

- E2E Demo.
- Video E2E.
- Integration test report.
- Danh sách bug.
- Bug fixes.

## Milestone M4 – End-to-End System

Uplink và downlink phải hoạt động ổn định.

---

# Tuần 9 – System Test và Documentation

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Ổn định sản phẩm, không mở rộng scope lớn.

## Công việc

### System Test

Chạy toàn bộ test case.

### Robustness

- Reconnect.
- Invalid payload.
- Duplicate alert.
- Rapid sensor change.

### Documentation

Hoàn thiện:

- architecture;
- wiring;
- MQTT topics;
- state machine;
- Node-RED flow;
- source guide;
- test report.

### Video Draft

Quay video demo bản gần final.

## Deliverable W9

- Test Report.
- Architecture Final.
- Wiring Final.
- MQTT Topic documentation.
- Node-RED flow.
- Source code.
- Video draft.
- Report draft.

---

# Tuần 10 – Final Demo và nghiệm thu

**Thời lượng:** 6 giờ/SV

## Mục tiêu

Demo ổn định, hoàn thiện deliverables và Q&A.

## Công việc

### Regression Test

Test toàn bộ trước demo.

### Demo Script

Chạy đúng sequence đã chuẩn bị.

### Báo cáo

Hoàn thiện:

- report;
- slide/poster;
- video;
- README.

### Q&A cá nhân

Mỗi SV phải giải thích:

- sensor;
- ESP32;
- MQTT;
- Node-RED;
- automation;
- application;
- E2E.

## Deliverable W10

- Live Demo.
- Simulation Project.
- Source Code.
- Báo cáo.
- Video.
- Slide/Poster.
- Q&A.

## Final Condition

Simulation + đủ 4 tầng là điều kiện Pass.

---

# 20. Phân công công việc nhóm N19

## 20.1. Trình Quốc An – Sensing / Embedded

### Primary W1–W6

- Circuit.
- Simulation.
- Sensor.
- Actuator.
- ESP32 firmware.
- Filtering.
- State machine embedded.
- Wiring documentation.

### W7–W10

- Integration.
- Cross-test MQTT.
- Test abnormal scenarios.
- Documentation.
- Demo.

---

## 20.2. Nguyễn Kim Long – Network / Middleware

### Primary W1–W6

- Wi-Fi.
- MQTT.
- Topic naming.
- JSON payload.
- Broker.
- Node-RED.
- Logging.
- Connectivity test.

### W7–W10

- Automation integration.
- Error handling.
- E2E testing.
- Test report.
- Documentation.
- Demo.

---

## 20.3. Nguyễn Long Vỹ – Application / Automation

### Primary W1–W6

- Dashboard.
- Telegram.
- Remote command.
- UI trạng thái.
- Automation/business rule integration.

### W7–W10

- Integration.
- Command safety.
- Alert testing.
- Documentation.
- Demo.

---

## 20.4. Nguyên tắc làm nhóm

Dù chia Primary Owner, cả ba thành viên phải:

- Review code của nhau.
- Hiểu MQTT topics.
- Hiểu State Machine.
- Hiểu Node-RED.
- Hiểu Dashboard.
- Biết cách chạy simulation.
- Biết demo E2E.

---

# 21. Quản lý source code GitHub

## 21.1. Cấu trúc repository

```text
IOT-Safety-GasCheck/
│
├── esp32/
│   ├── src/
│   ├── include/
│   └── README.md
│
├── simulation/
│   ├── diagram.json
│   ├── wokwi.toml
│   └── README.md
│
├── node-red/
│   ├── flow.json
│   └── README.md
│
├── docs/
│   ├── architecture/
│   ├── wiring/
│   ├── mqtt/
│   ├── state-machine/
│   ├── test/
│   └── images/
│
├── telegram/
│   └── README.md
│
├── report/
│
├── slides/
│
└── README.md
```

## 21.2. Branch đề xuất

```text
main
develop
feature/embedded
feature/mqtt
feature/node-red
feature/dashboard
feature/telegram
feature/automation
```

## 21.3. Commit convention

Ví dụ:

```text
feat: add MQ2 sensor reading
feat: implement gas danger state
feat: publish telemetry through MQTT
feat: add Node-RED danger flow
fix: prevent repeated Telegram alerts
test: add MQTT reconnect scenario
docs: add architecture diagram
```

---

# 22. Checklist Deliverables

## Bắt buộc

- [ ] Source code ESP32.
- [ ] Sơ đồ kiến trúc 4 tầng.
- [ ] Sơ đồ wiring/circuit.
- [ ] Node-RED Flow JSON.
- [ ] MQTT Topics.
- [ ] Payload examples.
- [ ] Dashboard/Application evidence.
- [ ] Remote integration.
- [ ] Simulation project.
- [ ] Video demo.
- [ ] Technical report.
- [ ] Slide/Poster.
- [ ] Test Report.

## Optional Bonus

- [ ] Hardware prototype.
- [ ] Video hardware.
- [ ] Hardware wiring.
- [ ] Hardware E2E demo.

---

# 23. Kịch bản Demo Final

## Bước 1 – Khởi động

Hiển thị:

```text
System State = NORMAL
Valve = OPEN
Fan = OFF
Buzzer = OFF
```

Dashboard nhận telemetry.

## Bước 2 – Air Quality xấu

Tăng input Air Quality.

Expected:

```text
State = WARNING
Fan = ON
```

Dashboard cập nhật.

## Bước 3 – Gas tăng nguy hiểm

Tăng MQ2.

Expected:

```text
State = DANGER
Valve = CLOSED
Fan = ON
Buzzer = ON
```

Đồng thời:

- Dashboard đổi trạng thái.
- MQTT event được publish.
- Node-RED nhận event.
- Telegram gửi alert.

## Bước 4 – Test downlink

Từ Dashboard gửi:

```text
OPEN_VALVE
```

Trong DANGER.

Expected:

```text
COMMAND REJECTED
```

Đây là minh chứng business rule/safety interlock.

## Bước 5 – Recovery

Giảm giá trị gas.

Expected:

```text
DANGER
→ RECOVERY
→ READY
```

Van vẫn CLOSED.

## Bước 6 – Reset

Nhấn Reset.

Expected:

```text
READY
→ NORMAL
```

Hệ thống trở về trạng thái bình thường.

---

# 24. Evidence cần lưu cho từng milestone

## W2

```text
evidence/w2/
├── circuit.png
├── sensor-reading.png
├── actuator-test.png
└── simulation-link.md
```

## W4

```text
evidence/w4/
├── mqtt-publish.png
├── mqtt-subscribe.png
└── reconnect-test.png
```

## W6

```text
evidence/w6/
├── dashboard.png
├── telegram.png
└── remote-command.png
```

## W8

```text
evidence/w8/
├── e2e-uplink.mp4
├── e2e-downlink.mp4
└── integration-test.md
```

## W10

```text
evidence/final/
├── final-demo.mp4
├── final-architecture.png
├── final-dashboard.png
└── test-report.pdf
```

---

# 25. Quản lý rủi ro

| Rủi ro                           | Mức ảnh hưởng | Phương án                                 |
| -------------------------------- | ------------- | ----------------------------------------- |
| Simulator không hỗ trợ đủ sensor | Trung bình    | Dùng analog input tương đương hoặc Hybrid |
| MQTT mất kết nối                 | Cao           | Reconnect + local safety logic            |
| Sensor dao động                  | Trung bình    | Moving Average + Hysteresis               |
| Telegram gửi alert liên tục      | Trung bình    | State transition/cooldown                 |
| Command mở van khi Danger        | Cao           | Safety Interlock                          |
| Ghép hệ thống trễ                | Cao           | Incremental Integration từ W4             |
| Tuần 9 vẫn thêm tính năng        | Cao           | Freeze scope sau W8                       |
| Chỉ một thành viên hiểu một tầng | Cao           | Cross-review + Q&A hằng tuần              |
| Demo phụ thuộc Internet          | Trung bình    | Chuẩn bị local broker/network nếu có thể  |
| Hardware thật gây chậm tiến độ   | Cao           | Chỉ làm sau khi simulation ổn định        |

---

# 26. Definition of Done

Đề tài chỉ được xem là hoàn thành khi đáp ứng đầy đủ:

## Simulation

- [ ] Sensor/input thay đổi được.
- [ ] Actuator phản ứng đúng.
- [ ] Simulation có thể chạy lại ổn định.

## Embedded

- [ ] Firmware không hard-code demo.
- [ ] Có filtering.
- [ ] Có state machine.
- [ ] Có local safety logic.

## Network

- [ ] Wi-Fi hoạt động.
- [ ] MQTT Publish hoạt động.
- [ ] MQTT Subscribe hoạt động.
- [ ] Có reconnect.

## Middleware

- [ ] Node-RED nhận telemetry.
- [ ] Có rule.
- [ ] Có event handling.
- [ ] Có logging.
- [ ] Có command xuống device.

## Application

- [ ] Dashboard hiển thị realtime.
- [ ] Có cảnh báo từ xa.
- [ ] Có remote command.

## Automation

- [ ] Warning.
- [ ] Danger.
- [ ] Recovery.
- [ ] Safety Interlock.
- [ ] Abnormal scenario.

## E2E

- [ ] Uplink hoạt động.
- [ ] Downlink hoạt động.
- [ ] Demo lặp lại được.

## Documentation

- [ ] Source.
- [ ] Architecture.
- [ ] Wiring.
- [ ] MQTT topics.
- [ ] Node-RED flow.
- [ ] Test report.
- [ ] Video.
- [ ] Report.
- [ ] Slide/Poster.

---

# 27. Chiến lược tối ưu theo Rubric 100 điểm

| Hạng mục                   | Điểm | Mục tiêu của nhóm                                 |
| -------------------------- | ---: | ------------------------------------------------- |
| Simulation & Embedded      |   20 | Simulation sensor + actuator ổn định              |
| Kiến trúc 4 tầng IoT       |   25 | Đủ Sensing → Network → Middleware → Application   |
| Automation / Control Logic |   20 | State Machine + Rule + Safety Interlock           |
| Application / Integration  |   15 | Dashboard + Telegram + Remote Command             |
| Demo & độ ổn định          |   10 | Demo theo kịch bản, lặp lại được                  |
| Báo cáo & Deliverables     |   10 | Đủ source, sơ đồ, flow, test, video               |
| Hardware Bonus             |   +5 | Chỉ triển khai nếu hệ thống simulation đã ổn định |

Thứ tự ưu tiên:

```text
1. Simulation
2. Firmware ổn định
3. MQTT uplink/downlink
4. Node-RED
5. Application
6. Automation
7. E2E
8. Test + Documentation
9. Hardware Bonus
```

---

# 28. Mốc nghiệm thu bắt buộc

```text
W2  → Simulation
W4  → Connected Device
W6  → Full 4-Layer
W8  → End-to-End
W10 → Final
```

Nhóm không nên dồn các mốc này về tuần cuối.

---

# 29. Kết luận phương pháp triển khai

Phương pháp phù hợp nhất cho đề tài **IOT-Safety-GasCheck** là:

> **Simulation-First → Incremental Integration → State-Machine Automation → End-to-End Testing.**

Trọng tâm của đề tài không phải là số lượng công nghệ sử dụng mà là việc chứng minh được một hệ thống IoT hoàn chỉnh và ổn định:

```text
Sensing
   ↓
Network
   ↓
Middleware
   ↓
Application
   ↓
Remote Command
   ↓
Actuator
```

Nhóm nên hoàn thiện chắc chắn kiến trúc bắt buộc trước, sau đó mới bổ sung các tính năng nâng cao hoặc phần cứng thật.

---
