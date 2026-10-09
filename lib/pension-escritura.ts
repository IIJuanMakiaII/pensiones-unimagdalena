import type { SupabaseClient } from "@supabase/supabase-js";
import { AYUDA_IMAGENES, hostImagenPermitido, MAXIMO_FOTOS } from "@/lib/imagenes";
import { formatearCOP } from "@/lib/formato";
import type {
  EntradaHabitacionEditada,
  GeneroHabitacion,
  TipoHabitacion,
} from "@/types";

/**
 * Lectura y validación de lo que envía el formulario de un anuncio (tarea #34).
 *
 * Vive en un módulo normal —ni `"use server"` ni componente— por una razón
 * concreta: desde la tarea #34 hay **dos** caminos que guardan un anuncio, el del
 * anfitrión (`app/actions/pensiones.ts`) y el del maestro
 * (`app/actions/maestro.ts`), y las reglas tienen que ser las mismas en los dos.
 * Con una copia en cada uno, el día que se corrija un límite solo se corrige en
 * una y la otra se queda atrás sin que nada lo delate.
 *
 * Aquí **no hay autorización**. Nada de este archivo decide quién puede escribir:
 * eso se resuelve en cada acción, con la sesión y el predicado que le toca. Es
 * deliberado: mezclar las dos cosas es lo que permite que un día se relaje un
 * permiso sin que se note.
 */

/**
 * Estado que una acción de anuncio devuelve a su formulario.
 *
 * Vive aquí y no en `app/actions/pensiones.ts` desde la tarea #34: hay dos
 * módulos de acciones —el del anfitrión y el del maestro— y los dos formularios
 * tienen que hablar del mismo estado. Es un tipo, así que no arrastra nada.
 */
export interface EstadoFormulario {
  ok: boolean;
  mensaje: string | null;
}

export const TITULO_MIN = 6;
export const DESCRIPCION_MIN = 30;
export const DIRECCION_MIN = 5;
/** Límites superiores vigentes en la base: se comprueban antes para poder explicar el motivo. */
export const TITULO_MAX = 120;
export const DESCRIPCION_MAX = 2000;
export const PRECIO_MIN = 1000;
export const PRECIO_MAX = 20000000;
export const MAX_SERVICIOS = 12;
export const MAX_NORMAS = 8;
export const MAX_IMAGENES = MAXIMO_FOTOS;
/** Debe coincidir con el límite de `crear_pension_con_habitaciones` (supabase/oleada-1.sql). */
export const MAX_HABITACIONES = 20;

/** Uniones cerradas: el formulario envía texto libre y aquí se valida. */
export const TIPOS_VALIDOS: readonly string[] = ["individual", "compartida", "matrimonial"];
export const GENEROS_VALIDOS: readonly string[] = ["mixto", "femenino", "masculino"];

/**
 * Lee y valida las habitaciones que llegan en el campo oculto del formulario.
 *
 * Se valida habitación por habitación para poder decirle al anfitrión *qué*
 * corregir: la base de datos también las protege, pero ahí el error llegaría
 * sin contexto. La pensión ya no tiene un precio propio: se deriva de la
 * habitación disponible más barata (así la tarjeta y el filtro de precio nunca
 * se contradicen).
 */
export function leerHabitaciones(crudo: string): {
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

/** Lo que el formulario de edición aporta, ya validado y listo para escribir. */
export interface CamposDePension {
  titulo: string;
  descripcion: string;
  direccion: string;
  barrio: string;
  distanciaValida: number;
  servicios: string[];
  normas: string[];
  imagenes: string[];
  habitaciones: EntradaHabitacionEditada[];
}

export interface LecturaDeFormulario {
  campos: CamposDePension;
  errores: string[];
}

/**
 * Lee y valida el formulario completo de un anuncio ya publicado.
 *
 * Devuelve **siempre** los campos y, aparte, la lista de errores: el llamador
 * decide si escribe o no. Así el mismo formulario se puede reutilizar desde el
 * panel del anfitrión y desde el del maestro sin que ninguno de los dos tenga que
 * volver a interpretar los límites a mano.
 */
export function leerCamposDePension(formData: FormData): LecturaDeFormulario {
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
  errores.push(...erroresHabitaciones);

  const distanciaValida =
    Number.isFinite(distancia) && distancia >= 0 && distancia <= 60 ? Math.round(distancia) : 10;

  return {
    campos: {
      titulo,
      descripcion,
      direccion,
      barrio,
      distanciaValida,
      servicios,
      normas,
      imagenes,
      habitaciones,
    },
    errores,
  };
}

/**
 * Traduce un error de la base a algo que una persona pueda accionar.
 *
 * `42501` (permiso denegado) y `23514` (restricción incumplida) son los dos que
 * puede provocar un anfitrión legítimo; el resto no se le explica con jerga
 * técnica. El precio de la pensión no está en la lista de columnas editables a
 * propósito: lo impone la base desde las habitaciones.
 */
export function mensajeDeErrorDeBase(error: { code?: string; message: string }): string {
  if (error.code === "42501") {
    return "No pudimos guardar algún campo: hay datos del anuncio que gestiona la plataforma (el sello de verificación, la calificación y el precio del anuncio no se editan a mano).";
  }
  if (error.code === "23514") {
    return "Algún dato no cumple las reglas del anuncio. Revisa las longitudes del título y la descripción, el precio de cada habitación y la cantidad de fotos.";
  }
  return "No pudimos guardar los cambios. Vuelve a intentarlo en unos segundos.";
}

/**
 * Deja las habitaciones del anuncio exactamente como las envió el formulario.
 *
 * Se actualizan las que llegan con `id`, se insertan las nuevas y se quitan solo
 * las que se hayan eliminado. Nunca se borran y recrean en bloque: eso perdería
 * el estado de disponibilidad de las que no se han tocado.
 *
 * No decide permisos: quien la llama ya resolvió la autorización, y la RLS de la
 * base sigue siendo la última palabra sobre cada escritura.
 */
export async function reconciliarHabitaciones(
  supabase: SupabaseClient,
  pensionId: string,
  habitaciones: EntradaHabitacionEditada[]
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
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

  return { ok: true };
}
