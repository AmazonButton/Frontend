# Tối giản Thông tin cá nhân — Customer

Ngày: 07/11/2026. Thay đổi chỉ ở presentation của trang Thông tin cá nhân, áp dụng tương ứng cho `src` và `frontend/src`.

## Thay đổi

- Dùng một card chính chứa avatar, thông báo điện thoại và form; bỏ border/background/padding riêng của các nhóm nhỏ.
- Giữ tiêu đề “Thông tin cá nhân”; bỏ eyebrow, mô tả đầu trang và câu giải thích liên hệ lặp lại riêng ở tab INFO của CUSTOMER.
- Avatar 64px, tên/vai trò gọn; nút “Đổi ảnh” trung tính, giữ Gỡ ảnh và rút gọn hướng dẫn định dạng/dung lượng. Không sửa xử lý ảnh.
- Thông báo điện thoại thành dòng inline; giữ CTA, điều kiện trạng thái và đường dẫn xác minh. Không tự tạo trạng thái xác minh.
- Email/vai trò vẫn disabled, trình bày nhẹ hơn bằng nền trong và đường gạch chân trung tính. Giữ input, label, value và semantics.
- Đại lý chỉ xuất hiện một lần, thành dòng phụ có icon sau các trường nhập. Chỉ hiển thị tên/trạng thái đã có trên `user.store`; nhãn trạng thái là biểu diễn của trạng thái đại lý, không thêm nghiệp vụ kết nối.
- Giữ Lưu thay đổi/Hủy, bỏ divider thừa. Padding card 24px desktop, 16px mobile; giữ grid hai/một cột, focus và dark mode.
- eKYC, sidebar, header, các tab khác và animation hiện có giữ nguyên.

## File nguồn chỉnh sửa

- `src/pages/profile/ProfilePage.tsx`
- `frontend/src/pages/profile/ProfilePage.tsx`
- `src/pages/customer/customer-ui.css`
- `frontend/src/pages/customer/customer-ui.css`

Không thêm dependency, endpoint, route hoặc chức năng mới. Không sửa test để làm thay đổi kỳ vọng nghiệp vụ.

## Kiểm chứng thực tế

- **PASS:** build TypeScript + Vite tại root và `frontend` bằng `npm.cmd run build`.
- **PASS:** 77/77 kiểm tra tự động hiện có: form/label/disabled, Save/Cancel, phản hồi lỗi, avatar preview/gỡ/giới hạn 2MB, route xác minh điện thoại, validation mật khẩu, logout, navigation và animation.
- **PASS:** so sánh source/AST với snapshot ngay trước task: 7 handler và 23 initializer state của profile giữ nguyên ở cả hai frontend.
- **PASS:** App/routes, Sidebar, Navbar, AuthContext, API client và CustomerIdentityVerification giống snapshot trước task; thư mục backend không có thay đổi.
- **PASS:** `git diff --check` cho các file sửa.
- **N/A:** lint — frontend chưa có script/cấu hình lint; không cài thêm công cụ.
- **NOT VERIFIED:** bố cục desktop/tablet/mobile, tương tác browser và console thực tế. Công cụ báo browser access host/native pipe không kết nối; chưa có screenshot hoặc kiểm tra viewport thật.

Lệnh regression đã chạy:

```powershell
node --experimental-strip-types --test tests/customer-account-ui.test.mjs tests/store-navigation.test.mjs tests/phone-auth-flow.test.mjs tests/customer-page-motion.test.mjs tests/page-back-button.test.mjs frontend/tests/customer-verification-details.test.mjs frontend/tests/admin-presentation.test.mjs
```

Các kiểm tra callback/API dùng transport giả lập, không lưu hồ sơ, đổi mật khẩu, thực hiện OTP hoặc gọi Didit trên tài khoản thật.

## Giới hạn giữ nguyên

Trạng thái xác minh điện thoại chỉ hiện theo dữ liệu có sẵn. Handler lưu hiện tại vẫn chỉ gửi tên/số điện thoại; cơ chế ảnh vẫn dùng localStorage/event như trước. Không thay đổi các nghiệp vụ này trong task UI.
