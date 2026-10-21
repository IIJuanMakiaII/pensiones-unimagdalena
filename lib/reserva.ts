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

/**
 * Fecha de reserva por identificador de habitación (`habitacion_id → ISO 8601`),
 * tal como la entrega `public.listar_reservas()` (oleada 18).
 *
 * El tipo vive aquí y no en `lib/reservas.ts` a propósito: aquel módulo es de
 * servidor —habla con Supabase y con las cookies—, y los componentes de cliente
 * necesitan esta forma para sus props. Un `import type` se borra al compilar, pero
 * tenerla en el módulo neutro evita que alguien importe el lector desde una
 * pantalla de cliente y arrastre `next/headers` al navegador.
 */
export type ReservasPorHabitacion = Readonly<Record<string, string>>;

/**
 * El trozo del mapa que le toca a un anuncio concreto.
 *
 * No es una optimización: es que cada tarjeta reciba solo lo suyo. Las fechas de
 * reserva son datos de administración y no tienen por qué viajar al navegador
 * dentro del componente de un anuncio que no las muestra, aunque hoy las dos
 * pantallas que las piden sean privadas.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO EN `lib/reservas.ts`
 * ------------------------------------------
 * Porque es una función pura y tiene que poder probarse sin Supabase. El módulo
 * `lib/reservas.ts` habla con las cookies (`next/headers`) y arrastrarlo a una
 * prueba de `node:test` obliga a simular media aplicación. Aquí solo se recorre un
 * objeto, y este módulo ya era el neutro que las dos orillas importan.
 *
 * Lo que **no** hace: inventar una fecha para una habitación que no está en el
 * mapa. Una habitación sin reserva no aparece en el resultado, y una fila con
 * forma rara la descarta `leerReservas` antes de llegar hasta aquí.
 */
export function reservasDeLaPension(
  reservas: ReservasPorHabitacion,
  idsDeHabitaciones: readonly string[]
): ReservasPorHabitacion {
  const propias: Record<string, string> = {};
  for (const id of idsDeHabitaciones) {
    const fecha = reservas[id];
    if (fecha) propias[id] = fecha;
  }
  return propias;
}
