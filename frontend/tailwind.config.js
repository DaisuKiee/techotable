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
        // Refined dark mode color scheme
        dark: {
          // Background hierarchy
          app: '#0B1120',      // Deepest background
          main: '#111827',     // Main containers (gray-900)
          card: '#1F2937',     // Cards, panels (gray-800)
          elevated: '#273449', // Raised elements, modals
          hover: '#334155',    // Interactive hover (slate-700)
          
          // Sidebar specific
          sidebar: '#0F172A',        // Sidebar base (slate-900)
          'sidebar-surface': '#111827',  // Sidebar surface
          'sidebar-hover': '#1E293B',    // Sidebar hover (slate-800)
          'sidebar-active': '#1D4ED8',   // Sidebar active (blue-700)
          
          // Borders
          border: '#374151',         // Default border (gray-700)
          'border-subtle': '#273449', // Subtle border
          'border-strong': '#4B5563', // Strong border (gray-600)
          
          // Text colors
          text: '#F9FAFB',           // Primary text (gray-50)
          'text-emphasis': '#FFFFFF', // Strong emphasis
          'text-secondary': '#D1D5DB', // Secondary text (gray-300)
          'text-muted': '#9CA3AF',    // Muted text (gray-400)
          'text-placeholder': '#6B7280', // Placeholder (gray-500)
          'text-disabled': '#4B5563',  // Disabled (gray-600)
        }
      },
      backgroundColor: {
        // Quick access background utilities
        'dark-app': '#0B1120',
        'dark-main': '#111827',
        'dark-card': '#1F2937',
        'dark-elevated': '#273449',
        'dark-hover': '#334155',
        'dark-sidebar': '#0F172A',
      },
      borderColor: {
        'dark-border': '#374151',
        'dark-border-subtle': '#273449',
        'dark-border-strong': '#4B5563',
      }
    },
  },
  plugins: [],
}

