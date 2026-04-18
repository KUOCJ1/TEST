/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sakura: {
          50: '#fff0f5',
          100: '#ffe0eb',
          200: '#ffc0d6',
          300: '#ff8fb3',
          400: '#ff5e90',
          500: '#ff2d6d',
          600: '#e6004a',
          700: '#c2003c',
          800: '#a00033',
          900: '#87002d',
        },
        tokyoBlue: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9ddff',
          300: '#7cbfff',
          400: '#369dff',
          500: '#0a7efa',
          600: '#0060db',
          700: '#004cb1',
          800: '#024191',
          900: '#073877',
        },
      },
    },
  },
  plugins: [],
}
