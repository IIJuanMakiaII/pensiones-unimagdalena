import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import {
  numeroWhatsAppValido,
  NUMERO_DE_EJEMPLO,
  WHATSAPP_CONFIGURADO,
  WHATSAPP_DISPONIBLE,
  WHATSAPP_NUMERO,
  WHATSAPP_NUMERO_CRUDO,
} from "@/lib/formato";
import { SITIO_IMAGEN, SITIO_LOGO, SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import InstalarApp from "@/components/InstalarApp";
import AvisoOffline from "@/components/AvisoOffline";
import Cabecera from "@/components/Cabecera";
import { Analytics } from "@vercel/analytics/next";

/**
 * Tipografía autoalojada con `next/font/local` (tarea #70).
 *
 * POR QUÉ CAMBIÓ DE `next/font/google`
 * ------------------------------------
 * `next/font/google` **descarga la fuente de Google durante la compilación**. Esa
 * llamada tumbó dos compilaciones limpias en esta ronda y solo entró al tercer
 * intento: un despliegue podía morir por una respuesta transitoria de un tercero
 * que no controlamos. Con `next/font/local` la tipografía se resuelve desde
 * archivos del propio repositorio, así que compilar ya no depende de la red.
 *
 * LOS ARCHIVOS NO SE ELIGIERON A MANO
 * -----------------------------------
 * Son exactamente los que el build anterior ya servía, copiados byte a byte
 * desde `.next/static/media/` y comparados por huella SHA-256. En los dos casos
 * es el subconjunto `latin`, que es el único que necesita el español: cubre
 * `u+00??`, es decir la eñe, las tildes, la diéresis y los signos de apertura.
 * Por eso la identidad visual no cambia: son los mismos bytes, la misma familia
 * y los mismos pesos. El service worker las sigue cacheando igual.
 *
 * El peso se declara como rango (`500 800` y `400 700`) porque el archivo es la
 * fuente variable de Google: allí los cuatro pesos ya apuntaban al mismo archivo,
 * uno por subconjunto. Declarar el rango no cambia ningún trazo; describe lo que
 * el archivo ya era.
 */
const fuenteDisplay = localFont({
  src: [
    {
      path: "../tipografia/plus-jakarta-sans-latin.woff2",
      weight: "500 800",
      style: "normal",
    },
  ],
  variable: "--fuente-display",
  display: "swap",
});

/**
 * Lexend para el cuerpo. Se eligió por sus tres números medidos, no por gusto:
 * x-height 0,53 (a 1 punto de la anterior), el mayor contraste de negrita de las
 * ocho candidatas (6,3 %) y la única pensada para legibilidad en pantalla. Es la
 * más ancha de todas (105 %), así que el reflujo de líneas se vigila aparte.
 */
const fuenteCuerpo = localFont({
  src: [
    {
      path: "../tipografia/lexend-latin.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--fuente-cuerpo",
  display: "swap",
});

/**
 * Datos estructurados del SITIO. Es un `WebSite` (directorio de alojamientos),
 * no un `LodgingBusiness`: declarar el marketplace como alojamiento —y con
 * coordenadas fijas— sería información inexacta. El `LodgingBusiness` se emite
 * en cada ficha de pensión, que sí es un alojamiento real.
 */
/**
 * Identificador estable de la organización. Se usa para **referenciarla** desde
 * otros nodos en lugar de repetirla: repetir el mismo `Organization` completo en
 * cada bloque de datos estructurados hace que los buscadores lean varias
 * organizaciones distintas donde solo hay una.
 */
const ID_ORGANIZACION = `${SITIO_URL}/#organizacion`;

/**
 * La organización, como nodo propio del grafo.
 *
 * Antes viajaba **anidada** dentro de `WebSite.publisher`, que es válido pero
 * deja a la organización sin identidad propia: cualquier otro bloque que quiera
 * referirse a ella tendría que volver a copiarla entera. Como nodo con `@id` se
 * puede citar.
 */
const jsonLdOrganizacion = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ID_ORGANIZACION,
  name: "Nido",
  url: SITIO_URL,
  logo: SITIO_LOGO,
  image: SITIO_IMAGEN,
  // El teléfono solo se publica si el canal está realmente disponible. Si la
  // variable falta, es inválida o trae el número de ejemplo, el marcado
  // anunciaría a los buscadores un teléfono que no existe; y con el respaldo de
  // `/contacto` activo, la vía real de contacto pasa a ser el formulario.
  ...(WHATSAPP_DISPONIBLE ? { telephone: `+${WHATSAPP_NUMERO}` } : {}),
  areaServed: "Santa Marta, Magdalena, Colombia",
  knowsAbout: [
    "Pensiones universitarias",
    "Habitaciones para estudiantes",
    "Universidad del Magdalena",
  ],
};

const jsonLdSitio = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Nido",
  description:
    "Habitaciones verificadas para estudiantes de la Universidad del Magdalena en Santa Marta, Magdalena, Colombia.",
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
  publisher: { "@id": ID_ORGANIZACION },
};

/**
 * Verificación del número de reserva antes de un despliegue (Oleada 0).
 *
 * Sin un número de WhatsApp válido, todos los botones de reserva quedarían
 * apuntando a un número equivocado o inexistente, en silencio.
 *
 * La exigencia se aplica **solo a un despliegue de verdad**, que es lo que marca
 * `VERCEL_ENV`. Un `next build` en local o el de la integración continua no
 * despliegan nada: bloquearlos no protegería a nadie y dejaría el proyecto sin
 * poder compilarse ni comprobarse. Fuera de un despliegue se avisa por consola,
 * que es distinto de callarse.
 */
if (process.env.VERCEL_ENV) {
  if (!WHATSAPP_CONFIGURADO) {
    throw new Error(
      "NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado en el entorno que se está " +
        "desplegando. Comprueba tres cosas, en este orden: " +
        "(1) que el nombre sea exactamente NEXT_PUBLIC_WHATSAPP_NUMBER, sin espacios ni " +
        "letras cambiadas; " +
        "(2) que la variable esté definida para ESTE entorno (Production, no solo Preview o " +
        "Development: son listas separadas); " +
        "(3) que su valor no esté vacío y tenga entre 10 y 15 dígitos con el código de país " +
        "(por ejemplo 573001234567)."
    );
  }
  if (!numeroWhatsAppValido()) {
    throw new Error(
      `NEXT_PUBLIC_WHATSAPP_NUMBER no es válido: "${WHATSAPP_NUMERO_CRUDO}". ` +
        "Debe tener entre 10 y 15 dígitos con el código de país (por ejemplo 573001234567) " +
        "antes de desplegar."
    );
  }
  /**
   * El caso que se cuela por el hueco: el número de ejemplo **pasa** la
   * comprobación de formato. Copiarlo desde `.env.local` a las variables del
   * despliegue produce el peor fallo posible — todos los botones de reserva
   * apuntando a un número que no existe, sin ningún síntoma visible y sin que
   * nadie se entere hasta que un estudiante escribe y no le contesta nadie.
   */
  /**
   * Un celular colombiano al que le falta el código de país también pasa la
   * comprobación de formato (10 dígitos) y también rompe el enlace: WhatsApp lee
   * `wa.me/3026429730` como «código 30», que es otro país, y marca donde no es.
   * No da ningún error visible; simplemente no llega. Es el error más fácil de
   * cometer al copiar el número del teléfono, que es como se copia siempre.
   */
  if (/^3\d{9}$/.test(WHATSAPP_NUMERO)) {
    throw new Error(
      `NEXT_PUBLIC_WHATSAPP_NUMBER parece un celular colombiano sin el código de país ` +
        `("${WHATSAPP_NUMERO_CRUDO}"). Añade 57 delante: 57${WHATSAPP_NUMERO}. Sin eso, el ` +
        "enlace de WhatsApp marca a otro país y el mensaje del estudiante no llega a nadie."
    );
  }
  if (WHATSAPP_NUMERO === NUMERO_DE_EJEMPLO) {
    throw new Error(
      `NEXT_PUBLIC_WHATSAPP_NUMBER tiene el número de ejemplo (${NUMERO_DE_EJEMPLO}), ` +
        "que no existe. Es el valor que trae `.env.local` para desarrollo y cumple el formato, " +
        "así que sin esta comprobación el despliegue saldría adelante con los botones de reserva " +
        "apuntando a la nada. Define el número real de la plataforma con el código de país."
    );
  }
} else if (process.env.NODE_ENV === "production") {
  // Compilación en modo producción que no es un despliegue: no se detiene, pero
  // no puede pasar en silencio.
  if (!WHATSAPP_CONFIGURADO || WHATSAPP_NUMERO === NUMERO_DE_EJEMPLO) {
    console.warn(
      "[WhatsApp] Esta compilación no es un despliegue, así que no se detiene. PERO el " +
        "número de reserva que lleva dentro no existe: si esto llegara a publicarse, ningún " +
        "botón de reserva funcionaría. Define NEXT_PUBLIC_WHATSAPP_NUMBER con el número real " +
        "antes de desplegar."
    );
  }
}

/**
 * Un solo título y una sola descripción para todo el sitio.
 *
 * Antes había tres textos distintos para la misma página: `<title>`, `og:title` y
 * `twitter:title` decían cosas diferentes del mismo sitio. Y la descripción medía
 * unos 220 caracteres, así que Google la cortaba hacia los 155 y el fragmento que
 * se leía empezaba por «Marketplace de pensiones»: describía lo que hace la
 * empresa, no lo que busca quien llega. Ahora se enuncia el beneficio y se
 * declara en un único sitio.
 *
 * Tampoco se declara `keywords`: Google la ignora desde 2009 y solo servía para
 * publicar la lista de términos objetivo a quien mirara el código.
 */
const TITULO_SITIO = "Nido | Pensiones verificadas a minutos de Unimagdalena";
const DESCRIPCION_SITIO =
  "Habitaciones verificadas a minutos de la Universidad del Magdalena, con precios mensuales claros y reserva acompañada.";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO_URL),
  title: {
    default: TITULO_SITIO,
    template: "%s · Nido",
  },
  description: DESCRIPCION_SITIO,
  authors: [{ name: "Nido" }],
  applicationName: "Nido",
  appleWebApp: {
    capable: true,
    title: "Nido",
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
  /**
   * Las directivas de vista previa y de fragmento van en el `robots` general, no
   * en un `googleBot` aparte: declararlas solo para Google emitía dos etiquetas
   * donde basta una y dejaba al resto de rastreadores sin la directiva, aunque
   * `max-image-preview` y `max-snippet` no son exclusivas de Google.
   */
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: SITIO_URL,
    siteName: "Nido",
    title: TITULO_SITIO,
    description: DESCRIPCION_SITIO,
    images: [
      {
        url: SITIO_IMAGEN,
        width: 1200,
        height: 630,
        alt: "Nido: habitaciones verificadas para estudiantes en Santa Marta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_SITIO,
    description: DESCRIPCION_SITIO,
    images: [SITIO_IMAGEN],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FF385C",
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
          dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdOrganizacion) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdSitio) }}
        />
        {/* Medición sin cookies (ver lib/medicion.ts): no añade aviso de cookies
            y solo envía el identificador del anuncio, nunca datos personales. */}
        <Analytics />
      </body>
    </html>
  );
}
