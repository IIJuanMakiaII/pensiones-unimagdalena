import { crearClienteServidor } from "@/utils/supabase/server";
import type { ReservasPorHabitacion } from "@/lib/reserva";

export type { ReservasPorHabitacion };
/**
 * El recorte por anuncio se movió a `lib/reserva.ts`, que es puro y se puede probar
 * sin Supabase. Se reexporta desde aquí para que las pantallas sigan teniendo un
 * solo punto de entrada: quien lee reservas pide «leer» y «recortar» en el mismo
 * `import`.
 */
export { reservasDeLaPension } from "@/lib/reserva";

/**
 * Lectura de las reservas vigentes (tarea #119).
 *
 * POR QUÉ HAY UNA FUNCIÓN DE BASE Y NO UNA COLUMNA
 * -----------------------------------------------
 * `reservada_en` no tiene `SELECT` para ningún rol de cliente: `anon` y
 * `authenticated` reciben `42501`, a propósito. La única puerta es
 * `public.listar_reservas()` —`security definer`, `stable`—, aplicada en la
 * oleada 18. Por eso este módulo existe: es el camino por el que el panel se
 * entera de qué está reservado, sin abrir la columna ni añadirla a
 * `COLUMNAS_HABITACION` (eso rompería toda la lectura con `42501`).
 *
 * LA LISTA ES LA FUENTE DE VERDAD, Y `disponible` NO LO ES
 * -------------------------------------------------------
 * Presencia en la lista significa «está reservada». `disponible = false` **no**
 * significa lo mismo: puede ser una habitación que el anfitrión apagó a mano, o
 * una que se publicó sin ofrecer. Confundir las dos cosas haría que el panel
 * escondiera un botón que sí debía ofrecer, o al revés.
 *
 * LA FORMA DE LA RESPUESTA, MEDIDA
 * -------------------------------
 * `supabase.rpc("listar_reservas")` → `200 · [{ habitacion_id, reservada_en }]`,
 * ordenado por `reservada_en desc, habitacion_id`, con `reservada_en` en ISO 8601
 * (`2026-10-21T14:29:35.214665+00:00`). No devuelve `reservada_por` ni
 * `disponible_antes_de_reservar`: no se piden ni se esperan.
 *
 * A quien no tiene derecho a ver ninguna reserva la función le devuelve **cero
 * filas, no un error**. El filtro lo hace la base con el mismo predicado que las
 * dos funciones de escritura; aquí no se repite como si fuera la garantía.
 */

/**
 * Por qué la lectura salió como salió.
 *
 * `sin-funcion` existe por un caso real de despliegue: si la migración acaba de
 * entrar, PostgREST puede responder `PGRST202` mientras recarga su caché de
 * esquema. Eso **no** es «la función no existe» —ya está verificada contra
 * `pg_proc`—, pero tampoco es un dato que se pueda usar, así que se distingue del
 * error genérico para no ensuciar los registros con una alarma falsa.
 */
export type MotivoDeLaLectura = "ok" | "sin-funcion" | "error";

export interface LecturaDeReservas {
  reservas: ReservasPorHabitacion;
  motivo: MotivoDeLaLectura;
}

/**
 * Lee las reservas que esta sesión puede ver: todas si es el maestro, las suyas si
 * es el anfitrión dueño, ninguna si es cualquier otra cuenta.
 *
 * FALLA ABIERTO, Y ES DELIBERADO
 * -----------------------------
 * Si la lectura falla se devuelve un mapa vacío, que para quien llama significa
 * «no consta ninguna reserva». La consecuencia es que el panel del anfitrión
 * vuelve a ofrecer el botón y la base lo rechaza con su mensaje correcto. La
 * alternativa —esconder los controles de disponibilidad cuando la lectura falla—
 * rompería el caso normal, que es justo lo que la tarea prohíbe tocar: una
 * habitación **no** reservada tiene que seguir gestionándose igual que antes de la
 * oleada 17. Entre un botón de más y un panel que deja de funcionar, el de más.
 */
export async function leerReservas(): Promise<LecturaDeReservas> {
  try {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc("listar_reservas");

    if (error) {
      if (error.code === "PGRST202") {
        console.error(
          "`listar_reservas` no aparece en la caché de esquema de PostgREST:",
          error.message
        );
        return { reservas: {}, motivo: "sin-funcion" };
      }
      console.error("No se pudieron leer las reservas:", error.code, error.message);
      return { reservas: {}, motivo: "error" };
    }

    const reservas: Record<string, string> = {};

    for (const fila of (data ?? []) as { habitacion_id?: unknown; reservada_en?: unknown }[]) {
      // Se copia lo que se entiende y se descarta lo demás: una fila con forma
      // inesperada no puede convertirse en una fecha inventada en el panel.
      const id = typeof fila.habitacion_id === "string" ? fila.habitacion_id : "";
      const fecha = typeof fila.reservada_en === "string" ? fila.reservada_en : "";
      if (id && fecha) reservas[id] = fecha;
    }

    return { reservas, motivo: "ok" };
  } catch (error) {
    // Sin Supabase configurado, o sin cookies disponibles: el panel se dibuja sin
    // fechas en lugar de romperse.
    console.error("No se pudieron leer las reservas:", error);
    return { reservas: {}, motivo: "error" };
  }
}

