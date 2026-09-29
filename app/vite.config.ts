import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Two pages: the main window and the floating overlay window.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: {
    target: 'chrome110',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), overlay: resolve(__dirname, 'overlay.html') } },
  },
});
