"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import {
  clasificarFalloDeGuardado,
  limpiarLinea,
  validarSolicitudContacto,
} from "@/lib/contacto-respaldo";
import { RUTA_CONTACTO } from "@/lib/formato";

/**
 * Server Action del formulario de respaldo (tarea #59).
 *
 * POR QUÉ `redirect` Y NO UN ESTADO DEVUELTO
 * ------------------------------------------
 * El formulario tiene que funcionar **sin JavaScript**. Un estado que viaja de
 * vuelta al componente necesita React en el navegador; una redirección no: el
 * navegador manda un `POST` normal, el servidor responde `303` y la página se
 * vuelve a pintar con el resultado. Es el único camino que no depende de que el
 * script cargue, y el respaldo del canal de contacto no puede ser lo único del
 * sitio que se rompe cuando el JavaScript falla.
 *
 * POR QUÉ NO SE DEVUELVE EL ERROR DE LA BASE AL VISITANTE
 * ------------------------------------------------------
 * Un fallo de guardado no es culpa de quien rellena el formulario, y el detalle
 * técnico no le sirve para nada. Se registra en el servidor y a la persona se le
 * dice qué puede hacer mientras tanto. El motivo sí distingue el caso de la
 * migración sin aplicar, que es el único que se puede corregir en un minuto y el
 * único que conviene que no se confunda con un fallo de verdad.
 */
export async function enviarContactoRespaldo(formData: FormData): Promise<void> {
  const volverA = (parametros: Record<string, string>) =>
    `${RUTA_CONTACTO}?${new URLSearchParams(parametros).toString()}`;

  // Anuncio desde el que se llegó, para devolver a la persona a lo que miraba.
  const slug = limpiarLinea(formData.get("pension"));
  const conAnuncio: Record<string, string> = slug === "" ? {} : { pension: slug };

  /**
   * Trampa para robots: un campo que existe en el formulario pero que no se ve.
   * Ninguna persona puede rellenarlo —está fuera de pantalla y fuera del orden de
   * tabulación—, así que si viene con algo, quien envió no es una persona.
   *
   * Se responde **como si hubiera ido bien**, a propósito: decirle «te detecté»
   * solo enseña a esquivarlo la próxima vez. No se guarda nada.
   */
  if (limpiarLinea(formData.get("empresa")) !== "") {
    redirect(volverA({ enviado: "1" }));
  }

  const validacion = validarSolicitudContacto({
    nombre: formData.get("nombre"),
    contacto: formData.get("contacto"),
    mensaje: formData.get("mensaje"),
    // Una casilla marcada viaja como "on". Cualquier otra cosa no es un sí.
    consentimiento: formData.get("consentimiento") === "on",
  });

  if (!validacion.valido) {
    redirect(volverA({ error: "validacion", ...conAnuncio }));
  }

  if (!esSupabaseConfigurado()) {
    redirect(volverA({ error: "sin_base", ...conAnuncio }));
  }

  const supabase = await crearClienteServidor();
  /**
   * La escritura va **por la función, no por la tabla** (tarea #63).
   *
   * `contactos_respaldo` tiene RLS activo y cero privilegios para `anon`: un
   * `insert` directo responde `42501 permission denied` y no guarda nada. La
   * única puerta que la migración abre es `registrar_contacto_respaldo`, que
   * valida por dentro y escribe con los permisos de su dueño. Es la misma figura
   * que `crear_pension_con_habitaciones`: el cliente público nunca toca la tabla,
   * y por eso no hace falta ninguna clave de servicio ni credencial nueva.
   *
   * El `origen` no se envía a propósito: la columna tiene
   * `default 'formulario_respaldo'` y la función no lo acepta. Mandarlo sería
   * dejar que el llamante elija cómo se clasifica su propio contacto.
   */
  const { error } = await supabase.rpc("registrar_contacto_respaldo", {
    p_nombre: validacion.datos.nombre,
    p_contacto: validacion.datos.contacto,
    p_mensaje: validacion.datos.mensaje === "" ? null : validacion.datos.mensaje,
    p_pension_slug: slug === "" ? null : slug,
  });

  if (error) {
    console.error("No se pudo guardar un contacto de respaldo:", error);
    /**
     * Un fallo que significa «a este despliegue le falta la migración» se separa
     * de un fallo de guardado de verdad. Es el único caso en el que quien
     * despliega tiene algo que hacer, y confundirlo con una avería manda a
     * buscar el problema donde no está. El código concreto queda en el registro
     * del servidor; al visitante no le llega ninguno.
     */
    redirect(volverA({ error: clasificarFalloDeGuardado(error.code), ...conAnuncio }));
  }

  redirect(volverA({ enviado: "1" }));
}
