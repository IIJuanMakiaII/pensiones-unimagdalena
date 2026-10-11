/**
 * Configuración central del sitio.
 *
 * SITIO_URL alimenta las canónicas, el JSON-LD y los enlaces de compartir. Si
 * estuviera escrita en el código y el proyecto se desplegara en otro dominio,
 * cada página se declararía canónica hacia un dominio ajeno (riesgo real de
 * desindexación). Por eso se lee de `NEXT_PUBLIC_SITE_URL` y solo cae al valor
 * de producción como respaldo.
 */
const URL_POR_DEFECTO = "https://pensiones-unimagdalena.vercel.app";

export const SITIO_URL = (process.env.NEXT_PUBLIC_SITE_URL || URL_POR_DEFECTO).replace(/\/+$/, "");

/**
 * Modo demostración: muestra el catálogo de ejemplo (6 pensiones) para
 * presentaciones, sin depender de publicaciones reales.
 *
 * - En desarrollo está disponible siempre (para mostrar el trabajo).
 * - En producción solo si se activa explícitamente con
 *   `NEXT_PUBLIC_MOSTRAR_DEMO=1`. Nunca se sirve en silencio: el usuario ve un
 *   aviso visible mientras navega los datos de ejemplo.
 */
export const DEMO_HABILITADA =
  process.env.NEXT_PUBLIC_MOSTRAR_DEMO === "1" || process.env.NODE_ENV !== "production";

/**
 * Imagen compartida para Open Graph / Twitter card y `image` del JSON-LD.
 *
 * Antes era una foto de stock servida por `images.unsplash.com`: la tarjeta
 * dependía de un tercero que puede retirar la foto o cambiar la URL, y el enlace
 * solo fijaba `w=1200`, así que no garantizaba el alto de 630 px que el propio
 * HTML declaraba. Ahora se genera en el repositorio con
 * `scripts/generar-imagen-compartir.mjs` (1200x630) y se sirve desde el dominio.
 */
export const SITIO_IMAGEN = `${SITIO_URL}/marca/compartir-nido.png`;

/** Logotipo servido desde el dominio, para `Organization.logo`. */
export const SITIO_LOGO = `${SITIO_URL}/marca/nido-logo.png`;
