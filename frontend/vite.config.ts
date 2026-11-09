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
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          animation: ['framer-motion'],
          charts: ['recharts'],
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
