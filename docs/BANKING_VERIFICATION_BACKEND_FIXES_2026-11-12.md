# BÁO CÁO LỖI & YÊU CẦU SỬA BACKEND LUỒNG XÁC MINH NGÂN HÀNG (POST COMMIT `8d10e3e`)

- **Ngày lập:** 12/11/2026  
- **Môi trường kiểm tra:** Live Backend Render (`https://backend-fae8.onrender.com/healthz` -> `commitSha: 8d10e3e34bb0ecdf8325ef4092400d74ce8303a3`, `status: "UP"`)  
- **Mã nguồn đối soát:** `AmazonButton/Backend` nhánh `main` commit `8d10e3e` (bao gồm cả `2b4fb30`)  
- **Mục đích:** Gửi đội Backend các nguyên nhân còn sót khiến cả **Role Khách hàng** và **Role Chủ cửa hàng** sau khi chuyển khoản xác minh 2.000đ thành công vẫn hiển thị **`Chờ xác minh`** / **`Đang chờ kết quả`** trên giao diện và không tự động duyệt / hoàn tiền.

---

## TÓM TẮT HIỆN TƯỢNG THỰC TẾ

1. **Role Khách hàng (`/customer/banking`):**
   - Đã mở được cổng PayOS và chuyển khoản 2.000đ thành công.
   - Tuy nhiên khi quay lại trang hoặc bấm **"Kiểm tra kết quả"**, trạng thái xác minh vẫn giữ **`Chờ xác minh`** (hoặc không cập nhật đồng bộ tài khoản sang `Đã xác minh`).
2. **Role Chủ cửa hàng (`/store/finance`, ví dụ phiên `VERIFY_56HPGX`):**
   - Đã vượt qua được bước tra cứu (nhờ graceful fallback VietQR code 47 ở commit `8d10e3e`) và tạo được hướng dẫn VietQR chuyển 2.000đ tới `MBBank · 0971757841 · CONG TY CP SMART ORDER`.
   - Sau khi quét QR chuyển khoản 2.000đ thành công, trang tự động kiểm tra mỗi 4 giây và đã bấm nút **"Kiểm tra kết quả"**, nhưng khung yêu cầu vẫn giữ nguyên **`Đang chờ kết quả`**.

---

## PHẦN 1: CÁC LỖI CẦN SỬA Ở ROLE KHÁCH HÀNG (`CustomerBankPennyVerificationService`)

### 1. [BUG CHẮC CHẮN] Lỗi parse `transactionDateTime` sai múi giờ +7h trên server `UTC` (khiến giao dịch vừa chuyển bị coi là trễ hạn 7 tiếng)

- **Vị trí mã nguồn:**
  - `src/customers/customer-bank-penny-verification.service.ts` — dòng **738** (`processPayosVerificationWebhook`) và dòng **394** (`getVerificationStatus` -> `fakeWebhookData`)
  - `src/customers/customers.repository.ts` — dòng **1499–1502** và **1643–1663** (`recordInboundTransactionAndObligationAtomicTx`)
- **Nguyên nhân gốc rễ:**
  - Dòng **738** đang parse thời gian giao dịch bằng:
    ```ts
    const receivedAt = data.transactionDateTime ? new Date(data.transactionDateTime) : new Date();
    ```
  - Theo tài liệu API/Webhook của PayOS, `transactionDateTime` được trả dưới dạng chuỗi giờ Việt Nam **không kèm offset múi giờ** (định dạng `YYYY-MM-DD HH:mm:ss`, ví dụ `"2026-11-12 00:20:00"`).
  - Trên máy dev chạy múi giờ `Asia/Ho_Chi_Minh`, `new Date("2026-11-12 00:20:00")` hiểu đúng là `UTC+7`.
  - **Nhưng trên Render (`NODE_ENV=production`, server `TZ=UTC`)**, `new Date("2026-11-12 00:20:00")` bị parse nhầm thành `2026-11-12T00:20:00.000Z` (**lệch +7 giờ về tương lai** so với `expiresAt` được lưu theo UTC chuẩn).
  - Khi đi qua `customers.repository.ts` dòng **1499–1502**:
    ```ts
    const isSessionUnexpired =
      new Date(lockedSession.expires_at).getTime() > params.receivedAt.getTime() &&
      new Date(lockedSession.expires_at).getTime() > Date.now();
    isLate = !isSessionUnexpired;
    ```
    vì `receivedAt` bị cộng nhầm +7 tiếng nên `expires_at > receivedAt` luôn trả về `false` -> `isLate = true` -> `shouldActivate = false` ngay cả khi khách vừa chuyển khoản xong chỉ sau vài giây.
  - Theo dòng **1643–1663**, khi `isLate = true`, backend chỉ cập nhật `rejectionReason = 'Giao dịch nhận sau khi phiên xác minh đã hết hạn'` và **không đổi `verificationStatus`**, khiến `verificationStatus` tiếp tục giữ nguyên `PENDING` (`Chờ xác minh`) và tài khoản vẫn là `UNVERIFIED`.
  - **Lý do test chưa phát hiện (`tests/customer_bank_penny_deposit_e2e.spec.ts` Test 14):** Test 14 đang mock `transactionDateTime: new Date().toISOString()` (có hậu tố `Z` chuẩn UTC), không khớp định dạng chuỗi thực tế của PayOS (`YYYY-MM-DD HH:mm:ss`).
- **Yêu cầu sửa:**
  1. Viết helper parse `transactionDateTime` an toàn theo múi giờ Việt Nam: nếu chuỗi không chứa hậu tố múi giờ (`Z`, `+HH:mm`, `-HH:mm`, `+HHmm`, `-HHmm`), chuẩn hóa sang `+07:00` (ví dụ chuyển khoảng trắng giữa ngày/giờ thành `T` và nối `+07:00`) trước khi khởi tạo `Date`. Nếu parse không hợp lệ, fallback an toàn về `new Date()`.
  2. Xem xét điều kiện dòng **1501** (`expires_at > Date.now()`): nếu giao dịch trên PayOS đã phát sinh đúng hạn (`receivedAt <= expires_at`) nhưng webhook hoặc fallback polling đến trễ qua mốc 15 phút, việc chặn thêm `expires_at > Date.now()` sẽ làm khách đã chuyển đúng hạn vẫn bị đánh `isLate` không được duyệt. Cần thống nhất nghiệp vụ: đánh giá quá hạn dựa trên thời điểm thanh toán thực tế (`receivedAt <= expires_at`) hoặc hiển thị rõ ràng trạng thái nếu từ chối kích hoạt.
  3. Bổ sung unit/e2e test với chuỗi `"YYYY-MM-DD HH:mm:ss"` chạy dưới `TZ=UTC`.

---

### 2. [BUG CHẮC CHẮN] `getVerificationStatus` không tải lại bản ghi `account` sau khi kích hoạt từ Active Fallback Query

- **Vị trí mã nguồn:** `src/customers/customer-bank-penny-verification.service.ts` — dòng **336**, **416–422**, **530–544**
- **Nguyên nhân gốc rễ:**
  - Đầu hàm `getVerificationStatus` (dòng **336**) đọc `account = await this.customersRepo.findCustomerBankAccountById(...)`.
  - Ở nhánh Active Fallback Query (dòng **362–428**), sau khi gọi `processPayosVerificationWebhook(...)` cập nhật DB thành `VERIFIED`, dòng **416–422** chỉ tải lại `reloadedSession` mà **không tải lại `account`**.
  - Do đó tại dòng **530** và **541**, response trả về vẫn giữ `accountVerificationStatus: 'UNVERIFIED'` (`Chờ xác minh`). Nếu `refundStatus` rơi vào trạng thái không poll tiếp (`PENDING_MANUAL_REFUND`, `REFUND_FAILED`, `REFUNDED`...), frontend (`customerBankNeedsPolling`) thấy `sessionStatus === 'CONSUMED'` sẽ dừng polling khi UI góc phải và thẻ tổng vẫn đang hiển thị `Chờ xác minh` / `0`.
  - **Lý do test chưa phát hiện (`Test 14`):** Mock repository trong file test sửa trực tiếp field trên object `syncAcc` trong bộ nhớ RAM nên tự thấy `VERIFIED`, khác với Prisma query trả object mới từ PostgreSQL.
- **Yêu cầu sửa:**
  - Trong nhánh fallback ở `getVerificationStatus` (sau dòng **414**), gọi lại `this.customersRepo.findCustomerBankAccountById(profile.customerId, rawAccountId)` để lấy trạng thái mới nhất của tài khoản trước khi dựng `message` và trả DTO.

---

### 3. Kiểm tra dữ liệu đối soát nguồn PayOS thật (`counterAccountBankId`, `counterAccountNumber`) & cấu hình PayOS Payout

- **Vị trí mã nguồn:**
  - `src/customers/customer-bank-penny-verification.service.ts` — dòng **399–402**, **745–758**, **848–861**
  - `src/customers/customers.repository.ts` — dòng **1507–1521**, **1593–1596**
  - `src/payments/payos-payout.service.ts` — dòng **50–69**
- **Vấn đề cần kiểm tra trên Render log & biến môi trường:**
  1. Trong `recordInboundTransactionAndObligationAtomicTx` (`src/customers/customers.repository.ts`, dòng **1507–1521**), để kích hoạt `VERIFIED` và tự hoàn tiền (`PENDING_REFUND`), hệ thống bắt buộc PayOS phải trả đủ **`counterAccountBankId`** khớp `bank_bin` và **`counterAccountNumber`** đầy đủ (không rỗng, không che dấu `*`) khớp `account_number_hash`. Theo tài liệu PayOS, tùy ngân hàng nguồn mà 2 trường này có thể để trống `""`. Backend cần kiểm tra log Render của giao dịch vừa test xem PayOS có trả đủ 2 trường này hay không (nếu thiếu/bị che sẽ rơi vào `PENDING_SOURCE_EVIDENCE` và `PENDING_MANUAL_REFUND`).
  2. Trên nhánh fallback ở `getVerificationStatus` (dòng **411–426**), lỗi khi gọi PayOS hoặc chạy `processPayosVerificationWebhook` đang bị bắt và nuốt log (`this.logger.warn(...)`), không lộ ra ngoài; cần kiểm tra server log trên Render để đảm bảo không có exception âm thầm (ví dụ timeout 4 giây hoặc thiếu env).
  3. Để tự động hoàn 2.000đ, trên Render **bắt buộc** phải bật:
     - `FEATURE_CUSTOMER_REFUND_PAYOUT_ENABLED=true`
     - Bộ 3 biến **PayOS Payout riêng** (`PAYOS_PAYOUT_CLIENT_ID`, `PAYOS_PAYOUT_API_KEY`, `PAYOS_PAYOUT_CHECKSUM_KEY`), vì `PayOSPayoutService.getCredentials` (`src/payments/payos-payout.service.ts`, dòng **61–66**) và `processRefundWorkerBatch` (`src/customers/customer-bank-penny-verification.service.ts`, dòng **850–853**) **không cho phép** dùng lại khóa thu hộ `PAYOS_*` trong `production`.

---

## PHẦN 2: ĐIỂM NGHẼN Ở ROLE CHỦ CỬA HÀNG (`BankVerificationService` — phiên `VERIFY_...`)

### 1. [ĐIỂM NGHẼN CHÍNH] QR Chủ cửa hàng là VietQR tĩnh, không có kênh nhận tiền / truy vấn ngược ngân hàng

- **Vị trí mã nguồn:**
  - `src/bank-verification/bank-verification.service.ts` — dòng **198–220** (`createVerificationRequest`), dòng **348–492** (`handleVerificationWebhook`), dòng **939–951** (`getVerificationTransactionById`)
  - `src/bank-verification/bank-verification-polling.controller.ts` — `GET /api/v1/bank-account-verifications/:id`
  - `src/bank-verification/bank-verification-webhook.controller.ts` — `POST /api/v1/webhooks/bank-verification`
  - `src/bank-verification/bank-verification.repository.ts` — dòng **421–651** (`executeAtomicWebhookVerificationTx`)
- **Nguyên nhân gốc rễ:**
  - Khác với Khách hàng (tạo link PayOS và có active fallback query), Chủ cửa hàng chỉ tạo ra ảnh **VietQR tĩnh** (`https://img.vietqr.io/image/...`) trỏ vào `PLATFORM_BANK_ACCOUNT_NUMBER` (`MBBank · 0971757841`).
  - Khi Frontend polling 4 giây/lần hoặc người dùng bấm **"Kiểm tra kết quả"**, `GET /api/v1/bank-account-verifications/:id` gọi `getVerificationTransactionById`, hàm này **chỉ query Database nội bộ**, không gọi ra MBBank, VietQR hay PayOS để kiểm tra giao dịch `VERIFY_56HPGX`.
  - Việc chuyển trạng thái từ `PENDING` sang `VERIFIED` / `REFUND_PENDING` phụ thuộc **100% vào webhook ngoài** gửi về `POST /api/v1/webhooks/bank-verification` với:
    - Chữ ký HMAC hợp lệ (`BANK_VERIFICATION_WEBHOOK_SECRET` hoặc `PAYOS_CHECKSUM_KEY` tại `PayOSBankVerificationProvider.verifyWebhook`).
    - Bắt buộc ở chế độ strict `production` (dòng **421–552**): phải có đủ **4 trường** `destinationAccountNumber`, `destinationBankBin`, `senderAccountNumber`, `senderBankBin`. Nếu thiếu bất kỳ trường nào trong 4 trường này (hoặc chỉ có STK nhận từ webhook ngân hàng thông thường mà không có STK/BIN người gửi), transaction bị đánh **`FAILED`** với mã lỗi `*_UNVERIFIABLE`!
- **Yêu cầu xử lý cho Backend (chọn 1 trong 2 phương án):**
  - **Phương án 1 (khuyên dùng nếu chưa tích hợp cổng biến động số dư riêng cho `MBBank 0971757841`):** Thống nhất luồng thu 2.000đ xác minh của Chủ cửa hàng sang dùng PayOS Payment Request + Active Fallback Query (tái sử dụng hạ tầng PayOS đang dùng cho Khách hàng, không phụ thuộc webhook riêng của MBBank).
  - **Phương án 2 (nếu giữ nguyên VietQR tĩnh vào `MBBank 0971757841`):**
    1. Đấu nối dịch vụ nhận biến động số dư thật của STK `MBBank · 0971757841` (VietQR Webhook / Casso / SePay / aggregator ngân hàng) gọi đúng endpoint `POST /api/v1/webhooks/bank-verification` kèm chữ ký HMAC.
    2. Xác nhận payload từ đối tác biến động số dư có trả đủ `senderAccountNumber` + `senderBankBin` (không bị che hoặc bỏ trống) hay không; nếu cổng đối tác không trả đủ thông tin người gửi, cần thiết kế trạng thái chờ đối soát / quy trình admin duyệt thủ công thay vì đánh `FAILED` (`SENDER_ACCOUNT_UNVERIFIABLE`) và chặn vĩnh viễn.

### 2. Cấu hình hoàn tiền 2.000đ cho Chủ cửa hàng (`StoreBankRefundWorker`)

- **Vị trí mã nguồn:**
  - `src/bank-verification/store-bank-refund.worker.ts` (`@Cron('*/2 * * * *')`)
  - `src/bank-verification/providers/payos-bank-verification.provider.ts` — dòng **169–199** (`createRefund`)
  - `src/payments/payos-payout.service.ts` — dòng **50–69** (`getCredentials`)
- **Yêu cầu kiểm tra:** Đảm bảo trên Render đã cấu hình đầy đủ 3 biến `PAYOS_PAYOUT_CLIENT_ID`, `PAYOS_PAYOUT_API_KEY`, `PAYOS_PAYOUT_CHECKSUM_KEY` (khóa chi hộ) thì lệnh hoàn 2.000đ cho Chủ cửa hàng mới thực thi được trong `production`.

---

## PHẦN 3: CHECKLIST TRIỂN KHAI & KIỂM THỬ SAU KHI SỬA

1. **Code fixes (Backend):**
   - [ ] Sửa parser `transactionDateTime` theo múi giờ `+07:00` trong `customer-bank-penny-verification.service.ts` và thêm test case `TZ=UTC` với chuỗi `"YYYY-MM-DD HH:mm:ss"`.
   - [ ] Tải lại `account` trong nhánh fallback của `getVerificationStatus` trước khi trả response.
   - [ ] Xử lý dứt điểm nguồn webhook / fallback đối soát cho Chủ cửa hàng (Phương án 1 dùng PayOS Checkout hoặc Phương án 2 nối webhook biến động số dư MBBank `0971757841`).
2. **Cấu hình Render Environment Variables:**
   - [ ] `FEATURE_CUSTOMER_REFUND_PAYOUT_ENABLED=true`
   - [ ] `PAYOS_PAYOUT_CLIENT_ID`, `PAYOS_PAYOUT_API_KEY`, `PAYOS_PAYOUT_CHECKSUM_KEY`
   - [ ] Nếu giữ VietQR tĩnh Chủ cửa hàng: cấu hình webhook biến động số dư `PLATFORM_BANK_ACCOUNT_NUMBER` (`0971757841`) trỏ tới `POST /api/v1/webhooks/bank-verification` khớp `BANK_VERIFICATION_WEBHOOK_SECRET`.
3. **Lưu ý dữ liệu test sau deploy:**
   - Các phiên đã quá hạn hoặc chuyển tiền trước thời điểm deploy bản sửa (ví dụ `CUST_VRF_970423_GNEWND`, `VERIFY_56HPGX`) cần đối soát riêng; khi nghiệm thu lại luồng tự động, **hãy tạo phiên xác minh mới** cho cả Khách hàng và Chủ cửa hàng.
