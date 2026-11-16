# Phục hồi kết nối API ở frontend

## Kiểm tra ngày 2026-11-16

- Kiểm tra trực tiếp backend 3 lượt: `/healthz` trả 200; `/api/v1/orders` và `/api/v1/admin/stores/pending?pageSize=10&page=1` đều trả 401 khi không kèm đăng nhập.
- Kiểm tra tiếp qua Vite dùng cấu hình thật đã sửa, mỗi API 3 lượt: đều trả 401, không gặp reset.
- 401 trong kiểm tra này xác nhận kết nối/proxy thông và server yêu cầu xác thực; không xác nhận nội dung dữ liệu theo tài khoản. Không đọc token hoặc sửa dữ liệu production.
- Chưa tái hiện ngắt kết nối trên backend thật trong các lượt kiểm tra; đã tái hiện reset có kiểm soát qua proxy Vite thật bằng upstream giả trong test.

## Thay đổi chỉ ở frontend

- Vite đọc `VITE_BACKEND_URL` từ file env theo mode, đồng thời giữ ưu tiên biến môi trường của tiến trình.
- Proxy dùng agent không giữ kết nối rảnh để tránh tái sử dụng socket có thể đã bị upstream đóng; thời gian chờ upstream 20 giây.
- Lỗi proxy được trả thành JSON 502 với mã `DEV_PROXY_UPSTREAM_UNAVAILABLE` và thông báo tiếng Việt. Không che log Vite và không tự gửi lại yêu cầu ở tầng proxy.
- Axios chỉ thử lại tối đa một lần sau 750ms với GET `/orders` và `/admin/stores/pending` khi gặp lỗi kết nối hoặc HTTP 502/503/504. Giữ params, kiểm tra phiên đăng nhập và tín hiệu hủy trước khi thử lại; tôn trọng offline và cooldown 429.
- Không bổ sung cơ chế retry kết nối cho POST/PUT/PATCH/DELETE, thanh toán, xác minh ngân hàng hoặc các API khác. Giữ nguyên xử lý xác thực hiện có.
- Đồng bộ hai cây frontend; không chỉnh sửa backend.

## Xác minh

- `node --test tests/api-rate-limit-recovery.test.mjs tests/dev-api-proxy.test.mjs`: 30/30 đạt.
- Test dùng Vite thật chứng minh reset tạo JSON 502, query được giữ, POST không được proxy gửi lại và lần đọc tiếp theo thành công khi upstream hồi phục.
- `npm.cmd run build`: đạt cả TypeScript và build production.

Khởi động lại Vite đang mở để nhận cấu hình proxy mới. Bản sửa chưa triển khai lên Vercel. Mạng hoặc backend vẫn có thể ngắt kết nối; frontend phục hồi có giới hạn, không bảo đảm backend luôn sẵn sàng.
