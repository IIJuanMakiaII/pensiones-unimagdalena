import type { Habitacion, PensionConHabitaciones } from "@/types";
import { HABITACIONES_SEMILLA, PENSIONES_SEMILLA } from "@/lib/datos.semilla";

/**
 * Lo que se puede servir cuando no hay base de datos (tarea #42 · M-08).
 *
 * ## El fallo que este módulo cierra
 *
 * El catálogo recurría a las pensiones de ejemplo de la semilla **cuando la
 * consulta fallaba**, sin mirar si la demostración estaba encendida. En
 * producción eso significaba que un corte de red, un pico de latencia o una base
 * pausada publicaban **seis pensiones inventadas** con sus precios, sus fotos y
 * sus botones de reserva, sin ningún síntoma visible: el sitio parecía funcionar.
 *
 * Un estudiante habría escrito para reservar una habitación que no existe.
 *
 * ## La regla, en una línea
 *
 * **Un fallo nunca sirve la semilla.** La demostración se sirve solo cuando se
 * pide a propósito (la variable de entorno), nunca como consecuencia de un error.
 *
 * ## Por qué está aquí y no dentro de `lib/datos.ts`
 *
 * Porque así se puede probar: este archivo no depende de la base ni de los
 * clientes de Supabase, solo de la semilla y de los tipos. La decisión de qué se
 * sirve ante un fallo es exactamente la que no puede quedar sin prueba.
 */

/**
 * Catálogo de demostración (semilla local), con sus habitaciones.
 *
 * En la semilla el identificador **ya es legible** (`pension-costa-verde`), así
 * que la dirección pública es el propio id y no se duplica en el dato: si algún
 * día se escribe un slug distinto en la semilla, se respeta. Gracias a esto las
 * direcciones de la demo no cambian ni una letra.
 */
export function catalogoDemo(): PensionConHabitaciones[] {
  return PENSIONES_SEMILLA.map((pension) => ({
    ...pension,
    slug: pension.id,
    habitaciones: HABITACIONES_SEMILLA.filter((h: Habitacion) => h.pension_id === pension.id),
  }));
}

/** Por qué no hay base de datos disponible. */
export type MotivoSinBase = "sin-configurar" | "error";

/**
 * El catálogo que se sirve cuando no hay base.
 *
 * - `sin-configurar`: no hay credenciales. Es el modo demostración local, y si la
 *   demostración está habilitada a propósito, se sirve la semilla.
 * - `error`: la base está configurada pero no respondió. **Siempre lista vacía**,
 *   con la demostración encendida o apagada.
 *
 * La segunda rama es la que importa: es la diferencia entre un catálogo vacío
 * —honesto, y que el usuario entiende— y seis anuncios que no existen.
 */
export function catalogoSinBase(
  motivo: MotivoSinBase,
  demoHabilitada: boolean
): PensionConHabitaciones[] {
  return motivo === "sin-configurar" && demoHabilitada ? catalogoDemo() : [];
}

/**
 * Una ficha de demostración, por su dirección legible o por su id.
 *
 * Solo cuando la demostración está habilitada a propósito: sin esto, entrar a
 * `/pensiones/pension-costa-verde` en producción serviría un anuncio ficticio.
 */
export function fichaDemo(
  identificador: string,
  demoHabilitada: boolean
): PensionConHabitaciones | null {
  if (!demoHabilitada) return null;

  return catalogoDemo().find((pension) => pension.slug === identificador || pension.id === identificador) ?? null;
}
