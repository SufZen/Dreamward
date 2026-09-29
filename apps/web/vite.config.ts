import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendors into cacheable chunks. konva is
        // also route-lazy (see App.tsx) so it isn't fetched until the editor opens.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('konva')) return 'konva';
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react-router') || id.includes('/react-dom/') || /node_modules\/react\//.test(id))
            return 'react-vendor';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('dompurify') || id.includes('client-zip') || id.includes('@dnd-kit')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/media': { target: API_TARGET, changeOrigin: true },
    },
  },
});
