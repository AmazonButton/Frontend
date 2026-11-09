# Tích hợp ngân hàng — 08/11/2026

## Phạm vi

Đã tích hợp trên cả `src/` và `frontend/src/`. Không sửa bất kỳ file nào trong `backend/`, không triển khai backend, không chạy migration, không tạo giao dịch hoặc chuyển tiền thật.

Đối chiếu các yêu cầu trong `BACKEND_HANDOFF_2026-11-07.md`, Swagger đang chạy tại https://backend-fae8.onrender.com/docs-json và source mới từ repository `AmazonButton/Backend` qua kết nối GitHub chỉ đọc. Source backend trong workspace chưa chứa đủ API mới; không chép đè hoặc cập nhật thư mục này.

## Giao diện và luồng đã nối

### Khách hàng: Tài khoản → Ngân hàng & hoàn tiền

Đường dẫn `/customer/banking`, chỉ nằm trong nhóm route CUSTOMER. Điều hướng Tài khoản nhận đúng trang trên desktop và mobile.

- Danh sách tài khoản nhận hoàn tiền, tài khoản mặc định và số tài khoản đã xác minh.
- Thêm tài khoản: chọn ngân hàng từ API, nhập số tài khoản 6–20 chữ số, tên chủ tài khoản, lựa chọn mặc định và xác nhận thông tin. Tên được chuẩn hóa chữ hoa không dấu theo DTO; tên nhập không được coi là bằng chứng chính chủ.
- Đọc phiên mới nhất từ server khi chọn tài khoản; khôi phục việc theo dõi sau khi tải lại trang hoặc đổi thiết bị.
- Người dùng chủ động bắt đầu/tiếp tục xác minh. Chỉ mở checkout HTTPS thuộc PayOS do server trả về, đúng số tiền 2.000đ và phiên còn hạn. Không tạo checkout giả và không tạo phiên tự động khi mở trang.
- Tách trạng thái tài khoản, kết quả phiên, tiền đã nhận và hoàn tiền. Hiển thị cần hoàn/đã hoàn/còn chờ, lý do từ chối hoặc cần hỗ trợ khi API cung cấp.
- Theo dõi khi trang hiện và phiên/giao dịch còn cần xử lý; tạm dừng khi trang ẩn, API đang cooldown hoặc lần đọc bị lỗi. Có kiểm tra thủ công.
- Lịch sử xác minh và hoàn tiền có phân trang từ server. Lịch sử này là tiền xác minh, không phải tổng tiền hoàn cọc của hợp đồng.
- Không giữ số tài khoản đầy đủ trong browser storage. Không tự đánh dấu VERIFIED/REFUNDED từ kết quả điều hướng PayOS hoặc thao tác của người dùng.

### Cửa hàng: Gói thuê sàn & ngân hàng

- Giữ gói hiện tại, ngày còn lại, cảnh báo và lịch sử đóng tiền đã có.
- Nhận thông tin người thụ hưởng/QR từ kết quả tạo xác minh; hiển thị riêng với tài khoản đang cần xác minh, có sao chép số tài khoản và nội dung.
- QR và hướng dẫn chuyển tiền chỉ dùng khi phiên còn hạn và có đủ thông tin. Nếu API thiếu thông tin nhận tiền, hiển thị thông báo rõ thay vì tự đoán.
- Thêm lịch sử có phân trang, lọc trạng thái, chi tiết phiên, tiền yêu cầu/thực nhận và trạng thái hoàn tiền.
- Đọc lại yêu cầu PENDING từ server, mở lại từng yêu cầu để theo dõi hoặc dùng bước xác nhận hủy hiện có.
- Đọc trạng thái giao dịch từ API chi tiết; không dùng trạng thái xác minh tổng của tài khoản để suy ra một phiên khác đã hoàn tất.
- Chủ cửa hàng quản lý ngân hàng; manager giữ quyền xem gói như trước, không phát sinh yêu cầu ngân hàng dành riêng cho owner.

## API frontend sử dụng thêm

Các đường dẫn dưới đây có tiền tố `/api/v1`.

| API | Giao diện |
|---|---|
| `GET /customers/me/bank-accounts` | Danh sách tài khoản khách hàng |
| `POST /customers/me/bank-accounts` | Đăng ký tài khoản nhận hoàn tiền |
| `POST /customers/me/bank-accounts/:id/initiate-verification` | Bắt đầu/tiếp tục checkout PayOS |
| `GET /customers/me/bank-accounts/:id/verification-status` | Trạng thái và tổng hợp hoàn tiền |
| `GET /customers/me/bank-accounts/verification-history?page=&pageSize=` | Lịch sử khách hàng |
| `GET /stores/:storeId/bank-account-verifications?page=&pageSize=&status=` | Lịch sử và phục hồi yêu cầu cửa hàng |
| `GET /bank-account-verifications/:id` | Chi tiết và polling giao dịch cửa hàng |

Giữ các API ngân hàng cửa hàng đã có: `/banks`, tra cứu tên, tạo yêu cầu, danh sách, đặt mặc định, xóa, hủy yêu cầu.

Webhook là giao tiếp giữa provider và backend; không gọi từ trình duyệt. `POST /customers/me/bank-accounts/:id/verify` là thao tác tiêu thụ bằng chứng đã được server xác nhận trong luồng tương thích cũ; UI mới dùng phiên PayOS và kết quả webhook, không thêm ô nhập mã để tự nhận đã chuyển tiền.

## Địa chỉ backend

Kiểm tra công khai: `/doc` trả 404; `/docs` và `/docs-json` trên Render trả 200, `/api/v1/banks` trả success với 22 ngân hàng. Proxy Cloudflare cũ trả 429 tại thời điểm kiểm tra `/docs-json`.

Đã đổi đích mặc định Vite proxy, Vercel rewrite và API fallback sang `https://backend-fae8.onrender.com`. Cập nhật hai biến API cũ trong `frontend/.env` ở workspace. Giữ query/localStorage override và cơ chế JWT/refresh/cooldown hiện có. Khi triển khai, cần bảo đảm biến môi trường của hosting không còn trỏ về proxy cũ.

## Kiểm tra

- Đã chạy toàn bộ bộ test frontend ở root và `frontend/tests` sau tinh chỉnh cuối: **457/457 đạt**.
- `npm.cmd run build` ở root và `frontend/`: **đều thành công** (TypeScript và Vite).
- `git diff --check`: đạt. `git status --short -- backend`: không có thay đổi.
- Có test DTO, chuỗi ID lớn, giới hạn checkout origin, hết hạn, server pagination, 403, timeout, dừng polling khi lỗi/ẩn/cooldown, phản hồi cũ, dữ liệu khác cửa hàng, tạo tài khoản và hiển thị riêng hoàn tiền.
- Chưa thực hiện thanh toán thật hoặc kiểm thử HTTP với tài khoản đăng nhập trên Render. Chưa xác nhận cấu hình provider/worker/return URL trên deployment.
- Chưa kiểm tra trực quan bằng trình duyệt: công cụ trả `native pipe unavailable` và `browser access host is unavailable`. Đã kiểm tra render HTML của hướng dẫn chuyển tiền trong test.

Những điểm cần backend xem lại nằm ở [BANKING_BACKEND_REVIEW_2026-11-08.md](BANKING_BACKEND_REVIEW_2026-11-08.md).
