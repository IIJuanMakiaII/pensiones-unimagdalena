/**
 * Qué hay que invalidar cuando el catálogo cambia (M-22).
 *
 * ## Por qué una lista de rutas y no una etiqueta de caché
 *
 * Antes, al publicar se invalidaba la etiqueta `pensiones` que llevaba la
 * consulta del catálogo. Esa etiqueta sí alcanza las páginas —lo comprobé: cada
 * entrada prerenderizada la lleva escrita en su cabecera `x-next-cache-tags`—,
 * pero depende de un API que en Next 16 exige un segundo argumento (un perfil de
 * caducidad) cuya semántica es servir lo viejo mientras se refresca en segundo
 * plano. Es justo lo contrario de lo que necesita quien acaba de publicar: verlo.
 *
 * Con `revalidatePath` se nombra cada ruta y Next descarta las dos cachés de esa
 * ruta —el HTML generado y los datos que usó— sin servir nada viejo (ver
 * `file-system-cache.js`: la entrada se descarta, no se marca). Además la firma
 * `revalidatePath(ruta, tipo)` es idéntica en Next 14 y en 16, así que deja de
 * ser un bloqueo para actualizar.
 *
 * ## Si añades una página que muestre el catálogo
 *
 * Añádela aquí. `pruebas/invalidacion.prueba.ts` recorre las páginas del
 * proyecto, detecta las que leen el catálogo público y falla si alguna no está
 * en esta lista: es lo que convierte este olvido —silencioso: la página seguiría
 * sirviendo una versión vieja hasta que caducara— en un fallo de las pruebas.
 */
export interface ObjetivoDeInvalidacion {
  /** Ruta tal como la entiende `revalidatePath`; `[id]` en las dinámicas. */
  ruta: string;
  /**
   * Obligatorio en las rutas dinámicas: sin él, `revalidatePath` no invalida
   * ninguna de sus direcciones. `page` alcanza todas las instancias.
   */
  tipo?: "page" | "layout";
}

/** Rutas que muestran el catálogo público. */
export const RUTAS_DEL_CATALOGO: readonly ObjetivoDeInvalidacion[] = [
  { ruta: "/" },
  // Todas las fichas a la vez: una publicación nueva no tiene entrada previa que
  // invalidar, pero la retirada o el cambio de precio sí, y la dirección pública
  // es el slug, así que no se pueden enumerar de antemano.
  { ruta: "/pensiones/[id]", tipo: "page" },
  { ruta: "/barrios", tipo: "page" },
  { ruta: "/barrios/[barrio]", tipo: "page" },
  // El índice de barrios y el sitemap se cachean una hora: sin nombrarlos aquí,
  // una publicación podía tardar una hora en aparecer en ellos.
  { ruta: "/sitemap.xml" },
  // El panel del anfitrión es donde aterriza quien acaba de publicar. Va con
  // `force-dynamic`, así que hoy no tiene caché que descartar; se nombra para
  // que siga siendo correcto si algún día deja de ser dinámico.
  { ruta: "/publicar" },
];
