# GasCheck – Hệ thống Giám sát & Cảnh báo Rò rỉ Khí Gas IoT (Phiên bản V2)

Ứng dụng Web Dashboard thời gian thực lấy cảm hứng từ **Home Assistant**, phục vụ theo dõi và cảnh báo sớm rò rỉ khí gas cho dự án **GasCheck V2** (`https://github.com/klongnguyen/IOT_Safety_GasCheck`).

---

## 1. Kiến trúc Phần cứng GasCheck V2

Hệ thống giám sát chính xác cấu hình phần cứng hiện hành của phiên bản V2:

| Thiết bị | Chân kết nối / Giao thức | Vai trò trong hệ thống |
|---|---|---|
| **ESP32** | Wi-Fi / MQTT (`n19-gascheck-01`) | Bộ điều khiển trung tâm, đọc ADC, điều khiển cơ cấu chấp hành tại chỗ |
| **Cảm biến MQ2** | Analog 12-bit ADC (`0–4095`) | Phát hiện tín hiệu khí gas rò rỉ (hiển thị cả Raw ADC và Filtered EMA) |
| **LED Xanh** | GPIO Digital Output | Báo hiệu trạng thái bình thường (`NORMAL`) |
| **LED Vàng** | GPIO Digital Output | Báo hiệu trạng thái cảnh báo (`WARNING`) hoặc chờ phục hồi (`RECOVERY`) |
| **LED Đỏ** | GPIO Digital Output | Báo hiệu trạng thái nguy hiểm (`DANGER`) hoặc lỗi cảm biến (`FAULT`) |
| **Buzzer** | GPIO Digital / PWM | Phát cảnh báo âm thanh tại chỗ |
| **Servo SG90** | GPIO PWM (`0°` / `90°`) | Mở cửa sổ mô phỏng thông gió khi xảy ra `DANGER` (không điều khiển van gas) |

> **Lưu ý kiến trúc:** Phiên bản V2 đã loại bỏ MQ135, quạt thông gió, relay và van ngắt gas. Giao diện tuân thủ nghiêm ngặt thiết kế này và không hiển thị các linh kiện đã loại bỏ.

---

## 2. Kiến trúc Phần mềm & Luồng Dữ liệu

```text
ESP32 ──(Wi-Fi)──> MQTT Broker ──> Node-RED (Automation / Telegram)
                       │
                       └──> GasCheck Web Backend (Express + MQTT.js + WebSocket)
                                     │
                                     └──> React Frontend Dashboard (Realtime WS)
```

### Danh sách MQTT Topics
- `gascheck/n19/telemetry` – Dữ liệu cảm biến MQ2 và trạng thái thiết bị định kỳ
- `gascheck/n19/event` – Sự kiện cảnh báo vượt ngưỡng hoặc lỗi phần cứng
- `gascheck/n19/status` – Trạng thái kết nối Online/Offline (LWT) của ESP32
- `gascheck/n19/cmd` – Lệnh kiểm tra an toàn (`TEST_ALARM`, `REQUEST_RESET`)

---

## 3. Chế độ DEMO MODE (SIMULATION) và LIVE MODE

- **DEMO MODE (Mặc định):** Cho phép vận hành và trình diễn độc lập khi chưa kết nối ESP32 thật. Bao gồm bảng **Simulation Workbench** với:
  - Nút **Chạy kịch bản rò rỉ khí gas (Run Gas Leak Scenario)**: Tự động trình diễn chuỗi `NORMAL → WARNING → DANGER → RECOVERY → NORMAL`.
  - 9 kịch bản kiểm thử nhanh: `NORMAL`, `WARNING`, `DANGER`, `RECOVERY`, `RECOVERY_AFTER_DANGER`, `FAULT`, `ESP32_OFFLINE`, `MQTT_DISCONNECTED`, `STALE_DATA`.
  - Thanh trượt điều chỉnh giá trị MQ2 ADC (`0–4095`) cập nhật đồng bộ Gauge, LED, Buzzer, Cửa sổ Servo, Biểu đồ và Trung tâm Thông báo.
- **LIVE MODE:** Nhận dữ liệu thực từ MQTT Broker được cấu hình trong `.env`. Khi mất kết nối MQTT hoặc ESP32 ngừng gửi dữ liệu quá 15 giây, hệ thống lập tức chuyển sang trạng thái `OFFLINE` / `STALE` (tuyệt đối không tự coi là `NORMAL`).

---

## 4. Hướng dẫn Cài đặt, Chạy và Kiểm thử

```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy kiểm thử đơn vị (Parser, State Mapping, Alert Lifecycle, Safety Commands)
npm test

# 3. Chạy môi trường phát triển (Full-stack Express + WebSocket + Vite trên cổng 3000)
npm run dev

# 4. Build bản Production
npm run build
```
