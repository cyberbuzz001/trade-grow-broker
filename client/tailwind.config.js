/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0b0e14',
          900: '#0f172a',
          800: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}
