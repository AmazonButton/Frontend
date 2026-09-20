import React from 'react';

interface IoTBlueprintWatermarkProps {
  className?: string;
  mouseOffset?: { x: number; y: number };
}

export const IoTBlueprintWatermark: React.FC<IoTBlueprintWatermarkProps> = ({
  className = '',
  mouseOffset = { x: 0, y: 0 },
}) => {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden flex items-center justify-center transition-transform duration-300 ease-out ${className}`}
      style={{
        transform: `translate3d(${mouseOffset.x * 0.35}px, ${mouseOffset.y * 0.35}px, 0)`,
        maskImage: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,1) 35%, rgba(0,0,0,0.7) 70%, transparent 95%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,1) 35%, rgba(0,0,0,0.7) 70%, transparent 95%)',
      }}
    >
      <svg
        className="w-[1400px] h-[950px] sm:w-[1700px] sm:h-[1100px] text-blue-700 dark:text-red-500 opacity-[0.04] dark:opacity-[0.07] transition-opacity duration-300"
        viewBox="0 0 1400 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        {/* ================================================================= */}
        {/* CENTRAL MICROCONTROLLER DIE (ESP32-S3 CORE)                       */}
        {/* ================================================================= */}
        <g transform="translate(700, 450)">
          {/* Silicon Die Outline */}
          <rect x="-90" y="-90" width="180" height="180" rx="14" strokeWidth="1.5" />
          <rect x="-80" y="-80" width="160" height="160" rx="10" strokeDasharray="4 4" strokeWidth="0.8" />
          
          {/* Inner Core Sections */}
          <rect x="-70" y="-70" width="60" height="60" rx="4" />
          <text x="-40" y="-35" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            XTENSA DUAL-CORE
          </text>
          <text x="-40" y="-22" fontSize="7" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            240MHz
          </text>

          <rect x="10" y="-70" width="60" height="40" rx="4" />
          <text x="40" y="-45" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            2.4GHz RF PHY
          </text>

          <rect x="10" y="-20" width="60" height="40" rx="4" />
          <text x="40" y="5" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            HMAC-SHA256
          </text>
          <text x="40" y="16" fontSize="7" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            CRYPTO ENGINE
          </text>

          <rect x="-70" y="0" width="60" height="70" rx="4" />
          <text x="-40" y="32" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            RTC & POWER
          </text>
          <text x="-40" y="44" fontSize="7" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            ULP COPROCESSOR
          </text>
          <text x="-40" y="56" fontSize="7" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            &lt; 15µA SLEEP
          </text>

          <rect x="10" y="30" width="60" height="40" rx="4" />
          <text x="40" y="52" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            NVS FLASH
          </text>
          <text x="40" y="63" fontSize="7" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            Wi-Fi STORAGE
          </text>

          {/* IC Pinouts */}
          {[-70, -50, -30, -10, 10, 30, 50, 70].map((pos, idx) => (
            <React.Fragment key={idx}>
              {/* Top Pins */}
              <line x1={pos} y1="-90" x2={pos} y2="-108" strokeWidth="1.2" />
              <circle cx={pos} cy="-108" r="2" fill="currentColor" />
              {/* Bottom Pins */}
              <line x1={pos} y1="90" x2={pos} y2="108" strokeWidth="1.2" />
              <circle cx={pos} cy="108" r="2" fill="currentColor" />
              {/* Left Pins */}
              <line x1="-90" y1={pos} x2="-108" y2={pos} strokeWidth="1.2" />
              <circle cx="-108" cy={pos} r="2" fill="currentColor" />
              {/* Right Pins */}
              <line x1="90" y1={pos} x2="108" y2={pos} strokeWidth="1.2" />
              <circle cx="108" cy={pos} r="2" fill="currentColor" />
            </React.Fragment>
          ))}
        </g>

        {/* ================================================================= */}
        {/* CONCENTRIC WIRELESS RF RADIATION ARCS                             */}
        {/* ================================================================= */}
        <g transform="translate(700, 450)" strokeDasharray="6 6" strokeWidth="0.8">
          <circle cx="0" cy="0" r="160" />
          <circle cx="0" cy="0" r="220" />
          <circle cx="0" cy="0" r="290" />
          <circle cx="0" cy="0" r="370" />
          <circle cx="0" cy="0" r="460" strokeDasharray="8 8" />
          <circle cx="0" cy="0" r="560" strokeDasharray="12 12" />
        </g>

        {/* ================================================================= */}
        {/* CIRCUIT BUS TRACES & SCHEMATIC TRACKS                             */}
        {/* ================================================================= */}
        {/* Top-Right Quadrant: Antenna & RF Matching Network */}
        <path d="M 770 342 L 770 260 L 860 170 L 1020 170 L 1080 110 L 1220 110" strokeWidth="1.2" />
        <circle cx="1220" cy="110" r="3" />
        {/* Antenna Symbol */}
        <path d="M 1220 110 L 1220 60 M 1205 60 L 1235 60 M 1205 60 L 1220 80 M 1235 60 L 1220 80" strokeWidth="1.2" />
        <text x="1140" y="98" fontSize="9" fontFamily="monospace" fill="currentColor" stroke="none">
          RF_ANTENNA_2.4G (50 OHM)
        </text>

        {/* Top-Left Quadrant: RTC GPIO Button Interrupt Circuit */}
        <path d="M 630 342 L 630 250 L 520 140 L 380 140 L 320 80 L 180 80" strokeWidth="1.2" />
        <circle cx="180" cy="80" r="3" />
        {/* Physical Tactile Switch Symbol */}
        <path d="M 380 140 L 410 140 M 440 140 L 470 140 M 410 140 L 436 122" strokeWidth="1.2" />
        <circle cx="410" cy="140" r="2.5" />
        <circle cx="440" cy="140" r="2.5" />
        <text x="250" y="68" fontSize="9" fontFamily="monospace" fill="currentColor" stroke="none">
          SW1_RTC_GPIO_WAKEUP (PULLUP 10K)
        </text>

        {/* Left Side: Battery Telemetry & ADC Voltage Divider */}
        <path d="M 592 410 L 480 410 L 420 470 L 260 470 L 220 510 L 100 510" strokeWidth="1.2" />
        <circle cx="100" cy="510" r="3" />
        {/* Resistor Divider R1/R2 */}
        <path d="M 320 470 L 328 462 L 336 478 L 344 462 L 352 478 L 360 470" strokeWidth="1.2" />
        <text x="140" y="498" fontSize="9" fontFamily="monospace" fill="currentColor" stroke="none">
          VBAT_ADC_MONITOR (3.0V - 4.2V)
        </text>

        {/* Ground Symbols */}
        <g transform="translate(100, 510)">
          <line x1="0" y1="0" x2="0" y2="15" strokeWidth="1.2" />
          <line x1="-10" y1="15" x2="10" y2="15" strokeWidth="1.5" />
          <line x1="-6" y1="19" x2="6" y2="19" strokeWidth="1.2" />
          <line x1="-2" y1="23" x2="2" y2="23" strokeWidth="1" />
        </g>

        {/* Right Side: High-Speed UART & Status LED Telemetry */}
        <path d="M 808 430 L 920 430 L 980 370 L 1140 370 L 1190 420 L 1300 420" strokeWidth="1.2" />
        <circle cx="1300" cy="420" r="3" />
        {/* Diode / LED Symbol */}
        <path d="M 1040 370 L 1060 358 L 1060 382 Z M 1060 358 L 1060 382" strokeWidth="1.2" />
        <text x="1110" y="358" fontSize="9" fontFamily="monospace" fill="currentColor" stroke="none">
          RGB_STATUS_HALO (WS2812B DATA)
        </text>

        {/* Bottom-Right Quadrant: HMAC Security Crypto Bus */}
        <path d="M 770 558 L 770 640 L 880 750 L 1040 750 L 1100 810 L 1260 810" strokeWidth="1.2" />
        <circle cx="1260" cy="810" r="3" />
        <text x="1060" y="738" fontSize="9" fontFamily="monospace" fill="currentColor" stroke="none">
          HMAC_SHA256_AUTHENTICATION_BUS
        </text>

        {/* Bottom-Left Quadrant: Low Dropout Regulator (LDO 3.3V) */}
        <path d="M 630 558 L 630 650 L 500 780 L 320 780 L 260 840 L 120 840" strokeWidth="1.2" />
        <circle cx="120" cy="840" r="3" />
        {/* Capacitor Symbols */}
        <g transform="translate(410, 780)">
          <line x1="0" y1="-12" x2="0" y2="12" strokeWidth="1.5" />
          <line x1="6" y1="-12" x2="6" y2="12" strokeWidth="1.5" />
        </g>
        <text x="160" y="828" fontSize="9" fontFamily="monospace" fill="currentColor" stroke="none">
          LDO_REGULATOR_ME6211 (3.3V / 500mA)
        </text>

        {/* ================================================================= */}
        {/* TECHNICAL SCHEMATIC GRID METRICS & RULERS                         */}
        {/* ================================================================= */}
        <g opacity="0.6" strokeDasharray="2 4" strokeWidth="0.6">
          {/* Horizontal Metric Crosshairs */}
          <line x1="80" y1="450" x2="1320" y2="450" />
          {/* Vertical Metric Crosshairs */}
          <line x1="700" y1="60" x2="700" y2="840" />
        </g>

        {/* Blueprint Framing Corner Brackets */}
        <path d="M 50 100 L 50 50 L 100 50" strokeWidth="1.8" />
        <path d="M 1350 100 L 1350 50 L 1300 50" strokeWidth="1.8" />
        <path d="M 50 800 L 50 850 L 100 850" strokeWidth="1.8" />
        <path d="M 1350 800 L 1350 850 L 1300 850" strokeWidth="1.8" />

        {/* Architectural Technical Block Stamp */}
        <g transform="translate(1130, 810)">
          <rect x="0" y="0" width="200" height="55" rx="3" strokeWidth="1" fill="none" />
          <line x1="0" y1="20" x2="200" y2="20" strokeWidth="0.8" />
          <line x1="100" y1="20" x2="100" y2="55" strokeWidth="0.8" />
          <text x="100" y="14" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor" stroke="none">
            SMART ORDER BUTTON SCHEMATIC v2.1
          </text>
          <text x="10" y="34" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">
            REV: C4-PROD
          </text>
          <text x="10" y="47" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">
            MCU: ESP32-S3
          </text>
          <text x="110" y="34" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">
            DATE: 2026-09
          </text>
          <text x="110" y="47" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">
            DOC: SOB-HW-8829
          </text>
        </g>
      </svg>
    </div>
  );
};
