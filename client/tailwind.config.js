/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        headline: ['Geist', 'sans-serif'],
        display: ['Geist', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Space Grotesk', 'sans-serif'],
        mono: ['Space Grotesk', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        stitch: {
          bg: '#0D1117',
          surface: '#161B22',
          elevated: '#1C2128',
          border: '#30363D',
          green: '#00E676',
          red: '#FF5252',
          blue: '#448AFF',
          orange: '#FF6D00',
          muted: '#8B949E',
        },
        dark: {
          950: '#0D1117',
          900: '#161B22',
          800: '#1C2128',
        }
      }
    },
  },
  plugins: [],
}
