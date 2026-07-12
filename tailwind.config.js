/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#05070d",
        surface: "#0b111d",
        "surface-muted": "#111827",
        "surface-high": "#172033",
        foreground: "#f7f8fb",
        muted: "#9ba6b6",
        accent: "#22f2d2",
        "accent-container": "#2dd4bf",
        "accent-foreground": "#04100e",
        border: "#202938",
        outline: "#3c4a46",
        input: "#050912",
        "modal-nav": "#080d16",
        compliant: "#6ee7b7",
        expiring: "#fcd34d",
        missing: "#fda4af",
        review: "#7dd3fc"
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
