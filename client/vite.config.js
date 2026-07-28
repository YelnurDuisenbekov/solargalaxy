import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/leaflet')) return 'leaflet';
          if (id.includes('node_modules/html2canvas') || id.includes('node_modules/jspdf')) return 'pdf';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor-react';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
