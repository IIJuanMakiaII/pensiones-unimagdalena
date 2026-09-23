import type { PensionConHabitaciones } from "@/types";
import { precioReservable } from "@/lib/pension";

/**
 * Barrios del catalogo.
 *
 * El barrio lo escribe el anfitrion a mano, asi que no sirve tal cual como
 * direccion: «El Pando» y «el pando» son el mismo barrio y dos cadenas distintas.
 * Se normaliza en un unico punto para que la agrupacion, la direccion de la
 * pagina y la miga de pan no puedan discrepar entre si.
 */

/** Convierte el nombre de un barrio en una direccion legible. */
export function slugDeBarrio(barrio: string): string {
  return barrio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Un servicio y en cuantas publicaciones del barrio aparece. */
export interface ServicioContado {
  nombre: string;
  veces: number;
}

export interface ResumenDeBarrio {
  /** El nombre tal como lo escribio el anfitrion. */
  barrio: string;
  slug: string;
  pensiones: PensionConHabitaciones[];
  /** Menor distancia a pie declarada en el barrio; `null` si no hay ninguna. */
  minutosMinimos: number | null;
  /** Servicios ordenados por frecuencia entre las publicaciones del barrio. */
  servicios: ServicioContado[];
  /** Rango de precios reservables; `null` si ninguna habitacion se puede reservar. */
  precioMinimo: number | null;
  precioMaximo: number | null;
}

function resumir(barrio: string, grupo: PensionConHabitaciones[]): ResumenDeBarrio {
  const minutos = grupo
    .map((pension) => pension.distancia_a_pie_minutos)
    .filter((valor) => Number.isFinite(valor));

  /**
   * El rango de precios se calcula con `precioReservable`, no con el precio de
   * referencia: si el anfitrion marco todas sus habitaciones como ocupadas, no
   * hay nada que reservar a ese precio y publicarlo seria anunciar una cifra que
   * el estudiante no puede conseguir.
   */
  const precios = grupo
    .map((pension) => precioReservable(pension))
    .filter((precio): precio is number => precio !== null);

  const conteo = new Map<string, number>();
  for (const pension of grupo) {
    // Un servicio repetido en la misma publicacion cuenta una sola vez: si no,
    // un anuncio con «WiFi» escrito dos veces falsearia la frecuencia del barrio.
    for (const servicio of new Set(pension.servicios ?? [])) {
      conteo.set(servicio, (conteo.get(servicio) ?? 0) + 1);
    }
  }

  const servicios = [...conteo.entries()]
    .map(([nombre, veces]) => ({ nombre, veces }))
    .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, "es"));

  return {
    barrio,
    slug: slugDeBarrio(barrio),
    pensiones: grupo,
    minutosMinimos: minutos.length > 0 ? Math.min(...minutos) : null,
    servicios,
    precioMinimo: precios.length > 0 ? Math.min(...precios) : null,
    precioMaximo: precios.length > 0 ? Math.max(...precios) : null,
  };
}

/**
 * Agrupa publicaciones por barrio.
 *
 * Solo devuelve barrios con al menos una publicacion activa: una pagina de barrio
 * sin pensiones no tiene nada que contar y seria una pagina vacia, justo lo que no
 * debe existir. Los barrios sin nombre se descartan porque no dan direccion.
 *
 * **El llamante decide la fuente.** Para paginas publicas hay que pasar
 * `obtenerPensionesReales()`: la semilla de demostracion no puede generar barrios,
 * porque lo que se enlaza se indexa.
 */
export function resumenesDeBarrio(pensiones: PensionConHabitaciones[]): ResumenDeBarrio[] {
  const porSlug = new Map<string, { barrio: string; grupo: PensionConHabitaciones[] }>();

  for (const pension of pensiones) {
    if (!pension.activa) continue;

    const barrio = (pension.barrio ?? "").trim();
    const slug = slugDeBarrio(barrio);
    if (!slug) continue;

    const existente = porSlug.get(slug);
    if (existente) existente.grupo.push(pension);
    else porSlug.set(slug, { barrio, grupo: [pension] });
  }

  return [...porSlug.values()]
    .map(({ barrio, grupo }) => resumir(barrio, grupo))
    .sort((a, b) => b.pensiones.length - a.pensiones.length || a.barrio.localeCompare(b.barrio, "es"));
}
