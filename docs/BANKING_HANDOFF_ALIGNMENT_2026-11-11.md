# Đối chiếu bàn giao ngân hàng và cập nhật frontend — 11/11/2026

## Phạm vi

Đọc `FRONTEND_INTEGRATION_AND_BACKEND_HANDOFF_2026-11-11.md`, đối chiếu Swagger Render và source `AmazonButton/Backend` nhánh main. Chỉ sửa frontend ở `src/` và `frontend/src/`; giữ nguyên tài liệu backend gửi và không sửa backend. Không thay đổi luồng giao hàng hay cách ghi nhận doanh thu đơn hàng vào ví.

## Những điểm cần backend xác nhận lại trong tài liệu

Các URL bên dưới có tiền tố `/api/v1`. Những đường dẫn ở cột tài liệu chưa được thấy trong Swagger đang triển khai hoặc hai controller main đã đọc. Frontend tiếp tục dùng đường dẫn đã tồn tại để tránh lỗi 404.

| Nội dung | File bàn giao | Swagger/source hiện tại và cách frontend tích hợp |
| --- | --- | --- |
| Tạo phiên xác minh cửa hàng | POST `/bank-verification/store/initiate` | POST `/stores/bank-accounts/verification` |
| Dữ liệu tạo phiên | `bankBin`, `accountNumber`, `accountHolderName` | Chỉ gửi `storeId`, `bankBin`, `accountNumber`. Backend tự lookup tên chính chủ. DTO không nhận tên nhập tay. |
| Tra cứu trạng thái phiên | GET `/bank-verification/store/status/:sessionId` | GET `/bank-account-verifications/:verificationId`; đối chiếu ID và storeId. |
| Lịch sử xác minh | GET `/bank-verification/store/history` | GET `/stores/:storeId/bank-account-verifications` có page, pageSize, status. |
| Thông tin hướng dẫn | `sessionId`, `verificationAmount`, `transferContent`, checkoutUrl | `verificationId`, `bankAccountId`, `amount`, `referenceCode`, thông tin ngân hàng nhận, QR và expiresAt. Không tự dựng PayOS checkout link. |
| Thời hạn | Cố định 15 phút | Source mặc định 30 phút qua cấu hình; frontend đếm ngược từ expiresAt trả về, không cố định 15 hoặc 30 phút. |
| Lấy ví | GET `/store-wallet/me` | GET `/store/wallet` |
| Tạo/lịch sử rút | `/store-wallet/withdrawals` | `/store/wallet/withdrawals` |
| Ngân hàng đã xác minh | `wallet.bankAccount.isVerified` | WalletMapper hiện trả các trường ngân hàng phẳng, không có isVerified. Với chủ cửa hàng, frontend lấy danh sách ngân hàng có trạng thái OWNERSHIP_VERIFIED từ API riêng để quyết định tài khoản nhận và mở nút rút. |
| Số dư khả dụng | balance là tổng; availableBalance riêng | Mapper hiện có balance và frozenBalance. Backend trừ balance và tăng frozenBalance khi giữ tiền rút; không trừ frozenBalance thêm lần nữa ở frontend. Nếu server trả availableBalance thì dùng giá trị đó. |
| Trạng thái hoàn xác minh | REFUNDED, FAILED_RETRY | Source formatter đang trả refundStatus SUCCESS khi hoàn xong, FAILED khi chưa thành công; overall status REFUNDED/REFUND_PENDING. UI hiểu cả giá trị hiện tại và các nhãn mới trong tài liệu. |
| Tên tự nhập khi lookup 503 | Cho phép nhập tay | Chưa có hợp đồng hỗ trợ: source luôn lookup tại bước tạo phiên. Frontend hiển thị lỗi thật và không gửi tên tự nhập để bỏ qua xác minh. |
| Socket STORE_BANK_VERIFIED | Dùng để thông báo và sang ví | Chưa xác nhận event này trong hợp đồng hiện tại. Dùng GET polling 4 giây cho phiên đang mở, không tự coi payload phía client là bằng chứng xác minh/hoàn tiền. Giữ nút mở ví để người dùng xem kết quả. |

Frontend không tự đổi sang URL trong tài liệu khi chưa có bằng chứng triển khai. Backend cần cập nhật tài liệu đúng controller đang chạy hoặc triển khai hợp đồng mới, đồng thời công bố DTO/response/event chính thức.

## Thay đổi frontend lần này

- Đếm ngược theo expiresAt; số tiền, nội dung và ngân hàng nhận lấy từ response server. Không tự tạo số tài khoản nhận hoặc số tiền cố định.
- Hướng dẫn khôi phục từ sessionStorage chỉ hiển thị để chuyển tiền sau khi đọc lại được trạng thái PENDING từ API; lỗi đọc vẫn hiện rõ và có nút kiểm tra lại. QR hết hạn không hiển thị.
- Gặp 409 khi tạo phiên: giữ khóa tạo lại, GET danh sách phiên PENDING rồi GET chi tiết để khôi phục đúng cửa hàng và ID. Không tự gửi lại POST. Nếu chưa tìm được phiên, có nút kiểm tra bằng GET và vẫn chặn tạo trùng.
- Cột xác minh vẫn hiện Đã xác minh khi giao dịch chuyển sang REFUND_PENDING/REFUNDED. Cột hoàn tiền và giải thích riêng cho biết đang chờ, đang chuyển, chờ đối soát, chờ thử lại hoặc đã hoàn theo kết quả server.
- Lịch sử tự tải lại 15 giây khi trang hiện tại còn phiên/khoản hoàn cần theo dõi; chi tiết đang mở tải lại 4 giây. Dừng khi tab ẩn, đang backoff, có lỗi đọc hoặc trạng thái đã kết thúc. Không gọi API yêu cầu hoàn tiền.
- Lỗi BANK_LOOKUP_SERVICE_UNAVAILABLE giữ nguyên nguyên nhân server kèm mã hỗ trợ. Không biến lỗi xác thực provider thành thành công hay cho nhập tay để vượt bước lookup.
- Rút tiền hiển thị riêng Chờ xử lý/Đang chuyển tiền/Đã chuyển thành công/Đã hủy; cho nhập số nguyên VND từ 50.000, không ép bội số 1.000.
- Giữ nguyên body rút chỉ có amount, header idempotency và cơ chế phục hồi yêu cầu chưa rõ kết quả. Phí và netAmount lấy từ server; số dư được tải lại sau khi API ghi nhận lệnh, không tự trừ tiền trên giao diện.
- Giữ nguyên phân quyền STORE_OWNER/STORE_MANAGER và các luồng khách hàng/admin đã hoạt động. Không khôi phục thay đổi cộng 20.000đ/doanh thu đã được người dùng yêu cầu thu hồi trước đó.

## Cách kiểm tra tay

1. Đăng nhập STORE_OWNER → Gói & ngân hàng → Tài khoản ngân hàng. Chọn ngân hàng, nhập số tài khoản; xác nhận tên do lookup trả về trước khi tạo phiên.
2. Kiểm tra F12 Network: POST `/stores/bank-accounts/verification` chỉ có storeId, bankBin, accountNumber. Không có POST `/bank-verification/store/initiate`.
3. Khi tạo thành công, so sánh số tiền, referenceCode, ngân hàng nhận, QR và thời gian còn lại với response. Không chuyển khoản nếu cấu hình ngân hàng nhận chưa được đơn vị vận hành xác nhận.
4. Tải lại trang: frontend đọc trạng thái trước khi hiển thị QR. Mất kết nối khi đọc trạng thái phải hiện cảnh báo; dùng Kiểm tra kết quả sau khi có mạng lại. Không tự tạo thêm phiên.
5. Với môi trường test có thể mô phỏng 409, kiểm tra chỉ có một POST tạo phiên, tiếp theo là GET lịch sử PENDING và GET chi tiết. Nếu không tìm được phiên, nút tạo vẫn khóa, nút kiểm tra chỉ gọi GET.
6. Sau khi backend xác nhận nhận tiền, kiểm tra cột Xác minh và Hoàn tiền độc lập. PROCESSING không được hiện đã hoàn; chỉ SUCCESS/REFUNDED hiển thị đã hoàn. Không có nút Yêu cầu hoàn tiền xác minh.
7. Sang Báo cáo doanh thu → Ví & rút tiền. Chưa có ngân hàng OWNERSHIP_VERIFIED thì chủ cửa hàng chưa tạo được lệnh rút và có liên kết sang xác minh ngân hàng. Tài khoản đã xác minh, tài khoản mặc định và ví phải thuộc cửa hàng hiện tại.
8. Thử số tiền 49.999, số thập phân và vượt số dư: bị chặn. Số nguyên 50.001 được chấp nhận nếu đủ số dư. POST rút chỉ gửi amount; không gửi fee/netAmount. Thao tác có tiền thật chỉ thực hiện sau khi đơn vị vận hành xác nhận cấu hình.
9. Khi POST ghi nhận PENDING, ví tải lại từ server; không báo đã nhận tiền. Chi tiết hiển thị đúng tài khoản snapshot, phí và số thực chuyển server trả. Timeout giữ lại mã idempotency, không tạo yêu cầu mới tùy tiện.

## Kiểm chứng

- 193 kiểm thử liên quan ngân hàng, ví, tải dashboard và giao hàng đạt; các API tài chính trong kiểm thử được mô phỏng, không phát sinh giao dịch thật.
- `npm.cmd run build` tại thư mục gốc và `frontend/` đều đạt trên mã cuối cùng.
- `git diff --check -- src frontend tests docs` đạt; sáu cặp file frontend được sửa đồng nhất giữa hai cây mã.
- Không kiểm chứng giao dịch ngân hàng/chi trả thật hoặc cấu hình bí mật Render. Đây là các bước vận hành cần kiểm tra riêng sau khi backend xác nhận ngân hàng nhận.

Lệnh kiểm thử:

```powershell
node --experimental-strip-types --test tests/banking-integration.test.mjs tests/store-finance-flow.test.mjs frontend/tests/store-finance-flow.test.mjs tests/wallet-live-data.test.mjs frontend/tests/wallet-partial-load.test.mjs tests/dashboard-loaders.test.mjs tests/delivery-workflow.test.mjs frontend/tests/delivery-workflow.test.mjs frontend/tests/store-status-update.test.mjs
```

## Nguồn đối chiếu

- [Swagger đang triển khai](https://backend-fae8.onrender.com/docs-json), đọc ngày 11/11/2026.
- [Controller ngân hàng cửa hàng](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/store-bank-accounts.controller.ts), blob SHA `4a849898138019e3dc753cab838898022d2628ff`.
- [Service ngân hàng](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/bank-verification.service.ts), blob SHA `962fa7b961e3de4fa718c10cd625d52b84877536`.
- [DTO tạo phiên](https://github.com/AmazonButton/Backend/blob/main/src/bank-verification/dto/create-verification-request.dto.ts), blob SHA `bfbf34a5d9b73b74be2f2950d606c0c2c4101512`.
- [Controller ví](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/store-wallet.controller.ts), blob SHA `0583d2d6497bd1b32cbe9a513b2f3d2ad867f7ce`.
- [Mapper ví](https://github.com/AmazonButton/Backend/blob/main/src/store-wallet/mappers/wallet.mapper.ts), blob SHA `298d6c9be9c8178a8dd6ec4c623d1076e42f31e7`.

Source main và Swagger không chứng minh thông tin ngân hàng nhận, khóa provider, webhook, payout hoặc worker thực tế đã được cấu hình đúng trên Render. Không thực hiện giao dịch thật trong lần tích hợp này.
