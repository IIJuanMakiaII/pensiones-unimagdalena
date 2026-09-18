import type { Config } from "tailwindcss";

/**
 * Paleta de marca (actualizada por el Agente 3 a partir de la identidad
 * entregada por el cliente: verde bosque #325334 + naranja quemado #E16118).
 *
 * Reglas de uso (verificadas con scripts/verificar-contraste.mjs):
 *  - primary-600 (#325334): botones principales, sellos, superficies oscuras.
 *  - accent-700 (#A4440D): relleno de CTA con texto blanco y textos naranjas
 *    pequeños sobre blanco (AA 4.5:1 en cualquier tamaño).
 *  - accent-500 (#E16118): color de marca para uso decorativo, precios grandes
 *    (>= 20 px negrita), slider y bordes de hover.
 *  - whatsapp-deep (#075E54): relleno de los botones de WhatsApp con texto
 *    blanco (el verde oficial #25D366 con blanco solo alcanza 1.98:1).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#F1F5F1",
          100: "#DEE8DE",
          200: "#BFD1C0",
          300: "#96B397",
          400: "#6A8D6C",
          500: "#4A6E4C",
          600: "#325334",
          700: "#2A4529",
          800: "#223A22",
          900: "#1B2E1B",
        },
        secondary: {
          50: "#F5F7F5",
          100: "#E6EAE6",
          200: "#CBD4CC",
          300: "#A6B3A7",
          400: "#7B8A7C",
          500: "#566356",
          600: "#3E4A3F",
          700: "#2B3529",
          800: "#202820",
          900: "#171D17",
        },
        accent: {
          50: "#FDF4EE",
          100: "#FBE4D5",
          200: "#F6C7A8",
          300: "#F0A277",
          400: "#EB8248",
          500: "#E16118",
          600: "#C45512",
          700: "#A4440D",
          800: "#863709",
          900: "#6B2C07",
        },
        whatsapp: {
          DEFAULT: "#25D366",
          dark: "#128C7E",
          deep: "#075E54",
        },
        neutro: {
          50: "#FAFAF9",
          100: "#F5F5F4",
          200: "#E7E5E4",
          300: "#D6D3D1",
          400: "#A8A29E",
          500: "#78716C",
          600: "#57534E",
          700: "#44403C",
          800: "#292524",
          900: "#1C1917",
        },
        confianza: {
          gold: "#D4A017",
          success: "#16A34A",
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
        card: "0 1px 3px rgba(28, 25, 23, 0.08)",
        "card-hover": "0 12px 28px -8px rgba(28, 25, 23, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
