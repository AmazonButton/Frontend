# Sửa vòng lặp refresh / WebSocket và lỗi 429 — 07/11/2026

## Bằng chứng và nguyên nhân trong frontend

Log người dùng cung cấp có HTTP 429 ở `/auth/refresh`, `/auth/login`, `/orders` và nhiều WebSocket handshake 429 liên tiếp.

Trong source cũ, Socket.IO tự reconnect, đồng thời mọi `connect_error` lại đặt timer 400 ms để force-refresh JWT rồi disconnect/connect ngay. Việc này xóa thời gian chờ của kết nối. Hai cơ chế refresh độc lập trong API client còn có thể cùng xoay refresh token. Socket cũng tự kết nối khi chưa đăng nhập. Các lần lỗi kết nối vì quá tải vì thế có thể tạo thêm yêu cầu refresh và kết nối, thay vì chờ.

Đây là nguyên nhân gửi lặp đã xác nhận từ source. Log không đủ để kết luận giới hạn 429 của backend đang triển khai thuộc lớp Express, proxy hay hạ tầng Render.

## Thay đổi

| Thành phần | Kết quả |
|---|---|
| `services/api.ts` | Request chủ động, phục hồi 401 và socket dùng chung một refresh đang chạy. Đọc cả phản hồi token trực tiếp và lồng trong `data`. |
| `services/request-backoff.ts` | Đọc `Retry-After` theo giây hoặc ngày HTTP; hỗ trợ `RateLimit-Reset`; chờ 60 giây nếu không có chỉ dẫn. Thời điểm chờ lưu trong trình duyệt, dùng chung giữa các tab và giữ sau F5. |
| HTTP 429 | Không tự gửi lại request, đặc biệt không tự gửi lại mutation tài chính. Những lần gọi trong thời gian chờ bị dừng trước khi đi ra mạng và có thông báo dễ hiểu. |
| Refresh gặp mạng lỗi / 5xx | Giữ thông tin phiên, chờ 15 giây trước lần thử tiếp theo. Chỉ xóa phiên khi refresh bị từ chối rõ ràng bằng 400/401/403, và đúng phiên đó vẫn đang hoạt động. |
| `services/socket.ts` | Một bộ lập lịch sở hữu reconnect; lỗi mạng thông thường không force-refresh. Chờ tăng dần khoảng 5/10/20/40/60 giây, có jitter; tuân thủ thời gian chờ HTTP chung. |
| Đăng xuất / chưa đăng nhập | Không mở handshake thiếu JWT; dừng reconnect khi logout. |
| HMR / bfcache | Dọn interval, timer, listener và kết nối cũ khi module thay thế; dừng khi pagehide, khôi phục có kiểm soát khi pageshow. |
| `AuthContext` + `ProtectedRoute` | Refresh 429 không xóa tài khoản. Nếu chưa lấy được access token mới, hiển thị trạng thái chờ máy chủ và nút thử kết nối lại. Phản hồi cũ không ghi đè phiên mới. |
| Vite | Bỏ theo dõi `**/dist/**` và `**/.cache/**`, tránh build/QA tạo reload từ file sinh ra. |

Thay đổi được đồng bộ giữa `src` và `frontend/src`. Không sửa payload refresh, backend limiter, JWT backend, database hoặc quy tắc chuyển trạng thái đơn hàng.

## Kiểm chứng

- `node --experimental-strip-types --test tests/api-rate-limit-recovery.test.mjs` — 20/20 PASS. Kiểm tra source API/socket thực với transport và đồng hồ giả lập: single-flight, 429, Retry-After, network failure, 401 thật, thay phiên, retry mutation, socket backoff, guest/logout và dọn HMR.
- Kiểm tra hồi quy toàn repo: 127/127 test root + 270/270 test frontend — PASS.
- Production build root và frontend — PASS.
- `git diff --check` — PASS.
- Không tạo lưu lượng thử nghiệm lên endpoint đăng nhập hoặc WebSocket đang bị giới hạn.

## Giới hạn triển khai

Frontend không thể gỡ một cửa sổ giới hạn đã có trên máy chủ. Sau khi nhận bản sửa, tải lại trang một lần để loại bỏ timer của module cũ, chờ thời gian được máy chủ trả về rồi dùng nút **Thử kết nối lại** nếu đang ở màn hình chờ.

Nếu yêu cầu đầu tiên vẫn trả 429 sau khi hết thời gian chờ, cần xem log/rate-limit headers của bản backend đang chạy và cấu hình trusted proxy của hạ tầng. Source backend hiện có global limiter theo IP và auth limiter theo IP/path. Chưa xác minh IP mà bản triển khai thực tế nhận; không vô hiệu hóa limiter để che lỗi.

Lỗi kết nối thật vẫn có thể xuất hiện một lần khi backend đang lỗi hoặc chưa sẵn sàng. Bản sửa giảm và kiểm soát việc thử lại, không ẩn một lỗi hạ tầng còn tồn tại.
