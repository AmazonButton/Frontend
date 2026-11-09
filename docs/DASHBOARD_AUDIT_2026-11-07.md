# Rà soát số liệu dashboard ba role — 07/11/2026

Phạm vi: frontend của quản trị viên, chủ cửa hàng và khách hàng. Đã đối chiếu route trong `src/App.tsx` và bản tương ứng ở `frontend/src/App.tsx` với các component thực tế, đọc hợp đồng API backend để đối chiếu. Không sửa backend, API, cơ sở dữ liệu, quy trình thanh toán hoặc chuyển trạng thái đơn hàng.

## Kết quả theo màn hình

| Role / route | Ô thống kê và cách cập nhật |
| --- | --- |
| Admin `/admin/dashboard` | Sửa tên trường: `activeButtons` → thiết bị hoạt động, `totalButtons` → tổng thiết bị, `totalGmv` → giá trị đơn xác nhận / đã giao. Tổng cửa hàng và đơn hàng dùng `totalStores`, `totalOrders`. Số chờ duyệt lấy danh sách pending. |
| Admin `?section=ANALYTICS` | Định dạng số / tiền từ `/analytics/dashboard`; trường thiếu hiển thị `—`. Ghi rõ doanh số tạm tính chưa phải tiền đã thu. |
| Admin `/admin/payouts` | Kiểm tra bộ đếm và tổng tiền yêu cầu pending; bổ sung tải nền, tạm dừng khi mở xác nhận hoặc đang xử lý lệnh chi. Không gửi lệnh chi tự động. |
| Chủ cửa hàng `/store/dashboard` | Cộng tiền dạng số; loại đơn hủy / từ chối khỏi doanh số tạm tính. Chưa tải thành công hiển thị `—`, lỗi tải lại giữ đơn cũ và báo chưa cập nhật. Luồng xử lý đơn giữ nguyên. |
| Chủ cửa hàng `/store/analytics` | Tổng đơn, doanh số, tỷ lệ hoàn tất, giá trị trung bình và thiết bị phát sinh đơn tính từ dữ liệu thật trong kỳ đã chọn. Đếm `DELIVERED` là hoàn tất. Bỏ biểu đồ, phân loại, sản phẩm, số đơn thiết bị và tăng trưởng `+16.8%` giả. Lỗi một nguồn không xóa các nguồn đã tải. |
| Chủ cửa hàng `/store/devices` | Tổng, hoạt động, chưa hoạt động, pin yếu, chưa gán sản phẩm cùng tính từ danh sách thiết bị đang hiển thị. Không đọc những trường không tồn tại của fleet stats; giảm một GET mỗi lần tải. Không gọi trạng thái ACTIVE là heartbeat trực tuyến hoặc deep sleep. |
| Chủ cửa hàng `/store/products` | Tổng sản phẩm, tồn kho, giữ chỗ và cảnh báo dùng danh sách API. Ngưỡng cảnh báo bằng 0 được giữ đúng. Tải lỗi giữ dữ liệu cũ; phản hồi đã lỗi thời không ghi đè. |
| Chủ cửa hàng `/store/wallet` | Số dư khả dụng / chờ rút dùng trường thực tế; thiếu trường không biến thành 0. Tải nền không thay tài khoản ngân hàng người dùng đang nhập, tạm dừng trong lúc xử lý nghiệp vụ. |
| Khách hàng `/customer/home` | Thiết bị hoạt động chỉ đếm ACTIVE/ONLINE; pin trung bình không tự điền 93%. Tải riêng các nguồn, giữ phần đã tải nếu nguồn khác lỗi. Giữ nguyên cơ chế polling/socket hiện có. |
| Khách hàng `/customer/orders` | Bộ đếm tổng / đang xử lý / đã giao tính nhất quán; thêm READY_FOR_DELIVERY vào nhóm đang xử lý và DELIVERED vào nhóm hoàn tất. Không đổi trạng thái gốc hoặc thao tác hủy đơn. |

Các ô chưa có dữ liệu hiển thị `—`; số 0 hợp lệ vẫn hiển thị 0. Khi cập nhật thất bại sau một lần tải thành công, giữ kết quả cũ và thông báo chưa cập nhật để không nhầm là số liệu vừa lấy từ máy chủ.

Tự cập nhật bổ sung chỉ chạy trên trang đang hiển thị, gộp sự kiện dồn dập, có khoảng cách tối thiểu giữa các lượt và tuân thủ thời gian chờ HTTP 429. Những trang đã có event handler dùng polling dự phòng 30 giây; không đăng ký trùng các event handler đó. Admin tải nền chỉ đọc thống kê chung và nguồn của phần đang xem. Trang chủ khách hàng và đơn trực tiếp cửa hàng giữ cơ chế cập nhật sẵn có. Không sửa animation.

## File thay đổi trong đợt này

Mỗi đường dẫn dưới đây được cập nhật ở **cả `src/` và `frontend/src/`**, giữ các khác biệt sẵn có giữa hai cây source:

- `pages/admin/AdminDashboard.tsx`
- `pages/admin/AdminLiveData.tsx`
- `pages/admin/AdminPayoutsPage.tsx`
- `pages/store/StoreDashboard.tsx`
- `pages/store/StoreAnalyticsPage.tsx`
- `pages/store/StoreDevicesPage.tsx`
- `pages/store/StoreProductsPage.tsx`
- `pages/store/StoreWalletPage.tsx`
- `pages/customer/CustomerHomePage.tsx`
- `pages/customer/CustomerOrdersPage.tsx`
- `services/dashboard-metrics.ts` (mới): chuẩn hóa và tính số liệu hiển thị, đọc độc lập nguồn admin.
- `hooks/useDashboardRefresh.ts` (mới): cơ chế tự cập nhật dự phòng.

Kiểm thử mới: `tests/dashboard-metrics.test.mjs`, `tests/dashboard-refresh.test.mjs`, `tests/dashboard-loaders.test.mjs`.

Kiểm thử cập nhật mock theo import/state mới: `frontend/tests/admin-presentation.test.mjs`, `frontend/tests/admin-security-hub-removal.test.mjs`, `frontend/tests/store-status-update.test.mjs`. Các khẳng định kiểm tra luồng cũ được giữ; thêm kiểm tra lỗi tải dashboard. File báo cáo này cũng được thêm mới.

Các thay đổi HTTP 429, auth, socket, Vite và các báo cáo bàn giao khác đã có trong working tree trước đợt dashboard này; không phải thay đổi mới của đợt này.

## Kiểm chứng

- `node --experimental-strip-types --test tests/*.test.mjs`: **155/155 đạt**.
- `node --experimental-strip-types --test frontend/tests/*.test.mjs frontend/tests/*.test.ts`: **272/272 đạt**.
- Tổng **427 kiểm thử đạt**, gồm 30 kiểm thử bổ sung cho số liệu, partial API failure, dữ liệu lỗi thời, giữ form khi tải nền, gộp sự kiện và thời gian chờ 429.
- `npm run build` tại root: đạt, gồm TypeScript và Vite production build.
- `npm run build` tại `frontend/`: đạt, gồm TypeScript và Vite production build.
- Đối chiếu AST với HEAD: **186 hàm xử lý có tên `handle*` / `confirm*` giữ nguyên nội dung** trên 10 component ở hai cây source. Bộ kiểm thử chuyển trạng thái, thanh toán, ngân hàng và giao hàng vẫn đạt.
- `git diff --check`: đạt. `git status --porcelain -- backend`: rỗng.

Kiểm thử dùng dữ liệu có kiểm soát và thực thi các hàm thực tế của frontend. Chưa đối soát số liệu bằng tài khoản thật trên máy chủ đang triển khai; chưa kiểm thử trực quan trên trình duyệt / điện thoại trong đợt này. Build thành công không thay thế kiểm thử E2E với API thật.

## Các điểm cần backend xác nhận / xử lý — chưa sửa backend

1. `/admin/stats.totalGmv` hiện chỉ cộng đơn có trạng thái hiện tại CONFIRMED hoặc DELIVERED. Các bước PREPARING, READY_FOR_DELIVERY, SHIPPING không được tính. Đây chưa phải doanh thu đã thanh toán; chuyển bước xử lý có thể làm tổng thay đổi dù giá trị đơn không đổi. Frontend đã ghi nhãn theo đúng tập trạng thái hiện tại. Nếu cần doanh thu đã thu / GMV ổn định, backend cần cung cấp định nghĩa và số tổng tương ứng, dựa trên thanh toán thực tế.
2. `/analytics/dashboard.totalRevenue` loại CANCELLED/REJECTED nhưng chưa yêu cầu đã thanh toán; `chartData` hiện cộng cả đơn hủy / từ chối. Vì vậy không thể dùng hai giá trị làm cùng một KPI hoặc số tiền thực nhận. Cần backend thống nhất điều kiện tổng hợp giữa biểu đồ và các ô, đồng thời công bố phạm vi tài khoản / thời gian.
3. API thiết bị hiện điền pin 98 khi thiếu dữ liệu; telemetry trả giá trị minh họa pin/Wi-Fi. Frontend đã bỏ giá trị pin dự phòng tự tạo, nhưng không thể phân biệt 98 do máy chủ điền với số đo thật. Backend cần trả `null` khi chưa đo, dữ liệu telemetry thực và thời điểm đo. Trước khi có việc này, chưa thể cam kết KPI pin phản ánh phần cứng thực tế.
4. Thiết bị ACTIVE hiện biểu thị trạng thái trong cơ sở dữ liệu. Muốn KPI trực tuyến thực tế cần backend cung cấp trạng thái kết nối / last seen có tiêu chí thời gian rõ ràng. Frontend hiện chỉ ghi “đang hoạt động theo trạng thái hệ thống”.

Không tự tạo bản vá backend hoặc bỏ kiểm tra phân quyền để khắc phục các giới hạn trên.
