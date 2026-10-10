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

/* ---------------------------------------------------------------------------
 * Depósito de Reserva — modelo de cobro confirmado por el fundador el 2026-10-04
 * ------------------------------------------------------------------------ */

/**
 * Reparto del Depósito de Reserva sobre el canon del primer mes.
 *
 * Los nombres y los porcentajes no se inventan aquí: son los de
 * `docs/legales/condiciones-de-uso.md` §3.1 y `autorizacion-anfitrion.md` §5. El
 * estudiante paga el canon completo, repartido en dos momentos:
 *
 *   · **20 %** al reservar, que son dos rubros distintos:
 *     - 10 % **Tarifa de Servicio de la Plataforma** — dinero de la plataforma.
 *     - 10 % **Anticipo del Arriendo** — dinero del propietario.
 *   · **80 %** al llegar, directo al propietario contra entrega de llaves.
 *
 * Las cuentas cierran siempre, y eso es deliberado: `tarifa + anticipo === deposito`
 * y `deposito + saldo === canon`. Por eso el anticipo se calcula como **resto** del
 * depósito y no con otro porcentaje: con un canon que no sea múltiplo de 10, dos
 * redondeos por separado dejarían un peso suelto y la tabla del sitio no
 * cuadraría con la del contrato que firma el estudiante.
 */
export interface DesgloseReserva {
  /** Canon mensual pactado: el precio de la habitación elegida. */
  canon: number;
  /** Lo que se paga al reservar: el 20 % del canon. */
  deposito: number;
  /** Tarifa de Servicio de la Plataforma: el 10 % del canon. */
  tarifaServicio: number;
  /** Anticipo del Arriendo: el otro 10 %, del propietario. */
  anticipo: number;
  /** Saldo que se paga al llegar: el 80 % del canon. */
  saldoAlLlegar: number;
}

export function desgloseReserva(canon: number): DesgloseReserva {
  const precio = Math.max(0, Math.round(canon));
  const deposito = Math.round(precio * 0.2);
  const tarifaServicio = Math.round(precio * 0.1);

  return {
    canon: precio,
    deposito,
    tarifaServicio,
    anticipo: deposito - tarifaServicio,
    saldoAlLlegar: precio - deposito,
  };
}
