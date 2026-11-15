# ĐỀ XUẤT KIẾN TRÚC LƯU TRỮ & XỬ LÝ HÌNH ẢNH BẰNG CHỨNG GIAO HÀNG (POD)
> **Chuẩn hóa theo mô hình các nền tảng công nghệ giao vận lớn (Shopee, Grab, Amazon Logistics)**  
> **Tài liệu bàn giao cho Backend Team**  
> *Ngày tạo: 15/11/2026*  
> *Mục đích: Tối ưu chi phí lưu trữ, tăng cường bảo mật dữ liệu khách hàng (PII), chống tài xế gian lận và giảm tải cho máy chủ API trong giờ cao điểm.*

---

## 1. Bối cảnh & Đánh giá hiện trạng hệ thống

### 1.1. Những điểm đã làm rất tốt ở hiện tại
- **Phân tách thư mục theo gian hàng:** Lưu ảnh theo cấu trúc cô lập `stores/{storeId}/pod/`.
- **Kiểm tra an toàn file (Magic Bytes):** Backend đã có hàm `validateImageMagicBytes` để kiểm tra định dạng ảnh thực tế (`JPG`, `PNG`, `WEBP`, `GIF`), chống tấn công đổi đuôi file để tải mã độc (RCE).
- **Cơ chế chống tái sử dụng ảnh (Anti-Fraud Lock):** Backend đã áp dụng Transaction Lock PostgreSQL:
  ```sql
  SELECT pg_advisory_xact_lock(hashtext('pod_claim:' || $canonicalSubpath));
  ```
  Ngăn chặn việc dùng cùng 1 ảnh POD cho nhiều đơn hàng khác nhau.

### 1.2. Các hạn chế và rủi ro khi hệ thống mở rộng (Bottlenecks)
1. **Chi phí lưu trữ Cloudinary cao khi số lượng đơn tăng mạnh:**
   - Cloudinary rất tối ưu cho ảnh sản phẩm và marketing (cần crop, resize, CDN thương mại).
   - Tuy nhiên, ảnh POD giao hàng phát sinh hàng nghìn đến hàng triệu file mỗi ngày. Chi phí dung lượng và băng thông Cloudinary sẽ tăng theo cấp số nhân.
2. **Thiếu chính sách vòng đời dữ liệu (Data Lifecycle / Retention Policy):**
   - Hiện tại ảnh POD đang lưu **vĩnh viễn**.
   - Thực tế nghiệp vụ: Khách hàng và quán chỉ xem ảnh đối soát trong **3 - 7 ngày đầu**. Sau 30 - 60 ngày, đơn đã quyết toán thì ảnh POD không còn giá trị, gây lãng phí lớn tài nguyên lưu trữ.
3. **Tải ảnh qua máy chủ Backend trung gian (`POST /media/upload-pod`):**
   - File ảnh từ máy tài xế được gửi qua RAM của Backend API trước khi đẩy lên Cloud.
   - Vào khung giờ cao điểm (trưa/tối), hàng trăm tài xế cùng tải ảnh có thể làm nghẽn băng thông, tốn RAM và làm chậm các API đặt hàng quan trọng khác.
4. **Bảo mật & Quyền riêng tư (PII - Personally Identifiable Information):**
   - URL ảnh hiện tại là public (ai có link đều xem được). Ảnh giao hàng trước cửa nhà có thể lộ thông tin cá nhân, địa chỉ, số nhà, hoặc chân dung người nhận.

---

## 2. Kiến trúc mục tiêu (Target Architecture chuẩn Shopee / Grab)

```
[ App Tài xế / Web Driver ]
          |
          | 1. Xin chữ ký tải ảnh (Presigned URL)
          v
  [ Backend API Gateway ] 
          |
          | 2. Cấp Presigned Upload URL (Hạn 5 phút)
          v
[ App Tài xế / Web Driver ]
          |
          | 3. Tải trực tiếp (Direct Upload - WebP nén < 300KB)
          v
  [ Cloud Object Storage: Cloudflare R2 / AWS S3 ] (Private Bucket)
          |
          | 4. Gửi mã xác nhận (Object Key + Tọa độ GPS + Tiền COD)
          v
  [ Backend API & Database ]
          |
          | 5. Thiết lập Lifecycle Rule:
          |    - Ngày 0 - 7:  Hot Access (CDN)
          |    - Ngày 8 - 30: Warm / Infrequent Access
          |    - Ngày 60+:    Tự động Xóa vĩnh viễn (Expiration)
          v
     [ Tối ưu 85% chi phí lưu trữ & 0 tải RAM Server ]
```

---

## 3. Chi tiết 4 Trụ cột giải pháp đề xuất

### 3.1. Chuyển đổi tầng lưu trữ & Chính sách vòng đời (Object Storage & Lifecycle)
* **Dịch vụ khuyến nghị:** **Cloudflare R2** hoặc **AWS S3**.
  * *Ưu điểm của Cloudflare R2:* Miễn phí 100% băng thông tải ra (Zero Egress Fees), tương thích hoàn toàn chuẩn S3 API SDK, chi phí lưu trữ rẻ hơn Cloudinary từ 5 - 10 lần.
* **Cấu hình vòng đời dữ liệu (Lifecycle Rules):**
  * `0 - 7 ngày`: Lưu ở tầng Hot (Truy cập nhanh phục vụ đối soát, khiếu nại).
  * `8 - 30 ngày`: Chuyển sang Infrequent Access (Giảm 50% phí lưu trữ).
  * `Sau 60 ngày`: **Tự động xóa vĩnh viễn (Auto-deletion / Expired)**. Hệ thống chỉ lưu lại dòng lịch sử đơn hàng và log trạng thái trong CSDL.

### 3.2. Cơ chế tải trực tiếp từ Client (Direct-to-Storage via Presigned URL)
Thay vì gửi tệp Multipart qua Backend, áp dụng luồng Presigned Upload:
1. Client gọi: `POST /api/v1/media/pod/presigned-upload` kèm `{ orderId }`.
2. Backend kiểm tra quyền tài xế và trạng thái đơn hàng (`SHIPPING`), sinh URL ký tạm của S3/R2 có thời hạn 5 phút.
3. Client nén ảnh thành định dạng `WebP` (kích thước tối đa 1200px, dung lượng ~200KB - 350KB) và đẩy thẳng lên S3/R2 bằng lệnh `PUT`.
4. Sau khi upload thành công, Client gọi `POST /api/v1/orders/:id/deliver` gửi lên `podKey` (ví dụ: `stores/12/pod/2026/11/order_842_abc123.webp`).
5. **Lợi ích:** Máy chủ Backend API giảm 100% tải xử lý file đa phương tiện.

### 3.3. Bảo mật quyền riêng tư & Link có thời hạn (Private Bucket + Presigned View URL)
* Bucket lưu ảnh bằng chứng được cài đặt chế độ **Private tuyệt đối** (`Block all public access`).
* Khách hàng hoặc Chủ quán khi muốn xem ảnh bằng chứng sẽ gọi qua API:
  * `GET /api/v1/orders/:id/pod-view-url`
  * Backend kiểm tra quyền (Người mua đơn này hoặc Chủ quán quản lý đơn này) rồi tạo ra một link tạm thời (Presigned Read URL) có thời hạn sống **15 phút**.
  * Hết 15 phút, link tự động vô hiệu, bảo vệ tối đa hình ảnh cổng nhà và thông tin của người nhận.

### 3.4. Chống tài xế gian lận (Anti-Fraud & Proof Verification)
1. **Bắt buộc chụp thực tế từ Camera (Enforce Live Camera):**
   * Phía Web/App khóa tính năng chọn từ Album/Thư viện ảnh (`capture="environment"`).
2. **Gắn Watermark định danh (Metadata Stamp):**
   * Đóng dấu chìm vào góc ảnh:
     * Mã đơn hàng: `#WEB-1794721...`
     * Thời gian thực: `2026-11-15 13:10:25`
     * Vị trí: `10.8529, 106.6295`
3. **Xác thực Geofencing (So khớp tọa độ GPS):**
   * Khi tài xế bấm xác nhận giao hàng, Client gửi kèm tọa độ thiết bị (`driverLatitude`, `driverLongitude`).
   * Backend so sánh với tọa độ địa chỉ giao hàng (`shippingLatitude`, `shippingLongitude`):
     * Nếu độ lệch $> 500m$, Backend yêu cầu tài xế nhập lý do giao lệch vị trí hoặc cảnh báo quản trị viên.

---

## 4. Đặc tả API Backend chi tiết cần triển khai

### API 1: Lấy URL ký sẵn để tải ảnh POD trực tiếp
* **Endpoint:** `POST /api/v1/media/pod/presigned-upload`
* **Quyền:** `STAFF_DELIVERY`, `STORE_OWNER`, `STORE_MANAGER`, `ADMIN`
* **Request Body:**
  ```json
  {
    "orderId": "842",
    "contentType": "image/webp",
    "fileSizeBytes": 245800
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "uploadUrl": "https://<bucket>.<account>.r2.cloudflarestorage.com/stores/1/pod/2026/11/order_842_x8f9a.webp?X-Amz-Signature=...",
      "objectKey": "stores/1/pod/2026/11/order_842_x8f9a.webp",
      "expiresInSeconds": 300
    }
  }
  ```

### API 2: Xác nhận hoàn tất giao hàng (Kèm bằng chứng & Tọa độ)
* **Endpoint:** `POST /api/v1/orders/:orderId/deliver`
* **Request Body:**
  ```json
  {
    "paymentMethod": "COD",
    "collectedAmount": 50000,
    "podObjectKey": "stores/1/pod/2026/11/order_842_x8f9a.webp",
    "driverLatitude": 10.8529241,
    "driverLongitude": 106.6295123,
    "deliveredAt": "2026-11-15T13:10:25.000Z"
  }
  ```

### API 3: Lấy link xem ảnh POD an toàn (Dành cho Chủ quán & Khách hàng)
* **Endpoint:** `GET /api/v1/orders/:orderId/pod-view`
* **Quyền:** Chủ đơn hàng (`CUSTOMER`), Nhân viên quán (`STORE_*`), `ADMIN`
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "viewUrl": "https://media.smartorder.vn/stores/1/pod/2026/11/order_842_x8f9a.webp?token=...",
      "expiresAt": "2026-11-15T13:25:25.000Z"
    }
  }
  ```

---

## 5. Lộ trình triển khai khuyến nghị (Implementation Phases)

| Giai đoạn | Nội dung công việc | Mục tiêu đạt được |
| :--- | :--- | :--- |
| **Giai đoạn 1 (Ngay lập tức)** | 1. Giữ nguyên Cloudinary hiện có.<br>2. Frontend nén ảnh WebP < 350KB & ép mở Camera chụp trực tiếp.<br>3. Thêm popup hiển thị ảnh POD cho Chủ quán trên Store Dashboard. | Nhanh chóng, ổn định ngay luồng trải nghiệm người dùng mà không cần đổi hạ tầng. |
| **Giai đoạn 2 (Tối ưu tải)** | 1. Mở API `presigned-upload` trên Backend.<br>2. Frontend tải thẳng lên Cloud thay vì đẩy qua Server Backend. | Giải phóng 100% tài nguyên CPU/RAM và băng thông cho máy chủ API trong giờ cao điểm. |
| **Giai đoạn 3 (Quy mô lớn)** | 1. Chuyển lưu trữ POD sang Cloudflare R2 / AWS S3 Private.<br>2. Cài đặt Lifecycle Rule tự động xóa ảnh sau 60 ngày.<br>3. Tích hợp so khớp Geofencing GPS. | Cắt giảm 80-90% chi phí lưu trữ, đạt chuẩn bảo mật PII của Grab và Shopee. |

---
*Tài liệu này được biên soạn để hỗ trợ đội ngũ Backend dễ dàng tích hợp và lên kế hoạch nâng cấp hạ tầng một cách bài bản và bền vững.*
