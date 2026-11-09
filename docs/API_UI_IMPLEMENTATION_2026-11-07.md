# Bổ sung giao diện cho API hiện có — 07/11/2026

## Phạm vi

Triển khai frontend dựa trên [bản kiểm kê trước thay đổi](API_UI_GAPS_AUDIT_2026-11-07.md). Mã ứng dụng được đồng bộ ở `src` và `frontend/src`; các khác biệt sẵn có giữa hai cây nguồn được giữ khi tích hợp vào trang cũ.

Phần chỉnh sửa frontend không thêm endpoint, sửa controller/service backend hoặc database. Source HEAD hiện đã có cập nhật backend identity và cấp quyền admin từ thay đổi được lưu trong dự án; các thay đổi này được giữ nguyên khi sửa 429, không ghi đè. Chỉ bổ sung điều khiển cho API hiện có, sửa phần nối sai hợp đồng và xử lý lỗi có thể báo thành công giả. Security Hub vẫn được gỡ như yêu cầu trước đó.

## Màn hình và luồng đã nối

| Khu vực | Điểm vào giao diện | Luồng / dữ liệu |
|---|---|---|
| Chi trả admin | `/admin/payouts` | Danh sách rút tiền → xem người nhận/số tiền → xác nhận chuyển có chứng từ hoặc từ chối có lý do → tải lại bản ghi. Xem số dư PayOS, gửi lệnh chi từng yêu cầu, xem kết quả provider, chọn nhiều yêu cầu và ước tính trước khi gửi tuần tự. |
| Ngân hàng cửa hàng | `/store/finance` | Tra cứu tài khoản → xác nhận thông tin → tạo yêu cầu xác minh → giữ biên nhận/thời hạn → hủy hoặc tải trạng thái từ server. Tài khoản đã xác minh có chọn mặc định/xóa với xác nhận. Gói hiện tại tải độc lập khi ngân hàng bị lỗi. |
| Giao hàng | `/driver/deliveries` | Xem trạng thái trực và ca → xem đơn sẵn sàng/đơn của mình → nhận đơn → tải ảnh giao hàng → xác nhận giao thành công hoặc thất bại theo đúng DTO → đọc trạng thái thật và phát sự kiện đồng bộ đơn. Có danh sách người giao hàng đang trực theo cửa hàng. |
| Ca và tiền bàn giao | `/driver/shifts` | Đọc ca hiện tại/lịch sử, mở ca, kiểm tra lại đơn đang giao trước khi đóng ca. Xác nhận tiền bàn giao chỉ trên bản ghi ca CLOSED thực sự được trả về và đúng quyền. |
| Quản trị xác minh | `/admin/identity` | Các role admin được source hiện tại cho phép xem danh sách có phân trang → chi tiết → cập nhật quyết định → đọc lại dữ liệu; xóa có xác nhận và đợi Didit/backend thành công. |
| Kích hoạt hợp đồng | `/admin/rental-activation` | Các role admin được guard hiện tại cho phép nhập mã hợp đồng từ hồ sơ → xác nhận → backend kiểm tra điều kiện → chỉ báo thành công khi phản hồi là ACTIVE. |
| Báo cáo admin | Tab `ANALYTICS` | Lấy `/analytics/dashboard`, hiển thị đơn hàng/doanh thu/nút hoạt động và biểu đồ thật; bỏ các KPI vận hành viết cố định trong tab này. Biểu đồ chỉ tải khi cần. |
| Thiết bị admin | Tab `TELEMETRY` | Danh sách thiết bị API, tìm kiếm/phân trang trình duyệt, tải riêng chi tiết khi bấm. Giá trị telemetry mẫu từ backend được ghi rõ là minh họa, không gọi là lịch sử đo thật. |
| Gỡ sản phẩm khỏi nút | Modal gán sản phẩm ở `/store/devices` | Xác nhận gỡ → DELETE → GET kiểm tra thiết bị không còn sản phẩm → chờ tải lại danh sách. Khi DELETE đã thành công nhưng đọc lại lỗi, chỉ thử đọc lại, không gửi DELETE lần hai. |
| Liên kết thanh toán | Modal thanh toán đơn hàng hiện có | Xem giao dịch bằng paymentTransactionId thật. Hủy riêng liên kết: kiểm tra provider còn PENDING → xác nhận → hủy → đọc lại provider/đơn hàng và cập nhật bằng dữ liệu chính thức. Không hủy đơn hoặc đổi COD ngầm. |
| Thêm nút bằng mã | `/customer/pair-device` | Nhập mã/QR hoặc camera tải khi cần → kiểm tra thiết bị chưa có chủ → tạo phiên → dữ liệu cửa hàng/sản phẩm thật → verify phiên → confirmation → GET xác nhận chủ và sản phẩm → phát sự kiện làm mới danh sách. Không bootstrap phần cứng từ trình duyệt và không giả trạng thái online. |
| Chi tiết xác minh khách | `/customer/verification` | Bấm xem phiên gần nhất → GET chi tiết → kiểm tra đúng người sở hữu → hiển thị trường an toàn trong dialog. Không phơi số giấy tờ hay URL nội bộ của provider. |
| Điện thoại | `/phone-auth`, liên kết từ đăng nhập/đăng ký/hồ sơ | SDK Firebase tải khi bấm gửi mã; OTP thật → Firebase credential → API login/register/verify. Chuẩn hóa `userId` của backend trước khi đưa vào AuthContext; chỉ đăng ký CUSTOMER. |
| Thông báo đẩy | Hồ sơ → Thông báo | Xin quyền khi người dùng bấm → đăng ký worker/get token → API lưu token. Hủy đăng ký có kiểm tra kết quả. JWT từng thao tác được chụp theo phiên, dừng khi thay tài khoản, đồng bộ chủ token giữa các tab và cleanup logout có giới hạn thời gian. |

Điểm vào mới được tải theo route. Quyền cần đối chiếu cả RolesGuard và kiểm tra sở hữu trong service, không chỉ decorator controller: RolesGuard hiện có ngoại lệ cho các role admin; service ngân hàng vẫn có kiểm tra sở hữu riêng. Các trang giao hàng có mũi tên quay lại và liên kết qua ca/giao hàng. Quyền trên bản backend deploy chưa được kiểm chứng với tài khoản thật.

## Thiết kế và khả năng sử dụng

- Theo màu xanh, nền trắng/zinc, kiểu chữ và dark mode hiện tại; không thêm thư viện UI hoặc một bộ giao diện khác.
- Bố cục responsive, nhãn rõ, số tiền dễ đối chiếu, trạng thái tải/lỗi/rỗng, khóa nút trong khi gửi. Các vùng tải độc lập khi endpoint khác bị lỗi.
- Thao tác tiền, xóa hoặc gỡ liên kết có xác nhận; không tự retry mutation khi phản hồi chưa chắc chắn.
- Dialog dùng focus/Escape/restore focus; thông báo có role phù hợp. Motion vào trang/panel ngắn, có hỗ trợ reduced motion. Camera, Firebase và biểu đồ không nằm trong gói khởi động chính.

## Các sửa lỗi liên quan đến tính đúng của luồng

- Driver service dùng đúng ONLINE/OFFLINE và các trường kết quả giao hàng/backend failure enum; đọc đúng envelope `orders`, `shifts`, pagination.
- Danh sách hợp đồng thuê lấy trạng thái server, không ghi đè bằng PAID trong localStorage. Bỏ mã QR thanh toán giả. Khi chưa có API thanh toán thuê, giao diện giải thích rõ và chỉ kiểm tra trạng thái chính thức.
- Xử lý đăng nhập qua điện thoại nhận được cả `user.id` và `user.userId`.
- Phone verification là API cần JWT và có thể refresh khi cần.
- Log 429 được xử lý trong [báo cáo riêng về refresh/WebSocket](REQUEST_RECOVERY_2026-11-07.md): không refresh vì lỗi kết nối thuần túy, dùng một refresh đang chạy và thời gian chờ chung theo Retry-After.

## Điều kiện backend hoặc cấu hình còn thiếu

| Điều kiện | Cách xử lý hiện tại / giới hạn |
|---|---|
| Firebase Web chưa cấu hình | Người dùng đã xác nhận sẽ cấu hình sau. Giao diện báo chưa bật; không xin OTP hoặc tuyên bố nhận push thật. |
| Danh mục gói cho chủ cửa hàng | Chưa có endpoint phù hợp. Không gọi `/admin/plans` bằng role cửa hàng hoặc tạo gói/giá giả; đăng ký gói trả tiền chưa mở. |
| Người nhận tiền xác minh ngân hàng | Create verification không trả tài khoản nhận/BIN/QR và chưa có API liệt kê yêu cầu pending. Giữ biên nhận ở trình duyệt, không tạo hướng dẫn chuyển tiền giả. Luồng hoàn tất xác minh cần backend cung cấp đủ thông tin. |
| Tài khoản mặc định và ví cũ | Backend có hai mô hình dữ liệu; mặc định ở registry không bảo đảm đồng bộ trường ngân hàng legacy trên ví hoặc lựa chọn đích rút tiền. UI không giả đồng bộ hai mô hình. |
| Chi PayOS theo lô | Raw batch API chỉ proxy provider, không claim/ghi nhận withdrawal. Không dùng nó để chi từ danh sách rút tiền. UI gửi từng yêu cầu qua endpoint có kiểm soát atomic và ghi kết quả từng dòng. |
| Sync chi trả / hủy liên kết | Endpoint sync chỉ đọc provider; hủy link chưa cập nhật transaction local. Hiển thị riêng kết quả provider và trạng thái server, không tự sửa sổ tiền/đơn trên client. |
| Thanh toán hợp đồng thuê | Chưa có controller `/rentals/:id/pay`. Không báo PAID/ACTIVE giả; còn thiếu tích hợp thanh toán backend để hoàn tất vòng đời thuê trực tuyến. |
| Quản trị hợp đồng | Chưa có danh sách/chi tiết hợp đồng cho admin. Màn hình kích hoạt sử dụng mã từ hồ sơ và kiểm tra điều kiện backend, không tạo danh sách giả. |
| Ca toàn cửa hàng | History API chỉ trả ca của người hiện tại. Không có màn hình xác nhận mù bằng mã ca của tài xế khác; cần API danh sách/chi tiết ca theo cửa hàng. |
| Telemetry | `/devices/:id/telemetry` hiện trả snapshot pin/RSSI cố định. Chưa xác nhận dữ liệu đo thật hoặc lịch sử. |
| QR ghép nối / sở hữu | QR cũ có thể thiếu token; cần mã re-pair đầy đủ. Confirmation không trả cloud-ready. Backend chưa kiểm tra owner hiện tại trong transaction trước overwrite; preflight frontend không thay thế việc chống race giữa nhiều client ở backend. |
| Các route frontend thiếu backend khác | `/auth/change-password` và `/payments/orders/:id/payment-method` vẫn cần đối chiếu với bản triển khai; không thêm endpoint hoặc thay đổi quy tắc backend trong task này. |

Không thêm UI cho webhook, health, endpoint dành cho thiết bị gửi sự kiện, Security Hub đã gỡ, hoặc mọi đường dẫn alias tương thích chỉ để dùng hết endpoint. Upload ảnh hiện có vẫn qua server; signed upload/direct asset destroy chưa được biến thành màn hình độc lập vì là phương án kỹ thuật hoặc cần ngữ cảnh tài nguyên phù hợp.

## Cấu hình Firebase sau này

Đặt các giá trị Web public config trong môi trường build của cả cách chạy root và `frontend`:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_VAPID_KEY
```

Dùng cùng project backend, bật Phone Authentication/authorized domains và cấu hình Web Push phù hợp; không đưa service account hoặc private key vào VITE_*. SDK Firebase 13.2.0 được thêm vào cả hai manifest/lockfile và chỉ tải khi dùng tính năng.

Tài liệu chính thức đã đối chiếu: [Phone Authentication](https://firebase.google.com/docs/auth/web/phone-auth), [Web FCM](https://firebase.google.com/docs/cloud-messaging/web/get-started), [nhận thông báo/worker](https://firebase.google.com/docs/cloud-messaging/web/receive-messages).

## Kiểm thử đã chạy

| Kiểm tra | Kết quả |
|---|---|
| `node --experimental-strip-types --test tests/*.test.mjs` | 127/127 PASS |
| `node --experimental-strip-types --test frontend/tests/*.test.mjs frontend/tests/*.test.ts` | 270/270 PASS |
| `npm.cmd run build` tại root | PASS |
| `npm.cmd run build` tại `frontend` | PASS |
| `git diff --check` | PASS |
| Cấu hình watcher Vite ở cả hai thư mục | PASS — bỏ theo dõi dist và cache |
| Kiểm tra hình ảnh/trình duyệt ở nhiều độ rộng | Chưa hoàn tất: Computer Use không có native pipe/browser host; harness headless cục bộ không tạo được kết quả/screenshot xác nhận. Không coi responsive trên mọi thiết bị là đã được chứng minh. |

Các test mới kiểm tra hành vi source với transport giả lập: lỗi 200/success:false, timeout, thao tác lặp, kết quả không chắc chắn, tải độc lập, scope theo role/phiên, phản hồi cũ, tiền COD, provider/local khác nhau, ghép nối hết hạn/đã có chủ, Retry-After và dọn timer. Không dùng test để chuyển tiền, xóa dữ liệu hay gửi SMS/FCM thật.

Chưa kiểm chứng đầu-cuối trên backend deploy, tài khoản production và thiết bị IoT thật. Các kiểm tra giả lập/build không chứng minh dịch vụ bên ngoài hay database triển khai đang hoạt động đúng.

## Danh sách file

Danh sách chi tiết được ghi bên dưới sau khi rà git diff; `.cache` chỉ chứa log/harness kiểm thử cục bộ đã được git bỏ qua.



<!-- GENERATED FILE INVENTORY -->

Các module UI đã được lưu trong HEAD cùng các file đang sửa cho 429 được liệt kê chung dưới đây; danh sách này không quy các thay đổi backend identity trong HEAD cho bản sửa frontend 429.

| Module root | Bản frontend tương ứng |
|---|---|
| [src/App.tsx](../src/App.tsx) | [frontend/src/App.tsx](../frontend/src/App.tsx) |
| [src/components/customer/CustomerVerificationDetails.tsx](../src/components/customer/CustomerVerificationDetails.tsx) | [frontend/src/components/customer/CustomerVerificationDetails.tsx](../frontend/src/components/customer/CustomerVerificationDetails.tsx) |
| [src/components/customer/customer-verification-details.mjs](../src/components/customer/customer-verification-details.mjs) | [frontend/src/components/customer/customer-verification-details.mjs](../frontend/src/components/customer/customer-verification-details.mjs) |
| [src/components/devices/DeviceProductRemoval.tsx](../src/components/devices/DeviceProductRemoval.tsx) | [frontend/src/components/devices/DeviceProductRemoval.tsx](../frontend/src/components/devices/DeviceProductRemoval.tsx) |
| [src/components/operations/PushNotificationSettings.tsx](../src/components/operations/PushNotificationSettings.tsx) | [frontend/src/components/operations/PushNotificationSettings.tsx](../frontend/src/components/operations/PushNotificationSettings.tsx) |
| [src/components/operations/WorkflowUI.tsx](../src/components/operations/WorkflowUI.tsx) | [frontend/src/components/operations/WorkflowUI.tsx](../frontend/src/components/operations/WorkflowUI.tsx) |
| [src/components/orders/OrderSuccessModal.tsx](../src/components/orders/OrderSuccessModal.tsx) | [frontend/src/components/orders/OrderSuccessModal.tsx](../frontend/src/components/orders/OrderSuccessModal.tsx) |
| [src/components/orders/PaymentRequestTools.tsx](../src/components/orders/PaymentRequestTools.tsx) | [frontend/src/components/orders/PaymentRequestTools.tsx](../frontend/src/components/orders/PaymentRequestTools.tsx) |
| [src/components/orders/payment-request-tools.mjs](../src/components/orders/payment-request-tools.mjs) | [frontend/src/components/orders/payment-request-tools.mjs](../frontend/src/components/orders/payment-request-tools.mjs) |
| [src/context/AuthContext.tsx](../src/context/AuthContext.tsx) | [frontend/src/context/AuthContext.tsx](../frontend/src/context/AuthContext.tsx) |
| [src/layouts/Navbar.tsx](../src/layouts/Navbar.tsx) | [frontend/src/layouts/Navbar.tsx](../frontend/src/layouts/Navbar.tsx) |
| [src/layouts/Sidebar.tsx](../src/layouts/Sidebar.tsx) | [frontend/src/layouts/Sidebar.tsx](../frontend/src/layouts/Sidebar.tsx) |
| [src/pages/admin/AdminDashboard.tsx](../src/pages/admin/AdminDashboard.tsx) | [frontend/src/pages/admin/AdminDashboard.tsx](../frontend/src/pages/admin/AdminDashboard.tsx) |
| [src/pages/admin/AdminIdentityPage.tsx](../src/pages/admin/AdminIdentityPage.tsx) | [frontend/src/pages/admin/AdminIdentityPage.tsx](../frontend/src/pages/admin/AdminIdentityPage.tsx) |
| [src/pages/admin/AdminLiveData.tsx](../src/pages/admin/AdminLiveData.tsx) | [frontend/src/pages/admin/AdminLiveData.tsx](../frontend/src/pages/admin/AdminLiveData.tsx) |
| [src/pages/admin/AdminPayoutsPage.tsx](../src/pages/admin/AdminPayoutsPage.tsx) | [frontend/src/pages/admin/AdminPayoutsPage.tsx](../frontend/src/pages/admin/AdminPayoutsPage.tsx) |
| [src/pages/admin/AdminRentalActivationPanel.tsx](../src/pages/admin/AdminRentalActivationPanel.tsx) | [frontend/src/pages/admin/AdminRentalActivationPanel.tsx](../frontend/src/pages/admin/AdminRentalActivationPanel.tsx) |
| [src/pages/admin/AdminWorkflowDialog.tsx](../src/pages/admin/AdminWorkflowDialog.tsx) | [frontend/src/pages/admin/AdminWorkflowDialog.tsx](../frontend/src/pages/admin/AdminWorkflowDialog.tsx) |
| [src/pages/admin/admin-workflows.mjs](../src/pages/admin/admin-workflows.mjs) | [frontend/src/pages/admin/admin-workflows.mjs](../frontend/src/pages/admin/admin-workflows.mjs) |
| [src/pages/auth/AuthPage.tsx](../src/pages/auth/AuthPage.tsx) | [frontend/src/pages/auth/AuthPage.tsx](../frontend/src/pages/auth/AuthPage.tsx) |
| [src/pages/auth/PhoneAuthPage.tsx](../src/pages/auth/PhoneAuthPage.tsx) | [frontend/src/pages/auth/PhoneAuthPage.tsx](../frontend/src/pages/auth/PhoneAuthPage.tsx) |
| [src/pages/customer/CustomerRentalsPage.tsx](../src/pages/customer/CustomerRentalsPage.tsx) | [frontend/src/pages/customer/CustomerRentalsPage.tsx](../frontend/src/pages/customer/CustomerRentalsPage.tsx) |
| [src/pages/customer/DevicePairingPage.tsx](../src/pages/customer/DevicePairingPage.tsx) | [frontend/src/pages/customer/DevicePairingPage.tsx](../frontend/src/pages/customer/DevicePairingPage.tsx) |
| [src/pages/customer/device-pairing.mjs](../src/pages/customer/device-pairing.mjs) | [frontend/src/pages/customer/device-pairing.mjs](../frontend/src/pages/customer/device-pairing.mjs) |
| [src/pages/operations/DriverDeliveryPage.tsx](../src/pages/operations/DriverDeliveryPage.tsx) | [frontend/src/pages/operations/DriverDeliveryPage.tsx](../frontend/src/pages/operations/DriverDeliveryPage.tsx) |
| [src/pages/operations/DriverShiftManagement.tsx](../src/pages/operations/DriverShiftManagement.tsx) | [frontend/src/pages/operations/DriverShiftManagement.tsx](../frontend/src/pages/operations/DriverShiftManagement.tsx) |
| [src/pages/operations/DriverWorkflowUI.tsx](../src/pages/operations/DriverWorkflowUI.tsx) | [frontend/src/pages/operations/DriverWorkflowUI.tsx](../frontend/src/pages/operations/DriverWorkflowUI.tsx) |
| [src/pages/operations/OperationsPages.tsx](../src/pages/operations/OperationsPages.tsx) | [frontend/src/pages/operations/OperationsPages.tsx](../frontend/src/pages/operations/OperationsPages.tsx) |
| [src/pages/profile/ProfilePage.tsx](../src/pages/profile/ProfilePage.tsx) | [frontend/src/pages/profile/ProfilePage.tsx](../frontend/src/pages/profile/ProfilePage.tsx) |
| [src/pages/store/StoreDevicesPage.tsx](../src/pages/store/StoreDevicesPage.tsx) | [frontend/src/pages/store/StoreDevicesPage.tsx](../frontend/src/pages/store/StoreDevicesPage.tsx) |
| [src/pages/store/StoreFinancePage.tsx](../src/pages/store/StoreFinancePage.tsx) | [frontend/src/pages/store/StoreFinancePage.tsx](../frontend/src/pages/store/StoreFinancePage.tsx) |
| [src/services/api.ts](../src/services/api.ts) | [frontend/src/services/api.ts](../frontend/src/services/api.ts) |
| [src/services/device-product-removal.ts](../src/services/device-product-removal.ts) | [frontend/src/services/device-product-removal.ts](../frontend/src/services/device-product-removal.ts) |
| [src/services/driver-workflow.ts](../src/services/driver-workflow.ts) | [frontend/src/services/driver-workflow.ts](../frontend/src/services/driver-workflow.ts) |
| [src/services/drivers.service.ts](../src/services/drivers.service.ts) | [frontend/src/services/drivers.service.ts](../frontend/src/services/drivers.service.ts) |
| [src/services/firebase-messaging-worker.ts](../src/services/firebase-messaging-worker.ts) | [frontend/src/services/firebase-messaging-worker.ts](../frontend/src/services/firebase-messaging-worker.ts) |
| [src/services/firebase-push.ts](../src/services/firebase-push.ts) | [frontend/src/services/firebase-push.ts](../frontend/src/services/firebase-push.ts) |
| [src/services/firebase-web.ts](../src/services/firebase-web.ts) | [frontend/src/services/firebase-web.ts](../frontend/src/services/firebase-web.ts) |
| [src/services/phone-auth-flow.ts](../src/services/phone-auth-flow.ts) | [frontend/src/services/phone-auth-flow.ts](../frontend/src/services/phone-auth-flow.ts) |
| [src/services/rentals.service.ts](../src/services/rentals.service.ts) | [frontend/src/services/rentals.service.ts](../frontend/src/services/rentals.service.ts) |
| [src/services/request-backoff.ts](../src/services/request-backoff.ts) | [frontend/src/services/request-backoff.ts](../frontend/src/services/request-backoff.ts) |
| [src/services/socket.ts](../src/services/socket.ts) | [frontend/src/services/socket.ts](../frontend/src/services/socket.ts) |
| [src/services/store-finance-flow.ts](../src/services/store-finance-flow.ts) | [frontend/src/services/store-finance-flow.ts](../frontend/src/services/store-finance-flow.ts) |
| [src/services/web-push-state.ts](../src/services/web-push-state.ts) | [frontend/src/services/web-push-state.ts](../frontend/src/services/web-push-state.ts) |
| [src/types/index.ts](../src/types/index.ts) | [frontend/src/types/index.ts](../frontend/src/types/index.ts) |
| [src/utils/workflow.ts](../src/utils/workflow.ts) | [frontend/src/utils/workflow.ts](../frontend/src/utils/workflow.ts) |
| [src/vite-env.d.ts](../src/vite-env.d.ts) | [frontend/src/vite-env.d.ts](../frontend/src/vite-env.d.ts) |

Các file cấu hình, kiểm thử và tài liệu:

- [backend/SESSION_HANDOFF.md](../backend/SESSION_HANDOFF.md)
- [docs/API_UI_GAPS_AUDIT_2026-11-07.md](../docs/API_UI_GAPS_AUDIT_2026-11-07.md)
- [docs/API_UI_IMPLEMENTATION_2026-11-07.md](../docs/API_UI_IMPLEMENTATION_2026-11-07.md)
- [docs/REQUEST_RECOVERY_2026-11-07.md](../docs/REQUEST_RECOVERY_2026-11-07.md)
- [frontend/package-lock.json](../frontend/package-lock.json)
- [frontend/package.json](../frontend/package.json)
- [frontend/tests/admin-presentation.test.mjs](../frontend/tests/admin-presentation.test.mjs)
- [frontend/tests/admin-workflows.test.mjs](../frontend/tests/admin-workflows.test.mjs)
- [frontend/tests/customer-verification-details.test.mjs](../frontend/tests/customer-verification-details.test.mjs)
- [frontend/tests/delivery-workflow.test.mjs](../frontend/tests/delivery-workflow.test.mjs)
- [frontend/tests/device-pairing.test.mjs](../frontend/tests/device-pairing.test.mjs)
- [frontend/tests/device-product-removal.test.mjs](../frontend/tests/device-product-removal.test.mjs)
- [frontend/tests/google-login.test.mjs](../frontend/tests/google-login.test.mjs)
- [frontend/tests/payment-request-tools.test.mjs](../frontend/tests/payment-request-tools.test.mjs)
- [frontend/tests/store-finance-flow.test.mjs](../frontend/tests/store-finance-flow.test.mjs)
- [frontend/tests/web-push-flow.test.mjs](../frontend/tests/web-push-flow.test.mjs)
- [frontend/vite.config.ts](../frontend/vite.config.ts)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [tests/api-rate-limit-recovery.test.mjs](../tests/api-rate-limit-recovery.test.mjs)
- [tests/delivery-workflow.test.mjs](../tests/delivery-workflow.test.mjs)
- [tests/device-product-removal.test.mjs](../tests/device-product-removal.test.mjs)
- [tests/phone-auth-flow.test.mjs](../tests/phone-auth-flow.test.mjs)
- [tests/rental-payment-integrity.test.mjs](../tests/rental-payment-integrity.test.mjs)
- [tests/store-finance-flow.test.mjs](../tests/store-finance-flow.test.mjs)
- [tests/store-page-loading.test.mjs](../tests/store-page-loading.test.mjs)
- [tests/web-push-flow.test.mjs](../tests/web-push-flow.test.mjs)
- [vite.config.ts](../vite.config.ts)

Bản kiểm kê API ban đầu là tài liệu có sẵn từ bước review trước; task này thêm liên kết sang báo cáo triển khai. Khác biệt gốc giữa hai frontend như profile/auth/navbar/customer pages không bị sao chép đè toàn trang.
