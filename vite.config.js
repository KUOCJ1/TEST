import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || '/',
  // 本機開發時將 /api 轉發到後端服務，前端統一以相對路徑呼叫 API。
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // 後端有自己的測試（node --test），不納入 Vitest。
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**'],
  },
})
