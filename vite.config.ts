import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Keep long-lived framework code cacheable separately from route chunks.
        // Route-level imports in App.tsx ensure that a user only downloads the
        // screen they open, without changing any page logic or API flow.
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          animation: ['framer-motion'],
          charts: ['recharts'],
          // Displaying a QR code does not require the much larger camera decoder.
          'qr-scanner': ['html5-qrcode'],
          'qr-renderer': ['qrcode.react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: { ignored: ['**/dist/**', '**/.cache/**'] },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://backend-fae8.onrender.com',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'https://backend-fae8.onrender.com',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
});
