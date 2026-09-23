import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        matoo: {
          DEFAULT: '#0E8F5A',
          dark: '#0A6E45',
          light: '#E6F7EE',
          energy: '#FF7A1A',
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
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        elevated: '0 4px 12px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
export default config;