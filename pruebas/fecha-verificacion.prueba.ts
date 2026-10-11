/**
 * La fecha de verificación, de la fila al dominio (Oleada 13 · tarea #61).
 *
 * El sello «Verificado por Nido ✓» puede decir CUÁNDO se verificó un anuncio
 * desde que existe `pensiones.verificado_en`. Entre la columna y quien dibuja el
 * sello hay un mapeo, y ese mapeo es donde este dato se pierde sin hacer ruido:
 * un nombre distinto —`verificadoEn` en el dominio frente a `verificado_en` en
 * quien lo lee— compila igual, no rompe ninguna prueba y deja el sello sin fecha
 * para siempre. Eso ocurrió de verdad mientras se escribía esta tarea, y este
 * archivo existe para que no pueda volver a ocurrir en silencio.
 *
 * Se comprueban cinco cosas, y cada una protege algo distinto:
 *
 *   1. La fecha llega al dominio, y llega como `Date` con el instante intacto,
 *      que es lo que sabe formatear quien dibuja el sello.
 *   2. Contra una base a la que todavía no se le aplicó la migración, el campo
 *      llega `null` en vez de romper el catálogo. Es la parte «aditiva y
 *      opcional» del encargo.
 *   3. «Verificado sin constancia de cuándo» se conserva como `null`. No se
 *      rellena con `creada_en` ni con la fecha de hoy: antes un sello sin fecha
 *      que una fecha falsa.
 *   4. Sin sello, la fecha NO viaja aunque la fila la traiga. La restricción de
 *      la base ya lo impide, pero el mapeo es la última puerta antes de que el
 *      dato llegue al navegador, y falla cerrado igual que `mostrarSello`.
 *   5. La proyección pide la columna. Es lo que hace que una migración sin
 *      aplicar se manifieste en voz alta (`42501`) en lugar de parecer que el
 *      anuncio nunca se verificó.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COLUMNAS_PENSION, filaAPension, type PensionFila } from "@/lib/supabase/mapeo";

/** La fecha de una visita, como la devolvería la base: instante en UTC. */
const VISITA = "2026-10-05T20:30:00.000Z";

/** El instante de publicación del anuncio, distinto a propósito de `VISITA`. */
const PUBLICACION = "2026-09-01T09:00:00.000Z";

/**
 * Una fila mínima pero completa. **No** declara `verificado_en`: es la forma que
 * tendrá contra una base sin la migración aplicada, y ese caso hay que poder
 * construir para probarlo.
 */
function filaBase(): PensionFila {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "residencia-de-prueba",
    anfitrion_id: "22222222-2222-2222-2222-222222222222",
    titulo: "Residencia de prueba",
    descripcion: "Una descripción",
    precio_mensual: 500000,
    direccion: "Calle 1 # 2-3",
    barrio: "Mamatoco",
    distancia_a_pie_minutos: 8,
    servicios: ["wifi"],
    normas: [],
    calificacion: 4.5,
    verificado: true,
    imagenes: ["https://ejemplo.test/foto.jpg"],
    activa: true,
    creada_en: PUBLICACION,
  };
}

describe("la fecha de verificación · de la fila al dominio", () => {
  it("llega como `Date`, con el instante intacto", () => {
    const pension = filaAPension({ ...filaBase(), verificado: true, verificado_en: VISITA }, []);
    const fecha = pension.verificado_en;

    assert.ok(
      fecha instanceof Date,
      "el dominio tiene que entregar una fecha, no la cadena de la base: quien dibuja el sello formatea un Date"
    );
    assert.equal(
      fecha.getTime(),
      new Date(VISITA).getTime(),
      "el instante se movió al traducir la fila"
    );
  });

  it("el campo se llama `verificado_en`, igual en la columna, en la fila y en el dominio", () => {
    // El nombre no es cosmética: es lo que lee quien dibuja el sello. Un
    // `verificadoEn` aquí compila, pasa las pruebas y no llega nunca.
    const pension = filaAPension({ ...filaBase(), verificado_en: VISITA }, []);

    assert.ok(
      "verificado_en" in pension,
      "el dominio dejó de exponer `verificado_en`: quien dibuja el sello lo lee con ese nombre"
    );
    assert.ok(
      COLUMNAS_PENSION.split(",")
        .map((columna) => columna.trim())
        .includes("verificado_en"),
      "la proyección dejó de pedir la columna: la fecha no llegaría nunca y nada fallaría"
    );
  });

  it("contra una base sin la migración, el campo llega vacío y el catálogo no se rompe", () => {
    // Ni `verificado_en` en la fila ni, por tanto, en el resultado: es el caso
    // de la base a la que todavía no se le aplicó `oleada-13`. Debe degradar a
    // «verificado sin fecha», no fallar.
    const pension = filaAPension(filaBase(), []);

    assert.equal(pension.verificado_en, null);
    assert.equal(pension.verificado, true, "el sello se perdió al no poder fecharlo");
  });

  it("verificado sin constancia se queda en `null`, sin rellenarlo con `creada_en`", () => {
    const pension = filaAPension({ ...filaBase(), verificado: true, verificado_en: null }, []);

    assert.equal(pension.verificado_en, null, "una fecha sin constancia se rellenó sola");
    assert.notEqual(
      pension.verificado_en,
      pension.creada_en,
      "la fecha de publicación se está usando como fecha de verificación: es la promesa sin respaldo que la auditoría señaló"
    );
  });

  it("sin sello, una fecha en la fila no viaja: el mapeo falla cerrado", () => {
    // La restricción de la base hace imposible esta fila, pero una fila puede
    // venir de una base a la que no se le aplicó, o de una consulta futura. El
    // mapeo vuelve a cerrar la puerta en lugar de confiar en el origen.
    const pension = filaAPension({ ...filaBase(), verificado: false, verificado_en: VISITA }, []);

    assert.equal(pension.verificado, false);
    assert.equal(
      pension.verificado_en,
      null,
      "un anuncio sin sello publicó una fecha de verificación"
    );
  });
});
