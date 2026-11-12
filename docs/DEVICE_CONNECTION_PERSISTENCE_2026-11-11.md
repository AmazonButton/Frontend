# Đồng bộ nút bấm, BLE và Wi-Fi — 11/11/2026

## Luồng được giữ và hoàn thiện

1. Admin tạo/phân bổ nút trên backend. Mỗi nút cần có deviceId riêng đúng với ID firmware trả về qua characteristic BLE FFF1. Không lấy tên quảng bá Bluetooth hay mã mẫu thay ID.
2. Cửa hàng kết nối BLE → đọc ID thật → lookup → GET chi tiết, kiểm tra storeId thuộc cửa hàng đang đăng nhập → hoàn tất nhận diện. Modal của cửa hàng không có bước Wi-Fi hoặc chọn sản phẩm; khách làm hai bước đó khi mang nút về nhà. Không POST tạo nút khác hoặc tự đổi trạng thái kho thành ACTIVE.
3. Khách kết nối cùng nút: nếu nút đã thuộc khách thì đọc lại đúng bản ghi. Nếu chưa thuộc khách, dùng mã ghép nối/QR do cửa hàng cấp qua quy trình provisioning hiện có. BLE đơn thuần không thay quyền sở hữu hoặc bỏ qua token.
4. Xác nhận provisioning dùng cùng deviceId, customerId, storeId và sản phẩm thuộc cửa hàng của nút. Sau khi lưu, đọc lại API; chỉ báo thành công khi dữ liệu khớp.
5. Firmware nhận Wi-Fi qua FFF2 và tự khởi động lại. Việc ngắt BLE sau đó không xóa nút, sản phẩm, cửa hàng hoặc tài khoản. Frontend chỉ báo đã truyền cấu hình khi lệnh ghi có kết quả; trạng thái Internet vẫn dựa trên heartbeat/backend.

## Các lỗi frontend đã sửa

- Bỏ nhánh giả lập lookup thành công cho mã mẫu và nhánh báo đã gán sản phẩm dù API lỗi. Không đưa nút giả vào danh sách rồi mất khi F5.
- Đọc mã từ JSON trong BLE FFF1, đối chiếu lại với backend. Không suy ID từ device.name và không dùng BTN-8829-WTR/SOB-WHITE-PRO-01 làm fallback.
- Bảo toàn quyền sở hữu, ID hàng trong lô và trạng thái kho ban đầu khi chỉ nhận diện BLE. Dấu “Đã nhận diện BLE” tách riêng khỏi trạng thái online/ACTIVE.
- Sửa byte Wi-Fi theo firmware đang có: BLE FFF2 nhận `SSID:PASSWORD`, **không có tiền tố WIFI: và không có ký tự xuống dòng**. Firmware tách ở dấu hai chấm đầu tiên và lưu phần còn lại thành mật khẩu; tiền tố/đuôi cũ có thể làm sai cả SSID và mật khẩu. USB Serial vẫn có giao thức WIFI:SSID:PASSWORD riêng.
- Không thử ghi vào characteristic thông tin FFF1 khi không tìm thấy FFF2. Không nuốt lỗi GATT hoặc chỉ chạy hoạt ảnh rồi báo đã kết nối mạng.
- Khách dùng PUT `/devices/:id/customer-config` với buttonName, productId, quantity. Cửa hàng dùng POST `/devices/:id/assign-product` với productId, customName, quantity. Giữ ID số lớn dưới dạng chuỗi, kiểm tra sản phẩm ACTIVE và cùng storeId trước khi ghi.
- Sửa form cấu hình khách trước đây gửi customName/defaultQuantity/status ngoài DTO. Bộ chọn chỉ hiển thị sản phẩm cùng cửa hàng. Trạng thái kích hoạt/tạm ngừng hiển thị theo backend; không giả rằng khách tự bật/tắt được qua DTO không hỗ trợ.
- API provisioning confirmation đang upsert ánh xạ. Nếu còn ánh xạ cũ sau khi khách chọn sản phẩm khác, frontend hoàn tất cấu hình bằng API customer-config đã có, rồi xác nhận chỉ còn đúng sản phẩm đã chọn. Không đổi cửa hàng hoặc tạo nút mới.
- Chuẩn hóa products[] của DTO thiết bị thành dữ liệu sản phẩm dùng ở hai màn hình, tránh cửa hàng hiển thị thiếu hoặc khác sản phẩm khách vừa chọn.
- Lưu tiến trình ghép nối theo userId/customerProfileId; không lưu token ghép nối, HMAC hoặc mật khẩu Wi-Fi. Khi F5, đọc quyền sở hữu thực tế trước; phiên đã gửi confirmation không tự gửi lại confirmation. Nút kiểm tra/hoàn tất chỉ xử lý cùng nút đã xác nhận quyền truy cập.
- Khôi phục danh sách từ cache theo tài khoản/phạm vi cửa hàng; dữ liệu backend vẫn là nguồn quyết định. GET bắt đầu trước khi nhận diện/ghép nối không được ghi đè dữ liệu mới hoặc làm nút vừa lưu biến mất.
- Danh sách lỗi lần đầu hiển thị “chưa đọc được”, không kết luận “chưa có nút”. Lỗi Wi-Fi hoặc tải dữ liệu không gọi unclaim/delete/factory-reset.

## Tải trang và đồng bộ

- Danh sách nút hiển thị ngay khi API thiết bị xong; không chờ API đơn hàng hoặc sản phẩm chậm hơn.
- Giữ dữ liệu đã tải khi một API khác lỗi, gom các lần refresh trùng nhau và bỏ kết quả của trang/tài khoản cũ.
- Modal kết nối tải bằng lazy import và chỉ mount khi mở; bỏ các request catalog phát sinh từ modal ẩn. Cache hợp lệ được hiển thị ngay khi quay lại trang.
- Khách giữ socket/heartbeat để cập nhật nhanh; polling dự phòng đổi từ 4 giây gọi cả ba API sang 15 giây, không đọc catalog lặp lại ở mỗi lượt polling, dừng polling tự động khi tab ẩn hoặc đang backoff.
- Cửa hàng lắng nghe thêm DEVICE_PROVISIONED đúng event backend hiện phát sau confirmation, cùng sự kiện cập nhật cục bộ. Polling dự phòng hiện có vẫn được giữ.
- Đây là tối ưu frontend trên hai màn hình nút bấm và modal kết nối; chưa đo độ trễ trên máy/trình duyệt và mạng thật, không khẳng định đã tối ưu toàn bộ server hoặc mọi trang của hệ thống.

## Bổ sung: kích hoạt và trạng thái chạy thực tế

- Hai role dùng chung `device-runtime.ts`. Chỉ hiện **Đang hoạt động** khi backend trả `status: ACTIVE`, có khách sở hữu, cửa hàng và sản phẩm đã cấu hình, `canOrder: true`, hợp đồng/quyền đặt hàng không bị chặn và có `lastSeenAt` hợp lệ trong 25 giây gần nhất. Đây là ngưỡng kiểm tra mạng đã có ở màn hình cửa hàng, nay dùng thống nhất; cần nghiệm thu với chu kỳ heartbeat thực tế của thiết bị.
- Chưa ACTIVE → **Chưa kích hoạt**; ACTIVE nhưng chưa có khách → **Chờ khách cấu hình**; thiếu sản phẩm → **Chưa cấu hình xong**; quyền bị chặn → **Chưa thể đặt hàng**, kèm lý do backend. Không có xác nhận `canOrder` → **Chờ xác nhận**. Thiếu/hết hạn heartbeat → **Chờ kết nối**. Không dùng `updatedAt`, tên Bluetooth hoặc kết quả ghi Wi-Fi để suy ra online.
- Đồng hồ frontend kiểm tra lại mỗi 5 giây, không gọi thêm API; dừng tín hiệu mạng sẽ làm nhãn đổi sau khoảng 25–30 giây tính từ heartbeat cuối. Không xóa bản ghi, ngắt quyền sở hữu hoặc đổi trạng thái backend khi mất mạng.
- Lưu riêng dữ liệu heartbeat quan sát được trong phiên trang để GET danh sách không xóa mất `lastSeenAt` khi response bỏ trường này. Heartbeat không được ghi đè trạng thái kích hoạt, chủ sở hữu, cửa hàng hoặc sản phẩm từ API mới. Bỏ timestamp sai/tương lai và heartbeat cũ đến trễ.
- Chỉ số “Đang hoạt động” ở hai trang đếm cùng điều kiện với nhãn trên từng nút. Nút chỉ nhận diện BLE tại cửa hàng không tự được đếm là đang chạy.
- Lỗi đặt/thử đơn hiển thị chữ nhỏ tại đúng nút, gồm cả response HTTP 200 với `success: false`; không dùng alert trình duyệt cho hai thao tác này. Nút chưa được phép đặt bị chặn, nhưng vẫn mở được cài đặt/Wi-Fi để hoàn tất cấu hình.
- Đặt trên web và mô phỏng đặt hàng vẫn là thao tác API hiện có, tách khỏi kết nối vật lý: khi quyền backend hợp lệ vẫn có thể đặt trên web lúc nút chờ mạng. Các thao tác đó không làm nhãn chuyển online và không chứng minh nút vật lý gửi được đơn.

## Giới hạn cần backend/phần cứng xác nhận, chưa sửa backend

1. Backend đã lưu bản ghi nút từ phân bổ admin. Trong các controller đã đối chiếu chưa có API riêng ghi nhận biên bản “cửa hàng đã kiểm tra vật lý qua BLE”. Dấu nhận diện BLE bổ sung chỉ lưu theo trình duyệt/tài khoản; không phải trạng thái kho mới trên backend. Nếu cần đồng bộ dấu nhận hàng này giữa nhiều máy, backend phải công bố API/trường riêng. Frontend không tự đặt endpoint hoặc ép ACTIVE để thay biên bản.
2. BLE không duy trì qua F5 hoặc khi nút ngủ/khởi động lại. Bản ghi nút vẫn lưu ở backend; muốn gửi Wi-Fi tiếp thì kết nối BLE lại cùng ID.
3. Firmware đang có phát byte 0x03 ngay sau lưu Wi-Fi vào NVS, trước khi restart, chưa chứng minh đã nối router/MQTT. Frontend không dùng byte đó để tự kết luận cloud online.
4. Backend change-wifi hiện chỉ trả provisioningStatus PROVISIONING; source đã đọc không ghi Wi-Fi xuống phần cứng hoặc lưu cấu hình bền vững. Vì vậy màn hình đang sửa truyền trực tiếp qua BLE/USB; chỉ chọn nút trên web không thể thay Wi-Fi trong ESP32. Không đưa mật khẩu vào cache hoặc gửi lên endpoint chỉ báo trạng thái.
5. USB hiện chưa có bước đối chiếu ID phần cứng tương đương BLE FFF1. Sau khi ghi USB, thông báo chỉ xác nhận đã gửi qua cổng người dùng chọn, cần kiểm tra đúng nút và heartbeat. Không giả danh tính hoặc cloud online.
6. Mỗi nút phải được flash ID và khóa HMAC đúng với bản ghi admin. Nếu nhiều ESP32 dùng cùng ID mặc định, frontend không thể tạo danh tính riêng đúng hệ thống chỉ từ tên Bluetooth; cần đội phần cứng/vận hành kiểm tra.
7. assign-product/customer-config hiện chưa thấy phát socket thông báo thay đổi mapping trong source service, dù có invalidate cache. Hai role đọc lại backend bằng sự kiện provisioning và polling; nếu cần cập nhật tức thời trên mọi trình duyệt sau mọi lần sửa cấu hình, backend nên phát event sau commit. Không sửa backend để thêm event trong lần này.
8. Trong source backend local đã đọc, `formatButton` chưa trả `lastSeenAt`; `/devices/:id/telemetry` còn trả thời gian hiện tại và các số liệu mặc định nên frontend không dùng endpoint đó để xác nhận online. `IotService.handleEvent(HEARTBEAT)` có phát `DEVICE_HEARTBEAT` đến store/customer. Cần kiểm tra thiết bị/đường truyền thật có gửi sự kiện này đều đặn hay không; file firmware local được đọc chưa thấy gửi HEARTBEAT định kỳ. Khi chưa có bằng chứng, giao diện giữ **Chờ kết nối**, không dựng tín hiệu thay backend hoặc firmware. Sau F5 có thể cần đợi heartbeat mới.

## Kiểm tra tay với nút thật

1. Admin giao ít nhất hai nút ID khác nhau cho cửa hàng. Ghi lại deviceId/buttonId; các nút chưa ghép khách giữ trạng thái backend hiện có.
2. Cửa hàng mở Danh sách nút → Kết nối BLE, chọn một nút. Kiểm tra ID đọc thật khớp nút trong lô; hoàn tất nhận diện ngay, không nhập Wi-Fi. F5 vẫn có đúng nút trong kho, không thêm bản ghi trùng. Nút của cửa hàng khác phải bị chặn.
3. Khách mở cùng nút qua BLE, nhập token/QR cửa hàng cấp, chọn sản phẩm cùng cửa hàng và xác nhận lưu. Kiểm tra request confirmation và GET chi tiết có cùng deviceId/buttonId, storeId đúng, customerId đúng và đúng productId.
4. F5 ngay sau lưu hoặc giả lập mất response: trang kiểm tra ghép nối đọc lại nút, không tự gửi confirmation lần hai. Nếu còn cấu hình chưa khớp, dùng nút kiểm tra/hoàn tất cùng yêu cầu đã gửi.
5. Gửi Wi-Fi qua BLE. So sánh ID trước khi ghi, kiểm tra mật khẩu có dấu hai chấm vẫn được giữ nguyên. Ngắt BLE/restart không làm mất nút. Chỉ xác nhận Internet khi có heartbeat thực tế.
6. Mở role cửa hàng ở trình duyệt khác: chờ sự kiện/polling và đối chiếu sản phẩm, số lượng. Bấm nút vật lý khi hợp đồng và quyền đặt hàng hợp lệ; đơn phải vào đúng cửa hàng và sản phẩm. Không dùng nút mô phỏng frontend để thay nghiệm thu phần cứng.
7. Thử tắt mạng API, sai token, khác cửa hàng, không đọc được FFF1, lỗi ghi FFF2. Giao diện phải giữ dữ liệu đã có và báo lỗi thật, không hiện thành công hoặc xóa nút.
8. Với nút chưa ACTIVE, nhận diện BLE ở cửa hàng không được đổi nhãn thành đang hoạt động và không có form Wi-Fi/sản phẩm. Sau khi khách cấu hình đúng và backend xác nhận quyền, kiểm tra heartbeat thật để cả hai role hiện **Đang hoạt động**. Tắt nguồn nút, đợi hơn 30 giây: nhãn chuyển **Chờ kết nối**, nút và sản phẩm vẫn còn. Bật lại và có heartbeat mới: nhãn trở lại hoạt động. Khóa nút/hết hạn hợp đồng phải chặn quyền dù heartbeat vẫn đến.

## Nguồn và phạm vi kiểm chứng

- `hardware/SmartOrderButton/SmartOrderButton.ino`: chỉ đọc giao thức FFF1/FFF2/FFF3 và Serial; không chỉnh firmware.
- [DevicesController](https://github.com/AmazonButton/Backend/blob/main/src/devices/devices.controller.ts), blob SHA `42faba0851e13d6192eb23fb45a827f5f5579440`.
- [DevicesService](https://github.com/AmazonButton/Backend/blob/main/src/devices/devices.service.ts), blob SHA `c080d418617e366e62b03e169911e03cbea1ebf3`.
- [ProvisioningService](https://github.com/AmazonButton/Backend/blob/main/src/devices/provisioning.service.ts), blob SHA `b48e1ee6e5b68e3f35b5f0a2ab03569865a98e37`.
- [ProvisioningRepository](https://github.com/AmazonButton/Backend/blob/main/src/devices/provisioning.repository.ts), blob SHA `96c05a661e43ba7acf3dd40e8c880f6b299fb977`.
- [Device DTO](https://github.com/AmazonButton/Backend/blob/main/src/devices/dto/devices.dto.ts), blob SHA `237056d769afda9cad9d8e430fc5e95fc637f8cb`.

Kiểm thử dùng API và BLE mô phỏng để chạy mã thật frontend; không kết nối ESP32 hay tạo đơn thật trên server. Các bước Wi-Fi, HMAC, heartbeat và đặt hàng vật lý ở trên cần nghiệm thu với thiết bị thực tế.

Kết quả cập nhật: 161 kiểm thử liên quan thiết bị, trạng thái chạy, ghép nối, tải dashboard, ánh xạ sản phẩm, đơn hàng và giao hàng đều đạt. Kiểm thử mới chạy bộ tính trạng thái, đồng bộ heartbeat, render thẻ nút và các handler đặt/thử đơn thực tế với API mô phỏng. Chưa nghiệm thu với ESP32 thật. Không sửa backend hoặc firmware.

Build production thư mục gốc và frontend/ đều đạt sau cập nhật này; bốn cặp file được sửa trong lượt này đồng nhất giữa hai cây mã. `git diff --check -- src frontend tests docs` đạt, chỉ có cảnh báo chuẩn hóa LF/CRLF.
