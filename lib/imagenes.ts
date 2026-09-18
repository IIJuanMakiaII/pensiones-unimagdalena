/**
 * Política de imágenes admitidas.
 *
 * Next.js optimiza las imágenes de `<Image>` en el servidor. Aceptar cualquier
 * origen (`hostname: "**"`) convertía el optimizador en un proxy abierto: un
 * atacante podía hacer que el servidor descargue URLs arbitrarias (DoS por
 * `remotePatterns`, CVE-2025-59471) y elevaba el impacto del advisory de la
 * Image Optimization API (GHSA-2xp9-vwfh-vxw4 en next@14.2.35).
 *
 * Por eso la lista blanca se aplica en dos sitios: `next.config.mjs`
 * (remotePatterns) y la validación del formulario de publicación.
 */

export const HOSTS_IMAGEN_PERMITIDOS = ["images.unsplash.com", "supabase.co"] as const;

/** Bucket de Supabase Storage donde viven las fotos subidas por los anfitriones. */
export const BUCKET_FOTOS = "fotos-pensiones";

/** Límite de tamaño del bucket (5 MB). El navegador comprime antes de subir. */
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

/** Máximo de fotos por anuncio. */
export const MAXIMO_FOTOS = 8;

/** Texto para la ayuda del formulario y para los mensajes de error. */
export const AYUDA_IMAGENES =
  "Sube las fotos desde tu computador o celular con el botón «Elegir fotos». " +
  "Si prefieres usar un enlace, debe ser https de images.unsplash.com o de tu proyecto en Supabase (*.supabase.co).";

export function hostImagenPermitido(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;

    return HOSTS_IMAGEN_PERMITIDOS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}
