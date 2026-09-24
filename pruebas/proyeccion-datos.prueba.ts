/**
 * Proyección de las consultas de lectura (tarea #38 · M-20).
 *
 * Las consultas pedían `select("*")`. Eso trae todas las columnas de todas las
 * filas —incluidas las que el mapeo no lee— y hace que **cualquier columna que se
 * añada en el futuro viaje sola** hasta el navegador sin que nadie lo decida.
 *
 * Es un fallo silencioso: no rompe nada, solo engorda cada lectura, y se nota
 * cuando ya hay muchos anuncios. Por eso se vigila aquí, que es gratis, y no
 * esperando a una medición en producción.
 *
 * Se comprueban tres cosas:
 *   1. Que no vuelva a aparecer un `select` con comodín.
 *   2. Que **toda** lectura use una de las dos proyecciones declaradas: si al
 *      añadir una consulta alguien escribe `select("id, titulo")` a mano, esto
 *      falla, porque las columnas del contrato deben salir de un solo sitio.
 *   3. Que la proyección y la interfaz que traduce **no se desincronicen**: cada
 *      campo de `PensionFila` y de `HabitacionFila` tiene que estar en su lista,
 *      y la lista no puede pedir de más.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { COLUMNAS_HABITACION, COLUMNAS_PENSION } from "@/lib/supabase/mapeo";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE_DATOS = readFileSync(join(RAIZ, "lib", "datos.ts"), "utf8");
const FUENTE_MAPEO = readFileSync(join(RAIZ, "lib", "supabase", "mapeo.ts"), "utf8");

/** Campos declarados en una interfaz de fila, ignorando sus comentarios. */
function camposDeFila(nombre: string): string[] {
  const bloque = new RegExp(`export interface ${nombre} \\{([\\s\\S]*?)\\n\\}`).exec(FUENTE_MAPEO)?.[1];
  assert.ok(bloque, `no se encontró la interfaz ${nombre} en lib/supabase/mapeo.ts`);

  const sinComentarios = bloque.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  return [...sinComentarios.matchAll(/(?:^|\n)\s*([a-z_][a-z0-9_]*)\??\s*:/g)].map((m) => m[1]);
}

function columnasDe(constante: string): string[] {
  return constante.split(",").map((columna) => columna.trim());
}

describe("proyección de las consultas del catálogo", () => {
  it("ninguna lectura pide todas las columnas", () => {
    const comodin = /\.select\(\s*["'`]\s*\*\s*["'`]\s*\)/g;
    const encontrados = FUENTE_DATOS.match(comodin) ?? [];

    assert.deepEqual(
      encontrados,
      [],
      `hay ${encontrados.length} consulta(s) con comodín: cada columna nueva viajaría sola al navegador`
    );
  });

  it("toda lectura usa una de las dos proyecciones declaradas", () => {
    const proyecciones = [...FUENTE_DATOS.matchAll(/\.select\(([^)]*)\)/g)].map((m) => m[1].trim());

    assert.ok(
      proyecciones.length >= 6,
      `se esperaban al menos 6 lecturas proyectadas y se encontraron ${proyecciones.length}`
    );

    for (const proyeccion of proyecciones) {
      assert.ok(
        proyeccion === "COLUMNAS_PENSION" || proyeccion === "COLUMNAS_HABITACION",
        `lectura con proyección no declarada: «${proyeccion}»`
      );
    }
  });

  it("la proyección de pensiones cubre exactamente los campos que traduce el mapeo", () => {
    assert.deepEqual(
      columnasDe(COLUMNAS_PENSION).sort(),
      camposDeFila("PensionFila").sort(),
      "la lista de columnas y la interfaz PensionFila se han separado"
    );
  });

  it("la proyección de habitaciones cubre exactamente los campos que traduce el mapeo", () => {
    assert.deepEqual(
      columnasDe(COLUMNAS_HABITACION).sort(),
      camposDeFila("HabitacionFila").sort(),
      "la lista de columnas y la interfaz HabitacionFila se han separado"
    );
  });

  it("la proyección de habitaciones no arrastra columnas que nadie lee", () => {
    // `habitaciones.creada_en` existe en la tabla y no está en el mapeo: viajaba
    // en cada fila para nada. Si alguien la añade «por si acaso», esto lo dice.
    assert.equal(
      columnasDe(COLUMNAS_HABITACION).includes("creada_en"),
      false,
      "`creada_en` no la lee nadie: pedirla engorda cada fila del catálogo"
    );
  });
});
