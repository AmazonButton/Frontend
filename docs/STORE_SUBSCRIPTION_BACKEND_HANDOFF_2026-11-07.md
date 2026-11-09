# Gói thuê sàn của cửa hàng — bàn giao backend

Ngày: 07/11/2026. Phạm vi: phí thuê gian hàng/sàn của chính cửa hàng, khác với hợp đồng thuê nút IoT.

## Trạng thái bàn giao

Đã đọc controller, service, repository và Prisma schema tại workspace. Không sửa source, test, cấu hình, migration hay dữ liệu backend; không thực hiện đăng ký gói hoặc giao dịch thật. Những nhận xét bên dưới là kết quả đối chiếu source, chưa xác nhận HTTP trên bản backend đang triển khai.

Frontend dùng các API hiện hữu, giữ nghiệp vụ ngân hàng. Những API đề xuất trong tài liệu này **chưa được frontend gọi** và chưa được xem là đã triển khai.

## 1. Màn hình frontend đã bổ sung

- Gói thuê gian hàng hiện tại: tên, mã gói, mã đăng ký, ngày bắt đầu/hết hạn, ngày còn lại, chu kỳ, giới hạn sản phẩm, mô tả và giá niêm yết hiện tại.
- Phân biệt gói đang sử dụng, kỳ chưa bắt đầu, đã đến hạn và dữ liệu chưa đầy đủ; không biến `current = null` thành kết luận chắc chắn đã hết hạn.
- Thanh tiến độ kỳ sử dụng và cảnh báo ngay trên trang khi còn tối đa 7 ngày; mức khẩn khi còn tối đa 3 ngày. Đây là cảnh báo từ ngày hết hạn trên giao diện, **không phải bằng chứng hệ thống đã gửi email/push/SMS**.
- Tổng phí thuê sàn đã trừ qua ví, tổng trong tháng theo múi giờ Việt Nam, số lần đóng phí thành công, lần đóng phí gần nhất.
- Lịch sử chỉ lấy `type = SUBSCRIPTION_PAYMENT`; tìm kiếm, khoảng thời gian, phân trang trên giao diện, xuất CSV, mở chi tiết mã tham chiếu/số dư trước và sau.
- Tách lỗi của lịch sử khỏi thông tin gói/ngân hàng; giữ dữ liệu đã tải nếu làm mới thất bại; ngăn phản hồi cũ hiển thị sau khi đổi tài khoản/cửa hàng.
- Giữ nguyên xác minh, chọn mặc định, xóa và hủy xác minh ngân hàng; giữ liên kết ví trong báo cáo doanh thu.

Giới hạn hiển thị rõ: tổng hiện tại là **phí thuê sàn qua ví**, chưa phải tổng chi trọn đời của mọi kênh hoặc tổng sau hoàn phí. Không dùng `plan.price × số lần` để suy ra tiền đã đóng.

## 2. Contract hiện có đã kiểm tra

Các đường dẫn dưới đây đứng sau `/api/v1`.

| API | Dữ liệu và giới hạn thực tế |
|---|---|
| `GET /store/subscriptions/current` | `{ success: true, data: subscription hoặc null }`. Subscription có `subscriptionId`, `storeId`, `planId`, `startDate`, `endDate`, `status`, `paymentMethod`, `createdAt`, `updatedAt`, `plan` và `daysRemaining`. |
| `GET /store/wallet/transactions` | Trả toàn bộ giao dịch ví, sắp xếp mới nhất trước; chưa phân trang/lọc phía server. Mỗi dòng có `id`, `amount`, `type`, `status`, `balanceBefore`, `balanceAfter`, `referenceId`, `description`, `createdAt`. Service hiện gán `status: SUCCESS` cho các bút toán đã lưu. |
| `POST /store/subscriptions/subscribe` | Đã có đăng ký bằng ví, DTO `planId` và `idempotencyKey`. Backend khóa ví và dùng Decimal để trừ tiền. Frontend của task này không thêm thao tác thanh toán/gia hạn. |
| `GET /admin/plans` | Chỉ các role admin được phép; không dùng endpoint này cho store owner để né quyền. |

Nguồn:

- [Controller gói](../backend/src/store-subscriptions/store-subscriptions.controller.ts), [service](../backend/src/store-subscriptions/store-subscriptions.service.ts), [repository](../backend/src/store-subscriptions/store-subscriptions.repository.ts).
- [Controller ví](../backend/src/store-wallet/store-wallet.controller.ts), [service ví](../backend/src/store-wallet/store-wallet.service.ts).
- [Schema](../backend/prisma/schema.prisma): `SubscriptionPlan`, `StoreSubscription`, `WalletTransaction`.
- [Quyền danh mục gói](../backend/src/admin/admin.controller.ts).

Phạm vi cửa hàng được backend lấy từ phiên xác thực (`req.user.storeId` hoặc `ownedStores[0].storeId`); frontend không gửi storeId tùy ý để đọc cửa hàng khác. Controller giới hạn OWNER/MANAGER. Danh sách ngân hàng vẫn chỉ mở thao tác quản lý cho OWNER theo UI hiện hành.

## 3. Các thiếu hụt cần backend bổ sung/xác nhận

### P0 — Tổng chi thực tế và liên kết khoản thanh toán với kỳ thuê

Hiện tại `WalletTransaction` có bút toán phí âm `SUBSCRIPTION_PAYMENT`, nhưng không có FK trực tiếp đến `StoreSubscription`. `referenceId` có hai dạng: `SUB-{subscriptionId}` và `SUB-IDEMP-{key}:{hash}`. Không thể dựa vào mọi mã tham chiếu để luôn tìm được kỳ thuê; frontend không đoán liên kết từ mô tả.

Cần bổ sung nguồn tổng hợp có thẩm quyền:

- Tổng đã trả mọi kênh, tổng hoàn phí, chi ròng, số giao dịch thành công, ngày đầu/cuối thanh toán; quy định rõ VND và quy tắc làm tròn.
- Giao dịch liên kết trực tiếp kỳ thuê, gói, hóa đơn và biên nhận; phân biệt phí thuê sàn với thuê nút, phí giao dịch và rút tiền.
- Số tiền gốc/giảm giá/thuế/số phải trả thực tế tại lúc mua; snapshot tên/mã gói, thời hạn và quyền lợi để sửa catalog không làm thay đổi lịch sử.
- Dữ liệu tiền nên là chuỗi Decimal. Các ID lớn là chuỗi. Không gộp giao dịch chờ/thất bại vào đã thanh toán; quy định rõ hoàn phí một phần/toàn phần.

### P0 — Phân biệt kỳ đang sử dụng và kỳ đã mua trước

`getCurrentSubscription()` hiện lọc `status = ACTIVE`, `endDate >= now`, rồi lấy `endDate` xa nhất, **không kiểm tra `startDate <= now`**. Trong khi đăng ký mới nếu đang còn hạn sẽ tạo kỳ kế tiếp có `startDate = activeSub.end_date`. Vì vậy gói trả về có thể là kỳ tương lai, che kỳ đang có hiệu lực.

Đề nghị API phân biệt `currentPeriod`, `upcomingPeriods`, `lastExpiredPeriod`, trạng thái quyền sử dụng thực tế và ngày hết quyền truy cập tổng thể. Trả rõ mốc đã trả trước đến ngày nào; không chỉ dựa vào status trong một row.

`current = null` không phân biệt cửa hàng mới, hết hạn, bị tạm ngừng hay chưa có dữ liệu. Cần trạng thái tổng thể và lý do riêng.

### P1 — Lịch sử gói đã thuê và thanh toán đầy đủ

Chưa thấy API store-scoped để liệt kê mọi `StoreSubscription`, gồm kỳ đã hết hạn, bị hủy và kỳ tương lai. API ví có thể cho tổng tất cả bút toán qua ví hiện hữu, nhưng không xác nhận các lần đóng tiền qua kênh khác và không có hóa đơn.

Đề nghị lịch sử gói và lịch sử đóng phí phân trang, bộ lọc ngày/trạng thái, số lượng tổng và tổng tiền có cùng phạm vi lọc. Tìm kiếm không nên bắt tải toàn bộ ví khi dữ liệu tăng. Quy định giữ dữ liệu và thứ tự ổn định khi thời gian trùng.

### P1 — Cảnh báo và trạng thái đã gửi nhắc hạn

Chưa thấy contract store subscription trả lịch sử gửi hoặc cấu hình nhắc hạn. Đề nghị mốc nhắc, kênh gửi, trạng thái enabled/disabled, lịch sử lần gửi gần nhất, thất bại/thành công và thời điểm tiếp theo. Cần idempotency của job để tránh gửi trùng và kiểm tra quyền đúng cửa hàng.

Không trả dữ liệu giả như `reminderSent = true` chỉ vì còn ít ngày. Frontend hiện chỉ báo ngay trên trang; email/push/SMS là khả năng chờ backend xác nhận.

### P1 — Danh mục gói cho cửa hàng và điều kiện gia hạn

Đã có POST đăng ký nhưng catalog hiện chỉ admin. Cần GET catalog hợp lệ cho store, báo giá gia hạn/đổi gói, số tiền thực tế, thời điểm hiệu lực, thay đổi quyền lợi, số dư khả dụng và điều kiện chuyển gói. Có quote/version để tránh thanh toán theo giá cũ. Luồng ghi tiền tiếp tục có xác nhận và idempotency ở server; không dựa vào giá client.

### P2 — Khả năng bổ sung để màn hình hoàn chỉnh hơn

- Hóa đơn/biên nhận tải xuống với quyền kiểm tra từng tài nguyên.
- Sử dụng/quota thực tế (sản phẩm đã dùng trên giới hạn), quyền lợi và cảnh báo gần giới hạn.
- Bảng so sánh gói hợp lệ cho cửa hàng, ước tính chi phí kỳ tiếp theo theo báo giá server.
- Trạng thái tự gia hạn chỉ hiển thị khi backend thực sự hỗ trợ; chưa có thì không dựng công tắc giả.
- Người thực hiện thanh toán, lịch sử đổi gói và ghi chú hỗ trợ đối soát.
- Phân biệt gói dùng thử/miễn phí với gói đã thanh toán. `createTrialSubscription()` tạo row ACTIVE nhưng không có bút toán phí; schema `paymentMethod` mặc định PAYOS nên không dùng trường này như bằng chứng đã thanh toán.

## 4. Contract bổ sung đề xuất (chưa triển khai/chưa được gọi)

Tên endpoint chỉ là đề xuất, backend có thể thống nhất contract tương đương:

- `GET /store/subscriptions/overview`: `serverTime`, `storeId`, `currency`, `accessStatus`, `currentPeriod`, `upcomingPeriods`, `lastExpiredPeriod`, `paidThrough`, `totals`, `reminderSummary`, `capabilities`.
- `GET /store/subscriptions/history?page=1&pageSize=20`: snapshot mỗi kỳ thuê và quan hệ payment; `pagination`.
- `GET /store/subscriptions/payments?page=1&pageSize=20&from=...&to=...&status=...`: tiền đã trả/hoàn/thực chi và kênh, liên kết kỳ thuê/hóa đơn, tổng có phạm vi rõ ràng.
- `GET /store/subscriptions/plans`: catalog chỉ những gói cửa hàng được đăng ký, không mở quyền admin.
- Báo giá gia hạn và biên nhận tải xuống: thống nhất URL/DTO với backend trước khi nối UI.

Giữ envelope `{ success, message?, data, pagination? }`. Endpoint hiện có không cần bị thay thế; ưu tiên bổ sung tương thích.

## 5. Tiêu chí nghiệm thu backend

1. OWNER A chỉ đọc được gói/thanh toán/hóa đơn của A; sửa storeId, paymentId, subscriptionId không đọc được B. Thống nhất quyền MANAGER, OWNER được phân công và ownerUserId.
2. Kỳ tương lai không thay thế kỳ đang sử dụng; mua trước nhiều kỳ hiển thị đúng thời gian và tổng đã thanh toán.
3. Hết hạn, chưa từng đăng ký, trial, miễn phí, hủy và tạm ngừng có trạng thái phân biệt; null không bị hiểu sai.
4. Tổng chi khớp dữ liệu sổ sách, không tính hai lần khi retry, không lấy giá catalog hiện tại thay giá đã thanh toán; hoàn một phần xử lý đúng.
5. Phân trang/lọc và tổng tiền nhất quán; ID lớn/Decimal không bị mất chính xác.
6. Nhắc hạn ở biên 7/3/0 ngày theo thời gian server, có bằng chứng gửi, không gửi trùng hoặc gửi cho sai cửa hàng.
7. Sửa giá/quyền lợi catalog không sửa snapshot kỳ đã mua. Quote hết hạn phải được kiểm tra lại trước trừ tiền.
8. Lỗi 401/403/404/409/429 và phản hồi chưa đầy đủ có mã lỗi rõ ràng; không báo thu tiền thành công nếu kết quả chưa chắc chắn.

## 6. Kiểm chứng frontend

- `npm.cmd run build` tại root: PASS (TypeScript + Vite).
- `npm.cmd run build` tại `frontend`: PASS (TypeScript + Vite).
- `node --experimental-strip-types --test tests/store-subscription-overview.test.mjs tests/store-finance-flow.test.mjs frontend/tests/store-finance-flow.test.mjs tests/store-navigation.test.mjs frontend/tests/wallet-partial-load.test.mjs`: PASS, 63/63.
- `git diff --check` cho các file đã sửa của màn hình/ngân hàng: PASS.
- `git status --short -- backend`: không có thay đổi trong thư mục backend.
- Các file màn hình, helper và component mới giữa `src` và `frontend/src` được đồng bộ.
- Kiểm tra trực quan và HTTP với phiên owner trên backend triển khai: chưa thực hiện được; công cụ browser/native hiện không kết nối. Các kiểm tra tự động dùng transport giả lập theo contract đã đọc, không tạo giao dịch thật.

Không xem kiểm tra frontend là bằng chứng backend đã chạy hay các API đề xuất đã có.
