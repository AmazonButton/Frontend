import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff, RefreshCw } from 'lucide-react';

interface QrCameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({ onScanSuccess }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'qr-camera-stream-box';

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        setCameraError(null);
        // Check cameras
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setCameraError('Không tìm thấy camera trên thiết bị này.');
          return;
        }

        html5QrCode = new Html5Qrcode(regionId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' }, // Prefer back camera on smartphones
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success
            if (html5QrCode && html5QrCode.isScanning) {
              html5QrCode.stop().catch(() => {});
            }
            setIsScanning(false);
            onScanSuccess(decodedText);
          },
          () => {
            // Ignore frame parse errors
          }
        );

        setIsScanning(true);
      } catch (err: any) {
        console.warn('Camera scan error:', err);
        setCameraError(
          err?.message || 'Không thể truy cập camera. Vui lòng cấp quyền camera trên trình duyệt.'
        );
        setIsScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shadow-inner flex items-center justify-center">
        {/* Stream container */}
        <div id={regionId} className="w-full h-full" />

        {/* Viewfinder overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-dashed border-sky-400/80 rounded-xl relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sky-400" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-sky-400" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-sky-400" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sky-400" />
              {/* Scan animation line */}
              <div className="w-full h-0.5 bg-sky-400/90 shadow-[0_0_8px_#38bdf8] animate-pulse mt-20" />
            </div>
          </div>
        )}

        {/* Loading / Error states */}
        {!isScanning && !cameraError && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-4 text-center space-y-2 text-slate-300">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
            <span className="text-xs font-medium">Đang kích hoạt Camera...</span>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center space-y-2 text-slate-300">
            <CameraOff className="w-7 h-7 text-rose-400" />
            <span className="text-xs font-medium text-rose-300">{cameraError}</span>
            <span className="text-[11px] text-slate-400">
              Bạn có thể chuyển sang tab "Nhập mã số" để gán thiết bị thủ công.
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center font-medium">
        Hướng camera về phía mã QR trên màn hình thiết bị hoặc vỏ hộp
      </p>
    </div>
  );
};
