/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'grade-a': '#22c55e',
        'grade-b': '#3b82f6',
        'grade-c': '#f59e0b',
        'grade-d': '#f97316',
        'grade-f': '#ef4444',
      },
    },
  },
  plugins: [],
}
