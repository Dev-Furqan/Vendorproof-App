/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0f19",
        surface: "#111827",
        "surface-muted": "#1d2021",
        "surface-high": "#282a2b",
        foreground: "#e1e3e4",
        muted: "#bacac5",
        accent: "#57f1db",
        "accent-container": "#2dd4bf",
        "accent-foreground": "#003731",
        border: "#1f2937",
        outline: "#3c4a46",
        input: "#030712",
        "modal-nav": "rgba(29, 32, 33, 0.94)",
        compliant: "#57f1db",
        expiring: "#d3daef",
        missing: "#ffb4ab",
        review: "#c3c6d4"
      },
      fontFamily: {
        display: ["Inter", "System"],
        body: ["Inter", "System"]
      },
      borderRadius: {
        card: "8px",
        modal: "12px"
      }
    }
  },
  plugins: []
};
