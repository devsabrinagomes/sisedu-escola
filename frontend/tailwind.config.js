/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
