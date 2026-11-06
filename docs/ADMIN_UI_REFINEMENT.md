# Tối ưu giao diện admin — 06/11/2026

## Phạm vi và kết quả

Đã tối ưu cách trình bày của 10 mục trong `/admin/dashboard`, trang `/admin/payouts` và phần tài khoản dùng bởi admin. Security Hub tiếp tục được gỡ như yêu cầu trước đó. Các thay đổi được áp dụng riêng cho admin và đồng bộ vào cả hai cây frontend.

- Tiêu đề và mô tả thay đổi theo mục đang mở, thay cho header chung “Admin Hub / Command Center”.
- Menu dùng tên ngắn, bỏ số thứ tự và thuật ngữ không cần thiết. Trạng thái active phân biệt đúng từng section; mobile menu không còn luôn ghi “Tổng quan” khi đang mở section khác. Đường dẫn và handler điều hướng giữ nguyên.
- Chữ trong bảng, biểu mẫu và thông tin phụ lớn hơn; tăng độ tương phản của chữ xám. Bố cục bớt padding lồng nhau và có focus rõ bằng bàn phím.
- Bảng cuộn ngang trong vùng riêng, có thể focus bằng bàn phím. Địa chỉ dài và tên/mô tả sản phẩm xuống dòng thay vì bị cắt. Không thay đổi bộ lọc hoặc giới hạn danh sách.
- Nút thao tác chính cao tối thiểu 40px; nhóm nút xuống dòng trên màn hình nhỏ. Control trong bảng giữ mật độ gọn hơn. Biểu mẫu chuyển về một cột ở viewport hẹp.
- Nhãn quyền, sự kiện và thông báo thường gặp được diễn đạt bằng tiếng Việt. Các key/value dùng cho API, select và bộ lọc không đổi; mã sự kiện chưa biết vẫn giữ nguyên nội dung.
- Cấu hình kết nối thông báo được đặt trong phần “Cấu hình kết nối nâng cao” có thể mở/đóng bằng HTML `details`. Các control vẫn được mount, giữ binding và truy cập được; không thêm bước gửi hoặc xác nhận.
- Các phần hiện dùng dữ liệu minh họa được ghi chú rõ. Không sửa dữ liệu mẫu, nguồn dữ liệu, công thức KPI hoặc logic fallback hiện có.
- Kho thiết bị hiển thị rõ giới hạn 50 thiết bị hiện tại; chưa thêm phân trang hoặc thay đổi chọn tất cả.

## Tải mã theo nhu cầu

Biểu đồ trong admin được tải khi mở phần báo cáo. Trang Chi trả được tách khỏi module chứa màn hình xác minh khách hàng và ca giao hàng; phần triển khai trạng thái, API và callback được giữ nguyên.

| Trang | JS ban đầu trước, gzip KB | Sau, gzip KB | Chênh lệch |
| --- | ---: | ---: | ---: |
| Tổng quan và các mục không mở biểu đồ | 314,1 | 205,4 | Giảm 108,7 KB, khoảng 34,6% |
| Theo dõi chi trả | 191,6 | 183,0 | Giảm 8,6 KB, khoảng 4,5% |
| Tài khoản admin | 193,6 | 193,7 | Gần như không đổi |

Số đo là tổng gzip JavaScript của entry và các dependency tĩnh trong hai bản build cùng phương pháp, không phải thời gian tải thực tế. Chưa tính CSS, ảnh, font và API. Khi mở Báo cáo, biểu đồ vẫn tải thêm chunk của nó. Không thay đổi request, polling, subscription, cache dữ liệu hay cơ chế xác thực để tạo ra kết quả này.

## File thay đổi trong đợt này

Các file sau được cập nhật ở cả `src/` và `frontend/src/`:

| File | Mục đích |
| --- | --- |
| `pages/admin/AdminDashboard.tsx` | Header theo section, bố cục, nhãn dễ hiểu, accessibility, ghi chú dữ liệu và tải biểu đồ theo nhu cầu. |
| `pages/admin/admin-ui.css` — mới | Style scoped cho admin, responsive và focus; không override animation, transition hoặc transform. |
| `pages/admin/admin-presentation.ts` — mới | Nhãn hiển thị cho section, sự kiện và đối tượng; không đổi mã nghiệp vụ. |
| `pages/admin/AdminPayoutsPage.tsx` — mới | Tách màn hình Chi trả, thống nhất tiêu đề và style. |
| `layouts/Sidebar.tsx` | Nhãn menu, active state theo query, accessibility; giữ URL, callback và motion props. |
| `layouts/Navbar.tsx` | Đổi nhãn hiển thị “Admin Hub” thành “Quản trị”. |
| `pages/profile/ProfilePage.tsx` | Áp dụng style riêng khi tài khoản là admin; không đổi các tab, hook hoặc handler. |
| `pages/operations/OperationsPages.tsx` | Re-export Chi trả để giữ tương thích; các màn hình khác không đổi triển khai. |
| `App.tsx` | Trỏ lazy import Chi trả đến module riêng; giữ nguyên route và guard. |

Đồng bộ hai file đang thiếu `frontend/src/components/common/PageBackButton.tsx` và `CustomerPageMotion.tsx` bằng bản sao nguyên vẹn từ `src/components/common/`. Việc này xử lý lỗi build đã ghi nhận trước đó; không sửa triển khai gốc.

Kiểm thử: thêm `frontend/tests/admin-presentation.test.mjs`, mở rộng `tests/store-page-loading.test.mjs`, cập nhật các assertion về nhãn/lazy import đã cũ trong `frontend/tests/customer-rentals.test.mjs`.

## Kiểm chứng

- PASS — build và TypeScript ở thư mục gốc và `frontend/`.
- PASS — 164/164 test frontend.
- PASS — 26/26 test thư mục gốc, gồm kiểm tra dependency graph production cho admin, chủ cửa hàng và các feature tải theo nhu cầu.
- PASS — render HTML từ component thực cho cả 10 section admin ở hai cây source. Kiểm tra nhãn quyền giữ nguyên value, phần cấu hình nâng cao vẫn chứa control, tiêu đề đúng và không có request trong server render.
- PASS — menu active đúng một mục cho từng section, kể cả query có tham số phụ; kiểm tra các trường hợp menu khách hàng/chủ cửa hàng hiện có.
- PASS — đối chiếu AST: các statement trước `return` của AdminDashboard giữ nguyên, bao gồm state, hooks, handler, API và tính toán. Các binding `onClick`, `onChange`, `onSubmit`, value, disabled, validation, ref và motion props giữ nguyên. Chi trả giữ nguyên state và handler sau khi tách module.
- PASS — CSS parse hợp lệ, selector scoped, không có override animation/transition/transform. Diff không có thay đổi backend, service, hook hoặc context.
- PASS — hai component dùng chung mới đồng bộ giống hệt bản gốc; `git diff --check` không có lỗi khoảng trắng.
- NOT TESTED — lint vì chưa có script cấu hình; kiểm tra trực quan trên trình duyệt/điện thoại, đo FPS và Core Web Vitals, mạng yếu hoặc lỗi tải chunk, thao tác bằng tài khoản thật và giao dịch production.

## Giới hạn còn lại

Các breakpoint đã được thiết kế bằng CSS nhưng chưa được kiểm tra bằng screenshot ở 390/768/1024/1366/1440/1920px. Render HTML và source audit không chứng minh giao diện không có lỗi trên mọi thiết bị hoặc animation đạt một FPS cụ thể.

Các dữ liệu minh họa, KPI cố định, giới hạn 50 thiết bị và hành vi nghiệp vụ được ghi nhận trước đó vẫn giữ nguyên. Đợt này làm rõ cách hiển thị, không sửa các vấn đề dữ liệu hoặc phân trang đó. Chưa deploy bản cập nhật.
