import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA (Agente 3 — experiencia instalable).
 * Next.js lo publica automáticamente en /manifest.webmanifest y enlaza la
 * etiqueta <link rel="manifest"> en todas las páginas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pensiones Unimagdalena — Habitaciones para estudiantes en Santa Marta",
    short_name: "Pensiones UniMag",
    description:
      "Pensiones y habitaciones verificadas a minutos caminando de la Universidad del Magdalena, Santa Marta. Precios mensuales claros y reserva directa por WhatsApp.",
    lang: "es-CO",
    dir: "ltr",
    start_url: "/?origen=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#325334",
    categories: ["education", "travel", "lifestyle"],
    icons: [
      { src: "/iconos/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/iconos/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Ver habitaciones disponibles", short_name: "Catálogo", url: "/#resultados" },
      { name: "Cómo funciona", short_name: "Confianza", url: "/#confianza" },
    ],
  };
}
