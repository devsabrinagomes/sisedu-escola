/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          400: "#2ddc9b",
          500: "#0dc782",
          600: "#0aa86d",
        },
        darkbg: "#0f1115",
        surface: {
          1: "#171a1f",
          2: "#1e2228",
        },
        borderDark: "#2a2f36",
        sisedu: {
          red: { fill: "#F28B82", stroke: "#D9534F" },
          yellow: { fill: "#F6E58D", stroke: "#E1C542" },
          green: { fill: "#9EDC9A", stroke: "#4CAF50" },
          blue: { fill: "#9EC3E6", stroke: "#4A90D9" },
        },
      },
    },
  },
  plugins: [],
};
