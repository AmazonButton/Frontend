# Nâng cấp khách hàng thành chủ cửa hàng

## Giao diện đã bổ sung

- Tên mục: **Trở thành chủ cửa hàng**.
- Vị trí: menu tài khoản trên thanh đầu trang và mục Tài khoản trong thanh điều hướng khách hàng (máy tính/điện thoại).
- Đường dẫn: `/customer/become-store-owner`, nằm trong nhóm route chỉ dành cho `CUSTOMER`.
- Màn hình giới thiệu quyền lợi, liên kết hướng dẫn và thông báo rõ nâng cấp tài khoản hiện chưa khả dụng.
- Không gửi yêu cầu tạo cửa hàng, không đổi role/token, không tự đăng xuất, không chuyển người dùng sang biểu mẫu đăng ký tài khoản mới.

## Backend cần bổ sung trước khi bật nâng cấp

Qua kiểm tra mã nguồn hiện tại, chưa thấy API chuyển tài khoản CUSTOMER đã tồn tại sang STORE_OWNER. `/auth/register` là đăng ký người dùng mới, không dùng thay thế cho nâng cấp tài khoản.

Cần thống nhất hợp đồng API và chính sách trước khi nối giao diện:

1. Dùng danh tính từ phiên đăng nhập, chỉ cho CUSTOMER đủ điều kiện gửi yêu cầu. Không nhận userId hoặc role tùy ý từ frontend.
2. Có API đọc trạng thái hiện tại để tải lại trang vẫn theo dõi được yêu cầu; xác định rõ thông tin cửa hàng bắt buộc, trạng thái chờ duyệt/từ chối/được duyệt và điều kiện gửi lại.
3. Tạo yêu cầu/cửa hàng trong transaction và chống gửi trùng; không tạo tài khoản người dùng thứ hai.
4. Giữ liên kết đơn hàng, hợp đồng thuê, thiết bị, hồ sơ, ngân hàng và nghĩa vụ hoàn tiền cũ. Làm rõ quyền truy cập chức năng khách hàng sau nâng cấp vì giao diện hiện phân khu theo role.
5. Chỉ cấp quyền chủ cửa hàng theo kết quả thật của server; xác định việc làm mới phiên/token sau khi được duyệt. Frontend không tự gán role.
6. Quy trình xét duyệt cửa hàng, đăng ký gói, giới hạn sản phẩm và thanh toán tiếp tục tuân theo chính sách hiện hành; nâng cấp không tự tạo gói trả phí hay kích hoạt quyền mở bán.

Chưa chỉnh sửa backend. Chưa triển khai chức năng chuyển đổi tài khoản thật.
