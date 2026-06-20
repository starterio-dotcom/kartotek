import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // A beágyazott média (<img>/<video>) relatív /api URL-jei a backendre proxyzva.
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/teszt-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
