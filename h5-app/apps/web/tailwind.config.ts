import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class', // 通过在 <html> 上加 .dark 切换
  theme: {
    extend: {
      colors: {
        // Matoo Power 绿能品牌色：科技绿 + 能量橙
        matoo: {
          DEFAULT: '#0E8F5A', // 主绿
          dark: '#0A6E45',
          light: '#E6F7EE',
          energy: '#FF7A1A', // 能量橙
          ink: '#0F172A',
          muted: '#64748B',
          border: '#E5E7EB',
          bg: '#F7FAF8',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 4px 16px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
