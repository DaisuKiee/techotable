/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    'dark:bg-dark-app',
    'dark:bg-dark-main',
    'dark:bg-dark-card',
    'dark:bg-dark-elevated',
    'dark:bg-dark-hover',
    'dark:text-dark-text-primary',
    'dark:text-dark-text-secondary',
    'dark:text-dark-text-muted',
    'dark:border-dark-border-subtle',
    'dark:border-dark-border-default',
    'dark:bg-dark-blue-primary',
    'dark:bg-dark-blue-hover',
    'dark:text-dark-blue-info',
    'dark:text-dark-error',
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
        // Dark mode color palette
        dark: {
          // Backgrounds
          app: '#0B1120',
          main: '#111827',
          card: '#1F2937',
          elevated: '#273449',
          hover: '#334155',
          
          // Borders
          'border-subtle': '#273449',
          'border-default': '#374151',
          'border-strong': '#4B5563',
          
          // Text
          'text-primary': '#F9FAFB',
          'text-secondary': '#D1D5DB',
          'text-muted': '#9CA3AF',
          'text-placeholder': '#6B7280',
          'text-disabled': '#4B5563',
          
          // Primary Blue
          'blue-info': '#3B82F6',
          'blue-primary': '#2563EB',
          'blue-hover': '#1D4ED8',
          'blue-active': '#1E40AF',
          'blue-dark-bg': '#1E3A8A',
          
          // Gold
          'gold-accent': '#FBBF24',
          'gold-warning': '#F59E0B',
          
          // Status
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        }
      },

    },
  },
  plugins: [],
}

