# Bàn giao yêu cầu cho đội backend — 07/11/2026

## Phạm vi và trạng thái

Frontend không có quyền sửa backend, bao gồm source, test, cấu hình, database và tài liệu trong thư mục backend. Những thay đổi backend do frontend đã thực hiện đã được thu hồi theo yêu cầu. Không deploy lên Render, không chuyển chủ sở hữu cửa hàng và không sửa dữ liệu thật.

Đây là mô tả vấn đề và đề xuất để đội backend xem xét, **không phải chức năng đã được sửa hoặc đã triển khai**. Frontend giữ nguyên việc xử lý 403, không tự bỏ kiểm tra quyền hoặc báo thành công khi API từ chối.

## 1. Ưu tiên: chủ cửa hàng bị 403 khi quản lý ngân hàng

### Hiện tượng

- Đăng nhập bằng tài khoản đang được hiển thị là **Chủ cửa hàng**.
- Vào **Gói & ngân hàng**: gói hiện tại tải được, nhưng danh sách tài khoản ngân hàng trả 403, khiến nút thêm tài khoản bị khóa.
- API lỗi: `GET /api/v1/stores/:storeId/bank-accounts`.

### Nguyên nhân đã đối chiếu

Truy vấn chỉ đọc xác nhận tài khoản được báo lỗi có phân công `store_staff` với `roleCode=STORE_OWNER`, `status=ACTIVE`, `leftAt=null`, user ACTIVE; nhưng không có quan hệ chủ sở hữu chính trong `ownedStores`.

Đăng nhập/JWT hiện công nhận STORE_OWNER từ phân công cửa hàng. Trong khi đó, `BankVerificationService.verifyStoreOwnership()` chỉ cho phép khi `Store.ownerUserId` trùng user hoặc role là literal ADMIN. Hai cách xác định chủ cửa hàng không thống nhất.

Source liên quan:

- [AuthService.resolveUserRole](../backend/src/auth/auth.service.ts).
- [JwtStrategy.validate](../backend/src/auth/jwt.strategy.ts).
- [BankVerificationService.verifyStoreOwnership](../backend/src/bank-verification/bank-verification.service.ts).
- [Các route tài khoản ngân hàng](../backend/src/bank-verification/store-bank-accounts.controller.ts).

### Đề nghị đội backend xử lý

Thống nhất định nghĩa quyền chủ cửa hàng giữa đăng nhập và nghiệp vụ ngân hàng:

1. Nếu STORE_OWNER được phân công có quyền quản lý ngân hàng: kiểm tra từ database phân công **đúng user + đúng cửa hàng + đúng role STORE_OWNER**, còn ACTIVE, chưa rời cửa hàng và user còn ACTIVE. Áp dụng nhất quán tại chốt quyền dùng chung.
2. Nếu ngân hàng chỉ cho chủ sở hữu chính: thống nhất lại dữ liệu phân quyền và thông tin quyền trả về frontend. Cần phân biệt người chỉ được gán nhãn role với người có quyền tài chính thực tế; không sửa `ownerUserId` chỉ để làm mất lỗi 403.
3. Quy tắc cho ADMIN/SYSTEM_ADMIN/SUPER_ADMIN cần được backend xác định rõ. Không mặc định một role hoặc nhãn hiển thị cấp quyền toàn hệ thống.
4. Không tin `userId`, role hoặc quyền sở hữu do client tự gửi. Lấy danh tính từ phiên đã xác thực, kiểm tra phạm vi cửa hàng ở server.

Các API hiện có cần cùng tuân thủ quy tắc đã thống nhất, không cần thêm endpoint chỉ để chữa 403:

| Method | Đường dẫn sau `/api/v1` | Thao tác |
|---|---|---|
| GET | `/stores/:storeId/bank-accounts` | Đọc danh sách |
| POST | `/stores/bank-accounts/verification` | Tạo yêu cầu xác minh |
| PATCH | `/stores/:storeId/bank-accounts/:id/default` | Chọn mặc định |
| DELETE | `/stores/:storeId/bank-accounts/:id` | Xóa tài khoản |
| POST | `/stores/bank-accounts/verification/:id/cancel` | Hủy xác minh |

### Tiêu chí nghiệm thu cần backend kiểm thử

- Chủ cửa hàng hợp lệ theo mô hình đã thống nhất đọc được danh sách: 200 với mảng tài khoản hoặc `[]` nếu chưa có.
- Có thể bắt đầu thêm/xác minh tài khoản của đúng cửa hàng, không còn bị chặn sai bởi kiểm tra quyền.
- Không cho role OWNER ở cửa hàng A đọc hoặc sửa ngân hàng của cửa hàng B.
- Nhân viên/manager không có quyền tài chính, phân công đã dừng/đã rời, user bị khóa vẫn bị từ chối.
- Sửa/chọn mặc định/xóa/hủy xác minh tiếp tục kiểm tra tài khoản hoặc giao dịch thuộc đúng cửa hàng; không bỏ kiểm tra trạng thái xác minh hiện có.
- Trả lỗi 401/403 đúng nghĩa, có mã lỗi ổn định và thông báo phù hợp để frontend xử lý.
- Sau khi đội backend sửa và deploy bản chạy trên Render, kiểm tra HTTP lại bằng tài khoản đã báo lỗi. Ctrl+F5 riêng frontend không sửa được quyền trên server.

## 2. Điều kiện còn thiếu để hoàn tất luồng ngân hàng

| Vấn đề | Backend cần cung cấp hoặc xác nhận |
|---|---|
| Hướng dẫn chuyển tiền xác minh chưa đầy đủ | Phản hồi tạo yêu cầu hiện có số tiền, nội dung và hạn nhưng chưa có thông tin người nhận. Cần trả ngân hàng/BIN, số tài khoản, tên người nhận và QR nếu hỗ trợ, theo cấu hình server; không để frontend tự đoán. |
| Khôi phục yêu cầu đang chờ | Cần cách đọc yêu cầu pending theo cửa hàng/tài khoản, kèm trạng thái, hạn và thông tin hướng dẫn. Hiện frontend chỉ giữ biên nhận trên trình duyệt, không thể khôi phục đầy đủ ở thiết bị khác. Contract endpoint mới nếu cần do hai bên thống nhất. |
| Ngân hàng mặc định và ví không cùng mô hình | Xác định nguồn dữ liệu chuẩn giữa registry `StoreBankAccount` và trường ngân hàng legacy của ví. Cần bảo đảm chọn mặc định, thông tin hiển thị trong ví và tài khoản nhận rút tiền thống nhất; API trả lại kết quả thực tế sau thay đổi. |

## 3. Các vướng mắc backend khác đã ghi nhận khi nối UI

Các mục này độc lập với lỗi 403 ở trên; đội backend có thể ưu tiên theo kế hoạch sản phẩm. Chưa tự sửa hoặc thêm API cho những mục này.

| Nhóm | Yêu cầu bàn giao |
|---|---|
| Gói dịch vụ cửa hàng | Cần danh mục gói dành cho chủ cửa hàng, trả ID/giá/thời hạn/quyền lợi/trạng thái thực tế. Frontend không dùng danh mục admin hoặc dựng giá giả để gọi `/store/subscriptions/subscribe`. |
| Chi trả PayOS | Raw batch hiện không liên kết/claim withdrawal trong hệ thống. Cần xử lý chống chi trùng, ghi nhận và đối soát từng yêu cầu. `sync-payout` hiện chỉ đọc provider; cần thống nhất cập nhật trạng thái local/ledger. |
| Hủy liên kết thanh toán | Cần đồng bộ trạng thái provider với transaction local và kiểm tra quyền trên đơn/giao dịch. Frontend không tự chuyển đơn sang đã hủy hoặc đã thanh toán. |
| Thanh toán hợp đồng thuê | Chưa thấy controller cho `/rentals/:id/pay`; cần luồng thanh toán và trạng thái thật trước khi kích hoạt. Cũng cần danh sách/chi tiết hợp đồng dành cho admin để thao tác từ hồ sơ được đọc từ server. |
| Ca giao hàng | History hiện chỉ trả ca của người hiện tại; cần danh sách/chi tiết ca theo cửa hàng nếu quản lý phải xác nhận bàn giao của tài xế khác. |
| Thiết bị | Telemetry hiện trả snapshot mẫu, cần dữ liệu đo thực. Confirmation ghép nối cần kiểm tra chủ sở hữu hiện tại ngay trong transaction để tránh ghi đè khi nhiều client cùng thao tác. |
| API frontend chưa thấy trong source backend | Đối chiếu bản triển khai của `/auth/change-password` và `/payments/orders/:id/payment-method`; thống nhất endpoint/contract thật trước khi frontend dựa vào các thao tác này. |
| Lỗi 429 trên deployment | Nếu vẫn bị giới hạn sau khi frontend đã chờ Retry-After và dừng vòng lặp reconnect, cần kiểm tra log, IP phía sau proxy và limiter trên bản chạy thực tế. Không tắt limiter để che lỗi. |

Firebase Web/OTP/FCM chưa được cấu hình theo lựa chọn của người dùng và sẽ cấu hình sau; không tính đó là luồng đã kiểm thử với SMS/thông báo thật.

## Ghi nhận thu hồi

- Hoàn nguyên hai file nghiệp vụ ngân hàng và `backend/SESSION_HANDOFF.md` về bản HEAD đã kiểm tra; giữ nguyên thay đổi backend có sẵn của đội backend.
- Gỡ test tạm `backend/tests/bank-owner-access.spec.ts` do frontend thêm, cùng các bản biên dịch của test này.
- Không cập nhật thêm handoff bên trong backend; mọi ghi chú bàn giao nằm trong tài liệu ngoài thư mục backend này.
- Git diff frontend được kiểm tra giữ nguyên trong quá trình thu hồi. Lỗi 403 vẫn cần đội backend xử lý theo nội dung trên.
