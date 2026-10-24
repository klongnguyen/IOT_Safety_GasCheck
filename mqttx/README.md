# 📱 HƯỚNG DẪN SỬ DỤNG MQTTX ĐỂ KIỂM THỬ TẦNG NETWORK (TUẦN 4)

> Tài liệu này hướng dẫn chi tiết từng bước bằng tay để bạn sử dụng phần mềm **MQTTX** (hoặc MQTTX Web) nhằm chứng minh luồng **Uplink (Device → MQTT)** và **Downlink (MQTT → Device)** cho Milestone M2 của đề tài.

---

## 1. Chuẩn bị công cụ

Bạn có thể dùng 1 trong 2 cách:
- **Cách 1 (Nhanh nhất không cần cài đặt):** Mở trình duyệt vào trang web: [https://mqttx.app/web](https://mqttx.app/web)
- **Cách 2 (Cài app máy tính):** Tải MQTTX Desktop tại [https://mqttx.app](https://mqttx.app)

---

## 2. Bước 1: Tạo kết nối tới MQTT Broker

1. Mở MQTTX, bấm nút **"+"** (hoặc **New Connection**).
2. Điền các thông số kết nối chính xác như sau:
   - **Name:** `N19-GasCheck-Test`
   - **Client ID:** Bấm nút mũi tên xoay tròn để tạo tự động (hoặc để mặc định).
   - **Host:** `broker.hivemq.com`
   - **Port:** `1883` (nếu dùng MQTTX Web trình duyệt, chọn Protocol `ws://` hoặc `wss://` với host `broker.hivemq.com`, Port `8083` hoặc `8884`).
   - Các mục khác (Username, Password): Để trống.
3. Bấm **Connect** (nút màu xanh lá ở góc phải trên).
   - Khi trạng thái chuyển thành chấm xanh lá và hiện chữ **Connected**, bạn đã kết nối thành công tới Broker!

---

## 3. Bước 2: Đăng ký (Subscribe) nhận dữ liệu Uplink từ ESP32

Để nhận tất cả thông tin ESP32 gửi lên:
1. Bấm nút **"+ New Subscription"**.
2. Nhập các trường:
   - **Topic:** `gascheck/n19/#` (Dấu `#` đại diện cho tất cả các sub-topic: telemetry, event, status).
   - **QoS:** `0` (hoặc `1`).
   - **Color:** Chọn màu bất kỳ bạn thích.
3. Bấm nút **Confirm**.

**Kết quả quan sát được:**
- Ngay khi mạch ESP32 trên Wokwi đang chạy, bạn sẽ thấy tin nhắn định kỳ 2 giây/lần xuất hiện trên màn hình:
  ```json
  {
    "device_id": "n19-gascheck-01",
    "gas_raw": 1250,
    "gas_filtered": 1248,
    "state": "NORMAL",
    "led": "GREEN",
    "buzzer": false,
    "window": "CLOSED",
    "sensor_fault": false,
    "uptime_sec": 48
  }
  ```
- Khi bạn xoay biến trở gas trên Wokwi lên cao:
  - Một gói tin sự kiện khẩn cấp lập tức xuất hiện tại topic `gascheck/n19/event`:
  ```json
  {
    "device_id": "n19-gascheck-01",
    "event": "STATE_CHANGED",
    "from_state": "NORMAL",
    "to_state": "DANGER",
    "gas_filtered": 2680,
    "timestamp_ms": 52140
  }
  ```

---

## 4. Bước 3: Gửi lệnh Downlink từ MQTTX xuống ESP32

Ở khung phía dưới màn hình MQTTX (khung Publish):
1. **Topic:** Nhập `gascheck/n19/cmd`
2. **QoS:** Chọn `1`
3. **Payload Type:** Chọn `JSON`

### Kịch bản Test 1: Kiểm tra còi báo động từ xa (Test Alarm)
- Nhập nội dung JSON:
  ```json
  {
    "cmd": "TEST_ALARM"
  }
  ```
- Bấm nút gửi (mũi tên xanh).
- **Kết quả:** Trên Wokwi, còi Buzzer phát tiếng kêu trong 2 giây rồi tự tắt. Trên MQTTX nhận được phản hồi xác nhận tại `gascheck/n19/event`.

---

### Kịch bản Test 2: Thử nghiệm khóa an toàn (Safety Interlock) khi đang có Gas
1. Trên Wokwi, vặn biến trở lên mức cao (ví dụ ADC = 2800, đèn ĐỎ sáng, cửa sổ MỞ).
2. Trên MQTTX, gửi lệnh Reset:
   ```json
   {
     "cmd": "REQUEST_RESET"
   }
   ```
3. Bấm nút gửi.
4. **Kết quả:**
   - ESP32 **TỪ CHỐI** tắt cảnh báo! Đèn Đỏ vẫn sáng, cửa sổ vẫn giữ MỞ để đảm bảo tính mạng con người.
   - Trên MQTTX nhận được gói tin bác bỏ lệnh:
   ```json
   {
     "device_id": "n19-gascheck-01",
     "command": "REQUEST_RESET",
     "result": "REJECTED",
     "message": "TU CHOI RESET: Gas con nguy hiem hoac he thong dang DANGER!",
     "current_gas": 2800,
     "safe_limit": 1300,
     "state": "DANGER"
   }
   ```
   > *Đây là điểm sáng kỹ thuật cực kỳ quan trọng giúp đạt điểm tối đa ở tiêu chí an toàn (Safety Interlock) của thầy cô.*

---

### Kịch bản Test 3: Reset thành công khi nồng độ gas đã hạ an toàn
1. Trên Wokwi, vặn biến trở giảm xuống mức an toàn (ví dụ ADC = 900).
   - Hệ thống chuyển sang trạng thái `RECOVERY` (Đèn Vàng nhấp nháy, cửa sổ vẫn giữ MỞ chờ người dùng xác nhận đã thông thoáng khí).
2. Trên MQTTX, gửi lại lệnh Reset:
   ```json
   {
     "cmd": "REQUEST_RESET"
   }
   ```
3. Bấm gửi.
4. **Kết quả:**
   - ESP32 chấp nhận lệnh! Đèn XANH bật sáng trở lại, Servo quay về 0° (đóng cửa sổ).
   - Trên MQTTX nhận được thông báo chấp thuận:
   ```json
   {
     "device_id": "n19-gascheck-01",
     "command": "REQUEST_RESET",
     "result": "ACCEPTED",
     "message": "An toan, da reset he thong va dong cua so.",
     "state": "NORMAL"
   }
   ```

---

## 5. Chụp bằng chứng nộp báo cáo Tuần 4
Bạn hãy dùng phím `Windows + Shift + S` chụp 3 bức ảnh màn hình:
1. Màn hình MQTTX nhận dòng tin telemetry và event từ Wokwi.
2. Màn hình gửi lệnh `REQUEST_RESET` bị từ chối khi gas cao.
3. Màn hình gửi lệnh `REQUEST_RESET` được chấp nhận khi gas thấp.
Dán các ảnh này vào thư mục báo cáo để hoàn tất Milestone M2!
