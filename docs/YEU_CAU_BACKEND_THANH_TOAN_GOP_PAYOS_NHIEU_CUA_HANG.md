# BÁO CÁO KỸ THUẬT & YÊU CẦU BACKEND: THANH TOÁN GỘP PAYOS CHO GIỎ HÀNG NHIỀU CỬA HÀNG

**Thời gian tạo:** 15/11/2026  
**Dự án:** Smart Order Button Platform  
**Mục đích:** Gửi cho đội ngũ Backend để nâng cấp tính năng tạo 1 link/mã QR PayOS duy nhất cho giỏ hàng gồm nhiều sản phẩm từ nhiều cửa hàng khác nhau.

---

## 1. Tóm tắt tình trạng hiện tại & Nhu cầu nghiệp vụ

### 1.1. Những gì ĐÃ HOẠT ĐỘNG hoàn hảo (Không cần sửa backend)
* **Mua 1 sản phẩm:** Khách hàng ấn thanh toán PayOS -> Hệ thống tạo đơn và hiển thị mã QR VietQR ngay trên trang web -> Khách quét chuyển khoản -> Hệ thống tự động xác nhận đơn thành công qua WebSocket (`ORDER_PAYMENT_CONFIRMED`).
* **Mua NHIỀU sản phẩm thuộc CÙNG 1 CỬA HÀNG:** Hệ thống backend (`POST /storefront/orders`) gom toàn bộ sản phẩm vào 1 mã đơn hàng (`Order`), tính chính xác **TỔNG SỐ TIỀN** của tất cả sản phẩm -> Gọi PayOS tạo 1 mã QR chứa **TỔNG SỐ TIỀN** -> Khách hàng quét mã thanh toán 1 lần duy nhất cho toàn bộ sản phẩm.

### 1.2. Vấn đề hiện tại khi mua sản phẩm từ NHIỀU CỬA HÀNG KHÁC NHAU
* Khi khách hàng chọn giỏ hàng gồm sản phẩm của Cửa hàng A (ví dụ: Nước suối 30.000 ₫) và Cửa hàng B (ví dụ: Kẹo 20.000 ₫):
  * **Người dùng mong muốn:** Chỉ quét **1 mã QR PayOS duy nhất** với **TỔNG TIỀN là 50.000 ₫** để thanh toán cho toàn bộ giỏ hàng.
  * **Thực trạng backend hiện tại:** Backend **CHƯA HỖ TRỢ** gom nhiều cửa hàng vào 1 mã thanh toán PayOS. Hệ thống bắt buộc phải tách thành 2 đơn hàng độc lập và khách phải thanh toán 2 lần riêng biệt.

---

## 2. Nguyên nhân kỹ thuật phía Backend hiện tại

Sau khi đối soát mã nguồn backend (`orders.service.ts`, `payments.service.ts`, `prisma/schema.prisma`):

1. **Ràng buộc Database Model (1-1 giữa Order và Store):**
   * Trong bảng `Order`, trường `storeId` là bắt buộc và chỉ lưu 1 cửa hàng duy nhất:
     ```prisma
     model Order {
       orderId       BigInt   @id @default(autoincrement())
       storeId       BigInt
       totalAmount   Decimal  @db.Decimal(15, 2)
       paymentStatus String   // PENDING, PAID, CANCELLED...
       ...
     }
     ```
   * Hiện tại backend **chưa có bảng cha** (ví dụ: `CheckoutSession` hoặc `MasterOrder`) để liên kết các đơn con thuộc cùng 1 phiên mua sắm.

2. **Ràng buộc API tạo Link PayOS (`POST /api/v1/payments/payos/create-link`):**
   * Endpoint hiện tại chỉ nhận đúng 1 `orderId`:
     ```typescript
     export class CreatePaymentLinkDto {
       @IsNotEmpty()
       orderId: string | number;
       // ...
     }
     ```
   * Logic kiểm tra trong `payments.service.ts` ép buộc lấy số tiền từ đơn hàng đó trong CSDL (`const orderAmount = Number(order.totalAmount);`), không cho phép truyền mảng `orderIds: string[]` hoặc số tiền gộp.

3. **Ràng buộc Webhook PayOS (`POST /api/v1/payments/payos/webhook`):**
   * PayOS chỉ trả về 1 mã giao dịch `orderCode`.
   * Backend đang map: `orderCode` $\rightarrow$ 1 bản ghi `PaymentTransaction` $\rightarrow$ 1 `orderId` duy nhất.
   * Khi tiền về, hàm `confirmPaymentAtomicTx` chỉ đổi trạng thái `PAID` cho 1 đơn hàng duy nhất và bắn WebSocket `ORDER_PAYMENT_CONFIRMED` về đúng 1 `storeId`.

---

## 3. Đề xuất giải pháp cho Backend Team (Technical Specifications)

Để hỗ trợ khách hàng quét 1 mã QR thanh toán tổng số tiền của giỏ hàng gồm nhiều cửa hàng, backend cần bổ sung theo 1 trong 2 phương án dưới đây:

### Phương án khuyên dùng: Thêm bảng `CheckoutSession` (Chuẩn E-Commerce Marketplace)

```
[Khách hàng thanh toán Giỏ hàng]
              │
              ▼
   Tạo CheckoutSession (Session #CS-1002, Tổng tiền: 50.000 ₫)
              │
      ┌───────┴───────┐
      ▼               ▼
Đơn Cửa hàng A    Đơn Cửa hàng B
(30.000 ₫)       (20.000 ₫)
      │               │
      └───────┬───────┘
              ▼
  Gửi PayOS tạo 1 VietQR: 50.000 ₫
              │
     [Khách chuyển khoản]
              │
              ▼
    PayOS Webhook báo '00'
              │
  ┌───────────┴───────────┐
  ▼                       ▼
Đơn Cửa hàng A -> PAID   Đơn Cửa hàng B -> PAID
Socket emit Store A      Socket emit Store B
```

#### Bước 1: Schema Migration
Thêm bảng `checkout_sessions` và khóa ngoại trong `orders`:
```prisma
model CheckoutSession {
  sessionId       BigInt   @id @default(autoincrement())
  sessionCode     String   @unique
  customerId      BigInt
  totalAmount     Decimal  @db.Decimal(15, 2)
  paymentMethod   String   @default("PAYOS")
  paymentStatus   String   @default("PENDING") // PENDING, PAID, CANCELLED
  paymentLinkId   String?  @unique
  payosOrderCode  BigInt?  @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  orders          Order[]
}

// Trong model Order thêm:
// checkoutSessionId BigInt?
// checkoutSession   CheckoutSession? @relation(fields: [checkoutSessionId], references: [sessionId])
```

#### Bước 2: API Tạo Link Thanh Toán Gộp
* **Endpoint:** `POST /api/v1/payments/payos/create-batch-link`
* **Quyền:** `JwtAuthGuard` (Role `CUSTOMER`)
* **Request Body:**
  ```json
  {
    "orderIds": ["101", "102"],
    "description": "Thanh toan gio hang"
  }
  ```
* **Logic xử lý của Backend:**
  1. Kiểm tra quyền sở hữu: tất cả các `orderIds` phải thuộc cùng `customerId` của người đang đăng nhập.
  2. Xác minh trạng thái: tất cả các đơn phải ở trạng thái `PENDING` và chưa thanh toán (`paymentStatus != 'PAID'`).
  3. Tính tổng tiền: `totalAmount = sum(order.totalAmount)`.
  4. Tạo bản ghi `CheckoutSession` và cập nhật `checkoutSessionId` vào các `Order`.
  5. Gọi PayOS Merchant API `https://api-merchant.payos.vn/v2/payment-requests` với `amount = totalAmount`, sinh `orderCode` duy nhất cho session này.
  6. Trả về cho Frontend:
     ```json
     {
       "success": true,
       "data": {
         "sessionCode": "CS-1794675636",
         "amount": 50000,
         "checkoutUrl": "https://pay.payos.vn/web/...",
         "qrCode": "00020101021238540010A000000727012600069704220112...",
         "orderIds": ["101", "102"]
       }
     }
     ```

#### Bước 3: Cập nhật PayOS Webhook Handler
Trong file `backend/src/payments/payments.service.ts`:
* Khi nhận webhook từ PayOS với mã `orderCode`:
  1. Kiểm tra xem `orderCode` có thuộc `CheckoutSession` hay không.
  2. Nếu thuộc `CheckoutSession`:
     * Mở 1 `prisma.$transaction`:
       * Đánh dấu `CheckoutSession` sang `PAID`.
       * Đánh dấu tất cả các `orders` liên kết với session đó sang `PAID` và `orderStatus = 'CONFIRMED'`.
       * Tạo các bản ghi `PaymentTransaction` hoặc cập nhật trạng thái đã thanh toán.
     * Phát WebSocket sự kiện `ORDER_PAYMENT_CONFIRMED` đến từng `storeId` của từng đơn hàng:
       ```typescript
       for (const subOrder of session.orders) {
         this.eventsGateway.emitToStore(subOrder.storeId.toString(), 'ORDER_PAYMENT_CONFIRMED', {
           orderId: subOrder.orderId.toString(),
           orderCode: subOrder.orderCode,
           amount: Number(subOrder.totalAmount),
         });
       }
       ```
     * Gửi thông báo Push Notification/FCM cho khách hàng và từng chủ cửa hàng.

---

## 4. Trạng thái Frontend đã chuẩn bị sẵn sàng

Phía Frontend ([buttontdash.vercel.app](https://buttontdash.vercel.app/)) hiện tại đã:
1. **Đã tích hợp Modal Quét mã VietQR tại chỗ (`PayOSOrderQrModal`)**: Không còn bị chuyển hướng rời khỏi trang, hiển thị đúng mã QR, đếm ngược thời gian, và nhận diện tức thì khi có thanh toán.
2. **Đã hỗ trợ hiển thị từng đơn nhiều sản phẩm**: Khi khách mua nhiều sản phẩm từ 1 cửa hàng, số tiền được gom chuẩn 100% lên mã QR.
3. **Đã chuẩn bị sẵn giao diện thanh toán từng đơn trong giỏ hàng nhiều cửa hàng**: Nếu có nhiều cửa hàng, khách có thể ấn nút "Quét mã QR PayOS" trên từng đơn để thanh toán ngay trên màn hình. Ngay khi backend có API `create-batch-link`, Frontend sẽ chuyển sang hiển thị 1 mã QR gộp duy nhất.
