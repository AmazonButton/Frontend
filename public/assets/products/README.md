# THƯ MỤC CHỨA HÌNH ẢNH SẢN PHẨM CỦA BẠN

Đặt các file ảnh sản phẩm (PNG, JPG, WebP) của bạn vào thư mục này:
`frontend/public/assets/products/`

### Tên file gợi ý:
- `water.jpg` (hoặc `water-lavie.png`) -> Bình nước khoáng 20L
- `gas.jpg` (hoặc `gas-petro.png`) -> Bình gas an toàn
- `rice.jpg` (hoặc `rice-st25.png`) -> Bao gạo ST25
- `essentials.jpg` (hoặc `pantry.png`) -> Nhu yếu phẩm bếp

### Cách kết nối:
Mở file `frontend/src/data/productImages.ts` và đổi đường dẫn:
```ts
primaryUrl: '/assets/products/water.jpg',
```
Website sẽ tự động load ảnh từ máy của bạn!
