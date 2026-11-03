/**
 * Destino de una redirección interna (SEC-03).
 *
 * El filtro anterior era `destino.startsWith("/") && !destino.startsWith("//")`.
 * Parece suficiente y no lo es: el parser WHATWG —el mismo que usa `new URL()`
 * en el servidor y el navegador— trata la barra invertida como barra en los
 * esquemas especiales, así que `/\evil.com` pasa el filtro y resuelve a
 * `https://evil.com/`. Medido con Node, no es teoría.
 *
 * La comprobación correcta no es mirar el texto, sino resolver la URL y comparar
 * el origen con el del sitio. Todo lo que termine en otro origen cae al destino
 * por defecto.
 */

/** A dónde va un enlace cuando no se puede confiar en el destino pedido. */
export const DESTINO_POR_DEFECTO = "/publicar";

/**
 * Devuelve una ruta interna segura a partir del `next` de la URL.
 *
 * @param candidato Valor crudo del parámetro `next` (`null` si no vino).
 * @param origen    Origen del sitio (`https://pensiones-unimagdalena.vercel.app`).
 */
export function destinoInterno(candidato: string | null | undefined, origen: string): string {
  // Solo espacios se resuelve a la raíz del sitio, que no es lo que pidió
  // nadie: se trata como ausencia de destino.
  const limpio = (candidato ?? "").trim();
  if (!limpio) return DESTINO_POR_DEFECTO;

  let base: URL;
  try {
    base = new URL(origen);
  } catch {
    return DESTINO_POR_DEFECTO;
  }

  let resuelto: URL;
  try {
    resuelto = new URL(limpio, base);
  } catch {
    return DESTINO_POR_DEFECTO;
  }

  // `javascript:`, `data:` y cualquier esquema ajeno también caen aquí: su
  // origen es `null` y nunca coincide con el del sitio.
  if (resuelto.origin !== base.origin) return DESTINO_POR_DEFECTO;

  // Se devuelve ruta + query + hash, nunca la URL completa: un destino absoluto
  // del mismo origen también sirve, pero normalizarlo evita respuestas con el
  // host escrito dos veces.
  const destino = `${resuelto.pathname}${resuelto.search}${resuelto.hash}`;
  return destino.startsWith("/") ? destino : DESTINO_POR_DEFECTO;
}
