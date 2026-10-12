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

/* -------------------------------------------------------------------------- */
/* La escritura (tarea #77)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Lo que se puede decir del guardado del número.
 *
 * Los mismos cuatro estados que la lectura, más `invalido` y `sin-sesion`, que
 * solo puede producir una escritura. Ninguno significa lo mismo que otro:
 * `sin-tabla` es «esta función todavía no está disponible», `error` es «no lo sé»,
 * y quien dibuja tiene que poder decir cosas distintas.
 */
export type GuardadoDeContacto =
  | { estado: "ok"; whatsapp: string }
  | { estado: "invalido" }
  | { estado: "sin-sesion" }
  | { estado: "sin-tabla" }
  | { estado: "error" };

/**
 * Guarda el número privado del anfitrión **de la sesión**, no de quien llame.
 *
 * POR QUÉ ESTA FUNCIÓN FALTABA Y AHORA ESTÁ AQUÍ
 * ----------------------------------------------
 * La tarea #76 dejó el módulo con la mitad de lectura —y su encargo pedía no
 * tocarlo sin preguntar—, pero sin escritura la petición del propietario no se
 * puede cumplir: el formulario no tiene forma de guardar nada. Se añade aquí, y
 * solo aquí, porque la regla de la #76 sigue en pie: **este es el único módulo del
 * código que sabe de `contacto_anfitrion`**. La alternativa —consultar la tabla
 * desde la acción— habría repartido ese conocimiento, que es justo lo que la #76
 * quiso evitar. La adición es **puramente aditiva**: no se cambió ninguna línea de
 * lo que ya existía.
 *
 * TRES DECISIONES QUE NO SON DE ESTILO
 * ------------------------------------
 *  1. **La identidad sale de la sesión, dentro del módulo.** No recibe un
 *     identificador por parámetro: si lo recibiera, un día alguien lo llamaría con
 *     un `anfitrion_id` que viajó en un formulario, y esa es la forma exacta en que
 *     este proyecto ya cerró dos agujeros. La RLS volvería a decirlo, pero la
 *     consulta no debe depender de que la última puerta esté bien.
 *  2. **`upsert` con `onConflict: "anfitrion_id"`, no `insert`.** La tabla tiene
 *     una fila por anfitrión: quien publica su segundo anuncio no crea una segunda
 *     fila, actualiza la suya. Un `insert` daría un `23505` que el anfitrión leería
 *     como un fallo del formulario.
 *  3. **Nunca se responde «ok» sin la fila devuelta.** Es el mismo criterio que las
 *     cuatro escrituras del panel: un éxito sin comprobación es un éxito que no se
 *     sabe si ocurrió. Y si el formato no cuadra se devuelve `invalido` **sin
 *     consultar**, porque la restricción de la base respondería `23514` sin
 *     decirle a nadie qué escribir.
 *
 * LO QUE ESTA FUNCIÓN NO HACE, Y NO DEBE HACER
 * --------------------------------------------
 * No escribe `pensiones.whatsapp`. Esa columna es del modelo viejo, está congelada
 * y el número del anfitrión ya no es un dato del anuncio. Tampoco borra: no hay
 * camino de `delete` desde la aplicación, porque vaciar el campo no tiene por qué
 * destruir un dato.
 *
 * El número viaja a la base tal cual lo devuelve `normalizarNumeroDeAnfitrion()`
 * —diez dígitos, sin `+57`—, y **no se registra en ningún `console.error`**: los
 * registros de un servidor no son sitio para un teléfono ajeno.
 */
export async function guardarContactoDelAnfitrion(
  valor: string,
  cliente?: SupabaseClient
): Promise<GuardadoDeContacto> {
  const numero = normalizarNumeroDeAnfitrion(valor);

  if (!PATRON_WHATSAPP.test(numero)) return { estado: "invalido" };

  try {
    const supabase = cliente ?? (await crearClienteServidor());

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { estado: "sin-sesion" };

    const { data, error } = await supabase
      .from(TABLA_CONTACTO)
      .upsert({ anfitrion_id: user.id, whatsapp: numero }, { onConflict: "anfitrion_id" })
      .select("whatsapp")
      .maybeSingle();

    if (error) {
      if (esTablaAusente(error)) return { estado: "sin-tabla" };
      console.error(
        "Error guardando el contacto privado del anfitrión:",
        error.code,
        error.message
      );
      return { estado: "error" };
    }

    if (!data?.whatsapp) {
      console.error("El guardado del contacto no devolvió la fila escrita.");
      return { estado: "error" };
    }

    return { estado: "ok", whatsapp: data.whatsapp };
  } catch (error) {
    console.error("Fallo de conexión guardando el contacto privado:", error);
    return { estado: "error" };
  }
}

/**
 * Corrige el número de **otra persona**, y por eso es una función aparte.
 *
 * POR QUÉ NO SE AÑADIÓ UN PARÁMETRO A LA ANTERIOR
 * ----------------------------------------------
 * `guardarContactoDelAnfitrion` escribe el número de quien tiene la sesión, y su
 * comentario prohíbe explícitamente recibir un destino por parámetro: «si lo
 * recibiera, un día alguien lo llamaría con un `anfitrion_id` que viajó en un
 * formulario». Añadirle un `anfitrionId` opcional habría creado exactamente esa
 * función, con la diferencia de que el día del error parecería correcta.
 *
 * La solución es que la capacidad peligrosa tenga **nombre propio** y no pueda
 * confundirse con la inocente al leer una llamada: `guardarContactoDelAnfitrion`
 * escribe el de la sesión; `corregirContactoDeOtroAnfitrion` escribe el de un
 * tercero, y quien la lea sabe de inmediato que ahí hay un destinatario elegido
 * por alguien. Las dos viven aquí porque este es el único módulo que sabe de la
 * tabla, y separarlas en dos archivos solo habría escondido la segunda.
 *
 * QUIÉN PUEDE LLAMARLA NO SE DECIDE AQUÍ
 * --------------------------------------
 * La RLS ya lo dice: la política de `insert` y la de `update` aceptan la fila
 * cuando `auth.uid() = anfitrion_id` **o** `public.es_maestro()`. Esta función no
 * comprueba el rol, igual que la anterior no lo comprueba: la puerta está en la
 * base, y quien la llama desde una acción de servidor ya pasó por `exigirMaestro()`.
 * Repetir aquí la comprobación daría dos sitios donde puede desincronizarse.
 *
 * Lo que sí es responsabilidad del llamante, y está escrito en la acción: **el
 * `anfitrionId` se resuelve en el servidor a partir del anuncio**, nunca se toma
 * de un campo del formulario. Esta función no puede comprobarlo —recibe un id y
 * lo usa—, y es la razón por la que su nombre deja claro que alguien lo eligió.
 */
export async function corregirContactoDeOtroAnfitrion(
  anfitrionId: string,
  valor: string,
  cliente?: SupabaseClient
): Promise<GuardadoDeContacto> {
  const numero = normalizarNumeroDeAnfitrion(valor);

  if (!PATRON_WHATSAPP.test(numero)) return { estado: "invalido" };

  if (!anfitrionId) {
    console.error("Corrección del contacto privado sin destinatario.");
    return { estado: "error" };
  }

  try {
    const supabase = cliente ?? (await crearClienteServidor());

    const { data, error } = await supabase
      .from(TABLA_CONTACTO)
      .upsert({ anfitrion_id: anfitrionId, whatsapp: numero }, { onConflict: "anfitrion_id" })
      .select("whatsapp")
      .maybeSingle();

    if (error) {
      if (esTablaAusente(error)) return { estado: "sin-tabla" };
      console.error(
        "Error corrigiendo el contacto privado de un anfitrión:",
        error.code,
        error.message
      );
      return { estado: "error" };
    }

    if (!data?.whatsapp) {
      console.error("La corrección del contacto no devolvió la fila escrita.");
      return { estado: "error" };
    }

    return { estado: "ok", whatsapp: data.whatsapp };
  } catch (error) {
    console.error("Fallo de conexión corrigiendo el contacto privado:", error);
    return { estado: "error" };
  }
}
