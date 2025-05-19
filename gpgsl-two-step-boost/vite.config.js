import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/login': {
        target: 'http://localhost:5250', // or whatever port your backend runs on
        changeOrigin: true,
        secure: false
      }
    }
  }
})