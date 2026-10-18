import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// 字型自架（開源 OFL 授權）：不再向 Google Fonts 發請求，訪客 IP 不會送給第三方。
// 中文字型是切成許多 unicode-range 小檔，瀏覽器只下載頁面用到的字，不會整包載入。
// 只載入實際用到的字重（400／500／700）：其餘字重由瀏覽器就近選用，避免 dist 變得過大。
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/500.css'
import '@fontsource/noto-sans-tc/700.css'
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/700.css'
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-500.css'
import '@fontsource/newsreader/latin-400-italic.css'
import '@fontsource/newsreader/latin-500-italic.css'
import './index.css'
import './styles/dark-status.css'
import App from './App.jsx'
import ErrorBoundary from './survey/components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
