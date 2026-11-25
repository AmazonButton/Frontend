# BÁO CÁO CHI TIẾT LỖI XÁC THỰC OTP SỐ ĐIỆN THOẠI (FIREBASE PHONE AUTH) VÀ GIẢI PHÁP XỬ LÝ

- **Thời gian lập báo cáo:** 25/11/2026
- **Môi trường:** Production & Localhost (`iot-button-e59d7.firebaseapp.com` & `backend-fae8.onrender.com`)
- **Đối tượng:** Đội ngũ Backend, DevOps và Quản trị viên Firebase Project

---

## 1. TỔNG QUAN VẤN ĐỀ (OVERVIEW)

Khi người dùng thực hiện tính năng **"Bảo vệ tài khoản bằng số điện thoại"** hoặc **"Đăng nhập bằng số điện thoại"**, hệ thống gọi API Firebase Authentication để gửi mã xác thực SMS OTP tới số điện thoại người dùng (ví dụ: `+84373343839`). 

Yêu cầu gửi OTP bị Google Firebase từ chối ngay lập tức với mã lỗi `400 Bad Request`.

---

## 2. DỮ LIỆU KỸ THUẬT VÀ LOG LỖI CHÍNH XÁC (ERROR DETAILS)

### Request gửi sang Firebase API:
* **Method:** `POST`
* **Endpoint:** `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=AIzaSyDXUrGMuz8euCQ_pkVgR7PrgDMrAIQzu24`
* **Firebase Project ID:** `iot-button-e59d7`
* **Payload:**
  ```json
  {
    "phoneNumber": "+84373343839"
  }
  ```

### Response trả về từ Google Firebase:
* **HTTP Status Code:** `400 Bad Request`
* **Response Body:**
  ```json
  {
    "error": {
      "code": 400,
      "message": "BILLING_NOT_ENABLED",
      "errors": [
        {
          "message": "BILLING_NOT_ENABLED",
          "domain": "global",
          "reason": "invalid"
        }
      ]
    }
  }
  ```

---

## 3. NGUYÊN NHÂN KỸ THUẬT GỐC RỄ (ROOT CAUSE)

1. **Chính sách của Google Firebase Identity Platform:**
   - Để gửi tin nhắn SMS thật (Real SMS) qua mạng viễn thông tới số điện thoại di động tại Việt Nam (+84), Google Firebase yêu cầu dự án phải được liên kết tài khoản thanh toán Cloud Billing (**Gói Blaze - Pay as you go**).
2. **Hiện trạng cấu hình:**
   - Dự án Firebase `iot-button-e59d7` hiện đang ở gói miễn phí (**Spark Plan - Free tier**).
   - Ở gói Spark, Google **chặn 100% các yêu cầu gửi SMS ra nhà mạng viễn thông** để tránh rủi ro phát sinh cước viễn thông không mong muốn, và trả về mã lỗi cụ thể: `BILLING_NOT_ENABLED`.

---

## 4. HƯỚNG DẪN XỬ LÝ CHI TIẾT DÀNH CHO BACKEND & DEVOPS

Backend / Quản trị viên Firebase có thể chọn 1 trong 2 giải pháp dưới đây tùy thuộc vào giai đoạn thử nghiệm hay triển khai thật:

---

### 👉 Giải pháp 1: Khai báo "Số điện thoại thử nghiệm" (KHUYÊN DÙNG ĐỂ TEST - Miễn phí 100%)
*Giải pháp này cho phép đội ngũ test toàn trình luồng OTP mà không tốn chi phí SMS và không cần nâng cấp gói Blaze.*

1. Đăng nhập vào trang quản trị: [Firebase Console](https://console.firebase.google.com/).
2. Chọn dự án: **`iot-button-e59d7`**.
3. Tại menu bên trái, vào **Build** $\rightarrow$ **Authentication** $\rightarrow$ Chọn tab **Sign-in method**.
4. Bấm vào nhà cung cấp **Phone** (Số điện thoại).
5. Kéo xuống mục **Phone numbers for testing (Số điện thoại dùng để kiểm thử)**:
   - Bấm **Thêm số điện thoại**.
   - **Số điện thoại:** Nhập `+84373343839` (hoặc các số điện thoại của đội tester/dev, định dạng quốc tế có `+84`).
   - **Mã xác thực 6 số (Verification code):** Đặt mã cố định, ví dụ `123456` hoặc `666888`.
   - Bấm **Save / Lưu**.
6. **Kết quả:** Khi người dùng nhập số điện thoại này trên Web, Firebase sẽ lập tức cho qua bước gửi OTP mà không bị lỗi `BILLING_NOT_ENABLED`. Người dùng chỉ cần nhập đúng mã cố định `123456` là hoàn tất xác minh 100%.

---

### 👉 Giải pháp 2: Nâng cấp dự án lên gói Blaze (Nếu muốn gửi SMS thật tới điện thoại)
*Áp dụng khi hệ thống chuẩn bị Go-Live Production và muốn tin nhắn SMS thật nổ về điện thoại người dùng.*

1. Trên [Firebase Console](https://console.firebase.google.com/), chọn dự án **`iot-button-e59d7`**.
2. Ở góc dưới cùng bên trái thanh điều hướng, bấm vào nút **Upgrade** (bên cạnh chữ *Spark plan*).
3. Chọn gói **Blaze (Pay as you go)**.
4. Liên kết tài khoản thanh toán Google Cloud Billing (sử dụng thẻ Visa / Mastercard).
5. *(Khuyến nghị)* Thiết lập hạn mức cảnh báo ngân sách (Budget Alert) tại Google Cloud Console (ví dụ 10$ – 20$) để kiểm soát chi phí SMS.

---

## 5. KIỂM TRA ĐỐI SOÁT PHÍA BACKEND API

Sau khi thực hiện Giải pháp 1 hoặc Giải pháp 2:
1. Khi Client xác minh OTP thành công với Firebase, Client sẽ nhận được `credentialToken` (`idToken`) và gửi về Backend tại endpoint:
   ```http
   POST /api/v1/auth/phone/verify
   Authorization: Bearer <user_jwt_token>
   Content-Type: application/json

   {
     "credentialToken": "<firebase_id_token>"
   }
   ```
2. Backend sử dụng `firebase-admin` (`admin.auth().verifyIdToken(...)`) để giải mã token, lấy số điện thoại đã chứng thực và cập nhật trường `phoneVerifiedAt = NOW()` trong bảng `users`.
