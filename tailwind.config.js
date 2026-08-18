/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 舊品牌色（紫羅蘭）。尚未逐一改版的畫面（後台徽章、標籤等）仍會用到，
        // 保留供漸進遷移；新畫面請改用下面的 ink / paper / brass。
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // 2024 版視覺系統（「顧問報告」方向）：暖白紙 + 墨色 + 黃銅點綴，
        // 取代原本的紫色漸層。
        paper: {
          50: '#fefdfb',
          100: '#f6f1e7',
          200: '#efe6d4',
          300: '#e3d5b8',
        },
        ink: {
          50: '#8a8378',
          100: '#6b5a4d',
          200: '#604f42',
          300: '#554539',
          400: '#4a4335',
          500: '#3e3429',
          600: '#33291f',
          700: '#241f18',
          800: '#1d1912',
          900: '#17130e',
        },
        brass: {
          50: '#f6ecd7',
          100: '#e9d3a0',
          200: '#dbbb72',
          300: '#c7a355',
          400: '#a9752e',
          500: '#8a6a2f',
          600: '#6f5424',
          700: '#584419',
        },
        // 全站絕大多數畫面都是直接用 slate-* 當中性色階（背景／文字／邊框），
        // 把這組改成暖灰，既有元件不用逐一改 class 就能套上新的紙感視覺系統。
        slate: {
          50: '#fefdfb',
          100: '#f6f1e7',
          200: '#efe6d4',
          300: '#ddd0ba',
          400: '#b3a48c',
          500: '#8a7d68',
          600: '#6b5a4d',
          700: '#4a4335',
          800: '#33291f',
          900: '#241f18',
          950: '#17130e',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['"Noto Serif TC"', 'Georgia', 'serif'],
        display: ['"Newsreader"', '"Noto Serif TC"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,19,14,.04), 0 8px 24px -14px rgba(23,19,14,.16)',
        'card-hover': '0 4px 12px rgba(23,19,14,.06), 0 16px 32px -16px rgba(23,19,14,.22)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
