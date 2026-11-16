# Phục hồi lỗi tải JavaScript sau triển khai

## Hiện tượng và bằng chứng

Ảnh người dùng tại `/store/dashboard` hiển thị `Failed to fetch dynamically imported module` cho một file `StoreDashboard-<hash>.js`. Đây là lỗi tải module frontend; ảnh không đủ để xác định chính xác là 404, lỗi mạng hay cache.

Kiểm tra HTTP công khai ngày 2026-11-16:

- `/store/dashboard`: 200 HTML, `Cache-Control: public, max-age=0, must-revalidate`.
- `/`: 200 HTML, `Cache-Control: no-cache, no-store, must-revalidate`.
- `/sw.js`: 200 JavaScript, vẫn chứa `smart-order-cache-v2` và chính sách cache-first.
- Cả hai trang HTML tham chiếu cùng entry `/assets/index-Cd7OO5UI.js` tại thời điểm kiểm tra.

Vite giải thích rằng người dùng giữ tab phiên bản cũ có thể gọi chunk đã bị thay thế sau triển khai: https://vite.dev/guide/build#load-error-handling. Đây là nguyên nhân phù hợp với hiện tượng, chưa xác nhận được HTTP response của chính chunk trong ảnh.

## Thay đổi

- Bắt lỗi tải module/CSS của Vite và React; kiểm tra document hiện tại bằng GET `no-store` có timeout trước khi tải lại cùng URL.
- Dùng chung một lần phục hồi cho sự kiện Vite và error boundary. Ghi dấu trong sessionStorage, giới hạn tự tải lại một lần trong 60 giây; nếu vẫn lỗi thì dừng và cho thử thủ công.
- Không tự tải lại cho lỗi nghiệp vụ/render thông thường, offline, document lỗi/không phải HTML ứng dụng, hoặc khi không ghi được dấu chống vòng lặp.
- Màn hình dự phòng dùng thông báo tiếng Việt thay vì hiện nguyên lỗi kỹ thuật, có nút tải lại và về trang chủ.
- Áp dụng no-store cho HTML ở đường dẫn sâu; giữ cache immutable cho tài nguyên có hash và giữ nguyên API rewrite.
- Thay worker `/sw.js` cũ bằng worker tự gỡ, không chặn fetch; chỉ xóa cache `smart-order-cache-*`. Inline cleanup chỉ gỡ worker `/sw.js`, giữ worker thông báo Firebase và cache khác.
- Đồng bộ hai cây frontend. Không sửa backend, token, role hoặc yêu cầu thanh toán.

## Kiểm tra và giới hạn

- 33 bài kiểm tra phục hồi module và luồng thông báo đạt; TypeScript và build production đạt trước bước hoàn thiện cleanup worker.
- Cần triển khai các file nguồn, `index.html`, `public/sw.js` và `vercel.json` cùng bản build mới. Tab chạy mã cũ chưa có cơ chế phục hồi có thể vẫn cần tải lại một lần để nhận bản sửa.
- Không thể bảo đảm mọi lỗi mạng/CDN đều biến mất. Bản sửa xử lý lệch phiên bản/cache và cung cấp phục hồi có giới hạn; chưa triển khai lên website trong tác vụ này.
