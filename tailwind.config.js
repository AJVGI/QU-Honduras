/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
      colors: {
        // JackpotDaily Brand Colors
        'jd-pink':    '#E91E8C',
        'jd-rose':    '#C2185B',
        'jd-gold':    '#FFD600',
        'jd-purple':  '#2D1B4E',
        'jd-promo':   '#7B2D8B',
        'jd-green':   '#00C882',
        'jd-red':     '#FF4444',
        'jd-navy':    '#1A1A2E',
        'jd-dark':    '#0D0D1A',
        // Grade colors aligned to brand
        'grade-a': '#00C882',
        'grade-b': '#E91E8C',
        'grade-c': '#FFD600',
        'grade-d': '#f97316',
        'grade-f': '#FF4444',
      },
    },
  },
  plugins: [],
}
