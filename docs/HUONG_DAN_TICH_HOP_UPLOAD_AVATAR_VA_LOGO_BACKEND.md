s t# Hướng Dẫn Kỹ Thuật: Triển Khai Tính Năng Upload Ảnh Đại Diện & Logo Lên Cloud / Database

> **Dành cho:** Backend Team & DevOps  
> **Mục tiêu:** Cung cấp API upload file ảnh đại diện (User Avatar) và Logo đại lý (Store Logo) từ máy tính lên Cloud Storage (Cloudinary/S3) và lưu vĩnh viễn vào PostgreSQL.  
> **Ngày lập:** 23/11/2026.

---

## 1. Hiện trạng hệ thống (Current Status)

### 1.1. Những gì Backend ĐÃ CÓ:
* **Database:** Bảng `users` trong PostgreSQL đã có sẵn cột `avatar_url VARCHAR(512)`.
* **API cập nhật URL:** Endpoint `PATCH /api/v1/auth/profile` đã hỗ trợ nhận `{ avatarUrl: "https://..." }` và lưu thành công vào Database.
* **Google OAuth:** Người dùng đăng nhập bằng Google đã tự động được lưu ảnh đại diện Google vào cột `avatar_url`.

### 1.2. Điểm nghẽn cần Backend bổ sung:
* **Chưa có API upload file ảnh Avatar cho người dùng:**
  * Người dùng chọn file ảnh từ máy tính (`.jpg`, `.png`). Để lưu vào Database, file này cần được upload lên Cloud (Cloudinary/S3) để lấy đường link URL `https://...`.
  * API upload hiện tại (`POST /api/v1/media/upload`) chỉ dành cho Cửa hàng upload ảnh sản phẩm; **đang chặn người dùng vai trò `CUSTOMER` (`403 Forbidden`)** và chặn upload ra ngoài thư mục sản phẩm.
* **Hệ quả:** Frontend hiện tại buộc phải lưu tạm file ảnh dạng Base64 vào `localStorage` của trình duyệt. Khi người dùng đổi máy, mở điện thoại, mở tab ẩn danh hoặc tài khoản Admin xem danh sách sẽ **không thấy được ảnh đại diện/logo thật**.

---

## 2. Yêu cầu triển khai chi tiết cho Backend Team

Backend Team có thể lựa chọn 1 trong 2 phương án dưới đây (khuyến nghị **Phương án 1** vì bảo mật, gọn gàng và tự động cập nhật Database):

---

### 👉 PHƯƠNG ÁN 1 (Khuyến nghị): Thêm API chuyên dụng Upload Avatar

Tạo endpoint chuyên dụng cho phép người dùng đang đăng nhập upload 1 file ảnh đại diện:
* **Method:** `POST`
* **Route:** `/api/v1/auth/avatar` (hoặc `/api/v1/users/me/avatar`)
* **Bảo vệ:** `@UseGuards(JwtAuthGuard)` *(Cho phép TẤT CẢ các role: CUSTOMER, STORE_OWNER, STORE_STAFF, ADMIN,...)*
* **Content-Type:** `multipart/form-data`
* **Field name:** `file` (Ảnh JPG, PNG, WEBP, tối đa 3MB).

#### Logic xử lý của Backend:
1. Nhận file qua Multer `FileInterceptor('file')`.
2. Kiểm tra dung lượng (tối đa 3MB) và kiểm tra Magic Bytes định dạng ảnh.
3. Upload buffer lên Cloudinary vào folder `avatars` (tên file theo `user_${userId}_${Date.now()}`).
4. Lưu URL bảo mật (`secure_url`) vừa upload thẳng vào cột `avatar_url` của user trong PostgreSQL:
   ```typescript
   await prisma.user.update({
     where: { userId: currentUserId },
     data: { avatarUrl: uploadResult.secureUrl }
   });
   ```
5. Phản hồi HTTP 200/201:
   ```json
   {
     "success": true,
     "message": "Cập nhật ảnh đại diện thành công",
     "data": {
       "avatarUrl": "https://res.cloudinary.com/.../avatars/user_7.jpg"
     }
   }
   ```

#### Mã nguồn mẫu tham khảo (NestJS):
```typescript
// Trong auth.controller.ts:
@UseGuards(JwtAuthGuard)
@Post('avatar')
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  }),
)
async uploadAvatar(
  @UploadedFile() file: Express.Multer.File,
  @Request() req: any,
) {
  if (!file) {
    throw new BadRequestException('Vui lòng chọn tệp hình ảnh hợp lệ');
  }
  const rawUserId = req.user?.id || req.user?.userId;
  return this.authService.uploadAndSaveAvatar(rawUserId, file);
}

// Trong auth.service.ts:
async uploadAndSaveAvatar(userId: string | bigint, file: Express.Multer.File) {
  const targetUserId = BigInt(userId);
  
  // 1. Upload lên Cloudinary
  const uploadResult = await this.mediaService.uploadImageBuffer(
    file,
    'avatars',
  );

  // 2. Lưu trực tiếp vào Database
  const updatedUser = await this.authRepo.updateProfile(targetUserId, {
    avatarUrl: uploadResult.secureUrl,
  });

  return {
    success: true,
    message: 'Cập nhật ảnh đại diện thành công',
    data: {
      avatarUrl: updatedUser.avatarUrl,
    },
  };
}
```

---

### 👉 PHƯƠNG ÁN 2: Mở rộng quyền cho API `POST /api/v1/media/upload`

Nếu không muốn tạo endpoint mới, chỉ cần điều chỉnh cấu hình quyền trong `backend/src/media/media.controller.ts`:

1. **Thêm `CUSTOMER` vào RolesGuard:**
   ```typescript
   @Roles(
     'CUSTOMER',
     'STORE_OWNER',
     'STORE_MANAGER',
     'STORE_STAFF',
     'STAFF_ORDER',
     'STAFF_INVENTORY',
     'STAFF_DELIVERY',
     'SUPER_ADMIN',
     'SYSTEM_ADMIN',
   )
   @Post('upload')
   ```
2. **Cho phép thư mục `avatars`:**
   Cho phép người dùng upload vào folder `avatars` thay vì chỉ bắt buộc prefix `stores/{storeId}/products`.
3. Khi đó:
   * Bước 1: Frontend gọi `POST /api/v1/media/upload` lấy link `secureUrl`.
   * Bước 2: Frontend gọi `PATCH /api/v1/auth/profile` với `{ avatarUrl: secureUrl }`.

---

## 3. Đối với Logo Cửa Hàng (`Store Logo`)

Hiện tại trong `backend/prisma/schema.prisma`, bảng `Store` chỉ có:
```prisma
model Store {
  storeId     BigInt   @id @default(autoincrement()) @map("store_id")
  ownerUserId BigInt   @map("owner_user_id")
  name        String   @db.VarChar(255)
  code        String   @unique @db.VarChar(50)
  phone       String   @db.VarChar(20)
  address     String
  // ... CHƯA CÓ CỘT LOGO
}
```

* **Đề xuất nâng cấp:**
  1. Thêm trường `logoUrl String? @map("logo_url") @db.VarChar(512)` vào model `Store`.
  2. Cho phép cập nhật trường `logoUrl` qua `PATCH /api/v1/stores/me`.
  3. Khi đó, Chủ cửa hàng cập nhật logo sẽ lưu độc lập với ảnh cá nhân của người đại diện.

---

## 4. Kế hoạch phối hợp từ phía Frontend

* Ngay khi Backend triển khai xong 1 trong 2 phương án trên và đẩy lên Render:
  1. Phía Frontend sẽ loại bỏ hoàn toàn cơ chế lưu ảnh Base64 vào `localStorage`.
  2. Chuyển sang gửi file ảnh trực tiếp qua API multipart của Backend.
  3. Hiển thị ảnh URL chính thức đồng bộ toàn bộ hệ thống (trên cả điện thoại, máy tính và giao diện quản trị viên Admin).
