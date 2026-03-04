/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/index.html",
  ],
  theme: {
    extend: {
      colors: {
        minecraft: {
          green: '#00FF00',
          darkGreen: '#00AA00',
          gray: '#AAAAAA',
          darkGray: '#555555',
          black: '#000000',
          white: '#FFFFFF',
          blue: '#5555FF',
          darkBlue: '#0000AA',
          red: '#FF5555',
          darkRed: '#AA0000'
        }
      }
    },
  },
  plugins: [],
  darkMode: 'class'
}