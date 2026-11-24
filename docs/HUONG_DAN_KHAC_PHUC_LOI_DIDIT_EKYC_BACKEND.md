# Hướng Dẫn Khắc Phục Lỗi Tích Hợp Didit eKYC (Dành Cho Backend Team & DevOps)

> **Tài liệu bàn giao kỹ thuật:** Khắc phục lỗi tạo phiên định danh cá nhân (eKYC) qua cổng Didit API v3.  
> **Hệ thống liên quan:** Backend NestJS (`https://backend-fae8.onrender.com`), Frontend React Vite (`https://buttontdash.vercel.app`).  
> **Ngày tạo:** 23/11/2026.

---

## 1. Tóm tắt sự cố (Summary)

* **Thao tác người dùng:** Người dùng truy cập mục **Định danh cá nhân (eKYC)** tại trang Profile và nhấn nút **"Bắt đầu định danh với Didit"**.
* **API được gọi:** `POST /api/v1/identity-verifications/sessions`
* **Kết quả trả về cho Frontend:** `HTTP 502 Bad Gateway`
  ```json
  {
    "statusCode": 502,
    "message": "Yêu cầu đến cổng định danh Didit không thành công (400)"
  }
  ```

---

## 2. Phân tích nguyên nhân kỹ thuật (Root Cause Analysis)

### 2.1. Phản hồi thực tế từ máy chủ Didit
Khi Backend nhận request và thực hiện gọi sang đối tác Didit:
* **URL:** `POST https://verification.didit.me/v3/session/`
* **Headers:** 
  * `x-api-key: [DIDIT_API_KEY]`
  * `Content-Type: application/json`
* **Body:**
  ```json
  {
    "workflow_id": "[DIDIT_WORKFLOW_ID]",
    "vendor_data": "user-[userId]",
    "callback": "https://buttontdash.vercel.app/verification/callback"
  }
  ```

Máy chủ Didit trả về mã lỗi **`HTTP 400 Bad Request`** với nội dung:
```json
{
  "detail": "You don't have enough credits to perform this request. Please top up at https://business.didit.me"
}
```

### 2.2. Xử lý lỗi trong mã nguồn Backend
Trong file `backend/src/identity-verifications/didit-client.service.ts` (dòng 78–92):
```typescript
if (!response.ok) {
  this.logger.error(
    `[DiditClient] ${endpointName} failed with HTTP ${response.status}`,
  );

  if (response.status >= 500) {
    throw new BadGatewayException(
      'Cổng định danh danh tính đối tác (Didit) đang gặp sự cố. Vui lòng thử lại sau.',
    );
  }

  throw new BadGatewayException(
    `Yêu cầu đến cổng định danh Didit không thành công (${response.status})`,
  );
}
```
* Backend đã chuyển tiếp mã lỗi `400` từ Didit thành `BadGatewayException` (HTTP 502).
* Thông điệp chi tiết từ Didit (`"You don't have enough credits to perform this request..."`) bị ẩn đi, dẫn đến khó khăn trong việc nhận biết nguyên nhân trực tiếp.

---

## 3. Các bước xử lý chi tiết (Action Items)

### Bước 1: Nạp Credit trên Didit Business Console (Bắt buộc)
1. Đăng nhập vào cổng quản trị đối tác Didit: **[https://business.didit.me](https://business.didit.me)** bằng tài khoản quản lý dự án.
2. Kiểm tra tài khoản sở hữu `DIDIT_API_KEY`:
   * Truy cập mục **Billing / Credits / Subscriptions**.
   * Thực hiện nạp thêm credit (Top up verification credits).
3. Kiểm tra Workflow trong **Workflows**:
   * Xác nhận Workflow ID `b569c77c-4368-4a2e-8cc1-3ed553a9e7dd` (hoặc Workflow đang dùng) đang ở trạng thái **Active**.

---

### Bước 2: Cập nhật biến môi trường trên Render (Nếu dùng Key / Workflow mới)
Nếu tạo tài khoản Didit mới hoặc cấp lại API Key có sẵn credit, vui lòng cập nhật lại các biến môi trường trên **Render Dashboard** (Service `backend-fae8`):

| Tên biến môi trường | Mô tả | Giá trị ví dụ / Mặc định |
| :--- | :--- | :--- |
| `DIDIT_API_KEY` | Khóa bí mật API Didit v3 | `ChOejfrQreF6RzH9E-...` |
| `DIDIT_WORKFLOW_ID` | Mã quy trình xác minh (CCCD + Face) | `b569c77c-4368-4a2e-8cc1-3ed553a9e7dd` |
| `DIDIT_WEBHOOK_SECRET` | Khóa bí mật giải mã chữ ký Webhook HMAC | `sec_didit_...` |
| `DIDIT_BASE_URL` | Địa chỉ API Didit v3 | `https://verification.didit.me/v3` |
| `DIDIT_CALLBACK_URL` | URL điều hướng khi hoàn tất xác thực | `https://buttontdash.vercel.app/customer/profile?tab=IDENTITY` |

> *Sau khi lưu biến môi trường, nhấn **Manual Deploy $\rightarrow$ Deploy latest commit** trên Render để nạp cấu hình mới.*

---

### Bước 3: Đề xuất cải thiện xử lý lỗi trong Backend (Code Improvement)
Trong file `backend/src/identity-verifications/didit-client.service.ts`, đề xuất cải thiện hàm `executeRequest` để trích xuất `detail` từ Didit và log rõ ràng:

```typescript
// Gợi ý nâng cấp trong executeRequest() tại didit-client.service.ts
if (!response.ok) {
  const detailMessage = responseData?.detail || responseData?.message || `Lỗi HTTP ${response.status}`;
  this.logger.error(
    `[DiditClient] ${endpointName} thất bại (HTTP ${response.status}): ${JSON.stringify(responseData)}`,
  );

  if (response.status >= 500) {
    throw new BadGatewayException(
      'Cổng định danh đối tác (Didit) đang gặp sự cố. Vui lòng thử lại sau.',
    );
  }

  // Trả về thông điệp chi tiết để dev và client biết rõ nguyên nhân (vd: hết credit, sai workflow)
  throw new BadGatewayException(
    `Cổng định danh Didit phản hồi lỗi: ${detailMessage}`,
  );
}
```

---

## 4. Hướng dẫn kiểm thử sau khi nạp Credit (Testing & Verification)

### Cách 1: Test trực tiếp tới cổng Didit bằng lệnh cURL
Chạy lệnh sau trên terminal để kiểm tra API Key và Workflow ID đã có credit và tạo được phiên hay chưa:
```bash
curl -X POST "https://verification.didit.me/v3/session/" \
  -H "x-api-key: <DIDIT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "<DIDIT_WORKFLOW_ID>",
    "vendor_data": "test-user-01",
    "callback": "https://buttontdash.vercel.app/verification/callback"
  }'
```
**Kết quả mong đợi (Thành công):**
```json
{
  "session_id": "9a12b34c-...",
  "url": "https://verify.didit.me/session/...",
  "status": "Not Started"
}
```

### Cách 2: Test qua API Backend của hệ thống
Sử dụng Access Token hợp lệ của User:
```bash
curl -X POST "https://backend-fae8.onrender.com/api/v1/identity-verifications/sessions" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json"
```
**Kết quả mong đợi:**
`HTTP 201 Created` kèm theo đối tượng session chứa `verificationUrl` và `diditSessionId`.

---

## 5. Trạng thái phía Frontend

1. **Kết nối API:** Frontend đã đấu nối hoàn tất các endpoints:
   * `POST /api/v1/identity-verifications/sessions`
   * `GET /api/v1/identity-verifications/sessions/:sessionId`
   * `GET /api/v1/identity-verifications/sessions/:sessionId/decision`
2. **Cơ chế đồng bộ kết quả tự động:**
   * Tự động Polling chu kỳ 5 giây khi phiên ở trạng thái `PENDING`.
   * Lắng nghe sự kiện `visibilitychange` (khi người dùng làm xong trên Didit và quay lại tab trình duyệt sẽ tự động kích hoạt đồng bộ ngay lập tức).
   * Nút bấm thủ công "Đồng bộ kết quả" phòng trường hợp mạng trễ.
3. **Kết luận:** **Phía Frontend không cần chỉnh sửa thêm bất kỳ dòng code nào.** Ngay khi Backend nạp thêm credit hoặc cập nhật API Key hợp lệ, toàn bộ luồng eKYC sẽ hoạt động trơn tru.
