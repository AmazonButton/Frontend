# Customer Account UI/UX — báo cáo triển khai

Ngày: 07/11/2026. Phạm vi: presentation và điều hướng của role CUSTOMER trong SmartOrder Button.

## 1. Audit và quyết định thiết kế

- Sidebar và thanh tab ngang cùng dẫn tới thiết bị/đơn hàng/tài khoản, tạo hai lớp điều hướng. Trang tài khoản còn có điểm đăng xuất trong khi avatar dropdown đã có xác nhận đăng xuất.
- Avatar chưa có tên/vai trò cạnh ảnh; nhóm thao tác và phần thông tin liên hệ chưa được tách rõ. Banner điện thoại chiếm vị trí đầu tiên và chưa phản ánh được tình trạng thiếu dữ liệu xác minh.
- Một số label của form chưa liên kết input. File input bị `display: none`, khó truy cập bằng bàn phím.
- `/profile` là đường dẫn tương thích dùng cho nhiều role; nhánh CUSTOMER trước đây không có sidebar. Cần dùng shell hiện có cho nhánh này để các mục tài khoản vẫn truy cập được khi bỏ tab ngang.
- `/customer/verification` đã chuyển tới eKYC trong thông tin cá nhân từ task trước. Giữ hành vi này; theo yêu cầu điều hướng trong prompt mới, sidebar có lối tắt eKYC dẫn qua route hiện hữu.
- Component profile, Sidebar và shell dùng chung với Store Owner/Admin. Mọi phần trình bày mới được giới hạn bằng điều kiện CUSTOMER hoặc selector `.customer-profile`.

## 2. Thay đổi đã thực hiện

### Điều hướng

- Nhóm **Tài khoản** có ba mục con: Thông tin cá nhân, Địa chỉ đã lưu, Bảo mật & Đổi mật khẩu.
- Tự mở khi vào tài khoản; trạng thái active nhẹ ở cha và active chính xác ở một mục con. Hỗ trợ query bổ sung mà vẫn nhận đúng tab.
- Chevron, transition 180ms, `aria-expanded`, `aria-controls`, `aria-current`, focus ring và xử lý Escape để đóng nhóm/đưa focus về nút cha. Tôn trọng reduced motion.
- Khi sidebar thu gọn, nút Tài khoản mở sidebar bằng callback hiện có. Menu mobile sử dụng cùng nhóm, ID riêng và callback đóng menu sau khi chọn.
- Bỏ thanh tab ngang và điểm đăng xuất tại nội dung **chỉ với CUSTOMER**. Giữ các state/component liên quan để các role và đường dẫn tương thích vẫn hoạt động.
- Đăng xuất dùng nguyên avatar dropdown, divider, modal xác nhận và callback đang có. Không sửa file Navbar.

### Nội dung

- Container tối đa 960px, căn giữa; title 24–28px và mô tả 14px. Dùng nút Quay lại hiện có, không thêm breadcrumb trùng lặp.
- Thẻ người dùng gồm avatar 64px, tên, vai trò, kết nối đại lý khi có dữ liệu thật và thao tác ảnh. Thao tác ảnh giữ nguyên callback, preview, giới hạn 2MB và sự kiện đồng bộ header.
- File input vẫn có `accept="image/*"`; dùng `sr-only` cho CUSTOMER để có thể focus bằng bàn phím. Label có focus-within.
- Banner điện thoại gọn, thông điệp trung tính nếu chưa có trạng thái đáng tin cậy. Chỉ hiện “đã xác minh” khi user cung cấp `phoneVerified === true` hoặc timestamp `phoneVerifiedAt` hợp lệ; không suy ra từ số điện thoại có giá trị.
- Biểu mẫu liên hệ nằm trong card riêng, grid hai cột và chuyển một cột ở ≤767px. Label liên kết input/textarea; email và vai trò vẫn disabled.
- Địa chỉ toàn chiều ngang; thông tin đại lý là vùng phụ, chỉ dùng tên đại lý từ user thực tế. Khi thiếu dữ liệu, hiển thị thông điệp trung tính.
- Giữ nút Lưu thay đổi/Hủy, loading, feedback và tất cả handler. Secondary action có visual weight nhẹ hơn.
- CSS mới giới hạn vào tài khoản khách hàng, có dark mode và touch target tối thiểu 44px.

## 3. Ánh xạ sang route hiện hữu

| Điểm truy cập | Route/hành vi |
|---|---|
| Mua sắm | `/shop` |
| Nút của tôi | `/customer/home` |
| Thêm nút bằng mã | `/customer/pair-device` |
| Thuê nút bấm | `/customer/rentals` |
| Đơn hàng | `/customer/orders` |
| Xác minh eKYC | `/customer/verification` → chuyển tiếp hiện có tới `/customer/profile?tab=INFO#customer-identity-verification` |
| Tài khoản / Thông tin cá nhân | `/customer/profile?tab=INFO` |
| Tài khoản / Địa chỉ đã lưu | `/customer/profile?tab=ADDRESSES` |
| Tài khoản / Bảo mật & Đổi mật khẩu | `/customer/profile?tab=SECURITY` |
| Đổi/xác minh số điện thoại | `/phone-auth?mode=verify`, giữ nguyên |
| Đăng xuất | Mục trong avatar dropdown → modal xác nhận hiện có → callback logout và `/login` |
| `/profile` của CUSTOMER | Giữ route, dùng AppShellLayout hiện có để cung cấp sidebar |

Không tạo route mới. Các tab URL cũ DEVICES/ORDERS vẫn có khả năng render để giữ compatibility; điều hướng chính dùng màn hình nghiệp vụ tương ứng. Không thêm request lấy badge vào sidebar; giữ dữ liệu/state và các màn hình thiết bị/đơn hàng hiện hữu.

## 4. File thay đổi trong task này

Các thay đổi nguồn được áp dụng tương ứng trong cả `src/` và `frontend/src/`, giữ khác biệt sẵn có giữa hai cây:

- `components/customer/CustomerAccountNavigation.tsx` — component mới cho submenu desktop/mobile.
- `layouts/Sidebar.tsx` — tích hợp nhóm tài khoản và lối tắt eKYC.
- `pages/profile/ProfilePage.tsx` — presentation CUSTOMER, label/input và bỏ tab ngang cho CUSTOMER.
- `pages/customer/customer-ui.css` — styling tài khoản, dark mode và responsive.
- `App.tsx` — shell của nhánh CUSTOMER tại route `/profile`.
- [tests/customer-account-ui.test.mjs](../tests/customer-account-ui.test.mjs) — kiểm tra UI callbacks và điều hướng.
- [tests/store-navigation.test.mjs](../tests/store-navigation.test.mjs) — cập nhật kỳ vọng theo điều hướng mới.
- Báo cáo này.

Không sửa Navbar, Footer, AuthContext, API client hoặc component eKYC trong task này. Những thay đổi có sẵn từ các task trước trong working tree được giữ nguyên.

## 5. Thành phần tái sử dụng

- `Sidebar`, `SidebarContext`, AppShellLayout và ProtectedRoute hiện có.
- Các tab INFO/ADDRESSES/SECURITY và các handler trong ProfilePage.
- Navbar, avatar dropdown và LogoutConfirmModal hiện có.
- CustomerIdentityVerification đã gộp vào thông tin cá nhân; không đổi luồng Didit.
- CustomerPageMotion, Framer Motion, AnimatePresence, useReducedMotion và icon lucide-react hiện có.
- Tokens `--customer-blue`, `--customer-line`; không thêm thư viện.

## 6. Bằng chứng giữ nguyên hành vi

Đã chụp source trước task vào thư mục cache của workspace và so sánh AST/source trước-sau cho cả hai frontend:

- **PASS:** 7 callback giữ nguyên nội dung: `handleTabChange`, `handleAvatarFileChange`, `handleRemoveAvatar`, `handleSaveProfile`, `handleCancelChanges`, `handleChangePassword`, `handleRequestNotif`.
- **PASS:** 23 initializer `useState` trong profile giữ nguyên, gồm các giá trị mặc định.
- **PASS:** 35 route path và nội dung ProtectedRoute giữ nguyên.
- **PASS:** Navbar, AuthContext, API client và CustomerIdentityVerification giống source trước task theo từng cây frontend.
- **PASS:** `git status --short -- backend` không có thay đổi.

Không chỉnh endpoint, request, response, payload, validation, authentication/authorization, session/JWT, database hoặc dữ liệu người dùng. Các API trong test dùng transport giả lập; không thực hiện lưu tài khoản, OTP, đổi mật khẩu hoặc logout của tài khoản thật.

## 7. Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| TypeScript root | PASS — `node node_modules/typescript/bin/tsc --noEmit` |
| TypeScript frontend | PASS — `node ../node_modules/typescript/bin/tsc --noEmit` trong frontend |
| Production build root | PASS — `npm.cmd run build` |
| Production build frontend | PASS — `npm.cmd run build` trong frontend |
| Regression tự động | PASS — 77/77 |
| Whitespace/diff check | PASS cho các file đã sửa |
| Lint | N/A — package.json không có script lint, không tìm thấy cấu hình ESLint của frontend; không cài thêm công cụ |
| Browser console thực tế | NOT VERIFIED |
| Desktop/tablet/mobile viewport thực tế | NOT VERIFIED |

Lệnh regression:

```powershell
node --experimental-strip-types --test tests/customer-account-ui.test.mjs tests/store-navigation.test.mjs tests/phone-auth-flow.test.mjs tests/customer-page-motion.test.mjs tests/page-back-button.test.mjs frontend/tests/customer-verification-details.test.mjs frontend/tests/admin-presentation.test.mjs
```

### Phạm vi được kiểm tra thực tế bằng test tự động

| Chức năng | Kết quả và giới hạn |
|---|---|
| Nhóm Tài khoản, active INFO/ADDRESSES/SECURITY, Escape/focus | PASS — chạy component/callback thật trong harness, không phải kiểm tra browser |
| Sidebar thu gọn và callback đóng menu mobile | PASS — callback thật; viewport/Enter/Space/Tab native còn NOT VERIFIED |
| Mua sắm, nút, thêm nút, thuê nút, đơn hàng | PASS về ánh xạ route/compatibility; thao tác toàn luồng với tài khoản thật NOT VERIFIED |
| Thông tin cá nhân và label/input | PASS — liên kết label, required/disabled và controlled values |
| Lưu/Hủy | PASS — callback thật, payload PATCH account-only, refresh và khôi phục giá trị; persistence trên server thật NOT VERIFIED |
| Lỗi khi lưu | PASS — feedback backend giả lập và nút lưu được khôi phục |
| Đổi/Gỡ ảnh | PASS — FileReader/storage/event giả lập, preview và giới hạn 2MB; hộp chọn file/browser thật NOT VERIFIED |
| Xác minh số điện thoại | PASS — route, protected endpoint helper và presentation theo trạng thái; OTP/Firebase thật NOT VERIFIED |
| eKYC | PASS — nhúng component, route cũ và kiểm tra detail/ownership; Didit/popup/camera/webhook thật NOT VERIFIED |
| Đổi mật khẩu | PASS — validation thật, DTO và logout sau thành công trên transport giả lập; tài khoản thật NOT VERIFIED |
| Đăng xuất | PASS — dropdown/modal/callback hiện có trên harness; xóa session thật trong browser NOT VERIFIED |
| Animation | PASS — kiểm tra page transition/reduced-motion và không transform ancestor modal; cảm nhận mượt và layout trực quan NOT VERIFIED |
| Store Owner/Admin | PASS — smoke test markup/navigation hiện hữu và admin sections; visual QA toàn bộ role NOT VERIFIED |

## 8. Giới hạn và rủi ro còn lại

- Công cụ browser/native không kết nối (`browser access host unavailable`, `native pipe unavailable`). Không có bằng chứng screenshot, viewport hoặc console thực tế; không đánh dấu các mục đó PASS.
- Cần kiểm tra trực quan các viewport 1440px, 1024px/768px và 390px/360px khi có browser, gồm sidebar mở/thu gọn, form, menu mobile, dark mode, focus và popup eKYC.
- Theo source backend hiện có, `GET /auth/me` chưa trả `phoneVerified`/`phoneVerifiedAt` trong mọi trường hợp. Khi không có dữ liệu này, UI dùng lời nhắc trung tính, không tự xác nhận trạng thái hoặc suy ra từ số điện thoại. Chưa sửa backend/auth mapping.
- Baseline: handler lưu profile chỉ gửi `fullName` và `phone` tới `/auth/profile`; địa chỉ trên form không nằm trong payload này. Giữ nguyên giới hạn đã có, không thêm endpoint hoặc thay đổi nghiệp vụ lưu địa chỉ trong task UI.
- Baseline: ảnh đại diện hiện dùng FileReader/localStorage và sự kiện đồng bộ header. Task giữ nguyên cơ chế này, không chuyển sang upload server.
- Những dữ liệu mặc định và validation sẵn có vẫn được giữ. Các vấn đề nghiệp vụ hoặc dữ liệu cần task riêng nếu muốn thay đổi.
