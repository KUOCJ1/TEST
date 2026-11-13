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
        // 「榕光 Banyan Glow」視覺系統（2026-11，docs/design/UI_UX_REFRESH_PROPOSAL.md）：
        // 榕綠（主色）＋暖陽金（點綴）＋暖紙（底色）。為了讓既有元件不用逐一改 class，
        // 沿用原本的 token 名稱，只重新對映色值：
        //   ink   → 榕綠色階（ink-700 ＝ 主色，bg-ink-700 是主要按鈕／選取狀態；ink-50／100 是次要文字灰）
        //   brass → 暖陽金色階（500／600 當文字用，已調到過 WCAG AA）
        //   paper → 暖紙色階（50 ＝ 卡片白、100 ＝ 頁面底）
        //   slate → 偏綠的暖灰（中性色階）
        // 所有文字配色對比皆已驗算 ≥ 4.5:1（見建議書 3.1）。
        brand: {
          50: '#e4f0e6', 100: '#cfe5d6', 200: '#a9d1ba', 300: '#7cb89a', 400: '#4a9477',
          500: '#2f7a55', 600: '#1f5d4a', 700: '#174838', 800: '#10352a', 900: '#0b261e',
        },
        paper: {
          50: '#ffffff',
          100: '#fbf7ef',
          200: '#f3ecdd',
          300: '#e6dcc8',
        },
        ink: {
          50: '#5b6760',
          100: '#55615a',
          200: '#4b5a52',
          300: '#3b6b5a',
          400: '#2e6652',
          500: '#256050',
          600: '#1f5d4a',
          700: '#1f5d4a',
          800: '#174838',
          900: '#10352a',
        },
        brass: {
          50: '#fcefd3',
          100: '#f8dfa6',
          200: '#f2b544',
          300: '#e8a63a',
          400: '#e39a2d',
          500: '#8a5200',
          600: '#7a4900',
          700: '#5f3800',
        },
        slate: {
          50: '#fbf7ef',
          100: '#f3eee2',
          200: '#e6dcc8',
          300: '#d6ccb6',
          400: '#5e6a63',
          500: '#56625b',
          600: '#46524b',
          700: '#34413a',
          800: '#27322d',
          900: '#1f2924',
          950: '#141c18',
        },
        // 狀態色：正向用 sage、待加強用深琥珀（文字色皆 ≥ 4.5:1）。
        emerald: { 600: '#2f7a55' },
        amber: { 600: '#8a5200' },
        red: { 600: '#a8452d' },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['"Noto Serif TC"', 'Georgia', 'serif'],
        display: ['"Newsreader"', '"Noto Serif TC"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(31,41,36,.05), 0 10px 28px -16px rgba(31,41,36,.22)',
        'card-hover': '0 4px 12px rgba(31,41,36,.07), 0 18px 36px -16px rgba(31,41,36,.28)',
        cta: '0 6px 14px -8px rgba(23,72,56,.8)',
      },
      // 圓角統一三級：小元件 8px／按鈕與輸入 12px／卡片 16px（大區塊 24px）。
      borderRadius: {
        sm: '0.5rem',
        md: '0.75rem',
        lg: '0.875rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
