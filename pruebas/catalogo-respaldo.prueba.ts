/**
 * Lo que se sirve cuando no hay base (`lib/catalogo-respaldo.ts`) — tarea #42 · M-08.
 *
 * El fallo que se cierra aquí no rompía nada: **empeoraba el sitio en silencio**.
 * El catálogo recurría a las seis pensiones de ejemplo cuando la consulta fallaba,
 * sin mirar si la demostración estaba encendida. En producción, un corte de red
 * mostraba seis anuncios inventados con sus precios, sus fotos y sus botones de
 * reserva, y el estudiante escribía para reservar algo que no existe.
 *
 * Se prueba en tres frentes, porque cada uno protege algo distinto:
 *
 *   1. **La regla**: un fallo devuelve lista vacía, con la demostración encendida
 *      o apagada. Es el criterio de aceptación, en una línea.
 *   2. **La demostración sigue viva** cuando se pide a propósito, que es lo que el
 *      fundador necesita para enseñarla.
 *   3. **La puerta única**: `lib/datos.ts` ya no puede llamar a la semilla por su
 *      cuenta. Si alguien vuelve a escribir `catalogoDemo()` dentro del catálogo,
 *      estaría rodeando esta prueba, y eso también se comprueba.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { catalogoDemo, catalogoSinBase, fichaDemo } from "@/lib/catalogo-respaldo";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE_DATOS = readFileSync(join(RAIZ, "lib", "datos.ts"), "utf8");

describe("respaldo del catálogo cuando no hay base", () => {
  it("un fallo de la base NO sirve la semilla, ni con la demostración encendida", () => {
    assert.deepEqual(
      catalogoSinBase("error", true),
      [],
      "un corte de red publicó anuncios de ejemplo: es el fallo que esta tarea cierra"
    );
  });

  it("un fallo de la base tampoco la sirve con la demostración apagada", () => {
    assert.deepEqual(catalogoSinBase("error", false), []);
  });

  it("sin credenciales y con la demostración pedida a propósito, sí se sirve", () => {
    // Es el modo con el que se enseña el sitio a los profesores: pedido, no
    // provocado por un fallo.
    const catalogo = catalogoSinBase("sin-configurar", true);

    assert.ok(catalogo.length > 0, "la demostración no puede quedarse sin anuncios");
    assert.ok(catalogo.every((pension) => pension.habitaciones.length > 0));
  });

  it("sin credenciales y sin demostración pedida, lista vacía", () => {
    // Producción mal configurada: mejor un catálogo vacío que seis inventados.
    assert.deepEqual(catalogoSinBase("sin-configurar", false), []);
  });
});

describe("fichas de la demostración", () => {
  it("no resuelve ninguna ficha de ejemplo si la demostración está apagada", () => {
    assert.equal(fichaDemo("pension-costa-verde", false), null);
  });

  it("resuelve una ficha de ejemplo por su dirección legible y por su id", () => {
    const porSlug = fichaDemo("pension-costa-verde", true);

    assert.ok(porSlug, "la dirección legible de una ficha de ejemplo debe resolver");
    assert.equal(fichaDemo(porSlug.id, true)?.id, porSlug.id);
  });

  it("devuelve null para algo que no está en la semilla", () => {
    assert.equal(fichaDemo("no-existe-esta-pension", true), null);
  });
});

describe("coherencia del catálogo de demostración", () => {
  it("cada ficha de ejemplo tiene su dirección legible igual a su id", () => {
    // De esto depende que las direcciones de la demo no cambien: el id ya es
    // legible, así que el slug se deriva en un solo sitio y no puede divergir.
    for (const pension of catalogoDemo()) {
      assert.equal(pension.slug, pension.id);
    }
  });

  it("las habitaciones de ejemplo pertenecen a una pensión de la semilla", () => {
    const ids = new Set(catalogoDemo().map((pension) => pension.id));

    for (const pension of catalogoDemo()) {
      for (const habitacion of pension.habitaciones) {
        assert.ok(ids.has(habitacion.pension_id), `habitación huérfana en la semilla: ${habitacion.id}`);
      }
    }
  });
});

describe("la semilla tiene una sola puerta", () => {
  it("`lib/datos.ts` no sirve la semilla por su cuenta", () => {
    // La regla solo vale si nadie la rodea: la semilla se obtiene por
    // `catalogoSinBase()`/`fichaDemo()`, que son las funciones probadas arriba.
    assert.equal(
      /catalogoDemo\s*\(/.test(FUENTE_DATOS),
      false,
      "`lib/datos.ts` llama a catalogoDemo(): el respaldo debe pasar por lib/catalogo-respaldo.ts"
    );
  });

  it("las dos ramas de error del catálogo usan el motivo «error»", () => {
    const motivos = FUENTE_DATOS.match(/catalogoSinBase\("error"/g) ?? [];

    assert.equal(
      motivos.length,
      2,
      `se esperaban 2 ramas de error (la consulta fallida y la excepción) y hay ${motivos.length}`
    );
  });
});
