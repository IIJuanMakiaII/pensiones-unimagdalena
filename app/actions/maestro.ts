"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { revalidarCatalogo } from "@/lib/revalidar-catalogo";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { esMaestroConCliente } from "@/lib/maestro";
import { confirmacionDeBorradoValida } from "@/lib/borrado";
import { CAMPO_WHATSAPP } from "@/lib/formulario-pension";
import { corregirWhatsappDelAnuncio } from "@/lib/contacto-del-anuncio";
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
 * Server Action: marca una habitación como libre o reservada, sea de quien sea.
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
      : "Habitación marcada como reservada: deja de ofrecerse en el catálogo.",
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
 * Server Action: concede o retira el sello «Verificado por Nido ✓».
 *
 * POR QUÉ ESTA ACCIÓN LLAMA A UNA FUNCIÓN DE LA BASE Y NO HACE UN `update`
 * -----------------------------------------------------------------------
 * Porque no puede: `verificado` **no está** entre las columnas que
 * `authenticated` tiene permiso de escribir. La lista se revocó y se volvió a
 * conceder por columna (oleada-10, reafirmada en la oleada 11 y otra vez en la
 * 13), y esa lista deja fuera, a propósito, `verificado`, `calificacion`,
 * `precio_mensual`, `anfitrion_id`, `id` y `creada_en`. Un `update` desde aquí
 * fallaría con `42501` aunque quien lo enviara fuera el maestro.
 *
 * La puerta que sí existe es `maestro_actualizar_campos_pension(uuid, jsonb)`,
 * `SECURITY DEFINER` y concedida a `authenticated`: comprueba `es_maestro()` por
 * dentro y admite **solo** `calificacion`, `verificado`, `latitud` y `longitud`.
 * Es decir, la base ya tenía la cerradura montada y lo que faltaba era la
 * manija. Esta acción es la manija: no añade permisos, usa los que ya había.
 *
 * LA FECHA NO SE ENVÍA, Y NO SE PUEDE ENVIAR
 * ------------------------------------------
 * `verificado_en` lo escribe el disparador `antes_de_sellar_verificacion` en la
 * transición de falso a verdadero, y borra la fecha si el sello se retira. Aquí
 * solo viaja el booleano. Si algún día se quisiera declarar la fecha de la
 * inspección —distinta de la de registro—, la función la rechazaría con `22023`:
 * habría que abrir esa llave primero, y es una decisión de producto que sigue
 * tomada en su valor por defecto (ver `supabase/oleada-13-fecha-verificacion.sql`).
 *
 * LO QUE ESTA ACCIÓN NO TOCA
 * --------------------------
 * Ni el precio (derivado de las habitaciones), ni la identidad del anunciante,
 * ni los datos privados. La lista blanca de la función lo impide en la base, no
 * el hecho de que aquí no se envíen.
 */
export async function sellarVerificacionMaestro(
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
  const verificado = String(formData.get("verificado") ?? "") === "1";

  if (!pensionId) {
    return {
      ok: false,
      mensaje: "No pudimos identificar la publicación. Recarga el panel e inténtalo de nuevo.",
    };
  }

  const guardia = await exigirMaestro();
  if (!guardia.ok) return guardia.estado;

  const { data, error } = await guardia.supabase.rpc("maestro_actualizar_campos_pension", {
    p_pension_id: pensionId,
    p_cambios: { verificado },
  });

  if (error) {
    console.error("Error cambiando el sello de verificación:", error.code, error.message);

    if (error.code === "42501") {
      return { ok: false, mensaje: NO_ES_MAESTRO };
    }

    if (error.code === "P0002") {
      return {
        ok: false,
        mensaje: "Esa publicación ya no existe: puede que la haya borrado alguien más.",
      };
    }

    return {
      ok: false,
      mensaje:
        "No pudimos cambiar el sello. Vuelve a intentarlo en unos segundos; si el problema sigue, avísanos.",
    };
  }

  // El mismo criterio que el resto del panel: la función devuelve el `id` que
  // modificó, así que un éxito sin identificador no es un éxito comprobable.
  if (!data) {
    console.error("La función del sello no devolvió la publicación modificada:", data);
    return {
      ok: false,
      mensaje:
        "No pudimos confirmar el cambio del sello. Recarga el panel y comprueba el estado antes de repetir la operación.",
    };
  }

  revalidarCatalogo();
  revalidarPanelMaestro();

  return {
    ok: true,
    mensaje: verificado
      ? "Sello concedido: la ficha y la tarjeta del catálogo lo muestran ya, con la fecha de hoy."
      : "Sello retirado: el anuncio vuelve a aparecer sin la insignia, y su fecha de verificación se borró.",
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

/**
 * Server Action: corrige el WhatsApp privado del anfitrión (tarea #80).
 *
 * PARA QUÉ SIRVE, EN UNA FRASE
 * ---------------------------
 * Para cuando el anfitrión llama al equipo y dice «cambié de número». Hasta ahora
 * la única forma de actualizarlo era que él volviera a entrar a su formulario; si
 * había perdido el acceso o simplemente no lo hacía, el equipo se quedaba con un
 * número muerto y sin manera de arreglarlo.
 *
 * LA DECISIÓN QUE SOSTIENE TODO ESTO: EL DESTINATARIO NO SE RECIBE
 * --------------------------------------------------------------
 * El formulario manda **qué anuncio** se está corrigiendo (`pensionId`), y **no hay
 * ningún campo del formulario que diga a quién se le escribe el número.** El
 * destinatario lo resuelve `lib/contacto-del-anuncio.ts` a partir de ese anuncio.
 *
 * Es la diferencia entre corregir y falsificar. Si el id del propietario viajara en
 * el formulario, cualquiera con el perfil maestro podría mandar el id de un
 * anfitrión cualquiera —o el suyo— y escribirle el número a quien quisiera: la RLS
 * lo aceptaría, porque la política concede al maestro cualquier fila. El daño no
 * sería leer un número ajeno, sería **cambiárselo a alguien**, que es peor porque
 * el anfitrión no se enteraría hasta que un estudiante no lo encontrara.
 *
 * No es una precaución teórica: es la forma exacta en que este proyecto ya cerró
 * dos agujeros (el predicado de propiedad de la #16 y la identidad de sesión de
 * `guardarContactoDelAnfitrion`).
 *
 * ESTE ARCHIVO NO NOMBRA A LOS PROPIETARIOS, Y HAY UNA GUARDA QUE LO VIGILA
 * -----------------------------------------------------------------------
 * La consulta que traduce anuncio a propietario **no está aquí** y no debe estarlo:
 * `pruebas/panel-maestro.prueba.ts` exige que la superficie del maestro no nombre
 * jamás la columna del propietario, porque el maestro administra por `id` y copiar
 * el predicado del anfitrión dejaría dos autorizaciones que pueden desincronizarse.
 * La primera versión de esta acción hacía la consulta aquí y la guarda la paró, con
 * razón. Por eso esto llama a una función cuyo nombre dice lo que hace —«corrige el
 * WhatsApp del anuncio»— en vez de hablar de dueños.
 *
 * EL DEFECTO DE ESTA ACCIÓN NO ES EL MISMO QUE EL DE `actualizarPensionMaestro`
 * ---------------------------------------------------------------------------
 * Aquella **no lee** el número a propósito, porque un campo vacío que viaja de
 * vuelta borra el del anfitrión sin que nadie lo pida. Esta hace justo lo
 * contrario y **solo** lee ese campo: es su único trabajo. Son dos acciones
 * distintas precisamente para que cada una pueda tener un defecto seguro
 * diferente, en vez de una sola acción que a veces sí y a veces no.
 *
 * Un valor inválido se rechaza **antes** de consultar la base: la restricción de
 * la tabla respondería `23514` sin decirle a nadie qué escribir. Y el número no se
 * registra en ningún `console.error`, igual que en el resto del módulo.
 */
export async function corregirWhatsappDelAnfitrion(
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
  const valor = String(formData.get(CAMPO_WHATSAPP) ?? "").trim();

  if (!pensionId) {
    return {
      ok: false,
      mensaje: "No pudimos identificar la publicación. Recarga el panel e inténtalo de nuevo.",
    };
  }

  const guardia = await exigirMaestro();
  if (!guardia.ok) return guardia.estado;

  const resultado = await corregirWhatsappDelAnuncio(pensionId, valor, guardia.supabase);

  if (resultado.estado === "invalido") {
    return {
      ok: false,
      mensaje:
        "Ese número no tiene el formato: 10 dígitos que empiezan por 3, o fijo con indicativo (605…). No se cambió nada.",
    };
  }

  if (resultado.estado === "sin-destinatario") {
    return {
      ok: false,
      mensaje: "No pudimos identificar al anfitrión de esa publicación, así que no se cambió nada.",
    };
  }

  if (resultado.estado === "sin-tabla") {
    return {
      ok: false,
      mensaje:
        "El contacto privado todavía no está disponible en esta instalación, así que no se guardó.",
    };
  }

  if (resultado.estado === "error") {
    return {
      ok: false,
      mensaje:
        "No pudimos guardar el número. Vuelve a intentarlo en unos segundos; si sigue fallando, no se ha cambiado nada.",
    };
  }

  revalidarPanelMaestro();

  return {
    ok: true,
    mensaje:
      "Número actualizado. El botón «Escribir al anfitrión» ya escribe al número nuevo.",
  };
}
