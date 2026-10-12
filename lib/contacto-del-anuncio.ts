import type { SupabaseClient } from "@supabase/supabase-js";
import {
  corregirContactoDeOtroAnfitrion,
  numeroDeAnfitrionValido,
} from "@/lib/contacto-anfitrion";

/**
 * De un anuncio a su propietario, y de ahí al número privado (tarea #80).
 *
 * POR QUÉ ESTE MÓDULO ES UNO APARTE, Y NO UNOS RENGLONES DENTRO DE LA ACCIÓN
 * -------------------------------------------------------------------------
 * Es la traducción «anuncio → propietario → contacto», y esa traducción no puede
 * vivir en `app/actions/maestro.ts`. No es una preferencia de organización: hay una
 * guarda que lo vigila (`pruebas/panel-maestro.prueba.ts`, «la superficie del
 * maestro») y que exige que ese archivo **no nombre jamás la columna del
 * propietario**. Su motivo está escrito en la guarda y es bueno: el maestro
 * administra por `id`, y copiar aquí el predicado del anfitrión sería tener dos
 * autorizaciones que pueden desincronizarse.
 *
 * La guarda mira **código, no comentarios** (`fuente()` recorta los comentarios
 * antes de comparar), así que esto no es una restricción de redacción: es una
 * restricción de verdad. La primera versión de la #80 hacía la consulta dentro de
 * la acción y la guarda la paró. Tenía razón: la capacidad de escribirle el número
 * a **otra persona** merece un sitio con nombre propio, donde se lea qué hace, en
 * vez de tres renglones escondidos en una acción que se llama «corregir el
 * WhatsApp». Separarla no relaja nada —la guarda sigue intacta y ahora hay un solo
 * punto de entrada que puede hacer esto—, y de paso deja el nombre de la
 * capacidad a la vista de quien audite.
 *
 * EL DESTINATARIO NO SE RECIBE: SE RESUELVE
 * -----------------------------------------
 * Esta función recibe **qué anuncio** y devuelve el número escrito en la fila de
 * **quien es su dueño**. En ningún momento acepta un `anfitrion_id` por parámetro,
 * y esa es toda su razón de ser: si lo aceptara, un día alguien lo llamaría con un
 * id que viajó en un formulario, y esa es la forma exacta en que este proyecto ya
 * cerró dos agujeros (el predicado de la #16 y la identidad de sesión del
 * guardado). La RLS lo aceptaría, porque al maestro le concede cualquier fila: el
 * daño no sería leer un número ajeno, sería **cambiárselo a alguien**, que el
 * anfitrión no notaría hasta que un estudiante no lo encontrara.
 *
 * QUIÉN PUEDE LLAMARLA NO SE DECIDE AQUÍ
 * --------------------------------------
 * La política de `pensiones` y la de `contacto_anfitrion` ya lo dicen: la primera
 * la lee cualquier sesión autorizada, y la segunda concede la escritura cuando
 * `auth.uid() = anfitrion_id` **o** `public.es_maestro()`. Este módulo no comprueba
 * el rol, igual que no lo comprueba el escritor: quien llama desde una acción de
 * servidor ya pasó por `exigirMaestro()`, y repetir la comprobación daría un
 * segundo sitio donde puede desincronizarse.
 *
 * EL CLIENTE ES OBLIGATORIO, Y NO POR RIGOR
 * -----------------------------------------
 * Se escribe el número de una persona que **no tiene la sesión abierta**, así que
 * quien llama tiene que decir con qué sesión lo hace, a la vista y en la misma
 * línea. Opcional invitaría a crear un cliente por dentro en algún camino futuro,
 * y entonces la sesión que escribe dejaría de leerse en la llamada.
 *
 * SE VALIDA ANTES DE CONSULTAR
 * ----------------------------
 * Un número mal formado se rechaza sin tocar la base, para que la restricción de
 * la tabla (`contacto_anfitrion_whatsapp_formato`) no sea la que responda con un
 * `23514` opaco. Lo vuelve a validar el escritor, y no sobra: cada uno tiene que
 * ser correcto por su cuenta.
 */

/**
 * Lo que se puede decir de una corrección.
 *
 * Los cinco estados, y ninguno significa lo mismo que otro: `invalido` es «el
 * número no tiene la forma», `sin-destinatario` es «ese anuncio no existe o no
 * tiene dueño» —no es un error, es un hecho—, `sin-tabla` es «esta función
 * todavía no está disponible», y `error` es «no lo sé».
 *
 * `sin-destinatario` es el único que no viene del módulo de contacto y existe por
 * una razón concreta: quien dibuja tiene que poder decir «no se cambió nada»
 * distinguiéndolo de «no pudimos comprobarlo». Confundirlos haría que el maestro
 * concluyera lo contrario de lo cierto.
 */
export type CorreccionDeContacto =
  | { estado: "ok"; whatsapp: string }
  | { estado: "invalido" }
  | { estado: "sin-destinatario" }
  | { estado: "sin-tabla" }
  | { estado: "error" };

export async function corregirWhatsappDelAnuncio(
  pensionId: string,
  valor: string,
  cliente: SupabaseClient
): Promise<CorreccionDeContacto> {
  if (!numeroDeAnfitrionValido(valor)) return { estado: "invalido" };

  try {
    /*
     * La proyección es una sola columna a propósito: pedir la fila entera traería
     * el título, las fotos y los servicios a un camino que no los usa, y con ellos
     * la posibilidad de que alguien los mire desde aquí.
     */
    const { data, error } = await cliente
      .from("pensiones")
      .select("anfitrion_id")
      .eq("id", pensionId)
      .maybeSingle();

    if (error) {
      console.error(
        "Error leyendo el propietario para corregir su contacto:",
        error.code,
        error.message
      );
      return { estado: "error" };
    }

    if (!data?.anfitrion_id) return { estado: "sin-destinatario" };

    const resultado = await corregirContactoDeOtroAnfitrion(data.anfitrion_id, valor, cliente);

    /*
     * El escritor no puede devolver `sin-sesion` —recibe el destinatario, no lo
     * deduce de una sesión—, pero su tipo lo admite. Si algún día apareciera, es un
     * defecto del programa y no una sesión que falta: se trata como `error`, que es
     * lo que de verdad significa.
     */
    if (resultado.estado === "sin-sesion") return { estado: "error" };

    return resultado;
  } catch (error) {
    console.error("Fallo de conexión resolviendo el propietario a corregir:", error);
    return { estado: "error" };
  }
}
