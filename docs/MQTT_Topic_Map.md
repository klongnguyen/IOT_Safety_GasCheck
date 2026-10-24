# 📡 BẢN ĐẶC TẢ GIAO THỨC MQTT (MQTT TOPIC MAP) — GASCHECK V2

> **Dự án:** IOT-Safety-GasCheck · Nhóm N19 · Đề tài 06  
> **Milestone:** M2 – Connected Device (Tuần 4) & M3 – Full 4-Layer (Tuần 5–6)  
> **Broker mặc định:** `broker.hivemq.com` (Cổng: `1883`, TCP không mã hóa cho mô phỏng / hoặc local Mosquitto)  
> **Device ID:** `n19-gascheck-01`

---

## 1. Tổng quan ma trận Topic

| STT | Topic | Hướng | QoS | Retain | Mục đích |
|:---:|---|:---:|:---:|:---:|---|
| 1 | `gascheck/n19/telemetry` | ESP32 → Broker (Uplink) | 0 | False | Truyền dữ liệu đo chu kỳ mỗi 2 giây |
| 2 | `gascheck/n19/event` | ESP32 → Broker (Uplink) | 1 | True | Thông báo khẩn khi chuyển trạng thái hoặc phản hồi lệnh |
| 3 | `gascheck/n19/status` | ESP32 → Broker (Uplink) | 1 | True | Quản lý vòng đời (Online / Offline LWT), IP, Uptime |
| 4 | `gascheck/n19/cmd` | Broker → ESP32 (Downlink) | 1 | False | Gửi lệnh từ xa (Reset, Test còi, Ping) |

---

## 2. Chi tiết cấu trúc dữ liệu Payload

### 2.1. Telemetry (`gascheck/n19/telemetry`)
- **Tần suất:** 2000 ms.
- **Ý nghĩa:** Cung cấp thông số tức thời cho Dashboard và Node-RED lưu lịch sử.

```json
{
  "device_id": "n19-gascheck-01",
  "gas_raw": 1850,
  "gas_filtered": 1845,
  "state": "WARNING",
  "led": "YELLOW",
  "buzzer": true,
  "window": "CLOSED",
  "sensor_fault": false,
  "uptime_sec": 142
}
```

**Bảng mô tả trường:**
- `device_id` (string): Mã định danh duy nhất của trạm giám sát.
- `gas_raw` (integer, 0–4095): Giá trị đọc trực tiếp từ ADC1 GPIO34.
- `gas_filtered` (integer, 0–4095): Giá trị sau bộ lọc trung bình động 10 mẫu.
- `state` (string): Trạng thái FSM (`NORMAL`, `WARNING`, `DANGER`, `RECOVERY`, `FAULT`).
- `led` (string): Màu đèn hiện tại (`GREEN`, `YELLOW`, `RED`, `YELLOW_BLINK`, `RED_BLINK`).
- `buzzer` (boolean): `true` nếu còi đang phát âm thanh, `false` nếu tắt.
- `window` (string): Trạng thái cửa sổ mô hình (`CLOSED` hoặc `OPEN`).
- `sensor_fault` (boolean): `true` nếu cảm biến gặp lỗi (đứt dây, chập rail).
- `uptime_sec` (integer): Thời gian hoạt động tính bằng giây.

---

### 2.2. Sự kiện khẩn cấp (`gascheck/n19/event`)
- **Tần suất:** Ngay khi phát sinh sự kiện chuyển mức nguy hiểm hoặc phản hồi lệnh điều khiển.

#### Ví dụ 1: Chuyển trạng thái sang DANGER
```json
{
  "device_id": "n19-gascheck-01",
  "event": "STATE_CHANGED",
  "from_state": "WARNING",
  "to_state": "DANGER",
  "gas_filtered": 2540,
  "timestamp_ms": 32800
}
```

#### Ví dụ 2: Phản hồi chấp thuận lệnh RESET
```json
{
  "device_id": "n19-gascheck-01",
  "command": "REQUEST_RESET",
  "result": "ACCEPTED",
  "message": "He thong an toan, da reset he thong va dong cua so.",
  "state": "NORMAL"
}
```

#### Ví dụ 3: Phản hồi từ chối lệnh RESET (Safety Interlock)
```json
{
  "device_id": "n19-gascheck-01",
  "command": "REQUEST_RESET",
  "result": "REJECTED",
  "message": "TU CHOI RESET: Gas con nguy hiem hoac he thong dang DANGER!",
  "current_gas": 2480,
  "safe_limit": 1300,
  "state": "DANGER"
}
```

---

### 2.3. Vòng đời thiết bị & LWT (`gascheck/n19/status`)
- **Khi mất kết nối đột ngột (LWT):** Do MQTT Broker tự động gửi theo cấu hình Last Will:
```json
{
  "device_id": "n19-gascheck-01",
  "status": "offline"
}
```

- **Khi thiết bị khởi động online:**
```json
{
  "device_id": "n19-gascheck-01",
  "status": "online",
  "ip": "192.168.1.105",
  "rssi": -52,
  "uptime_sec": 3
}
```

---

### 2.4. Lệnh điều khiển Downlink (`gascheck/n19/cmd`)

#### Lệnh 1: Yêu cầu Reset khôi phục hệ thống
```json
{
  "cmd": "REQUEST_RESET"
}
```
*Điều kiện:* Chỉ có hiệu lực khi hệ thống ở `RECOVERY` và nồng độ `gas_filtered < 1300`. Nếu đang ở `DANGER` hoặc nồng độ gas còn cao, ESP32 sẽ **bác bỏ lệnh** nhằm bảo đảm an toàn cháy nổ.

#### Lệnh 2: Kiểm tra còi báo động từ xa (Test Alarm)
```json
{
  "cmd": "TEST_ALARM"
}
```
*Tác vụ:* Kích hoạt còi kêu trong 2 giây rồi tự động tắt, không làm thay đổi trạng thái giám sát gas.

#### Lệnh 3: Kiểm tra đường truyền (Ping)
```json
{
  "cmd": "PING"
}
```
*Tác vụ:* Thiết bị phản hồi thông tin uptime xác nhận kết nối mạng hoạt động tốt.
