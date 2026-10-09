"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { revalidarCatalogo } from "@/lib/revalidar-catalogo";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import {
  leerCamposDePension,
  mensajeDeErrorDeBase,
  reconciliarHabitaciones,
  type EstadoFormulario,
} from "@/lib/pension-escritura";

// Nota: en un módulo "use server" solo deben exportarse funciones asíncronas.
// El estado inicial del formulario vive en el componente de cliente (antes se
// exportaba desde aquí y llegaba al navegador como referencia de servidor).
//
// `EstadoFormulario` se importa como tipo desde `lib/pension-escritura.ts` desde
// la tarea #34: hay dos módulos de acciones —este y el del maestro— y los dos
// formularios hablan del mismo estado. Tenerlo declarado dos veces era la vía
// silenciosa a que uno cambiara y el otro no.

/**
 * Anti-abuso (Oleada 0): techo de publicaciones por cuenta en 24 horas.
 *
 * Es lo único que queda aquí de la validación del anuncio. Los límites, el parseo
 * del formulario y la reconciliación de habitaciones viven desde la tarea #34 en
 * `lib/pension-escritura.ts`, porque el panel del maestro escribe los mismos
 * campos: con una copia en cada sitio, el día que se corrija un límite solo se
 * corrige en uno.
 *
 * Ninguna de esas reglas decide permisos: la autorización se resuelve en cada
 * acción, con la sesión por delante.
 */
const MAX_PUBLICACIONES_24H = 5;

/**
 * Server Action: publica una pensión a nombre del anfitrión autenticado.
 *
 * Seguridad: la identidad SIEMPRE sale de la sesión del servidor
 * (`supabase.auth.getUser()`), nunca de un campo del formulario; así nadie
 * puede publicar a nombre de otro anfitrión.
 */
export async function crearPension(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!esSupabaseConfigurado()) {
    return {
      ok: false,
      mensaje:
        "El modo dinámico aún no está activo: agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (ver docs/integracion-supabase.md).",
    };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, mensaje: "Tu sesión expiró. Inicia sesión de nuevo para publicar." };
  }

  // Oleada 0 · abuso: solo las cuentas con correo confirmado publican en un
  // catálogo público y que además se indexa en buscadores.
  if (!user.email_confirmed_at) {
    return {
      ok: false,
      mensaje:
        "Confirma tu correo electrónico para publicar y gestionar tus anuncios. Revisa el enlace que te enviamos al registrarte (si no lo ves, mira la carpeta de spam).",
    };
  }

  // Oleada 0 · abuso: techo de publicaciones por cuenta y ventana de 24 horas.
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: publicacionesRecientes, error: errorConteo } = await supabase
    .from("pensiones")
    .select("id", { count: "exact", head: true })
    .eq("anfitrion_id", user.id)
    .gte("creada_en", desde24h);

  if (!errorConteo && (publicacionesRecientes ?? 0) >= MAX_PUBLICACIONES_24H) {
    return {
      ok: false,
      mensaje: `Alcanzaste el límite de ${MAX_PUBLICACIONES_24H} publicaciones en 24 horas. Escríbenos si necesitas publicar más alojamientos.`,
    };
  }

  /*
   * Las mismas reglas que la edición (`lib/pension-escritura.ts`): un anuncio se
   * valida igual cuando nace y cuando se corrige, y esa única copia es la que
   * impide que el alta y la edición se separen con el tiempo.
   *
   * Aquí se leía además el WhatsApp del anfitrión y su casilla de autorización.
   * Desde el cambio de modelo del 2026-10-02 no se piden: el contacto y la
   * reserva del primer mes los maneja la plataforma (ver `lib/formato.ts`).
   */
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

  // Pensión + habitaciones en UNA transacción (RPC `crear_pension_con_habitaciones`):
  // si algo falla no queda un anuncio a medias. El precio lo fija la base de datos
  // a partir de la habitación disponible más barata, de modo que la tarjeta, el
  // filtro de precio y el mensaje de WhatsApp siempre dicen lo mismo.
  const { error } = await supabase.rpc("crear_pension_con_habitaciones", {
    p_pension: {
      titulo,
      descripcion,
      direccion,
      barrio,
      distancia_a_pie_minutos: distanciaValida,
      servicios,
      normas,
      imagenes,
      activa: true,
    },
    p_habitaciones: habitaciones,
  });

  if (error) {
    console.error("Error creando la pensión:", error.message);
    // Las validaciones de negocio de la función se lanzan como excepciones de
    // plpgsql (P0001) con un mensaje ya redactado para el anfitrión.
    const esMensajeDeNegocio = error.code === "P0001";
    return {
      ok: false,
      mensaje: esMensajeDeNegocio
        ? error.message
        : "No pudimos guardar la publicación. Verifica que las tablas, las políticas y la función crear_pension_con_habitaciones estén creadas (supabase/oleada-1.sql).",
    };
  }

  // Descarta la caché del catálogo: la pensión nueva se ve sin esperar los 60 s.
  revalidarCatalogo();
  redirect("/publicar?creada=1");
}

/**
 * Server Action: marca una habitación como libre u ocupada.
 *
 * Autorización en dos capas, porque ocultar el botón no protege nada:
 *  1. La identidad sale de la sesión (`supabase.auth.getUser()`), nunca del
 *     formulario: el `habitacionId` que llega es solo un dato a validar.
 *  2. La escritura va filtrada por la RLS de la base (solo el anfitrión dueño
 *     de la pensión puede tocar sus habitaciones) y **se comprueba la fila
 *     devuelta**: si no se modificó ninguna, se informa del error en lugar de
 *     devolver un éxito que no ocurrió.
 */
export async function cambiarDisponibilidadHabitacion(
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
  const disponible = String(formData.get("disponible") ?? "") === "1";

  if (!habitacionId) {
    return {
      ok: false,
      mensaje: "No pudimos identificar la habitación. Recarga la página e inténtalo de nuevo.",
    };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, mensaje: "Tu sesión expiró. Inicia sesión de nuevo para gestionar tus habitaciones." };
  }

  // A-4 · Mismo criterio que `crearPension`: solo las cuentas con correo
  // confirmado gestionan publicaciones en un catálogo público que además se
  // indexa. Antes esta puerta estaba menos vigilada que la de publicar.
  if (!user.email_confirmed_at) {
    return {
      ok: false,
      mensaje:
        "Confirma tu correo electrónico para publicar y gestionar tus anuncios. Revisa el enlace que te enviamos al registrarte (si no lo ves, mira la carpeta de spam).",
    };
  }

  /**
   * A-3 · La escritura lleva predicado de propiedad, no solo el `id`.
   *
   * `habitaciones` no tiene `anfitrion_id`: la pertenencia se resuelve por su
   * pensión. Así la autorización no depende de una única capa (la RLS): si una
   * política se relajara o se concediera un privilegio de más, esta consulta
   * seguiría sin tocar habitaciones ajenas. La comprobación de fila afectada se
   * mantiene intacta.
   */
  const { data: misPensiones, error: errorPensiones } = await supabase
    .from("pensiones")
    .select("id")
    .eq("anfitrion_id", user.id);

  if (errorPensiones) {
    console.error(
      "Error consultando las publicaciones del anfitrión:",
      errorPensiones.message
    );
    return {
      ok: false,
      mensaje: "No pudimos verificar tus publicaciones. Vuelve a intentarlo en unos segundos.",
    };
  }

  const misPensionesIds = (misPensiones ?? []).map((pension) => pension.id as string);

  if (misPensionesIds.length === 0) {
    // Sin publicaciones propias no hay nada que gestionar: se informa con el
    // mismo mensaje que cuando el predicado deja la escritura en 0 filas.
    return {
      ok: false,
      mensaje:
        "Esa habitación no pertenece a tus publicaciones, así que no se cambió nada. Si crees que es un error, revisa tu sesión.",
    };
  }

  const { data, error } = await supabase
    .from("habitaciones")
    .update({ disponible })
    .eq("id", habitacionId)
    .in("pension_id", misPensionesIds)
    .select("id, pension_id");

  if (error) {
    console.error("Error cambiando la disponibilidad de la habitación:", error.message);
    return {
      ok: false,
      mensaje: "No pudimos guardar el cambio. Vuelve a intentarlo en unos segundos.",
    };
  }

  const fila = (data ?? [])[0] as { id: string; pension_id: string } | undefined;

  if (!fila) {
    // Ninguna fila modificada: el predicado de propiedad y la RLS no dejaron
    // tocar esa habitación (no es de este anfitrión, o ya no existe). Nunca se
    // responde "ok" en este caso.
    return {
      ok: false,
      mensaje:
        "Esa habitación no pertenece a tus publicaciones, así que no se cambió nada. Si crees que es un error, revisa tu sesión.",
    };
  }

  revalidarCatalogo();

  return {
    ok: true,
    mensaje: disponible
      ? "Habitación marcada como libre: vuelve a ofrecerse en el catálogo."
      : "Habitación marcada como ocupada: ya no se ofrece ni se puede reservar por WhatsApp.",
  };
}

/**
 * Server Action: retira o vuelve a publicar un anuncio completo (`activa`).
 *
 * Mismo criterio que la acción anterior: identidad desde la sesión, escritura
 * filtrada por RLS y verificación de que se modificó una fila.
 */
export async function cambiarEstadoPublicacion(
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
      mensaje: "No pudimos identificar la publicación. Recarga la página e inténtalo de nuevo.",
    };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, mensaje: "Tu sesión expiró. Inicia sesión de nuevo para gestionar tus publicaciones." };
  }

  // A-4 · Mismo criterio y mensaje que `crearPension` (ver la acción anterior).
  if (!user.email_confirmed_at) {
    return {
      ok: false,
      mensaje:
        "Confirma tu correo electrónico para publicar y gestionar tus anuncios. Revisa el enlace que te enviamos al registrarte (si no lo ves, mira la carpeta de spam).",
    };
  }

  // A-3 · Predicado de propiedad en la escritura: además de la RLS, la consulta
  // exige que la publicación pertenezca al anfitrión autenticado. Se mantiene la
  // comprobación de fila afectada de más abajo.
  const { data, error } = await supabase
    .from("pensiones")
    .update({ activa })
    .eq("id", pensionId)
    .eq("anfitrion_id", user.id)
    .select("id");

  if (error) {
    console.error("Error cambiando el estado de la publicación:", error.message);
    return {
      ok: false,
      mensaje: "No pudimos guardar el cambio. Vuelve a intentarlo en unos segundos.",
    };
  }

  if ((data ?? []).length === 0) {
    return {
      ok: false,
      mensaje:
        "Esa publicación no es tuya, así que no se cambió nada. Inicia sesión con la cuenta que la creó.",
    };
  }

  revalidarCatalogo();

  return {
    ok: true,
    mensaje: activa
      ? "Publicación reactivada: ya aparece de nuevo en el catálogo."
      : "Publicación retirada: ya no aparece en el catálogo y su ficha no es accesible al público.",
  };
}

/**
 * Server Action: guarda los cambios de un anuncio ya publicado.
 *
 * Reutiliza las validaciones del alta y añade dos cosas propias de la edición:
 * la reconciliación de habitaciones (actualizar / insertar / quitar, sin perder
 * la disponibilidad de las que no se tocan) y los límites superiores que la
 * base impone (título 120 y descripción 2000, entre otros), que aquí se
 * comprueban antes para poder explicar el motivo.
 *
 * Autorización con el mismo rigor que las acciones del panel: identidad desde la
 * sesión, correo confirmado, predicado de propiedad en la escritura y
 * comprobación de la fila devuelta (nunca un éxito falso).
 */
export async function actualizarPension(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  if (!esSupabaseConfigurado()) {
    return {
      ok: false,
      mensaje:
        "El modo dinámico aún no está activo: agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (ver docs/integracion-supabase.md).",
    };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, mensaje: "Tu sesión expiró. Inicia sesión de nuevo para editar tu anuncio." };
  }

  if (!user.email_confirmed_at) {
    return {
      ok: false,
      mensaje:
        "Confirma tu correo electrónico para publicar y gestionar tus anuncios. Revisa el enlace que te enviamos al registrarte (si no lo ves, mira la carpeta de spam).",
    };
  }

  const texto = (clave: string) => String(formData.get(clave) ?? "").trim();
  const pensionId = texto("pensionId");

  if (!pensionId) {
    return {
      ok: false,
      mensaje: "No pudimos identificar el anuncio que quieres editar. Vuelve al panel e inténtalo de nuevo.",
    };
  }

  // Propiedad antes de escribir: un id ajeno o inventado no puede editar nada.
  const { data: propias, error: errorPropiedad } = await supabase
    .from("pensiones")
    // Se trae también la autorización registrada: sirve para no volver a pedirla
    // y para saber si este anuncio viene de antes de que existiera la casilla.
    .select("id")
    .eq("id", pensionId)
    .eq("anfitrion_id", user.id);

  if (errorPropiedad) {
    console.error("Error comprobando la propiedad del anuncio:", errorPropiedad.message);
    return {
      ok: false,
      mensaje: "No pudimos verificar el anuncio. Vuelve a intentarlo en unos segundos.",
    };
  }

  if (!propias || propias.length === 0) {
    return {
      ok: false,
      mensaje: "Ese anuncio no pertenece a tu cuenta, así que no se guardó ningún cambio.",
    };
  }

  /*
   * Aquí se leían la autorización previa y la casilla del formulario para publicar
   * el número del anfitrión. Ya no se piden: el contacto lo maneja la plataforma
   * (ver `lib/formato.ts`).
   */

  // Las reglas viven en `lib/pension-escritura.ts`: son las mismas que aplica el
  // alta y, desde la tarea #34, también el panel del maestro.
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

  // 1) El anuncio. Solo las columnas editables: `precio_mensual` lo impone la
  //    base desde las habitaciones y el sello la plataforma.
  const { data: actualizadas, error: errorPension } = await supabase
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
    .eq("anfitrion_id", user.id)
    .select("id");

  if (errorPension) {
    console.error("Error actualizando la pensión:", errorPension.code, errorPension.message);
    return { ok: false, mensaje: mensajeDeErrorDeBase(errorPension) };
  }

  if ((actualizadas ?? []).length === 0) {
    return {
      ok: false,
      mensaje: "No se guardó ningún cambio: el anuncio no existe o no pertenece a tu cuenta.",
    };
  }

  // 2) Habitaciones: la reconciliación vive en `lib/pension-escritura.ts` desde la
  //    tarea #34, porque el maestro edita las habitaciones de un anuncio ajeno con
  //    las mismas reglas (actualizar / insertar / quitar, sin perder la
  //    disponibilidad de las que no se tocan).
  const reconciliacion = await reconciliarHabitaciones(supabase, pensionId, habitaciones);

  if (!reconciliacion.ok) {
    return { ok: false, mensaje: reconciliacion.mensaje };
  }

  revalidarCatalogo();
  redirect("/publicar?editada=1");
}
