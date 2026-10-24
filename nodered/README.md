# 🔴 HƯỚNG DẪN CÀI ĐẶT VÀ SỬ DỤNG NODE-RED CHO TẦNG MIDDLEWARE (TUẦN 5)

> Tài liệu hướng dẫn bạn thao tác bằng tay từ A đến Z để chạy Node-RED, import toàn bộ luồng xử lý và Dashboard trực quan đã được xây dựng sẵn trong thư mục này.

---

## 1. Cài đặt Node-RED trên máy tính

Máy tính của bạn đã có sẵn **Node.js v22**, vì vậy việc cài đặt cực kỳ đơn giản:

1. Mở cửa sổ **PowerShell** hoặc **Command Prompt** (Terminal).
2. Chạy lệnh sau để cài đặt Node-RED toàn cục:
   ```powershell
   npm install -g --unsafe-perm node-red
   ```
3. Sau khi cài xong, khởi động Node-RED bằng lệnh:
   ```powershell
   node-red
   ```
4. Khi thấy màn hình terminal hiện dòng:
   `Server now running at http://127.0.0.1:1880/`
   nghĩa là Node-RED đã sẵn sàng! *(Lưu ý: Giữ nguyên cửa sổ terminal này khi đang thực hành)*.

---

## 2. Cài đặt thư viện Dashboard (Giao diện đồ họa)

Để hiển thị đồng hồ đo nồng độ gas và nút bấm điều khiển:
1. Mở trình duyệt web (Chrome/Edge), truy cập: [http://127.0.0.1:1880](http://127.0.0.1:1880)
2. Bấm vào biểu tượng **Menu (☰)** ở góc trên cùng bên phải → chọn **Manage palette**.
3. Chuyển sang thẻ **Install**, gõ tìm kiếm: `node-red-dashboard`.
4. Bấm nút **Install** bên cạnh mục `node-red-dashboard` và chờ khoảng 30 giây để hoàn tất.

---

## 3. Import Flow Middleware hoàn chỉnh (Chỉ mất 1 click)

Toàn bộ logic xử lý dữ liệu và các quy tắc tự động hóa (Automation Rules) đã được nén sẵn trong file [flows.json](flows.json):

1. Trong giao diện Node-RED ([http://127.0.0.1:1880](http://127.0.0.1:1880)):
   - Bấm vào biểu tượng **Menu (☰)** góc phải trên → Chọn **Import**.
2. Chọn thẻ **select a file to import** rồi trỏ tới file:
   `d:\Study\2026\Nam04_HK1\IOT_T.HoangHai\IOT_Safey_GasCheck\nodered\flows.json`
   *(Hoặc mở file `flows.json` bằng Notepad, copy toàn bộ nội dung và dán vào ô trống)*.
3. Chọn **Import out of current flow** (hoặc import vào flow mới).
4. Bấm nút **Import** màu đỏ.
5. Bấm nút **Deploy** màu đỏ ở góc trên cùng bên phải để kích hoạt luồng hoạt động!

---

## 4. Chi tiết các thành phần trong Flow đã tạo

Flow bao gồm 4 nhóm chức năng chính thể hiện đúng chuẩn **Tầng 3 - Middleware**:

### Nhóm 1: Tiếp nhận và chuẩn hóa dữ liệu Telemetry (Uplink)
- Node `Sub: Telemetry` lắng nghe topic `gascheck/n19/telemetry`.
- Node `Middleware Data Processor & Context Storage` parse JSON, lưu trữ các biến môi trường vào bộ nhớ đệm (`flow.set`), tách dữ liệu sang đồng hồ đo và card trạng thái.

### Nhóm 2: Tiếp nhận sự kiện và Lưu lịch sử (Event History Buffer)
- Node `Sub: Events` nhận các cảnh báo khẩn cấp hoặc phản hồi lệnh từ ESP32.
- Node `Rule & Event History Buffer` định dạng ngày giờ chuẩn Việt Nam, tạo bảng HTML hiển thị 20 sự kiện gần nhất lên Dashboard (sự kiện DANGER có màu đỏ, ACCEPTED có màu xanh).

### Nhóm 3: Các quy tắc tự động hóa cốt lõi (Automation Rules)
1. **Automation Rule 1 (Sustained Danger Escalation):**
   - Theo dõi nếu gas duy trì mức nguy hiểm `DANGER >= 2500` liên tục qua 3 chu kỳ đo (khoảng 6 giây trở lên), Node-RED tự động kích hoạt cảnh báo leo thang cấp độ 2 (`CRITICAL`), sẵn sàng gửi tin nhắn Telegram khẩn cấp.
2. **Automation Rule 2 (Safety Interlock Reset Dispatcher - Chứng minh Middleware có xử lý):**
   - Khi người dùng bấm nút Reset trên Dashboard, Node-RED **không chuyển tiếp mù quáng** mà kiểm tra an toàn trước:
     - Nếu `Gas >= 1300` hoặc đang ở `DANGER`: Node-RED **CHẶN LẠI NGAY LẬP TỨC**, ghi cảnh báo từ chối vào nhật ký và không gửi gói tin xuống thiết bị.
     - Nếu `Gas < 1300` và trạng thái là `RECOVERY`: Node-RED cho phép phát lệnh `{"cmd": "REQUEST_RESET"}` xuống `gascheck/n19/cmd`.
3. **Automation Rule 3 (Test Alarm Dispatcher):**
   - Bấm nút test còi từ xa, tự động phát lệnh `{"cmd": "TEST_ALARM"}` xuống ESP32.
4. **Automation Rule 4 (Heartbeat & Network Watchdog Scheduler):**
   - Bộ đếm thời gian kích hoạt mỗi 5 giây kiểm tra thời điểm nhận telemetry gần nhất. Nếu quá 10 giây không có tín hiệu, phát cảnh báo `DEVICE_OFFLINE`.

---

## 5. Trải nghiệm Giao diện Dashboard

1. Mở tab mới trên trình duyệt và truy cập: [http://127.0.0.1:1880/ui](http://127.0.0.1:1880/ui)
2. Bạn sẽ thấy một Dashboard chuyên nghiệp với:
   - **Đồng hồ đo Gauge:** Kim đo nồng độ gas từ 0 đến 4095 với 3 dải màu Xanh (<1500), Vàng (1500–2500), Đỏ (>2500).
   - **Card trạng thái:** Hiển thị thời gian thực State (`NORMAL`, `WARNING`, `DANGER`), trạng thái Cửa sổ (`CLOSED`/`OPEN`), Còi (`ON`/`OFF`).
   - **Nút điều khiển:** Nút "🔄 YÊU CẦU RESET HỆ THỐNG" và "🔔 TEST CÒI BÁO ĐỘNG (2s)".
   - **Bảng lịch sử sự kiện:** Cập nhật tức thì các biến cố của hệ thống theo thời gian thực.

---

## 6. Chụp bằng chứng cho Báo cáo Tuần 5
Để hoàn thành báo cáo Tuần 5:
1. Chụp ảnh màn hình toàn bộ Flow trên Node-RED Editor (`http://127.0.0.1:1880`).
2. Chụp ảnh màn hình Dashboard (`http://127.0.0.1:1880/ui`) khi gas đang thay đổi.
3. Chụp ảnh cột Debug bên phải hiển thị Rule 1 (Escalation) hoặc Rule 2 (Chặn reset khi gas cao).
