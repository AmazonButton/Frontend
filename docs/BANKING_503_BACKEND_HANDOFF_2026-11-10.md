# Bàn giao backend: hai lỗi 503 trong luồng ngân hàng

Ngày lập: 10/11/2026, múi giờ Việt Nam (UTC+7).

## 1. Mục tiêu và phạm vi

Đề nghị đội backend kiểm tra và khôi phục hai chức năng:

1. Khách hàng bắt đầu xác minh tài khoản ngân hàng qua PayOS.
2. Chủ cửa hàng tra cứu tên chủ tài khoản qua VietQR.

Frontend đã tích hợp các API dưới đây. Tài liệu này không kèm thay đổi mã backend, database hoặc cấu hình triển khai. Không bỏ kiểm tra quyền, không giả tên chủ tài khoản, không tự đánh dấu xác minh hoặc hoàn tiền thành công để né lỗi.

## 2. Môi trường và nguồn bằng chứng

- Frontend người dùng đang mở: `http://localhost:5173`.
- Đích proxy mặc định trong hai cấu hình Vite: `https://backend-fae8.onrender.com`; biến `VITE_BACKEND_URL` có thể ghi đè. Cần xác nhận đích thực tế của phiên đang chạy khi đối chiếu log.
- URL `/api/v1/...` trên localhost là URL trình duyệt gọi qua proxy; không có nghĩa backend chạy ở cổng 5173.
- Bằng chứng HTTP trong tài liệu do người dùng cung cấp, không phải giao dịch thật do công cụ kiểm thử tạo ra.
- Source backend đã đọc trên GitHub có thể khác commit đang triển khai trên Render. Đội backend cần đối chiếu commit triển khai trước khi sửa.

## 3. Lỗi A — Khách hàng không bắt đầu được phiên xác minh

### Request và hiện tượng

```http
POST /api/v1/customers/me/bank-accounts/1/initiate-verification
Content-Type: application/json
Authorization: Bearer <token khách hàng>

{}
```

- HTTP thực tế người dùng báo: **503 Service Unavailable**.
- `1` là ID tài khoản trong log người dùng; khi tái hiện phải dùng ID tài khoản thuộc đúng khách hàng đăng nhập.
- Vị trí frontend: `src/services/banking-flow.ts`, phương thức `initiateCustomerVerification()`, được gọi từ `CustomerBankingPage.tsx` khi bấm **Bắt đầu xác minh**.
- Giao diện đang có tài khoản chờ xác minh; ảnh người dùng cung cấp hiển thị chưa có phiên trong lịch sử. Chưa có Response body của request lỗi này, nên chưa xác định được nhánh 503 cụ thể.

### Cách tái hiện

1. Đăng nhập bằng tài khoản CUSTOMER.
2. Mở **Tài khoản → Ngân hàng & hoàn tiền** (`/customer/banking`).
3. Thêm hoặc chọn tài khoản chưa xác minh thuộc khách hàng đó.
4. Bấm **Bắt đầu xác minh**.
5. Kiểm tra request trên và đối chiếu Response cùng log backend.

### Các điểm cần kiểm tra phía backend

Source `CustomerBankPennyVerificationService.initiateVerificationSession()` đã đọc có ít nhất hai chốt trả 503 trước khi tạo liên kết thanh toán:

| Điều kiện | Thông báo theo source đã đọc |
|---|---|
| `CUSTOMER_BANK_VERIFICATION_PAYMENT_ENABLED` không bằng chuỗi `true` | Tính năng thu tiền xác minh đang tạm tắt/chờ cấu hình đối tác |
| Thiếu một trong `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | Chưa cấu hình khóa kết nối PayOS trong hệ thống |

Đây là các nhánh cần đối chiếu, **chưa phải kết luận nguyên nhân của request người dùng**. Cần thu thập Response body và log tương ứng; không suy ra từ riêng HTTP 503.

Đề nghị:

- Xác nhận chức năng có chủ đích được bật trên môi trường này hay không. Chỉ bật khi kết nối thu tiền thật đã được cấu hình đúng.
- Kiểm tra bộ khóa PayOS, quyền merchant, đường dẫn return/cancel và kết nối tới provider.
- Nếu cấu hình đầy đủ mà vẫn lỗi, đối chiếu lỗi thực tế tại bước tạo/phục hồi phiên và gọi provider; không chỉ đổi status code hoặc thông báo.
- Giữ cơ chế tái sử dụng phiên còn hạn và tránh tạo nhiều payment link cho cùng yêu cầu khi timeout/thử lại.

### Kết quả mong đợi và nghiệm thu

- Với tài khoản hợp lệ, chức năng đã bật và provider sẵn sàng, API trả phiên gắn đúng `accountId`.
- Response thành công phù hợp contract frontend: envelope `success: true`, `data` có `accountId`, `verificationStatus`; nếu chưa VERIFIED thì có `sessionReference`, `checkoutUrl` PayOS hợp lệ, `amount: 2000`, `expiresAt` hợp lệ và trạng thái phiên phù hợp.
- Theo source đã đọc, phiên mới có thời hạn 15 phút. Đề nghị xác nhận contract đang triển khai.
- Nếu tài khoản đã VERIFIED, giữ nhánh trả trạng thái đã xác minh, không tạo thêm khoản thu.
- Không xác minh chỉ vì người dùng quay lại từ trang PayOS. Chỉ cập nhật dựa trên bằng chứng giao dịch được backend xác thực.
- Kiểm tra bước nhận webhook, đối chiếu tài khoản nguồn và tiến trình hoàn tiền riêng biệt. Việc tạo link thành công chưa chứng minh đã thanh toán/xác minh/hoàn tiền thành công.

## 4. Lỗi B — Chủ cửa hàng không tra cứu được tên chủ tài khoản

### Request và hiện tượng

```http
POST /api/v1/stores/bank-accounts/lookup
Content-Type: application/json
Authorization: Bearer <token người dùng có quyền>

{
  "bankBin": "<BIN ngân hàng đã chọn>",
  "accountNumber": "<số tài khoản dùng để kiểm thử>"
}
```

Các giá trị trong dấu `<...>` là chỗ điền dữ liệu, không phải payload để gửi nguyên văn.

- HTTP người dùng báo: **503 Service Unavailable**.
- Frontend chỉ gửi `bankBin` và `accountNumber`, không gửi tên tự nhập hoặc `storeId` vào endpoint lookup.
- Vị trí frontend: `src/services/store-finance-flow.ts`, phương thức `lookup()`, được gọi từ `StoreFinancePage.tsx`.
- Frontend hiện tự tra cứu sau 700 ms ngừng nhập, đồng thời giữ nút tra cứu thủ công. Không tự thử lại khi lỗi và không tự tạo yêu cầu xác minh.

### Response người dùng đã cung cấp

Đoạn người dùng dán thiếu dấu mở `{`; dưới đây chỉ bổ sung dấu mở để trình bày JSON hợp lệ, giữ nguyên các trường đã cung cấp:

```json
{
  "success": false,
  "message": "Dịch vụ tra cứu tài khoản ngân hàng tạm thời không khả dụng (xác thực dịch vụ thất bại)",
  "errorCode": "BANK_LOOKUP_SERVICE_UNAVAILABLE",
  "code": "BANK_LOOKUP_SERVICE_UNAVAILABLE",
  "path": "/api/v1/stores/bank-accounts/lookup",
  "timestamp": "2026-11-09T16:45:51.390Z"
}
```

Mốc đối chiếu log:

- UTC: **09/11/2026 16:45:51.390**.
- Việt Nam: **09/11/2026 23:45:51.390**.

### Nhánh lỗi đã xác định từ Response và source

Trong `PayOSBankVerificationProvider.lookupAccount()`, backend gọi:

```text
POST https://api.vietqr.io/v2/lookup
Headers: x-client-id, x-api-key
Body: bin, accountNumber
```

Theo source đã đọc, khi upstream trả **401 hoặc 403**, backend chuyển thành HTTP 503 với đúng thông báo **“xác thực dịch vụ thất bại”** ở trên.

Do đó đã xác định được nhánh **provider từ chối xác thực** của lần báo lỗi có Response này. Chưa biết upstream là 401 hay 403, và chưa đủ bằng chứng kết luận khóa sai, hết hiệu lực hay thiếu quyền. Lỗi này cũng không chứng minh số tài khoản người dùng nhập sai.

### Các điểm cần xử lý phía backend/vận hành

1. Đối chiếu log upstream tại mốc thời gian trên: HTTP status, mã lỗi provider và deployment đang phục vụ.
2. Kiểm tra `VIETQR_CLIENT_ID` và `VIETQR_API_KEY` đúng bộ, còn hiệu lực, không có khoảng trắng ngoài ý muốn và được cấp quyền dùng API lookup.
3. Source có fallback từ khóa VietQR sang `PAYOS_CLIENT_ID` / `PAYOS_API_KEY`. Không mặc định khóa PayOS dùng được cho VietQR; xác nhận bộ khóa thực sự được sử dụng khi gọi lookup.
4. Nếu nhà cung cấp yêu cầu kích hoạt/gia hạn dịch vụ hoặc chuyển sang sản phẩm API khác, xác nhận contract và quyền merchant với provider trước khi đổi tích hợp.
5. Sau khi sửa cấu hình, khởi động lại/triển khai lại dịch vụ theo quy trình vận hành, rồi thử lại bằng tài khoản kiểm thử được phép sử dụng.

### Kết quả mong đợi và nghiệm thu

- Ngân hàng được hỗ trợ + tài khoản hợp lệ + cấu hình provider hợp lệ: trả `success: true`, `data` có `bankBin`, `bankName`, `accountNumberMasked`, `accountName` đúng từ provider.
- Không trả tên mẫu, không dùng chế độ mock trên production và không tự thay tên khi upstream thất bại.
- Phân biệt tài khoản không tồn tại, ngân hàng chưa hỗ trợ, provider bận và lỗi xác thực dịch vụ bằng mã lỗi phù hợp.
- Đổi ngân hàng hoặc số tài khoản phải tra cứu lại; tên lookup không phải bằng chứng xác minh chính chủ.
- Sau lookup thành công mới tiếp tục kiểm thử riêng API tạo yêu cầu xác minh cửa hàng. Sửa lookup không tự chứng minh webhook/hoàn tiền đã hoạt động.

## 5. Phân biệt hai lỗi để tránh sửa nhầm

| Nội dung | Lỗi A: khách hàng bắt đầu xác minh | Lỗi B: cửa hàng tra cứu tên |
|---|---|---|
| Mục đích | Tạo/phục hồi phiên thanh toán xác minh | Lấy tên chủ tài khoản từ ngân hàng và số tài khoản |
| Provider trong source | PayOS payment requests | VietQR lookup |
| Bằng chứng hiện có | Stack trace + HTTP 503, chưa có Response body | Stack trace + HTTP 503 + Response cụ thể |
| Mức kết luận | Cần log/Response để xác định nhánh lỗi | Đã xác định nhánh upstream từ chối xác thực theo source đã đọc |
| Có thể sửa bằng đổi giao diện không? | Không nếu nguyên nhân là cờ chức năng/cấu hình/provider | Không nếu nguyên nhân là khóa hoặc quyền lookup |

Hai request khác nhau; không kết luận chúng dùng cùng bộ khóa hay cùng nguyên nhân chỉ vì đều trả 503.

## 6. Thông tin đội backend nên phản hồi sau xử lý

- Commit/deployment đã kiểm tra, nguyên nhân thực tế của từng lỗi và phần cấu hình/mã đã xử lý.
- Kết quả HTTP của hai API sau xử lý, kèm response đã che dữ liệu nhạy cảm.
- Kết quả kiểm thử quyền truy cập: tài khoản đúng chủ sở hữu được phép, tài khoản khác bị chặn.
- Với xác minh khách hàng: kết quả tạo phiên, nhận giao dịch, xác minh và hoàn tiền được ghi nhận riêng; không gộp thành một kết luận thành công.
- Nếu còn bị chặn bởi nhà cung cấp, nêu rõ chức năng chưa thể nghiệm thu.

Không đưa token, API key, checksum key, cookie hoặc số tài khoản đầy đủ vào file bàn giao/log chia sẻ. Frontend không yêu cầu các khóa bí mật này.

## 7. Nguồn đối chiếu

- [CustomerBankPennyVerificationService](https://github.com/AmazonButton/Backend/blob/main/src/customers/customer-bank-penny-verification.service.ts)
- [PayOSBankVerificationProvider](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/providers/payos-bank-verification.provider.ts)
- [Tài liệu API tra cứu VietQR](https://www.vietqr.io/tra-cuu-stk)
- [Tích hợp ngân hàng frontend](BANKING_INTEGRATION_2026-11-08.md)
- [Các điểm backend cần xác nhận](BANKING_BACKEND_REVIEW_2026-11-08.md)
- [Đồng bộ ngân hàng frontend](BANKING_FRONTEND_ALIGNMENT_2026-11-09.md)

Tài liệu này chỉ tổng hợp bằng chứng và yêu cầu xử lý; không xác nhận hai lỗi đã được sửa hoặc giao dịch tiền thật đã thành công.
