/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Google Sans"', '"Segoe UI Variable"', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Google Sans"', '"Segoe UI Variable Display"', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#0078d4',
          hover: '#106ebe',
          light: '#2899f5',
          secondary: '#7c5ff5',
        },
        tmobile: {
          DEFAULT: '#E20074',
          hover: '#B5005D',
        },
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        pill: '100px',
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.08)',
        float: '0 12px 40px rgba(0,0,0,0.12), 0 0 2px rgba(0,0,0,0.1)',
        modal: '0 24px 64px rgba(0,0,0,0.22), 0 0 1px rgba(0,0,0,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { from: { transform: 'translateY(-16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
