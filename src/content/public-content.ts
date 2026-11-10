export interface PublicArticle {
  path: string;
  category: 'Hướng dẫn' | 'Chính sách';
  title: string;
  description: string;
  notice: string;
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    steps?: string[];
    methods?: { title: string; description: string; note: string }[];
    flows?: { name: string; payer: string; receiver: string; description: string }[];
    links?: { to: string; label: string }[];
  }[];
  support?: { title: string; description: string; to: string; label: string };
  related?: { id: string; title: string; description: string; links: { id?: string; to: string; label: string }[] };
  action: { to: string; label: string };
}

export const PUBLIC_LINK_GROUPS = [
  { title: 'Khám phá', links: [
    { to: '/shop', label: 'Mua sắm trực tuyến' },
    { to: '/#how-it-works', label: 'Cách hoạt động' },
    { to: '/#partners', label: 'Đối tác đồng hành' },
    { to: '/#enterprise', label: 'Giải pháp cửa hàng' },
  ] },
  { title: 'Hỗ trợ & hướng dẫn', links: [
    { to: '/help/ordering', label: 'Đặt hàng & giao nhận' },
    { to: '/help/device-setup', label: 'Kết nối nút bấm' },
    { to: '/help/rentals', label: 'Thuê nút & hợp đồng' },
    { to: '/help/store-partners', label: 'Dành cho chủ cửa hàng' },
  ] },
  { title: 'Thông tin & chính sách', links: [
    { to: '/policies/terms', label: 'Điều khoản sử dụng' },
    { to: '/policies/privacy', label: 'Bảo mật & quyền riêng tư' },
    { to: '/policies/payments', label: 'Thanh toán & hoàn tiền' },
    { to: '/policies/warranty', label: 'Bảo hành thiết bị' },
  ] },
];

// One information menu for all articles. Hash links open an existing topic in its article.
export const PUBLIC_INFORMATION_GROUPS = [
  { title: 'Mua hàng', links: [
    { to: '/policies/payments', label: 'Thanh toán & hoàn tiền' },
    { to: '/help/ordering', label: 'Đặt hàng & giao nhận' },
  ] },
  { title: 'Thiết bị & hợp đồng', links: [
    { to: '/help/rentals', label: 'Thuê nút & hợp đồng' },
    { to: '/help/rentals#verification', label: 'Ngân hàng & xác minh' },
    { to: '/policies/warranty', label: 'Bảo hành thiết bị' },
    { to: '/help/device-setup', label: 'Kết nối nút bấm' },
  ] },
  { title: 'Dành cho cửa hàng', links: [
    { to: '/help/store-partners', label: 'Hướng dẫn chủ cửa hàng' },
    { to: '/help/store-partners#plans', label: 'Gói dịch vụ cửa hàng' },
  ] },
  { title: 'Thông tin chung', links: [
    { to: '/policies/terms', label: 'Điều khoản sử dụng' },
    { to: '/policies/privacy', label: 'Bảo mật & quyền riêng tư' },
  ] },
];

export const PUBLIC_ARTICLES: PublicArticle[] = [
  {
    path: '/help/ordering', category: 'Hướng dẫn', title: 'Đặt hàng & giao nhận',
    description: 'Chọn mua nhu yếu phẩm trên website hoặc đặt lại sản phẩm bằng nút bấm đã kết nối.',
    notice: 'Đặt hàng trên website và nhấn nút bấm đã kích hoạt có thể tạo đơn hàng thật. Hãy kiểm tra sản phẩm, số lượng và thông tin nhận hàng trước khi xác nhận.',
    sections: [
      { id: 'shopping', title: '01. Mua sắm trên website', paragraphs: ['Danh mục mua sắm hiển thị sản phẩm, cửa hàng cung cấp, giá và lượng hàng đang được công bố. Mỗi đơn chỉ gồm sản phẩm của cùng một cửa hàng.'], steps: ['Tìm sản phẩm tại trang Mua sắm và thêm vào giỏ hàng.', 'Kiểm tra các mặt hàng được chọn, số lượng và tổng tiền.', 'Điền tên, số điện thoại, địa chỉ nhận hàng và vị trí giao nếu có.', 'Chọn phương thức thanh toán đang khả dụng rồi xác nhận đơn.'] },
      { id: 'button', title: '02. Đặt hàng bằng nút bấm', paragraphs: ['Đăng nhập tài khoản khách hàng để quản lý nút của bạn. Sau khi ghép nối và cấu hình, nút đặt sản phẩm đã được liên kết với cửa hàng.', 'Trước khi sử dụng, kiểm tra sản phẩm gắn với nút, địa chỉ nhận hàng và tình trạng kết nối. Chờ phản hồi của thiết bị hoặc kiểm tra đơn trên tài khoản trước khi nhấn lại.'] },
      { id: 'delivery', title: '03. Theo dõi và xử lý giao nhận', paragraphs: ['Khách hàng đã đăng nhập theo dõi đơn tại mục Đơn hàng. Cửa hàng tiếp nhận, xử lý và tổ chức giao theo trạng thái thực tế của đơn. Phạm vi phục vụ, thời gian giao và phí phát sinh phụ thuộc cửa hàng và đơn cụ thể.', 'Khi nhận hàng, đối chiếu sản phẩm, số lượng và tình trạng hàng với thông tin đơn. Chỉ hủy khi đơn còn cho phép thao tác; sau đó, trao đổi với cửa hàng để kiểm tra.', 'Nếu đã trừ tiền nhưng chưa có xác nhận, giữ mã đơn và mã giao dịch, kiểm tra lại trạng thái trước khi thanh toán lần nữa. Không gửi mật khẩu, mã OTP hay thông tin thẻ để nhờ hỗ trợ.'] },
    ], action: { to: '/shop', label: 'Bắt đầu mua sắm' },
  },
  {
    path: '/help/device-setup', category: 'Hướng dẫn', title: 'Kết nối nút bấm',
    description: 'Chuẩn bị thiết bị, ghép nối tài khoản và kiểm tra sản phẩm trước lần đặt hàng đầu tiên.',
    notice: 'Mã QR hoặc mã nhận thiết bị dành cho người được nhận nút. Không đăng công khai mã nhận, mật khẩu Wi-Fi hay thông tin đăng nhập.',
    sections: [
      { id: 'prepare', title: '01. Trước khi kết nối', paragraphs: ['Chuẩn bị nút được bàn giao, mã nhận hoặc QR đi kèm, tài khoản khách hàng và mạng Wi-Fi phù hợp với thiết bị. Đặt nút gần bộ phát khi cấu hình.', 'Với thiết bị thuê, kiểm tra trạng thái thanh toán và kích hoạt hợp đồng. Hoàn tất thanh toán chưa đồng nghĩa nút đã được bàn giao hoặc sẵn sàng sử dụng.'] },
      { id: 'pair', title: '02. Ghép nối với tài khoản', paragraphs: ['Đăng nhập bằng tài khoản khách hàng, mở Nút của tôi và chọn ghép nối thiết bị. Quét QR hoặc nhập mã theo hướng dẫn trên màn hình.'], steps: ['Kiểm tra đúng thiết bị và cửa hàng được hiển thị.', 'Chọn sản phẩm liên kết nếu màn hình yêu cầu.', 'Kiểm tra thông tin rồi xác nhận nhận thiết bị.', 'Thực hiện cấu hình kết nối theo hướng dẫn của thiết bị được bàn giao.'] },
      { id: 'check', title: '03. Kiểm tra trước khi sử dụng', paragraphs: ['Kiểm tra nút đã xuất hiện trong tài khoản, sản phẩm liên kết, địa chỉ nhận hàng, nguồn điện hoặc pin và tình trạng kết nối.', 'Nếu chưa kết nối được, kiểm tra nguồn, khoảng cách đến Wi-Fi và thông tin mạng. Không tự tháo hoặc can thiệp phần cứng. Ghi mã thiết bị, trạng thái đèn và thông báo lỗi để trao đổi với đơn vị bàn giao.', 'Thay đổi Wi-Fi hoặc ghép nối lại cần thực hiện bằng chức năng và hướng dẫn tương ứng. Không xóa tài khoản hay thanh toán gói mới chỉ để xử lý lỗi kết nối.'] },
    ], action: { to: '/customer/home', label: 'Mở Nút của tôi' },
  },
  {
    path: '/help/rentals', category: 'Hướng dẫn', title: 'Thuê nút & hợp đồng',
    description: 'Ai trả phí thuê, ai đóng tiền cọc và cần kiểm tra gì khi nhận hoặc trả nút bấm?',
    notice: 'Phí thuê do cửa hàng trả cho nền tảng và tiền cọc của khách là hai nghĩa vụ riêng. Chỉ thực hiện khoản thu đúng với hợp đồng, chứng từ và người nhận được xác nhận cho bạn.',
    sections: [
      {
        id: 'choose', title: '01. Phân biệt các khoản tiền',
        paragraphs: ['Trong mô hình cửa hàng chịu phí thuê, các bên có trách nhiệm riêng như dưới đây. Đây là quan hệ nghiệp vụ; tài khoản nhận tiền và kênh thu thực tế phải được kiểm tra trên chứng từ hoặc phiên thanh toán của từng hợp đồng.'],
        flows: [
          { name: 'Phí thuê nút', payer: 'Cửa hàng', receiver: 'Nền tảng', description: 'Chi phí thuê hoặc duy trì thiết bị theo nghĩa vụ của cửa hàng; không gộp vào tiền cọc khách phải đóng.' },
          { name: 'Tiền cọc thiết bị', payer: 'Khách hàng', receiver: 'Cửa hàng phụ trách', description: 'Khoản cọc gắn với thiết bị và hợp đồng; việc thu, giữ và hoàn cần có chứng từ đối chiếu riêng.' },
        ],
      },
      { id: 'activate', title: '02. Kiểm tra hợp đồng và bàn giao', paragraphs: ['Khách hàng xem gói và Hợp đồng của tôi tại Thuê nút bấm. Đối chiếu số thiết bị, khoản phải trả, chứng từ thu và đơn vị phụ trách trước khi xác nhận. Không lấy tổng giá niêm yết của gói làm căn cứ kết luận khách phải trả cả phí thuê lẫn tiền cọc.', 'Một số hợp đồng cũ có thể áp dụng cách thu phí khác. Cần đối chiếu chính sách được ghi nhận trên hợp đồng đó; thông tin tại đây không tự đổi nghĩa vụ của hợp đồng đã có.', 'Đã ghi nhận tiền chưa đồng nghĩa thiết bị đã được bàn giao hoặc hợp đồng đã hoạt động. Theo dõi trạng thái hợp đồng; không thanh toán lần nữa chỉ vì đang chờ bàn giao.'] },
      { id: 'return', title: '03. Trả thiết bị và theo dõi hoàn cọc', paragraphs: ['Khi ngừng sử dụng, trao đổi với cửa hàng hoặc đơn vị phụ trách hợp đồng để làm thủ tục trả thiết bị. Việc nhận lại thiết bị, kiểm tra và ghi nhận yêu cầu hoàn cọc là các bước riêng.', 'Yêu cầu hoàn cọc có thể còn chờ duyệt hoặc chờ chi trả. Chỉ xem là hoàn xong khi có kết quả chi trả được xác nhận; không coi việc đã gửi trả nút là bằng chứng tiền đã về.', 'Số tiền được hoàn phải đối chiếu với tiền cọc đã thu, hồ sơ thiết bị và kết quả xử lý hợp đồng. Trang này không tự ấn định mức hoàn, mức khấu trừ hoặc thời hạn hoàn chung.'] },
      { id: 'verification', title: '04. Ngân hàng nhận hoàn cọc và xác minh', paragraphs: ['Nếu luồng nhận hoàn yêu cầu tài khoản đã xác minh, thực hiện tại Ngân hàng & hoàn tiền. Tra cứu được tên chủ tài khoản chưa đồng nghĩa đã xác minh quyền sở hữu.', 'Khoản chuyển xác minh ngân hàng có mục đích và lịch sử riêng, không phải tiền cọc thiết bị, tiền hàng hay phí thuê. Chỉ chuyển khi bạn chủ động mở phiên xác minh, theo đúng số tiền, người nhận, nội dung và thời hạn được hiển thị.', 'Kết quả xác minh tài khoản và kết quả hoàn khoản chuyển xác minh được theo dõi độc lập. Không phải mọi đơn mua hàng đều yêu cầu chuyển tiền xác minh ngân hàng.'], links: [{ to: '/customer/banking', label: 'Mở Ngân hàng & hoàn tiền' }] },
      { id: 'store-plans', title: '05. Hướng dẫn liên quan', paragraphs: ['Thông tin gói dịch vụ gian hàng được trình bày riêng trong hướng dẫn dành cho chủ cửa hàng.', 'Khi thiết bị có lỗi, kiểm tra quyền lợi bảo hành của thiết bị hoặc hợp đồng. Bảo hành, đổi thiết bị và hoàn cọc là các việc khác nhau.'], links: [{ to: '/help/store-partners', label: 'Hướng dẫn dành cho chủ cửa hàng' }, { to: '/help/store-partners#plans', label: 'Gói dịch vụ cửa hàng' }, { to: '/policies/warranty', label: 'Đọc thông tin bảo hành thiết bị' }] },
    ], action: { to: '/customer/rentals', label: 'Xem gói thuê nút bấm' },
  },
  {
    path: '/help/store-partners', category: 'Hướng dẫn', title: 'Dành cho chủ cửa hàng',
    description: 'Kết nối danh mục sản phẩm, đơn hàng và thiết bị của cửa hàng trong cùng một quy trình.',
    notice: 'Quyền mở bán, giới hạn sản phẩm và quyền thao tác được xác định theo tài khoản, trạng thái cửa hàng và gói dịch vụ được hệ thống ghi nhận.',
    sections: [
      { id: 'register', title: '01. Đăng ký và chuẩn bị mở bán', paragraphs: ['Tại trang Đăng ký, chọn vai trò chủ cửa hàng và cung cấp thông tin được yêu cầu. Theo dõi kết quả xét duyệt trước khi sử dụng các chức năng cần cửa hàng được chấp thuận.'] },
      { id: 'plans', title: '02. Gói dịch vụ cửa hàng', paragraphs: ['Gói cung cấp quyền lợi cho gian hàng, có kỳ hạn và danh mục riêng; không phải tiền cọc hay phí thuê nút của khách.', 'Chủ cửa hàng xem danh mục tại Gói & ngân hàng → Đăng ký gói dịch vụ. Kiểm tra giá, thời hạn, giới hạn sản phẩm và lịch sử đóng tiền. Gói đang dùng và kỳ tiếp theo tuân theo lịch hệ thống.'] },
      { id: 'orders', title: '03. Sản phẩm, thiết bị và đơn hàng', paragraphs: ['Quản lý sản phẩm, giá và tồn kho trong khu vực cửa hàng. Kiểm tra sản phẩm liên kết với nút để đơn phát sinh được gửi đúng cửa hàng.', 'Theo dõi đơn trực tiếp, kiểm tra thông tin người nhận và cập nhật tiến độ theo thao tác đang được cho phép. Nhân viên chỉ thao tác trong phạm vi được phân quyền.'] },
      { id: 'finance', title: '04. Ngân hàng và ví cửa hàng', paragraphs: ['Chủ cửa hàng thêm tài khoản ngân hàng, tra cứu tên và thực hiện xác minh chính chủ. Tra cứu được tên chưa có nghĩa tài khoản đã được xác minh.', 'Xem số dư và yêu cầu rút trong Báo cáo doanh thu → Ví & rút tiền. Gửi yêu cầu rút chưa đồng nghĩa ngân hàng đã nhận tiền; theo dõi trạng thái chi trả và thông tin người nhận thực tế.'] },
    ], action: { to: '/register', label: 'Đăng ký tài khoản cửa hàng' },
  },
  {
    path: '/policies/terms', category: 'Chính sách', title: 'Điều khoản sử dụng',
    description: 'Những nguyên tắc cần biết khi dùng tài khoản, đặt hàng và kết nối thiết bị trên Smart Order Button.',
    notice: 'Nội dung này mô tả cách sử dụng nền tảng. Giá, thời hạn, quyền lợi và trách nhiệm cụ thể cần được đối chiếu với đơn hàng, gói dịch vụ hoặc hợp đồng đã xác nhận.',
    sections: [
      { id: 'scope', title: '01. Giới thiệu và phạm vi áp dụng', paragraphs: ['Smart Order Button kết nối khách hàng với cửa hàng qua mua sắm trực tuyến và nút bấm đặt hàng. Thông tin tại đây áp dụng cho việc sử dụng các chức năng đang được cung cấp.', 'Danh mục hàng hóa, khu vực giao nhận và khả năng sử dụng dịch vụ phụ thuộc dữ liệu thực tế. Các thỏa thuận cụ thể cần được đối chiếu với đơn hàng hoặc hợp đồng liên quan.'] },
      { id: 'account', title: '02. Tài khoản và điều kiện sử dụng', paragraphs: ['Một số chức năng cần đăng nhập và đúng vai trò, như quản lý đơn cá nhân, thiết bị hoặc cửa hàng. Chỉ sử dụng tài khoản và dữ liệu thuộc quyền truy cập của bạn.', 'Giữ thông tin liên hệ và nhận hàng chính xác. Bảo vệ mật khẩu, mã OTP và mã nhận thiết bị; không chia sẻ các thông tin này để nhờ người khác thao tác hộ.'] },
      { id: 'responsibilities', title: '03. Trách nhiệm khi thao tác', paragraphs: ['Kiểm tra sản phẩm, số lượng, cửa hàng, người nhận và khoản phải trả trước khi xác nhận. Nhấn nút bấm đã kích hoạt có thể tạo đơn thật cho sản phẩm đã liên kết.', 'Chờ kết quả xử lý và kiểm tra lại trạng thái nếu kết nối bị gián đoạn. Không tạo thêm giao dịch chỉ để kiểm tra một yêu cầu chưa rõ kết quả.'] },
      { id: 'parties', title: '04. Vai trò của các bên', paragraphs: ['Khách hàng quản lý thông tin nhận hàng, đơn và thiết bị của mình. Cửa hàng quản lý sản phẩm, tiếp nhận đơn và phối hợp giao nhận. Nhân viên và quản trị viên thao tác theo quyền được cấp.', 'Trách nhiệm thanh toán của cửa hàng và khách trong hợp đồng thiết bị được trình bày riêng tại Thuê nút & hợp đồng. Không mặc định tiền hàng, phí thuê và tiền cọc có cùng bên trả hoặc cùng bên nhận.'], links: [{ to: '/help/rentals', label: 'Phân biệt phí thuê và tiền cọc' }] },
      { id: 'transactions', title: '05. Quy định sử dụng nền tảng', paragraphs: ['Không giả mạo đơn hoặc giao dịch, truy cập dữ liệu của người khác hay can thiệp thiết bị ngoài hướng dẫn được bàn giao.', 'Chỉ coi đơn hàng, thanh toán, bàn giao hoặc chi trả đã hoàn tất khi có kết quả xác nhận tương ứng. Điều hướng về website từ cổng thanh toán không thay thế xác nhận giao dịch.'] },
      { id: 'support', title: '06. Khi phát sinh vấn đề', paragraphs: ['Sử dụng thao tác đang được cho phép hoặc trao đổi với cửa hàng, đơn vị phụ trách hợp đồng để kiểm tra. Điều kiện hủy, trả hoặc hoàn cần được đối chiếu theo hồ sơ và thỏa thuận áp dụng.', 'Giữ mã đơn, hợp đồng và bằng chứng cần thiết đã che dữ liệu nhạy cảm. Trang này không tự bổ sung mức phí, thời hạn hay cam kết ngoài giao dịch hoặc hợp đồng được xác nhận.'] },
    ], action: { to: '/help/ordering', label: 'Đọc hướng dẫn đặt hàng' },
    support: { title: 'Cần biết cách thực hiện?', description: 'Xem hướng dẫn đặt hàng, giao nhận và xử lý khi giao dịch chưa rõ kết quả.', to: '/help/ordering', label: 'Đọc hướng dẫn đặt hàng' },
  },
  {
    path: '/policies/privacy', category: 'Chính sách', title: 'Bảo mật & quyền riêng tư',
    description: 'Thông tin được sử dụng trong tài khoản, đơn hàng, thiết bị và các chức năng xác minh bạn lựa chọn.',
    notice: 'Không cung cấp mật khẩu ngân hàng, mã OTP, mã PIN hoặc thông tin đăng nhập cho người hỗ trợ. Tra cứu và xác minh tài khoản ngân hàng không yêu cầu bạn giao các thông tin này.',
    sections: [
      { id: 'data', title: '01. Những thông tin được sử dụng', paragraphs: ['Tùy chức năng bạn thực hiện, hệ thống sử dụng thông tin hồ sơ và liên hệ; tên, số điện thoại, địa chỉ và vị trí giao hàng nếu cung cấp; thông tin đơn, thiết bị và hợp đồng.', 'Thông tin tài khoản ngân hàng, giao dịch và hồ sơ xác minh được sử dụng khi bạn thực hiện các chức năng liên quan. Không cung cấp mật khẩu hoặc mã OTP ngân hàng trong hồ sơ hỗ trợ.'] },
      { id: 'purposes', title: '02. Mục đích sử dụng', paragraphs: ['Thông tin tài khoản phục vụ đăng nhập và quản lý hồ sơ. Thông tin người nhận phục vụ xử lý đơn, liên lạc và giao hàng.', 'Thông tin thiết bị và hợp đồng phục vụ liên kết nút bấm, theo dõi tình trạng sử dụng và bàn giao. Thông tin giao dịch phục vụ xác nhận, đối chiếu và xử lý các khoản thu hoặc chi liên quan.'] },
      { id: 'browser', title: '03. Lưu trữ trên trình duyệt và bảo vệ tài khoản', paragraphs: ['Website sử dụng bộ nhớ trình duyệt để duy trì phiên đăng nhập, giỏ hàng, tùy chọn giao diện và một số trạng thái cần khôi phục khi thao tác chưa rõ kết quả.', 'Đăng xuất sau khi dùng máy chung. Xóa dữ liệu trình duyệt có thể làm mất giỏ hàng hoặc thông tin khôi phục trên máy, nhưng không phải thao tác xóa hồ sơ trên hệ thống.', 'Bảo vệ thông tin đăng nhập và chỉ gửi bằng chứng cần thiết đã che dữ liệu nhạy cảm. Trang này không công bố một thời hạn lưu trữ hoặc cơ chế xóa tự động áp dụng chung.'] },
      { id: 'sharing', title: '04. Thông tin trong quá trình thực hiện dịch vụ', paragraphs: ['Thông tin cần thiết của đơn được dùng bởi cửa hàng và người giao hàng để thực hiện giao nhận. Quyền thao tác trong hệ thống phụ thuộc tài khoản và vai trò được cấp.', 'Các luồng thanh toán PayOS và tra cứu ngân hàng qua VietQR sử dụng dịch vụ tương ứng khi bạn chọn chức năng đó. Kiểm tra đúng màn hình, người nhận và nội dung giao dịch trước khi xác nhận.'] },
      { id: 'control', title: '05. Kiểm tra và cập nhật thông tin', paragraphs: ['Bạn có thể xem và chỉnh các trường được hỗ trợ tại mục Tài khoản. Các thông tin gắn với chứng từ hoặc xác minh cần được đối chiếu theo chức năng liên quan.', 'Đối với yêu cầu ngoài thao tác hiện có, như xử lý dữ liệu đã lưu trên hệ thống, cần trao đổi với đơn vị quản lý dịch vụ. Trang này không coi việc gửi yêu cầu là bằng chứng dữ liệu đã được sửa hoặc xóa.'] },
      { id: 'privacy-support', title: '06. Yêu cầu hỗ trợ về thông tin', paragraphs: ['Sử dụng kênh liên hệ thực tế được đơn vị cung cấp dịch vụ công bố trong hồ sơ đăng ký hoặc hợp đồng. Nêu rõ loại thông tin cần kiểm tra và mã hồ sơ liên quan nếu có.', 'Không gửi mật khẩu, OTP, mã nhận thiết bị hoặc thông tin riêng của người khác. Địa chỉ tiếp nhận chuyên trách và thời hạn phản hồi cần được đơn vị vận hành xác nhận; trang này không tự đặt một hotline hoặc email thay thế.'] },
    ], action: { to: '/policies/terms', label: 'Xem điều khoản sử dụng' },
    support: { title: 'Kiểm tra thông tin của bạn', description: 'Mở hồ sơ tài khoản để xem các thông tin và thao tác cập nhật đang được hỗ trợ.', to: '/profile', label: 'Mở hồ sơ tài khoản' },
  },
  {
    path: '/policies/payments', category: 'Chính sách', title: 'Thanh toán & hoàn tiền',
    description: 'Thông tin thanh toán và cách kiểm tra vấn đề hoàn tiền đối với đơn mua sản phẩm trên Smart Order Button.',
    notice: 'Đã chuyển tiền hoặc quay lại từ PayOS chưa đồng nghĩa đơn đã được ghi nhận thanh toán. Hủy đơn và hoàn tiền là hai kết quả khác nhau; hãy giữ mã đơn và kiểm tra xác nhận giao dịch.',
    sections: [
      {
        id: 'methods', title: '01. Phương thức thanh toán đơn hàng',
        paragraphs: ['Chọn một trong các phương thức được cung cấp tại bước xác nhận đơn. Kiểm tra sản phẩm, cửa hàng, số lượng, người nhận và số tiền trước khi tiếp tục.'],
        methods: [
          { title: 'Tiền mặt khi nhận hàng · COD', description: 'Thanh toán tiền hàng khi nhận hàng theo đơn được cửa hàng tiếp nhận.', note: 'Việc tạo đơn COD chưa có nghĩa đã thu tiền.' },
          { title: 'Thanh toán trực tuyến · PayOS', description: 'Mở liên kết thanh toán được tạo cho đơn và kiểm tra thông tin trên màn hình PayOS.', note: 'Luồng PayOS hiện yêu cầu đăng nhập hợp lệ.' },
        ],
      },
      { id: 'confirmation', title: '02. Xác nhận và trạng thái giao dịch', paragraphs: ['Mã đơn xác nhận rằng đơn đã được tạo; trạng thái thanh toán cho biết việc thu tiền đã được ghi nhận hay chưa. Trạng thái xử lý hoặc giao hàng của đơn là thông tin riêng.', 'Nếu chưa mở được PayOS sau khi tạo đơn, kiểm tra đơn đã có trước khi tiếp tục thanh toán. Không đặt lại cùng đơn để thử sửa lỗi mở liên kết.', 'Thông báo chuyển khoản, hủy liên kết hoặc điều hướng về website không tự xác nhận đã thanh toán hay đã hoàn tiền. Khi kết quả chưa rõ, đối chiếu mã đơn với bằng chứng giao dịch.'] },
      { id: 'eligibility', title: '03. Trường hợp cần kiểm tra hoàn tiền', paragraphs: ['Nếu đơn đã ghi nhận thanh toán rồi được hủy hoặc từ chối hợp lệ, khoản tiền có thể ở bước chờ xử lý hoàn. Điều này không đồng nghĩa tiền đã được chuyển lại.', 'Các tình huống như nghi thu trùng, số tiền không khớp hoặc vấn đề hàng hóa cần được kiểm tra theo hồ sơ đơn và chính sách áp dụng của cửa hàng. Đây là tình huống cần đối chiếu, không phải cam kết mọi yêu cầu đều được hoàn.', 'Điều kiện chấp thuận, số tiền được hoàn và trách nhiệm xử lý cần có xác nhận cho từng trường hợp. Trang này không đặt thêm điều kiện hay mức khấu trừ.'] },
      { id: 'request', title: '04. Cách đề nghị kiểm tra', paragraphs: ['Liên hệ cửa hàng cung cấp bằng kênh thực tế ghi trên thông tin giao dịch hoặc được cửa hàng công bố. Trang này không tạo một yêu cầu hoàn tiền thay cho bạn.'], steps: ['Giữ mã đơn, số tiền, thời điểm thanh toán và mã giao dịch nếu có.', 'Kiểm tra lại trạng thái đơn và thanh toán; khách đã đăng nhập có thể mở mục Đơn hàng.', 'Nêu vấn đề cần đối chiếu và cung cấp bằng chứng đã che thông tin nhạy cảm cho cửa hàng.', 'Giữ kết quả tiếp nhận và xác nhận xử lý; không thanh toán thêm khi giao dịch cũ chưa rõ kết quả.'] },
      { id: 'refund-method', title: '05. Phương thức và thời gian hoàn', paragraphs: ['Phương thức nhận lại tiền, số tiền và thời gian xử lý cần được đơn vị phụ trách xác nhận sau khi đối chiếu trường hợp cụ thể. Trang này chưa công bố một thời hạn hoàn tiền chung.', 'Không mặc định khoản hoàn tự thực hiện qua PayOS hoặc tự quay về tài khoản nguồn chỉ vì đơn đã thanh toán trực tuyến. Cần có kết quả chi trả hoặc bằng chứng hoàn tiền để xác nhận hoàn tất.'] },
      { id: 'pending', title: '06. Khi cần hỗ trợ thanh toán', paragraphs: ['Nếu ngân hàng báo trừ tiền nhưng đơn chưa ghi nhận thanh toán, giữ nguyên mã đơn và bằng chứng để kiểm tra. Không tạo đơn hoặc giao dịch mới chỉ để thử lại.', 'Khách chưa đăng nhập mua bằng COD nên giữ mã đơn và thông tin cửa hàng. Khách có tài khoản kiểm tra đơn trong khu vực Đơn hàng. Không gửi mật khẩu, OTP hoặc thông tin đăng nhập ngân hàng cho người hỗ trợ.'] },
    ], action: { to: '/help/rentals', label: 'Tìm hiểu hợp đồng thuê' },
    support: { title: 'Kiểm tra đơn hàng đang có vấn đề?', description: 'Mở lịch sử để đối chiếu mã đơn và trạng thái thanh toán trước khi trao đổi với cửa hàng. Đường dẫn này yêu cầu tài khoản khách hàng.', to: '/customer/orders', label: 'Mở Đơn hàng của tôi' },
    related: {
      id: 'rental', title: 'Bạn đang tìm thông tin về thiết bị?',
      description: 'Phí thuê nút, tiền cọc thiết bị và gói dịch vụ cửa hàng được giải thích riêng trong phần hợp đồng.',
      links: [{ to: '/help/rentals', label: 'Tìm hiểu hợp đồng thuê' }, { id: 'verification', to: '/help/rentals#verification', label: 'Khoản chuyển xác minh ngân hàng' }],
    },
  },
  {
    path: '/policies/warranty', category: 'Chính sách', title: 'Bảo hành thiết bị',
    description: 'Thông tin dành cho nút bấm vật lý: kiểm tra quyền lợi, chuẩn bị báo lỗi và phối hợp với đơn vị bàn giao.',
    notice: 'Thời hạn bảo hành, điều kiện đổi thiết bị và chi phí áp dụng theo thiết bị, gói thuê hoặc hợp đồng được bàn giao. Không mặc định mọi thiết bị đều được bảo hành trọn đời hoặc đổi miễn phí trong mọi trường hợp.',
    sections: [
      { id: 'coverage', title: '01. Phạm vi và đối tượng', paragraphs: ['Trang này nói về thiết bị nút bấm Smart Order Button. Vấn đề với hàng hóa được đặt bằng nút cần được kiểm tra theo đơn hàng và cửa hàng cung cấp.', 'Quyền lợi của thiết bị thuê cần đối chiếu với gói, hợp đồng và hồ sơ bàn giao của chính thiết bị đó. Không áp dụng quyền lợi của một gói cho tất cả thiết bị.'] },
      { id: 'conditions', title: '02. Kiểm tra điều kiện áp dụng', paragraphs: ['Chuẩn bị mã thiết bị, ngày hoặc chứng từ bàn giao và hợp đồng liên quan để đơn vị phụ trách kiểm tra thời hạn, phạm vi và quyền lợi.', 'Thời hạn bảo hành, quyền đổi mới và chi phí nếu có cần có căn cứ từ điều kiện đã áp dụng cho thiết bị. Trang này không tự bổ sung thời hạn hay bảo đảm đổi miễn phí.'] },
      { id: 'exclusions', title: '03. Phạm vi cần được xác nhận', paragraphs: ['Các trường hợp loại trừ hoặc không được hỗ trợ theo bảo hành cần được đối chiếu với điều kiện thực tế của thiết bị hoặc hợp đồng. Trang này không công bố thêm một danh sách loại trừ chung.', 'Không tự kết luận thiết bị mất bảo hành hoặc được đổi mới chỉ từ biểu hiện lỗi. Mô tả tình trạng để đơn vị tiếp nhận kiểm tra trước khi thống nhất cách xử lý.'] },
      { id: 'request', title: '04. Chuẩn bị thông tin báo lỗi', paragraphs: ['Trao đổi với đơn vị bàn giao hoặc cửa hàng liên quan bằng kênh liên hệ thực tế đã được cung cấp.'], steps: ['Cung cấp mã thiết bị, mã hợp đồng hoặc chứng từ bàn giao.', 'Mô tả lỗi, thời điểm xảy ra và trạng thái đèn hoặc thông báo.', 'Kiểm tra nguồn, pin, Wi-Fi và sản phẩm liên kết theo hướng dẫn sử dụng.', 'Gửi hình ảnh cần thiết đã che mã nhận và dữ liệu nhạy cảm nếu được yêu cầu.'] },
      { id: 'diagnosis', title: '05. Kiểm tra và phương án xử lý', paragraphs: ['Lỗi kết nối, hết hàng hoặc đơn chưa được tiếp nhận cần được phân biệt với hỏng phần cứng. Không tự tháo, sửa mạch hoặc tiếp tục dùng thiết bị có dấu hiệu bất thường về nguồn.', 'Cách tiếp nhận, sửa chữa, thay thế và chi phí nếu có cần được đơn vị phụ trách xác nhận sau kiểm tra. Không coi việc đã báo lỗi là bằng chứng đã chấp thuận đổi thiết bị.'] },
      { id: 'deposit', title: '06. Hỗ trợ và các khoản tiền liên quan', paragraphs: ['Bảo hành thiết bị, hoàn tiền đơn mua hàng và hoàn cọc khi trả nút là ba nội dung khác nhau. Việc đổi hoặc sửa thiết bị không tự xác nhận đã hoàn cọc.', 'Dùng mã thiết bị và hồ sơ bàn giao khi trao đổi hỗ trợ. Nếu kết thúc thuê, đọc phần hợp đồng để kiểm tra riêng thủ tục trả nút và tiền cọc.'], links: [{ to: '/help/rentals', label: 'Xem thông tin trả nút và tiền cọc' }, { to: '/policies/payments', label: 'Thanh toán và hoàn tiền đơn mua hàng' }] },
    ], action: { to: '/help/device-setup', label: 'Xem hướng dẫn kết nối' },
    support: { title: 'Kiểm tra thiết bị trước khi báo lỗi', description: 'Mở Nút của tôi để đối chiếu thiết bị và tình trạng kết nối. Đường dẫn này yêu cầu tài khoản khách hàng.', to: '/customer/home', label: 'Mở Nút của tôi' },
  },
];
