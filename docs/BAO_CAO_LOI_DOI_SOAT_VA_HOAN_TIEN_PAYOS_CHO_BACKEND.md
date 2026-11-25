# BÁO CÁO KỸ THUẬT GỬI BACKEND: LỖI ĐỐI SOÁT PAYOS PAYOUT VÀ ĐỒNG BỘ TRẠNG THÁI HOÀN TIỀN ĐƠN HÀNG

- **Ngày ghi nhận:** 26/11/2026
- **Môi trường:** Staging / Production
- **Ca kiểm thử thực tế:**
  - **Mã đơn hàng:** `#WEB-1795634559446-232` (Biên lai `#19`, giá trị: `2.000 ₫`)
  - **Mã nghĩa vụ hoàn tiền:** `#4` (`ORDER_REFUND`)
  - **Tài khoản thụ hưởng:** `LE HO GIA BAO` — STK `*******488`
  - **Thực tế tài khoản ngân hàng:** **Tiền 2.000 ₫ đã cộng thành công vào tài khoản ngân hàng của khách hàng.**

---

## TỔNG QUAN 2 VẤN ĐỀ CẦN XỬ LÝ GẤP

1. **Vấn đề 1 (Admin):** Tiền đã chuyển về tài khoản khách hàng thành công, nhưng khi Admin bấm nút **"Đối soát"** (`POST /api/v1/admin/payment-refunds/obligations/4/sync`), Backend vẫn trả về `settled: false`, giữ nguyên `status: "PENDING_RECONCILIATION"` (Chờ đối soát) chứ không chuyển sang `REFUNDED` (Đã hoàn tất).
2. **Vấn đề 2 (Khách hàng):** Vì Database Backend chưa chốt trạng thái hoàn tất, API `GET /api/v1/orders` vẫn trả về `order.paymentStatus = "REFUND_PENDING"`. Kết quả là khách hàng đã nhận được tiền thật trong ngân hàng nhưng trên màn hình ứng dụng vẫn hiển thị dòng chữ cảnh báo: **`Đơn đã hủy · Chờ hoàn tiền (12–24h)`**.

```
[Admin bấm Chi PayOS] 
       │
       ▼
1. Backend gửi lệnh sang PayOS ──► Tiền QUA NAPAS 24/7 (1-2s) ──► KHÁCH ĐÃ NHẬN TIỀN VÀO TÀI KHOẢN
       │
       ▼
2. PayOS gửi Webhook / Backend gọi API Sync Đối soát
       │
       ▼ ⚠️ [LỖI TẠI ĐÂY]: Node-3 Worker / Webhook chưa chốt được trạng thái SUCCEEDED
3. Backend KHÔNG chạy: UPDATE orders SET payment_status = 'REFUNDED'
       │
       ▼
[Khách hàng]: Vẫn thấy đơn hiển thị "Chờ hoàn tiền (12–24h)" dù tiền đã nằm trong thẻ!
```

---

## CHI TIẾT KỸ THUẬT & NGUYÊN NHÂN TỪNG LỖI

### Vấn đề 1: Nút "Đối soát" không tất toán được nghĩa vụ (`PENDING_RECONCILIATION`)

#### Hiện tượng:
Khi Admin bấm nút **"Đối soát"** trên giao diện Hoàn tiền PayOS, hệ thống hiển thị thông báo:
> *"Nghĩa vụ #4 vẫn đang ở trạng thái Chờ đối soát. Worker IP tĩnh (Node-3) chưa nhận được xác nhận tất toán cuối cùng từ PayOS — vui lòng kiểm tra Worker Node-3 hoặc xem chi tiết chứng từ."*

#### Truy vết mã nguồn Backend (`PaymentRefundsService.syncObligationStatus`):
Tại [`src/payments/payment-refunds.service.ts`](file:///f:/Learning/SEM9-FPTu/backend/src/payments/payment-refunds.service.ts):
1. **Cơ chế ủy quyền Node-3 (`isDelegatedToStaticIpWorker()`):**
   * Do Render chạy IP động (bị PayOS chặn 403), Render ủy quyền cho AWS EC2 `Node-3` (`3.25.136.6`) qua cấu hình `PAYOS_PAYOUT_DELEGATE_TO_WORKER=true`.
   * Khi Admin bấm "Đối soát", Render cập nhật `nextReconcileAt = now` và `outboxEvent.nextAttemptAt = now`, rồi chạy vòng lặp `while (Date.now() < deadlineMs)` (tối đa 10 giây) để chờ Worker trên `Node-3` xử lý.
2. **Điểm nghẽn:**
   * **Trường hợp A:** Worker `PaymentRefundWorkerService` trên AWS `Node-3` chưa được bật (`PAYOS_PAYOUT_WORKER_ENABLED=true`), hoặc service bị dừng, hoặc chưa pull commit mới nhất (`ee019cc`). Khi đó Render đợi hết 10 giây mà không thấy thay đổi nên trả về nguyên trạng `PENDING_RECONCILIATION`.
   * **Trường hợp B:** `Node-3` có chạy nhưng khi gọi `reconcileAttempt()` $\rightarrow$ `lookupProviderPayoutByReferenceOrId()` $\rightarrow$ gọi PayOS `GET /v1/payouts/{id}`, dữ liệu PayOS trả về không vượt qua hàm kiểm định [`verifyPayosPayoutEvidence()`](file:///f:/Learning/SEM9-FPTu/backend/src/payments/payos-payout-verifier.ts):
     - PayOS trả về `approvalState` vẫn là `'PROCESSING'` thay vì `'COMPLETED'` / `'SUCCEEDED'`.
     - Hoặc mảng `transactions` trong chi tiết payout từ PayOS thiếu thông tin `toBin` / `accountNumberHash` / `cleanReportedAcc` khiến hàm verifier Fail-Closed trả về `isVerified: false`.
   * Vì `isVerified` bị `false`, Backend tiếp tục gọi `markAttemptPendingReconciliationTx()` giữ nguyên trạng thái `PENDING_RECONCILIATION`.

---

### Vấn đề 2: Đơn hàng khách hàng không tự chuyển sang "Đã hoàn tiền" (`REFUNDED`)

#### Hiện tượng:
Tại trang Khách hàng (`CustomerOrdersPage.tsx`), đơn hàng `#WEB-1795634559446-232` vẫn giữ nhãn:
* Trạng thái đơn: **Đã hủy** (`CANCELLED`)
* Trạng thái thanh toán: **Đơn đã hủy · Chờ hoàn tiền (12–24h)** (`paymentStatus = 'REFUND_PENDING'`)

#### Truy vết mã nguồn Backend:
1. Tại [`src/payments/payment-refunds.repository.ts`](file:///f:/Learning/SEM9-FPTu/backend/src/payments/payment-refunds.repository.ts) (hàm `settleRefundSuccessAtomicTx`, dòng 1413–1419):
   ```typescript
   // Lệnh chuyển trạng thái đơn hàng sang REFUNDED NẰM TRONG HÀM NÀY:
   if (remainingOpenMainObls === 0 && unrefundedOrderReceipts === 0) {
     await tx.order.update({
       where: { orderId },
       data: { paymentStatus: 'REFUNDED' },
     });
     nextOrderPaymentStatus = 'REFUNDED';
   }
   ```
2. **Nguyên nhân cốt lõi:**
   * Hàm `settleRefundSuccessAtomicTx` **CHỈ ĐƯỢC GỌI** khi đối soát xác nhận `verifyPayosPayoutEvidence` trả về `isVerified: true` (hoặc qua Webhook Payout hợp lệ).
   * Do Vấn đề 1 bị kẹt, hàm này chưa bao giờ được thực thi cho nghĩa vụ #4.
   * Dẫn đến: Database bảng `orders` vẫn lưu `payment_status = 'REFUND_PENDING'`. Frontend gọi `GET /api/v1/orders` nhận về `REFUND_PENDING` nên bắt buộc phải hiển thị là *"Chờ hoàn tiền"*.
   * **Thiếu cơ chế tự động qua Webhook:** Đúng quy trình thanh toán, ngay khi PayOS chuyển tiền xong, PayOS sẽ bắn Webhook `POST /api/v1/webhooks/payos/payout`. Nếu Webhook Controller xử lý thành công, hệ thống phải tự động chốt `REFUNDED` và bắn Socket `ORDER_REFUNDED` ngay lập tức về cho khách mà **không bắt Admin phải vào bấm nút Đối soát thủ công**.

---

## CÁC BƯỚC BACKEND CẦN KIỂM TRA & SỬA CHỮA

### 1. Kiểm tra máy chủ Worker IP tĩnh AWS Node-3 (`3.25.136.6`)
- Kiểm tra tiến trình Backend trên Node-3 có đang chạy không:
  ```bash
  pm2 status # hoặc docker ps / systemctl status
  ```
- Kiểm tra file cấu hình `.env` trên Node-3:
  ```env
  PAYOS_PAYOUT_WORKER_ENABLED=true
  PAYOS_PAYOUT_DELEGATE_TO_WORKER=false
  NODE_ENV=production
  ```
  *(Lưu ý: Trên Render Node-1 & Node-2 thì `PAYOS_PAYOUT_WORKER_ENABLED=false` và `PAYOS_PAYOUT_DELEGATE_TO_WORKER=true`, nhưng trên AWS Node-3 worker phải là `true`).*
- Kiểm tra log của Node-3 xem có lỗi khi thực hiện `reconcilePendingAttemptsBatch` cho nghĩa vụ #4 không:
  ```bash
  pm2 logs backend --lines 200
  ```

### 2. Kiểm tra Webhook PayOS Payout (`POST /api/v1/webhooks/payos/payout`)
- Đăng nhập Dashboard cổng PayOS Merchant $\rightarrow$ Cấu hình Webhook chi hộ (Payout Webhook).
- Kiểm tra URL Webhook đã trỏ đúng về domain backend:
  `https://<domain-backend>/api/v1/webhooks/payos/payout` (hoặc qua Cloudflare Worker proxy).
- Kiểm tra `PAYOS_PAYOUT_CHECKSUM_KEY` trên server có khớp đúng với Checksum Key chi hộ trên Dashboard PayOS không.
- Kiểm tra log `PayoutWebhookController`: Khi PayOS gửi webhook xác nhận tiền đã chi, `processSignedPayoutWebhook()` có nhận được không và có bị lỗi chữ ký hay không.

### 3. Kiểm tra hàm đối soát PayOS `verifyPayosPayoutEvidence`
- Khi gọi `GET /v1/payouts/{id}` từ PayOS cho đơn hàng #4, kiểm tra payload thực tế PayOS trả về:
  - Trường `approvalState` / `state` của PayOS trả về giá trị gì? (`SUCCEEDED`, `COMPLETED` hay chữ gì khác?).
  - Trong mảng `transactions`, PayOS trả về trường số tài khoản nào? (`toAccountNumber`, `accountNumberHash` hay bị mã hóa?).
  - Nếu PayOS trả về định dạng che dấu khác với snapshot đã lưu trong DB, hàm verifier đang đánh `isVerified = false` khiến đơn mãi kẹt ở `PENDING_RECONCILIATION`.

### 4. Đảm bảo Side-Effects cập nhật đơn và phát Socket Realtime
- Khi `settleRefundSuccessAtomicTx` chạy thành công, đảm bảo hàm `emitSettlementSideEffects()` phát đầy đủ:
  ```typescript
  // 1. Cập nhật DB:
  // orders.payment_status = 'REFUNDED'
  // payment_refund_obligations.status = 'REFUNDED'

  // 2. Phát socket realtime để khách hàng đổi màu UI ngay:
  this.eventsGateway.emitToCustomer(customerId, 'ORDER_REFUNDED', {
    orderId: order.orderId.toString(),
    orderPaymentStatus: 'REFUNDED',
    obligationId: settledObl.obligationId.toString(),
  });
  ```
*(Phía Frontend hiện tại đã bổ sung đầy đủ bộ lắng nghe socket `ORDER_REFUNDED` và banner xác nhận xanh `Đã hoàn tiền thành công về tài khoản`, chỉ chờ Backend phát lệnh là giao diện khách hàng sẽ tự nhảy sang màu xanh ngay lập tức).*
