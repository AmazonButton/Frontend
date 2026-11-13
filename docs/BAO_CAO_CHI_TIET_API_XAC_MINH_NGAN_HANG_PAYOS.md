# Báo Cáo Kỹ Thuật: Kiểm Thử API Xác Minh Ngân Hàng PayOS & Chi Tiết Lỗi CITAD/BIN

**Ngày kiểm thử:** 14/11/2026  
**Môi trường:** Production / Live Backend (`https://backend-fae8.onrender.com`)  
**Mục đích:** Báo cáo chi tiết URL API, HTTP Status Code, và Response Body thực tế để đội ngũ Backend đối soát và khắc phục lỗi lệch mã ngân hàng CITAD/BIN.

---

## 1. Tóm Tắt Hiện Tượng & Nguyên Nhân Kỹ Thuật

| Hạng mục | Thực tế ghi nhận |
| :--- | :--- |
| **Tài khoản đăng ký** | TPBank (Ngân hàng TMCP Tiên Phong), BIN: **`970423`**, Chủ TK: **LE HO GIA BAO** |
| **Tiền chuyển đến** | Đã nhận đủ **2.000 ₫** qua PayOS, trong thời hạn 15 phút của phiên |
| **Tài khoản chuyển** | Đúng app TPBank của chính chủ **LE HO GIA BAO** |
| **Hiện tượng lỗi** | Giao diện và API trả về: **`FAILED_MISMATCH`** (Thông tin không khớp) |
| **Nguyên nhân gốc rễ** | Cổng PayOS trả về mã ngân hàng nguồn dạng CITAD 8 số là **`01358001`** (mã liên ngân hàng của TPBank). Backend đang so sánh trực tiếp dạng chuỗi `sourceBankBin === registeredBin` (`"01358001" === "970423"`), dẫn đến kết quả `MISMATCH_BIN` dù cùng là TPBank. |

---

## 2. Chi Tiết Các Lệnh Gọi API Thực Tế

### Case 1: Lấy trạng thái xác minh sau khi người dùng đã chuyển khoản 2.000 ₫
* **Method & URL:** `GET https://backend-fae8.onrender.com/api/v1/customers/me/bank-accounts/3/verification-status`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **HTTP Status:** `200 OK`
* **Response Body:**
```json
{
  "success": true,
  "message": "Giao dịch chuyển khoản không khớp với tài khoản đã đăng ký. Khoản tiền sẽ được hoàn trả về tài khoản đã chuyển.",
  "data": {
    "accountId": "3",
    "bankBin": "970423",
    "bankCode": "TPB",
    "bankName": "Ngân hàng TMCP Tiên Phong",
    "accountNumberMasked": "******488",
    "accountName": "LE HO GIA BAO",
    "accountVerificationStatus": "PENDING",
    "session": {
      "sessionReference": "CUST_VRF_970423_QHJF38",
      "sessionStatus": "ACTIVE",
      "verificationStatus": "FAILED_MISMATCH",
      "paymentStatus": "PAID",
      "refundStatus": "PENDING_REFUND",
      "refundSummary": {
        "totalObligationAmount": 2000,
        "totalRefundedAmount": 0,
        "totalPendingRefundAmount": 2000
      },
      "expiresAt": "2026-11-13T16:53:11.378Z",
      "isExpired": true,
      "rejectionReason": "Giao dịch không khớp thông tin tài khoản đăng ký (MISMATCH_BIN)",
      "checkoutUrl": "https://pay.payos.vn/web/28d4922ebd5d47bfabf22af2cff06bcd"
    },
    "message": "Giao dịch chuyển khoản không khớp với tài khoản đã đăng ký. Khoản tiền sẽ được hoàn trả về tài khoản đã chuyển."
  }
}
```

> **Ghi chú đối soát:**
> - `paymentStatus: "PAID"`: Tiền đã vào tài khoản PayOS thành công.
> - `verificationStatus: "FAILED_MISMATCH"`: Phiên bị đánh rớt.
> - `rejectionReason: "Giao dịch không khớp thông tin tài khoản đăng ký (MISMATCH_BIN)"`.

---

### Case 2: Khởi tạo phiên xác minh mới (Bấm "Bắt đầu xác minh")
* **Method & URL:** `POST https://backend-fae8.onrender.com/api/v1/customers/me/bank-accounts/3/initiate-verification`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`, `Content-Type: application/json`
* **HTTP Status:** `201 Created`
* **Response Body:**
```json
{
  "success": true,
  "message": "Khởi tạo phiên xác minh tài khoản 2.000đ thành công. Vui lòng thanh toán trong vòng 15 phút.",
  "data": {
    "accountId": "3",
    "sessionReference": "CUST_VRF_970423_YKVKC7",
    "orderCode": "1794590653827770",
    "checkoutUrl": "https://pay.payos.vn/web/a7276cd430c748069056f1fb3f53a014",
    "amount": 2000,
    "sessionStatus": "ACTIVE",
    "verificationStatus": "PENDING",
    "expiresAt": "2026-11-13T17:39:13.386Z",
    "message": "Khởi tạo phiên xác minh tài khoản 2.000đ thành công. Vui lòng thanh toán trong vòng 15 phút."
  }
}
```

---

### Case 3: Các trường hợp API trả lỗi HTTP Status 400 (Bad Request)

#### A. Khi đặt làm tài khoản mặc định lúc chưa xác minh:
* **Method & URL:** `PATCH https://backend-fae8.onrender.com/api/v1/customers/me/bank-accounts/1/default`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **HTTP Status:** `400 Bad Request`
* **Response Body:**
```json
{
  "success": false,
  "message": "Chỉ tài khoản ngân hàng đã xác minh mới có thể đặt làm mặc định",
  "errorCode": "Bad Request",
  "code": "Bad Request",
  "path": "/api/v1/customers/me/bank-accounts/1/default",
  "timestamp": "2026-11-13T17:24:31.460Z"
}
```

#### B. Khi yêu cầu xóa tài khoản đang có nghĩa vụ hoàn tiền chưa hoàn tất:
* **Method & URL:** `DELETE https://backend-fae8.onrender.com/api/v1/customers/me/bank-accounts/1`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **HTTP Status:** `400 Bad Request`
* **Response Body:**
```json
{
  "success": false,
  "message": "Không thể xóa tài khoản ngân hàng đang có nghĩa vụ hoàn tiền chưa hoàn tất",
  "errorCode": "Bad Request",
  "code": "Bad Request",
  "path": "/api/v1/customers/me/bank-accounts/1",
  "timestamp": "2026-11-13T17:24:40.191Z"
}
```

---

### Case 4: Lấy lịch sử xác minh tài khoản (Verification History)
* **Method & URL:** `GET https://backend-fae8.onrender.com/api/v1/customers/me/bank-accounts/verification-history?page=1&pageSize=10`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **HTTP Status:** `200 OK`
* **Response Body trích xuất các phiên bị lỗi `MISMATCH_BIN`:**
```json
{
  "success": true,
  "message": "Lấy lịch sử xác minh tài khoản thành công",
  "data": [
    {
      "sessionId": "11",
      "sessionReference": "CUST_VRF_970423_QHJF38",
      "orderCode": "1794587891804649",
      "accountId": "3",
      "bankBin": "970423",
      "bankName": "Ngân hàng TMCP Tiên Phong",
      "accountNumberMasked": "******488",
      "accountName": "LE HO GIA BAO",
      "checkoutUrl": "https://pay.payos.vn/web/28d4922ebd5d47bfabf22af2cff06bcd",
      "sessionStatus": "EXPIRED",
      "verificationStatus": "FAILED_MISMATCH",
      "paymentReceived": true,
      "receivedAmount": 2000,
      "refundStatus": "PENDING_REFUND",
      "totalObligationAmount": 2000,
      "totalRefundedAmount": 0,
      "totalPendingRefundAmount": 2000,
      "expiresAt": "2026-11-13T16:53:11.378Z",
      "verifiedAt": null,
      "createdAt": "2026-11-13T16:38:11.696Z"
    },
    {
      "sessionId": "9",
      "sessionReference": "CUST_VRF_970423_QQAZ99",
      "orderCode": "1794586777895950",
      "accountId": "1",
      "bankBin": "970423",
      "bankName": "Ngân hàng TMCP Tiên Phong",
      "accountNumberMasked": "******387",
      "accountName": "LE HO GIA BAO",
      "checkoutUrl": "https://pay.payos.vn/web/f2b09ff4eb7f4b36873999fcbcfa9ee1",
      "sessionStatus": "EXPIRED",
      "verificationStatus": "FAILED_MISMATCH",
      "paymentReceived": true,
      "receivedAmount": 2000,
      "refundStatus": "PENDING_REFUND",
      "totalObligationAmount": 2000,
      "totalRefundedAmount": 0,
      "totalPendingRefundAmount": 2000,
      "expiresAt": "2026-11-13T16:34:37.464Z",
      "verifiedAt": null,
      "createdAt": "2026-11-13T16:19:37.897Z"
    }
  ]
}
```

---

## 3. Vị Trí Code Backend Cần Khắc Phục

### Vị trí 1: Quyết định so sánh mã ngân hàng khách hàng (Customer)
* **File:** `backend/src/customers/customers.repository.ts` (khoảng dòng 1521):
```typescript
const isBinMatched = params.sourceBankBin
  ? params.sourceBankBin === lockedSession.bank_bin
  : true;
```
* **Vấn đề:** `params.sourceBankBin` mang giá trị CITAD (`01358001`) trong khi `lockedSession.bank_bin` mang giá trị NAPAS BIN (`970423`). Phép so sánh `===` luôn trả về `false`.

### Vị trí 2: Đọc mã ngân hàng nguồn PayOS (Customer Service)
* **File:** `backend/src/customers/customer-bank-penny-verification.service.ts` (khoảng dòng 1212):
```typescript
const sourceBankBin = params.counterAccountBankId
  ? String(params.counterAccountBankId).trim()
  : null;
```
* **Cần bổ sung:** Hàm chuẩn hóa (lookup/normalize) chuyển đổi mã CITAD 8 số sang mã BIN 6 số trước khi lưu hoặc so sánh.

### Vị trí 3: Đối chiếu mã ngân hàng cửa hàng (Store Owner)
* **File:** `backend/src/bank-verification/bank-verification.repository.ts` (khoảng dòng 450 - 470):
* **Vấn đề:** Nhánh `SENDER_BANK_MISMATCH` của Store Owner cũng đang so sánh chuỗi trực tiếp giữa `params.senderBankBin` và `lockedAccount.bank_bin`. Cần áp dụng cùng bảng chuẩn hóa CITAD/BIN.

---

## 4. Bảng Tra Cứu (Mapping) Khuyến Nghị

```typescript
// Danh sách ánh xạ mã CITAD (Ngân hàng Nhà nước) sang mã BIN (NAPAS)
export const CITAD_TO_BIN_MAP: Record<string, string> = {
  '01358001': '970423', // TPBank (Ngân hàng TMCP Tiên Phong)
  '01202001': '970436', // Vietcombank
  '01203001': '970415', // VietinBank
  '01204001': '970418', // BIDV
  '01201001': '970405', // Agribank
  '01314001': '970407', // Techcombank
  '01311001': '970422', // MBBank
  '01307001': '970432', // VPBank
  '01317001': '970403', // Sacombank
  '01309001': '970416', // ACB
  // ... bổ sung theo danh mục CITAD chính thức của NHNN
};

export function normalizeToBankBin(code: string | null | undefined): string | null {
  if (!code) return null;
  const clean = String(code).trim();
  return CITAD_TO_BIN_MAP[clean] || clean;
}
```

Sau khi chuẩn hóa, phép đối chiếu sẽ thành:
```typescript
const normalizedSourceBin = normalizeToBankBin(params.sourceBankBin);
const isBinMatched = normalizedSourceBin
  ? normalizedSourceBin === lockedSession.bank_bin
  : true;
```

---

## 5. Kết Luận & Đề Nghị Hỗ Trợ
1. **Frontend:** Hoạt động đúng hợp đồng API, hiển thị chính xác toàn bộ mã lỗi và dữ liệu do Backend trả về.
2. **Backend:** Cần bổ sung bảng chuẩn hóa mã CITAD -> BIN trước khi thực hiện logic so khớp để các giao dịch chính chủ từ TPBank (và các ngân hàng trả mã CITAD qua VietQR/PayOS) được xác thực thành công.
3. **Đối soát:** Sau khi cập nhật code, đề nghị Backend cập nhật lại trạng thái thành `VERIFIED` cho các phiên chính chủ đã ghi nhận đủ 2.000 ₫ của khách hàng.

