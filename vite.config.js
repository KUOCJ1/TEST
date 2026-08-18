import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: '全方位職能評測',
        short_name: '職能評測',
        description: '線上自動計分與多構面落點分析',
        lang: 'zh-TW',
        theme_color: '#241f18',
        background_color: '#f6f1e7',
        display: 'standalone',
        orientation: 'portrait',
        // 相對路徑：VPS 正式站（base '/'）與 GitHub Pages 預覽（base '/TEST/'）都能正確解析。
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 只快取打包後的靜態檔（JS/CSS/HTML/圖示）做為 App Shell；/api 一律不快取
        // ——評測資料、登入狀態都是動態且與身分相關，快取到就是回傳錯誤/過期資料。
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      // 開發模式（vite dev）不啟用 service worker，避免開發時被舊快取干擾。
      devOptions: { enabled: false },
    }),
  ],
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
