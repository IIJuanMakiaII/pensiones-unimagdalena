import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/utils/supabase/server";

/**
 * El WhatsApp **privado** del anfitrión (tarea #76).
 *
 * Este módulo es el único sitio del código que sabe leer `contacto_anfitrion`.
 * No lo usa ninguna página pública, y no debe usarlo: el número no se publica.
 * Existe separado de `lib/datos.ts` a propósito, para que cruzar esa frontera
 * sea una decisión visible en el `import` y no un descuido en una consulta.
 *
 * ## Por qué el número NO está en `pensiones`
 *
 * La petición del propietario lo dice y el motivo es correcto: `pensiones` se
 * protege con `select` **por columna** (`oleada-10`), así que su seguridad
 * depende de que cada consulta enumere bien sus columnas. Una tabla propia sin
 * privilegio alguno para `anon` no depende de eso: la API responde `42501` antes
 * de evaluar ninguna política. Ver `supabase/oleada-15-contacto-anfitrion-privado.sql`.
 *
 * ## Por qué el tipo de dominio no lo lleva
 *
 * `Pension` (types/index.ts) es lo que viaja a los componentes de cliente, y por
 * tanto al HTML de la página. Un campo añadido ahí se publica solo. Por eso el
 * número **no entra en `lib/supabase/mapeo.ts` ni debe entrar**: se lee aparte,
 * en el servidor, y solo donde hace falta. El guion `verificar:contacto-privado`
 * comprueba que la proyección del catálogo sigue sin incluirlo.
 *
 * ## La tabla puede no existir todavía, y eso no es un error
 *
 * El propietario aplica las migraciones a mano. Si el código se despliega antes
 * de que la migración esté aplicada, la tabla no existe y PostgREST responde
 * `404 PGRST205`. Eso **no es un fallo**: es «esta función aún no está
 * disponible». Se devuelve el estado `sin-tabla`, distinguible de `error` y de
 * `sin-numero`, y quien dibuja decide (el panel del maestro no muestra el botón).
 *
 * Confundir los tres estados sería el mismo error que ya costó una ronda en este
 * proyecto: «no lo sé» no es «no hay» ni «está roto».
 */

/** El nombre de la tabla, en un solo sitio. */
export const TABLA_CONTACTO = "contacto_anfitrion";

/**
 * Proyección explícita, por el mismo motivo que `COLUMNAS_PENSION`: pedir `*`
 * traería cualquier columna que se añada en el futuro.
 *
 * Sin `creado_en`: el panel muestra el número, y la fecha que sirve para saber
 * si sigue vigente es la de modificación.
 */
export const COLUMNAS_CONTACTO = "anfitrion_id, whatsapp, actualizado_en";

/**
 * El formato del número, y tiene que ser **el mismo que el de la base**.
 *
 * Espejo exacto de la restricción `contacto_anfitrion_whatsapp_formato` de
 * `oleada-15`. Si los dos se separan, una de las dos puertas miente: o el
 * formulario deja pasar algo que la base rechaza con un `23514` opaco, o la base
 * acepta algo que el formulario nunca enseñó a escribir.
 *
 * Las dos formas del plan colombiano: celular (`3` + 9 dígitos) y fijo con
 * indicativo (`60` + 8). El fijo entra a propósito — ver la migración, sección 2.
 */
export const PATRON_WHATSAPP = /^(3[0-9]{9}|60[0-9]{8})$/;

/** Lo que se puede decir de la lectura. Nunca «vacío» a secas. */
export type MotivoSinContacto =
  /** La tabla todavía no existe: la migración no está aplicada. No es un error. */
  | "sin-tabla"
  /** La tabla existe y la consulta falló (red, permisos, lo que sea). */
  | "error";

export type ContactoLeido =
  | { estado: "ok"; whatsapp: string; actualizado_en: Date | null }
  | { estado: "sin-numero" }
  | { estado: "sin-tabla" }
  | { estado: "error" };

interface ContactoFila {
  anfitrion_id: string;
  whatsapp: string;
  actualizado_en?: string | null;
}

/** Lo mínimo que se necesita de un error de PostgREST para clasificarlo. */
interface ErrorDeConsulta {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

/**
 * ¿El error es «la tabla no existe»?
 *
 * Se reconocen las dos formas porque las dos aparecen según dónde falle: la de
 * PostgREST (`PGRST205`, con el mensaje «Could not find the table … in the schema
 * cache») y la de PostgreSQL (`42P01`, «relation does not exist»). Mirar solo una
 * dejaría el caso sin cubrir en la mitad de los caminos, y el síntoma sería un
 * botón que no aparece sin explicación.
 */
export function esTablaAusente(error: ErrorDeConsulta | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /could not find the table|does not exist|no existe la relación|schema cache/i.test(
    error.message ?? ""
  );
}

/** Deja el número en la forma que guarda la base: solo dígitos, sin `+57`. */
export function normalizarNumeroDeAnfitrion(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 12 && digitos.startsWith("57")) return digitos.slice(2);
  return digitos;
}

/** ¿Tiene la forma de un número colombiano que la base va a aceptar? */
export function numeroDeAnfitrionValido(valor: string): boolean {
  return PATRON_WHATSAPP.test(normalizarNumeroDeAnfitrion(valor));
}

/**
 * El enlace para escribirle **al anfitrión**.
 *
 * Vive aquí y no en `lib/formato.ts` a propósito, y no es una preferencia de
 * organización: `lib/formato.ts` es el módulo del contacto **público**, donde
 * `enlaceWhatsApp()` tiene prohibido usar el número del dueño (tarea #39, y hay
 * una prueba que lo vigila en `pruebas/whatsapp.prueba.ts`). Poner las dos
 * funciones en el mismo archivo invitaría a que alguien las confunda; separadas,
 * cruzar la frontera se ve en el `import`.
 *
 * Devuelve `null` si el número no es válido: un enlace roto es peor que ningún
 * enlace, porque el maestro cree que ha contactado.
 */
export function enlaceParaEscribirAlAnfitrion(
  valor: string,
  mensaje?: string
): string | null {
  const numero = normalizarNumeroDeAnfitrion(valor);
  if (!PATRON_WHATSAPP.test(numero)) return null;

  const base = `https://wa.me/57${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

function filaAContacto(fila: ContactoFila): ContactoLeido {
  return {
    estado: "ok",
    whatsapp: fila.whatsapp,
    actualizado_en: fila.actualizado_en ? new Date(fila.actualizado_en) : null,
  };
}

/**
 * El número de **un** anfitrión (su propio formulario, su propia pantalla).
 *
 * La RLS decide si esta consulta devuelve algo: pedir el número de otro
 * anfitrión desde una sesión normal devuelve `sin-numero`, no un error. Es
 * deliberado — desde fuera, «no existe» y «no es tuyo» deben verse igual, para
 * que la interfaz no confirme la existencia del número de otra persona.
 */
export async function leerContactoDelAnfitrion(
  anfitrionId: string,
  cliente?: SupabaseClient
): Promise<ContactoLeido> {
  try {
    const supabase = cliente ?? (await crearClienteServidor());
    const { data, error } = await supabase
      .from(TABLA_CONTACTO)
      .select(COLUMNAS_CONTACTO)
      .eq("anfitrion_id", anfitrionId)
      .maybeSingle();

    if (error) {
      if (esTablaAusente(error)) return { estado: "sin-tabla" };
      console.error("Error leyendo el contacto privado del anfitrión:", error.message);
      return { estado: "error" };
    }

    if (!data) return { estado: "sin-numero" };
    return filaAContacto(data as ContactoFila);
  } catch (error) {
    console.error("Fallo de conexión leyendo el contacto privado:", error);
    return { estado: "error" };
  }
}

/**
 * Los números de **varios** anfitriones a la vez, indexados por su id.
 *
 * Es lo que necesita el panel del maestro: una lista de anuncios, cada uno con el
 * número de quien lo publicó. Se pide en **una** consulta y no una por anuncio
 * —con veinte anuncios serían veinte viajes a la base para pintar un botón—, y
 * quien acota el resultado es la RLS: el maestro recibe todas las filas, y
 * cualquier otra sesión, solo la suya.
 *
 * Devuelve el motivo junto al mapa para que quien dibuje pueda decir «no se pudo
 * comprobar» en vez de «este anfitrión no tiene número». Un mapa vacío por un
 * fallo de red no es lo mismo que un mapa vacío porque nadie ha dejado su
 * número, y confundirlos hace que el maestro concluya lo contrario de lo cierto.
 */
export async function leerContactosDeAnfitriones(
  ids: string[],
  cliente?: SupabaseClient
): Promise<{ contactos: Map<string, string>; motivo: MotivoSinContacto | null }> {
  const contactos = new Map<string, string>();
  if (ids.length === 0) return { contactos, motivo: null };

  // Duplicados fuera: con veinte anuncios de cinco anfitriones, la consulta
  // viaja con cinco identificadores y no con veinte.
  const unicos = [...new Set(ids.filter((id) => Boolean(id)))];

  try {
    const supabase = cliente ?? (await crearClienteServidor());
    const { data, error } = await supabase
      .from(TABLA_CONTACTO)
      .select(COLUMNAS_CONTACTO)
      .in("anfitrion_id", unicos);

    if (error) {
      if (esTablaAusente(error)) return { contactos, motivo: "sin-tabla" };
      console.error("Error leyendo los contactos privados:", error.message);
      return { contactos, motivo: "error" };
    }

    for (const fila of (data ?? []) as ContactoFila[]) {
      if (fila?.anfitrion_id && fila.whatsapp) contactos.set(fila.anfitrion_id, fila.whatsapp);
    }

    return { contactos, motivo: null };
  } catch (error) {
    console.error("Fallo de conexión leyendo los contactos privados:", error);
    return { contactos, motivo: "error" };
  }
}
