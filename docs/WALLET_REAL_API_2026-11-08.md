# Ví cửa hàng: dữ liệu API và khoản 15.000.000đ — 08/11/2026

## Đã xác định nguồn số dư

Người dùng đã cung cấp response thực tế của `GET /api/v1/store/wallet`:

```json
{
  "success": true,
  "data": {
    "walletId": "1",
    "storeId": "1",
    "balance": 15000000,
    "frozenBalance": 0,
    "createdAt": "2026-10-21T09:50:28.048Z",
    "updatedAt": "2026-10-22T06:40:18.727Z"
  }
}
```

Đây là response do người dùng cung cấp; không phải số dư được frontend truy vấn độc lập bằng tài khoản thật. Nó xác nhận khoản 15.000.000đ trong ảnh có nguồn từ API. Không tìm thấy hằng số gán số dư 15.000.000đ trong code ứng dụng frontend trước thay đổi này.

Frontend không đổi khoản này thành 0, không trừ một khoản giả định là dữ liệu thử và không tự tính lại số dư bằng các đơn hàng/lịch sử có thể chưa đầy đủ. Hiển thị 15.000.000đ khi API trả đúng giá trị này là đúng với nguồn hiện có; điều đó không chứng minh nguồn tiền trong cơ sở dữ liệu là giao dịch thực.

## Đã sửa frontend

Áp dụng cả `src/` và `frontend/src/`:

- Đọc số dư API, chuẩn hóa số dạng chuỗi/number; thiếu hoặc sai số dư thì báo lỗi và hiển thị `—`, không tự bù 0 hay một số mẫu.
- Ánh xạ `frozenBalance` thành số tiền giữ chỗ: response trên hiển thị 0đ. `balance` là số dư khả dụng còn lại trong mô hình backend đã đọc; không trừ `frozenBalance` thêm lần nữa.
- Trường PayOS thiếu được hiển thị chưa có thông tin; không suy ra chưa kích hoạt hoặc số dư 0.
- Bỏ các khẳng định cố định “Có thể rút ngay”, “Đã xác thực”, “Miễn phí giao dịch”, “Ngay tức thì”. Không gán trạng thái chính chủ chỉ vì có tài khoản nhận tiền đã lưu.
- Đọc tài khoản đã che số từ cấu trúc API mới; không đưa số đã che vào ô nhập để lưu lại như số thật.
- Dùng ID giao dịch/rút tiền mới, nhận đúng trạng thái `SUCCEEDED`, giữ nguyên số tiền thực và phân trang server. Không tự gán SUCCESS cho bút toán không có trường trạng thái.
- Giữ luồng ghi thông tin ngân hàng và tạo yêu cầu rút tiền hiện có. Công việc này chuẩn hóa dữ liệu đọc từ API, không thay đổi logic ghi tiền hoặc số dư.
- Hiển thị thời điểm tải gần nhất, bảo vệ dữ liệu giữa phiên/cửa hàng, bỏ phản hồi đã cũ. Nếu số dư không tải được hoặc response thuộc cửa hàng khác, không cho tạo lệnh rút dựa trên dữ liệu đó.
- Các nút chọn nhanh số tiền là giá trị nhập gợi ý, không phải số dư hoặc giao dịch mẫu.

Đối chiếu chỉ đọc source mới: [WalletMapper](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/mappers/wallet.mapper.ts), [StoreWalletController](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/store-wallet.controller.ts).

## Bàn giao backend: cần kiểm tra số dư cửa hàng 1

Theo yêu cầu sản phẩm hiện không còn sử dụng dữ liệu thử. Vì API vẫn trả `balance = 15000000` cho `walletId = 1`, `storeId = 1`, đề nghị đội backend:

1. Kiểm tra đây là số dư thật hay bản ghi thử/seed/cộng tiền thủ công còn tồn tại. Response hiện có chưa đủ kết luận là dữ liệu mẫu.
2. Đối chiếu số dư với sổ giao dịch đầy đủ, số dư đầu kỳ hợp lệ, doanh thu đã ghi nhận, rút tiền, hoàn tiền và phí. Không dùng riêng trang đầu của lịch sử để kết luận.
3. Kiểm tra deployment/database/cache đang dùng có đúng môi trường dữ liệu thật hay không; làm rõ dữ liệu cũ còn lại nếu có.
4. Nếu xác nhận là dữ liệu thử, xử lý và đối soát ở backend theo quy trình của đội backend; sau đó API phải trả số dư đã được điều chỉnh. Frontend sẽ hiển thị đúng response mới khi tải lại.

Không sửa backend, database, seed, cấu hình backend hay dữ liệu ví trong công việc frontend này. Không tạo lệnh rút/chuyển tiền thật để thử số dư.

## Kiểm tra

Test mới bao gồm response 15.000.000đ thực tế người dùng cung cấp, số dư 0 thật, tiền giữ chỗ 0 và khác 0, số dư thiếu, lỗi tải, dữ liệu khác cửa hàng, số tài khoản che, ID lớn và phân trang. Toàn bộ frontend: **471/471 test đạt**, cả hai frontend **build thành công**; `git diff --check` đạt, `backend/` không có thay đổi. Các kiểm tra liên quan được chạy lại sau khi giữ nguyên hàm ghi ngân hàng cũ.

## Điểm backend khác phát hiện khi đối chiếu source

Trong source mới, DTO cập nhật ngân hàng ví chưa nhận `bankBin`, trong khi `StoreWalletRepository.updateBankAccountAtomicTx()` tạo registry với BIN cố định `970422`. Đề nghị backend xử lý để ngân hàng được chọn và BIN thực tế thống nhất; không dùng việc frontend bỏ trường thừa như một cách sửa hoàn chỉnh cho lỗi này. Công việc số dư không sửa backend hay thay đổi luồng ghi ngân hàng cũ. Màn hình xác minh tại Gói & ngân hàng vẫn có luồng tạo yêu cầu riêng nhận BIN đúng.
