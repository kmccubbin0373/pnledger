import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' is important so the production build works inside Electron (file://)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
