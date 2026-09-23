import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class', // 通过在 <html> 上加 .dark 切换
  theme: {
    extend: {
      colors: {
        // v1.4 T-2d X1:统一到 brand 站三色（#0052CC 科技蓝 / #36B37E 强调绿 / #091E42 深色）
        // memory “品牌主色调规范”:主色 #0052CC（按钮/链接/强调）
        // energy #36B37E 继承自 website/admin.css 变量配色
        matoo: {
          DEFAULT: '#0052CC', // 主蓝（科技蓝）
          dark: '#091E42',    // 深色（text / heading）
          light: '#E6F0FB',   // 蓝浅背景（card hover / chip bg）
          energy: '#36B37E',  // 强调绿（成功态 / 高亮）
          ink: '#0F172A',     // 主文本色
          muted: '#64748B',   // 次要文本色
          border: '#E5E7EB',  // 描边
          bg: '#F7FAF8',      // 页面背景
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
