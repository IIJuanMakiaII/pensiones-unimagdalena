"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { revalidarCatalogo } from "@/lib/revalidar-catalogo";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { esMaestroConCliente } from "@/lib/maestro";
import { confirmacionDeBorradoValida } from "@/lib/borrado";
import {
  leerCamposDePension,
  mensajeDeErrorDeBase,
  reconciliarHabitaciones,
  type EstadoFormulario,
} from "@/lib/pension-escritura";

/**
 * Acciones del perfil maestro (tarea #34).
 *
 * POR QUÉ ESTAS ACCIONES NO REUTILIZAN LAS DEL ANFITRIÓN
 * -----------------------------------------------------
 * Las cuatro escrituras del anfitrión llevan su predicado de propiedad
 * (`.eq("anfitrion_id", user.id)`) y ese predicado **no se toca**: es el hallazgo
 * A-3 de la tarea #16 y es lo que garantiza que un anfitrión no pueda escribir
 * sobre el anuncio de otro aunque una política de la base se relajara algún día.
 *
 * Añadirle un «o si es maestro» habría metido las dos autorizaciones en la misma
 * consulta, y a partir de ahí cualquier revisión futura tendría que razonar sobre
 * las dos a la vez. En su lugar, el camino del maestro es **explícito y separado**:
 * aquí no se escribe ni una vez `anfitrion_id`, y la autorización se resuelve con
 * una única pregunta a la base —`es_maestro()`— antes de tocar nada.
 *
 * Lo que sí se comparte es todo lo que no decide permisos
 * (`lib/pension-escritura.ts`): validaciones, parseo del formulario y
 * reconciliación de habitaciones. Son las mismas reglas para los dos caminos,
 * porque el anuncio es el mismo.
 *
 * TRES CAPAS EN CADA ESCRITURA, POR ESTE ORDEN
 * -------------------------------------------
 *  1. `es_maestro()`: se pregunta a la base, que es quien sabe. Nunca a los
 *     metadatos del usuario —`user_metadata` lo escribe el propio usuario, así que
 *     leer el rol de ahí sería un agujero de escalada—. Falla cerrado.
 *  2. La consulta de escritura, con su predicado estructural (el `id` del anuncio
 *     y, en las habitaciones, también su `pension_id`).
 *  3. La comprobación de la **fila devuelta**: si no se modificó exactamente lo
 *     esperado, se informa del error. Nunca se responde «ok» sin un cambio real.
 *
 * La RLS de la base sigue siendo la última palabra en las tres.
 *
 * NOTA DELIBERADA SOBRE EL CORREO CONFIRMADO
 * ------------------------------------------
 * Las acciones del anfitrión exigen `email_confirmed_at` (Oleada 0, anti-abuso:
 * un catálogo público e indexable no debe poblarse desde cuentas sin verificar).
 * Aquí **no** se exige, y no es un descuido: el perfil maestro no se obtiene
 * registrándose, se concede por SQL sobre una cuenta concreta. Añadir esa puerta
 * no protegería de nada —el rol ya es la credencial— y sí podría dejar fuera al
 * único administrador por un detalle de su cuenta.
 */

/** Mensaje único de rechazo: no distingue «no eres maestro» de «no se pudo comprobar». */
const NO_ES_MAESTRO =
  "Esta sección es solo para el perfil maestro. Si crees que deberías tener acceso, revisa con qué cuenta iniciaste sesión.";

const SIN_SESION =
  "Tu sesión expiró. Inicia sesión de nuevo para administrar las publicaciones.";

/**
 * Comprueba la sesión y el perfil maestro con el cliente ya creado.
 *
 * Se devuelve el cliente para no crear dos: quien llama necesita el mismo con la
 * cookie de la petición, y crear otro para preguntar por el rol sería abrir una
 * segunda conexión con la misma sesión.
 */
async function exigirMaestro(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof crearClienteServidor>> }
  | { ok: false; estado: EstadoFormulario }
> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, estado: { ok: false, mensaje: SIN_SESION } };

  if (!(await esMaestroConCliente(supabase))) {
    return { ok: false, estado: { ok: false, mensaje: NO_ES_MAESTRO } };
  }

  return { ok: true, supabase };
}

/**
 * Descarta la caché del panel además de la del catálogo.
 *
 * `/maestro` es `force-dynamic`, así que no guarda HTML; lo que sí queda en la
 * caché del router del navegador es la vista que acaba de pedir el cambio. Sin
 * esto, la lista seguiría mostrando el estado anterior hasta navegar a otro lado.
 */
function revalidarPanelMaestro(): void {
  revalidatePath("/maestro", "page");
  revalidatePath("/maestro/[id]/editar", "page");
}

/**
 * Server Action: marca una habitación como libre u ocupada, sea de quien sea.
 *
 * El `pensionId` que llega en el formulario no autoriza nada: se usa como
 * predicado estructural de la escritura (`id` de la habitación **y** su pensión),
 * de modo que un `habitacionId` ajeno no puede colarse cambiando solo el
 * identificador. Quien autoriza es el perfil maestro.
 */
export async function cambiarDisponibilidadMaestro(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!esSupabaseConfigurado()) {
    return {
      ok: false,
      mensaje:
        "El modo dinámico no está activo: agrega las credenciales de Supabase en .env.local (ver docs/integracion-supabase.md).",
    };
  }

  const habitacionId = String(formData.get("habitacionId") ?? "").trim();
  const pensionId = String(formData.get("pensionId") ?? "").trim();
  const disponible = String(formData.get("disponible") ?? "") === "1";

  if (!habitacionId || !pensionId) {
    return {
      ok: false,
      mensaje:
        "No pudimos identificar la habitación. Recarga el panel e inténtalo de nuevo.",
    };
  }

  const guardia = await exigirMaestro();
  if (!guardia.ok) return guardia.estado;

  const { data, error } = await guardia.supabase
    .from("habitaciones")
    .update({ disponible })
    .eq("id", habitacionId)
    .eq("pension_id", pensionId)
    .select("id");

  if (error) {
    console.error("Error cambiando la disponibilidad desde el panel maestro:", error.message);
    return { ok: false, mensaje: mensajeDeErrorDeBase(error) };
  }

  if ((data ?? []).length !== 1) {
    return {
      ok: false,
      mensaje:
        "No se cambió nada: esa habitación no existe o no pertenece al anuncio indicado.",
    };
  }

  revalidarCatalogo();
  revalidarPanelMaestro();

  return {
    ok: true,
    mensaje: disponible
      ? "Habitación marcada como libre: el catálogo la vuelve a ofrecer."
      : "Habitación marcada como ocupada: deja de ofrecerse en el catálogo.",
  };
}

/**
 * Server Action: retira o vuelve a publicar cualquier anuncio.
 *
 * La escritura va sin predicado de propiedad porque aquí no hay dueño que
 * respetar: el perfil maestro administra todo el catálogo. Lo que sí se conserva
 * es la comprobación de la fila devuelta —un `id` inventado tiene que devolver
 * cero filas y convertirse en un error, no en un éxito silencioso—.
 */
export async function cambiarEstadoPublicacionMaestro(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!esSupabaseConfigurado()) {
    return {
      ok: false,
      mensaje:
        "El modo dinámico no está activo: agrega las credenciales de Supabase en .env.local (ver docs/integracion-supabase.md).",
    };
  }

  const pensionId = String(formData.get("pensionId") ?? "").trim();
  const activa = String(formData.get("activa") ?? "") === "1";

  if (!pensionId) {
    return {
      ok: false,
      mensaje: "No pudimos identificar la publicación. Recarga el panel e inténtalo de nuevo.",
    };
  }

  const guardia = await exigirMaestro();
  if (!guardia.ok) return guardia.estado;

  const { data, error } = await guardia.supabase
    .from("pensiones")
    .update({ activa })
    .eq("id", pensionId)
    .select("id");

  if (error) {
    console.error("Error cambiando el estado desde el panel maestro:", error.message);
    return { ok: false, mensaje: mensajeDeErrorDeBase(error) };
  }

  if ((data ?? []).length !== 1) {
    return {
      ok: false,
      mensaje: "No se cambió nada: esa publicación no existe.",
    };
  }

  revalidarCatalogo();
  revalidarPanelMaestro();

  return {
    ok: true,
    mensaje: activa
      ? "Publicación reactivada: ya aparece de nuevo en el catálogo."
      : "Publicación retirada: deja de aparecer en el catálogo y su ficha no es accesible al público.",
  };
}

/**
 * Server Action: guarda los cambios de contenido de cualquier anuncio, retirado
 * incluido.
 *
 * Las reglas de validación son las mismas que aplica el anfitrión porque están en
 * un solo sitio (`lib/pension-escritura.ts`): un anuncio se valida igual lo edite
 * quien lo edite.
 *
 * Las columnas que se escriben son **solo** las nueve de contenido. `precio_mensual`
 * no está en la lista y no puede estarlo: es un valor derivado que la base calcula
 * desde la habitación disponible más barata, y el precio de verdad se cambia
 * cambiando las habitaciones (abajo). Escribirlo a mano dejaría la tarjeta del
 * catálogo, el filtro de precio y la ficha diciendo cosas distintas.
 */
export async function actualizarPensionMaestro(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!esSupabaseConfigurado()) {
    return {
      ok: false,
      mensaje:
        "El modo dinámico no está activo: agrega las credenciales de Supabase en .env.local (ver docs/integracion-supabase.md).",
    };
  }

  const pensionId = String(formData.get("pensionId") ?? "").trim();

  if (!pensionId) {
    return {
      ok: false,
      mensaje:
        "No pudimos identificar el anuncio que quieres editar. Vuelve al panel e inténtalo de nuevo.",
    };
  }

  const guardia = await exigirMaestro();
  if (!guardia.ok) return guardia.estado;

  const { campos, errores } = leerCamposDePension(formData);

  if (errores.length > 0) {
    return { ok: false, mensaje: errores.join(" ") };
  }

  const {
    titulo,
    descripcion,
    direccion,
    barrio,
    distanciaValida,
    servicios,
    normas,
    imagenes,
    habitaciones,
  } = campos;

  // Sin predicado de propiedad (es el maestro), pero con la fila devuelta como
  // comprobación: si el anuncio no existe, esto tiene que fallar en voz alta.
  const { data: actualizadas, error: errorPension } = await guardia.supabase
    .from("pensiones")
    .update({
      titulo,
      descripcion,
      direccion,
      barrio,
      distancia_a_pie_minutos: distanciaValida,
      servicios,
      normas,
      imagenes,
    })
    .eq("id", pensionId)
    .select("id");

  if (errorPension) {
    console.error(
      "Error actualizando la pensión desde el panel maestro:",
      errorPension.code,
      errorPension.message
    );
    return { ok: false, mensaje: mensajeDeErrorDeBase(errorPension) };
  }

  if ((actualizadas ?? []).length !== 1) {
    return {
      ok: false,
      mensaje: "No se guardó ningún cambio: esa publicación no existe.",
    };
  }

  // Habitaciones con las mismas reglas que el anfitrión: actualizar las que
  // llegan con `id`, insertar las nuevas y quitar solo las eliminadas. Es donde
  // vive el precio, así que la base recalcula el de la pensión con su disparador.
  const reconciliacion = await reconciliarHabitaciones(
    guardia.supabase,
    pensionId,
    habitaciones
  );

  if (!reconciliacion.ok) {
    return { ok: false, mensaje: reconciliacion.mensaje };
  }

  revalidarCatalogo();
  revalidarPanelMaestro();
  redirect("/maestro?editada=1");
}

/**
 * Server Action: borra un anuncio definitivamente.
 *
 * LO QUE ESTA ACCIÓN EXIGE ANTES DE BORRAR
 * ----------------------------------------
 *  1. Perfil maestro comprobado contra la base.
 *  2. La palabra de confirmación escrita a mano en el formulario
 *     (`PALABRA_DE_BORRADO`, «BORRAR»). La pantalla que nombra el anuncio y
 *     explica qué se pierde vive en el cliente y por eso **no basta**: cualquiera
 *     puede enviar el formulario sin pasar por ella. Esta palabra es la parte que
 *     el servidor sí puede exigir.
 *  3. El borrado en sí va por la función `borrar_pension(uuid)` y no por un
 *     `delete` desde aquí. Esa función es la que conserva el disparador de la
 *     Oleada 7 —que reserva el slug en `slugs_reservados`, de modo que la
 *     dirección queda muerta y no se recicla— y la que borra primero las
 *     habitaciones para no dejar huérfanas. Repetir ese orden a mano en la
 *     aplicación sería la forma más fácil de dejar la mitad hecha.
 *
 * La función lanza excepción si no afecta exactamente una fila, así que «borrado»
 * aquí significa que la base borró algo: no hay éxito optimista posible.
 *
 * LO QUE ESTA ACCIÓN **NO** HACE: borrar las fotos de Storage. Quedan huérfanas y
 * el aviso de la interfaz lo dice con esas palabras. Limpiarlas queda fuera del
 * alcance de esta tarea.
 */
export async function borrarPensionMaestro(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!esSupabaseConfigurado()) {
    return {
      ok: false,
      mensaje:
        "El modo dinámico no está activo: agrega las credenciales de Supabase en .env.local (ver docs/integracion-supabase.md).",
    };
  }

  const pensionId = String(formData.get("pensionId") ?? "").trim();
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (!pensionId) {
    return {
      ok: false,
      mensaje: "No pudimos identificar la publicación. Recarga el panel e inténtalo de nuevo.",
    };
  }

  if (!confirmacionDeBorradoValida(confirmacion)) {
    return {
      ok: false,
      mensaje:
        "Para borrar hay que escribir la palabra de confirmación. No se borró nada.",
    };
  }

  const guardia = await exigirMaestro();
  if (!guardia.ok) return guardia.estado;

  const { data: slug, error } = await guardia.supabase.rpc("borrar_pension", {
    p_pension_id: pensionId,
  });

  if (error) {
    console.error("Error borrando la publicación:", error.code, error.message);

    if (error.code === "P0002") {
      return {
        ok: false,
        mensaje: "Esa publicación ya no existe: puede que la haya borrado alguien más.",
      };
    }

    if (error.code === "42501") {
      return { ok: false, mensaje: NO_ES_MAESTRO };
    }

    return {
      ok: false,
      mensaje:
        "No pudimos borrar la publicación. Vuelve a intentarlo en unos segundos; si el problema sigue, avísanos.",
    };
  }

  // La función devuelve la dirección que acaba de morir. Si llegara vacía, el
  // borrado no se completó como se espera y conviene decirlo en lugar de cantar
  // una victoria que no se puede comprobar.
  const direccion = typeof slug === "string" && slug.trim() ? slug.trim() : null;

  if (!direccion) {
    console.error("El borrado no devolvió la dirección de la publicación:", slug);
    return {
      ok: false,
      mensaje:
        "La publicación pudo haberse borrado, pero no pudimos confirmarlo. Recarga el panel y comprueba la lista antes de repetir la operación.",
    };
  }

  revalidarCatalogo();
  revalidarPanelMaestro();

  /*
   * Se redirige en lugar de devolver el éxito en el estado del formulario, y no
   * es un capricho: la tarjeta que contiene ese formulario **deja de existir** en
   * cuanto la lista se vuelve a pintar, así que un mensaje devuelto ahí se
   * desmontaría con ella y el maestro no vería confirmación ninguna. En la
   * dirección viaja el slug para poder nombrar lo que acaba de morir: el aviso de
   * que la dirección no se recicla y de que las fotos siguen en el almacenamiento
   * se muestra en el panel, que es donde sobrevive a la recarga.
   */
  redirect(`/maestro?borrada=${encodeURIComponent(direccion)}`);
}
