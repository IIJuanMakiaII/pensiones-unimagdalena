import type { GeneroHabitacion, Habitacion, PensionConHabitaciones, TipoHabitacion } from "@/types";
import { IMAGEN_RESPALDO } from "@/lib/pension";

/**
 * Mapeo fila (snake_case de PostgreSQL) -> modelo de dominio (types/index.ts).
 *
 * Nota: la columna se llama `precio_mensual` (PostgreSQL no admite camelCase
 * sin comillas) y el campo de la interfaz es `precioMensual`, tal como se pidió.
 */

export interface PensionFila {
  id: string;
  /**
   * Dirección pública (Oleada 5, tarea #26). Opcional aquí a propósito: si esta
   * capa se ejecutara contra una base a la que todavía no se le aplicó la
   * migración, el campo llega ausente y el mapeo cae al `id` en lugar de
   * producir enlaces rotos (`/pensiones/undefined`).
   */
  slug?: string | null;
  anfitrion_id: string;
  titulo: string;
  descripcion: string | null;
  precio_mensual: number | null;
  direccion: string | null;
  barrio: string | null;
  distancia_a_pie_minutos: number | null;
  servicios: string[] | null;
  normas: string[] | null;
  calificacion: number | null;
  verificado: boolean | null;
  /**
   * Instante en que se registró la verificación (Oleada 13, tarea #61).
   * `null` = verificado sin constancia de cuándo.
   *
   * Opcional por el mismo motivo que `latitud`: contra una base a la que todavía
   * no se le aplicó la migración, el campo llega ausente y la ficha se dibuja sin
   * fecha en lugar de romperse. Eso vale para el VALOR; para la COLUMNA no: la
   * proyección de abajo sí la pide, y una columna que falte en la base hace
   * fallar la consulta con `42501`. Por eso
   * `supabase/oleada-13-fecha-verificacion.sql` se aplica ANTES de desplegar
   * este cambio.
   */
  verificado_en?: string | null;
  imagenes: string[] | null;
  activa: boolean;
  creada_en: string;
   latitud?: number | null;
   longitud?: number | null;
   /*
    * Aquí estaban `whatsapp` y `autorizacion_contacto_en`. Se retiraron del
    * mapeo el 2026-10-02: el contacto lo maneja la plataforma y el número del
    * dueño dejó de ser un dato del producto.
    *
    * El corte se hace **aquí**, en la frontera, y no en cada pantalla: la fila
    * de la base todavía puede traerlo (hay anuncios antiguos con número), y la
    * única forma de que no acabe publicado es que no sobreviva al mapeo. Todo lo
    * que se pase a un componente de cliente viaja en el HTML de la página.
    */
}

export interface HabitacionFila {
  id: string;
  pension_id: string;
  tipo: string;
  genero: string;
  precio_mensual_cop: number;
  alimentacion_incluida: boolean;
  disponible: boolean;
}

/**
 * Proyección de las consultas de lectura (tarea #38 · M-20).
 *
 * Las consultas pedían `select("*")`: traían todas las columnas de todas las
 * filas, incluidas las que el mapeo ni siquiera lee, y **cualquier columna que
 * se añada en el futuro viajaría sola** hasta el navegador. Estas listas
 * enumeran lo que de verdad se usa, y viven aquí, junto a las interfaces que
 * traducen, para que no puedan desincronizarse sin que se note.
 *
 * En `habitaciones` hay un recorte real: `creada_en` existe en la tabla y **no**
 * está en el mapeo, así que hoy viajaba en cada fila para nada.
 *
 * Contrapartida honesta: pedir columnas por su nombre acopla la aplicación al
 * esquema. Si a esta base le faltara una de estas columnas (una migración sin
 * aplicar), la consulta **fallaría en voz alta** en lugar de devolver el campo
 * vacío. Es el comportamiento que se quiere —un esquema incompleto es un error,
 * no un dato ausente—, pero conviene tenerlo presente al añadir columnas.
 */
export const COLUMNAS_PENSION = [
  "id",
  "slug",
  "anfitrion_id",
  "titulo",
  "descripcion",
  "precio_mensual",
  "direccion",
  "barrio",
  "distancia_a_pie_minutos",
  "servicios",
  "normas",
  "calificacion",
  "verificado",
  "verificado_en",
  "imagenes",
  "activa",
  "creada_en",
   "latitud",
   "longitud",
   // Ni `whatsapp` ni `autorizacion_contacto_en`: el contacto lo maneja la
   // plataforma, así que el número del dueño no se pide ni se trae.
].join(", ");

export const COLUMNAS_HABITACION = [
  "id",
  "pension_id",
  "tipo",
  "genero",
  "precio_mensual_cop",
  "alimentacion_incluida",
  "disponible",
].join(", ");

const TIPOS: TipoHabitacion[] = ["individual", "compartida", "matrimonial"];
const GENEROS: GeneroHabitacion[] = ["mixto", "femenino", "masculino"];

export function filaAHabitacion(fila: HabitacionFila): Habitacion {
  return {
    id: fila.id,
    pension_id: fila.pension_id,
    tipo: TIPOS.includes(fila.tipo as TipoHabitacion) ? (fila.tipo as TipoHabitacion) : "individual",
    genero: GENEROS.includes(fila.genero as GeneroHabitacion) ? (fila.genero as GeneroHabitacion) : "mixto",
    precio_mensual_cop: Number(fila.precio_mensual_cop ?? 0),
    alimentacion_incluida: Boolean(fila.alimentacion_incluida),
    disponible: Boolean(fila.disponible),
  };
}

export function filaAPension(fila: PensionFila, habitaciones: Habitacion[]): PensionConHabitaciones {
  const imagenes = (fila.imagenes ?? []).filter((url): url is string => Boolean(url));

  return {
    id: fila.id,
    // Sin `slug` (base a la que aún no se le aplicó la migración) se cae al
    // `id`: un enlace con UUID sigue funcionando, y siempre es mejor que un
    // enlace con «undefined».
    slug: fila.slug?.trim() ? fila.slug : fila.id,
    anfitrion_id: fila.anfitrion_id,
    titulo: fila.titulo,
    descripcion: fila.descripcion ?? "",
    precioMensual: Number(fila.precio_mensual ?? 0),
    direccion: fila.direccion ?? "",
    servicios: fila.servicios ?? [],
    imagenes: imagenes.length > 0 ? imagenes : [IMAGEN_RESPALDO],
    activa: fila.activa,
    creada_en: new Date(fila.creada_en),
    barrio: fila.barrio ?? "",
    distancia_a_pie_minutos: Number(fila.distancia_a_pie_minutos ?? 0),
    normas: fila.normas ?? [],
    calificacion: Number(fila.calificacion ?? 0),
    verificado: Boolean(fila.verificado),
    // La fecha solo viaja si el sello está puesto: una fecha sin verificación
    // sería un dato sin sentido, y la restricción de la base ya lo impide, pero
    // aquí se vuelve a cerrar para que el dominio no pueda representar un estado
    // que la base considera inválido.
    //
    // `null` es «verificado, sin constancia de cuándo», y se conserva como null:
    // no se sustituye por `creada_en` ni por la fecha de hoy. La interfaz tendrá
    // que decir «Verificado» a secas, que es la verdad.
    // El nombre de destino es `verificado_en`, igual que el de la columna: es la
    // convención de los campos que vienen de la base (`creada_en`), y es lo que
    // lee quien dibuja el sello. Escribirlo en camelCase compilaría igual y la
    // fecha no llegaría nunca, sin que nada fallara.
    verificado_en:
      fila.verificado === true && fila.verificado_en
        ? new Date(fila.verificado_en)
        : null,
    latitud: typeof fila.latitud === "number" ? fila.latitud : null,
    longitud: typeof fila.longitud === "number" ? fila.longitud : null,
    habitaciones,
  };
}
