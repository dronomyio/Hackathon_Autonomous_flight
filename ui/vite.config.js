import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/goal':     { target: 'http://backend:8000', changeOrigin: true },
      '/obstacle': { target: 'http://backend:8000', changeOrigin: true },
      '/reset':    { target: 'http://backend:8000', changeOrigin: true },
      '/pause':    { target: 'http://backend:8000', changeOrigin: true },
      '/rl':       { target: 'http://backend:8000', changeOrigin: true },
      '/fault':    { target: 'http://backend:8000', changeOrigin: true },
      '/speed':    { target: 'http://backend:8000', changeOrigin: true },
      '/health':   { target: 'http://backend:8000', changeOrigin: true },
    }
  },
  build: {
    outDir: 'build'
  }
})
