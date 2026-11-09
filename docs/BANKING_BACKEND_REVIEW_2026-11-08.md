# Các điểm ngân hàng cần backend xác nhận — 08/11/2026

Không sửa backend. Phân biệt rõ bên dưới: kết quả HTTP công khai, kết quả đọc source mới từ GitHub và điều kiện triển khai chưa được kiểm tra bằng tài khoản thật. Sự hiện diện trong Swagger không tự chứng minh giao dịch ngân hàng đã chạy thành công.

Nguồn: [Swagger đang triển khai](https://backend-fae8.onrender.com/docs), [BankVerificationService](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/bank-verification.service.ts), [BankVerificationRepository](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/bank-verification.repository.ts), [CustomerBankPennyVerificationService](https://github.com/AmazonButton/Backend/blob/main/src/customers/customer-bank-penny-verification.service.ts), [CustomersController](https://github.com/AmazonButton/Backend/blob/main/src/customers/customers.controller.ts).

## 1. Khôi phục phiên cửa hàng chưa có thông tin người nhận

Source mới của `createVerificationRequest()` đã trả `recipientBankBin`, `recipientBankName`, `recipientAccountNumber`, `recipientAccountHolder`, `qrCodeUrl`. UI đã nối các trường này.

Tuy nhiên, `formatVerificationTransaction()` dùng cho danh sách và chi tiết chưa trả chúng. Khi tải lại trên thiết bị khác, frontend khôi phục được mã phiên, số tiền, thời hạn và trạng thái, nhưng chưa khôi phục đủ hướng dẫn chuyển tiền. Frontend hiện yêu cầu liên hệ hỗ trợ trong trường hợp thiếu, không ghép tài khoản nhận tiền bằng thông tin tự đoán và không tạo lại phiên bằng POST ngầm.

Đề nghị: API chi tiết trả hướng dẫn người nhận/QR gắn với đúng phiên, từ cấu hình hoặc snapshot đáng tin cậy. Nếu hướng dẫn thay đổi theo thời gian, quy định rõ hiệu lực của mã/QR cũ.

## 2. Nghi vấn tên trường số tiền thực nhận cửa hàng

Trong source mới, repository cập nhật cột `received_amount`, trong khi formatter đọc `tx.actualAmount` để trả `actualAmount`. Cần backend kiểm tra mapping Prisma và dữ liệu response với giao dịch đã nhận tiền. Đây là nghi vấn từ source, chưa tái hiện HTTP trên giao dịch thật.

Đề nghị: trả đúng số tiền thực nhận, giữ `null` khi chưa nhận. UI hiển thị `—` khi thiếu, không tự bù 2.000đ và không dùng `expectedAmount` thay thế.

## 3. Ngân hàng mặc định và nguồn tiền rút

Source `setDefaultBankAccount()` cập nhật `StoreBankAccount.isDefault`; riêng thao tác này chưa cho thấy đồng bộ trường ngân hàng legacy của ví. Yêu cầu từ bàn giao cũ vẫn cần backend xác nhận toàn luồng.

Đề nghị: kiểm chứng tài khoản mặc định đã xác minh trong registry là tài khoản thực sự nhận rút tiền; nếu ví dùng mô hình khác, quy định nguồn chuẩn và trả thông tin nhất quán. Frontend không gọi PUT ngân hàng legacy để giả lập đồng bộ sau khi chọn mặc định.

## 4. Quyền owner đã có thay đổi trong source, cần xác nhận trên Render

Source GitHub mới đã xét chủ sở hữu chính, staff owner ACTIVE/chưa rời cửa hàng và nhóm admin. Đây là thay đổi so với source workspace trước đây. Chưa xác nhận HTTP bằng tài khoản STORE_OWNER từng bị 403, vì chưa có phiên đăng nhập phục vụ kiểm thử trong công cụ.

Đề nghị kiểm tra lại tài khoản đã báo lỗi: danh sách, tạo xác minh, đặt mặc định, xóa và hủy; đồng thời kiểm tra người dùng cửa hàng khác vẫn bị chặn. Frontend giữ nguyên xử lý 401/403.

## 5. Cấu hình nhận tiền, PayOS và đường dẫn quay lại

- `createVerificationRequest()` có fallback cứng cho ngân hàng/số tài khoản/tên người nhận khi thiếu một số biến môi trường. Cần xác nhận cấu hình thực trên Render là tài khoản doanh nghiệp đúng, tránh hướng dẫn chuyển tiền vào giá trị mẫu. Frontend chỉ hiển thị dữ liệu server trả.
- Luồng khách hàng phụ thuộc `CUSTOMER_BANK_VERIFICATION_PAYMENT_ENABLED`, khóa PayOS và `FEATURE_CUSTOMER_REFUND_PAYOUT_ENABLED` cùng worker đối soát/hoàn tiền. Nếu API trả 503/chưa cấu hình, frontend hiển thị lỗi thật; không giả checkout hoặc hoàn thành.
- Source khách hàng mặc định `PAYOS_RETURN_URL`/`PAYOS_CANCEL_URL` về `https://smart-order.vn/verification/success` và `/verification/cancel`. Cần cấu hình đúng origin frontend đang triển khai, tốt nhất về `/customer/banking` hoặc một route trung gian đã được sản phẩm hỗ trợ. Frontend không coi query trả về là bằng chứng thành công.

## 6. Những API chưa có nên UI không dựng thao tác giả

- Chưa thấy API khách hàng xóa/sửa tài khoản hoặc đổi mặc định cho tài khoản đã lưu. Hiện chỉ có lựa chọn `isDefault` lúc đăng ký. Nếu cần quản lý sau đó, bổ sung contract và ràng buộc với hoàn tiền đang xử lý.
- Lịch sử xác minh khách hàng chưa trả `accountId`/thông tin tài khoản; UI có thể xem từng phiên và tiền hoàn, nhưng không gắn chắc chắn một dòng lịch sử với một tài khoản cụ thể. Đề nghị bổ sung ID và thông tin che số nếu cần lọc theo tài khoản.
- API trạng thái khách hàng chưa trả checkout URL cũ; UI dùng POST initiate theo thao tác người dùng để lấy lại phiên còn hạn (source mới có cơ chế tái sử dụng). Không tự POST khi tải trang.
- Hủy xác minh cửa hàng hiện cập nhật trạng thái `EXPIRED`. UI dùng đúng enum này; chưa thể phân biệt hết hạn tự nhiên với chủ cửa hàng hủy. Có thể bổ sung `cancelledAt`/lý do nếu cần lịch sử chính xác hơn.

## 7. Hợp đồng Swagger cần đầy đủ hơn

Schema response của các endpoint ngân hàng hiện chưa khai báo đầy đủ; DTO request cửa hàng xuất hiện với `properties: {}`. Query lịch sử đánh dấu các tham số là required dù source controller có giá trị mặc định. Frontend đã đối chiếu source chỉ đọc để nối đúng dữ liệu.

Đề nghị bổ sung response DTO, enum xác minh/hoàn tiền và optional query để hai bên tích hợp theo tài liệu triển khai, không phải dựa vào source chưa bảo đảm cùng commit với deployment.

## Checklist nghiệm thu phối hợp

1. Owner từng bị 403 đọc/quản lý đúng cửa hàng; role khác không vượt quyền.
2. Khách hàng thêm tài khoản → tạo checkout thật → webhook → VERIFIED; trạng thái hoàn tiền cập nhật độc lập đến REFUNDED.
3. Tiền sai số tiền, sai tài khoản nguồn, thiếu bằng chứng, đến trễ và đang đối soát không bị hiển thị thành công giả.
4. Khôi phục phiên cửa hàng sau đăng xuất/thiết bị khác có hướng dẫn đúng và số tiền thực nhận đúng.
5. Kiểm tra cấu hình đường dẫn quay lại và tài khoản nhận tiền trên deployment; xác nhận worker hoàn tiền đang hoạt động.

## Bổ sung: lỗi 400 khi tra cứu ngân hàng cửa hàng

Người dùng báo `POST /api/v1/stores/bank-accounts/lookup` trả 400. Đây là bước tra cứu tên chủ tài khoản, xảy ra trước POST tạo yêu cầu xác minh.

### Đã nhận response thực tế từ người dùng

```json
{
  "success": false,
  "message": "Không thể xác minh tài khoản ngân hàng lúc này",
  "errorCode": "BANK_LOOKUP_UNAVAILABLE",
  "code": "BANK_LOOKUP_UNAVAILABLE",
  "path": "/api/v1/stores/bank-accounts/lookup",
  "timestamp": "2026-11-08T04:12:20.770Z"
}
```

Thời điểm đối chiếu log: **08/11/2026 04:12:20.770 UTC**, tương ứng **11:12:20.770 giờ Việt Nam**. Đây là response người dùng cung cấp, không phải request do frontend tự tái hiện.

Đối chiếu với source backend đã đọc: mã này được tạo trong catch quanh `provider.lookupAccount()`; kiểm tra BIN trong danh mục và định dạng số tài khoản nằm trước catch. Vì vậy đã xác định được nhánh lỗi tra cứu provider, không phải kết luận tài khoản thực tế hợp lệ hay sai. Vẫn cần log/config phía backend để xác định nguyên nhân gốc; body response hiện đã che các nguyên nhân này thành một mã chung.

Đã đối chiếu frontend với DTO backend mới: frontend chỉ gửi `bankBin` (chuỗi 6 chữ số) và `accountNumber` (chuỗi 5–30 chữ/số, đã trim); không gửi thừa `storeId`, tên chủ tài khoản hoặc số tiền. Frontend không tự bỏ bước tra cứu khi thất bại.

Source `PayOSBankVerificationProvider.lookupAccount()` thực tế gọi `https://api.vietqr.io/v2/lookup`, dùng `VIETQR_CLIENT_ID`/`VIETQR_API_KEY`, fallback sang biến `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`. Cần xác nhận bộ khóa trên Render có quyền tra cứu VietQR thực sự; không suy ra khóa PayOS dùng được cho VietQR chỉ vì biến có giá trị.

`BankVerificationService.lookupBankAccount()` bắt tất cả lỗi provider rồi trả cùng HTTP 400, `errorCode = BANK_LOOKUP_UNAVAILABLE`. Do đó thiếu cấu hình (provider ban đầu ném 503), upstream 401/403/5xx, timeout và không tìm thấy tài khoản đều có thể bị trả thành cùng lỗi. Không thể phân biệt các nguyên nhân này bằng HTTP 400 hoặc stack trace frontend.

Đề nghị backend kiểm tra log khớp thời điểm request, cấu hình và quyền lookup tại provider; tách lỗi dữ liệu không hợp lệ khỏi dịch vụ/provider không sẵn sàng bằng code và HTTP status phù hợp. Không gửi khóa hoặc số tài khoản đầy đủ vào log chia sẻ hay file bàn giao.

Frontend đã bổ sung thông báo riêng cho `BANK_LOOKUP_UNAVAILABLE`, giữ nguyên thông báo validation/403 và không gửi lại lookup tự động. Response thực tế ở trên đã xác định được nhánh lỗi; cần phía backend tra log provider ở thời điểm tương ứng. Không sửa backend.

Đã kiểm tra [tài liệu VietQR chính thức](https://www.vietqr.io/tra-cuu-stk): dịch vụ yêu cầu `x-client-id` và `x-api-key` lấy từ My VietQR; có các mã upstream riêng như `41` (ngân hàng không hỗ trợ), `42` (tài khoản không hợp lệ), `45` (provider bận), `22` (BIN không hợp lệ). Backend hiện chưa giữ các phân loại này trong response frontend. Tài liệu cũng có thông báo đang chuyển dịch sang bộ API Pay Out của CAS; cần xác nhận quyền truy cập lookup của merchant, không suy ra việc chuyển dịch là nguyên nhân của lỗi người dùng.

Tài liệu upstream khai báo `bin` là integer trong khi provider hiện gửi chuỗi `bankBin`; cần backend kiểm chứng contract/thực tế provider chấp nhận. Frontend vẫn giữ chuỗi `bankBin` vì DTO backend yêu cầu chuỗi, không tự đổi kiểu để né validation.

Kiểm tra phần bổ sung frontend: 57/57 test ngân hàng đạt; TypeScript ở root và `frontend/` đều đạt. Không có thay đổi trong `backend/`.
