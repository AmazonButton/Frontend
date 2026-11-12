# Báo Cáo Lỗi Hệ Thống Xác Minh & Hoàn Tiền Ngân Hàng (Cả 2 Role)

- **Ngày kiểm tra:** `12/11/2026 11:25 (+07:00)`
- **Phiên bản backend đang chạy trên Render:** Commit `b03ae5b2aa48fc9e3c4784aef34ca98d2c4f2eb8` (`https://backend-fae8.onrender.com/healthz` -> `status: UP`, `database: CONNECTED`)
- **Phạm vi đối soát:** Mã nguồn `backend/src/` (commit `b03ae5b`), `frontend/src/`, và ảnh chụp thực tế luồng Khách hàng (`CUST_VRF_970423_1FDTC6` lúc `11:03–11:12`).

---

## TÓM TẮT NHANH MỨC ĐỘ NGHIÊM TRỌNG

| Mức độ | Role ảnh hưởng | Tóm tắt lỗi | File chính |
| --- | --- | --- | --- |
| **P0** | Cả 2 role (chặn đứng Store) | Webhook chung `/api/v1/payments/payos/webhook` bị nhánh Khách hàng nuốt mất giao dịch của Chủ cửa hàng | `src/payments/payments.service.ts`, `src/customers/customer-bank-penny-verification.service.ts` |
| **P0** | Chủ cửa hàng (Store) | Active Fallback Query đọc sai tầng JSON PayOS (không đọc `transactions[0]`, thiếu `bin`) -> đánh `FAILED` vĩnh viễn giao dịch vừa thanh toán | `src/bank-verification/bank-verification.service.ts`, `src/bank-verification/bank-verification.repository.ts` |
| **P0** | Chủ cửa hàng (Store) | Điều kiện `isPayosIntegratedTx` luôn `false` khi có `data.reference` -> từ chối nhầm `DESTINATION_*_MISMATCH` | `src/bank-verification/bank-verification.repository.ts`, `src/bank-verification/bank-verification.service.ts` |
| **P0** | Khách hàng (Customer) | Active Fallback Query (`Kiểm tra kết quả`) nuốt exception âm thầm (`.catch`), timeout 4s, không check `res.ok`, thiếu fallback theo `paymentLinkId` | `src/customers/customer-bank-penny-verification.service.ts` |
| **P0** | Khách hàng (Customer) | Bắt buộc cứng `counterAccountBankId` & `counterAccountNumber`, nếu PayOS trả `null` thì kẹt `PENDING_SOURCE_EVIDENCE` & `PENDING_MANUAL_REFUND` | `src/customers/customer-bank-penny-verification.service.ts`, `src/customers/customers.repository.ts` |
| **P1** | Cả 2 role | Dùng chung 1 biến `PAYOS_RETURN_URL` toàn cục làm redirect về trang chủ thay vì trang ngân hàng của từng role | `customer-bank-penny-verification.service.ts`, `bank-verification.service.ts` |
| **P1** | Chủ cửa hàng (Store) | Gán raw EMVCo QR string vào `qrCodeUrl` và làm mất `checkoutUrl` khi poll / tải lại | `src/bank-verification/bank-verification.service.ts` |
| **P1** | Chủ cửa hàng (Store) | `triggerAutomatedRefund` chạy song song `StoreBankRefundWorker` mà không claim `store_bank_refund_obligations` -> nguy cơ chi hoàn 2 lần | `src/bank-verification/bank-verification.service.ts` |
| **P1** | Khách hàng (Customer) | Phiên quá hạn vẫn giữ `session_status = 'ACTIVE'` (`Phiên đang mở`) trong DB & lịch sử | `src/customers/customer-bank-penny-verification.service.ts`, `src/customers/customers.repository.ts` |
| **P1** | Khách hàng (Customer) | DTO `PayosWebhookPayloadDto` thiếu `webhook_url` dưới global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` | `src/customers/dto/payos-webhook-payload.dto.ts`, `src/customers/customer-bank-webhook.controller.ts` |

---

## I. LỖI CHUNG (ẢNH HƯỞNG CẢ 2 ROLE)

### [P0-1] `CustomerBankPennyVerificationService` nuốt mất toàn bộ Webhook PayOS của Chủ cửa hàng
- **Vị trí:**
  - `backend/src/payments/payments.service.ts` (dòng `428–452`)
  - `backend/src/customers/customer-bank-penny-verification.service.ts` (dòng `750–752`, `818–849`)
  - `backend/src/customers/customers.repository.ts` (dòng `1564–1632`)
- **Nguyên nhân kỹ thuật:**
  1. Trong `PaymentsService.handlePayosWebhook`, khi không tìm thấy `orderId` hay `billingCharge`, code gọi `customerBankPennyService.processPayosVerificationWebhook(body)` **TRƯỚC** `bankVerificationService.handleVerificationWebhook(body)` (`#L429-L444`). Nếu kết quả trả về `pennyResult.success || pennyResult.code === '00'`, hàm **`return pennyResult` ngay tại `#L434`**, không bao giờ chạy tiếp tới nhánh Store Owner.
  2. Nhưng bên trong `CustomerBankPennyVerificationService.processPayosVerificationWebhook` (`#L751`): khi `findVerificationSessionByOrderCode(orderCode)` trả về `null` (tức `orderCode` là của **Chủ cửa hàng**), hàm **không trả về `success: false`** mà vẫn đi tiếp vào `recordInboundTransactionAndObligationAtomicTx` (`#L818`, `proofId: null`), tạo 1 bản ghi mồ côi trong bảng khách hàng (`sessionMatchStatus: 'UNMATCHED_NO_SESSION'`, `matchDecision: 'UNMATCHED_SESSION'`, `reconciliationFlag: 'FLAGGED_UNMATCHED_SESSION'`) + `customer_bank_refund_obligations` (`PENDING_MANUAL_REFUND`), rồi trả về **`{ success: true }`** (`#L842`).
- **Hậu quả:** Mọi PayOS webhook của **Chủ cửa hàng** đều bị nhánh Khách hàng chặn đứng, không tới được `BankVerificationService`, đồng thời làm bẩn sổ giao dịch Khách hàng bằng bản ghi sai phân hệ.
- **Hướng sửa:**
  - Trong `PaymentsService.handlePayosWebhook` (hoặc đầu `processPayosVerificationWebhook`), đối chiếu rõ `orderCode` thuộc bảng nào trước khi ghi: chỉ định tuyến vào Customer nếu tìm thấy `orderCode` trong `customer_bank_verification_proofs`, hoặc nếu tìm thấy `orderCode` / `referenceCode` (`VERIFY_...`) trong `bank_account_verification_transactions` thì định tuyến thẳng vào `BankVerificationService`.
  - Chỉ ghi `UNMATCHED_SESSION` khi chắc chắn `orderCode` không thuộc bất kỳ luồng nào khác (đặc biệt không được nuốt webhook của Store).

### [P1-1] Dùng chung 1 biến môi trường `PAYOS_RETURN_URL` cho mọi luồng
- **Vị trí:**
  - `backend/src/customers/customer-bank-penny-verification.service.ts` (dòng `211–213`)
  - `backend/src/bank-verification/bank-verification.service.ts` (dòng `202–204`)
- **Hiện tượng thực tế:** Người dùng thanh toán 2.000đ trên PayOS thành công xong bị PayOS chuyển hướng thẳng về **trang chủ**, không quay về `/customer/banking`.
- **Nguyên nhân:** Cả 2 service đều viết `const returnUrl = process.env.PAYOS_RETURN_URL || '${frontendOrigin}/...'`. Trên Render biến `PAYOS_RETURN_URL` đang được cấu hình (trỏ về trang chủ / URL khác), ghi đè lên đường dẫn riêng `/customer/banking?status=success` và `/store/finance?status=success`.
- **Hướng sửa:** Bỏ đọc `PAYOS_RETURN_URL` dùng chung cho 2 luồng xác minh ngân hàng (hoặc tách riêng `PAYOS_CUSTOMER_BANK_RETURN_URL` / `PAYOS_STORE_BANK_RETURN_URL`, mặc định dựng từ `FRONTEND_URL`).

---

## II. LỖI Ở ROLE KHÁCH HÀNG (Customer)

> **Hiện tượng quan sát được:** Phiên `CUST_VRF_970423_1FDTC6` (tạo lúc `11:03:06 12/11/2026`, hạn `11:18:05`) đã chuyển khoản 2.000đ thành công qua PayOS. Sau khi tự vào lại `/customer/banking` và bấm **"Kiểm tra kết quả"** lúc `11:12`, giao diện vẫn giữ nguyên `Xác minh phiên: Chờ xác minh`, `Thanh toán xác minh: Chờ xác minh` (`paymentStatus = PENDING`), `Thực nhận: Chưa ghi nhận` (`0đ`).

### [P0-2] Active Fallback Query trong `getVerificationStatus` nuốt lỗi âm thầm & thiếu fallback `paymentLinkId`
- **Vị trí:** `backend/src/customers/customer-bank-penny-verification.service.ts` (dòng `362–437`)
- **Nguyên nhân kỹ thuật:**
  1. Dòng `369–378` chỉ gọi `GET https://api-merchant.payos.vn/v2/payment-requests/${latestSession.paymentOrderCode}` với timeout **4 giây** (`AbortSignal.timeout(4000)`), **không kiểm tra `if (!queryRes.ok)`** và không có fallback gọi theo `latestSession.paymentLinkId`.
  2. Nếu PayOS timeout > 4s, trả HTTP lỗi, hoặc trả `queryData.data.status !== 'PAID'` (hoặc `code !== '00'`), điều kiện `#L381` bỏ qua im lặng không log warning, không trả thông tin chẩn đoán.
  3. Nghiêm trọng hơn: dòng **`406–413`** gọi `await this.processPayosVerificationWebhook(...).catch((e) => { this.logger.warn(...); })`. Nếu quá trình xử lý webhook/ghi DB bên trong ném bất kỳ lỗi nào, `.catch(...)` **nuốt trọn exception**, và API vẫn trả HTTP `200` với trạng thái cũ `PENDING` khiến FE/người dùng không thể biết vì sao không duyệt!
- **Hướng sửa:**
  - Tăng timeout (ví dụ `8000ms`), kiểm tra `queryRes.ok`, log rõ `code` + `status` khi PayOS không trả `PAID`, và thêm nhánh fallback tra cứu theo `latestSession.paymentLinkId` nếu query bằng `paymentOrderCode` thất bại.
  - Không dùng `.catch(...)` nuốt im lỗi ở `#L411`; nếu đồng bộ DB/webhook lỗi khi PayOS đã báo `PAID`, phải báo lỗi hoặc đánh dấu trạng thái đối soát rõ ràng thay vì trả về `PENDING` giả.
  - **Cần backend kiểm tra thêm trên Render log** tại thời điểm `11:03–11:12` với `CUST_VRF_970423_1FDTC6`: kiểm tra PayOS `GET /v2/payment-requests/{orderCode}` trả `status` gì và PayOS Dashboard đang trỏ Webhook URL về đâu.

### [P0-3] Bắt buộc cứng `counterAccountBankId` & `counterAccountNumber` dù PayOS trả `null` với nhiều ngân hàng
- **Vị trí:**
  - `backend/src/customers/customer-bank-penny-verification.service.ts` (dòng `754–766`)
  - `backend/src/customers/customers.repository.ts` (dòng `1511–1548`, `1615–1618`, `1668–1670`)
- **Nguyên nhân kỹ thuật:**
  - `hasSufficientEvidence = !isMissingRef && Boolean(sourceBankBin && sourceAccountNumber)` (`#L758`).
  - Trong ảnh thực tế, khách hàng đăng ký **TPBank (`970423`)**. Theo tài liệu chính thức của PayOS, các trường tài khoản đối ứng (`counterAccountBankId`, `counterAccountNumber`, `counterAccountName`) chỉ được trả về đầy đủ qua một số ngân hàng hỗ trợ đối soát như MB Bank, ACB, KienlongBank... Với các ngân hàng/kênh không hỗ trợ đủ, PayOS trả `null` hoặc `""`.
  - Khi đó `hasSufficientEvidence = false` -> phiên bị chuyển thành `PENDING_SOURCE_EVIDENCE` (`matchDecision = 'INSUFFICIENT_DATA'`), và nghĩa vụ hoàn tiền bị đẩy sang `PENDING_MANUAL_REFUND`, vĩnh viễn không tự duyệt và không tự hoàn tiền.
- **Hướng sửa:** Kiểm tra dữ liệu PayOS thực tế của `CUST_VRF_970423_1FDTC6` xem `transactions[0].counterAccountBankId` và `counterAccountNumber` có bị `null`/`""` không; cấu hình đúng tài khoản nhận PayOS có hỗ trợ trả `counterAccount*` (như MB/ACB/KienlongBank trên PayOS) hoặc bổ sung hướng xử lý rõ ràng khi thiếu `counterAccount*`.

### [P1-2] Các phiên đã quá hạn vẫn hiển thị `Phiên đang mở` (`ACTIVE`) trong lịch sử
- **Vị trí:** `backend/src/customers/customer-bank-penny-verification.service.ts` (dòng `439`, `625`)
- **Hiện tượng thực tế:** Các phiên cũ `NNB7PE`, `W6SAFG`, `GNEWND` đều đã quá `expiresAt` nhưng cột lịch sử vẫn ghi `Phiên đang mở` (`sessionStatus: 'ACTIVE'`).
- **Nguyên nhân:** `getVerificationStatus` tự tính `isExpired` (`#L439`), nhưng không có cơ chế cập nhật `session_status = 'EXPIRED'` trong DB; còn `getVerificationHistory` (`#L625`) trả thẳng `s.sessionStatus` nguyên trạng từ DB.
- **Hướng sửa:** Chuyển `session_status = 'EXPIRED'` khi quá hạn (hoặc chuẩn hóa `sessionStatus` ở `getVerificationHistory` dựa theo `expiresAt` tương tự `getVerificationStatus`).

### [P1-3] `PayosWebhookPayloadDto` thiếu `webhook_url` dưới global `ValidationPipe`
- **Vị trí:**
  - `backend/src/main.ts` (dòng `120–126`)
  - `backend/src/customers/customer-bank-webhook.controller.ts` (dòng `25–34`)
  - `backend/src/customers/dto/payos-webhook-payload.dto.ts` (dòng `4–34`)
- **Nguyên nhân:** `main.ts` bật global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. Controller kiểm tra `body?.webhookUrl || (body as any)?.webhook_url` (`#L33`), nhưng `PayosWebhookPayloadDto` chỉ khai báo `webhookUrl`, không khai báo `webhook_url`, nên request ping có `webhook_url` sẽ bị global pipe chặn `400 Bad Request`.

### [P1-4] Hoàn tiền tự động 2.000đ chỉ chạy khi đủ env Payout trên Render
- **Vị trí:**
  - `backend/src/customers/customer-bank-penny-verification.service.ts` (dòng `858–871`)
  - `backend/src/payments/payos-payout.service.ts` (dòng `50–69`)
- **Chi tiết:** Ở `NODE_ENV=production`, `CustomerBankRefundWorker` chỉ gọi chi hộ thật khi **`FEATURE_CUSTOMER_REFUND_PAYOUT_ENABLED=true`** và đủ 3 khóa riêng **`PAYOS_PAYOUT_CLIENT_ID`**, **`PAYOS_PAYOUT_API_KEY`**, **`PAYOS_PAYOUT_CHECKSUM_KEY`** (không fallback sang `PAYOS_CLIENT_ID`/`API_KEY`/`CHECKSUM_KEY` ở production). Thiếu bất kỳ biến nào, worker chạy `[DRY-RUN]` và tiền hoàn giữ mãi ở `PENDING_REFUND` (`Chờ hoàn tiền`).

---

## III. LỖI Ở ROLE CHỦ CỬA HÀNG (Store Owner)

Ngoài lỗi bị Khách hàng nuốt mất webhook ở mục **[P0-1]**, phần vừa sửa trong commit `b03ae5b` ở module `bank-verification` có **4 lỗi nghiêm trọng**:

### [P0-4] Active Fallback Query đọc sai tầng JSON PayOS -> tự động đánh `FAILED` vĩnh viễn giao dịch vừa thanh toán!
- **Vị trí:**
  - `backend/src/bank-verification/bank-verification.service.ts` (dòng `1037–1058`)
  - `backend/src/bank-verification/bank-verification.repository.ts` (dòng `433–559`)
- **Nguyên nhân kỹ thuật:**
  - Khi gọi `GET https://api-merchant.payos.vn/v2/payment-requests/${tx.providerTransactionId}` trả về `status === 'PAID'`, PayOS đặt các trường `reference`, `transactionDateTime`, `counterAccountBankId`, `counterAccountNumber`, `counterAccountName` bên trong mảng **`payosData.data.transactions[0]`**, KHÔNG phải trực tiếp trên `payosData.data`.
  - Code ở `#L1038-L1057` lại đọc trực tiếp từ `const data = payosData.data;` -> tất cả các trường `data.reference`, `data.transactionDateTime`, `data.counterAccountBankId`, `data.counterAccountNumber`, `data.counterAccountName` đều bị **`undefined`**! Đồng thời DTO không truyền **`bin: data.bin`**.
  - Khi truyền `webhookDto` này vào `handleVerificationWebhook` -> `executeAtomicWebhookVerificationTx`, ở môi trường `production` (`isStrict = true`), repository kiểm tra thiếu `destinationBankBin` / `senderAccountNumber` / `senderBankBin` → **cập nhật DB thành `status = 'FAILED'`** (`DESTINATION_BANK_UNVERIFIABLE` hoặc `SENDER_ACCOUNT_UNVERIFIABLE`) ngay lần poll đầu tiên!
  - Một khi `status` chuyển thành `FAILED`, điều kiện `if (tx.status === 'PENDING')` ở `#L1016` ngừng poll vĩnh viễn dù chủ cửa hàng đã chuyển 2.000đ thành công.
- **Hướng sửa:**
  ```ts
  const firstTx = Array.isArray(data.transactions) ? data.transactions[0] : null;
  ```
  Map đúng `bin: data.bin`, `reference: firstTx?.reference`, `transactionDateTime: firstTx?.transactionDateTime`, `description: firstTx?.description || data.description`, `counterAccountBankId: firstTx?.counterAccountBankId`, `counterAccountNumber: firstTx?.counterAccountNumber`, `counterAccountName: firstTx?.counterAccountName`, và kiểm tra `res.ok` + xử lý khi `transactions` rỗng.

### [P0-5] `isPayosIntegratedTx` luôn trả về `false` khi PayOS có `data.reference` -> từ chối `DESTINATION_*_MISMATCH`
- **Vị trí:**
  - `backend/src/bank-verification/bank-verification.service.ts` (dòng `258`, `425–433`)
  - `backend/src/bank-verification/bank-verification.repository.ts` (dòng `427–516`)
- **Nguyên nhân kỹ thuật:**
  1. Lúc tạo yêu cầu (`#L258`), `createVerificationRequest` lưu `providerTransactionId = payosOrderCode.toString()`.
  2. Lúc xử lý webhook PayOS (`#L432`), `handleVerificationWebhook` gán `providerTransactionId = dto.data.reference || dto.providerTransactionId` (mã trace ngân hàng dạng `"TF..."`, **khác với `payosOrderCode`**).
  3. Sang `executeAtomicWebhookVerificationTx` (`#L427-L431`):
     ```ts
     const isPayosIntegratedTx = Boolean(
       lockedTx.provider_transaction_id &&
       params.providerTransactionId &&
       lockedTx.provider_transaction_id === params.providerTransactionId
     );
     ```
     Vì `payosOrderCode !== data.reference`, `isPayosIntegratedTx` **luôn là `false`**.
  4. Do đó, nếu tài khoản nhận thực tế trên PayOS (`data.accountNumber` / `data.virtualAccountNumber` / `data.bin`) khác `PLATFORM_BANK_ACCOUNT_NUMBER` / `PLATFORM_BANK_BIN` trên Render, điều kiện `!isPayosIntegratedTx` tại `#L476` & `#L498` **đánh FAIL giao dịch** (`DESTINATION_ACCOUNT_MISMATCH` hoặc `DESTINATION_BANK_MISMATCH`).
- **Hướng sửa:** Tách cột `payos_order_code` riêng trong bảng `bank_account_verification_transactions` (hoặc đối chiếu `lockedTx.payos_order_code === String(dto.data.orderCode)`) để nhận diện giao dịch qua cổng PayOS độc lập với mã `data.reference` của ngân hàng.

### [P1-5] Trả chuỗi EMVCo thô vào `qrCodeUrl` và làm mất `checkoutUrl` khi poll / tải lại
- **Vị trí:**
  - Backend: `backend/src/bank-verification/bank-verification.service.ts` (dòng `243–245`, `282–283`, `964–1001`)
  - Frontend liên quan: `frontend/src/components/common/BankingPrimitives.tsx` (dòng `36–37`), `frontend/src/pages/store/StoreFinancePage.tsx` (dòng `100–106`), `frontend/src/services/store-finance-flow.ts` (dòng `21–37`)
- **Nguyên nhân kỹ thuật:**
  1. `resData.data.qrCode` của PayOS là chuỗi raw VietQR/EMVCo (`000201...`), **không phải URL ảnh HTTPS**. Gán `qrCodeUrl: payosQrCode || defaultQrUrl` (`#L282`) làm frontend (chỉ chấp nhận `https://img.vietqr.io/...`) không hiển thị được QR.
  2. Bảng `bank_account_verification_transactions` chưa lưu `checkoutUrl` / `paymentLinkId`, nên `formatVerificationTransaction` (`#L964-L1001`, dùng khi FE poll 4 giây/lần hoặc mở lại phiên từ lịch sử) **không trả `checkoutUrl`** và dựng lại QR tĩnh chuyển về `PLATFORM_BANK_ACCOUNT_NUMBER` (kênh không có webhook PayOS nếu chưa tích hợp bank hook riêng).
- **Hướng sửa:** Lưu `checkoutUrl` (và `qrCodeData` nếu cần) vào DB; luôn trả `checkoutUrl` trong `formatVerificationTransaction`; tách riêng field EMVCo string (`payosQrCode`) khỏi `qrCodeUrl` (hoặc giữ `qrCodeUrl` là URL ảnh `img.vietqr.io`), sau đó đồng bộ FE Store hiển thị nút `Mở thanh toán PayOS` giống luồng Khách hàng.

### [P1-6] Nguy cơ gửi lệnh hoàn tiền 2 lần giữa `triggerAutomatedRefund` và `StoreBankRefundWorker`
- **Vị trí:**
  - `backend/src/bank-verification/bank-verification.service.ts` (dòng `539–615`, `620–766`)
  - `backend/src/bank-verification/bank-verification.repository.ts` (dòng `349–361`)
- **Nguyên nhân kỹ thuật:**
  - `executeAtomicWebhookVerificationTx` chèn sẵn bản ghi `PENDING_REFUND` (`attempt_count = 0`) vào `store_bank_refund_obligations` (`#L350-L360`).
  - Ngay sau đó `handleVerificationWebhook` gọi trực tiếp `this.triggerAutomatedRefund(...)` (`#L545`), hàm này gọi `provider.createRefund(...)` và **chỉ cập nhật bảng `bank_account_verification_transactions`**, hoàn toàn không claim lease hay cập nhật `store_bank_refund_obligations`.
  - Sau đó 2 phút, cron `StoreBankRefundWorker` chạy `processStoreRefundWorkerBatch` (`#L620-L766`), thấy dòng trong `store_bank_refund_obligations` vẫn còn `refund_status = 'PENDING_REFUND'` và `attempt_count === 0` (`#L651`) -> **gửi lại `provider.createRefund(...)` lần thứ 2** với cùng `refund_reference`.
- **Hướng sửa:** Bỏ gọi `triggerAutomatedRefund` trực tiếp trong `handleVerificationWebhook` để toàn bộ việc chi hoàn đi qua 1 cửa duy nhất là `processStoreRefundWorkerBatch` (hoặc đồng bộ state/lease trên `store_bank_refund_obligations`).

---

## IV. CHECKLIST KIỂM TRA TRÊN RENDER & PAYOS DASHBOARD

1. **PayOS Dashboard (`my.payos.vn`):** Xác nhận Webhook URL đang trỏ đúng về `https://backend-fae8.onrender.com/api/v1/payments/payos/webhook` (hoặc endpoint riêng tương ứng) và đã nhận webhook thực từ PayOS (không chỉ handshake).
2. **Kiểm tra log Render cho phiên `CUST_VRF_970423_1FDTC6`:** Xem kết quả gọi `GET https://api-merchant.payos.vn/v2/payment-requests/{orderCode}` và kiểm tra `transactions[0].counterAccountBankId` / `counterAccountNumber` có giá trị hay bị `null`.
3. **Biến môi trường trên Render (Production):**
   - Bật hoàn tiền tự động Khách hàng: `FEATURE_CUSTOMER_REFUND_PAYOUT_ENABLED=true`
   - Đủ bộ 3 khóa Payout dùng chung cho hoàn tiền cả 2 role: `PAYOS_PAYOUT_CLIENT_ID`, `PAYOS_PAYOUT_API_KEY`, `PAYOS_PAYOUT_CHECKSUM_KEY`
   - Tra cứu tài khoản Store Owner (`POST /stores/bank-accounts/lookup`): cấu hình đúng `VIETQR_CLIENT_ID`, `VIETQR_API_KEY` (nếu thiếu sẽ trả `503`)
   - Bỏ `PAYOS_RETURN_URL` trỏ cứng về trang chủ; kiểm tra `FRONTEND_URL` trỏ đúng domain frontend đang chạy.

