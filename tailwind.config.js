/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Every colour resolves through a CSS variable defined in globals.css,
        // so adding .dark to <html> reskins the whole app without touching a
        // single component class.
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',   // headings, primary text
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
        },
        // Foreground for anything sitting on an `ink` background — white in
        // light mode, near-black in dark, so buttons stay readable in both.
        'on-ink': 'rgb(var(--c-on-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        sand: {
          DEFAULT: 'rgb(var(--c-sand) / <alpha-value>)',
          dark: 'rgb(var(--c-sand-dark) / <alpha-value>)',
          light: 'rgb(var(--c-sand-light) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          subtle: 'rgb(var(--c-surface-subtle) / <alpha-value>)',
        },
        line: 'rgb(var(--c-line) / <alpha-value>)',
      },
      fontFamily: {
        // Didot is present on Apple devices, which is what the hotel site
        // itself relies on; Playfair Display is loaded as the stand-in
        // everywhere else so headings stay high-contrast serif.
        display: ['Didot', 'var(--font-display)', 'Georgia', 'serif'],
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        display: '-0.02em',   // the site sets -1px on 40px headings
        wide: '0.08em',       // uppercase labels and buttons
      },
      borderRadius: {
        // The brand is square-edged; nothing is pill-shaped.
        DEFAULT: '2px',
        md: '2px',
        lg: '2px',
        xl: '2px',
        '2xl': '3px',
      },
    },
  },
  plugins: [],
}
