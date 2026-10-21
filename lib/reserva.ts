import type { EstadoFormulario } from "@/lib/pension-escritura";

/**
 * El estado de un formulario de reserva, compartido por las dos orillas (tarea #106).
 *
 * POR QUÉ VIVE AQUÍ Y NO EN `app/actions/maestro.ts`
 * --------------------------------------------------
 * Un archivo con `"use server"` **solo puede exportar funciones asíncronas**. El
 * estado inicial de un formulario es un objeto, no una función, así que exportarlo
 * desde allí rompe la compilación de Next. Y el componente de cliente necesita el
 * mismo valor para arrancar `useFormState`, de modo que tiene que estar en un
 * módulo que las dos orillas puedan importar sin arrastrar la capa de escritura al
 * navegador. Es la misma razón por la que `PALABRA_DE_BORRADO` vive en
 * `lib/borrado.ts`.
 *
 * LA FECHA ES OPCIONAL Y ES ANULABLE, Y ESO SIGNIFICA ALGO
 * ------------------------------------------------------
 * `reservadaEn` solo viene informado cuando la acción acaba de marcar la reserva y
 * la base devolvió su fecha. `reservada_en` **no tiene `SELECT` para ningún rol de
 * cliente** —`anon` y `authenticated` reciben `42501`; medido al aplicar la oleada
 * 17—, así que el panel no puede volver a leerla al recargar. `null` es la verdad
 * ahí: «no hay fecha que enseñar», no «la reserva no tiene fecha». Rellenarlo con
 * otro campo —`creada_en`, la fecha de hoy— sería inventar el dato que esta tarea
 * existe para registrar de verdad.
 */
export interface EstadoReserva extends EstadoFormulario {
  /** ISO 8601 tal como lo entregó la base, solo al marcar la reserva. */
  reservadaEn: string | null;
}

/** Estado inicial: sin mensaje, sin fecha y sin éxito. */
export const ESTADO_RESERVA_INICIAL: EstadoReserva = {
  ok: false,
  mensaje: null,
  reservadaEn: null,
};
