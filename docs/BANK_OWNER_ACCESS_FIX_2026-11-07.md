# Đã thu hồi bản sửa quyền ngân hàng — 07/11/2026

**Bản sửa backend mô tả dưới đây đã được hoàn tác theo yêu cầu. Không deploy tài liệu này như một bản sửa đang có.** Mô tả lỗi và yêu cầu gửi cho đội backend nằm tại [bản bàn giao backend](BACKEND_HANDOFF_2026-11-07.md). Nội dung bên dưới chỉ là nhật ký của lần thử trước khi thu hồi.

## Nguyên nhân đã xác nhận

Tài khoản được báo lỗi có quyền `STORE_OWNER` đang ACTIVE trong phân công cửa hàng (`store_staff`) và chưa rời cửa hàng, nhưng không nằm ở trường chủ sở hữu chính `Store.ownerUserId`.

Đăng nhập nhận quyền từ phân công này, nên nhãn **Chủ cửa hàng** là đúng với role đã gán. API ngân hàng chỉ nhận chủ sở hữu chính hoặc ADMIN; vì thế GET danh sách trả 403 và nút thêm tài khoản bị khóa. Đây là lệch cách kiểm tra quyền giữa đăng nhập và nghiệp vụ ngân hàng.

## Bản sửa

- [Repository](../backend/src/bank-verification/bank-verification.repository.ts) đọc quyền OWNER còn hiệu lực trong database cho **đúng user + đúng store**, yêu cầu status ACTIVE, leftAt null và user ACTIVE.
- [Service](../backend/src/bank-verification/bank-verification.service.ts) dùng kiểm tra đó tại chốt quyền chung của danh sách, tạo xác minh, chọn mặc định, xóa và hủy xác minh. Chỉ role STORE_OWNER được dùng nhánh phân công OWNER; nhãn role phía trình duyệt không đủ để cấp quyền.
- Giữ quyền chủ sở hữu chính/ADMIN hiện có; giữ kiểm tra tài khoản thuộc cửa hàng và trạng thái xác minh. Không mở quyền cho manager/staff khác hoặc cửa hàng khác.
- Không sửa dữ liệu chủ sở hữu, không chuyển cửa hàng sang tài khoản khác, không bỏ kiểm tra quyền ở frontend/backend và không đổi API contract.

## Kiểm chứng

- Bộ kiểm thử backend tạm từng đạt 14/14 trước khi thu hồi; file test đó đã được gỡ. Kết quả này không chứng minh bản backend đã hoàn nguyên nhận quyền được phân công.
- `npm.cmd run build` tại backend: **PASS**.
- `node --experimental-strip-types --test tests/store-finance-flow.test.mjs frontend/tests/store-finance-flow.test.mjs`: **26/26 PASS**.
- `git diff --check`: **PASS**.
- Truy vấn chỉ đọc xác nhận điều kiện phân công thực tế; chạy hàm kiểm tra quyền từ backend đã build với database cấu hình sẵn cho kết quả cho phép. Không tạo tài khoản/xác minh, không chuyển tiền hoặc sửa dữ liệu thật.

## Áp dụng lên trang đang sử dụng

Frontend localhost đang proxy tới backend được host bên ngoài. Đội backend cần tự xử lý vấn đề và triển khai bản sửa của mình; bản sửa thử của frontend đã thu hồi. Ctrl+F5 chỉ tải lại frontend, không thay đổi quyền trên Render.

Chưa kiểm chứng HTTP trên bản Render sau deploy hoặc các bước xác minh ngân hàng với provider thật. Bản sửa xử lý quyền truy cập; các điều kiện cấu hình ngân hàng khác vẫn được kiểm tra như trước.
