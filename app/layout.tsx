import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Public_Sans } from "next/font/google";
import "./globals.css";
import { numeroWhatsAppValido, WHATSAPP_NUMERO } from "@/lib/formato";
import { SITIO_IMAGEN, SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import InstalarApp from "@/components/InstalarApp";
import AvisoOffline from "@/components/AvisoOffline";
import Cabecera from "@/components/Cabecera";

/**
 * Fuentes autoalojadas con next/font: se descargan en el build y se sirven desde
 * el propio dominio. Así no hay peticiones a Google (más rápido), se elimina el
 * salto de maquetación (CLS) y el service worker las cachea: la app mantiene su
 * tipografía incluso sin conexión.
 */
const fuenteDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--fuente-display",
  display: "swap",
});

const fuenteCuerpo = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-cuerpo",
  display: "swap",
});

/**
 * Datos estructurados del SITIO. Es un `WebSite` (directorio de alojamientos),
 * no un `LodgingBusiness`: declarar el marketplace como alojamiento —y con
 * coordenadas fijas— sería información inexacta. El `LodgingBusiness` se emite
 * en cada ficha de pensión, que sí es un alojamiento real.
 */
const jsonLdSitio = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Pensiones Unimagdalena",
  description:
    "Marketplace de pensiones y habitaciones verificadas para estudiantes de la Universidad del Magdalena en Santa Marta, Magdalena, Colombia.",
  url: SITIO_URL,
  inLanguage: "es-CO",
  image: SITIO_IMAGEN,
  areaServed: {
    "@type": "City",
    name: "Santa Marta",
    address: {
      "@type": "PostalAddress",
      addressRegion: "Magdalena",
      addressCountry: "CO",
    },
  },
  publisher: {
    "@type": "Organization",
    name: "Pensiones Unimagdalena",
    url: SITIO_URL,
    telephone: `+${WHATSAPP_NUMERO}`,
    areaServed: "Santa Marta, Magdalena, Colombia",
    knowsAbout: [
      "Pensiones universitarias",
      "Habitaciones para estudiantes",
      "Universidad del Magdalena",
    ],
  },
};

/**
 * Verificación de configuración en producción (Oleada 0).
 *
 * Sin un número de WhatsApp válido, todos los botones de reserva quedarían
 * apuntando a un número equivocado o inexistente, en silencio. Preferimos que
 * la compilación de producción falle de forma visible y explicada.
 */
if (process.env.NODE_ENV === "production" && !numeroWhatsAppValido()) {
  throw new Error(
    "NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado o no es válido. " +
      "Define un número de 10 a 15 dígitos con el código de país (por ejemplo 573001234567) " +
      "en las variables de entorno antes de compilar para producción."
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(SITIO_URL),
  title: {
    default:
      "Pensiones en Santa Marta cerca de Unimagdalena | Habitaciones para estudiantes",
    template: "%s · Pensiones Unimagdalena",
  },
  description:
    "Marketplace de pensiones y habitaciones para estudiantes de la Universidad del Magdalena en Santa Marta. Habitaciones verificadas a minutos caminando del campus, con precios mensuales claros y reserva directa por WhatsApp.",
  keywords: [
    "pensiones Santa Marta",
    "habitaciones para estudiantes Unimagdalena",
    "arriendo cerca de la Universidad del Magdalena",
    "pensión universitaria Santa Marta",
    "pensión para estudiantes foráneos",
    "cuartos en arriendo Unimagdalena",
  ],
  authors: [{ name: "Pensiones Unimagdalena" }],
  applicationName: "Pensiones Unimagdalena",
  appleWebApp: {
    capable: true,
    title: "Pensiones UniMag",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/iconos/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/iconos/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/iconos/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/iconos/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/iconos/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/iconos/favicon-48.png", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: SITIO_URL,
    siteName: "Pensiones Unimagdalena",
    title: "Pensiones en Santa Marta cerca de Unimagdalena",
    description:
      "Habitaciones verificadas a minutos caminando de la Universidad del Magdalena. Reserva directa por WhatsApp.",
    images: [{ url: SITIO_IMAGEN, width: 1200, height: 630, alt: "Habitación de pensión estudiantil en Santa Marta" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pensiones en Santa Marta cerca de Unimagdalena",
    description:
      "Habitaciones verificadas a minutos caminando de la Universidad del Magdalena. Reserva directa por WhatsApp.",
    images: [SITIO_IMAGEN],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#325334",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fuenteDisplay.variable} ${fuenteCuerpo.variable}`}>
      <body className={fuenteCuerpo.className}>
        <a
          href="#resultados"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-neutro-800 focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        {/* Cabecera estática: la sesión se resuelve en el cliente (ver EntradaCuenta). */}
        <Cabecera />
        {children}
        <AvisoOffline />
        <InstalarApp />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdSitio) }}
        />
      </body>
    </html>
  );
}
