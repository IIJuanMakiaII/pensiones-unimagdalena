"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { ETIQUETA_PENSIONES } from "@/utils/supabase/publico";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { AYUDA_IMAGENES, hostImagenPermitido, MAXIMO_FOTOS } from "@/lib/imagenes";
import {
  MENSAJE_WHATSAPP_INVALIDO,
  formatearCOP,
  normalizarWhatsappPropio,
  whatsappPropioValido,
} from "@/lib/formato";
import type {
  EntradaHabitacion,
  EntradaHabitacionEditada,
  GeneroHabitacion,
  TipoHabitacion,
} from "@/types";

/** Estado que devuelve la acción al formulario (para mostrar errores en línea). */
export interface EstadoFormulario {
  ok: boolean;
  mensaje: string | null;
}

// Nota: en un módulo "use server" solo deben exportarse funciones asíncronas.
// El estado inicial del formulario vive en el componente de cliente (antes se
// exportaba desde aquí y llegaba al navegador como referencia de servidor).

const TITULO_MIN = 6;
const DESCRIPCION_MIN = 30;
const DIRECCION_MIN = 5;
/** Límites superiores vigentes en la base: se comprueban antes para poder explicar el motivo. */
const TITULO_MAX = 120;
const DESCRIPCION_MAX = 2000;
const PRECIO_MIN = 1000;
const PRECIO_MAX = 20000000;
const MAX_SERVICIOS = 12;
const MAX_NORMAS = 8;
const MAX_IMAGENES = MAXIMO_FOTOS;
/** Debe coincidir con el límite de `crear_pension_con_habitaciones` (supabase/oleada-1.sql). */
const MAX_HABITACIONES = 20;
/** Anti-abuso (Oleada 0): techo de publicaciones por cuenta en 24 horas. */
const MAX_PUBLICACIONES_24H = 5;

/** Uniones cerradas: el formulario envía texto libre y aquí se valida. */
const TIPOS_VALIDOS: readonly string[] = ["individual", "compartida", "matrimonial"];
const GENEROS_VALIDOS: readonly string[] = ["mixto", "femenino", "masculino"];

/**
 * Lee y valida las habitaciones que llegan en el campo oculto del formulario.
 *
 * Se valida habitación por habitación para poder decirle al anfitrión *qué*
 * corregir: la base de datos también las protege, pero ahí el error llegaría
 * sin contexto. La pensión ya no tiene un precio propio: se deriva de la
 * habitación disponible más barata (así la tarjeta y el filtro de precio nunca
 * se contradicen).
 */
function leerHabitaciones(crudo: string): {
  habitaciones: EntradaHabitacionEditada[];
  errores: string[];
} {
  const errores: string[] = [];

  let crudas: unknown;
  try {
    crudas = JSON.parse(crudo || "[]");
  } catch {
    return {
      habitaciones: [],
      errores: [
        "No pudimos leer las habitaciones del formulario. Recarga la página e inténtalo de nuevo.",
      ],
    };
  }

  if (!Array.isArray(crudas) || crudas.length === 0) {
    return {
      habitaciones: [],
      errores: [
        "Publica al menos una habitación: los estudiantes filtran por tipo, género y alimentación.",
      ],
    };
  }

  if (crudas.length > MAX_HABITACIONES) {
    return {
      habitaciones: [],
      errores: [`Puedes publicar hasta ${MAX_HABITACIONES} habitaciones en un mismo anuncio.`],
    };
  }

  const habitaciones: EntradaHabitacionEditada[] = [];

  crudas.forEach((cruda, indice) => {
    const numero = indice + 1;

    if (typeof cruda !== "object" || cruda === null) {
      errores.push(`Habitación ${numero}: los datos no son válidos.`);
      return;
    }

    const fila = cruda as Record<string, unknown>;
    const tipo = typeof fila.tipo === "string" ? fila.tipo : "";
    const genero = typeof fila.genero === "string" ? fila.genero : "";
    const precio = Number(fila.precio_mensual_cop);

    if (!TIPOS_VALIDOS.includes(tipo)) {
      errores.push(
        `Habitación ${numero}: elige un tipo válido (individual, compartida o matrimonial).`
      );
    }
    if (!GENEROS_VALIDOS.includes(genero)) {
      errores.push(
        `Habitación ${numero}: elige un género válido (mixto, solo mujeres o solo hombres).`
      );
    }
    if (!Number.isFinite(precio) || precio < PRECIO_MIN) {
      errores.push(
        `Habitación ${numero}: escribe el precio mensual (desde ${formatearCOP(PRECIO_MIN)}).`
      );
    } else if (precio > PRECIO_MAX) {
      errores.push(`Habitación ${numero}: el precio parece demasiado alto, revísalo.`);
    }

    habitaciones.push({
      // `id` solo llega al editar un anuncio publicado; en el alta va ausente.
      ...(typeof fila.id === "string" && fila.id ? { id: fila.id } : {}),
      tipo: tipo as TipoHabitacion,
      genero: genero as GeneroHabitacion,
      precio_mensual_cop: Math.round(precio),
      alimentacion_incluida: fila.alimentacion_incluida === true,
      disponible: fila.disponible !== false,
    });
  });

  return { habitaciones, errores };
}

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

  const supabase = crearClienteServidor();
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

  const texto = (clave: string) => String(formData.get(clave) ?? "").trim();

  const titulo = texto("titulo");
  const descripcion = texto("descripcion");
  const direccion = texto("direccion");
  const barrio = texto("barrio") || "Santa Marta";
  const distancia = Number(texto("distancia"));

  const servicios = formData
    .getAll("servicios")
    .map((valor) => String(valor).trim())
    .filter(Boolean)
    .slice(0, MAX_SERVICIOS);

  const normas = formData
    .getAll("normas")
    .map((valor) => String(valor).trim())
    .filter(Boolean)
    .slice(0, MAX_NORMAS);

  // Solo enlaces https y de hosts permitidos: el optimizador de imágenes de
  // Next no debe poder descargar URLs arbitrarias (ver lib/imagenes.ts).
  const imagenes = texto("imagenes")
    .split(/\s*\n\s*/)
    .map((url) => url.trim())
    .filter((url) => /^https:\/\/\S+$/i.test(url))
    .slice(0, MAX_IMAGENES);

  const imagenesNoPermitidas = imagenes.filter((url) => !hostImagenPermitido(url));

  /**
   * WhatsApp propio de la pensión, obligatorio al publicar: es la única forma de
   * que el estudiante llegue al dueño desde el primer día. Se guarda con 10
   * dígitos exactos (la restricción de la base los exige) y el código de país se
   * añade al construir el enlace.
   */
  const whatsapp = normalizarWhatsappPropio(texto("whatsapp"));

  const { habitaciones, errores: erroresHabitaciones } = leerHabitaciones(texto("habitaciones"));

  // Validación estricta antes de tocar la base de datos.
  const errores: string[] = [];
  if (titulo.length < TITULO_MIN) {
    errores.push(`El título necesita al menos ${TITULO_MIN} caracteres.`);
  }
  if (direccion.length < DIRECCION_MIN) {
    errores.push("La dirección es obligatoria (barrio, calle o carrera).");
  }
  if (descripcion.length < DESCRIPCION_MIN) {
    errores.push(`Describe el alojamiento en al menos ${DESCRIPCION_MIN} caracteres.`);
  }
  if (imagenesNoPermitidas.length > 0) {
    errores.push(
      `Estos enlaces de foto no están permitidos: ${imagenesNoPermitidas
        .slice(0, 3)
        .join(", ")}. ${AYUDA_IMAGENES}`
    );
  }
  if (!whatsappPropioValido(whatsapp)) {
    errores.push(`${MENSAJE_WHATSAPP_INVALIDO}.`);
  }
  errores.push(...erroresHabitaciones);

  if (errores.length > 0) {
    return { ok: false, mensaje: errores.join(" ") };
  }

  const distanciaValida =
    Number.isFinite(distancia) && distancia >= 0 && distancia <= 60 ? Math.round(distancia) : 10;

  // Pensión + habitaciones en UNA transacción (RPC `crear_pension_con_habitaciones`):
  // si algo falla no queda un anuncio a medias. El precio lo fija la base de datos
  // a partir de la habitación disponible más barata, de modo que la tarjeta, el
  // filtro de precio y el mensaje de WhatsApp siempre dicen lo mismo.
  const { data: pensionCreada, error } = await supabase.rpc("crear_pension_con_habitaciones", {
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

  /**
   * El número de WhatsApp se guarda en un segundo paso porque la función
   * `crear_pension_con_habitaciones` no acepta esa columna, y la carpeta SQL es
   * del Arquitecto de Datos: no se añade una migración por aquí.
   *
   * La función **devuelve el id** de la pensión creada, así que el `UPDATE` va
   * dirigido a ese id y con predicado de propiedad. No se localiza «la última
   * creada» por título ni por fecha: eso fallaría con dos publicaciones a la vez.
   */
  const pensionId = typeof pensionCreada === "string" ? pensionCreada : null;

  if (pensionId) {
    const { data: conNumero, error: errorNumero } = await supabase
      .from("pensiones")
      .update({ whatsapp })
      .eq("id", pensionId)
      .eq("anfitrion_id", user.id)
      .select("id");

    if (errorNumero || (conNumero ?? []).length === 0) {
      console.error(
        "La pensión se creó, pero no se pudo guardar su WhatsApp:",
        errorNumero?.message ?? "no se modificó ninguna fila"
      );
      // El anuncio existe: se informa de lo que falta en lugar de dar por bueno
      // un guardado incompleto.
      revalidarCatalogo(pensionId);
      redirect("/publicar?creada=1&sinNumero=1");
    }
  }

  // Invalida la caché del catálogo al instante (ISR + etiqueta de datos),
  // para que la pensión nueva aparezca sin esperar los 60 s.
  revalidarCatalogo();
  redirect("/publicar?creada=1");
}

/**
 * Invalida todo lo que muestra disponibilidad: el catálogo, el panel del
 * anfitrión y —cuando se conoce— la ficha pública de la pensión.
 *
 * No se exporta: un módulo "use server" solo puede exportar funciones
 * asíncronas, y esto es un detalle interno de las acciones.
 */
function revalidarCatalogo(pensionId?: string) {
  revalidateTag(ETIQUETA_PENSIONES);
  revalidatePath("/");
  revalidatePath("/publicar");
  if (pensionId) revalidatePath(`/pensiones/${pensionId}`);
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

  const supabase = crearClienteServidor();
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

  const pensionId = fila.pension_id;
  revalidarCatalogo(pensionId);

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

  const supabase = crearClienteServidor();
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

  revalidarCatalogo(pensionId);

  return {
    ok: true,
    mensaje: activa
      ? "Publicación reactivada: ya aparece de nuevo en el catálogo."
      : "Publicación retirada: ya no aparece en el catálogo y su ficha no es accesible al público.",
  };
}

/**
 * Traduce un error de la base a algo que el anfitrión pueda accionar.
 *
 * `42501` (permiso denegado) y `23514` (restricción incumplida) son los dos que
 * puede provocar un anfitrión legítimo; el resto no se le explica con jerga
 * técnica. El precio de la pensión no está en la lista de columnas editables a
 * propósito: lo impone la base desde las habitaciones.
 */
function mensajeDeErrorDeBase(error: { code?: string; message: string }): string {
  if (error.code === "42501") {
    return "No pudimos guardar algún campo: hay datos del anuncio que gestiona la plataforma (el sello de verificación, la calificación y el precio del anuncio no se editan a mano).";
  }
  if (error.code === "23514") {
    return "Algún dato no cumple las reglas del anuncio. Revisa las longitudes del título y la descripción, el precio de cada habitación y la cantidad de fotos.";
  }
  return "No pudimos guardar los cambios. Vuelve a intentarlo en unos segundos.";
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

  const supabase = crearClienteServidor();
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

  const titulo = texto("titulo");
  const descripcion = texto("descripcion");
  const direccion = texto("direccion");
  const barrio = texto("barrio") || "Santa Marta";
  const distancia = Number(texto("distancia"));

  const servicios = formData
    .getAll("servicios")
    .map((valor) => String(valor).trim())
    .filter(Boolean)
    .slice(0, MAX_SERVICIOS);

  const normas = formData
    .getAll("normas")
    .map((valor) => String(valor).trim())
    .filter(Boolean)
    .slice(0, MAX_NORMAS);

  const imagenes = texto("imagenes")
    .split(/\s*\n\s*/)
    .map((url) => url.trim())
    .filter((url) => /^https:\/\/\S+$/i.test(url))
    .slice(0, MAX_IMAGENES);

  const imagenesNoPermitidas = imagenes.filter((url) => !hostImagenPermitido(url));

  /** Igual que al publicar: 10 dígitos exactos, normalizados desde el formulario. */
  const whatsapp = normalizarWhatsappPropio(texto("whatsapp"));

  const { habitaciones, errores: erroresHabitaciones } = leerHabitaciones(texto("habitaciones"));

  const errores: string[] = [];
  if (titulo.length < TITULO_MIN) {
    errores.push(`El título necesita al menos ${TITULO_MIN} caracteres.`);
  }
  if (titulo.length > TITULO_MAX) {
    errores.push(`El título no puede pasar de ${TITULO_MAX} caracteres (ahora tiene ${titulo.length}).`);
  }
  if (direccion.length < DIRECCION_MIN) {
    errores.push("La dirección es obligatoria (barrio, calle o carrera).");
  }
  if (descripcion.length < DESCRIPCION_MIN) {
    errores.push(`Describe el alojamiento en al menos ${DESCRIPCION_MIN} caracteres.`);
  }
  if (descripcion.length > DESCRIPCION_MAX) {
    errores.push(
      `La descripción no puede pasar de ${DESCRIPCION_MAX} caracteres (ahora tiene ${descripcion.length}).`
    );
  }
  if (imagenesNoPermitidas.length > 0) {
    errores.push(
      `Estos enlaces de foto no están permitidos: ${imagenesNoPermitidas
        .slice(0, 3)
        .join(", ")}. ${AYUDA_IMAGENES}`
    );
  }
  if (!whatsappPropioValido(whatsapp)) {
    errores.push(`${MENSAJE_WHATSAPP_INVALIDO}.`);
  }
  errores.push(...erroresHabitaciones);

  if (errores.length > 0) {
    return { ok: false, mensaje: errores.join(" ") };
  }

  const distanciaValida =
    Number.isFinite(distancia) && distancia >= 0 && distancia <= 60 ? Math.round(distancia) : 10;

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
      whatsapp,
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

  // 2) Habitaciones: reconciliación explícita.
  //    Actualizar las que llegan con id, insertar las nuevas y quitar solo las
  //    que el anfitrión haya eliminado. Nunca se borran y recrean en bloque: eso
  //    perdería el estado de disponibilidad de las que no se han tocado.
  const { data: existentes, error: errorExistentes } = await supabase
    .from("habitaciones")
    .select("id")
    .eq("pension_id", pensionId);

  if (errorExistentes) {
    console.error("Error leyendo las habitaciones del anuncio:", errorExistentes.message);
    return {
      ok: false,
      mensaje:
        "Se guardaron los datos del anuncio, pero no pudimos leer sus habitaciones. Vuelve a abrir el editor y revisa que estén como querías.",
    };
  }

  const idsExistentes = new Set((existentes ?? []).map((fila) => fila.id as string));
  const idsQueLlegan = new Set(
    habitaciones
      .map((habitacion) => habitacion.id)
      .filter((id): id is string => Boolean(id) && idsExistentes.has(id as string))
  );

  const aQuitar = [...idsExistentes].filter((id) => !idsQueLlegan.has(id));
  const aInsertar = habitaciones.filter(
    (habitacion) => !habitacion.id || !idsExistentes.has(habitacion.id)
  );
  const aActualizar = habitaciones.filter(
    (habitacion) => habitacion.id && idsExistentes.has(habitacion.id)
  );

  if (aQuitar.length > 0) {
    const { error } = await supabase
      .from("habitaciones")
      .delete()
      .eq("pension_id", pensionId)
      .in("id", aQuitar);

    if (error) {
      console.error("Error quitando habitaciones:", error.message);
      return { ok: false, mensaje: mensajeDeErrorDeBase(error) };
    }
  }

  for (const habitacion of aActualizar) {
    const { id, ...campos } = habitacion;
    const { error } = await supabase
      .from("habitaciones")
      .update(campos)
      .eq("id", id as string)
      .eq("pension_id", pensionId);

    if (error) {
      console.error("Error actualizando una habitación:", error.message);
      return { ok: false, mensaje: mensajeDeErrorDeBase(error) };
    }
  }

  if (aInsertar.length > 0) {
    const { error } = await supabase.from("habitaciones").insert(
      aInsertar.map(({ id: _id, ...campos }) => ({ ...campos, pension_id: pensionId }))
    );

    if (error) {
      console.error("Error agregando habitaciones:", error.message);
      return { ok: false, mensaje: mensajeDeErrorDeBase(error) };
    }
  }

  revalidarCatalogo(pensionId);
  redirect("/publicar?editada=1");
}
