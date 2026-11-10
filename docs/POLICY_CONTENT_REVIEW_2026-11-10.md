# Rà soát nội dung và giao diện chính sách — 10/11/2026

## Phạm vi và nguồn nội dung

Nội dung hiện là dữ liệu tĩnh trong `src/content/public-content.ts`, có bản tương ứng ở `frontend/src/`. `PublicInfoPage` dùng chung cho các route `/help/:slug` và `/policies/:slug`; sidebar, breadcrumb, mục lục và liên kết cuối bài đều được dựng từ dữ liệu này. Footer dùng chung ở những trang được `App.tsx` cho phép hiển thị.

Chỉ sửa dữ liệu bài viết, trang đọc, CSS của trang đọc và cách trình bày Footer. Không sửa route trong App, backend, service API, auth, quyền truy cập, checkout, thanh toán, hoàn tiền, hợp đồng hay cách tính tiền.

Các file giao diện được phép sửa và đã sửa, ở cả `src/` và `frontend/src/`:

- `content/public-content.ts`
- `pages/PublicInfoPage.tsx`
- `pages/public-info.css`
- `layouts/Footer.tsx`
- `layouts/footer.css`

Tài liệu này ghi lại căn cứ và những chỗ cần người phụ trách xác nhận; không phải chính sách pháp lý hoặc bằng chứng giao dịch thật.

## Căn cứ đối chiếu

Đã đọc frontend thực tế và source backend mặc định trên GitHub qua kết nối chỉ đọc. SHA bên dưới là SHA **file**, không khẳng định commit đang được triển khai trên Render. Không tạo tài khoản, khoản thu, lệnh hoàn hoặc giao dịch thử.

| Nội dung | Căn cứ |
| --- | --- |
| Đơn mua hàng hỗ trợ COD và PayOS; PayOS cần đăng nhập; đơn có thể đã tạo trước khi mở cổng thất bại | `src/pages/customer/ShopPage.tsx`, `src/components/orders/StorefrontReceipt.tsx`; [PaymentsController](https://github.com/AmazonButton/Backend/blob/main/src/payments/payments.controller.ts), SHA `7117c2ee2a9f6825e35eb53fcdb97ce62a189266` |
| Hủy/từ chối đơn đã trả tiền có thể đưa thanh toán về `REFUND_PENDING`; chưa phải hoàn thành chi trả | [OrdersRepository](https://github.com/AmazonButton/Backend/blob/main/src/orders/orders.repository.ts), SHA `f54376229dbaebbec685d168d6cbb80d837e99c4`; [OrdersService](https://github.com/AmazonButton/Backend/blob/main/src/orders/orders.service.ts), SHA `e43d1f102452e43d5b2a464f0605365687634a14` |
| Mô hình mới tách nghĩa vụ phí thuê của cửa hàng và cọc của khách; vẫn có hợp đồng cũ thu gộp | [RentalsRepository](https://github.com/AmazonButton/Backend/blob/main/src/rentals/rentals.repository.ts), SHA `449cb0f35276fba0da22254ec5831bd1412e3519`; [RentalsService](https://github.com/AmazonButton/Backend/blob/main/src/rentals/rentals.service.ts), SHA `83184ad2dac5a1f16c60caa13ebdd50677e959cb` |
| Chính sách hợp đồng và số dư/tiến độ cọc có trong DTO; không suy từ tên gói hoặc tổng giá | [RentalResponseDto](https://github.com/AmazonButton/Backend/blob/main/src/rentals/dto/rental-response.dto.ts), SHA `246daa0b27deae0f8a7134a9c97ecdd4b7a0fbbc` |
| Khoản thu thuê/cọc có đối soát chứng từ; không phải doanh thu bán hàng tự cộng vào ví cửa hàng | [BillingChargesRepository](https://github.com/AmazonButton/Backend/blob/main/src/billing-charges/billing-charges.repository.ts), SHA `1480b6497f134b8e16bd8c1bfd514c21d9e66fcf`; [Store cash settlement](https://github.com/AmazonButton/Backend/blob/main/src/store-cash/store-cash-settlement.transaction.ts), SHA `bde8ed50cf90bb5f9085163430d698aff7700c70` |
| Xác minh ngân hàng và hoàn khoản chuyển xác minh có trạng thái riêng | `src/services/banking-flow.ts`, `src/services/store-finance-flow.ts`, `docs/BANKING_FRONTEND_ALIGNMENT_2026-11-09.md`, `docs/BANKING_BACKEND_REVIEW_2026-11-08.md` |
| Dữ liệu trình duyệt dùng cho phiên đăng nhập, giỏ hàng, tùy chọn và khôi phục | `src/context/AuthContext.tsx`, `src/pages/customer/ShopPage.tsx`, `src/services/rentals.service.ts`, `src/pages/profile/ProfilePage.tsx` |

## Phân tách các luồng tài chính

| Khoản tiền | Trách nhiệm nghiệp vụ | Nơi giải thích chính |
| --- | --- | --- |
| Tiền mua sản phẩm | Khách thanh toán đơn của cửa hàng qua phương thức được cung cấp; việc xác nhận và đối soát theo luồng đơn hàng | `/policies/payments` |
| Phí thuê nút | Cửa hàng → Nền tảng trong mô hình `STORE_RENT_CUSTOMER_DEPOSIT` | `/help/rentals` |
| Tiền cọc thiết bị | Khách → Cửa hàng phụ trách theo phân định nghiệp vụ được chủ hệ thống nêu trong yêu cầu; chứng từ thu/giữ/hoàn phải được đối chiếu theo hợp đồng | `/help/rentals` |
| Gói dịch vụ gian hàng | Cửa hàng → Nền tảng, khác với phí thuê thiết bị và cọc khách | `/help/rentals`, `/help/store-partners` |
| Chuyển xác minh ngân hàng | Phiên kiểm tra quyền sở hữu tài khoản; không phải tiền hàng, phí thuê hay tiền cọc | `/help/rentals#verification` |

Các mũi tên trên mô tả trách nhiệm nghiệp vụ, **không khẳng định tài khoản ngân hàng đích hoặc hướng dẫn chuyển thẳng cho một số tài khoản**. Source có kênh PayOS và sổ đối soát. Người nhận thực tế cần theo chứng từ hoặc phiên thanh toán được cung cấp. Không viết rằng mọi đơn mua hàng phải xác minh ngân hàng.

`LEGACY_CUSTOMER_RENT` vẫn có thể thu cả thuê và cọc từ khách; bài hướng dẫn giữ lưu ý đối chiếu chính sách từng hợp đồng, không đổi nghĩa vụ hợp đồng cũ bằng nội dung trang.

## Tổ chức lại nội dung

- Điều khoản: phạm vi, tài khoản, trách nhiệm thao tác, các bên, sử dụng nền tảng, xử lý vấn đề; không thêm nghĩa vụ tài chính mới.
- Quyền riêng tư: loại dữ liệu, mục đích, bộ nhớ trình duyệt, luồng chia sẻ đã kiểm tra, chức năng cập nhật và yêu cầu hỗ trợ; không hứa mã hóa, xóa tự động hoặc thời hạn lưu chưa xác nhận.
- Thanh toán & hoàn tiền: sáu mục dành cho **đơn mua sản phẩm**. COD và PayOS có nhóm trình bày riêng. Các vấn đề thuê/cọc/ngân hàng chuyển sang liên kết ngữ cảnh, không mô tả thành quy trình hoàn tiền đơn hàng.
- Bảo hành: giới hạn ở nút bấm vật lý; giữ điều kiện theo hồ sơ thiết bị/hợp đồng, không lấy mô tả quảng bá hoặc giá trị dự phòng trong giao diện làm chính sách chung.
- Thuê nút & hợp đồng: thêm bảng phân biệt bên trả/bên nhận, lưu ý hợp đồng cũ, thu/bàn giao/trả/hoàn và xác minh ngân hàng riêng.

Mọi section ID cũ được giữ, kể cả `rental` và `verification` trên trang thanh toán dưới dạng vùng liên kết ngữ cảnh. Các route và đích CTA trước đây được giữ lại.

## Những chi tiết cần xác nhận thủ công

1. **Hoàn tiền đơn mua hàng:** chưa có chính sách đã duyệt xác định đầy đủ điều kiện chấp thuận, mức hoàn/khấu trừ, bên chịu trách nhiệm, phương thức chi, thời gian xử lý và kênh tiếp nhận. Không suy `REFUND_PENDING` thành đã hoàn, hoặc coi API hủy link PayOS là API hoàn tiền.
2. **Nguồn đang triển khai:** cần xác nhận Render chạy phiên bản nào và hợp đồng thực tế dùng chính sách nào. Source GitHub mới không chứng minh mọi bản ghi cũ đã chuyển đổi.
3. **Giao diện thuê hiện có:** `CustomerRentalsPage.tsx` còn phần tổng hợp tiền thuê + tiền cọc, giảm 6/12 tháng và phần giới thiệu đổi 1–1/hoàn cọc. `rentals.service.ts` cũng có mô tả quyền lợi dự phòng. Không dùng những nội dung đó để tạo cam kết ở trang chính sách. Cần nghiệm thu riêng việc UI thu tiền khớp nghĩa vụ của từng hợp đồng; tác vụ này không sửa cách tính hoặc luồng thanh toán.
4. **Thông báo đơn đã hủy:** `CustomerOrdersPage.tsx` hiện có mô tả chung “không phát sinh thanh toán” cho đơn đã hủy. Không dùng mô tả đó làm bằng chứng hoàn tiền; cần rà soát riêng trường hợp đơn đã trả tiền trước khi hủy. Không chỉnh màn hình này trong tác vụ hiện tại.
5. **Bảo hành:** cần bản điều kiện áp dụng theo thiết bị/gói: thời hạn, phạm vi, loại trừ, phí nếu có và nơi tiếp nhận thực tế. Không tự thêm cam kết trọn đời, đổi miễn phí trong mọi trường hợp hoặc thời gian xử lý.
6. **Quyền riêng tư:** cần đơn vị chịu trách nhiệm dữ liệu, kênh chuyên trách, thời hạn lưu trữ, quyền/yêu cầu xử lý và thời hạn phản hồi đã được xác nhận. Không tạo email/hotline mẫu.

## Giao diện và kiểm tra

- Sidebar giữ bốn liên kết chính sách, chọn đúng trang; trên màn hình nhỏ chuyển thành các liên kết gọn, không làm hẹp bài viết.
- Mục lục có đích thật, giữ section ID cũ, xử lý hash khi mở trực tiếp/Back/Forward, bù header bằng scroll margin, focus vào đề mục và tôn trọng reduced motion.
- Footer trang chủ giữ nguyên HTML hiển thị; chỉ các route `/policies/…` dùng Footer gọn, chuyển CTA thành liên kết trong cột thương hiệu và giữ mọi đích đến, bản quyền, thông tin pháp lý.
- `npm.cmd run build` tại thư mục gốc và `frontend/`: **đều đạt**, gồm TypeScript và Vite production build.
- Kiểm tra render bằng React/StaticRouter trên nguồn thật: **16 lượt render bài viết đạt** (8 bài × 2 cây frontend); mỗi trang có một H1, ID không trùng, mục lục có đích, section ID và CTA cũ được giữ. Sidebar chọn đúng trang.
- **16 lượt đối chiếu Footer đạt**: HTML trang chủ, shop, trang hướng dẫn và khách hàng không thay đổi; cả bốn trang chính sách giữ đủ **17 liên kết với nhãn/đích cũ** ở mỗi cây frontend. CSS Footer cũ giữ nguyên, chỉ thêm selector cho biến thể chính sách; hover, transition và reduced-motion cũ được giữ.
- Mô phỏng hook/router/DOM trên component thật: **4 lượt đạt** (hai tùy chọn motion × hai cây frontend), kiểm tra bấm mục lục, giữ query, focus đề mục, cuộn có/không chuyển động, click có phím bổ trợ, hash khôi phục, anchor cũ, hash sai định dạng, hash qua bài khác và bài không tồn tại. Đây là kiểm tra mô phỏng, không phải kiểm thử trình duyệt thật.
- Đối chiếu SHA-256 với snapshot trước tác vụ của **580 file nguồn**: chỉ 10 file frontend nằm trong phạm vi trên thay đổi; hai cây frontend có nội dung tương ứng giống nhau. Backend, App/router, auth, API service và các màn hình giao dịch không đổi trong tác vụ này.
- Hai package không khai báo script lint; không ghi nhận lint đã chạy.
- Đã kiểm tra kết nối trình duyệt; công cụ báo **The browser access host is unavailable**. Chưa kiểm chứng trực quan desktop/tablet/mobile, đo overflow thực tế hay nhấp toàn bộ liên kết trên trình duyệt. Không coi build hoặc mô phỏng là đã hoàn thành kiểm tra đó.
- Không coi các kiểm tra trên là thử giao dịch thật, xác nhận môi trường Render hoặc kiểm chứng pháp lý của nội dung.

## Bổ sung: menu chung và tách nội dung theo nghiệp vụ

Thực hiện theo xác nhận tiếp theo của người dùng: tách rõ các nhóm nội dung, không tạo một trang mới cho mỗi đoạn nhỏ.

- Các bài dùng chung menu gồm **Mua hàng**, **Thiết bị & hợp đồng**, **Dành cho cửa hàng**, **Thông tin chung**. Giữ các trang có sẵn và mục lục của từng bài.
- Có lối vào trực tiếp `/help/rentals#verification` cho ngân hàng/xác minh và `/help/store-partners#plans` cho gói dịch vụ cửa hàng. Đây là các đề mục của bài hiện có, không thêm route giao dịch hoặc trang xử lý mới.
- Chuyển phần giải thích gói dịch vụ gian hàng ra khỏi bảng thuê/cọc, đặt trong đề mục Gói dịch vụ cửa hàng. Bảng thuê chỉ còn phí thuê và tiền cọc. Bài hợp đồng vẫn giữ liên kết sang thông tin gian hàng và bảo hành.
- Desktop chọn đúng trang hoặc đề mục, sidebar có giới hạn chiều cao để không vượt màn hình. Tablet/mobile dùng select có nhãn và nhóm lựa chọn, vùng bấm tối thiểu 44px; mỗi lựa chọn giữ đúng URL của menu desktop.
- Thêm đường phân cách nhẹ giữa các đề mục để dễ đọc. Không thay nội dung chính sách thanh toán tiền hàng, cách tính phí, trách nhiệm tài chính hoặc điều kiện hợp đồng.
- Chỉ sửa `content/public-content.ts`, `pages/PublicInfoPage.tsx`, `pages/public-info.css` ở cả hai cây frontend; bổ sung phần ghi nhận này. Footer và các file animation giữ nguyên.

Kiểm chứng cho lần bổ sung này:

- TypeScript/Vite build ở root và `frontend/`: **đều đạt**; `git diff --check`: đạt.
- React/StaticRouter: **16 lượt render bài** và **20 lượt kiểm tra mục được chọn** đạt; mục lục có đích, ID cũ và CTA được giữ, menu có đúng các URL/anchor tồn tại.
- Mô phỏng component/router: **40 lượt chuyển bằng select** đạt ở hai cây frontend, với hai tùy chọn motion; các lối vào xác minh/gói dịch vụ cuộn đến đúng đề mục, mục được chọn theo đúng hash, chuyển bằng mục lục cũng đồng bộ lựa chọn.
- Snapshot SHA-256 trước lần bổ sung của **584 file nguồn** xác nhận chỉ 6 file dữ liệu/giao diện bài viết nêu trên thay đổi. Backend, router, auth, API, giao dịch và animation Footer không đổi.
- Công cụ trình duyệt tiếp tục báo `The browser access host is unavailable`; chưa kiểm tra trực quan hoặc đo bố cục thực tế trên các kích thước màn hình. Không coi mô phỏng là kiểm thử trình duyệt thật.
