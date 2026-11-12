# Đồng bộ API ngân hàng vào frontend — 10/11/2026

## Phạm vi và nguồn đối chiếu

Chỉ thay đổi frontend trong `src/` và `frontend/src/`, kiểm thử và tài liệu. Không thay đổi backend, database, cấu hình triển khai hoặc tạo giao dịch tiền thật.

Đối chiếu Swagger công khai tại <https://backend-fae8.onrender.com/docs-json> và source chỉ đọc:

- [CustomersController](https://github.com/AmazonButton/Backend/blob/main/src/customers/customers.controller.ts)
- [CustomersService](https://github.com/AmazonButton/Backend/blob/main/src/customers/customers.service.ts)
- [CustomersRepository](https://github.com/AmazonButton/Backend/blob/main/src/customers/customers.repository.ts)
- [CustomerBankPennyVerificationService](https://github.com/AmazonButton/Backend/blob/main/src/customers/customer-bank-penny-verification.service.ts)
- [BankVerificationService](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/bank-verification.service.ts)

Các nhận xét thiếu API đặt mặc định/xóa hoặc thiếu thông tin người nhận trong bản rà soát ngày 08/11 là bằng chứng lịch sử. API/source đọc ngày 10/11 đã bổ sung các phần dưới đây.

## Tích hợp đã thực hiện

### Khách hàng

- Thêm `PATCH /api/v1/customers/me/bank-accounts/:id/default`, body `{}`. Chỉ hiển thị nút cho tài khoản `VERIFIED` chưa là mặc định; yêu cầu xác nhận, kiểm tra response khớp ID/trạng thái và tải lại danh sách từ server.
- Thêm `DELETE /api/v1/customers/me/bank-accounts/:id`, không gửi body. Bước xác nhận nêu rõ backend có thể chặn khi còn phiên xác minh, nghĩa vụ hoàn tiền hoặc lịch sử tài chính cần giữ. Không tự giả lập xóa và không tự chọn tài khoản mặc định thay thế.
- Khóa thao tác khi request đang chạy; lỗi timeout/5xx không tự gửi lại PATCH/DELETE, không báo thành công và tải lại danh sách để kiểm tra. Lỗi 400/403 được hiển thị theo response thật.
- Khi danh sách server không còn tài khoản đang chọn, xóa phần chi tiết/link thanh toán tương ứng và dừng polling tài khoản đó.
- Lịch sử hiển thị `accountId`, tên ngân hàng, số tài khoản đã che và tên chủ tài khoản nếu backend cung cấp. Mở tài khoản từ lịch sử chỉ gọi GET trạng thái hiện tại; không dùng link cũ trong lịch sử để tự tạo/thực hiện thanh toán.
- Khôi phục `session.checkoutUrl` từ API trạng thái. Chỉ mở link HTTPS thuộc PayOS, phiên `ACTIVE`, kết quả xác minh `PENDING`, chưa hết hạn, thanh toán `PENDING` và tài khoản chưa `VERIFIED`. Không tự POST initiate khi tải lại trang.
- Nếu status không trả số tiền thì không tự gán số tiền để hiển thị; số tiền từ kết quả initiate chỉ dùng khi khớp tài khoản và mã phiên.

### Cửa hàng

- Giữ ngân hàng nhận, số tài khoản nhận, tên người nhận, QR và hướng dẫn khi khôi phục phiên `PENDING` từ danh sách/chi tiết.
- Cập nhật được phiên cùng ID đã lưu từ phiên bản frontend cũ còn thiếu hướng dẫn, bằng dữ liệu GET hiện tại; không thay bằng phiên khác ngoài thao tác mở lại rõ ràng.
- Giữ nguyên `expectedAmount`/`actualAmount` server trả, không tự điền số tiền thực nhận hoặc kết quả hoàn tiền.
- Hiển thị `failureReason` trong chi tiết lịch sử nếu backend cung cấp.
- Giữ nguyên quyền owner/manager, xác minh cửa hàng, chọn mặc định, hủy phiên, ví, idempotency rút tiền và giao dịch gói dịch vụ. Không gọi endpoint ngân hàng legacy để giả lập đồng bộ.

## Kiểm chứng

```powershell
node --experimental-strip-types --test tests/banking-integration.test.mjs tests/store-finance-flow.test.mjs frontend/tests/store-finance-flow.test.mjs tests/wallet-live-data.test.mjs tests/dashboard-loaders.test.mjs frontend/tests/wallet-partial-load.test.mjs
```

122/122 kiểm thử đạt. Bao gồm API đúng method/body/ID, xác nhận trước thao tác, điều kiện đặt mặc định, backend từ chối xóa, timeout/bấm lặp, khôi phục link và QR, trạng thái hết hạn/đã thanh toán, cùng hồi quy ví và idempotency.

Build TypeScript + Vite tại root và `frontend/` đều đạt. Các kiểm thử sử dụng transport/provider giả lập; không chứng minh provider thật hoặc cấu hình trên Render đã sẵn sàng.

## Kiểm tra bằng tay

1. Đăng nhập CUSTOMER, mở **Tài khoản → Ngân hàng & hoàn tiền**. Trang chỉ đọc danh sách/lịch sử, không tự tạo phiên thanh toán.
2. Với tài khoản đã `VERIFIED` và chưa mặc định: chọn **Đặt mặc định** → **Giữ nguyên**, kiểm tra không gửi PATCH. Mở lại và xác nhận: chỉ một PATCH, sau đó GET danh sách; đánh dấu mặc định theo kết quả server. Tài khoản chưa xác minh không có nút này.
3. Với tài khoản kiểm thử được phép xóa: chọn **Xóa tài khoản** → kiểm tra đúng ngân hàng/số đã che → xác nhận. Khi backend chấp nhận, dòng tài khoản và chi tiết đã chọn được cập nhật. Không dùng tài khoản thật đang phục vụ nhận tiền để thử xóa.
4. Với tài khoản bị backend chặn xóa: lỗi phải hiển thị nguyên lý do, tài khoản vẫn nằm trong danh sách, không có thông báo xóa thành công.
5. Mở một dòng lịch sử có tài khoản còn tồn tại, chọn **Xem tài khoản của phiên**. GET trạng thái quyết định link thanh toán còn hợp lệ; không gửi POST initiate chỉ vì mở lịch sử.
6. Nếu có phiên xác minh còn hạn và link PayOS đã lưu: tải lại trang, mở tài khoản, kiểm tra link được khôi phục từ GET. Đã nhận tiền, đang đối soát, đã xác minh, hết hạn hoặc URL không hợp lệ thì không hiện link thanh toán.
7. Đăng nhập STORE_OWNER, mở **Gói & ngân hàng → Tài khoản ngân hàng**. Phiên chờ được mở lại với đúng người nhận/QR từ server, không tạo yêu cầu mới; kiểm tra riêng trạng thái xác minh và hoàn tiền.
8. Kiểm tra **Ví & rút tiền** vẫn dùng tài khoản đã xác minh mặc định từ registry; không gửi lệnh rút thật chỉ để kiểm tra thay đổi giao diện.

## Giới hạn triển khai

Backend vẫn có thể trả 503 vì thiếu khóa VietQR hoặc cờ thu tiền xác minh khách hàng chưa bật. Thay đổi frontend này không sửa được cấu hình provider. Giữ nguyên lỗi thật và chỉ công nhận xác minh/hoàn tiền theo trạng thái backend; quay lại từ PayOS không phải bằng chứng giao dịch thành công.
