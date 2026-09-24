import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets,
  Flame,
  Wheat,
  Package,
  ArrowRight,
  Scale,
  ShieldCheck,
  Tag,
  Sparkles,
  Cylinder,
  LucideIcon
} from 'lucide-react';

interface MetricItem {
  icon: LucideIcon;
  text: string;
}

interface SubOption {
  name: string;
  image: string;
  desc: string;
  metrics: MetricItem[];
}

interface ProductTourCategory {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  icon: LucideIcon;
  headline: string;
  metricsBanner: string[];
  options: SubOption[];
}

const TOUR_CATEGORIES: ProductTourCategory[] = [
  {
    id: 'water',
    number: '01',
    name: 'Nước Khoáng 20L',
    subtitle: 'Lavie, Vĩnh Hảo, i-on Life',
    icon: Droplets,
    headline: 'Nước khoáng & tinh khiết bình 20L',
    metricsBanner: [
      'Giao hỏa tốc 15 - 25 phút',
      'Hỗ trợ vác tận cửa, thu hồi vỏ bình'
    ],
    options: [
      {
        name: 'La Vie 19L (Bình Úp)',
        image: '/assets/products/lavie.jpg',
        desc: 'Nước khoáng thiên nhiên dịu nhẹ, bổ sung 6 khoáng chất thiết yếu mỗi ngày. Thiết kế bình úp ngược, chuyên dụng để kết hợp với máy nước nóng lạnh.',
        metrics: [
          { icon: Droplets, text: 'Khoáng nhẹ (TDS thấp)' },
          { icon: Package, text: 'Bình Úp 19 Lít' },
          { icon: Scale, text: 'pH: ~ 7.2' }
        ]
      },
      {
        name: 'Vĩnh Hảo 20L (Có Vòi)',
        image: '/assets/products/vinhhao.png',
        desc: 'Nước khoáng đậm đà giàu Bicarbonate, hỗ trợ tiêu hóa và bù khoáng nhanh chóng. Tích hợp vòi xả trực tiếp siêu tiện dụng, không cần mua thêm thiết bị.',
        metrics: [
          { icon: Droplets, text: 'Khoáng đậm đà' },
          { icon: Package, text: 'Bình Vòi 20 Lít' },
          { icon: Scale, text: 'Giàu Bicarbonate' }
        ]
      },
      {
        name: 'i-on Life Nước Kiềm 19L',
        image: '/assets/products/ionlife.jpg',
        desc: 'Nước ion kiềm cao cấp chuẩn công nghệ điện phân Nhật Bản. Giúp thanh lọc cơ thể, trung hòa axit dư thừa và bảo vệ sức khỏe dạ dày.',
        metrics: [
          { icon: Droplets, text: 'Nước Ion Kiềm' },
          { icon: Package, text: 'Bình Úp 19 Lít' },
          { icon: Scale, text: 'pH: 8.5 - 9.5' }
        ]
      },
      {
        name: 'Nước Tinh Khiết Satori 20L',
        image: '/assets/products/Satory.jpg',
        desc: 'Nước tinh khiết xử lý qua công nghệ hoàn lưu khoáng sRO, giữ trọn vị ngọt thanh tự nhiên. Màng co vô trùng tuyệt đối, bình nắp thiết kế an toàn.',
        metrics: [
          { icon: Droplets, text: 'Nước tinh khiết' },
          { icon: Package, text: 'Úp / Vòi (20 Lít)' },
          { icon: Scale, text: 'Công nghệ sRO' }
        ]
      }
    ]
  },
  {
    id: 'gas',
    number: '02',
    name: 'Bình Gas An Toàn',
    subtitle: 'Petrolimex, Saigon Petro',
    icon: Flame,
    headline: 'Bình gas chính hãng kiểm định an toàn',
    metricsBanner: [
      'Giao hỏa tốc 15 - 20 phút',
      'Cân tại chỗ, kiểm tra rò rỉ van an toàn'
    ],
    options: [
      {
        name: 'Petrolimex 12kg Van Ngang',
        image: '/assets/products/Petrolimex.png',
        desc: 'Thương hiệu gas quốc gia với chất lượng khí đốt tinh khiết, cháy triệt để. Trang bị van ngang vặn ren truyền thống, tương thích với hầu hết bếp gia đình.',
        metrics: [
          { icon: Flame, text: 'NGỌN LỬA XANH' },
          { icon: Cylinder, text: '12KG (VAN NGANG)' },
          { icon: ShieldCheck, text: 'BẢO HIỂM CHÍNH HÃNG' }
        ]
      },
      {
        name: 'Saigon Petro 12kg Xám',
        image: '/assets/products/SaigonPetro.png',
        desc: 'Lựa chọn kinh tế và bền bỉ cho bếp ăn gia đình. Vỏ bình đúc từ thép chịu lực cường độ cao, tích hợp hệ thống van an toàn chống rò rỉ nghiêm ngặt.',
        metrics: [
          { icon: Flame, text: 'NHIỆT LƯỢNG CAO' },
          { icon: Cylinder, text: '12KG (VỎ XÁM)' },
          { icon: ShieldCheck, text: 'VAN CHỐNG RÒ RỈ' }
        ]
      },
      {
        name: 'Total Gas An Toàn (Bình 12kg)',
        image: '/assets/products/Totalgas.png',
        desc: 'Dòng gas cao cấp từ Pháp, ngọn lửa xanh trong tuyệt đối không gây đen đáy nồi. Trang bị khóa van an toàn kép chống cháy nổ tối đa.',
        metrics: [
          { icon: Flame, text: 'KHÔNG ĐEN NỒI' },
          { icon: Cylinder, text: '12KG (VAN KÉP)' },
          { icon: ShieldCheck, text: 'CÔNG NGHỆ PHÁP' }
        ]
      },
      {
        name: 'Gas Công Nghiệp 45kg',
        image: '/assets/products/GasCN.png',
        desc: 'Công suất tỏa nhiệt cực lớn, duy trì áp suất ổn định cho nhà hàng và bếp ăn công nghiệp. Thời gian sử dụng lâu dài, giúp tối ưu chi phí vận hành.',
        metrics: [
          { icon: Flame, text: 'ÁP SUẤT MẠNH' },
          { icon: Cylinder, text: '45KG (CÔNG NGHIỆP)' },
          { icon: ShieldCheck, text: 'TỐI ƯU CHI PHÍ' }
        ]
      }
    ]
  },
  {
    id: 'rice',
    number: '03',
    name: 'Gạo Đặc Sản',
    subtitle: 'ST25, Gạo Lứt, Tám Thơm',
    icon: Wheat,
    headline: 'Gạo sạch chuẩn VietGAP vụ mùa mới',
    metricsBanner: [
      'Giao tận cửa 20 - 30 phút',
      'Túi hút chân không 5kg - 10kg'
    ],
    options: [
      {
        name: 'ST25 Ông Cua Thượng Hạng',
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        desc: 'Gạo ngon nhất thế giới lai tạo bởi kỹ sư Hồ Quang Cua. Hạt dài trắng trong, cơm dẻo mềm nguyên hạt và phảng phất hương lá dứa tự nhiên.',
        metrics: [
          { icon: Wheat, text: 'Thơm lá dứa' },
          { icon: Package, text: 'Túi 5kg Hút chân không' },
          { icon: Tag, text: 'Chuẩn VietGAP' }
        ]
      },
      {
        name: 'Gạo Lứt Huyết Rồng Dẻo',
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        desc: 'Giàu chất xơ, vitamin nhóm B và chỉ số đường huyết thấp. Lựa chọn lý tưởng cho người ăn kiêng, tập luyện hoặc cải thiện đường huyết.',
        metrics: [
          { icon: Wheat, text: 'Giàu khoáng chất' },
          { icon: Package, text: 'Túi 2kg - 5kg' },
          { icon: Tag, text: 'Chỉ số GI thấp' }
        ]
      },
      {
        name: 'Tám Thơm Điện Biên Vụ Mới',
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        desc: 'Đặc sản vùng cao Mường Thanh tưới mát bởi nguồn nước tự nhiên. Cơm đậm đà, giữ trọn độ dẻo và mùi thơm ngay cả khi để nguội.',
        metrics: [
          { icon: Wheat, text: 'Dẻo đậm đà' },
          { icon: Package, text: 'Túi 10kg Có quai xách' },
          { icon: Tag, text: 'Vụ mùa mới nhất' }
        ]
      },
      {
        name: 'Jasmine Thơm Sữa 10kg',
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        desc: 'Giống lúa thơm nhiệt đới phù hợp khẩu vị đại chúng trong bữa cơm hàng ngày. Cơm tơi xốp vừa phải, ngọt hậu và dễ nấu.',
        metrics: [
          { icon: Wheat, text: 'Cơm xốp dẻo' },
          { icon: Package, text: 'Bao 10kg Tiết kiệm' },
          { icon: Tag, text: 'Không chất bảo quản' }
        ]
      }
    ]
  },
  {
    id: 'essentials',
    number: '04',
    name: 'Nhu Yếu Phẩm Bếp',
    subtitle: 'Dầu ăn, gia vị, giặt tẩy',
    icon: Package,
    headline: 'Đầy đủ gia vị và vật dụng thiết yếu',
    metricsBanner: [
      'Giao tận cửa 20 - 35 phút',
      'Đóng thùng vận chuyển chống va đập'
    ],
    options: [
      {
        name: 'Dầu Ăn Simply Canola 5L',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        desc: 'Chiết xuất 100% hạt cải tự nhiên giàu Omega 3, 6, 9 và vitamin E. Chịu nhiệt tốt, phù hợp cho cả chiên rán giòn và trộn salad thanh đạm.',
        metrics: [
          { icon: Sparkles, text: 'Can 5 Lít' },
          { icon: Package, text: 'Tiết kiệm gia đình' },
          { icon: ShieldCheck, text: 'Tốt cho tim mạch' }
        ]
      },
      {
        name: 'Nước Mắm Phú Quốc 40°',
        image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
        desc: 'Nước mắm cá cơm than truyền thống ủ chượp ròng 12 tháng tại đảo ngọc. Vị mặn đằm nơi đầu lưỡi và hậu ngọt đậm đà kéo dài.',
        metrics: [
          { icon: Sparkles, text: '40 Độ đạm cốt nhĩ' },
          { icon: Package, text: 'Chai thủy tinh 520ml' },
          { icon: ShieldCheck, text: 'Chỉ dẫn địa lý' }
        ]
      },
      {
        name: 'Nước Giặt OMO Matic 4.2kg',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        desc: 'Công thức tạo bọt thông minh bảo vệ trục máy giặt cửa trước. Đánh bay vết bẩn cứng đầu chỉ trong một chu trình giặt ngắn.',
        metrics: [
          { icon: Sparkles, text: 'Túi tiết kiệm 4.2kg' },
          { icon: Package, text: 'Dành cho máy cửa trước' },
          { icon: ShieldCheck, text: 'Hương thơm bền lâu' }
        ]
      },
      {
        name: 'Combo Gia Vị Cơ Bản',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        desc: 'Bộ ngũ gia vị tiêu chuẩn gồm đường tinh luyện, muối tinh i-ốt, hạt nêm thịt thăn, tiêu đen xay nguyên chất và nước tương lên men tự nhiên.',
        metrics: [
          { icon: Sparkles, text: 'Đóng hộp combo tiện lợi' },
          { icon: Package, text: 'Đầy đủ 5 món' },
          { icon: ShieldCheck, text: 'Hạn dùng trên 12 tháng' }
        ]
      }
    ]
  }
];

export const EcosystemOrbit: React.FC = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('water');
  const [activeOptionIndex, setActiveOptionIndex] = useState<number>(0);

  const currentCategory =
    TOUR_CATEGORIES.find((cat) => cat.id === selectedCategoryId) || TOUR_CATEGORIES[0];

  const currentOption = currentCategory.options[activeOptionIndex] || currentCategory.options[0];

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setActiveOptionIndex(0);
  };

  return (
    <section id="categories" className="py-20 lg:py-28 bg-[#FAFAFA] border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12 lg:mb-16 text-left">
          <p className="font-mono text-xs uppercase tracking-widest text-slate-500 font-medium mb-3">
            DANH MỤC NHU YẾU PHẨM
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-slate-900 leading-tight">
            Những thứ gia đình bạn cần mỗi ngày, <br className="hidden sm:block" />
            chỉ cách đúng một nút bấm.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Không cần tìm kiếm qua hàng trăm danh mục trên ứng dụng. Nút bấm được định danh trực tiếp cho loại mặt hàng bạn thường xuyên tiêu thụ nhất.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* SPLIT-SCREEN INTERACTIVE SHOWCASE                                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* LEFT COLUMN: Interactive Category Menu (4 Categories) */}
          <div className="lg:col-span-5 space-y-3">
            {TOUR_CATEGORIES.map((cat) => {
              const isActive = selectedCategoryId === cat.id;
              const Icon = cat.icon;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  onMouseEnter={() => handleSelectCategory(cat.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 flex items-center justify-between group cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md translate-x-1'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Index Number */}
                    <span
                      className={`font-mono text-xs font-semibold ${
                        isActive ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      {cat.number}
                    </span>

                    {/* Icon Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={1.8} />
                    </div>

                    {/* Title & Subtitle */}
                    <div>
                      <h3 className="text-base font-bold tracking-tight">
                        {cat.name}
                      </h3>
                      <p
                        className={`text-xs mt-0.5 ${
                          isActive ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {cat.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Indicator Arrow */}
                  <ArrowRight
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isActive
                        ? 'text-white translate-x-1'
                        : 'text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5'
                    }`}
                  />
                </button>
              );
            })}

            {/* Subtle Hardware Positioning Note */}
            <div className="pt-4 px-2">
              <p className="text-xs text-slate-500 font-normal leading-relaxed">
                💡 <span className="font-semibold text-slate-700">Mẹo:</span> Rê chuột vào từng dòng sản phẩm bên phải để xem thông số kỹ thuật và hình ảnh thực tế.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: The Dynamic Preview Card */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_20px_40px_rgba(0,0,0,0.03)] p-6 sm:p-9 transition-all duration-300">
              
              {/* Pure & Clean Image Canvas: Zero clutter, perfectly centered floating product image */}
              <div className="relative w-full h-72 sm:h-84 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-6 mb-6 overflow-hidden select-none">
                
                {/* Subtle Ambient Radial Glow */}
                <div className="absolute w-52 h-52 rounded-full bg-slate-200/35 blur-2xl pointer-events-none" />

                {/* Physics-based Image Transition Wrapper */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentOption.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="relative z-10 w-full h-full flex items-center justify-center"
                  >
                    <motion.img
                      src={currentOption.image}
                      alt={currentOption.name}
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                      className="max-h-56 sm:max-h-64 max-w-[85%] object-contain filter drop-shadow-[0_16px_28px_rgba(0,0,0,0.08)]"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Title & Micro-Metrics Banner */}
              <div className="space-y-3">
                
                {/* Headline: Large, bold text-slate-900 */}
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {currentCategory.headline}
                </h3>

                {/* Punchy Metrics Banner - Xuống dòng từng dòng dấu chấm */}
                <div className="space-y-1 text-sm font-medium text-slate-600">
                  {currentCategory.metricsBanner.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-400 select-none">•</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                {/* Available Options: Subtle Uppercase Label: DÒNG SẢN PHẨM: */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
                    DÒNG SẢN PHẨM:
                  </p>

                  {/* Clean row of minimalist tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentCategory.options.map((opt, idx) => {
                      const isActive = activeOptionIndex === idx;

                      return (
                        <button
                          key={opt.name}
                          onMouseEnter={() => setActiveOptionIndex(idx)}
                          onClick={() => setActiveOptionIndex(idx)}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 cursor-pointer shadow-xs ${
                            isActive
                              ? 'bg-slate-900 text-white border border-slate-900 shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {opt.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dedicated Specs & Micro-Copy Reveal: No "Card-in-Card" box, transparent with 1px border-t separator */}
                  <div className="min-h-[85px] border-t border-slate-100 pt-3.5">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${selectedCategoryId}-${currentOption.name}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="space-y-2.5"
                      >
                        {/* Mô tả súc tích: trực tiếp trên nền card trắng */}
                        <p className="text-slate-500 text-sm leading-relaxed">
                          {currentOption.desc}
                        </p>

                        {/* Monochromatic SVG metrics row: Lucide icons (text-slate-400), no colorful OS emojis */}
                        <div className="flex flex-wrap items-center gap-y-2 gap-x-5 mt-2.5 text-[11px] font-medium text-slate-600 uppercase tracking-wide">
                          {currentOption.metrics.map((metric, i, arr) => {
                            const IconComponent = metric.icon;
                            return (
                              <span key={i} className="inline-flex items-center gap-1.5">
                                <IconComponent className="w-3.5 h-3.5 text-slate-400 stroke-[1.8] flex-shrink-0" />
                                <span>{metric.text}</span>
                                {i < arr.length - 1 && (
                                  <span className="text-slate-200 ml-3.5 select-none">•</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                </div>

              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
