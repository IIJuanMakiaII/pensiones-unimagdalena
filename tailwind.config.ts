import type { Config } from "tailwindcss";

/** Paleta Rausch con alias de compatibilidad para las clases Tailwind existentes. */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        airbnb: {
          rausch: "#FF385C",
          "rausch-hover": "#E00B41",
          charcoal: "#222222",
          foggy: "#717171",
          "light-gray": "#F7F7F7",
          border: "#DDDDDD",
          "pink-badge": "#FFF0F3",
        },
        primary: {
          50: "#FFF0F3",
          100: "#FFE1E7",
          200: "#FFC2CF",
          300: "#FF9AAF",
          400: "#FF718E",
          500: "#FF385C",
          600: "#E00B41",
          700: "#C30036",
          800: "#99002A",
          900: "#70001E",
        },
        secondary: {
          50: "#FFFFFF",
          100: "#F7F7F7",
          200: "#DDDDDD",
          300: "#B0B0B0",
          400: "#949494",
          500: "#717171",
          600: "#575757",
          700: "#484848",
          800: "#222222",
          900: "#222222",
        },
        accent: {
          50: "#FFF0F3",
          100: "#FFE1E7",
          200: "#FFC2CF",
          300: "#FF9AAF",
          400: "#FF718E",
          500: "#FF385C",
          600: "#E00B41",
          700: "#E00B41",
          800: "#B0002A",
          900: "#70001E",
        },
        whatsapp: {
          DEFAULT: "#FF385C",
          dark: "#E00B41",
          deep: "#E00B41",
        },
        neutro: {
          50: "#FFFFFF",
          100: "#F7F7F7",
          200: "#DDDDDD",
          300: "#B0B0B0",
          400: "#B0B0B0",
          500: "#717171",
          600: "#717171",
          700: "#484848",
          800: "#222222",
          900: "#222222",
        },
        confianza: {
          gold: "#D4A017",
          success: "#FF385C",
          danger: "#DC2626",
          info: "#0284C7",
        },
      },
      fontFamily: {
        // Variables generadas por next/font en app/layout.tsx (fuentes autoalojadas).
        display: ["var(--fuente-display)", "system-ui", "sans-serif"],
        body: ["var(--fuente-cuerpo)", "system-ui", "sans-serif"],
        sans: ["var(--fuente-cuerpo)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.04)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
