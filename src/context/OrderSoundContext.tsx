import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { API_URL } from '../services/api';

interface StoreOrderAnnouncementData {
  customerName?: string;
  productName?: string;
  quantity?: number;
  totalAmount?: number;
  orderNumber?: string;
}

interface SoundContextType {
  playOrderChime: (isCustomer?: boolean) => void;
  playCancelChime: () => void;
  playButtonClickSound: () => void;
  announceStoreOrder: (data?: StoreOrderAnnouncementData) => void;
  testSound: () => void;
  testStoreBankSpeaker: () => void;
  isSoundEnabled: boolean;
  toggleSound: () => void;
  isVoiceEnabled: boolean;
  toggleVoice: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// Shared singleton AudioContext with user-gesture auto-resume
let sharedAudioCtx: AudioContext | null = null;
let currentPlayingAudio: HTMLAudioElement | null = null;
let lastAnnounceTimestamp = 0;

const getAudioContext = (): AudioContext | null => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn('Cannot init AudioContext:', e);
    return null;
  }
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('smart_order_sound_enabled') !== 'false';
  });
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(() => {
    return localStorage.getItem('smart_order_voice_enabled') !== 'false';
  });

  const isSoundEnabledRef = useRef(isSoundEnabled);
  isSoundEnabledRef.current = isSoundEnabled;
  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  isVoiceEnabledRef.current = isVoiceEnabled;

  const toggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('smart_order_sound_enabled', String(next));
      if (next) {
        getAudioContext();
      }
      return next;
    });
  };

  const toggleVoice = () => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('smart_order_voice_enabled', String(next));
      return next;
    });
  };

  // Pre-load speech voices & auto-unlock
  useEffect(() => {
    const unlock = () => {
      getAudioContext();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    };
    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Web Audio Tone Synthesizer with smooth envelopes
  const playTone = (
    freq: number,
    type: OscillatorType,
    duration: number,
    delay: number = 0,
    volume: number = 0.35,
  ) => {
    if (!isSoundEnabledRef.current) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      setTimeout(() => {
        try {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = type;
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(volume, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + duration);
        } catch (err) {
          console.warn('Audio tone play error:', err);
        }
      }, delay);
    } catch (e) {
      console.warn('Audio playback not permitted yet:', e);
    }
  };

  // 🎙️ Phát giọng đọc tiếng Việt gốc (Chuẩn Google tự nhiên, trong trẻo, không bị méo/vang)
  const playVietnameseVoiceAudio = (text: string) => {
    if (!isVoiceEnabledRef.current) return;

    // Dừng ngay lập tức bất kỳ âm thanh nào đang phát trước đó
    if (currentPlayingAudio) {
      try {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
      } catch (e) {}
      currentPlayingAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      const audioUrl = `${API_URL}/api/tts?text=${encodeURIComponent(text)}`;
      const audio = new Audio(audioUrl);
      currentPlayingAudio = audio;

      audio.onended = () => {
        if (currentPlayingAudio === audio) {
          currentPlayingAudio = null;
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio stream failed, fallback to SpeechSynthesis:', err);
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = 1.0;
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find((v) => v.lang === 'vi-VN' || v.lang.includes('vi'));
            if (viVoice) utterance.voice = viVoice;
            window.speechSynthesis.speak(utterance);
          }
        });
      }
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  };

  // 📢 1. Loa thông báo ngân hàng cho Cửa Hàng (Smart Bank Speaker / Soundbox)
  const announceStoreOrder = (data?: StoreOrderAnnouncementData) => {
    if (!isSoundEnabledRef.current) return;

    // Chống lặp / dội âm trong vòng 1.2 giây
    const now = Date.now();
    if (now - lastAnnounceTimestamp < 1200) return;
    lastAnnounceTimestamp = now;

    // A. Chuông Ting Ting dứt khoát, thanh thoát
    playTone(1046.5, 'sine', 0.12, 0, 0.35);   // C6
    playTone(1318.5, 'sine', 0.18, 120, 0.38); // E6

    // B. Giọng đọc tiếng Việt: Chỉ đọc tên người đặt và món hàng
    if (isVoiceEnabledRef.current) {
      setTimeout(() => {
        const customer = data?.customerName || '';
        const product = data?.productName || '';
        const qty = data?.quantity || 1;

        let speechText = 'Bạn có đơn hàng mới!';
        if (customer && product) {
          speechText = `Bạn có đơn hàng mới từ ${customer}, ${qty > 1 ? `${qty} ` : ''}${product}!`;
        } else if (customer) {
          speechText = `Bạn có đơn hàng mới từ ${customer}!`;
        } else if (product) {
          speechText = `Bạn có đơn hàng mới: ${qty > 1 ? `${qty} ` : ''}${product}!`;
        }

        playVietnameseVoiceAudio(speechText);
      }, 350);
    }
  };

  // 🔔 2. Chuông cho Khách Hàng (Ting ting xác nhận đặt thành công)
  const playOrderChime = (isCustomer: boolean = false) => {
    if (!isSoundEnabledRef.current) return;

    if (isCustomer) {
      // E5 -> G#5 -> B5 -> E6 arpeggio
      playTone(659.25, 'sine', 0.28, 0, 0.3);
      playTone(830.61, 'sine', 0.28, 120, 0.35);
      playTone(987.77, 'sine', 0.35, 240, 0.38);
      playTone(1318.51, 'triangle', 0.65, 360, 0.4);

      if (isVoiceEnabledRef.current) {
        setTimeout(() => {
          playVietnameseVoiceAudio('Đơn hàng mới từ nút bấm đã được đặt thành công!');
        }, 500);
      }
    } else {
      announceStoreOrder();
    }
  };

  // ⚠️ 3. Chuông khi Hủy Đơn
  const playCancelChime = () => {
    if (!isSoundEnabledRef.current) return;
    playTone(523.25, 'sawtooth', 0.25, 0, 0.25);
    playTone(392.0, 'sawtooth', 0.35, 180, 0.28);
    playTone(329.63, 'sine', 0.45, 360, 0.2);

    if (isVoiceEnabledRef.current) {
      setTimeout(() => {
        playVietnameseVoiceAudio('Đơn hàng đã được hủy qua nút bấm.');
      }, 400);
    }
  };

  // 🔘 4. Click Sound
  const playButtonClickSound = () => {
    if (!isSoundEnabledRef.current) return;
    playTone(880, 'sine', 0.08, 0, 0.25);
    playTone(1760, 'triangle', 0.06, 10, 0.15);
  };

  // 🔊 5. Test sound helpers
  const testSound = () => {
    getAudioContext();
    if (user?.role === 'CUSTOMER') {
      playOrderChime(true);
    } else {
      testStoreBankSpeaker();
    }
  };

  const testStoreBankSpeaker = () => {
    getAudioContext();
    announceStoreOrder({
      customerName: 'Nguyễn Văn An',
      productName: 'Dầu đậu nành Simply Can 5L',
      quantity: 1,
    });
  };

  // WebSocket Live Real-time Listener
  useEffect(() => {
    const socket = getSocket();

    const handleOrderCreated = (payload: any) => {
      console.log('🔔 [LIVE AUDIO] New order triggered! Payload:', payload);
      const isStore = user && ['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'SUPER_ADMIN'].includes(user.role);

      if (isStore) {
        announceStoreOrder({
          customerName: payload?.customerName || payload?.order?.customerName,
          productName: payload?.productName,
          quantity: payload?.quantity,
          totalAmount: payload?.order?.totalAmount,
          orderNumber: payload?.order?.orderNumber,
        });
      } else {
        playOrderChime(true);
      }
    };

    const handleOrderCancelled = () => {
      playCancelChime();
    };

    const handleButtonPressing = () => {
      playButtonClickSound();
    };

    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);
    socket.on('BUTTON_PRESSING', handleButtonPressing);

    return () => {
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('BUTTON_PRESSING', handleButtonPressing);
    };
  }, [user]);

  return (
    <SoundContext.Provider
      value={{
        playOrderChime,
        playCancelChime,
        playButtonClickSound,
        announceStoreOrder,
        testSound,
        testStoreBankSpeaker,
        isSoundEnabled,
        toggleSound,
        isVoiceEnabled,
        toggleVoice,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within SoundProvider');
  return ctx;
};
