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

/** Imagen compartida para Open Graph / Twitter card. */
export const SITIO_IMAGEN =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80";
