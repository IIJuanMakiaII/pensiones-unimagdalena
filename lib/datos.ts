import type { Habitacion, PensionConHabitaciones } from "@/types";
import { HABITACIONES_SEMILLA, PENSIONES_SEMILLA } from "@/lib/datos.semilla";
import {
  columnaDeIdentificador,
  identificadorPlausible,
  normalizarIdentificador,
} from "@/lib/identificador";
import { DEMO_HABILITADA } from "@/lib/sitio";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { agruparHabitacionesPorPension } from "@/lib/agrupar";
import {
  COLUMNAS_HABITACION,
  COLUMNAS_PENSION,
  filaAHabitacion,
  filaAPension,
  type HabitacionFila,
  type PensionFila,
} from "@/lib/supabase/mapeo";
import { crearClienteServidor } from "@/utils/supabase/server";
import { crearClientePublico } from "@/utils/supabase/publico";

/**
 * Fuente de datos del catálogo.
 *
 * - Con Supabase configurado: consulta la base de datos.
 * - Sin configurar: devuelve la semilla local, para que el sitio siga en pie.
 *
 * Lecturas públicas → cliente anónimo cacheado (ISR).
 * Datos del anfitrión → cliente con cookies (siempre frescos y privados).
 *
 * ## Un anuncio se pide de dos formas (tarea #26)
 *
 * Por su **dirección legible** (`/pensiones/residencia-makia`) o por su **UUID**,
 * que sigue resolviendo para no romper enlaces repartidos antes de que existieran
 * los slugs. Quien decide cuál usar es `lib/identificador.ts`, y hay una sola
 * función que resuelve: `resolverPension()`.
 *
 * ## «No existe» y «no se pudo comprobar» no son lo mismo
 *
 * Es la distinción que sostiene el 404 de las fichas. Antes, cualquier fallo de
 * red se resolvía devolviendo la semilla de demostración: una caída momentánea
 * de la base se disfrazaba de ficha válida (o de ficha inexistente), y en ambos
 * casos el resultado era mentira. Ahora `resolverPension()` dice cuál de las tres
 * cosas ha pasado —está, no está, no se pudo comprobar— y cada llamador decide.
 */

/**
 * El cliente de Supabase no está tipado contra el esquema (los tipos no se
 * generan desde la base), así que la conversión de lo que devuelve la consulta a
 * las filas del mapeo es explícita. Vive aquí, en un solo sitio y con el porqué
 * escrito, en lugar de repartida en siete conversiones sueltas.
 *
 * Hace falta desde la tarea #38: al pedir las columnas por su nombre, el cliente
 * deduce el tipo de la proyección y, si no puede, devuelve un tipo de error en
 * vez de `any`. El llamador no tiene que saber nada de eso.
 */
function filasDePension(datos: unknown): PensionFila[] {
  return (datos ?? []) as PensionFila[];
}

function filasDeHabitacion(datos: unknown): HabitacionFila[] {
  return (datos ?? []) as HabitacionFila[];
}

/** Fila ya comprobada como presente: se usa después del `if (!pension)`. */
function filaDePension(dato: unknown): PensionFila {
  return dato as PensionFila;
}

/**
 * Une pensiones con sus habitaciones (equivalente al JOIN 1-N del modelo ER).
 *
 * El índice se construye **una sola vez** (tarea #38 · M-20). Antes esto era un
 * `filter` dentro de un `map`: un recorrido de *todas* las habitaciones por cada
 * pensión, con un coste que crecía multiplicando. Con 6 anuncios no se notaba;
 * con 500 y 5.000 habitaciones serían 2,5 millones de comparaciones por lectura.
 */
function combinar(
  pensiones: PensionFila[],
  habitaciones: HabitacionFila[]
): PensionConHabitaciones[] {
  const porPension = agruparHabitacionesPorPension(habitaciones.map(filaAHabitacion));

  return pensiones.map((fila) => filaAPension(fila, porPension.get(fila.id) ?? []));
}

/**
 * Catálogo de demostración (semilla local).
 *
 * En la semilla el identificador **ya es legible** (`pension-costa-verde`), así
 * que la dirección pública es el propio id y no se duplica en el dato: si algún
 * día se escribe un slug distinto en la semilla, se respeta. Gracias a esto las
 * direcciones de la demo no cambian ni una letra con la Oleada 5.
 */
export function catalogoDemo(): PensionConHabitaciones[] {
  return PENSIONES_SEMILLA.map((pension) => ({
    ...pension,
    slug: pension.id,
    habitaciones: HABITACIONES_SEMILLA.filter((h: Habitacion) => h.pension_id === pension.id),
  }));
}

/** Busca en la semilla por dirección legible o por id. */
function demoPorIdentificador(valor: string): PensionConHabitaciones | null {
  return catalogoDemo().find((pension) => pension.slug === valor || pension.id === valor) ?? null;
}

/** Catálogo completo: solo pensiones activas, las más recientes primero. */
export async function obtenerPensiones(): Promise<PensionConHabitaciones[]> {
  if (!esSupabaseConfigurado()) return catalogoDemo();

  try {
    const supabase = crearClientePublico();
    const [{ data: pensiones, error: errorPensiones }, { data: habitaciones, error: errorHabitaciones }] =
      await Promise.all([
        supabase
          .from("pensiones")
          .select(COLUMNAS_PENSION)
          .eq("activa", true)
          .order("creada_en", { ascending: false }),
        supabase.from("habitaciones").select(COLUMNAS_HABITACION),
      ]);

    if (errorPensiones || errorHabitaciones || !pensiones) {
      console.error("Error consultando Supabase:", errorPensiones?.message ?? errorHabitaciones?.message);
      return catalogoDemo();
    }

    return combinar(filasDePension(pensiones), filasDeHabitacion(habitaciones));
  } catch (error) {
    console.error("Fallo de conexión con Supabase:", error);
    return catalogoDemo();
  }
}

/**
 * Fallo al consultar el catálogo.
 *
 * Existe para que nadie confunda «no se pudo comprobar» con «no existe»: es el
 * error que sube a la frontera (`app/error.tsx`) cuando la base no responde, en
 * lugar de dejar que la ficha se declare inexistente.
 */
export class ErrorDeCatalogo extends Error {
  constructor(
    readonly identificador: string,
    readonly causa: string
  ) {
    super(`No se pudo consultar el anuncio «${identificador}»: ${causa}`);
    this.name = "ErrorDeCatalogo";
  }
}

/** Las tres respuestas posibles al resolver un anuncio, sin ambigüedad. */
export type ResultadoPension =
  | { estado: "ok"; pension: PensionConHabitaciones }
  | { estado: "no-existe" }
  | { estado: "error" };

/**
 * Resuelve un anuncio por su dirección legible **o** por su UUID.
 *
 * Única fuente de verdad: ningún otro punto del código decide qué columna
 * consultar ni qué hacer con cada resultado.
 */
export async function resolverPension(identificador: string): Promise<ResultadoPension> {
  const valor = normalizarIdentificador(identificador);

  // Ni UUID ni dirección válida: no puede existir, y no gasta una consulta.
  if (!identificadorPlausible(valor)) return { estado: "no-existe" };

  if (!esSupabaseConfigurado()) {
    const demo = demoPorIdentificador(valor);
    return demo ? { estado: "ok", pension: demo } : { estado: "no-existe" };
  }

  const columna = columnaDeIdentificador(valor);

  try {
    const supabase = crearClientePublico();
    const { data: pension, error } = await supabase
      .from("pensiones")
      .select(COLUMNAS_PENSION)
      .eq(columna, valor)
      .maybeSingle();

    if (error) {
      console.error(`Error buscando el anuncio por ${columna}:`, error.message);
      return { estado: "error" };
    }

    if (!pension) {
      // La base dice que no está. Con la demo encendida, una ficha de ejemplo
      // sigue resolviéndose por su dirección: la semilla no vive en la base.
      if (DEMO_HABILITADA) {
        const demo = demoPorIdentificador(valor);
        if (demo) return { estado: "ok", pension: demo };
      }
      return { estado: "no-existe" };
    }

    const fila = filaDePension(pension);

    // Las habitaciones se piden por el UUID real: cuando se resuelve por
    // dirección legible, lo que venía en la URL no es una clave foránea.
    const { data: habitaciones, error: errorHabitaciones } = await supabase
      .from("habitaciones")
      .select(COLUMNAS_HABITACION)
      .eq("pension_id", fila.id);

    if (errorHabitaciones) {
      console.error("Error consultando las habitaciones:", errorHabitaciones.message);
      return { estado: "error" };
    }

    return {
      estado: "ok",
      pension: filaAPension(fila, filasDeHabitacion(habitaciones).map(filaAHabitacion)),
    };
  } catch (error) {
    console.error("Fallo de conexión consultando el anuncio:", error);
    return { estado: "error" };
  }
}

/**
 * Una pensión concreta con sus habitaciones (página de detalle).
 *
 * Devuelve `null` **solo** cuando la base ha confirmado que no existe (o que el
 * público no puede verla). Si no se pudo comprobar, lanza: devolver `null` ahí
 * convertiría un corte de red en un `notFound()`, y el anuncio desaparecería del
 * catálogo por un fallo pasajero.
 */
export async function obtenerPensionPorId(identificador: string): Promise<PensionConHabitaciones | null> {
  const resultado = await resolverPension(identificador);

  if (resultado.estado === "ok") return resultado.pension;
  if (resultado.estado === "no-existe") return null;

  throw new ErrorDeCatalogo(identificador, "la consulta no se pudo completar");
}

/**
 * Anuncios **reales** publicados en la base, sin la semilla de demostración.
 *
 * Es la fuente del `sitemap.xml`, y la diferencia con `obtenerPensiones()` es
 * deliberada: aquella cae al catálogo de ejemplo cuando Supabase no responde, y
 * un sitemap es una promesa pública a los buscadores — anunciar una ficha de
 * demostración la indexaría, y al apagar la demo quedarían URLs fantasma.
 *
 * Por eso aquí, ante cualquier duda (sin credenciales o error de red), se
 * devuelve una lista vacía: es preferible anunciar poco que anunciar mentira.
 */
export async function obtenerPensionesReales(): Promise<PensionConHabitaciones[]> {
  if (!esSupabaseConfigurado()) return [];

  try {
    const supabase = crearClientePublico();
    const { data: pensiones, error } = await supabase
      .from("pensiones")
      .select(COLUMNAS_PENSION)
      .eq("activa", true)
      .order("creada_en", { ascending: false });

    if (error || !pensiones) {
      console.error("Sitemap: no se pudo leer el catálogo real:", error?.message);
      return [];
    }

    const ids = filasDePension(pensiones).map((p) => p.id);
    const { data: habitaciones } = ids.length
      ? await supabase.from("habitaciones").select(COLUMNAS_HABITACION).in("pension_id", ids)
      : { data: [] };

    return combinar(filasDePension(pensiones), filasDeHabitacion(habitaciones));
  } catch (error) {
    console.error("Sitemap: fallo de conexión con Supabase:", error);
    return [];
  }
}

/** Publicaciones de un anfitrión (panel de /publicar). */
export async function obtenerPensionesDelAnfitrion(
  anfitrionId: string
): Promise<PensionConHabitaciones[]> {
  if (!esSupabaseConfigurado()) return [];

  try {
    const supabase = await crearClienteServidor();
    const { data: pensiones, error } = await supabase
      .from("pensiones")
      .select(COLUMNAS_PENSION)
      .eq("anfitrion_id", anfitrionId)
      .order("creada_en", { ascending: false });

    if (error || !pensiones) {
      console.error("Error consultando las publicaciones del anfitrión:", error?.message);
      return [];
    }

    const ids = filasDePension(pensiones).map((p) => p.id);
    const { data: habitaciones } = ids.length
      ? await supabase.from("habitaciones").select(COLUMNAS_HABITACION).in("pension_id", ids)
      : { data: [] };

    return combinar(filasDePension(pensiones), filasDeHabitacion(habitaciones));
  } catch (error) {
    console.error("Fallo consultando publicaciones del anfitrión:", error);
    return [];
  }
}
