/** @type {import('tailwindcss').Config} */
// El preset mapea los design tokens (CSS variables --pieia-*) a utilidades de Tailwind
// legibles (bg-primary, rounded-control, shadow-1...). REGLAS_DISENO_Sistema.md §3, §17.
// Asi el codigo nunca usa valores crudos y todo sigue atado a tokens editables en runtime.
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--pieia-color-primary)',
        'on-primary': 'var(--pieia-color-on-primary)',
        secondary: 'var(--pieia-color-secondary)',
        'on-secondary': 'var(--pieia-color-on-secondary)',
        background: 'var(--pieia-color-background)',
        surface: 'var(--pieia-color-surface)',
        'surface-variant': 'var(--pieia-color-surface-variant)',
        'on-surface': 'var(--pieia-color-on-surface)',
        'on-surface-variant': 'var(--pieia-color-on-surface-variant)',
        outline: 'var(--pieia-color-outline)',
        success: 'var(--pieia-color-success)',
        warning: 'var(--pieia-color-warning)',
        error: 'var(--pieia-color-error)',
        ai: 'var(--pieia-color-ai)',
      },
      borderRadius: {
        control: 'var(--pieia-radius-control)',
        card: 'var(--pieia-radius-card)',
        sm: 'var(--pieia-radius-sm)',
        md: 'var(--pieia-radius-md)',
        lg: 'var(--pieia-radius-lg)',
      },
      boxShadow: {
        1: 'var(--pieia-elevation-1)',
        2: 'var(--pieia-elevation-2)',
        3: 'var(--pieia-elevation-3)',
      },
      fontFamily: {
        sans: 'var(--pieia-font-sans)',
      },
      transitionTimingFunction: {
        standard: 'var(--pieia-motion-ease-standard)',
        emphasized: 'var(--pieia-motion-ease-emphasized)',
        exit: 'var(--pieia-motion-ease-exit)',
      },
      transitionDuration: {
        fast: 'var(--pieia-motion-duration-fast)',
        base: 'var(--pieia-motion-duration-base)',
        slow: 'var(--pieia-motion-duration-slow)',
      },
    },
  },
  plugins: [],
};
