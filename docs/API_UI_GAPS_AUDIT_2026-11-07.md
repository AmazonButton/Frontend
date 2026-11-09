# Đối chiếu API backend với giao diện frontend — 07/11/2026

> Đây là bản kiểm kê trước triển khai. Trạng thái sau khi bổ sung giao diện và các điều kiện còn thiếu nằm trong [báo cáo triển khai](API_UI_IMPLEMENTATION_2026-11-07.md).

## Phạm vi và cách đọc

- Đọc controller NestJS trong `backend/src`, đối chiếu lời gọi HTTP, service, nơi sử dụng service và màn hình/route của cả `src` lẫn `frontend/src`.
- Ghi nhận **163 biến thể đường dẫn trong 25 controller**. Có **46 biến thể không thấy lời gọi frontend** và **16 endpoint có service nhưng chưa thấy nơi gọi từ UI**. Tổng 62 mục được phân loại dưới đây; **không phải 62 chức năng còn thiếu** vì bao gồm đường dẫn thay thế, API hệ thống và phần đã chủ động gỡ.
- Đường dẫn trong bảng lược bỏ tiền tố chung `/api/v1`; các đường dẫn health ghi đúng URL đầy đủ. `:id`, `:storeId`, `:sessionId` là tham số.
- Không thấy khác biệt về tập endpoint được tham chiếu giữa hai bản frontend. Không có endpoint nào được tính là đã tham chiếu chỉ nhờ test.
- Đây là kiểm tra source hiện tại, không xác nhận backend đã deploy, cấu hình dịch vụ bên ngoài, dữ liệu thật hoặc hiệu lực phân quyền lúc chạy.

## 1. Chưa có lời gọi frontend cho nghiệp vụ (18 endpoint)

Các endpoint dưới đây có ở backend nhưng không thấy lời gọi tương ứng trong cả hai bản frontend.

| API | Chức năng / nhận xét | Bằng chứng trong source |
|---|---|---|
| `POST /admin/withdrawals/:id/transfer` | Admin xác nhận đã chuyển khoản, kèm chứng từ. Màn hình chi trả hiện chỉ đọc danh sách. | [backend/src/admin/admin.controller.ts:116](../backend/src/admin/admin.controller.ts#L116) |
| `POST /admin/withdrawals/:id/reject` | Admin từ chối yêu cầu rút tiền, có lý do. | [backend/src/admin/admin.controller.ts:126](../backend/src/admin/admin.controller.ts#L126) |
| `GET /admin/payos/payout-balance` | Admin xem số dư chi trả PayOS. | [backend/src/admin/admin.controller.ts:136](../backend/src/admin/admin.controller.ts#L136) |
| `POST /admin/withdrawals/:id/payout` | Admin gửi lệnh chi tiền qua PayOS cho một yêu cầu rút. | [backend/src/admin/admin.controller.ts:142](../backend/src/admin/admin.controller.ts#L142) |
| `POST /admin/withdrawals/:id/sync-payout` | Admin đồng bộ trạng thái chi trả của một yêu cầu. | [backend/src/admin/admin.controller.ts:148](../backend/src/admin/admin.controller.ts#L148) |
| `POST /admin/payos/payouts/batch` | Admin tạo lệnh chi trả theo lô. | [backend/src/admin/admin.controller.ts:154](../backend/src/admin/admin.controller.ts#L154) |
| `POST /admin/payos/payouts/estimate-credit` | Admin ước tính credit cho lệnh chi trả. | [backend/src/admin/admin.controller.ts:160](../backend/src/admin/admin.controller.ts#L160) |
| `POST /stores/bank-accounts/verification` | Tạo yêu cầu xác minh tài khoản ngân hàng của cửa hàng. | [backend/src/bank-verification/store-bank-accounts.controller.ts:37](../backend/src/bank-verification/store-bank-accounts.controller.ts#L37) |
| `PATCH /stores/:storeId/bank-accounts/:id/default` | Chọn tài khoản ngân hàng mặc định. | [backend/src/bank-verification/store-bank-accounts.controller.ts:70](../backend/src/bank-verification/store-bank-accounts.controller.ts#L70) |
| `DELETE /stores/:storeId/bank-accounts/:id` | Xóa tài khoản ngân hàng. | [backend/src/bank-verification/store-bank-accounts.controller.ts:86](../backend/src/bank-verification/store-bank-accounts.controller.ts#L86) |
| `POST /stores/bank-accounts/verification/:id/cancel` | Hủy yêu cầu xác minh tài khoản ngân hàng. | [backend/src/bank-verification/store-bank-accounts.controller.ts:102](../backend/src/bank-verification/store-bank-accounts.controller.ts#L102) |
| `POST /auth/phone/verify` | Xác minh số điện thoại bằng Firebase ID token cho người dùng đã đăng nhập. | [backend/src/auth/auth.controller.ts:161](../backend/src/auth/auth.controller.ts#L161) |
| `POST /auth/register-by-phone` | Đăng ký bằng số điện thoại. | [backend/src/auth/auth.controller.ts:181](../backend/src/auth/auth.controller.ts#L181) |
| `POST /auth/login-by-phone` | Đăng nhập bằng số điện thoại. | [backend/src/auth/auth.controller.ts:187](../backend/src/auth/auth.controller.ts#L187) |
| `POST /store/subscriptions/subscribe` | Chủ cửa hàng / quản lý đăng ký gói dịch vụ bằng ví. UI mới đọc gói hiện tại. | [backend/src/store-subscriptions/store-subscriptions.controller.ts:34](../backend/src/store-subscriptions/store-subscriptions.controller.ts#L34) |
| `POST /driver-shifts/:id/confirm-handover` | Chủ cửa hàng / quản lý / nhân viên xử lý đơn hoặc quyền hệ thống được phép xác nhận bàn giao tiền ca. | [backend/src/driver-shifts/driver-shifts.controller.ts:41](../backend/src/driver-shifts/driver-shifts.controller.ts#L41) |
| `DELETE /identity-verifications/sessions/:sessionId` | Admin xóa phiên xác minh danh tính qua Didit rồi xóa mềm dữ liệu cục bộ. Chưa có màn hình quản trị phiên. | [backend/src/identity-verifications/identity-verifications.controller.ts:108](../backend/src/identity-verifications/identity-verifications.controller.ts#L108) |
| `DELETE /devices/:id/product` | Chủ cửa hàng / quản lý / SUPER_ADMIN gỡ sản phẩm đang gán cho nút bấm. UI đã có gán sản phẩm nhưng chưa gọi thao tác gỡ này. | [backend/src/devices/devices.controller.ts:159](../backend/src/devices/devices.controller.ts#L159) |

## 2. Đã viết service frontend nhưng chưa được giao diện gọi (16 endpoint)

Có hàm trong `src/services` và `frontend/src/services`, nhưng tìm kiếm nơi sử dụng không thấy màn hình/component gọi các hàm này. Có service chưa đồng nghĩa với đã tích hợp UI.

| API | Chức năng / nhận xét | Bằng chứng trong source |
|---|---|---|
| `GET /drivers/me/duty` | Xem trạng thái trực của người giao hàng. | [backend/src/drivers/drivers.controller.ts:20](../backend/src/drivers/drivers.controller.ts#L20)<br>[src/services/drivers.service.ts:28](../src/services/drivers.service.ts#L28) — `getMyDuty` |
| `PATCH /drivers/me/duty` | Đổi trạng thái trực, có thể kèm vị trí. | [backend/src/drivers/drivers.controller.ts:13](../backend/src/drivers/drivers.controller.ts#L13)<br>[src/services/drivers.service.ts:36](../src/services/drivers.service.ts#L36) — `updateDuty` |
| `GET /drivers/store/:storeId/online` | Cửa hàng xem người giao hàng đang trực. | [backend/src/drivers/drivers.controller.ts:27](../backend/src/drivers/drivers.controller.ts#L27)<br>[src/services/drivers.service.ts:47](../src/services/drivers.service.ts#L47) — `getOnlineDrivers` |
| `GET /orders/driver/my-orders` | Người giao hàng xem danh sách đơn của mình. | [backend/src/orders/orders.controller.ts:35](../backend/src/orders/orders.controller.ts#L35)<br>[src/services/drivers.service.ts:55](../src/services/drivers.service.ts#L55) — `getMyOrders` |
| `POST /orders/:id/claim` | Nhận đơn giao hàng. | [backend/src/orders/orders.controller.ts:61](../backend/src/orders/orders.controller.ts#L61)<br>[src/services/drivers.service.ts:63](../src/services/drivers.service.ts#L63) — `claimOrder` |
| `POST /orders/:id/deliver` | Xác nhận giao thành công, kèm thông tin giao nhận. | [backend/src/orders/orders.controller.ts:68](../backend/src/orders/orders.controller.ts#L68)<br>[src/services/drivers.service.ts:71](../src/services/drivers.service.ts#L71) — `completeDelivery` |
| `POST /orders/:id/fail` | Báo giao thất bại, kèm lý do. | [backend/src/orders/orders.controller.ts:75](../backend/src/orders/orders.controller.ts#L75)<br>[src/services/drivers.service.ts:79](../src/services/drivers.service.ts#L79) — `failDelivery` |
| `POST /media/upload-pod` | Tải ảnh bằng chứng giao hàng. | [backend/src/media/media.controller.ts:162](../backend/src/media/media.controller.ts#L162)<br>[src/services/media.service.ts:60](../src/services/media.service.ts#L60) — `uploadPodImage` |
| `POST /notifications/fcm-token` | Đăng ký token nhận thông báo đẩy trên thiết bị/trình duyệt. | [backend/src/notifications/notifications.controller.ts:13](../backend/src/notifications/notifications.controller.ts#L13)<br>[src/services/notifications.service.ts:14](../src/services/notifications.service.ts#L14) — `registerFcmToken` |
| `DELETE /notifications/fcm-token` | Hủy đăng ký token thông báo đẩy. | [backend/src/notifications/notifications.controller.ts:24](../backend/src/notifications/notifications.controller.ts#L24)<br>[src/services/notifications.service.ts:22](../src/services/notifications.service.ts#L22) — `unregisterFcmToken` |
| `POST /payments/payos/payment-requests/:id/cancel` | Hủy liên kết thanh toán PayOS; khác với thao tác hủy đơn hàng hiện có. | [backend/src/payments/payments.controller.ts:39](../backend/src/payments/payments.controller.ts#L39)<br>[src/services/payments.service.ts:52](../src/services/payments.service.ts#L52) — `cancelPaymentLink` |
| `GET /payments/:id` | Tra cứu chi tiết một giao dịch thanh toán; khác API lịch sử giao dịch ví đang dùng. | [backend/src/payments/payments.controller.ts:46](../backend/src/payments/payments.controller.ts#L46)<br>[src/services/payments.service.ts:81](../src/services/payments.service.ts#L81) — `getTransaction` |
| `POST /rentals/:id/activate` | Kích hoạt hợp đồng thuê nút bấm. Controller chỉ cho ADMIN và SYSTEM_ADMIN; khác thao tác bật/tắt gói thuê trong admin. | [backend/src/rentals/rentals.controller.ts:40](../backend/src/rentals/rentals.controller.ts#L40)<br>[src/services/rentals.service.ts:176](../src/services/rentals.service.ts#L176) — `activateRental` |
| `POST /media/destroy` | Xóa ảnh trên Cloudinary khi hợp lệ; backend có kiểm tra ảnh còn được sản phẩm sử dụng. Không phải cứ xóa hiển thị ảnh là phải gọi API này. | [backend/src/media/media.controller.ts:130](../backend/src/media/media.controller.ts#L130)<br>[src/services/media.service.ts:72](../src/services/media.service.ts#L72) — `destroyAsset` |
| `GET /media/signature` | Lấy chữ ký để upload trực tiếp lên Cloudinary. Đây là phương án upload bổ sung; UI đã upload ảnh qua POST /media/upload. | [backend/src/media/media.controller.ts:42](../backend/src/media/media.controller.ts#L42)<br>[src/services/media.service.ts:26](../src/services/media.service.ts#L26) — `getSignature` |
| `GET /products/:id` | Tải riêng chi tiết sản phẩm. UI đang sử dụng dữ liệu danh sách; không kết luận là mất chức năng xem/sửa sản phẩm. | [backend/src/products/products.controller.ts:67](../backend/src/products/products.controller.ts#L67)<br>[src/services/products.service.ts:75](../src/services/products.service.ts#L75) — `getById` |

## 3. Chi tiết và luồng thiết bị bổ sung chưa được gọi (9 biến thể đường dẫn)

Cần xem yêu cầu sản phẩm trước khi bổ sung. Các đường dẫn này chưa được gọi, nhưng nhiều chức năng đã có dữ liệu từ danh sách hoặc đang dùng một luồng khác.

| API | Chức năng / nhận xét | Bằng chứng trong source |
|---|---|---|
| `GET /device-templates/:id` | Lấy riêng chi tiết mẫu thiết bị; màn hình mẫu hiện dùng dữ liệu danh sách. | [backend/src/devices/device-templates.controller.ts:44](../backend/src/devices/device-templates.controller.ts#L44) |
| `GET /devices/:id` | Lấy riêng chi tiết thiết bị; danh sách, telemetry và nhật ký đã có lời gọi khác. | [backend/src/devices/devices.controller.ts:119](../backend/src/devices/devices.controller.ts#L119) |
| `POST /devices/:id/pair` | Ghép nối theo ID thiết bị. Frontend đã có lookup/configure-by-code và claim; không kết luận toàn bộ ghép nối bị thiếu. | [backend/src/devices/devices.controller.ts:139](../backend/src/devices/devices.controller.ts#L139) |
| `POST /provisioning/verify` | Kiểm tra trạng thái phiên thiết lập thiết bị. | [backend/src/devices/provisioning.controller.ts:43](../backend/src/devices/provisioning.controller.ts#L43) |
| `POST /provisioning/sessions/:id/confirmation` | Khách hàng xác nhận ghép nối và nhận sở hữu trong cùng phiên. Chưa thấy nối luồng phiên này; có luồng claim riêng. | [backend/src/devices/provisioning.controller.ts:51](../backend/src/devices/provisioning.controller.ts#L51) |
| `POST /provisioning/sessions/:id/confirm` | Tên đường dẫn thay thế của confirmation ngay phía trên; cùng handler, không phải chức năng thứ hai. | [backend/src/devices/provisioning.controller.ts:51](../backend/src/devices/provisioning.controller.ts#L51) |
| `GET /identity-verifications/sessions/:sessionId` | Lấy riêng chi tiết phiên. UI khách hàng đã gọi danh sách, tạo phiên và lấy quyết định xác minh. | [backend/src/identity-verifications/identity-verifications.controller.ts:46](../backend/src/identity-verifications/identity-verifications.controller.ts#L46) |
| `GET /stores/:id` | Lấy riêng chi tiết cửa hàng; frontend đã gọi danh sách cửa hàng. | [backend/src/stores/stores.controller.ts:25](../backend/src/stores/stores.controller.ts#L25) |
| `DELETE /products/:id` | Chuyển sản phẩm sang INACTIVE. Frontend đã thực hiện cùng hành vi bằng PUT /products/:id, nên không thiếu chức năng ngừng kinh doanh. | [backend/src/products/products.controller.ts:116](../backend/src/products/products.controller.ts#L116) |

## 4. Đường dẫn thay thế hoặc tương thích cũ (8 biến thể)

Không cần tạo thêm nút chỉ để sử dụng hết endpoint. Những đường dẫn này trùng nghiệp vụ hoặc thuộc nhóm tương thích cũ trong controller.

| API | Chức năng / nhận xét | Bằng chứng trong source |
|---|---|---|
| `POST /auth/google` | Đường dẫn thay thế; frontend đã dùng POST /auth/google-login. | [backend/src/auth/auth.controller.ts:57](../backend/src/auth/auth.controller.ts#L57) |
| `PATCH /auth/me` | Đường dẫn thay thế; frontend đã dùng PATCH /auth/profile. | [backend/src/auth/auth.controller.ts:107](../backend/src/auth/auth.controller.ts#L107) |
| `POST /devices/claim` | Nằm trong nhóm Backward Compatibility Endpoints. Frontend có configure-by-code và POST /devices/:id/claim. | [backend/src/devices/devices.controller.ts:192](../backend/src/devices/devices.controller.ts#L192) |
| `POST /devices/:id/assign` | Nhóm tương thích cũ; frontend có luồng gán/cấu hình thiết bị bằng các endpoint khác. | [backend/src/devices/devices.controller.ts:204](../backend/src/devices/devices.controller.ts#L204) |
| `PUT /devices/:id/config` | Nhóm tương thích cũ; không phải bằng chứng thiếu toàn bộ màn hình cấu hình. | [backend/src/devices/devices.controller.ts:211](../backend/src/devices/devices.controller.ts#L211) |
| `PATCH /devices/:id/status` | Nhóm tương thích cũ; frontend có các endpoint enable/disable. | [backend/src/devices/devices.controller.ts:217](../backend/src/devices/devices.controller.ts#L217) |
| `PATCH /devices/:id/toggle-active` | Phương án bật/tắt khác; frontend đã gọi POST /devices/:id/enable và /disable. | [backend/src/devices/devices.controller.ts:258](../backend/src/devices/devices.controller.ts#L258) |
| `POST /provisioning/devices/:id/change-wifi` | Cùng handler với POST /devices/:id/change-wifi mà frontend đã gọi. | [backend/src/devices/provisioning.controller.ts:114](../backend/src/devices/provisioning.controller.ts#L114) |

## 5. API dành cho hệ thống/phần cứng, không phải thiếu UI (10 biến thể)

Webhook, kiểm tra sức khỏe dịch vụ và giao tiếp IoT không cần nút thao tác trên giao diện người dùng.

| API | Chức năng / nhận xét | Bằng chứng trong source |
|---|---|---|
| `GET /healthz` | Kiểm tra dịch vụ còn hoạt động. Không thêm tiền tố /api/v1 cho route này. | [backend/src/app.controller.ts:13](../backend/src/app.controller.ts#L13) |
| `GET /readyz` | Kiểm tra trạng thái sẵn sàng. Không thêm tiền tố /api/v1 cho route này. | [backend/src/app.controller.ts:24](../backend/src/app.controller.ts#L24) |
| `GET /health` | Health endpoint; không thêm tiền tố /api/v1 cho route này. | [backend/src/app.controller.ts:43](../backend/src/app.controller.ts#L43) |
| `GET /api/v1/health` | Biến thể health đã có đầy đủ tiền tố. | [backend/src/app.controller.ts:43](../backend/src/app.controller.ts#L43) |
| `POST /webhooks/bank-verification` | Nhận kết quả xác minh ngân hàng từ hệ thống bên ngoài. | [backend/src/bank-verification/bank-verification-webhook.controller.ts:17](../backend/src/bank-verification/bank-verification-webhook.controller.ts#L17) |
| `POST /webhooks/didit` | Nhận kết quả xác minh danh tính Didit. | [backend/src/identity-verifications/didit-webhook.controller.ts:20](../backend/src/identity-verifications/didit-webhook.controller.ts#L20) |
| `POST /payments/payos/webhook` | Nhận sự kiện thanh toán PayOS. | [backend/src/payments/payments.controller.ts:26](../backend/src/payments/payments.controller.ts#L26) |
| `POST /iot/events` | Thiết bị/hệ thống IoT gửi sự kiện. | [backend/src/iot/iot.controller.ts:11](../backend/src/iot/iot.controller.ts#L11) |
| `POST /iot/telemetry` | Thiết bị gửi dữ liệu trạng thái. | [backend/src/iot/iot.controller.ts:17](../backend/src/iot/iot.controller.ts#L17) |
| `GET /iot/config` | Thiết bị lấy cấu hình. | [backend/src/iot/iot.controller.ts:22](../backend/src/iot/iot.controller.ts#L22) |

## 6. Giao diện đã chủ động gỡ (1 endpoint)

Ghi nhận trạng thái hiện tại, không đề nghị khôi phục ngoài yêu cầu.

| API | Chức năng / nhận xét | Bằng chứng trong source |
|---|---|---|
| `GET /admin/security/devices` | Backend vẫn giữ API Security Hub cho SUPER_ADMIN. Giao diện đã được gỡ theo yêu cầu trước đó của bạn. | [backend/src/devices/provisioning.controller.ts:128](../backend/src/devices/provisioning.controller.ts#L128) |

## 7. Đã dùng API ở nơi khác, nhưng module admin chưa nối dữ liệu thật

| Module | Hiện trạng | API đã có / giới hạn |
|---|---|---|
| Biểu đồ thống kê admin | `AdminDashboard.tsx:2201` truyền `data={[]}`; một số chỉ số vận hành trong tab được viết cố định. | `GET /analytics/dashboard` đã dùng ở StoreAnalyticsPage và backend cho phép admin. Có thể cung cấp đơn hàng, doanh thu, nút đang hoạt động và biểu đồ; không trả đủ mọi chỉ số như hài lòng khách hàng/thời gian giao trung bình đang hiển thị. |
| Theo dõi thiết bị admin | `AdminDashboard.tsx:532` khởi tạo danh sách telemetry bằng dữ liệu mẫu. | Đã có `GET /devices`, `GET /devices/:id/telemetry`, `GET /devices/fleet/stats`, đang được UI cửa hàng sử dụng. Cần kiểm tra phạm vi dữ liệu theo quyền trước khi nối vào admin. |
| Quản trị xác minh danh tính | Đã có UI cho khách hàng; chưa thấy UI quản trị các phiên của nhiều người dùng. | `GET /identity-verifications/sessions` đã được gọi phía khách hàng. Service hiện chỉ coi role literal `ADMIN` hoặc roles chứa `ADMIN` là quyền xem tất cả, không tự động coi `SUPER_ADMIN`/`SYSTEM_ADMIN` tương đương. |

Nguồn: [AdminDashboard](../src/pages/admin/AdminDashboard.tsx#L532), [StoreAnalyticsPage](../src/pages/store/StoreAnalyticsPage.tsx#L70), [AnalyticsService](../backend/src/analytics/analytics.service.ts#L9), [IdentityVerificationsService](../backend/src/identity-verifications/identity-verifications.service.ts#L157).

## 8. Các điểm cần làm rõ trước khi tích hợp

- **Gói dịch vụ cửa hàng:** đã có API đăng ký và xem gói hiện tại; chưa thấy endpoint danh mục gói cho chủ cửa hàng. `GET /admin/plans` đang dành cho admin, không thể mặc định dùng cho role chủ cửa hàng.
- **Ngân hàng:** UI ví đã cập nhật/tra cứu ngân hàng; trang tài chính đã lấy danh sách tài khoản. Phần còn thiếu là xác minh và quản lý nhiều tài khoản. Service kiểm tra sở hữu cửa hàng; ngoại lệ admin hiện kiểm tra literal `ADMIN`, cần rà lại quyền thực tế nếu tích hợp cho các role admin khác.
- **Ca giao hàng:** mở ca, xem ca hiện tại/lịch sử và đóng ca đã được UI gọi. Hai thao tác mở/đóng đi qua hàm chung `action(path) -> api.post(path)`, nên không tính là còn thiếu. Chỉ thao tác xác nhận bàn giao tiền chưa nối UI.
- **Thông báo:** chuông thông báo/socket và xin quyền Notification hiện có không thay thế đăng ký FCM token. Hai token endpoint chưa được UI gọi. API này cũng không phải API lưu cấu hình/mẫu thông báo admin.
- **Thuê nút:** phân biệt kích hoạt hợp đồng thuê với bật/tắt gói thuê. UI admin đã quản lý gói nhưng chưa dùng `activateRental` cho hợp đồng.

## 9. Phát hiện thêm theo chiều ngược lại

Ba lời gọi frontend sau chưa có route tương ứng trong các controller backend đang kiểm tra. Đây là vấn đề khác với “backend có nhưng UI chưa dùng”, cần đối chiếu bản backend đang triển khai trước khi kết luận lỗi thực tế.

| Frontend đang gọi | Nguồn | Nhận xét |
|---|---|---|
| `POST /auth/change-password` | [ProfilePage.tsx:303](../src/pages/profile/ProfilePage.tsx#L303) | Chưa thấy route trong AuthController. |
| `POST /payments/orders/:id/payment-method` | [payments.service.ts:60](../src/services/payments.service.ts#L60) | Có UI chọn phương thức thanh toán sử dụng service; chưa thấy route tương ứng trong PaymentsController. |
| `POST /rentals/:id/pay` | [rentals.service.ts:167](../src/services/rentals.service.ts#L167) | Service đang ghi trạng thái PAID vào localStorage và bỏ qua lỗi API. Hiển thị đã thanh toán ở trình duyệt chưa chứng minh backend ghi nhận thành công. |

## Kiểm chứng và thay đổi

- Đã quét cú pháp TypeScript để lấy route và lời gọi HTTP, kiểm tra tham chiếu service, kiểm tra các lời gọi động mở/đóng ca và bật/tắt thiết bị, đọc lại các controller/service liên quan.
- Kiểm tra đủ 62 mục, mỗi mục xuất hiện đúng một lần trong các nhóm 1–6.
- Không gọi API thật, không thao tác chi trả/xóa dữ liệu, không chạy build/test ứng dụng vì không thay đổi mã ứng dụng.
- Chỉ thêm báo cáo này; script kiểm kê tạm nằm trong `.cache` đã được git bỏ qua. Không sửa frontend/backend, không cập nhật handoff backend.
- Chưa kiểm chứng: API trên môi trường triển khai, hành vi theo từng tài khoản/quyền thật, Firebase/FCM/PayOS/Cloudinary/Didit/ngân hàng và trạng thái dữ liệu.
