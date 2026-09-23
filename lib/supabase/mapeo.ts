import type { GeneroHabitacion, Habitacion, PensionConHabitaciones, TipoHabitacion } from "@/types";
import { IMAGEN_RESPALDO } from "@/lib/pension";

/**
 * Mapeo fila (snake_case de PostgreSQL) -> modelo de dominio (types/index.ts).
 *
 * Nota: la columna se llama `precio_mensual` (PostgreSQL no admite camelCase
 * sin comillas) y el campo de la interfaz es `precioMensual`, tal como se pidió.
 */

export interface PensionFila {
  id: string;
  /**
   * Dirección pública (Oleada 5, tarea #26). Opcional aquí a propósito: si esta
   * capa se ejecutara contra una base a la que todavía no se le aplicó la
   * migración, el campo llega ausente y el mapeo cae al `id` en lugar de
   * producir enlaces rotos (`/pensiones/undefined`).
   */
  slug?: string | null;
  anfitrion_id: string;
  titulo: string;
  descripcion: string | null;
  precio_mensual: number | null;
  direccion: string | null;
  barrio: string | null;
  distancia_a_pie_minutos: number | null;
  servicios: string[] | null;
  normas: string[] | null;
  calificacion: number | null;
  verificado: boolean | null;
  imagenes: string[] | null;
  activa: boolean;
  creada_en: string;
  latitud?: number | null;
  longitud?: number | null;
  /** WhatsApp propio del anuncio (10 dígitos); `null` si no lo ha fijado. */
  whatsapp?: string | null;
  /** Constancia de la autorización para publicar el contacto (tarea #30). */
  autorizacion_contacto_en?: string | null;
}

export interface HabitacionFila {
  id: string;
  pension_id: string;
  tipo: string;
  genero: string;
  precio_mensual_cop: number;
  alimentacion_incluida: boolean;
  disponible: boolean;
}

const TIPOS: TipoHabitacion[] = ["individual", "compartida", "matrimonial"];
const GENEROS: GeneroHabitacion[] = ["mixto", "femenino", "masculino"];

export function filaAHabitacion(fila: HabitacionFila): Habitacion {
  return {
    id: fila.id,
    pension_id: fila.pension_id,
    tipo: TIPOS.includes(fila.tipo as TipoHabitacion) ? (fila.tipo as TipoHabitacion) : "individual",
    genero: GENEROS.includes(fila.genero as GeneroHabitacion) ? (fila.genero as GeneroHabitacion) : "mixto",
    precio_mensual_cop: Number(fila.precio_mensual_cop ?? 0),
    alimentacion_incluida: Boolean(fila.alimentacion_incluida),
    disponible: Boolean(fila.disponible),
  };
}

export function filaAPension(fila: PensionFila, habitaciones: Habitacion[]): PensionConHabitaciones {
  const imagenes = (fila.imagenes ?? []).filter((url): url is string => Boolean(url));

  return {
    id: fila.id,
    // Sin `slug` (base a la que aún no se le aplicó la migración) se cae al
    // `id`: un enlace con UUID sigue funcionando, y siempre es mejor que un
    // enlace con «undefined».
    slug: fila.slug?.trim() ? fila.slug : fila.id,
    anfitrion_id: fila.anfitrion_id,
    titulo: fila.titulo,
    descripcion: fila.descripcion ?? "",
    precioMensual: Number(fila.precio_mensual ?? 0),
    direccion: fila.direccion ?? "",
    servicios: fila.servicios ?? [],
    imagenes: imagenes.length > 0 ? imagenes : [IMAGEN_RESPALDO],
    activa: fila.activa,
    creada_en: new Date(fila.creada_en),
    barrio: fila.barrio ?? "",
    distancia_a_pie_minutos: Number(fila.distancia_a_pie_minutos ?? 0),
    normas: fila.normas ?? [],
    calificacion: Number(fila.calificacion ?? 0),
    verificado: Boolean(fila.verificado),
    latitud: typeof fila.latitud === "number" ? fila.latitud : null,
    longitud: typeof fila.longitud === "number" ? fila.longitud : null,
    whatsapp: fila.whatsapp ?? null,
    autorizacion_contacto_en: fila.autorizacion_contacto_en ?? null,
    habitaciones,
  };
}
