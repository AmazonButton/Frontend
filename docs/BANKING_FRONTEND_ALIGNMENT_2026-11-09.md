# Đồng bộ ngân hàng frontend với backend — 09/11/2026

## Phạm vi

Chỉ sửa frontend trong `src/` và `frontend/src/`. Không sửa backend, không deploy, không tạo lệnh rút hoặc giao dịch ngân hàng thật. Các thay đổi đang có khác trong workspace được giữ nguyên.

## Contract đã đọc

Đối chiếu source mới qua kết nối GitHub chỉ đọc:

- [Controller ví](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/store-wallet.controller.ts)
- [DTO rút tiền](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/dto/withdrawal.dto.ts)
- [Service ví](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/store-wallet.service.ts)
- [Mapper response](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/mappers/wallet.mapper.ts)

DTO rút hiện tại không khai báo `bankAccountId` hoặc `note`. Backend chọn tài khoản OWNERSHIP_VERIFIED của cửa hàng, ưu tiên mặc định, sau đó theo updatedAt. Tạo lệnh rút không đồng nghĩa đã chuyển tiền thành công. Header idempotency được backend yêu cầu, TTL của interceptor là 86.400 giây.

## Phần đã hoàn thiện

- Trang Ví đọc tài khoản của owner qua `GET /stores/:storeId/bank-accounts`, cùng nguồn với trang Ngân hàng. Thông tin ngân hàng legacy của ví không còn quyết định tài khoản hiển thị hoặc quyền gửi yêu cầu của owner.
- Thêm, tra cứu, xác minh, chọn mặc định dùng lại trang `/store/finance` và các API sẵn có; không tạo thêm form lưu ngân hàng legacy ở trang Ví.
- Owner dùng tài khoản mặc định đã xác minh hoặc tài khoản đã xác minh duy nhất. Khi có nhiều tài khoản đã xác minh nhưng chưa có mặc định, yêu cầu chọn mặc định trong màn hình Ngân hàng thay vì đoán updatedAt không được API danh sách cung cấp.
- Kiểm tra lại tài khoản và số dư ngay trước khi gửi lệnh mới. Payload POST rút chỉ có `amount`, khóa idempotency nằm trong header. Không gửi số tài khoản đầy đủ, phí tự đặt, ghi chú không được DTO hỗ trợ hoặc accountId không có trong contract.
- Yêu cầu chưa rõ kết quả lưu trong sessionStorage theo user/store: khóa yêu cầu, số tiền, ID tài khoản và thời điểm. Không lưu số tài khoản đầy đủ. Chặn bấm trùng, giữ nguyên số tiền/khóa khi người dùng chủ động kiểm tra lại, khôi phục sau tải lại trang. Lỗi lưu trữ không được phép phát sinh POST mới; yêu cầu quá 24 giờ cần kiểm tra/hỗ trợ thay vì gửi lại tự động.
- Manager giữ quyền xem ví/lịch sử và gửi yêu cầu rút theo controller hiện có, không gọi API quản lý ngân hàng riêng của owner. Tài khoản nhận do backend xác định và được hiển thị từ kết quả/lịch sử.
- Nối `GET /store/wallet/withdrawals/:id`: kiểm tra ID/store, hiển thị snapshot người nhận, phí, số tiền chuyển, trạng thái, mã payout và lý do từ chối/chờ đối soát. Thiếu dữ liệu tài chính hiển thị chưa có dữ liệu, không tự tính bù.
- Giữ các luồng ngân hàng khách hàng, xác minh cửa hàng, lịch sử hoàn tiền, số dư, phân trang và đồng bộ trạng thái đang đúng.

## Kiểm chứng

- `node --experimental-strip-types --test tests/wallet-live-data.test.mjs tests/dashboard-loaders.test.mjs frontend/tests/wallet-partial-load.test.mjs tests/store-finance-flow.test.mjs tests/banking-integration.test.mjs`: **78/78 đạt**.
- `npm.cmd run build` ở root và `frontend/`: **đều đạt**.
- `git diff --check` với các file đã sửa: đạt.
- `git status --short -- backend`: không có thay đổi.

## Giới hạn

Chưa kiểm thử trên trình duyệt với phiên đăng nhập thật hoặc giao dịch thật. Source GitHub không chứng minh Render đang chạy cùng commit hay provider đã được cấu hình đầy đủ.

Backend hiện chưa cho frontend gửi ID tài khoản nhận trong DTO rút; việc chọn người nhận cuối cùng thuộc backend. Frontend kiểm tra trước khi gửi và hiển thị snapshot từ lệnh đã ghi nhận, không tự nhận đã khóa lựa chọn ngân hàng trên server.

Điểm đã phát hiện ở nhánh hoàn tiền xác minh cửa hàng (coi PayOS `code=00` là SUCCESS trước khi kiểm tra trạng thái chi cuối cùng) không được sửa vì ngoài phạm vi frontend. UI vẫn đọc kết quả xác minh/hoàn tiền từ backend, không tự ghi hay suy diễn trạng thái mới.
