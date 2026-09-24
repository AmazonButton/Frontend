import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Flame, Wheat, Package, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { FptSmartButton } from '../components/hardware/FptSmartButton';
import { EcosystemOrbit } from '../components/EcosystemOrbit';

export const LandingPage: React.FC = () => {
  const [buttonPressed, setButtonPressed] = useState(false);
  const [ledState, setLedState] = useState<'idle' | 'amber' | 'green'>('idle');
  const [telemetryText, setTelemetryText] = useState('Trạng thái: Sẵn sàng • Deep Sleep < 15µA');

  // Video player controls state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Subtle, calm mechanical tactile click sound
  const playTactileClick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch { }
  };

  const playCalmConfirmation = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      [587.33, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.08, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.22);
      });
    } catch { }
  };

  const handleHardwarePress = () => {
    if (buttonPressed) return;
    setButtonPressed(true);
    playTactileClick();
    setLedState('amber');
    setTelemetryText('RTC Thức dậy (8ms) → Đang tạo băm HMAC-SHA256...');

    setTimeout(() => {
      setLedState('green');
      setTelemetryText('Lệnh đã gửi qua Wi-Fi 2.4GHz → Đại lý nhận đơn thành công (1.1s)');
      playCalmConfirmation();
    }, 650);

    setTimeout(() => {
      setLedState('idle');
      setButtonPressed(false);
      setTelemetryText('Trạng thái: Sẵn sàng • Deep Sleep < 15µA');
    }, 3800);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 selection:bg-slate-900 selection:text-white font-sans antialiased">
      {/* ========================================================================= */}
      {/* SECTION 1: HERO (Split 50/50 Layout)                                      */}
      {/* ========================================================================= */}
      <section id="features" className="pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-20 lg:pb-20 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* Left Column: Text & Value Proposition */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Monospace Kicker */}
              <p className="font-mono text-xs uppercase tracking-widest text-slate-500 font-medium">
                HỆ THỐNG ĐẶT HÀNG MỘT-CHẠM
              </p>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Một nút bấm vật lý. <br />
                Đặt đúng thứ bạn cần, tức thì.
              </h1>

              {/* Sub-headline */}
              <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed font-normal">
                Cầu nối trực tiếp giữa cư dân gia đình và các đơn vị cung ứng nước khoáng 20L, bình gas, nhu yếu phẩm tại địa phương. Loại bỏ hoàn toàn phiền toái mở ứng dụng, tìm kiếm hay gọi điện thoại mỗi lần hết đồ.
              </p>

              {/* CTA Group */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  to="/quick-setup"
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-[0.98]"
                >
                  Cài Wi-Fi Nút Bấm
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs border border-slate-200 transition-all shadow-sm active:scale-[0.98]"
                >
                  Dành Cho Đại Lý
                </Link>
              </div>

              {/* Single Clean 1-Line Technical Note */}
              <p className="text-xs font-mono text-slate-500 pt-3">
                Tương thích mạng 2.4GHz • Mã hóa HMAC tại phần cứng • Pin 12-18 tháng
              </p>
            </div>

            {/* Right Column: Physical Hardware Showcase - Apple / Teenage Engineering Aesthetic */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div className="w-full max-w-xl bg-white dark:bg-[#0B0F17] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-10 sm:p-14 lg:p-16 flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative select-none">
                <FptSmartButton onOrderTriggered={handleHardwarePress} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: PRODUCT STORY VIDEO SHOWCASE (Cinematic Video Presentation)   */}
      {/* ========================================================================= */}
      <section id="product-story" className="py-12 sm:py-16 lg:py-20 border-b border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 space-y-2.5">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500 font-medium">
              TRẢI NGHIỆM THỰC TẾ
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Khi nhu yếu phẩm xuất hiện đúng lúc bạn cần.
            </h2>
          </div>

          {/* Video Container (Optimized Max Width 860px for Viewport Framing) */}
          <div className="max-w-[860px] mx-auto">
            <div 
              onClick={togglePlay}
              className="relative group cursor-pointer overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_25px_70px_rgba(0,0,0,0.12)]"
            >
              <video
                ref={videoRef}
                src="/assets/TIKTOK.mp4"
                autoPlay
                loop
                muted={isMuted}
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full aspect-[16/9] object-cover block rounded-3xl"
              />

              {/* Minimalist Frosted Glass Play Overlay when Paused */}
              {!isPlaying && (
                <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center transition-all duration-300">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full backdrop-blur-md bg-white/20 border border-white/30 text-white flex items-center justify-center shadow-2xl transform transition-transform duration-300 group-hover:scale-110">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-0.5" />
                  </div>
                </div>
              )}

              {/* Sleek Minimal Controls Overlay (Mute / Unmute Button) */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 opacity-90 transition-opacity duration-300">
                <button
                  onClick={toggleMute}
                  title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                  className="p-3 rounded-full backdrop-blur-md bg-black/40 hover:bg-black/60 text-white border border-white/20 transition-all active:scale-95 shadow-lg"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white/80" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* Micro-copy Reassurance Below Video */}
            <p className="mt-6 text-center text-sm text-slate-500 font-normal leading-relaxed">
              Không cần mở điện thoại, không cần tìm kiếm — Mọi thứ chỉ cách một cái chạm tay.
            </p>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: ESSENTIAL ECOSYSTEM ORBIT (Interactive Architecture Map)       */}
      {/* ========================================================================= */}
      <EcosystemOrbit />

      {/* ========================================================================= */}
      {/* SECTION 4: CLOSING CTA (Single Central Focal Message)                     */}
      {/* ========================================================================= */}
      <section id="enterprise" className="py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="font-mono text-xs uppercase tracking-widest text-slate-500 font-medium">
            SẴN SÀNG THAY ĐỔI TRẢI NGHIỆM
          </p>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 max-w-2xl mx-auto leading-snug">
            Sẵn sàng số hóa kênh đặt hàng một-chạm cho chuỗi của bạn?
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Cung cấp phần cứng nút bấm thông minh ESP32, bảo mật HMAC chống giả mạo, dashboard điều phối tự động tức thì.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              to="/quick-setup"
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-[0.98]"
            >
              Cài Wi-Fi Nút Bấm
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs border border-slate-200 transition-all shadow-sm active:scale-[0.98]"
            >
              Cổng Đại Lý & Cửa Hàng
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
