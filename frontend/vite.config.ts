import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createDevApiProxy } from './dev-api-proxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backendUrl = process.env.VITE_BACKEND_URL || env.VITE_BACKEND_URL || 'https://backend-fae8.onrender.com';
  return {
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
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'lucide-react',
        'framer-motion',
        'socket.io-client',
      ],
    },
    server: {
      port: 5173,
      host: true,
      watch: { ignored: ['**/dist/**', '**/.cache/**'] },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/api': createDevApiProxy(backendUrl),
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 5173,
      host: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/api': createDevApiProxy(backendUrl),
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
