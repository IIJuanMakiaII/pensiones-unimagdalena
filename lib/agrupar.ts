import type { Habitacion } from "@/types";

/**
 * Agrupación de habitaciones por pensión (tarea #38 · M-20).
 *
 * ## Por qué existe este módulo
 *
 * El catálogo une cada pensión con sus habitaciones en memoria, después de
 * traerlas de la base en dos consultas. La primera versión de esa unión era:
 *
 * ```ts
 * pensiones.map((fila) => habitaciones.filter((h) => h.pension_id === fila.id))
 * ```
 *
 * Es un `filter` dentro de un `map`: por cada pensión recorre **todas** las
 * habitaciones. Con 6 anuncios y 16 habitaciones son 96 comparaciones y no se
 * nota; con 500 y 5.000 son **2,5 millones**, y crece multiplicando. Ese es el
 * coste escondido que se arregla aquí.
 *
 * La corrección es agrupar una sola vez: un recorrido de la lista de
 * habitaciones para construir el índice, y una consulta al índice por pensión.
 * El coste pasa de `O(pensiones × habitaciones)` a `O(pensiones + habitaciones)`.
 *
 * ## Por qué en su propio archivo
 *
 * Es una función **pura** y sin dependencias: se puede probar sola, sin base de
 * datos y sin importar los clientes de Supabase. Mismo criterio que
 * `lib/identificador.ts`. La aritmética de complejidad solo vale si alguien
 * puede comprobarla.
 */

/**
 * Devuelve un índice `pension_id -> habitaciones`, en un solo recorrido.
 *
 * Las habitaciones de una pensión que no esté en la lista **no se descartan**:
 * quedan en su propia entrada del mapa. No es un problema (el llamador consulta
 * por las pensiones que tiene), y descartarlas obligaría a conocer antes la
 * lista de pensiones, que es justo lo que este índice evita.
 */
export function agruparHabitacionesPorPension(
  habitaciones: readonly Habitacion[]
): Map<string, Habitacion[]> {
  const indice = new Map<string, Habitacion[]>();

  for (const habitacion of habitaciones) {
    const existentes = indice.get(habitacion.pension_id);

    if (existentes) {
      existentes.push(habitacion);
    } else {
      indice.set(habitacion.pension_id, [habitacion]);
    }
  }

  return indice;
}
