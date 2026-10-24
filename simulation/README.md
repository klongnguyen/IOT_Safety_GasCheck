# ⚡ HƯỚNG DẪN CHẠY MÔ PHỎNG WOKWI — IOT SAFETY GASCHECK

> Tài liệu hướng dẫn bạn thao tác bằng tay để chạy mô phỏng mạch điện ESP32, cảm biến gas và các cơ cấu cảnh báo trên nền tảng **Wokwi** (hỗ trợ cả mô phỏng cục bộ và kết nối Internet MQTT).

---

## 1. Cách chạy trên Trình duyệt Web (Nhanh nhất & Trực quan)

1. Mở trình duyệt truy cập: [https://wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32)
2. **Nạp sơ đồ mạch (diagram.json):**
   - Trên thanh công cụ của Wokwi, bấm vào tab **diagram.json**.
   - Mở file [simulation/diagram.json](diagram.json) trong thư mục dự án, copy toàn bộ nội dung và dán đè vào tab `diagram.json` trên Wokwi.
   - Ngay lập tức, bạn sẽ thấy giao diện mạch điện hiện ra đầy đủ: Bo mạch ESP32, Biến trở Gas MQ2, 3 LED (Xanh, Vàng, Đỏ) kèm điện trở hạn dòng, Còi Buzzer và Động cơ Servo điều khiển cửa sổ!
3. **Cài đặt thư viện:**
   - Trong Wokwi, bấm vào tab **Library Manager** (biểu tượng cuốn sách hoặc file `libraries.txt`).
   - Thêm 3 thư viện:
     ```
     ESP32Servo
     PubSubClient
     ArduinoJson
     ```
4. **Nạp mã nguồn firmware:**
   - Bấm vào tab **sketch.ino**.
   - Mở file [simulation/sketch.ino](sketch.ino) trong thư mục dự án, copy toàn bộ và dán đè vào tab `sketch.ino`.
5. **Bắt đầu chạy mô phỏng:**
   - Bấm nút **Play** màu xanh lá (Start Simulation).
   - Mở rộng cửa sổ **Serial Monitor** ở phía dưới để quan sát log dữ liệu thời gian thực.

---

## 2. Các kịch bản kiểm thử trực tiếp trên Wokwi

### Kịch bản 1: Mức bình thường (NORMAL)
- Để biến trở ở vị trí thấp (khoảng 0% - 30%, ADC < 1500).
- **Quan sát:**
  - LED **XANH** sáng.
  - Còi Buzzer **TẮT**.
  - Servo cửa sổ ở góc **0°** (Đóng).
  - Serial Monitor in ra `[LOG] State: NORMAL | Window: CLOSED`.

### Kịch bản 2: Mức cảnh báo (WARNING)
- Dùng chuột vặn biến trở lên mức từ 40% - 60% (ADC từ 1500 đến 2499).
- **Quan sát:**
  - LED **VÀNG** sáng.
  - Còi Buzzer kêu ngắt quãng (nhịp ngắn 300ms ON / 700ms OFF).
  - Servo cửa sổ vẫn giữ ở góc **0°** (Đóng).
  - Serial Monitor in ra `[LOG] State: WARNING`.

### Kịch bản 3: Mức nguy hiểm (DANGER)
- Vặn biến trở lên mức cao (ADC >= 2500).
- **Quan sát:**
  - LED **ĐỎ** sáng.
  - Còi Buzzer phát âm thanh liên tục (cảnh báo nguy cấp).
  - Servo tự động quay sang góc **90°** (Mở cửa sổ mini để thông thoáng không khí).
  - Gói tin sự kiện khẩn cấp lập tức được publish lên MQTT Broker `gascheck/n19/event`.

### Kịch bản 4: Chế độ phục hồi (RECOVERY) & Khóa an toàn
- Vặn biến trở giảm xuống dưới mức nguy hiểm (ADC < 2200).
- **Quan sát:**
  - Hệ thống chuyển sang trạng thái **RECOVERY**: LED VÀNG nhấp nháy, còi phát tiếng kêu định kỳ báo hiệu đang chờ xử lý.
  - **Cửa sổ vẫn tiếp tục giữ MỞ 90°** để đảm bảo an toàn, không tự động đóng lại khi chưa có sự xác nhận của con người.
  - Chỉ khi người dùng gửi lệnh `REQUEST_RESET` từ MQTTX hoặc Dashboard (và nồng độ gas thực tế đã dưới 1300), hệ thống mới quay về `NORMAL` và servo mới đóng cửa sổ lại.

---

## 3. Kết nối mạng Wi-Fi và MQTT trong Wokwi
- Wokwi tự động cung cấp điểm truy cập Wi-Fi ảo tên là `Wokwi-GUEST` (không mật khẩu). Firmware đã được cấu hình sẵn để tự động kết nối qua mạng này.
- Khi khởi động, bạn sẽ thấy ESP32 in ra:
  ```
  [WIFI] Dang ket noi Wi-Fi 'Wokwi-GUEST'...
  [MQTT] Ket noi Broker broker.hivemq.com:1883...
  [MQTT] Ket noi thanh cong!
  [MQTT-UPLINK] Telemetry -> {"device_id":"n19-gascheck-01", ...}
  ```
- Điều này chứng minh Tầng 1 (Sensing) và Tầng 2 (Network) hoạt động mượt mà ngay trên máy tính mà không cần mua phần cứng vật lý!
