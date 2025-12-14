/** @type {import('tailwindcss').Config} */
module.exports = {
  // ==========================================================================
  // PRISM Writer - Tailwind CSS Configuration
  // ==========================================================================
  
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  
  darkMode: 'class', // 다크 모드 지원
  
  theme: {
    extend: {
      // PRISM Writer 브랜드 컬러
      colors: {
        prism: {
          primary: '#6366f1',    // Indigo
          secondary: '#ec4899',  // Pink
          accent: '#8b5cf6',     // Purple
          dark: '#1e1b4b',       // Dark Indigo
          light: '#f5f3ff',      // Light Purple
        },
      },
      // 듀얼 페인 레이아웃용 커스텀 값
      minWidth: {
        'pane': '20%',
      },
      maxWidth: {
        'pane': '80%',
      },
    },
  },
  
  plugins: [],
}
