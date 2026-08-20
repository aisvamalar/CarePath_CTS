import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'axios'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rolldownOptions: {
      external: [],
    },
  },
});
