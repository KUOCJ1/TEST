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
  build: {
    rollupOptions: {
      output: {
        // React 全家桶變動頻率遠低於應用程式碼，獨立成 vendor chunk 讓瀏覽器長期快取；
        // 其餘各頁面/功能已透過 lazy() 動態載入自然拆分（如 CoachDashboard、
        // AdminDashboard 及其內部的 BatchUploadSection／xlsx），這裡不再手動介入。
        manualChunks(id) {
          if (id.includes('node_modules') && /\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'vendor';
          }
        },
      },
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
