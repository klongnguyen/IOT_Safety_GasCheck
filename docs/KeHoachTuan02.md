# 📋 KẾ HOẠCH HÀNH ĐỘNG TUẦN 2: SIMULATION TẦNG 1 (SENSING / PHYSICAL)

> **Dự án:** Hệ thống IoT cảnh báo rò rỉ Gas & chất lượng không khí (`IOT-Safety-GasCheck`)  
> **Nhóm thực hiện:** N19 · **Mã đề tài:** 06 · **Nhóm ứng dụng:** Safety  
> **Thành viên:** Trình Quốc An – Nguyễn Kim Long – Nguyễn Long Vỹ  
> **Mục tiêu nghiệm thu:** **Milestone M1 – Device Prototype (Simulation)**

---

## 1. 🎯 Mục tiêu cốt lõi của Tuần 2

1. **Dựng mạch mô phỏng hoàn chỉnh trên Wokwi:** Kết nối vi điều khiển ESP32 với đầy đủ cảm biến đầu vào và cơ cấu chấp hành đầu ra.
2. **Hiện thực hóa Local Safety Logic (An toàn tại chỗ):** Khi nồng độ gas tăng vượt ngưỡng nguy hiểm, ESP32 phải **lập tức đóng van, bật quạt và hú còi cục bộ** mà không cần phụ thuộc vào mạng Internet hay MQTT.
3. **Chuẩn hóa luồng dữ liệu:** Định dạng sẵn chuỗi dữ liệu JSON xuất ra Serial Monitor để chuẩn bị cho việc truyền thông MQTT ở các tuần sau.

---

## 2. ⚙️ Thiết kế phần cứng & Quy ước chân nối (Pin Mapping)

### 2.1. Quy ước linh kiện mô phỏng trên Wokwi

- **MQ-2 (Cảm biến Gas) & MQ-135 (Không khí):** Do Wokwi chưa có module MQ chuyên dụng, nhóm sử dụng **Potentiometer (biến trở chiết áp 10k)** để giả lập tín hiệu điện áp analog (0 – 3.3V) đưa vào chân ADC của ESP32.
- **Van ngắt Gas:** Dùng **Servo SG90** mô phỏng đóng/mở van cơ học (Góc **0° = MỞ**, Góc **90° = ĐÓNG**).
- **Quạt thông gió:** Dùng **LED xanh dương + Relay** đại diện cho trạng thái bật/tắt quạt.
- **Còi báo động:** Dùng **Piezo Buzzer** phát âm tần báo nguy cấp.
- **Hệ thống LED:** 3 LED chỉ thị trạng thái: **Xanh** (Bình thường) – **Vàng** (Cảnh báo khí bẩn) – **Đỏ** (Nguy hiểm gas).

### 2.2. Bảng phân bổ chân ESP32 (Bắt buộc dùng ADC1)

> [!IMPORTANT]
> Tuyệt đối dùng các chân thuộc **ADC1** (GPIO 34, 35) cho cảm biến để tránh xung đột với Wi-Fi khi kích hoạt tầng mạng ở Tuần 4.

| Linh kiện                   | Chân linh kiện      | Chân ESP32  | Chức năng & Tín hiệu                |
| --------------------------- | ------------------- | ----------- | ----------------------------------- |
| **Biến trở 1 (MQ-2 Gas)**   | Chân giữa (SIG)     | **GPIO 34** | Analog IN (ADC1_CH6, 0 – 4095)      |
| **Biến trở 2 (MQ-135 AQI)** | Chân giữa (SIG)     | **GPIO 35** | Analog IN (ADC1_CH7, 0 – 4095)      |
| **Servo van Gas**           | Chân tín hiệu PWM   | **GPIO 18** | PWM OUT điều khiển góc 0° / 90°     |
| **Quạt thông gió (Fan)**    | Chân kích Relay/LED | **GPIO 19** | Digital OUT (HIGH = Bật, LOW = Tắt) |
| **Còi Buzzer**              | Chân dương (+)      | **GPIO 21** | PWM / Tone OUT phát âm báo động     |
| **LED Xanh (Normal)**       | Anode (+)           | **GPIO 2**  | Sáng khi hệ thống an toàn           |
| **LED Vàng (Warning)**      | Anode (+)           | **GPIO 4**  | Sáng khi chất lượng không khí xấu   |
| **LED Đỏ (Danger)**         | Anode (+)           | **GPIO 5**  | Sáng / Chớp khi rò rỉ khí gas       |

---

## 3. 👥 Phân công chi tiết: Làm việc gì & Làm như thế nào?

---

### 3.1. Trình Quốc An – Phụ trách Sensing / Embedded

#### Việc 1: Dựng sơ đồ nguyên lý mạch mô phỏng trên Wokwi

- **Làm việc gì:** Thiết kế hoàn chỉnh mạch điện gồm ESP32 và toàn bộ linh kiện trên Wokwi, xuất file cấu hình `diagram.json`.
- **Làm như thế nào:**
  1. Tạo project Wokwi mới với vi điều khiển `board-esp32-devkit-c-v4`.
  2. Kéo thả 2 chiết áp, 1 servo SG90, 1 quạt (LED/Relay), 1 buzzer và 3 LED trạng thái kèm điện trở hạn dòng (220Ω).
  3. Tiến hành nối dây chính xác theo bảng [Mục 2.2](#22-bang-phan-bo-chan-esp32-bat-buoc-dung-adc1), nối chung tất cả chân GND về chân GND của ESP32.
  4. Lưu project và tải file `diagram.json` đưa vào thư mục `simulation/` của repository.

#### Việc 2: Lập trình Firmware V1 (Đọc cảm biến & Điều khiển cơ cấu)

- **Làm việc gì:** Viết mã nguồn đọc tín hiệu analog từ cảm biến và hàm điều khiển từng thiết bị đầu ra.
- **Làm như thế nào:**
  1. Dùng `analogRead(34)` và `analogRead(35)` để lấy mẫu dữ liệu. Thực hiện thuật toán lấy trung bình cộng 5 mẫu đo liên tiếp để khử rung/nhiễu.
  2. Cài đặt thư viện `ESP32Servo`, khai báo đối tượng servo gán vào GPIO 18.
  3. Viết các hàm con độc lập:
     - `setGasValve(bool closeState)`: xuất góc 90° nếu đóng, 0° nếu mở.
     - `setExhaustFan(bool state)`: xuất `digitalWrite(19, HIGH/LOW)`.
     - `setAlarmBuzzer(bool state)`: kích hoạt phát âm tần số 2500Hz trên GPIO 21.
     - `updateStatusLeds(int state)`: bật đúng màu LED tương ứng với trạng thái.

#### Việc 3: Hiện thực hóa Logic an toàn cục bộ (Local Safety Logic)

- **Làm việc gì:** Viết thuật toán quyết định trạng thái hệ thống và tự động kích hoạt cơ cấu bảo vệ.
- **Làm như thế nào:**
  1. Thiết lập ngưỡng thử nghiệm: `GAS_THRESHOLD = 2500`, `AQI_THRESHOLD = 1500`.
  2. Kiểm tra điều kiện ưu tiên:
     - **Ưu tiên 1 (Nguy hiểm gas):** Nếu `gasRaw >= GAS_THRESHOLD` $\rightarrow$ Chuyển state sang `DANGER` $\rightarrow$ Tự động gọi đóng van ngay lập tức, bật quạt thông gió và bật còi hú.
     - **Ưu tiên 2 (Không khí xấu):** Nếu `aqiRaw >= AQI_THRESHOLD` và gas an toàn $\rightarrow$ Chuyển state `WARNING` $\rightarrow$ Bật quạt, giữ van mở, tắt còi.
     - **Ưu tiên 3 (Bình thường):** Cả hai dưới ngưỡng $\rightarrow$ State `NORMAL` $\rightarrow$ Giữ van mở, tắt quạt, tắt còi.
  3. Dùng biến đếm thời gian `millis()` để định chu kỳ kiểm tra (200ms/lần), tuyệt đối không dùng `delay()` cứng làm đơ mạch.

---

### 3.2. Nguyễn Kim Long – Phụ trách Network / Middleware & Chuẩn hóa

#### Việc 1: Thiết lập cấu trúc Repository & Quản lý Source Code

- **Làm việc gì:** Quy hoạch cây thư mục dự án và quản lý phiên bản mã nguồn trên GitHub.
- **Làm như thế nào:**
  1. Tạo và sắp xếp các thư mục chuẩn:
     ```text
     ├── simulation/          # diagram.json, wokwi.toml
     ├── esp32/src/           # main.cpp hoặc sketch.ino
     ├── docs/wiring/         # pinout_v1.md
     └── evidence/w2/         # ảnh chụp màn hình, logs, video
     ```
  2. Tạo branch làm việc `feature/simulation-v1`, thiết lập file `.gitignore` để không commit rác.
  3. Hướng dẫn nhóm commit theo quy chuẩn: `feat:`, `fix:`, `docs:`.

#### Việc 2: Chuẩn hóa dữ liệu Serial Monitor thành chuỗi JSON (Tiền đề MQTT)

- **Làm việc gì:** Lập trình hàm in log trạng thái ra Serial theo đúng cấu trúc payload JSON chuẩn bị cho MQTT ở Tuần 4.
- **Làm như thế nào:**
  1. Viết hàm `printTelemetryJson()` trong firmware: gom các biến dữ liệu thành một chuỗi JSON hợp lệ.
  2. Cấu trúc chuỗi mẫu in ra mỗi giây một lần:
     ```json
     {
       "device_id": "device01",
       "gas_raw": 850,
       "air_quality": 620,
       "state": "NORMAL",
       "valve": "OPEN",
       "fan": false,
       "buzzer": false
     }
     ```
  3. Kiểm tra tính hợp lệ của chuỗi JSON bằng Serial Monitor (đảm bảo parse được, không bị vỡ chuỗi).

#### Việc 3: Kiểm tra chéo mạch điện & Đo kiểm xung tín hiệu

- **Làm việc gì:** Rà soát thiết kế phần cứng của Quốc An và biên soạn tài liệu sơ đồ chân nối.
- **Làm như thế nào:**
  1. Kiểm tra chéo toàn bộ dây nối trên Wokwi: đảm bảo chân ADC nằm trọn trong khối ADC1, các chân điều khiển không bị trùng nhau.
  2. Chạy thử đồng thời còi buzzer và servo để xem có hiện tượng xung đột Timer/LEDC hay không.
  3. Biên soạn tài liệu chi tiết `docs/wiring/pinout_v1.md` ghi chú rõ chức năng, dải điện áp và màu dây quy ước.

---

### 3.3. Nguyễn Long Vỹ – Phụ trách Application / Automation & QA

#### Việc 1: Xây dựng Ma trận kịch bản kiểm thử Tầng 1 (Test Matrix)

- **Làm việc gì:** Lập bảng kịch bản kiểm thử chi tiết để cả nhóm bám sát khi test mô phỏng.
- **Làm như thế nào:**
  1. Quy định rõ 4 kịch bản kiểm thử cốt lõi: Normal, Air Warning, Gas Danger, Recovery.
  2. Xác định rõ giá trị đầu vào (vị trí vặn chiết áp), trạng thái máy và hành vi mong đợi của van, quạt, còi, đèn LED (chi tiết tại [Mục 4](#4-bo-kich-ban-kiem-thu-tuan-2)).

#### Việc 2: Thực thi kiểm thử & Thu thập bằng chứng minh chứng (Evidence)

- **Làm việc gì:** Vận hành mạch mô phỏng theo từng kịch bản, ghi nhận kết quả và chụp ảnh bằng chứng.
- **Làm như thế nào:**
  1. Trực tiếp kéo slider biến trở trên Wokwi theo các mức giá trị của từng kịch bản test.
  2. Chụp màn hình (screenshot) rõ cả 2 phần: trạng thái linh kiện trên Canvas (góc xoay servo, màu LED) và dữ liệu log in ra trên Serial Monitor.
  3. Lưu các hình ảnh vào thư mục `evidence/w2/` với tên file chuẩn: `tc01-normal.png`, `tc02-warning.png`, `tc03-danger.png`, `tc04-recovery.png`.

---

## 4. 🧪 Bộ kịch bản kiểm thử Tuần 2

| Mã Test  | Kịch bản                             | Tín hiệu Input                              | Hành vi thiết bị mong đợi                                                                                    | Kết quả Đạt (Pass)                                                                                  |
| :------: | ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **TC01** | **Bình thường (Normal)**             | MQ-2 thấp (< 1500)<br/>MQ-135 sạch (< 1500) | • Van Gas: **MỞ (0°)**<br/>• Quạt: **TẮT** · Còi: **TẮT**<br/>• LED: **Xanh SÁNG**                           | Mạch yên tĩnh, van mở cho gas lưu thông, log in `state: NORMAL`.                                    |
| **TC02** | **Cảnh báo không khí (Air Warning)** | MQ-2 thấp (< 1500)<br/>MQ-135 cao (>= 1500) | • Van Gas: **MỞ (0°)**<br/>• Quạt: **BẬT (Thông khí)**<br/>• Còi: **TẮT** · LED: **Vàng SÁNG**               | Quạt lập tức chạy để hút khí bẩn, van gas không bị đóng nhầm, còi không hú.                         |
| **TC03** | **Khẩn cấp rò rỉ Gas (Gas Danger)**  | MQ-2 vượt ngưỡng (>= 2500)                  | • Van Gas: **ĐÓNG NGAY (90°)**<br/>• Quạt: **BẬT CỰC ĐẠI**<br/>• Còi: **HÚ LIÊN TỤC**<br/>• LED: **Đỏ SÁNG** | **Phản xạ tức thì:** Van đóng chặt 90° cắt nguồn gas, còi hú vang báo động, log in `state: DANGER`. |
| **TC04** | **Phục hồi an toàn (Recovery)**      | MQ-2 giảm về mức an toàn (< 1500)           | • Van Gas: **GIỮ NGUYÊN ĐÓNG (90°)**<br/>• Quạt: **TIẾP TỤC BẬT**<br/>• Còi: **TẮT** · LED: **Vàng/Xanh**    | Van **không được tự động mở lại** để phòng ngừa rủi ro; phải chờ xác nhận an toàn.                  |

---

## 5. 📦 Sản phẩm bàn giao (Deliverables W2)

Cả nhóm cần hoàn thiện và đưa lên repository đủ 6 sản phẩm sau:

1. 🔗 **Link Public Simulation Wokwi V1:** Link chạy trực tiếp trên trình duyệt web.
2. 📄 **File cấu hình:** `simulation/diagram.json` và `simulation/wokwi.toml`.
3. 💻 **Source code Firmware V1:** `esp32/src/main.cpp` đầy đủ chú thích rõ ràng.
4. 🗺️ **Tài liệu chân nối:** `docs/wiring/pinout_v1.md` mô tả chi tiết sơ đồ GPIO.

---

## 6. Checklist nghiệm thu Milestone M1 (Device Prototype)

- [ ] Mạch Wokwi khởi động được, không báo lỗi thiếu linh kiện hay chập mạch.
- [ ] Đọc đồng thời được 2 kênh analog qua chân ADC1 (GPIO 34, 35).
- [ ] Servo SG90 quay dứt khoát giữa 2 góc 0° (Mở) và 90° (Đóng).
- [ ] Quạt và còi phản ứng chính xác theo từng mức ngưỡng khí.
- [ ] Logic an toàn chạy hoàn toàn tại chỗ (Local) trên ESP32, không cần mạng.
- [ ] Chuỗi Serial in ra đúng cấu trúc JSON, không bị tràn bộ đệm.
- [ ] Cả 3 thành viên (**An, Long, Vỹ**) đều nắm rõ sơ đồ nguyên lý và biết cách vận hành mô phỏng trên máy cá nhân để trả lời vấn đáp.
