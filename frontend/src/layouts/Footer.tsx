import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail('');
      setSubscribed(false);
    }, 4000);
  };

  return (
    <footer className="relative z-20 bg-[#FAFAFA] dark:bg-[#090D16] border-t border-slate-200/90 dark:border-slate-800 transition-colors selection:bg-slate-900 selection:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ========================================================================= */}
        {/* MAIN NAVIGATION & INFORMATION (4 Columns Layout matching design)          */}
        {/* ========================================================================= */}
        <div className="pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">

            {/* Col 1: Brand Info & Status (Span 4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white p-1 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
                  <img
                    src="/assets/logo.png"
                    alt="Smart Order Button"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    Smart Order Button
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    IoT Instant Commerce · v2.8
                  </span>
                </div>
              </Link>

              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                Hệ thống nút bấm thông minh một-chạm kết nối khách hàng trực tiếp với đại lý nước uống 20L, bình gas và hàng thiết yếu.
              </p>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-400 dark:text-slate-500 pt-1">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  MQTT Broker · Sẵn sàng
                </span>
                <span>Độ trễ &lt;14ms</span>
              </div>
            </div>

            {/* Col 2: Solutions (Span 2 cols) */}
            <div className="lg:col-span-2 space-y-3.5">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white">
                GIẢI PHÁP
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/quick-setup" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Nút Bấm Lavie 20L
                  </Link>
                </li>
                <li>
                  <Link to="/quick-setup" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Nút Đặt Bình Gas Tức Thì
                  </Link>
                </li>
                <li>
                  <Link to="/quick-setup" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Cung Ứng Nông Sản Định Kỳ
                  </Link>
                </li>
                <li>
                  <Link to="/quick-setup" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Vật Tư Tiêu Hao Văn Phòng
                  </Link>
                </li>
                <li>
                  <Link to="/quick-setup" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Thiết Lập Wi-Fi Nhanh (AP)
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Platform (Span 3 cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white">
                NỀN TẢNG
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/store/dashboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Bảng Quản Lý Cửa Hàng
                  </Link>
                </li>
                <li>
                  <Link to="/store/devices" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Giám Sát Nút Bấm IoT
                  </Link>
                </li>
                <li>
                  <Link to="/store/products" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Quản Lý Danh Mục Hàng
                  </Link>
                </li>
                <li>
                  <Link to="/customer/home" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Dữ Liệu Hành Vi Khách Hàng
                  </Link>
                </li>
                <li>
                  <Link to="/admin/dashboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                    Trung Tâm An Ninh Admin
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Newsletter & Contact (Span 3 cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white">
                LIÊN HỆ & CẬP NHẬT
              </h4>

              {/* Newsletter Form */}
              <form onSubmit={handleSubscribe} className="relative">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@cuahang.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all shadow-sm"
                    required
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 transition-all shrink-0 active:scale-95 shadow-sm"
                    title="Gửi"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {subscribed && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Đã ghi nhận đăng ký!</span>
                  </div>
                )}
              </form>

              {/* Contact Details */}
              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <div>
                  <span>Hotline: </span>
                  <strong className="text-slate-900 dark:text-white font-bold">1900 8829</strong>{' '}
                  <span className="text-slate-400 dark:text-slate-500">24/7</span>
                </div>
                <div>
                  <a href="mailto:contact@smartorderbutton.vn" className="hover:text-slate-800 dark:hover:text-white transition-colors">
                    contact@smartorderbutton.vn
                  </a>
                </div>
                <div>
                  Hà Nội & TP. Hồ Chí Minh
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM BAR: COPYRIGHT & LEGAL                                             */}
        {/* ========================================================================= */}
        <div className="border-t border-slate-200/80 dark:border-slate-800 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500">
            <p>© {new Date().getFullYear()} Smart Order Button. Nền tảng IoT Đặt Hàng Tức Thì.</p>
            <div className="flex items-center gap-6">
              <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Điều khoản
              </a>
              <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Bảo mật IoT
              </a>
              <a href="#warranty" onClick={(e) => e.preventDefault()} className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Bảo hành thiết bị
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
