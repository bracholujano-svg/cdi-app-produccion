/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'border-pulse-orange': {
          '0%, 100%': { borderColor: 'rgba(249, 115, 22, 0.2)', boxShadow: '0 0 0 rgba(249,115,22,0)' },
          '50%': { borderColor: 'rgba(249, 115, 22, 1)', boxShadow: '0 0 12px rgba(249,115,22,0.4)' },
        },
        'border-pulse-red': {
          '0%, 100%': { borderColor: 'rgba(248, 113, 113, 0.2)', boxShadow: '0 0 0 rgba(248,113,113,0)' },
          '50%': { borderColor: 'rgba(248, 113, 113, 1)', boxShadow: '0 0 12px rgba(248,113,113,0.4)' },
        },
        'bg-pulse-orange': {
          '0%, 100%': { backgroundColor: 'rgba(249, 115, 22, 0.1)' },
          '50%': { backgroundColor: 'rgba(249, 115, 22, 0.3)' },
        },
        'bg-pulse-red': {
          '0%, 100%': { backgroundColor: 'rgba(248, 113, 113, 0.1)' },
          '50%': { backgroundColor: 'rgba(248, 113, 113, 0.3)' },
        }
      },
      animation: {
        'border-pulse-orange': 'border-pulse-orange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-pulse-red': 'border-pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bg-pulse-orange': 'bg-pulse-orange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bg-pulse-red': 'bg-pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}