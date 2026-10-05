/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        cote: {
          blue: '#0369a1',
          orange: '#f97316',
        },
        // Custom dark mode colors with blue tint
        dark: {
          bg: '#0f1729', // Dark blue-tinted background
          card: '#1a2332', // Dark blue-tinted card
          hover: '#232d3f', // Dark blue-tinted hover
        }
      },
      backgroundColor: {
        // Override default dark mode backgrounds
        'dark-main': '#0f1729',
        'dark-card': '#1a2332',
      }
    },
  },
  plugins: [],
}

