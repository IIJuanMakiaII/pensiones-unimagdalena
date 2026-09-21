import type { Habitacion, PensionConHabitaciones } from "@/types";
import { HABITACIONES_SEMILLA, PENSIONES_SEMILLA } from "@/lib/datos.semilla";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { filaAHabitacion, filaAPension, type HabitacionFila, type PensionFila } from "@/lib/supabase/mapeo";
import { crearClienteServidor } from "@/utils/supabase/server";
import { crearClientePublico } from "@/utils/supabase/publico";

/**
 * Fuente de datos del catálogo.
 *
 * - Con Supabase configurado: consulta la base de datos.
 * - Sin configurar (o ante un error de red): devuelve la semilla local para que
 *   el sitio siga funcionando. La degradación nunca deja el catálogo vacío.
 *
 * Lecturas públicas → cliente anónimo cacheado (ISR).
 * Datos del anfitrión → cliente con cookies (siempre frescos y privados).
 */

/** Une pensiones con sus habitaciones (equivalente al JOIN 1-N del modelo ER). */
function combinar(
  pensiones: PensionFila[],
  habitaciones: HabitacionFila[]
): PensionConHabitaciones[] {
  return pensiones.map((fila) =>
    filaAPension(
      fila,
      habitaciones.filter((h) => h.pension_id === fila.id).map(filaAHabitacion)
    )
  );
}

/** Catálogo de demostración (semilla local). */
export function catalogoDemo(): PensionConHabitaciones[] {
  return PENSIONES_SEMILLA.map((pension) => ({
    ...pension,
    habitaciones: HABITACIONES_SEMILLA.filter((h: Habitacion) => h.pension_id === pension.id),
  }));
}

/** Catálogo completo: solo pensiones activas, las más recientes primero. */
export async function obtenerPensiones(): Promise<PensionConHabitaciones[]> {
  if (!esSupabaseConfigurado()) return catalogoDemo();

  try {
    const supabase = crearClientePublico();
    const [{ data: pensiones, error: errorPensiones }, { data: habitaciones, error: errorHabitaciones }] =
      await Promise.all([
        supabase.from("pensiones").select("*").eq("activa", true).order("creada_en", { ascending: false }),
        supabase.from("habitaciones").select("*"),
      ]);

    if (errorPensiones || errorHabitaciones || !pensiones) {
      console.error("Error consultando Supabase:", errorPensiones?.message ?? errorHabitaciones?.message);
      return catalogoDemo();
    }

    return combinar(pensiones as PensionFila[], (habitaciones ?? []) as HabitacionFila[]);
  } catch (error) {
    console.error("Fallo de conexión con Supabase:", error);
    return catalogoDemo();
  }
}

/** Una pensión concreta con sus habitaciones (página de detalle). */
export async function obtenerPensionPorId(id: string): Promise<PensionConHabitaciones | null> {
  if (!esSupabaseConfigurado()) {
    return catalogoDemo().find((p) => p.id === id) ?? null;
  }

  try {
    const supabase = crearClientePublico();
    const [{ data: pension, error }, { data: habitaciones }] = await Promise.all([
      supabase.from("pensiones").select("*").eq("id", id).maybeSingle(),
      supabase.from("habitaciones").select("*").eq("pension_id", id),
    ]);

    if (error || !pension) {
      // Puede no existir en la base de datos pero sí en la semilla (modo mixto).
      return catalogoDemo().find((p) => p.id === id) ?? null;
    }

    return filaAPension(pension as PensionFila, ((habitaciones ?? []) as HabitacionFila[]).map(filaAHabitacion));
  } catch (error) {
    console.error("Fallo consultando la pensión:", error);
    return catalogoDemo().find((p) => p.id === id) ?? null;
  }
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
      .select("*")
      .eq("activa", true)
      .order("creada_en", { ascending: false });

    if (error || !pensiones) {
      console.error("Sitemap: no se pudo leer el catálogo real:", error?.message);
      return [];
    }

    const ids = (pensiones as PensionFila[]).map((p) => p.id);
    const { data: habitaciones } = ids.length
      ? await supabase.from("habitaciones").select("*").in("pension_id", ids)
      : { data: [] };

    return combinar(pensiones as PensionFila[], (habitaciones ?? []) as HabitacionFila[]);
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
    const supabase = crearClienteServidor();
    const { data: pensiones, error } = await supabase
      .from("pensiones")
      .select("*")
      .eq("anfitrion_id", anfitrionId)
      .order("creada_en", { ascending: false });

    if (error || !pensiones) {
      console.error("Error consultando las publicaciones del anfitrión:", error?.message);
      return [];
    }

    const ids = pensiones.map((p) => (p as PensionFila).id);
    const { data: habitaciones } = ids.length
      ? await supabase.from("habitaciones").select("*").in("pension_id", ids)
      : { data: [] };

    return combinar(pensiones as PensionFila[], (habitaciones ?? []) as HabitacionFila[]);
  } catch (error) {
    console.error("Fallo consultando publicaciones del anfitrión:", error);
    return [];
  }
}
