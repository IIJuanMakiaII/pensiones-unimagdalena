/**
 * Favoritos guardados en el navegador (`localStorage`).
 *
 * El estudiante arma su lista sin crear cuenta. Al ser funciones puras y
 * tolerantes a fallos, se pueden usar desde cualquier Client Component y no
 * rompen la app si el almacenamiento está bloqueado (modo privado antiguo).
 */

export const CLAVE_FAVORITOS = "pensiones-favoritas";

/** Evento propio para que todas las tarjetas se sincronicen al instante. */
export const EVENTO_FAVORITOS = "favoritos-cambiaron";

export function leerFavoritos(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const crudo = window.localStorage.getItem(CLAVE_FAVORITOS);
    if (!crudo) return [];

    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];

    return datos.filter((valor): valor is string => typeof valor === "string");
  } catch {
    return [];
  }
}

export function guardarFavoritos(ids: string[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(ids));
  } catch {
    /* Almacenamiento no disponible: la app sigue funcionando sin persistir. */
  }

  window.dispatchEvent(new Event(EVENTO_FAVORITOS));
}

/** Añade o quita un id y devuelve la lista resultante. */
export function alternarFavorito(id: string): string[] {
  const actuales = leerFavoritos();
  const siguientes = actuales.includes(id)
    ? actuales.filter((favorito) => favorito !== id)
    : [...actuales, id];

  guardarFavoritos(siguientes);
  return siguientes;
}

export function esFavorito(id: string): boolean {
  return leerFavoritos().includes(id);
}
