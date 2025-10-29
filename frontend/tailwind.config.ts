import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['index.html', './src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5B8DEF',
          50: '#EFF4FF',
          100: '#D9E4FF',
          200: '#B0C6FF',
          300: '#88A8FF',
          400: '#5B8DEF',
          500: '#3F6FDA',
          600: '#2F54B6',
          700: '#213C8F',
          800: '#142563',
          900: '#090F36'
        }
      }
    }
  },
  plugins: []
};

export default config;
