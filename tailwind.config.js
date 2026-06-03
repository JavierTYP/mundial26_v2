/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563eb",
          green: "#10b981",
          red: "#ef4444"
        }
      }
    },
  },
  plugins: [],
};

