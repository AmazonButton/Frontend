# TÀI LIỆU ĐỐI SOÁT & GIẢI PHÁP TOÀN DIỆN HỆ THỐNG NGÂN HÀNG (BACKEND)
**Cập nhật lần cuối:** 22:25 - 11/11/2026  
**Môi trường đối soát:** Live Backend Render (`https://backend-fae8.onrender.com/docs`) & Git repo commit `4b54051`.  
**Mục tiêu:** Báo cáo chi tiết lỗi ở cả 2 Role (Khách hàng & Chủ cửa hàng) và cung cấp nguyên nhân gốc rễ cùng giải pháp cho Backend.

---

## 1. PHÂN HỆ KHÁCH HÀNG: TẠI SAO PHIÊN THỰC TẾ (`CUST_VRF_970423_GNEWND`) ĐÃ THANH TOÁN THÀNH CÔNG NHƯNG BACKEND KHÔNG DUYỆT?

### Hiện tượng thực tế trên hệ thống (Theo hình ảnh đính kèm):
- Khách hàng đã mở cổng PayOS và chuyển khoản thành công 2.000đ.
- Tuy nhiên trên giao diện web, trạng thái vẫn là:
  - **Xác minh phiên:** *Chờ xác minh*
  - **Thanh toán xác minh:** *Chờ xác minh*
  - **Thực nhận:** *Chưa ghi nhận (0đ)*
  - Khi bấm nút *"Kiểm tra kết quả"* nhiều lần, trạng thái vẫn không đổi.

### Nguyên nhân kỹ thuật gốc rễ từ mã nguồn Backend:
Đã kiểm tra trực tiếp endpoint Live Render và mã nguồn commit `4b54051`, phát hiện **3 nguyên nhân liên hoàn**:

#### 1. Lỗi Handshake Webhook khiến PayOS không thể lưu endpoint xác minh khách hàng:
- Endpoint nhận webhook khách hàng là: `POST /api/v1/webhooks/payos/customer-bank-verification`.
- Khi người dùng đăng ký Webhook URL trên PayOS Dashboard (`my.payos.vn`), PayOS sẽ gửi một HTTP POST Handshake: `{ "webhookUrl": "https://..." }` để xác nhận server sống.
- **Thực tế kiểm tra trực tiếp trên Render:**
  ```json
  POST https://backend-fae8.onrender.com/api/v1/webhooks/payos/customer-bank-verification
  Response: 400 Bad Request
  {
    "message": "property webhookUrl should not exist",
    "errors": ["property webhookUrl should not exist", "success must be a boolean value", "data must be an object", "signature must be a string"]
  }
  ```
  -> Do `PayosWebhookPayloadDto` dùng `forbidNonWhitelisted: true` và không khai báo trường `webhookUrl`, nên PayOS bị báo lỗi 400 và **không thể đăng ký Webhook URL này trên PayOS Dashboard**!

#### 2. Xung đột Routing Webhook giữa Đơn hàng và Xác minh khách hàng:
- Trên PayOS Dashboard của một Merchant thông thường chỉ có **1 ô nhập Webhook URL duy nhất**.
- Nếu Backend cấu hình Webhook URL trỏ vào: `https://backend-fae8.onrender.com/api/v1/payments/payos/webhook` (endpoint của đơn hàng/thuê nút bấm):
  - Khi khách thanh toán 2.000đ xác minh tài khoản, PayOS sẽ bắn webhook về `/api/v1/payments/payos/webhook`.
  - Trong `payments.service.ts` (dòng 367–426), code chỉ tìm giao dịch trong bảng Đơn hàng (`paymentsRepo.findTransactionByCode`) và bảng Phí thuê (`billingChargesService.findChargeByOrderCode`). Khi không thấy, nó log:
    `[PayOS Webhook] Transaction not found for orderCode: ...` và **hủy bỏ webhook**.
  - Nó **hoàn toàn không chuyển tiếp (forward)** sang `CustomerBankPennyVerificationService`! Do đó Database của phiên xác minh ngân hàng không bao giờ nhận được tiền.

#### 3. Hàm kiểm tra trạng thái (`getVerificationStatus`) không gọi PayOS API để phục hồi:
- Khi khách hàng bấm nút *"Kiểm tra kết quả"*, frontend gọi `GET /api/v1/customers/me/bank-accounts/:id/verification-status`.
- Trong `customer-bank-penny-verification.service.ts` (dòng 284–420): Backend **chỉ đọc bảng `customerBankInboundTransaction` trong DB**, hoàn toàn **không gọi sang API PayOS** (`GET /v2/payment-requests/:orderCode`) để đối soát lại xem khách đã nạp tiền hay chưa.
- Vì Webhook không vào được DB, mà hàm kiểm tra trạng thái lại không hỏi PayOS, nên hệ thống bị kẹt vĩnh viễn ở trạng thái *"Chờ xác minh"*.

---

## 2. PHÂN HỆ CHỦ CỬA HÀNG (STORE OWNER): TẠI SAO NGÂN HÀNG BỊ LỖI TOÀN BỘ?

Phân hệ Ngân hàng của Chủ cửa hàng (`/store/finance`) hiện tại đang bị tê liệt từ bước đầu tiên đến bước cuối cùng do các nguyên nhân sau:

### Điểm nghẽn 1: Bị chặn ngay từ bước "Tra cứu chủ tài khoản" (Lookup Account)
- **API:** `POST /api/v1/stores/bank-accounts/lookup`
- **Mã nguồn:** `src/bank-verification/providers/payos-bank-verification.provider.ts` (Dòng 57–97)
- **Hiện tượng:** Khi chủ quán nhập số tài khoản và bấm *"Tra cứu chủ tài khoản"*, màn hình báo lỗi đỏ:
  `"Dịch vụ tra cứu tài khoản ngân hàng tạm thời không khả dụng (xác thực dịch vụ thất bại)"`
- **Nguyên nhân:** Backend gọi sang VietQR OpenAPI (`https://api.vietqr.io/v2/lookup`). Do cặp khóa `VIETQR_CLIENT_ID` / `VIETQR_API_KEY` trên Render chưa được cấu hình hoặc đã hết hạn/sai token, API VietQR trả về HTTP `401/403`.
- **Hậu quả:** Form thêm tài khoản ngân hàng của cửa hàng không lấy được tên chủ tài khoản, nút *"Tạo yêu cầu xác minh"* bị vô hiệu hóa (disabled).

### Điểm nghẽn 2: Bị chặn ngay cả khi cố tình gửi yêu cầu xác minh
- **API:** `POST /api/v1/stores/bank-accounts/verification`
- **Mã nguồn:** `src/bank-verification/bank-verification.service.ts` (Dòng 143)
- **Nguyên nhân:** Ở phía server, trước khi tạo giao dịch xác minh, backend lại tiếp tục gọi `this.provider.lookupAccount(dto.bankBin, cleanAcc)`. Do đó, nếu VietQR chưa được cấu hình key chuẩn, server sẽ từ chối tạo yêu cầu xác minh và tiếp tục quăng lỗi 503.

### Điểm nghẽn 3: Kênh Webhook đối soát tiền chuyển khoản của Cửa hàng (`PLATFORM_BANK`)
- Khác với khách hàng (dùng link PayOS Checkout), luồng Cửa hàng sinh mã QR chuyển khoản trực tiếp vào tài khoản ngân hàng của Platform:
  - `PLATFORM_BANK_BIN`
  - `PLATFORM_BANK_ACCOUNT_NUMBER`
  - Nội dung chuyển khoản: `VERIFY_XXXXXXXX`
- Để tự động duyệt sang `OWNERSHIP_VERIFIED`, Backend cần nhận Webhook từ ngân hàng Platform gửi về:
  `POST /api/v1/webhooks/bank-verification` kèm chữ ký `x-signature` khớp với `BANK_VERIFICATION_WEBHOOK_SECRET`.
- Nếu tài khoản ngân hàng Platform chưa tích hợp cổng Webhook (như VietQR Webhook, Casso, SePay), thì các giao dịch chuyển khoản 2.000đ của cửa hàng cũng sẽ không có bên nào báo về để tự động duyệt.

### Điểm nghẽn 4: Tác động dây chuyền tới Ví Cửa hàng (Store Wallet)
- **API:** `POST /api/v1/store/wallet/withdrawals`
- Trong `store-wallet.service.ts` (dòng 150): Yêu cầu tài khoản rút tiền bắt buộc phải có trạng thái:
  `verificationStatus === 'OWNERSHIP_VERIFIED'`
- Vì Điểm nghẽn 1 & 2 làm cửa hàng không thể xác minh ngân hàng, nên **Chủ cửa hàng hoàn toàn không thể rút tiền doanh thu từ ví Store Wallet**.

---

## 3. CHECKLIST HÀNH ĐỘNG CỤ THỂ DÀNH CHO BACKEND DEVELOPER

Dưới đây là các bước hành động cụ thể gửi cho bạn lập trình viên Backend để giải quyết dứt điểm các lỗi trên:

### A. Sửa lỗi Webhook PayOS cho Khách hàng (Giải quyết phiên `CUST_VRF_...` không duyệt):
1. **Bổ sung xử lý Webhook URL Handshake trong `PayosWebhookPayloadDto`:**
   - Trong `src/customers/dto/payos-webhook-payload.dto.ts`, thêm:
     ```typescript
     @IsOptional()
     @IsString()
     webhookUrl?: string;
     ```
   - Trong `CustomerBankWebhookController` hoặc `processPayosVerificationWebhook`, nếu nhận payload handshake `{ webhookUrl: "..." }` thì trả về ngay `{ code: "00", desc: "success", data: { webhookUrl } }`.
2. **Cơ chế Router thông minh trong Webhook chung:**
   - Trong `src/payments/payments.service.ts` (`handlePayosWebhook`): Nếu `paymentsRepo.findTransactionByCode` và `billingChargesService.findChargeByOrderCode` đều không thấy mã giao dịch, hãy kiểm tra tiếp qua `CustomerBankPennyVerificationService.processPayosVerificationWebhook(body, req.rawBody)`. Điều này cho phép PayOS chỉ cần cấu hình 1 Webhook URL duy nhất trên dashboard mà vẫn xử lý được cả đơn hàng lẫn xác minh tài khoản!
3. **Cơ chế Fallback Query khi bấm "Kiểm tra kết quả":**
   - Trong `getVerificationStatus`: Nếu session đang là `PENDING` và chưa hết hạn, cho phép gọi `GET https://api-merchant.payos.vn/v2/payment-requests/:orderCode` bằng `recoverExistingPaymentLink` để kiểm tra trạng thái thanh toán trực tiếp từ PayOS và tự động kích hoạt nếu PayOS báo đã thanh toán (`status: "PAID"`).

### B. Sửa lỗi Ngân hàng Chủ cửa hàng (Store Owner):
1. **Cấu hình cặp khóa VietQR OpenAPI trên Render:**
   - Đăng ký tài khoản doanh nghiệp trên `my.vietqr.io`.
   - Lấy `x-client-id` và `x-api-key` điền vào 2 biến môi trường trên Render:
     - `VIETQR_CLIENT_ID`
     - `VIETQR_API_KEY`
   - Kiểm tra đảm bảo tài khoản VietQR đã kích hoạt tính năng tra cứu tên chủ tài khoản qua NAPAS 247.
2. **Cấu hình thông tin tài khoản Platform:**
   - Điền đúng tài khoản nhận tiền thật trên Render:
     - `PLATFORM_BANK_BIN` (ví dụ `970422` - MBBank)
     - `PLATFORM_BANK_ACCOUNT_NUMBER` (Số tài khoản nhận tiền thật của công ty)
     - `PLATFORM_BANK_ACCOUNT_HOLDER` (Tên in hoa không dấu)
     - `BANK_VERIFICATION_WEBHOOK_SECRET`

---

## 4. BẢNG TỔNG HỢP BIẾN MÔI TRƯỜNG CẦN THIẾT TRÊN RENDER

| Biến môi trường | Mục đích | Phân hệ ảnh hưởng |
| --- | --- | --- |
| `VIETQR_CLIENT_ID` | Client ID VietQR OpenAPI để tra cứu tên tài khoản qua NAPAS | **Chủ cửa hàng (Sửa lỗi tra cứu)** |
| `VIETQR_API_KEY` | API Key VietQR OpenAPI | **Chủ cửa hàng (Sửa lỗi tra cứu)** |
| `PLATFORM_BANK_BIN` | Mã BIN ngân hàng nhận tiền xác minh 2.000đ cửa hàng | **Chủ cửa hàng** |
| `PLATFORM_BANK_ACCOUNT_NUMBER` | Số tài khoản nhận tiền xác minh cửa hàng | **Chủ cửa hàng** |
| `CUSTOMER_BANK_VERIFICATION_PAYMENT_ENABLED` | `true` (Bật tạo link thanh toán PayOS) | **Khách hàng** |
| `PAYOS_CLIENT_ID` | Client ID kết nối cổng PayOS | **Khách hàng** |
| `PAYOS_API_KEY` | API Key kết nối cổng PayOS | **Khách hàng** |
| `PAYOS_CHECKSUM_KEY` | Checksum Key dùng để xác thực chữ ký Webhook | **Khách hàng** |
| `FEATURE_CUSTOMER_REFUND_PAYOUT_ENABLED` | `true` (Bật tự động hoàn trả 2.000đ) | **Khách hàng** |
| `PAYOS_PAYOUT_CLIENT_ID` | Client ID chi hộ PayOS Payout | **Khách hàng & Rút tiền ví cửa hàng** |
| `PAYOS_PAYOUT_API_KEY` | API Key chi hộ PayOS Payout | **Khách hàng & Rút tiền ví cửa hàng** |
| `PAYOS_PAYOUT_CHECKSUM_KEY` | Checksum Key chi hộ PayOS Payout | **Khách hàng & Rút tiền ví cửa hàng** |
