import type { Habitacion, PensionConHabitaciones, RangoDistancia } from "@/types";
import { habitacionesDisponibles } from "@/lib/pension";

/**
 * Motor de filtrado: funciones puras sobre los datos que recibe.
 * Ya no depende de un catálogo estático: el catálogo llega desde Supabase
 * (o desde la semilla local en modo demo) y se pasa como argumento.
 */

/** Estado de filtros usado por la UI (versión con rango de distancia legible). */
export interface FiltrosUI {
  precioMaximoCop: number;
  genero: "todos" | "mixto" | "femenino" | "masculino";
  rangoDistancia: RangoDistancia;
  soloConAlimentacion: boolean;
  soloVerificadas: boolean;
  /** Solo las pensiones guardadas en favoritos (se resuelve en aplicarFiltros). */
  soloFavoritas: boolean;
}

export const FILTROS_INICIALES: FiltrosUI = {
  precioMaximoCop: 0, // 0 = sin tope; el catálogo lo ajusta al máximo real
  genero: "todos",
  rangoDistancia: "cualquiera",
  soloConAlimentacion: false,
  soloVerificadas: false,
  soloFavoritas: false,
};

export const PASO_PRECIO = 50000;
export const PRECIO_MIN_DEFECTO = 300000;
export const PRECIO_MAX_DEFECTO = 1500000;

/**
 * Rango de precios real del catálogo recibido (para el slider).
 *
 * Solo aportan precio los anuncios con algo reservable o, si nunca se
 * publicaron habitaciones, su precio declarado. Un anuncio con habitaciones pero
 * todas ocupadas queda fuera: su `precioMensual` es el que conserva la base y no
 * una oferta vigente, así que no debe ensanchar el rango de búsqueda.
 */
export function limitesDePrecio(pensiones: PensionConHabitaciones[]): { min: number; max: number } {
  const precios = pensiones.flatMap((p) => {
    const disponibles = habitacionesDisponibles(p);
    if (disponibles.length > 0) return disponibles.map((h) => h.precio_mensual_cop);
    if ((p.habitaciones ?? []).length > 0) return [];
    return p.precioMensual > 0 ? [p.precioMensual] : [];
  });

  if (precios.length === 0) return { min: PRECIO_MIN_DEFECTO, max: PRECIO_MAX_DEFECTO };

  const min = Math.min(...precios);
  const max = Math.max(...precios);
  return { min, max: max === min ? min + PASO_PRECIO : max };
}

export function coincideRangoDistancia(minutos: number, rango: RangoDistancia): boolean {
  switch (rango) {
    case "<5":
      return minutos < 5;
    case "5-10":
      return minutos >= 5 && minutos <= 10;
    case "10-15":
      return minutos > 10 && minutos <= 15;
    default:
      return true;
  }
}

/** Una habitación coincide si está disponible y cumple precio, género y alimentación. */
export function habitacionCumpleFiltros(h: Habitacion, f: FiltrosUI): boolean {
  if (!h.disponible) return false;
  if (f.precioMaximoCop > 0 && h.precio_mensual_cop > f.precioMaximoCop) return false;
  if (f.genero !== "todos" && h.genero !== f.genero) return false;
  if (f.soloConAlimentacion && !h.alimentacion_incluida) return false;
  return true;
}

/**
 * Una pensión aparece si al menos una de sus habitaciones cumple todos los
 * filtros activos.
 *
 * Distingue dos situaciones que antes se trataban igual:
 *
 *  1. **Sin habitaciones publicadas** (anuncio creado con el formulario
 *     anterior): conserva el precio declarado por el anfitrión y se evalúa con
 *     `precioMensual`, para no ocultarla del catálogo.
 *  2. **Con habitaciones, pero todas ocupadas**: no hay nada reservable. El
 *     anuncio sigue visible —la tarjeta avisa de que no hay habitaciones
 *     libres—, pero **no puede satisfacer una búsqueda por precio**: el
 *     `precioMensual` que conserva la base es el de la última habitación que se
 *     ocupó, no una oferta vigente.
 *
 * `precioMaximoReal` es el máximo del catálogo: hace falta para saber si el
 * usuario movió el tope de precio, porque el valor inicial del filtro es
 * justamente ese máximo (con el máximo puesto no hay filtro de precio activo).
 */
export function pensionCumpleFiltros(
  p: PensionConHabitaciones,
  f: FiltrosUI,
  precioMaximoReal: number
): boolean {
  if (f.soloVerificadas && !p.verificado) return false;
  if (!coincideRangoDistancia(p.distancia_a_pie_minutos, f.rangoDistancia)) return false;

  const habitaciones = p.habitaciones ?? [];
  const disponibles = habitacionesDisponibles(p);

  if (disponibles.length === 0) {
    // Género y alimentación solo los puede satisfacer una habitación concreta.
    if (f.soloConAlimentacion || f.genero !== "todos") return false;

    const hayTopeDePrecio = f.precioMaximoCop > 0 && f.precioMaximoCop < precioMaximoReal;

    if (habitaciones.length > 0) return !hayTopeDePrecio;

    return !hayTopeDePrecio || p.precioMensual <= f.precioMaximoCop;
  }

  return disponibles.some((h) => habitacionCumpleFiltros(h, f));
}

/** Habitación recomendada para el CTA de la card: la más barata que cumple filtros. */
export function habitacionDestacada(
  p: PensionConHabitaciones,
  f: FiltrosUI
): Habitacion | null {
  const candidatas = habitacionesDisponibles(p)
    .filter((h) => habitacionCumpleFiltros(h, f))
    .sort((a, b) => a.precio_mensual_cop - b.precio_mensual_cop);
  return candidatas[0] ?? null;
}

/** Cantidad de habitaciones disponibles (microbadge de la card). */
export function contarDisponibles(p: PensionConHabitaciones): number {
  return habitacionesDisponibles(p).length;
}

/**
 * Resultado filtrado, ordenado por distancia a pie (primero lo más cercano).
 * `favoritos` solo se usa cuando `f.soloFavoritas` está activo: los favoritos
 * viven en el navegador, así que llegan como argumento y el motor sigue siendo puro.
 */
export function aplicarFiltros(
  pensiones: PensionConHabitaciones[],
  f: FiltrosUI,
  precioMaximoReal: number,
  favoritos: string[] = []
): PensionConHabitaciones[] {
  return pensiones
    .filter((p) => (f.soloFavoritas ? favoritos.includes(p.id) : true))
    .filter((p) => pensionCumpleFiltros(p, f, precioMaximoReal))
    .sort((a, b) => a.distancia_a_pie_minutos - b.distancia_a_pie_minutos);
}

/** Serializa los filtros a parámetros de URL (para enlaces compartibles). */
export function filtrosAParametros(f: FiltrosUI, precioMaximoReal: number): URLSearchParams {
  const parametros = new URLSearchParams();

  if (f.precioMaximoCop > 0 && f.precioMaximoCop < precioMaximoReal) {
    parametros.set("precio", String(f.precioMaximoCop));
  }
  if (f.genero !== "todos") parametros.set("genero", f.genero);
  if (f.rangoDistancia !== "cualquiera") parametros.set("dist", f.rangoDistancia);
  if (f.soloConAlimentacion) parametros.set("comida", "1");
  if (f.soloVerificadas) parametros.set("verificadas", "1");
  if (f.soloFavoritas) parametros.set("favoritas", "1");

  return parametros;
}

/** Reconstruye los filtros desde la URL. Ignora valores inválidos. */
export function parametrosAFiltros(
  parametros: URLSearchParams,
  precioMaximoReal: number
): FiltrosUI {
  const generos = ["mixto", "femenino", "masculino"];
  const rangos: RangoDistancia[] = ["<5", "5-10", "10-15"];

  const genero = parametros.get("genero") ?? "";
  const distancia = parametros.get("dist") ?? "";
  const precio = Number(parametros.get("precio"));

  return {
    precioMaximoCop:
      Number.isFinite(precio) && precio > 0 ? Math.min(precio, precioMaximoReal) : precioMaximoReal,
    genero: generos.includes(genero) ? (genero as FiltrosUI["genero"]) : "todos",
    rangoDistancia: rangos.includes(distancia as RangoDistancia)
      ? (distancia as RangoDistancia)
      : "cualquiera",
    soloConAlimentacion: parametros.get("comida") === "1",
    soloVerificadas: parametros.get("verificadas") === "1",
    soloFavoritas: parametros.get("favoritas") === "1",
  };
}
