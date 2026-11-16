# Báo lỗi backend ngân hàng: database thiếu cột payment_qr_code

Ngày ghi nhận: **15/11/2026**. Mức độ: **P1 — chặn đọc trạng thái và lịch sử xác minh ngân hàng khách hàng**.

Tài liệu này để bàn giao cho đội backend. Trong quá trình kiểm tra, không chỉnh sửa backend, cấu hình triển khai, database, webhook hoặc dữ liệu thanh toán.

## 1. Lỗi đã xác nhận

Trang **Khách hàng → Tài khoản → Ngân hàng & hoàn tiền** hiển thị lỗi Prisma khi mở chi tiết tài khoản và tải lịch sử:

```text
The column `customer_bank_verification_proofs.payment_qr_code`
does not exist in the current database.
```

Hai truy vấn được nêu trong thông báo lỗi:

```text
this.prisma.customerBankVerificationProof.findFirst()
findLatestVerificationSessionByAccount(customerId, accountId)

this.prisma.customerBankVerificationProof.findMany()
findVerificationSessionHistory(customerId, ...)
```

Ảnh giao diện cũng hiển thị đường dẫn nội bộ của bản build:

```text
/opt/render/project/src/dist/src/customers/customers.repository.js
```

Các API tương ứng cần kiểm tra trong log backend:

| Chức năng | API |
| --- | --- |
| Đọc trạng thái xác minh và hoàn tiền | `GET /api/v1/customers/me/bank-accounts/{id}/verification-status` |
| Đọc lịch sử xác minh | `GET /api/v1/customers/me/bank-accounts/verification-history?page=1&pageSize=10` |

HTTP status và toàn bộ Response của lần lỗi trong ảnh chưa được cung cấp; không suy đoán giá trị HTTP status từ ảnh.

## 2. Bằng chứng đối chiếu code với database

Backend live được đối chiếu trong đợt tích hợp ngày 15/11/2026 báo commit:

```text
076592dac20b25e989123a2f6b4f581dbeb82f9b
```

Schema Prisma tại đúng commit này có khai báo:

```prisma
paymentQrCode String? @map("payment_qr_code") @db.Text
```

Model được ánh xạ vào bảng:

```prisma
@@map("customer_bank_verification_proofs")
```

Nguồn đã đọc: [prisma/schema.prisma tại commit được triển khai](https://github.com/AmazonButton/Backend/blob/076592dac20b25e989123a2f6b4f581dbeb82f9b/prisma/schema.prisma#L1311).

DTO ngân hàng mới cũng trả trường `qrCode` trong phiên khởi tạo, trạng thái và lịch sử. Nguồn: [customer-bank-verification-response.dto.ts](https://github.com/AmazonButton/Backend/blob/076592dac20b25e989123a2f6b4f581dbeb82f9b/src/customers/dto/customer-bank-verification-response.dto.ts).

**Kết luận đã có bằng chứng:** code/Prisma Client đang cần cột `payment_qr_code`, nhưng database phục vụ truy vấn trong ảnh không có cột đó. Lỗi xảy ra trong truy vấn backend, trước khi frontend nhận được dữ liệu trạng thái hợp lệ; không phải bằng chứng frontend gọi sai endpoint.

**Chưa xác định được nguyên nhân triển khai cụ thể:** migration chưa được tạo/đóng gói, chưa được áp dụng, đã chạy vào database/schema khác, hoặc phiên bản code và database không cùng đợt triển khai. Cần log và trạng thái migration thực tế để phân biệt các trường hợp này. Việc build và endpoint readiness thành công không thay thế kiểm tra schema được các API ngân hàng sử dụng.

## 3. Ảnh hưởng thực tế

- Danh sách tài khoản vẫn có thể tải được, nhưng phần chi tiết xác minh và lịch sử lỗi.
- Frontend không đọc được kết quả mới để cập nhật trạng thái trên trang, dù polling vẫn gọi đúng API.
- Người dùng không thể dựa vào trang hiện tại để biết khoản đã chuyển được ghi nhận, xác minh hay hoàn tiền đến đâu.
- Ảnh lỗi không chứng minh giao dịch bị mất, đã thất bại hoặc đã hoàn tiền. Cần kiểm tra riêng bằng dữ liệu backend/PayOS.
- Lỗi trong ảnh thuộc role khách hàng. Chưa có bằng chứng cùng lỗi thiếu cột xảy ra ở ngân hàng chủ cửa hàng; cần kiểm tra hồi quy role đó sau khi đồng bộ database.

## 4. Yêu cầu đội backend kiểm tra và xử lý

1. Xác nhận commit đang chạy và database/schema thực tế mà instance xử lý request sử dụng. Không gửi connection string, mật khẩu hoặc khóa PayOS vào phản hồi bàn giao.
2. Kiểm tra migration nào bổ sung `payment_qr_code` cho bảng `customer_bank_verification_proofs`, migration có nằm trong bản release không, và đã hoàn tất trên đúng database/schema chưa.
3. Nếu thiếu migration trong release, bổ sung migration theo quy trình backend. Nếu migration đã có, áp dụng qua quy trình triển khai được duyệt, giữ nguyên các tài khoản, phiên xác minh và sổ giao dịch hiện có. Đồng bộ Prisma Client/bản build với schema sau triển khai.
4. Kiểm tra lại các phiên người dùng đã thanh toán trước đó bằng luồng đối soát hiện có. Không yêu cầu chuyển thêm tiền hoặc tạo phiên mới để né lỗi schema; không tự đánh dấu đã xác minh/đã hoàn khi chưa đủ bằng chứng.
5. Chạy lại API trạng thái và lịch sử trên tài khoản kiểm thử đã tồn tại trước migration, không chỉ tài khoản mới.

Ví dụ truy vấn **chỉ đọc** để kiểm tra sự tồn tại và thuộc tính cột trên kết nối database đã xác định:

```sql
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_bank_verification_proofs'
  AND column_name = 'payment_qr_code';
```

Nếu có nhiều schema, cần đối chiếu kết quả với schema mà Prisma đang sử dụng. Không coi việc tìm thấy cột ở một schema khác là đã xử lý xong.

## 5. Vấn đề hiển thị lỗi kỹ thuật

Ảnh cho thấy người dùng nhìn thấy tên Prisma model, truy vấn, đường dẫn file trên Render và vị trí code. Đội backend cần kiểm tra exception filter/response production để trả thông báo nghiệp vụ ngắn gọn và mã lỗi ổn định; chi tiết Prisma giữ trong log server. Frontend cũng cần dùng thông báo phù hợp thay vì hiển thị nguyên stack/query nếu nhận được lỗi nội bộ.

Ví dụ nội dung mong muốn khi dịch vụ chưa sẵn sàng:

```text
Chưa thể tải trạng thái xác minh ngân hàng. Vui lòng thử lại sau.
```

Việc làm gọn thông báo không thay thế sửa lỗi thiếu cột.

## 6. Tiêu chí nghiệm thu

- Cột tồn tại trong đúng database/schema, phù hợp kiểu `String?`/`TEXT` nullable của Prisma; các bản ghi cũ vẫn đọc được khi giá trị QR là `null`.
- Hai API khách hàng nêu trên trả envelope thành công với dữ liệu hợp lệ, không còn lỗi thiếu cột.
- Mở lại tài khoản cũ và lịch sử không yêu cầu người dùng tạo tài khoản hoặc thanh toán lại.
- Giao diện tự làm mới theo dữ liệu backend; không suy ra xác minh chính chủ hoặc hoàn tiền thành công chỉ từ trang PayOS báo thành công.
- Kiểm tra hồi quy role chủ cửa hàng: tra cứu, tạo/khôi phục phiên, trạng thái, lịch sử, nội dung chuyển khoản và callback PayOS.
- API lỗi production không trả nội dung Prisma/đường dẫn nội bộ cho người dùng.

Đề nghị phản hồi: nguyên nhân đã xác định, migration/release xử lý, thời điểm triển khai, HTTP status và Response đã che thông tin nhạy cảm của hai API sau sửa, cùng kết quả đối soát khoản cũ nếu đã kiểm tra.

## 7. Giới hạn kiểm thử frontend trước đó

178 kiểm thử frontend đã đạt và cả hai bản frontend build thành công. Các kiểm thử sử dụng transport/UI fixture cô lập, không kiểm chứng cấu trúc database production và không thực hiện giao dịch thật. Không sử dụng kết quả đó để kết luận database đã được migrate hoặc khoản tiền cụ thể đã hoàn tất.
