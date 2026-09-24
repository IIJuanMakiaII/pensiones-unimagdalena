/**
 * Agrupación de habitaciones por pensión (`lib/agrupar.ts`) — tarea #38 · M-20.
 *
 * La unión de pensiones con habitaciones costaba, hasta la Oleada 8, un recorrido
 * **completo** de todas las habitaciones por **cada** pensión (`filter` dentro de
 * `map`). Con pocas publicaciones no se notaba, y por eso conviene fijarlo ahora:
 * el modo de fallo es que el catálogo se vuelva lento justo cuando empiece a ir
 * bien.
 *
 * Lo que se prueba aquí no es solo que el resultado sea correcto —eso también—
 * sino que **se recorre una sola vez**: la última prueba cuenta las vueltas con
 * un espía, así que si alguien vuelve a escribir la unión de forma multiplicativa,
 * esto falla aunque el resultado siga siendo el correcto.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agruparHabitacionesPorPension } from "@/lib/agrupar";
import type { Habitacion } from "@/types";

function habitacion(id: string, pensionId: string, extra: Partial<Habitacion> = {}): Habitacion {
  return {
    id,
    pension_id: pensionId,
    tipo: "individual",
    genero: "mixto",
    precio_mensual_cop: 400000,
    alimentacion_incluida: false,
    disponible: true,
    ...extra,
  };
}

describe("agruparHabitacionesPorPension", () => {
  it("asocia cada habitación con su pensión", () => {
    const indice = agruparHabitacionesPorPension([
      habitacion("h1", "p1"),
      habitacion("h2", "p2"),
      habitacion("h3", "p1"),
    ]);

    assert.deepEqual(
      indice.get("p1")?.map((h) => h.id),
      ["h1", "h3"]
    );
    assert.deepEqual(
      indice.get("p2")?.map((h) => h.id),
      ["h2"]
    );
  });

  it("conserva el orden de llegada dentro de cada pensión", () => {
    const indice = agruparHabitacionesPorPension([
      habitacion("tercera", "p1"),
      habitacion("primera", "p1"),
      habitacion("segunda", "p1"),
    ]);

    assert.deepEqual(
      indice.get("p1")?.map((h) => h.id),
      ["tercera", "primera", "segunda"]
    );
  });

  it("no inventa entradas para pensiones sin habitaciones", () => {
    const indice = agruparHabitacionesPorPension([habitacion("h1", "p1")]);

    // El llamador consulta por las pensiones que tiene y cae a `[]`; lo que no
    // debe pasar es que haya una entrada vacía que parezca «tiene habitaciones».
    assert.equal(indice.get("p9"), undefined);
    assert.equal(indice.size, 1);
  });

  it("no pierde las habitaciones de pensiones que no se van a mostrar", () => {
    // No es un descarte silencioso: quedan en su entrada y el llamador
    // simplemente no las consulta. Perderlas sería el fallo caro.
    const indice = agruparHabitacionesPorPension([
      habitacion("h1", "p1"),
      habitacion("h2", "huerfana"),
    ]);

    assert.equal(indice.size, 2);
    assert.equal(indice.get("huerfana")?.length, 1);
  });

  it("con una lista vacía devuelve un índice vacío", () => {
    assert.equal(agruparHabitacionesPorPension([]).size, 0);
  });

  it("recorre las habitaciones UNA sola vez (el coste no crece multiplicando)", () => {
    // 200 habitaciones repartidas en 50 pensiones: antes esto eran 10.000
    // comparaciones; ahora, una pasada y 50 consultas al índice.
    const habitaciones = Array.from({ length: 200 }, (_, i) => habitacion(`h${i}`, `p${i % 50}`));

    let pasadas = 0;
    const espia = new Proxy(habitaciones, {
      get(objetivo, propiedad, receptor) {
        if (propiedad === Symbol.iterator) pasadas += 1;
        return Reflect.get(objetivo, propiedad, receptor);
      },
    }) as Habitacion[];

    const indice = agruparHabitacionesPorPension(espia);

    assert.equal(pasadas, 1, "la agrupación debe hacer una sola pasada sobre las habitaciones");
    assert.equal(indice.size, 50);
    for (const lista of indice.values()) assert.equal(lista.length, 4);
  });
});
