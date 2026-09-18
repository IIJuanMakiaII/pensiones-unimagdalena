import type { GeneroHabitacion, Habitacion, Pension, PensionConHabitaciones } from "@/types";

/**
 * Reglas de negocio compartidas sobre una pensión.
 * Centralizarlas evita que catálogo, filtros y detalle calculen distinto.
 */

export const IMAGEN_RESPALDO =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80";

export function imagenesDe(pension: Pension): string[] {
  return (pension.imagenes ?? []).filter((url) => Boolean(url));
}

/** Imagen principal: la primera del arreglo `imagenes`. */
export function imagenPrincipal(pension: Pension): string {
  return imagenesDe(pension)[0] ?? IMAGEN_RESPALDO;
}

/** Galería para el carrusel (nunca vacía). */
export function galeriaDe(pension: Pension): string[] {
  const imagenes = imagenesDe(pension);
  return imagenes.length > 0 ? imagenes : [IMAGEN_RESPALDO];
}

export function habitacionesDisponibles(pension: PensionConHabitaciones): Habitacion[] {
  return (pension.habitaciones ?? []).filter((h) => h.disponible);
}

/**
 * Precio "desde": el más económico entre las habitaciones disponibles.
 * Si el anfitrión publicó la pensión sin habitaciones, se usa `precioMensual`.
 */
export function precioDesde(pension: PensionConHabitaciones): number {
  const disponibles = habitacionesDisponibles(pension);
  if (disponibles.length === 0) return pension.precioMensual;
  return Math.min(...disponibles.map((h) => h.precio_mensual_cop));
}

/**
 * Precio de la habitación más barata que **se puede reservar hoy**, o `null` si
 * no hay ninguna libre.
 *
 * Es la regla que deben usar tanto la tarjeta como los datos estructurados:
 * cuando no queda ninguna habitación disponible, la base conserva el último
 * `precio_mensual` (el trigger solo lo recalcula si alguna sigue libre), así que
 * ese número ya no corresponde a nada reservable y declararlo —en la tarjeta o
 * en el `priceRange` del JSON-LD, que es lo que leen Google y los buscadores de
 * IA— sería anunciar un precio inexistente.
 *
 * Devuelve `null` también si el precio fuese 0: no es un precio anunciable.
 */
export function precioReservable(pension: PensionConHabitaciones): number | null {
  const disponibles = habitacionesDisponibles(pension);
  if (disponibles.length === 0) return null;

  const minimo = Math.min(...disponibles.map((h) => h.precio_mensual_cop));
  return minimo > 0 ? minimo : null;
}

/** ¿Alguna habitación disponible incluye alimentación? */
export function tieneAlimentacion(pension: PensionConHabitaciones): boolean {
  return habitacionesDisponibles(pension).some((h) => h.alimentacion_incluida);
}

/** Géneros que ofrece la pensión (para el filtro por género). */
export function generosDisponibles(pension: PensionConHabitaciones): GeneroHabitacion[] {
  return [...new Set(habitacionesDisponibles(pension).map((h) => h.genero))];
}

/**
 * Texto corto para tarjetas y resultados.
 *
 * Distingue "no publicó habitaciones" de "las tiene, pero todas ocupadas": son
 * situaciones distintas para el estudiante y antes se contaban igual.
 */
export function resumenHabitaciones(pension: PensionConHabitaciones): string {
  const todas = pension.habitaciones ?? [];
  const disponibles = habitacionesDisponibles(pension);

  if (disponibles.length === 0) {
    return todas.length === 0
      ? "Sin habitaciones publicadas todavía"
      : "Sin habitaciones libres ahora";
  }

  if (disponibles.length === 1) return "1 habitación disponible";
  return `${disponibles.length} habitaciones disponibles`;
}
