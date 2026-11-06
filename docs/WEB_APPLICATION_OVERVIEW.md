# 🌐 TỔNG QUAN TOÀN BỘ HỆ THỐNG WEB SMART ORDER BUTTON PLATFORM

Tài liệu này tổng hợp chi tiết toàn bộ các trang, phân hệ, tính năng, modal và luồng nghiệp vụ trên hệ thống Web của **Smart Order Button Platform** (phiên bản Production v4.0).

---

## 📌 1. BẢNG MỤC LỤC PHÂN HỆ & ĐƯỜNG DẪN (ROUTES)

| Phân hệ | Đường dẫn (URL) | Quyền truy cập (Role) | Chức năng chính |
|---|---|---|---|
| **Trang Chủ** | `/` | Công khai (Public) | Giới thiệu nền tảng, cơ chế 1 chạm, demo nút bấm tương tác |
| **Đăng Nhập** | `/login` | Công khai (Public) | Đăng nhập đa vai trò, có sẵn 4 tài khoản Demo 1-Click |
| **Đăng Ký** | `/register` | Công khai (Public) | Đăng ký tài khoản Khách hàng hoặc Cửa hàng mới |
| **Cửa Hàng — Tổng Quan** | `/store/dashboard` | `STORE_OWNER`, `STORE_MANAGER`, `STORE_STAFF` | KPI kinh doanh, Hàng đợi đơn hàng Realtime (Socket.IO) |
| **Cửa Hàng — Thiết Bị** | `/store/devices` | `STORE_OWNER`, `STORE_MANAGER`, `STORE_STAFF` | Quản lý đội nút bấm, In tem QR dán hộp, Đổi sản phẩm gán |
| **Cửa Hàng — Mẫu Thiết Bị** | `/store/device-templates` | `STORE_OWNER`, `STORE_MANAGER` | Quản lý mẫu cấu hình (debounce, thời gian hủy đơn, retry) |
| **Cửa Hàng — Kho Hàng** | `/store/products` | `STORE_OWNER`, `STORE_MANAGER`, `STORE_STAFF` | Quản lý danh mục mặt hàng, giá bán, tồn kho, SKU |
| **Cửa Hàng — Phân Tích** | `/store/analytics` | `STORE_OWNER`, `STORE_MANAGER` | Báo cáo chu kỳ tiêu dùng, dự đoán nhu cầu khách hàng |
| **Khách Hàng** | `/customer/home` | `CUSTOMER` | Xem danh sách nút bấm sở hữu, Đổi Wi-Fi, Chuyển nhượng |
| **Quản Trị Hệ Thống** | `/admin/dashboard` | `SUPER_ADMIN` | Quản trị toàn sàn, duyệt cửa hàng, tổng hợp giao dịch |
| **Mô Phỏng Phần Cứng** | `/simulator` | Công khai / Toàn quyền | Bàn thử nghiệm ESP32 Simulator với 10 lệnh phần cứng |

---

## 🖥️ 2. CHI TIẾT TỪNG PHÂN HỆ TRÊN WEB

### 2.1. Trang Chủ & Giới Thiệu (`/`)
* **Giao diện Hero Banner tương tác:** Nút bấm 3D trực quan có hiệu ứng nhấp nháy đèn LED Halo khi click chuột.
* **Mô phỏng chu trình Zero-Touch:**
  * *Mua nút ➔ Quét QR ➔ Nạp Wi-Fi nội bộ ➔ Nút Online ➔ Bấm nút ➔ Giao hàng*.
* **Bảng so sánh trải nghiệm:** So sánh tốc độ đặt hàng "Bấm 1 giây" của Nút bấm vật lý với "8 bước rườm rà" khi mở App điện thoại truyền thống.
* **Danh mục mặt hàng tiêu biểu:** Nước uống đóng bình (Lavie, Vĩnh Hảo), Bình Gas Petro 12kg, Gạo ST25, Dầu ăn...

---

### 2.2. Đăng Nhập & Xác Thực Đa Vai Trò (`/login` & `/register`)
* **Hỗ trợ 4 vai trò người dùng:**
  1. **Chủ Cửa Hàng (Store Owner):** Quản lý kho, xử lý đơn và quản lý đội nút bấm.
  2. **Khách Hàng (Customer):** Theo dõi các nút bấm đặt hàng trong gia đình.
  3. **Quản Trị Viên Sàn (Super Admin):** Giám sát toàn bộ hệ thống đại lý trên toàn quốc.
  4. **Kỹ Thuật Viên (Technician):** Kiểm tra thông số phần cứng, sóng RF, pin LiPo.
* **Chức năng 1-Click Demo:** Bấm trực tiếp vào các nút tài khoản mẫu để đăng nhập ngay lập tức mà không cần gõ mật khẩu.

---

### 2.3. Phân Hệ Quản Trị Cửa Hàng (Store Management)

#### A. Trang Bảng Điều Khiển & Đơn Hàng Realtime (`/store/dashboard`)
* **Thẻ số liệu KPI thời gian thực:**
  * Tổng doanh thu trong ngày (VND).
  * Tổng số đơn hàng được kích hoạt từ nút bấm vật lý.
  * Số lượng nút bấm đang Online / Tổng thiết bị đã xuất xưởng.
  * Tỷ lệ hủy đơn trong cửa sổ cho phép (60 giây).
* **Hàng đợi đơn hàng trực tiếp (Live Orders Queue):**
  * Tích hợp WebSocket (Socket.IO): Khi khách hàng nhấn nút ở nhà, giao diện cửa hàng **ngay lập tức phát âm thanh báo động và hiển thị thẻ đơn hàng mới** mà không cần F5 load lại trang.
  * Các nút thao tác nghiệp vụ:
    * `Nhận đơn` ➔ `Đang giao hàng` ➔ `Hoàn tất đơn`.
    * Xem thông tin khách hàng: Tên, Số điện thoại, Số phòng / Căn hộ, Tòa nhà.
* **Biểu đồ phân tích đơn hàng:** Thống kê biểu đồ cột số lượng đơn theo từng khung giờ trong ngày.

#### B. Trang Quản Lý Đội Nút Bấm Thiết Bị (`/store/devices`)
* **Thẻ trạng thái toàn đội thiết bị (Fleet KPI Breakdown):**
  * *Tổng thiết bị*: Toàn bộ nút bấm đã đăng ký trong kho.
  * *Đang Online*: Các nút có tín hiệu heartbeat định kỳ.
  * *Deep Sleep / Chờ ngắt*: Thiết bị ngủ sâu tiết kiệm pin (<15µA).
  * *Cảnh báo pin yếu*: Thiết bị có mức pin <20% cần sạc hoặc thay pin.
  * *Chưa cấu hình SKU*: Thiết bị chưa được gán sản phẩm đặt hàng.
* **Bộ lọc & Tìm kiếm nhanh:** Tìm kiếm theo Device ID, Tên nút, MAC, Vị trí hoặc lọc theo trạng thái hoạt động.
* **Nút `+ Thêm Nút Mới & In Tem QR` (Quy trình 2 bước thân thiện):**
  * *Bước 1*: Nhập tên nút (VD: *Nút Nước Bếp Ăn*) & Chọn sản phẩm gán sẵn (VD: *Lavie 20L*).
  * *Banner ghi chú rõ ràng*: Khách hàng người già chỉ cần quét QR, không bao giờ phải nhập MAC.
  * *Mục thu gọn nâng cao*: Ẩn các trường kỹ thuật (`Mã Device ID`, `Địa chỉ MAC`, `Claim Code`) chỉ dành cho xưởng nạp hàng loạt.
  * *Bước 2*: Xác nhận và hệ thống tự động sinh ID `SOB-XXXXXX`, sinh mã QR và mã hóa HMAC.
* **Modal In Tem QR Dán Hộp (Section 9 Official Spec):**
  * Bản xem trước tem nhãn chuẩn bao bì:
    * Tiêu đề: `SMART ORDER BUTTON`
    * Mã thiết bị: `Device SOB-000123`
    * Mã QR Code quét ghép nối bảo mật
    * Hướng dẫn: `Scan to Setup`
    * Cảnh báo: `Do not remove this label.`
  * Nút `In Tem Dán Hộp` gọi trực tiếp lệnh in của máy in mã vạch.
* **Modal Đổi Ánh Xạ Sản Phẩm / SKU (Dynamic Mapping):**
  * Cho phép chủ quán đổi sản phẩm gán cho nút bấm bất cứ lúc nào (VD: từ bình Nước 19L sang bình 20L) chỉ với 1 click, **không cần nạp lại firmware**.
* **Modal Xem Telemetry & Nhật Ký Kiểm Toán:**
  * Tab 1: Lịch sử điện áp pin LiPo, mức sóng Wi-Fi RSSI (dBm), thời gian online gần nhất.
  * Tab 2: Lịch sử kiểm toán (Audit Logs) ghi nhận ai đã đổi SKU, ai kích hoạt, ai gán quyền sở hữu.
* **Modal Nhập Hàng Loạt Qua File CSV (Bulk Import):**
  * Hỗ trợ tải lên danh sách hàng trăm nút bấm từ xưởng sản xuất, tự động kiểm tra cú pháp và nhập vào kho trong 2 giây.

#### C. Trang Mẫu Thiết Bị & Cấu Hình Hàng Loạt (`/store/device-templates`)
* Quản lý các cấu hình định sẵn:
  * Thời gian lọc rung chống nhấp đúp (Debounce time: 30s).
  * Cửa sổ thời gian cho phép nhấn đúp để hủy đơn (Cancel window: 60s).
  * Số lần tự động thử lại khi router chập chờn (Retry count & Exponential backoff).

#### D. Trang Quản Lý Kho Sản Phẩm (`/store/products`)
* Thêm mới, cập nhật sản phẩm của cửa hàng:
  * Tên mặt hàng, Mã SKU nhận diện, Giá bán, Đơn vị đóng gói, Số lượng tồn kho.
  * Khi khách hàng bấm nút đặt hàng, hệ thống tự động trừ kho an toàn (Atomic Transaction).

---

### 2.4. Phân Hệ Khách Hàng Tiêu Dùng (Customer Portal) (`/customer/home`)
* **Mục "Nút Bấm Của Tôi":**
  * Liệt kê các nút bấm mà khách hàng đang sở hữu trong căn hộ (VD: *Nút Nước Lavie Bếp*, *Nút Gas Kho*).
  * Trạng thái kết nối: `● ONLINE` hoặc `○ CHỜ KẾT NỐI`.
  * Cột hiển thị vạch pin và chất lượng sóng Wi-Fi thực tế.
  * Nút bấm ảo **"Bấm Đặt Ngay"**: Khách có thể test thử hoặc đặt hàng trực tiếp từ web khi đang ngồi máy tính.
* **Tính năng "Đổi Wi-Fi" (Change Wi-Fi):**
  * Khi khách thay đổi cục phát Wi-Fi hoặc đổi mật khẩu nhà:
  * Bấm nút này, nút bấm sẽ mở lại cổng nạp Wi-Fi BLE mà **giữ nguyên quyền sở hữu và sản phẩm đã gán**, khách không bị mất tài khoản.
* **Tính năng "Chuyển Nhượng" (Transfer Device):**
  * Khách hàng muốn tặng lại nút bấm cho người thân hoặc chuyển nhà:
  * Bấm nút để sinh mã QR chuyển nhượng mới có thời hạn 10 phút để người mới quét nhận nút.
* **Lịch sử đơn hàng cá nhân:**
  * Xem danh sách các lần bấm nút, ngày giờ giao, trạng thái đơn và tiền thanh toán.
* **Địa chỉ nhận hàng mặc định:**
  * Lưu số nhà, số tầng, số phòng để nhân viên cửa hàng mang nước/gas lên tận cửa.

---

### 2.5. Phân Hệ Quản Trị Hệ Thống (Admin)

#### A. Trang Quản Trị Sàn Toàn Quốc (`/admin/dashboard`)
* Tổng quan số lượng cửa hàng đại lý đang hoạt động trên hệ thống.
* Tổng lưu lượng đơn hàng phát sinh từ các nút bấm trên toàn quốc.
* Quản lý phê duyệt đại lý cửa hàng mới.

Security Hub đã được gỡ khỏi giao diện admin. Các cơ chế bảo mật thiết bị và API/backend hiện có vẫn được giữ nguyên.

---

### 2.6. Phân Hệ Mô Phỏng Phần Cứng (ESP32 Hardware Simulator Bridge) (`/simulator`)
Đây là công cụ phòng lab mạnh mẽ cho phép chạy thử nghiệm và nghiệm thu toàn bộ hoạt động của vi điều khiển ESP32 ngay trên trình duyệt:
* **Nút bấm phần cứng 3D có phản hồi cơ học:**
  * Hiệu ứng đèn LED viền tròn (LED Halo):
    * 🟣 *Tím*: Đang phát BLE / SoftAP chờ cấu hình Wi-Fi.
    * 🟡 *Vàng nhấp nháy*: Đang kết nối router và gọi Cloud.
    * 🟢 *Xanh lá*: Đặt hàng thành công! (Bắn pháo hoa Confetti chúc mừng).
    * 🔴 *Đỏ*: Có lỗi (Mất mạng, hết hàng hoặc sai chữ ký).
* **Đầy đủ 10 lệnh điều khiển phần cứng (Section 52 Spec):**
  1. `[1] Single Press`: Bấm 1 lần để tạo đơn hàng có chữ ký HMAC-SHA256.
  2. `[2] Double Press`: Nhấn đúp trong 60 giây để hủy đơn và hoàn kho.
  3. `[3] Bật Provisioning`: Bật BLE GATT & SoftAP 192.168.4.1.
  4. `[4] Nạp Wi-Fi`: Nạp tên Wi-Fi và mật khẩu vào bộ nhớ NVS Flash.
  5. `[5] Bootstrap Cloud`: Bắn gói tin xác thực phần cứng lên máy chủ.
  6. `[6] Mô phỏng Offline`: Thử nghiệm ngắt kết nối mạng router.
  7. `[7] Factory Reset`: Giữ 15s xóa Wi-Fi, giữ nguyên định danh Device ID.
  8. `[8] Show Telemetry`: Hiển thị pin, điện áp mV, RSSI.
  9. `[9] Device State`: Xem trạng thái máy trạng thái vi điều khiển (State Machine).
  10. `[0] Long Press`: Giữ nút 10 giây hoặc 15 giây.
* **Màn hình UART Serial Monitor (115200 Baud):** Hiển thị log ngắt vi điều khiển, chu kỳ thức dậy từ chế độ ngủ sâu (Deep Sleep RTC Wakeup) và các phản hồi mạng.
* **Trình soi gói tin (Packet Inspector):** Hiển thị trực quan Payload và chữ ký mã hóa `HMAC_SHA256(Secret, DeviceId:Timestamp:Nonce:Body)`.

---

## 🔒 3. CƠ CHẾ BẢO MẬT & ZERO-TOUCH XUYÊN SUỐT TRÊN WEB

1. **Khách hàng không cần kiến thức kỹ thuật (Zero-Touch):**
   * Không bao giờ hiển thị địa chỉ IP, cổng Port, MAC address hay mã nhị phân cho khách hàng tiêu dùng.
   * Khách hàng chỉ thao tác: **Quét mã QR ➔ Chọn Wi-Fi ➔ Xong**.
2. **Bảo mật thông tin Wi-Fi:**
   * Mật khẩu Wi-Fi của nhà khách hàng **không bao giờ gửi lên Web Cloud**, chỉ truyền trực tiếp qua Bluetooth nội bộ vào nút bấm.
3. **Chống trùng đơn (Anti-Spam Idempotency):**
   * Khách bấm liên tục nhiều lần cũng chỉ tạo 1 đơn hàng duy nhất nhờ mã `requestId` và cơ chế lọc rung (debounce).
4. **Phân quyền chặt chẽ (RBAC):**
   * Các trang quản trị (`/store/*`, `/admin/*`) được bảo vệ bằng JWT Guard, ngăn chặn người dùng thường truy cập trái phép.

---

## 🚀 4. HƯỚNG DẪN TRUY CẬP & TRẢI NGHIỆM HỆ THỐNG

1. **Khởi chạy Web:**
   * Mở trình duyệt truy cập: [`http://localhost:5173`](http://localhost:5173)
2. **Thử nghiệm vai trò Cửa Hàng:**
   * Truy cập: [`http://localhost:5173/login`](http://localhost:5173/login) ➔ Chọn **"Đăng nhập: Store Owner"**.
   * Vào menu **"Thiết bị"** (`/store/devices`): Trải nghiệm tạo nút bấm mới, xem tem QR và đổi sản phẩm gán.
   * Vào menu **"Bảng điều khiển"** (`/store/dashboard`): Đón nhận chuông báo đơn hàng realtime.
3. **Thử nghiệm vai trò Khách Hàng:**
   * Chọn **"Đăng nhập: Khách Hàng"** (`/customer/home`): Xem danh sách nút bấm gia đình, bấm thử đặt hàng ảo.
4. **Thử nghiệm mô phỏng phần cứng:**
   * Bấm vào tab **"ESP32 Simulator"** (`/simulator`): Trải nghiệm 10 lệnh phần cứng và bấm nút tạo đơn hàng trực tiếp lên Cửa hàng!
