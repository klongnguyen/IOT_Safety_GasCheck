# GasCheck V2 — Pinout đề xuất (ESP32 DevKit)

> Chỉ áp dụng **mô hình học tập không dùng gas thật**. GPIO và góc servo là **đề xuất**, cần kiểm tra phiên bản ESP32, mô-đun cụ thể và hành trình cửa sổ trước khi cấp nguồn.

## 1. Bảng chân

| Thiết bị | Tín hiệu | Chân ESP32 | Ghi chú |
|---|---|---|---|
| MQ2 | AO (analog) | GPIO34 / ADC1 | **Không đưa 5V vào ADC ESP32**; chia áp và kiểm tra dải điện áp |
| Servo SG90 | PWM signal | GPIO18 | Servo cấp nguồn 5V đủ dòng riêng, **GND chung** |
| Buzzer | điều khiển | GPIO23 | Dòng tải lớn cần transistor/driver, không nối trực tiếp quá khả năng GPIO |
| LED xanh | Anode qua điện trở | GPIO25 | Điện trở 220–330Ω |
| LED vàng | Anode qua điện trở | GPIO26 | Điện trở 220–330Ω |
| LED đỏ | Anode qua điện trở | GPIO27 | Điện trở 220–330Ω |
| GND | Ground | GND | Nối chung điện thế tham chiếu các khối |

Chân 25/26/27 tránh việc tận dụng nhầm GPIO34/35 vốn chỉ là input; GPIO34 thuộc ADC1 nên vẫn đọc được khi Wi-Fi bật. Không cần GPIO điều khiển quạt/relay hay MQ135.

## 2. Phân phối nguồn

- ESP32 sử dụng cáp USB/nguồn đúng quy cách bo mạch.
- Servo nên có nguồn 5V **có đủ dòng đỉnh**, nối GND nguồn servo với GND ESP32; không cấp động cơ từ GPIO.
- MQ2 module thường yêu cầu nguồn cho bộ gia nhiệt theo thông số module. Đầu ra AO có thể vượt điện áp 3,3V ESP32 cho phép: **đo/kiểm tra và dùng mạch chia áp phù hợp** trước khi nối GPIO34.
- Cọc đấu dây vít ren nối nguồn và tải **đúng cực, đúng giới hạn dòng và lực siết**; đánh dấu các cực. Không trộn đường tín hiệu 3,3V với 5V.
- LED cần điện trở riêng; một số buzzer có mạch điều khiển sẵn, loại khác cần mạch lái transistor.

## 3. Kết nối demo trên Wokwi

Dùng **1 potentiometer** (giả lập MQ2) có VCC 3,3V và GND nối mạch, chân giữa → GPIO34. Các GPIO đầu ra như bảng trên. Không mô phỏng MQ135, quạt, relay hoặc van gas.

- Servo: 0° = **CLOSED**; 90° = **OPEN**, chỉ là quy ước demo, cần đổi theo cơ cấu thực tế.
- LED xanh/yellow/red: chỉ một mức chính sáng, trừ chế độ nhấp nháy \`RECOVERY\`/\`FAULT\`.
- Ưu tiên kiểm tra nguồn servo và buzzer trước khi lắp sa bàn; nếu servo kẹt, không cố chạy cơ cấu.

## 4. Cần xác minh trước khi đóng mạch

- [ ] Đúng module MQ2 (AO/DO, nguồn nuôi, biên độ AO).
- [ ] Biên độ tín hiệu ADC khi dùng nguồn thật không vượt giới hạn ESP32.
- [ ] Dòng tiêu thụ servo, công suất nguồn, mass chung.
- [ ] Loại buzzer là active/passive và có cần mạch driver.
- [ ] LED có điện trở, không chập VCC/GND trên cọc đấu dây.
- [ ] Cửa sổ mini không bị kẹt ở góc kết thúc.
- [ ] Test bằng tín hiệu giả lập, **không dùng khí gas thật**.
