# Gói dịch vụ cho chủ cửa hàng — 08/11/2026

## Phạm vi triển khai

Chỉ sửa frontend ở cả `src/` và `frontend/src/`; không sửa backend, seed, migration, database hoặc cấu hình backend. Không đăng ký gói, tạo khoản thu hoặc chuyển tiền thật trong quá trình kiểm thử.

Đã đối chiếu Swagger đang triển khai tại https://backend-fae8.onrender.com/docs-json và source mới trên `AmazonButton/Backend` qua kết nối GitHub chỉ đọc. Source backend trong workspace chưa có đủ API mới và không được chép đè.

## Giao diện và luồng đã thay đổi

- Với `STORE_OWNER`, mục **Gói thuê nút IoT** thành **Gói dịch vụ**, mở `/store/service-plans`.
- Đường dẫn cũ `/store/rentals` của owner chuyển về màn hình gói dịch vụ. Các role cửa hàng khác giữ điều hướng trước đây; thuê nút khách hàng và gói thiết bị admin không đổi.
- Hiển thị danh mục thật từ `GET /store/subscriptions/plans`: tên, mã, giá, thời hạn và giới hạn sản phẩm; không lấy catalog admin, không dùng giá/gói mẫu.
- Gói hiện tại và lịch sử kỳ đăng ký là dữ liệu của cửa hàng trong phiên xác thực. Kiểm tra `storeId` của response, trạng thái ACTIVE và thời hạn trước khi coi có hiệu lực.
- Đăng ký bằng ví qua `POST /store/subscriptions/subscribe`: có bước xác nhận, kiểm tra lại catalog, gửi planId và idempotency key ổn định; không gửi giá hoặc storeId tùy ý. Timeout giữ đúng yêu cầu cũ, không tự tạo giao dịch mới.
- Khi backend cấp kỳ bắt đầu trong tương lai, UI hiển thị ngày bắt đầu thực tế và không coi kỳ đó đã mở quyền đăng sản phẩm ngay.
- Thêm lựa chọn PayOS cho **đúng gói mặc định mà endpoint renew-charge hiện hỗ trợ**: chỉ khi catalog có duy nhất một gói ACTIVE giá 60.000đ, thời hạn 30 ngày và trùng gói đang chọn. Đây là ràng buộc của API backend đang có, không phải catalog hoặc giá mẫu frontend. Gói khác tiếp tục dùng đăng ký bằng ví.
- PayOS dùng `POST /store/subscriptions/renew-charge`, theo dõi `GET /billing-charges/:id`. Chỉ mở URL HTTPS thuộc PayOS hợp lệ; từ chối mẫu URL giả `/web/pl_...`. Không gọi settle từ trình duyệt và không bật quyền theo query return hoặc theo việc đã tạo link.
- Nếu POST tạo khoản thu không trả được mã khoản thu, UI giữ trạng thái chưa xác nhận, không tự lặp POST, chặn gửi thêm yêu cầu thanh toán khác trong phiên và hướng dẫn kiểm tra/hỗ trợ.
- Giữ liên kết tới gói hiện tại/ngân hàng và lịch sử đóng phí ở trang tài chính. Đọc đủ các trang sổ ví cho phí thuê sàn, nhận `transactionId` mới; phân biệt bút toán đã ghi sổ với dữ liệu không rõ trạng thái. Không lấy giá niêm yết nhân số kỳ để suy ra tiền đã trả. Tổng qua ví không đại diện tổng mọi kênh PayOS.

## Điều kiện đăng sản phẩm ở frontend

Chủ cửa hàng có thể quản lý sản phẩm/tồn kho đã có. Đăng mới cần:

1. API gói và dữ liệu đúng cửa hàng tải thành công.
2. Gói ACTIVE, `startDate <= hiện tại < endDate`.
3. Đọc được hạn mức từ plan và tổng sản phẩm thật từ metadata `/products`.
4. Tổng sản phẩm nhỏ hơn `maxProducts`.

Nút thêm bị khóa khi điều kiện chưa đạt, kèm lý do và link đăng ký gói. Kiểm tra lại bằng API ngay trước khi POST tạo sản phẩm, không chỉ dựa vào trạng thái đã tải lúc vào trang. Mở bán lại sản phẩm cần thời hạn hợp lệ; ngừng bán vẫn được phép. Việc sửa thông tin, giá và tồn kho của sản phẩm đã có giữ luồng hiện hữu.

Không coi thành công thanh toán local, receipt client hoặc số dư ví thay đổi là bằng chứng đủ quyền. Trang sản phẩm tiếp tục đọc gói thực từ server.

## Điểm backend phải xử lý để bảo đảm quy tắc đầy đủ

### P0 — Backend kiểm tra nhầm kỳ hết hạn/chưa bắt đầu

Nguồn: [StoreSubscriptionsService](https://github.com/AmazonButton/Backend/blob/main/src/store-subscriptions/store-subscriptions.service.ts), [StoreSubscriptionsRepository](https://github.com/AmazonButton/Backend/blob/main/src/store-subscriptions/store-subscriptions.repository.ts).

`getCurrentSubscription()` hiện có fallback trả kỳ tương lai hoặc kỳ gần nhất (kể cả đã hết hạn). `validateStoreCanListProducts()` chỉ kiểm tra có row hay không rồi kiểm tra quota; chưa tự xác nhận status và thời hạn của row. Vì vậy lời gọi trực tiếp API có thể không tuân thủ điều kiện đang áp dụng ở frontend.

Đề nghị backend kiểm tra quyền đăng bán thực: đúng cửa hàng, gói ACTIVE, đã bắt đầu, chưa kết thúc, còn hạn mức. Không chỉ kiểm tra `currentSub != null`. Kiểm tra quota trong cùng transaction tạo sản phẩm để tránh hai request đồng thời vượt hạn mức. Nếu gói thử được cấp tự động, cần quyết định rõ nó có quyền đăng bán hay phải đăng ký/thanh toán riêng; không dùng paymentMethod mặc định làm bằng chứng đã trả tiền.

### P0 — Mở bán lại và catalog công khai chưa áp dụng điều kiện gói

Nguồn: [ProductsService](https://github.com/AmazonButton/Backend/blob/main/src/products/products.service.ts), [ProductsRepository](https://github.com/AmazonButton/Backend/blob/main/src/products/products.repository.ts).

- `ProductsService.create()` có gọi validate gói, nhưng `update()` cho đổi `status` về ACTIVE chưa gọi kiểm tra tương tự.
- `findStorefrontCatalog()` hiện lọc product ACTIVE và store ACTIVE; chưa thấy lọc theo hiệu lực gói dịch vụ.

Đề nghị áp dụng quyền đăng bán cho mọi đường mở bán và cho catalog công khai nếu chính sách là không có gói thì không được bán trên sàn. Không để mất/khóa dữ liệu tồn kho hoặc làm hư các đơn đang xử lý. Frontend không thể thay thế kiểm tra server bằng việc ẩn một nút; không thay catalog công khai bằng dữ liệu tự lọc không đủ thông tin quyền.

Các nhận xét này dựa trên source GitHub mới đã đọc, không phải kết quả khai thác/tạo sản phẩm trái quyền trên deployment. Cần backend xác nhận commit đang chạy và kiểm thử HTTP tương ứng.

### P1 — Thanh toán PayOS cần gắn với planId và idempotency

Nguồn: [StoreSubscriptionsController](https://github.com/AmazonButton/Backend/blob/main/src/store-subscriptions/store-subscriptions.controller.ts), [BillingChargesService](https://github.com/AmazonButton/Backend/blob/main/src/billing-charges/billing-charges.service.ts), [BillingChargesRepository](https://github.com/AmazonButton/Backend/blob/main/src/billing-charges/billing-charges.repository.ts).

`renew-charge` hiện cố định 60.000đ/30 ngày và không nhận planId; settlement tìm gói đang active có giá 60.000đ. Không đủ contract để frontend thanh toán PayOS cho bất kỳ gói được chọn, nhất là khi nhiều gói cùng giá.

Đề nghị nhận planId, snapshot giá/thời hạn/quota, kiểm tra quyền cửa hàng, trả quote/amount thực tế và ghi rõ planId trong billing charge. Tạo khoản thu cần idempotency và endpoint khôi phục khoản pending của đúng cửa hàng; hiện POST tạo charge timeout không cho frontend biết chargeId để truy tìm chắc chắn. Không coi một request lỗi là chắc chắn chưa tạo khoản thu.

Nguồn hiện có cho đăng ký bằng ví thực hiện idempotency và trừ tiền theo giá server. Chưa có quote/version để khóa báo giá giữa lúc xem và thanh toán; UI kiểm tra lại catalog trước khi gửi nhưng cần server bảo đảm giá được chấp thuận không đổi giữa các bước.

### P1 — Quyền và usage nên được trả trực tiếp

Đề nghị trả rõ `canListProducts`, lý do, gói đang có hiệu lực, kỳ kế tiếp, quota đã dùng/còn lại và quy tắc đổi gói. Backend hiện nối kỳ mới sau kỳ đã thanh toán, nên mua gói cao hơn không đồng nghĩa được tăng quota ngay. UI giữ đúng mốc thời hạn server, không hứa nâng cấp tức thì.

### P1 — Kiểm thử provider thật

Cần backend xác nhận PayOS production, webhook, khoản PAID và subscription được cấp cùng cửa hàng; việc tạo link chưa phải thanh toán thành công. Frontend truyền đường quay lại đúng origin hiện tại `/store/service-plans`; trạng thái lấy từ API, không tin các query được redirect về.

## Kiểm tra frontend

Test bao gồm hiệu lực/kỳ tương lai/hết hạn, quota server thay vì độ dài trang đầu, dữ liệu khác cửa hàng, không tự POST khi xem/chọn gói, bước xác nhận, DTO/idempotency, nhấp xác nhận trùng, timeout, PayOS chưa PAID, PAID, URL giả, chặn đăng mới/mở bán lại, giữ ngừng bán và không gửi yêu cầu tài chính muộn sau khi rời trang.

- Toàn bộ test root và frontend sau tinh chỉnh cuối: **499/499 đạt**.
- `npm.cmd run build` ở root và `frontend/`: **đều thành công**.
- `git diff --check`: đạt. `git status --short -- backend`: không có thay đổi.
- Chưa thực hiện thanh toán thật trên Render; công cụ trình duyệt của phiên làm việc chưa kết nối được để kiểm tra trực quan.
