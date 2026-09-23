/**
 * Regla única de la dirección pública de un anuncio (tarea #26 · M-07).
 *
 * Un anuncio se puede pedir de dos formas y **solo una función decide cuál**:
 *
 *   · por su **slug** — la forma pública y legible (`/pensiones/residencia-makia`),
 *     que es la que se comparte;
 *   · por su **UUID** — la clave primaria, que sigue resolviendo para no romper
 *     ningún enlace repartido antes de que existieran las direcciones legibles.
 *
 * Este módulo a propósito **no importa nada**: lo usan tanto la capa de datos
 * (servidor) como el `middleware.ts` (edge), y en el edge arrastrar `supabase-js`
 * solo para comparar una cadena sería un desperdicio.
 *
 * Al consultar, la columna tiene que ser la correcta: pedir un slug contra la
 * columna `id` (uuid) no devuelve «cero filas», devuelve un **error de tipo** de
 * PostgreSQL. Ese error era justo lo que hacía que la capa de datos cayera a la
 * semilla de demostración y mezclara datos ficticios con reales. Por eso la
 * decisión de columna es explícita y compartida.
 */

/** UUID en cualquiera de sus formas (mayúsculas incluidas). */
export const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Formato de una dirección legible: minúsculas, cifras y guiones simples, sin
 * guion al principio ni al final. Espeja la restricción `pensiones_slug_formato`
 * de la base, para poder descartar una dirección imposible sin consultar nada.
 */
export const FORMATO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Columna por la que se resuelve un identificador. */
export type ColumnaIdentificador = "id" | "slug";

/**
 * Normaliza lo que llega de la URL: espacios sobrantes y mayúsculas. Las
 * direcciones se generan en minúsculas, así que `Residencia-Makia` y
 * `residencia-makia` deben llevar al mismo sitio en lugar de dar un 404 que el
 * usuario no puede explicarse (habitual al dictar una dirección por teléfono).
 */
export function normalizarIdentificador(valor: string): string {
  return valor.trim().toLowerCase();
}

export function esUuid(valor: string): boolean {
  return FORMATO_UUID.test(valor);
}

/** ¿Tiene forma de dirección legible? */
export function esSlug(valor: string): boolean {
  return FORMATO_SLUG.test(valor);
}

/**
 * ¿Por qué columna hay que buscar este identificador?
 *
 * - UUID → `id` (la clave primaria).
 * - Todo lo demás → `slug`. Se asume slug porque la comprobación previa de
 *   formato (`esSlug`) descarta lo que no puede ser ni una cosa ni la otra.
 */
export function columnaDeIdentificador(valor: string): ColumnaIdentificador {
  return esUuid(normalizarIdentificador(valor)) ? "id" : "slug";
}

/**
 * ¿Puede existir un anuncio con este identificador? Descarta antes de consultar
 * lo que no es ni UUID ni dirección válida (por ejemplo un identificador con
 * espacios o con símbolos), para no gastar una consulta que no puede acertar.
 */
export function identificadorPlausible(valor: string): boolean {
  const normalizado = normalizarIdentificador(valor);
  return esUuid(normalizado) || esSlug(normalizado);
}
