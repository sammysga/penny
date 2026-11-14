/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), sunken: v('sunken'), line: v('line'),
        ink: v('ink'), muted: v('muted'), faint: v('faint'),
        forest: v('forest'), sage: v('sage'), beige: v('beige'), gold: v('gold'),
        accent: v('accent'), 'accent-ink': v('accent-ink'),
        warn: v('warn'), danger: v('danger'), good: v('good'),
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.08)' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(0.6)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        shimmer: { '0%': { opacity: 0.4 }, '50%': { opacity: 1 }, '100%': { opacity: 0.4 } },
        floatUp: { '0%': { opacity: 0, transform: 'translateY(0) scale(.8)' }, '20%': { opacity: 1 }, '100%': { opacity: 0, transform: 'translateY(-90px) scale(1)' } },
      },
      animation: {
        rise: 'rise .35s ease-out both', pop: 'pop .35s ease-out both',
        shimmer: 'shimmer 1.6s ease-in-out infinite', floatUp: 'floatUp 1.8s ease-out forwards',
      },
    },
  },
  plugins: [],
};
