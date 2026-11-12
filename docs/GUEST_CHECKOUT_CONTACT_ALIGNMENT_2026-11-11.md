# Thông tin người nhận đơn mua sắm — 11/11/2026

## Kết quả đối chiếu backend

Luồng hiện tại đã lưu dữ liệu nhận hàng vào database khi POST `/api/v1/storefront/orders`:

| Frontend gửi | Backend lưu trên đơn hàng |
| --- | --- |
| customerName | shippingRecipientName |
| customerPhone (chuỗi, giữ số 0 đầu) | shippingPhone |
| deliveryAddress | shippingAddress |

Đây là thông tin nhận hàng của từng đơn, có thể khác hồ sơ người mua. Không sửa số điện thoại trong hồ sơ tài khoản để thay thế thông tin nhận hàng.

Source mapper trả cả shippingPhone và recipientPhone; customerPhone/customer.phoneNumber có thể lấy số trong hồ sơ người mua trước. Vì vậy frontend phải ưu tiên số nhận hàng trong các trường snapshot. Nếu database thực tế đã thiếu/sai shippingPhone của một đơn cũ, frontend không thể sửa bản ghi đó bằng cách thay cách hiển thị; cần backend kiểm tra riêng bản ghi và request tạo đơn.

Nguồn đã đọc, chỉ đọc:

- [DTO tạo đơn](https://github.com/AmazonButton/Backend/blob/main/src/orders/dto/create-storefront-order.dto.ts), blob SHA `bcc28beb7140249e7b470f0ac3abcf108d5e4837`.
- [Repository lưu đơn](https://github.com/AmazonButton/Backend/blob/main/src/orders/orders.repository.ts), blob SHA `2309ca26433472e8b60fe35a647f763adb6ef362`.
- [Service tạo đơn và phát event](https://github.com/AmazonButton/Backend/blob/main/src/orders/orders.service.ts), blob SHA `851c4b145125c2d4c06701f351d01e9c4a68f40e`.
- [DTO đọc đơn](https://github.com/AmazonButton/Backend/blob/main/src/orders/dto/order-response.dto.ts), blob SHA `aeeec885e6178a0232bba756116064c8f24b9ec9`.

## Frontend đã sửa

- Gửi bộ contact đã chuẩn hóa vào đúng customerName/customerPhone/deliveryAddress của DTO, cùng storeId, items, paymentMethod; không gửi trường form ngoài hợp đồng. Số điện thoại luôn là chuỗi, không chuyển sang Number.
- Đọc số theo thứ tự shippingPhone → shipping_phone → recipientPhone → customerPhone → hồ sơ dự phòng. Giữ nguyên số 0 đầu, không lấy số người mua đè số nhận hàng đã có.
- Khi API/socket cập nhật snapshot bằng một tên trường khác, đồng bộ trường chuẩn trước khi hiển thị; không để số, tên hoặc địa chỉ cũ trong cache lấn át dữ liệu nhận hàng mới. Các event chỉ có trạng thái/thanh toán vẫn giữ snapshot hiện có.
- Chuẩn hóa cache ngay khi mở trang Đơn hàng của khách hàng và Đơn hàng trực tiếp của cửa hàng.
- Thành phần hiển thị thông tin nhận hàng và liên kết tel dùng chung cách đọc snapshot; luồng khôi phục thanh toán PayOS cũng đọc qua bộ chuẩn hóa này.
- Hai cây mã src và frontend/src đồng nhất cho các file được sửa. Không sửa backend, không cập nhật hồ sơ người dùng và không thay đổi cách thanh toán hay quyết toán ví.

## Kiểm tra tay trên môi trường test

1. Mở Mua sắm dưới khách vãng lai, nhập đủ họ tên, số di động hợp lệ và địa chỉ; chọn COD. Với khách đã đăng nhập, nhập số nhận hàng khác số hồ sơ để kiểm tra đặt hộ. PayOS vẫn yêu cầu đăng nhập theo luồng sẵn có.
2. Trong Network, kiểm tra POST `/api/v1/storefront/orders`: customerPhone phải đúng chuỗi đã nhập, giữ số 0 đầu; customerName và deliveryAddress đúng người nhận. Không có request PUT/PATCH hồ sơ để lưu số này.
3. Ghi lại mã đơn. Mở role cửa hàng, tìm đúng mã trong Đơn hàng trực tiếp. Đối chiếu tên, địa chỉ, số hiển thị và liên kết gọi điện.
4. F5 trang cửa hàng; khách đã đăng nhập F5 Đơn hàng. Thông tin nhận hàng phải giữ nguyên sau khi dữ liệu được đọc lại từ API, không phụ thuộc form còn mở hay cache phía khách.
5. Với PayOS, kiểm tra lại sau thanh toán hoặc sau mở lại phiên thanh toán bị hủy. Cập nhật trạng thái/đổi phương thức thanh toán không được thay số nhận hàng bằng số hồ sơ.
6. Nếu vẫn sai, so sánh cùng một mã đơn ở ba nơi: body POST tạo đơn, response GET `/api/v1/orders/:id` (shippingPhone/recipientPhone/customerPhone), giao diện cửa hàng. Nếu shippingPhone trong response cũng sai/thiếu, gửi request/response đã bỏ token cho backend đối chiếu bản ghi; không tự sửa số hoặc giả dữ liệu ở frontend.

## Kiểm chứng tự động

`tests/order-recipient-flow.test.mjs` chạy mã checkout và mã tải đơn thật của cả hai frontend với API mô phỏng: giữ số 0 đầu, gửi đúng DTO, đọc lại ở hai role, ưu tiên snapshot hơn hồ sơ, cập nhật alias, cache, phục hồi PayOS và liên kết tel.

Không tạo đơn hay thanh toán thật trong lần sửa này; kiểm thử API mô phỏng không thay cho xác nhận database đang triển khai.

Kết quả: 161 kiểm thử liên quan checkout, thông tin nhận hàng, cache, cập nhật thanh toán, thông báo và giao hàng đều đạt. Build production tại thư mục gốc và frontend/ đều đạt; sáu cặp file nguồn sửa trong lần này đồng nhất.
