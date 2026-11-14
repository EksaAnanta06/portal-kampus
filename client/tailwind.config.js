// FILE: client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  // Preflight dimatikan agar tidak bentrok dengan CssBaseline milik MUI.
  // Class Tailwind tetap bisa meng-override MUI karena <StyledEngineProvider injectFirst>.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        pasim: {
          50: '#FBEFF0',
          100: '#F5D6D8',
          200: '#EBADB1',
          300: '#DC7A80',
          400: '#C44A51',
          500: '#A82B32',
          600: '#8B1E24',
          700: '#71181D',
          800: '#561216',
          900: '#3B0C0F',
          950: '#260608',
          DEFAULT: '#8B1E24',
        },
        navy: {
          DEFAULT: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        gold: {
          DEFAULT: '#D97706',
          light: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
