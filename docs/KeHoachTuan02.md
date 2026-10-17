# 📋 KẾ HOẠCH TUẦN 2 — SIMULATION VẬT LÝ GASCHECK V2

> **Dự án:** IOT-Safety-GasCheck · Nhóm N19 · Đề tài 06  
> **Phiên bản:** 17/10/2026 · **Milestone:** M1 – Device Prototype (Simulation)  
> **Tham chiếu chuẩn:** [Kiến trúc vật lý V2](KienTrucVatLy_GasCheck_V2.md) · [Pinout V2](wiring/Pinout_V2.md)

## 1. Mục tiêu

Dựng được luồng **MQ2 giả lập → ESP32 → 3 LED + buzzer + servo mở cửa sổ mini** trên Wokwi, đảm bảo cảnh báo cục bộ hoạt động khi không có mạng. Viết firmware đọc ADC, lọc tín hiệu, state machine, ghi log JSON qua Serial để tuần 4 mở rộng MQTT.

**Không thực hiện:** MQ135, quạt, relay, van gas; không dùng khí gas thật. Phạm vi chất lượng không khí từ đề gốc cần xác nhận với giảng viên.

## 2. Sơ đồ mô phỏng và quy ước

- Wokwi: ESP32, 1 potentiometer đại diện tín hiệu MQ2, servo SG90, buzzer, 3 LED với mỗi LED 1 điện trở 220–330Ω.
- Potentiometer 3,3V → GPIO34/ADC1, không cấp 5V trực tiếp ADC.
- Servo tín hiệu GPIO18; 0° = cửa sổ đóng, 90° = mở (chỉ quy ước sa bàn).
- Buzzer GPIO23 (mô phỏng); khi làm vật lý thực cần driver nếu dòng vượt ngưỡng GPIO.
- LED xanh GPIO25, vàng GPIO26, đỏ GPIO27.
- Không có nhánh GPIO dành cho quạt, relay, MQ135.

## 3. State machine & rule cục bộ

| State | Input mô phỏng | LED | Buzzer | Servo |
|---|---|---|---|---|
| NORMAL | ADC thấp | Xanh | OFF | Đóng |
| WARNING | ADC vượt ngưỡng cảnh báo | Vàng | Nhịp ngắt quãng | Đóng |
| DANGER | ADC vượt ngưỡng nguy hiểm | Đỏ | ON liên tục | Mở |
| RECOVERY | ADC giảm, đủ kiểm tra ổn định nhưng chưa reset | Vàng nhấp nháy | Giữ trạng thái cảnh báo chờ xác nhận | Giữ mở |
| FAULT | Không đọc hợp lệ/lỗi được mô phỏng | Đỏ nhấp nháy | Mẫu báo lỗi | Không tự cưỡng bức đóng |

Ngưỡng **demo**: \`WARNING >= 1500\`, \`DANGER >= 2500\` (ADC 12-bit 0–4095), chỉ dùng để kiểm tra phần mềm; không tương ứng với ngưỡng khí an toàn thật. Bổ sung hysteresis/debounce để tránh nhấp nháy. Khi nguy hiểm đang tồn tại, lệnh RESET phải bị từ chối. Servo không tự đóng ngay sau khi giá trị giảm mà phải qua RECOVERY và xác nhận.

## 4. Phân công nhóm

### Trình Quốc An — Sensing / Embedded

1. Dựng mạch Wokwi và lưu \`simulation/diagram.json\`.
2. Viết firmware: \`readGasADC()\`, \`filterGas()\`, \`classifyState()\`, \`setWindowPosition()\`, \`setBuzzerPattern()\`, \`updateLeds()\`.
3. Kiểm tra PWM servo và chu kỳ buzzer không xung đột; kiểm tra góc mở thật của cửa mini nếu có sa bàn.
4. Tài liệu kết nối ghi rõ ESP32 chỉ nhận điện áp ADC phù hợp.

### Nguyễn Kim Long — Network / Middleware, chuẩn hóa dữ liệu

1. Review pinout ADC1, GND, nguồn servo, bảo vệ ADC và LED.
2. Chuẩn bị Serial telemetry JSON, ví dụ:
   \`\`\`json
   {
     "device_id": "n19-gascheck-01",
     "gas_raw": 1100,
     "state": "NORMAL",
     "led": "GREEN",
     "buzzer": false,
     "window": "CLOSED",
     "sensor_fault": false
   }
   \`\`\`
3. Draft topic \`gascheck/n19/telemetry\`, \`event\`, \`status\`, \`cmd\` cho tuần 4.
4. Review lại tài liệu V2 và bằng chứng commit.

### Nguyễn Long Vỹ — Application / Automation & QA

1. Xây ma trận test theo 3 mức và RECOVERY, FAULT, reset an toàn.
2. Test Wokwi bằng potentiometer; chụp sơ đồ, Serial và góc servo.
3. Đề xuất dashboard: gas_raw, state, led, buzzer, window, fault; không còn air-quality/fan/valve widget.
4. Chuẩn bị luồng thông báo Telegram của tuần 6.

## 5. Test cases

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC01 | MQ2 giả lập dưới warning | LED xanh, buzzer OFF, servo đóng |
| TC02 | MQ2 giả lập đạt warning | LED vàng, buzzer ngắt quãng, servo giữ đóng |
| TC03 | MQ2 giả lập đạt danger | LED đỏ, buzzer liên tục, servo mở cửa sổ |
| TC04 | Giá trị nhiễu quanh ngưỡng | Không dao động liên tục nhờ hysteresis |
| TC05 | Từ danger giảm về thấp | Chuyển RECOVERY, không tự đóng servo |
| TC06 | Reset khi còn danger | Từ chối reset |
| TC07 | Reset khi đã safe ổn định | Về NORMAL, servo đóng (demo) |
| TC08 | Tắt network/không kết nối | Cảnh báo local vẫn đúng |
| TC09 | Mất ADC/lỗi nguồn tín hiệu mô phỏng | Không tự hiển thị NORMAL; phát FAULT theo quy tắc |
| TC10 | Log Serial | JSON hợp lệ, không còn trường fan/valve/air_quality |

## 6. Deliverables và Definition of Done

- [ ] Link chạy Wokwi có kiểm thử.
- [ ] \`simulation/diagram.json\` và cấu hình simulation phù hợp khi thực sự tạo.
- [ ] Firmware trong \`esp32/src/\` hoặc đường dẫn thống nhất.
- [ ] [Pinout V2](wiring/Pinout_V2.md) được review và thử đối chiếu.
- [ ] Bằng chứng \`evidence/w2/\` (ảnh, JSON log, bảng test pass/fail).
- [ ] Servo mở cửa sổ ở DANGER; 3 LED và buzzer chạy đúng trạng thái.
- [ ] Mất kết nối không ảnh hưởng tới cảnh báo local.
- [ ] Không dùng khí gas thật để demo.

**Trạng thái:** đây là **kế hoạch thực hiện**, không đồng nghĩa đã chạy Wokwi hoặc đã nghiệm thu M1.
