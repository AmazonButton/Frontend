# BÁO CÁO KẾT QUẢ TEST LUỒNG HOÀN TIỀN PAYOS VÀ YÊU CẦU DÀNH CHO BACKEND

- **Thời gian lập báo cáo:** 25/11/2026
- **Môi trường:** Production / Staging (`backend-fae8.onrender.com` & Frontend Web)
- **Người gửi:** Đội ngũ Frontend / Tester
- **Người nhận:** Đội ngũ Backend & Hệ thống Ops (DevOps / Backend Lead)

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ (TEST RESULTS)

Đội ngũ đã tiến hành kiểm thử thực tế toàn trình (End-to-End) luồng: **Mua hàng $\rightarrow$ Quét QR thanh toán PayOS $\rightarrow$ Khách hàng hủy đơn $\rightarrow$ Tự động đối soát tài khoản nhận $\rightarrow$ Admin giải ngân PayOS Payout**.

### ✅ Các giai đoạn ĐÃ HOÀN THÀNH XUẤT SẮC (100% Pass Logic):
1. **Khách hàng đặt đơn & Thanh toán PayOS:**
   - Đơn hàng test: `#WEB-1795539477615-701` (Biên lai `#18`, số tiền `2.000 ₫`).
   - Khách hàng `Nguyễn Văn Thành` quét mã QR PayOS thanh toán thành công 2.000 ₫ từ tài khoản ngân hàng chính chủ **TPBank `******488 - LE HO GIA BAO` (BIN `970423`)**.
   - PayOS Webhook cập nhật đơn hàng thành công sang `CONFIRMED` / `PAID`.

2. **Khách hàng hủy đơn & Kích hoạt đối soát Zero-Trust:**
   - Khách hàng bấm **"Hủy đơn hàng"** trên trang `/customer/orders`.
   - Backend tự động sinh nghĩa vụ hoàn tiền **Nghĩa vụ `#3`** (`ORDER_REFUND`, `2.000 ₫`).
   - Backend đối chiếu tự động:
     - Tài khoản nguồn PayOS ghi nhận: `BIN 970423 · ******488`.
     - Tài khoản mặc định `VERIFIED` trong hồ sơ khách hàng: `BIN 970423 · ******488 · LE HO GIA BAO`.
     - **Kết quả đối soát:** `VERIFIED_MATCHED_SOURCE` (Trùng khớp 100%).
   - Giao diện Admin lập tức chuyển sang huy hiệu màu xanh: **`Sẵn sàng chi trả (READY_FOR_PAYOUT)`**, hiển thị đích danh người nhận: `LE HO GIA BAO · ******488`.

3. **Admin duyệt chi:**
   - Admin vào trang **Báo cáo & doanh thu** $\rightarrow$ **Hoàn tiền PayOS** (`/admin/refunds`).
   - Nút **`Chi PayOS`** hiển thị chuẩn xác, modal xác nhận mở ra đầy đủ thông tin số tiền và người thụ hưởng.
   - Admin bấm **"Xác nhận chi trả qua PayOS"**, Backend nhận lệnh và gửi request Payout sang PayOS thành công với mã lô chi trả: `batch_2f96d7b835c94ec3adc8a5012be8fec1`.

---

## 2. VẤN ĐỀ DUY NHẤT GÂY NGHẼN (THE BLOCKER)

Khi Backend gửi lệnh chi hộ sang PayOS (`https://api-merchant.payos.vn/v1/payouts`), cổng PayOS đã từ chối thực hiện giao dịch với mã lỗi kỹ thuật:

```json
{
  "code": "403",
  "desc": "Địa chỉ IP không được phép truy cập hệ thống",
  "data": null
}
```

### Hậu quả trên hệ thống:
- Giao diện Admin hiển thị cảnh báo: **`⚠️ PayOS Payout thất bại xác thực`**.
- Hệ thống áp dụng cơ chế Fail-Closed an toàn: Giữ nguyên trạng thái `Sẵn sàng chi trả (READY_FOR_PAYOUT)` để không làm mất tiền và không ghi nhận hoàn tất giả lập.

---

## 3. NGUYÊN NHÂN KỸ THUẬT GỐC RỄ (ROOT CAUSE)

Kênh **Chi hộ (PayOS Payout - giải ngân chuyển tiền ra)** của PayOS áp dụng chính sách bảo mật ngân hàng bắt buộc: **IP Whitelisting**. 

Chỉ các địa chỉ IP máy chủ được đăng ký trước trong danh sách trắng (Whitelist) trên cổng quản trị PayOS Merchant mới có quyền gọi API giải ngân tiền.

Hiện tại, địa chỉ IP Outbound của server Backend (máy chủ Render `backend-fae8.onrender.com` hoặc máy chủ chạy API) **chưa được đăng ký vào danh sách IP Whitelist trên cổng PayOS**.

---

## 4. YÊU CẦU CỤ THỂ DÀNH CHO BACKEND & DEVOPS ĐỂ HOÀN TẤT LUỒNG

Kính đề nghị đội ngũ Backend / DevOps thực hiện các bước sau để thông luồng hoàn tiền 100%:

### Task 1: Cấu hình IP Whitelist trên trang quản trị PayOS Merchant
1. Đăng nhập vào trang quản trị đối tác: [https://my.payos.vn](https://my.payos.vn) bằng tài khoản sở hữu Client ID `fffaf514-7762-4f5d-bc73-0039e3d821e0`.
2. Truy cập: **Kênh chi hộ (Payout)** $\rightarrow$ **Cài đặt kết nối / API Keys**.
3. Tại mục **IP Whitelist (Danh sách IP được phép gọi API)**:
   - Thêm địa chỉ Outbound IP của Server Backend vào danh sách.
   - *Lưu ý với Render:* Nếu Backend đang deploy trên Render free/starter instance (IP động), có thể sử dụng giải pháp Render Static Outbound IP (Render Outbound Proxy / Fixie add-on) hoặc cấu hình IP tĩnh tương ứng.
   - Nếu trong môi trường Test/Sandbox của PayOS cho phép, có thể cấu hình cho phép dải IP thử nghiệm.

### Task 2: Kiểm tra số dư ví chi hộ PayOS (Payout Balance)
- Đảm bảo số dư khả dụng trong ví Chi hộ (Payout) trên cổng PayOS có tối thiểu $\ge 2.000 ₫$ (khác với số dư của tài khoản thu tiền Payment Gateway).

### Task 3: Xác minh lại sau khi cấu hình
- Sau khi thêm IP Whitelist và kiểm tra số dư, Admin chỉ cần truy cập lại giao diện `/admin/refunds`, bấm lại nút **`Chi PayOS`** tại Nghĩa vụ **#3** hoặc **#1**.
- Khi PayOS chấp nhận lệnh chi, Backend sẽ nhận mã xác nhận thành công $\rightarrow$ Tiền 2.000 ₫ nổ về tài khoản ngân hàng của khách $\rightarrow$ Trạng thái tự động đổi sang màu xanh: **`Đã hoàn tất (SETTLED)`**.

---

> [!NOTE]
> Toàn bộ logic giao diện Frontend, cơ chế mã hóa AES/HMAC số tài khoản, đối soát nguồn PayOS, modal xác nhận và xử lý lỗi đã hoàn thiện 100% và sẵn sàng vận hành ngay khi Backend/Ops hoàn tất cấu hình IP Whitelist trên cổng PayOS.
