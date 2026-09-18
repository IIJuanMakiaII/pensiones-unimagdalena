"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { ETIQUETA_PENSIONES } from "@/utils/supabase/publico";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { AYUDA_IMAGENES, hostImagenPermitido, MAXIMO_FOTOS } from "@/lib/imagenes";
import { formatearCOP } from "@/lib/formato";
import type { EntradaHabitacion, GeneroHabitacion, TipoHabitacion } from "@/types";

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
  habitaciones: EntradaHabitacion[];
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

  const habitaciones: EntradaHabitacion[] = [];

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
