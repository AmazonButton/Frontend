# Báo cáo lỗi xác minh ngân hàng — Khách hàng và Chủ cửa hàng

**Ngày tổng hợp:** 14/11/2026. Múi giờ các mốc thời gian: Asia/Saigon (UTC+7).

**Gửi:** Nhóm backend.

**Phạm vi:** Tổng hợp kết quả kiểm tra đọc dữ liệu và đọc code ngày 13–14/11/2026. Không sửa backend, không chạy migration, không cập nhật trạng thái xác minh hoặc thực hiện hoàn tiền. Bản sửa backend thử nghiệm trước đó đã được thu hồi theo yêu cầu người dùng. Đây không phải kết quả kiểm tra lại trạng thái production tại thời điểm đọc báo cáo.

## 1. Tóm tắt các vấn đề

| Mã | Role | Hiện tượng | Kết luận và mức độ xác nhận |
| --- | --- | --- | --- |
| BANK-01 | Khách hàng | Chuyển đúng tài khoản, đủ 2.000 đ và trong hạn nhưng báo “Thông tin không khớp” | Đã xác nhận dữ liệu: số tài khoản khớp, quyết định `MISMATCH_BIN`; code so sánh trực tiếp CITAD với BIN. |
| BANK-02 | Chủ cửa hàng | PayOS đã nhận đủ tiền nhưng ứng dụng tiếp tục “Chờ xác minh”, chưa ghi nhận thực nhận | Đã xác nhận PayOS `PAID`, database `PENDING`, và lỗi `P2021` do thiếu bảng `public.store_bank_inbound_receipts`. |
| BANK-03 | Chủ cửa hàng | Luồng có thể tiếp tục trả trạng thái chờ khi đồng bộ gặp lỗi | Đã xác nhận đường xử lý trong code: bắt lỗi đồng bộ rồi trả transaction cũ. Chưa kiểm tra log instance để khẳng định lần thực thi cụ thể. |
| BANK-04 | Chủ cửa hàng | Có thể tiếp tục bị từ chối sau khi khắc phục thiếu bảng | Code store cũng so sánh trực tiếp mã nguồn với BIN; PayOS của giao dịch được kiểm tra trả CITAD TPBank. Chưa quan sát quyết định từ chối này trên giao dịch store đang `PENDING`. |

**Ảnh hưởng:** Người dùng đã chuyển tiền thật nhưng không thể hoàn tất xác minh; giao diện không có kết quả mới hoặc hiển thị sai lý do không khớp ngân hàng. Chưa có bằng chứng xác nhận khoản hoàn đã hoàn tất. Không yêu cầu người dùng chuyển thêm tiền để thử lại.

## 2. BANK-01 — Khách hàng: cùng TPBank nhưng bị đánh dấu MISMATCH_BIN

### Bằng chứng đã xác nhận

- Một giao dịch khách hàng đã nhận đủ **2.000 đ**, trong thời hạn phiên.
- Hash số tài khoản nguồn **khớp hoàn toàn** hash tài khoản đăng ký.
- Ngân hàng đăng ký là TPBank, BIN **`970423`**.
- Mã ngân hàng nguồn được ghi nhận là **`01358001`**.
- Backend lưu `matchDecision = MISMATCH_BIN`, `verificationStatus = FAILED_MISMATCH`.

`01358001` là mã CITAD TPBank; catalogue ứng dụng dùng BIN `970423`. Có thể đối chiếu [danh sách CITAD do ngân hàng công bố](https://apac.bnpparibas/app/uploads/sites/11/2025/06/citad-code-updated-10.06.2025v1.pdf).

### Nguyên nhân trong code

Mã nguồn PayOS được lấy trực tiếp từ `counterAccountBankId`, sau đó so sánh chuỗi với BIN đã đăng ký. Hai hệ mã khác nhau của cùng ngân hàng bị coi là hai ngân hàng khác nhau.

Các vị trí cần kiểm tra, đường dẫn tính từ gốc repository:

- `backend/src/customers/customer-bank-penny-verification.service.ts`
  - `recordInboundPaymentEvidence`: đọc mã ngân hàng nguồn.
  - `reconcileExistingInboundTransaction`: so sánh ngân hàng khi phát hiện giao dịch trùng.
- `backend/src/customers/customers.repository.ts`
  - `recordInboundTransactionAndObligationAtomicTx`: quyết định `MISMATCH_BIN` và cập nhật trạng thái.
- `backend/src/bank-verification/constants/vietnam-banks.constant.ts`: catalogue BIN.

### Đề nghị xử lý

1. Chuẩn hóa các định danh ngân hàng được tài liệu provider xác nhận về cùng định danh trước khi đối chiếu. Không suy diễn ngân hàng bằng vài chữ số cuối của mã.
2. Áp dụng nhất quán cho webhook, polling, phát hiện giao dịch trùng và đối soát biên nhận cũ.
3. Kiểm tra định dạng mã ngân hàng dùng cho đích hoàn tiền; không mặc định mọi API đều nhận cùng loại mã.
4. Giữ nguyên yêu cầu khớp đầy đủ số tài khoản, số tiền, thời gian, bằng chứng xác thực và trạng thái phiên.
5. Đối soát lại các giao dịch cũ đã bị ghi sai. Sửa code không tự sửa trạng thái đã lưu.

**Lưu ý:** Một giao dịch khách hàng khác trước đó có cả số tài khoản nguồn không khớp số đã đăng ký. Không được đánh dấu mọi giao dịch `MISMATCH_BIN` thành thành công chỉ vì đã quy đổi mã ngân hàng; phải đối chiếu riêng từng giao dịch.

## 3. BANK-02 — Chủ cửa hàng: PayOS PAID nhưng database vẫn PENDING

### Bằng chứng từ kiểm tra đọc trực tiếp ngày 14/11/2026

| Nguồn kiểm tra | Kết quả |
| --- | --- |
| GET PayOS cho phiên được báo lỗi | HTTP `200`, mã nghiệp vụ `00`, trạng thái `PAID` |
| Tiền đã nhận tại PayOS | `2.000 đ` |
| Tiền còn thiếu tại PayOS | `0 đ` |
| Số giao dịch PayOS | `1` giao dịch thật |
| Thời gian chuyển khoản | `00:05:34 ngày 14/11/2026` |
| Hạn phiên | `00:33:06 ngày 14/11/2026` |
| Transaction trong database ứng dụng | `status = PENDING` |
| Số tiền nhận trong database | `receivedAmount = null` |
| Lý do thất bại / hoàn tiền | `failureReason = null`, `refundStatus = null` |
| Trạng thái tài khoản store | `PENDING` |
| Truy vấn bảng biên nhận | Prisma `P2021`: thiếu `public.store_bank_inbound_receipts` |

### Điểm chặn trong code/schema

`executeAtomicWebhookVerificationTx` truy vấn `store_bank_inbound_receipts` để kiểm tra giao dịch trùng trước khi hoàn tất xử lý xác minh. Với schema đang thiếu bảng này, đường xử lý hiện tại không thể hoàn tất bình thường.

Migration đã có định nghĩa bảng trong repository:

`backend/prisma/migrations/20261111000000_financial_verification_and_outbox_hardening/migration.sql`

Migration này còn chứa bảng nghĩa vụ hoàn tiền và các thay đổi liên quan. Việc thiếu bảng biên nhận đã được xác nhận; **chưa xác nhận tình trạng tồn tại/đầy đủ của tất cả bảng, cột còn lại trong migration**.

Chưa kiểm tra lịch sử migration hoặc log deploy để xác định vì sao schema thiếu bảng. Không kết luận chắc chắn migration chưa chạy, chạy lỗi, hay server đang trỏ nhầm database.

### Đề nghị xử lý

1. Xác nhận database/schema mà từng instance backend và worker thực tế sử dụng.
2. Kiểm tra lịch sử migration và schema thực tế; đối chiếu toàn bộ migration liên quan.
3. Hoàn thiện schema qua quy trình migration được phê duyệt, không chỉ tạo riêng một bảng để bỏ qua các thành phần phụ thuộc.
4. Kiểm tra log webhook và polling tại thời điểm thanh toán.
5. Sau khi xử lý schema và định danh ngân hàng, đối soát lại giao dịch đã thanh toán với đầy đủ chống trùng và kiểm tra trạng thái hoàn tiền.

## 4. BANK-03 — Chủ cửa hàng: lỗi đồng bộ bị che bởi trạng thái chờ

Vị trí: `backend/src/bank-verification/bank-verification.service.ts`, hàm `getVerificationTransactionById`.

Đường xử lý đọc được trong code:

1. Nếu transaction đang `PENDING` và có orderCode, backend GET PayOS.
2. Khi PayOS trả `PAID`, backend xử lý từng giao dịch thật thông qua `handleVerificationWebhook`.
3. Nếu bước xử lý lỗi, backend ghi log trong `catch`.
4. Endpoint vẫn có thể trả transaction cũ đang `PENDING` cho frontend.

Vì vậy, polling vẫn có thể nhận phản hồi thành công nhưng nội dung luôn “đang chờ”, dù cổng thanh toán đã nhận tiền. Đây là đường lỗi được xác nhận bằng code; chưa quan sát request mạng trình duyệt hoặc log instance của lần chuyển cụ thể.

**Đề nghị:** Cung cấp trạng thái/lỗi đồng bộ có thể xử lý được ở API và cơ chế thử lại/đối soát an toàn. Không chuyển tài khoản thành verified chỉ dựa vào `PAID`, không tạo giao dịch hoặc nghĩa vụ hoàn tiền trùng khi retry.

## 5. BANK-04 — Chủ cửa hàng: rủi ro đối chiếu CITAD/BIN giống khách hàng

Vị trí: `backend/src/bank-verification/bank-verification.repository.ts`, hàm `executeAtomicWebhookVerificationTx`, nhánh `SENDER_BANK_MISMATCH`.

Code so sánh trực tiếp `params.senderBankBin.trim()` với `lockedAccount.bank_bin.trim()`. GET PayOS của giao dịch store đã kiểm tra trả `counterAccountBankId = 01358001`.

Do đó, sau khi sửa schema, giao dịch TPBank vẫn có thể bị từ chối khi so với BIN `970423`. Cần kiểm tra và chuẩn hóa cùng nguyên tắc ở BANK-01. **Không coi đây là trạng thái từ chối đã xảy ra của phiên store: dữ liệu được kiểm tra vẫn đang `PENDING`.**

## 6. Hợp đồng frontend/backend cần giữ nguyên

- Lookup: `POST /stores/bank-accounts/lookup`.
- Tạo xác minh store: `POST /stores/bank-accounts/verification`.
- Số tài khoản theo DTO hiện tại: **6–19 chữ số**, giữ nguyên số 0 đầu.
- Chỉ lỗi **`ACCOUNT_NAME_UNRESOLVED`** cho phép đi tiếp bằng tên chủ tài khoản tự nhập. Các lỗi tài khoản không tồn tại, thông tin không hợp lệ, xác thực provider hoặc dịch vụ lỗi không được tự bỏ qua.
- Tên tự nhập chưa phải tên đã được ngân hàng xác minh. Không thay tên thiếu bằng dữ liệu giả hoặc nhãn gây hiểu nhầm là đã xác thực.
- Tạo phiên, nhận tiền, xác minh chính chủ và hoàn tiền là các kết quả riêng biệt.
- Store chỉ được chọn tài khoản mặc định theo trạng thái **`OWNERSHIP_VERIFIED`** mà backend trả.
- Frontend đã chỉnh validation, lựa chọn ngân hàng hỗ trợ chuyển khoản và bước xác nhận tên theo hợp đồng này; không can thiệp quyết định xác minh của backend.

## 7. Tiêu chí kiểm thử/đối soát sau xử lý

- [ ] TPBank trả CITAD hợp lệ và đúng tài khoản: nhận diện đúng ngân hàng, không từ chối vì khác hệ mã.
- [ ] Chuyển từ sai tài khoản hoặc sai ngân hàng thực sự: vẫn bị từ chối.
- [ ] Thiếu số tài khoản nguồn hoặc số bị che: không tự coi là đủ bằng chứng chính chủ.
- [ ] Sai số tiền, quá hạn hoặc phiên đã sử dụng: giữ đúng chính sách backend.
- [ ] Webhook trước/polling sau và polling trước/webhook sau: không ghi trùng tiền nhận hoặc nghĩa vụ hoàn tiền.
- [ ] Replay biên nhận cũ sau chuẩn hóa mã: không tạo xung đột giả, không phát sinh chi trả lần hai.
- [ ] Schema đầy đủ trên database của mọi instance/worker; đồng bộ không còn lỗi thiếu bảng.
- [ ] API phân biệt được chờ thanh toán với đã thanh toán nhưng lỗi đồng bộ/cần đối soát.
- [ ] Đối soát được khoản đã nhận của người dùng hiện tại mà không yêu cầu chuyển lại.
- [ ] Không khẳng định hoàn tiền thành công khi chưa có bằng chứng từ nhà cung cấp.

## 8. Giới hạn bằng chứng và phạm vi thay đổi

- Đã đọc code, truy vấn database và GET PayOS cho các tình huống được ghi rõ ở trên.
- Chưa kiểm tra đầy đủ log deploy, log webhook, migration history hoặc lưu lượng mạng trình duyệt production.
- Bộ frontend `tests/store-finance-flow.test.mjs` và `tests/banking-integration.test.mjs` đã đạt **96/96 tests**, frontend build thành công tại lần kiểm tra trước. Đây là kiểm thử bằng fixture riêng, không chứng minh backend production đã được sửa.
- Không thêm mock data vào UI/API; không sửa dữ liệu production hay thực hiện chuyển/hoàn tiền.
- Báo cáo không chứa số tài khoản đầy đủ, tên khách hàng, token hoặc khóa truy cập. Khi cần tìm chính xác giao dịch, đối chiếu ảnh và mã phiên người dùng cung cấp qua kênh nội bộ.

## 9. Tài liệu nguồn được tổng hợp

- `backend/docs/customer-bank-citad-mismatch.md`
- `docs/store-bank-flow-review.md`

Hai tài liệu nguồn được giữ nguyên để lưu vết; file này là bản tổng hợp gửi nhóm backend.
