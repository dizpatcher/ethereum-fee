/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Финансовый университет — брендбук
        fa: {
          dark:   '#256569', // основной тёмно-бирюзовый
          mid:    '#006B80', // дополнительный средний
          bright: '#0098AF', // дополнительный яркий
          blue:   '#355CA8', // синий фирменного знака
          red:    '#D80F16', // красный фирменного знака
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
