/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
        display: ['"Manrope Variable"', 'Manrope', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent, #0ea5e9)',
          hover: 'var(--accent-hover, #0284c7)',
          light: 'var(--accent-light, #e0f2fe)',
          secondary: 'var(--accent-secondary, #6366f1)',
          glow: 'var(--accent-glow, rgba(14, 165, 233, 0.25))',
        },
        tmobile: {
          DEFAULT: '#E20074',
          hover: '#B5005D',
          light: '#FCE4EC',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          solid: 'var(--surface-solid)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        pill: '100px',
      },
      boxShadow: {
        card: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px -4px rgba(0,0,0,0.06))',
        float: 'var(--shadow-float, 0 16px 40px -8px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08))',
        modal: 'var(--shadow-modal, 0 25px 60px -15px rgba(0,0,0,0.35))',
        glow: '0 0 24px -4px var(--accent-glow)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { from: { transform: 'translateY(-12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        pulseSubtle: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
}
