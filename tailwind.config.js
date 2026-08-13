/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette taken from editionhotels.com/abu-dhabi — a restrained
        // monochrome scheme with a single sand accent, and no blue at all.
        ink: {
          DEFAULT: '#111111', // headings and primary text
          soft: '#1c1c1c',    // dark panels
        },
        muted: '#757575',     // body copy and secondary text
        sand: {
          DEFAULT: '#c8ae83', // the EDITION accent
          dark: '#a8905f',    // hover / text on white, for contrast
          light: '#f3ede3',   // tinted panels
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f5f5f5',  // page background and quiet panels
        },
        line: '#e3e3e3',      // hairline borders
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
