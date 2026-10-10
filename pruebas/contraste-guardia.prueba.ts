/**
 * El guardián de contraste y escala (`scripts/verificar-contraste.mjs`) tiene que
 * FALLAR cuando hay algo mal.
 *
 * Un verificador que solo se ha visto pasar no prueba nada: puede estar pasando
 * porque mira donde no hay problemas, o directamente porque no mira. Ese fue el
 * fallo real que originó estas comprobaciones — el verificador daba «todo en
 * verde» mientras los botones de conversión estaban por debajo del mínimo y la
 * escala se había degradado a 10 y 11 px.
 *
 * Por eso cada prueba de aquí construye un árbol de código con UN defecto
 * concreto y exige que el guion lo nombre. La primera prueba es el control: un
 * árbol limpio no puede producir ningún hallazgo. Sin ese control, un guion que
 * fallara siempre también aprobaría todo lo demás.
 *
 * El guion lee su raíz de `CONTRASTE_RAIZ`, así que las pruebas no tocan el
 * código real del proyecto: cada una escribe su propio árbol temporal.
 *
 * Sobre la atribución: además del código de salida, cada prueba mira **qué
 * hallazgos apuntan a su propio árbol**. Es más preciso que el código de salida,
 * porque el registro de colores es del proyecto entero y una deuda pendiente en
 * la paleta real —como la que hoy tiene el botón «Guardar»— no debe confundir a
 * estas pruebas sobre lo que el barrido ve, o no ve, en su árbol.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const GUION = join(process.cwd(), "scripts", "verificar-contraste.mjs");

/**
 * Ejecuta el guion contra un árbol de prueba. La paleta se sigue leyendo del
 * `tailwind.config.ts` real, que es lo que interesa: las pruebas comprueban la
 * vigilancia del CÓDIGO, no la de los colores.
 */
function verificar(raiz: string): { codigo: number | null; salida: string; hallazgos: string[] } {
  const resultado = spawnSync(process.execPath, [GUION], {
    cwd: process.cwd(),
    env: { ...process.env, CONTRASTE_RAIZ: raiz },
    encoding: "utf8",
  });
  const salida = `${resultado.stdout}${resultado.stderr}`;
  const hallazgos = salida
    .split(/\r?\n/)
    .filter((linea) => linea.startsWith("FALLA") && linea.includes(raiz));

  return { codigo: resultado.status, salida, hallazgos };
}

/** Árbol mínimo: las tres carpetas que el guion recorre existen también aquí. */
function arbol(carpetas = ["components", "app", "lib"]): string {
  const raiz = mkdtempSync(join(tmpdir(), "contraste-guardia-"));
  for (const carpeta of carpetas) mkdirSync(join(raiz, carpeta));
  return raiz;
}

function conMuestra(raiz: string, fuente: string): string {
  writeFileSync(join(raiz, "components", "Muestra.tsx"), fuente, "utf8");
  return raiz;
}

/** Atajo: un componente con las clases dadas y nada más. */
function conClases(clases: string): string {
  return conMuestra(arbol(), `export const Muestra = () => <p className="${clases}">texto</p>;\n`);
}

describe("guardián de contraste y escala", () => {
  it("no encuentra nada en un árbol limpio (control)", () => {
    const raiz = conClases("text-base text-neutro-900");
    try {
      const { hallazgos, salida } = verificar(raiz);
      assert.deepEqual(
        hallazgos,
        [],
        `un árbol limpio no puede producir hallazgos:\n${salida}`
      );
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("falla con un tamaño inventado", () => {
    const raiz = conClases("text-[15px] text-neutro-900");
    try {
      const { codigo, hallazgos, salida } = verificar(raiz);
      assert.equal(codigo, 1, "un tamaño arbitrario tenía que hacer fallar el guion");
      assert.equal(hallazgos.length, 1, `esperaba un hallazgo:\n${salida}`);
      assert.match(hallazgos[0], /tamaño inventado/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("falla con un tamaño por debajo del mínimo", () => {
    const raiz = conClases("text-[10px] text-neutro-900");
    try {
      const { codigo, hallazgos, salida } = verificar(raiz);
      assert.equal(codigo, 1, "10 px no puede pasar como texto legible");
      assert.equal(hallazgos.length, 1, `esperaba un hallazgo:\n${salida}`);
      assert.match(hallazgos[0], /por debajo del mínimo de 12 px/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("ve las clases que viven dentro de un ternario", () => {
    // Este es el hueco por el que se escapó `text-airbnb-rausch-hover`: su clase
    // no está en un `className="..."` plano, sino en una rama, y al partir la
    // plantilla el token llegaba con las comillas internas pegadas. Si la prueba
    // no cubriera este caso, el guardián podría volver a dejar pasar texto sin
    // registrar sin que nada lo delatara.
    const raiz = conMuestra(
      arbol(),
      [
        "export const Muestra = ({ activo }: { activo: boolean }) => (",
        "  <button",
        '    className={`text-sm font-bold ${activo ? "text-motivo-500" : "text-neutro-700"}`}',
        "  >",
        "    Guardar",
        "  </button>",
        ");",
        "",
      ].join("\n")
    );
    try {
      const { codigo, hallazgos, salida } = verificar(raiz);
      assert.equal(codigo, 1, "una clase de color dentro de un ternario tiene que vigilarse igual");
      assert.equal(hallazgos.length, 1, `esperaba un hallazgo:\n${salida}`);
      assert.match(hallazgos[0], /text-motivo-500/);
      assert.match(hallazgos[0], /no está en el registro de TEXTOS/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("falla con un fondo no verificado bajo texto blanco", () => {
    const raiz = conClases("bg-primary-200 text-white");
    try {
      const { codigo, hallazgos, salida } = verificar(raiz);
      assert.equal(codigo, 1, "un fondo nuevo con texto blanco no puede pasar sin declarar su ratio");
      assert.equal(hallazgos.length, 1, `esperaba un hallazgo:\n${salida}`);
      assert.match(hallazgos[0], /primary-200/);
      assert.match(hallazgos[0], /no está entre los pares verificados/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("falla con un color de texto sin registrar sobre claro", () => {
    // El texto oscuro sobre blanco es la mayor parte del sitio y era justo lo que
    // nadie vigilaba: solo rendía cuentas el texto blanco sobre color.
    const raiz = conClases("text-base text-secondary-400");
    try {
      const { codigo, hallazgos, salida } = verificar(raiz);
      assert.equal(codigo, 1, "un color de texto nuevo tiene que registrarse con su fondo y su mínimo");
      assert.equal(hallazgos.length, 1, `esperaba un hallazgo:\n${salida}`);
      assert.match(hallazgos[0], /text-secondary-400/);
      assert.match(hallazgos[0], /no está en el registro de TEXTOS/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("no confunde una utilidad con un color", () => {
    // `text-center` no es ni tamaño ni color. Si el guion no lo distinguiera, la
    // comprobación nacería roja por cada alineación del proyecto.
    const raiz = conClases("text-center text-base text-neutro-900");
    try {
      const { hallazgos, salida } = verificar(raiz);
      assert.deepEqual(hallazgos, [], `«text-center» no es un color:\n${salida}`);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("no se cae si el árbol no tiene las carpetas del proyecto", () => {
    // El barrido recursivo es lo primero que se ejecuta; si un directorio ausente
    // lo tumbara, el CI moriría con un error de Node en vez de con un diagnóstico,
    // que es la peor forma de fallar: nadie sabe qué arreglar.
    const raiz = arbol(["components"]);
    try {
      const { hallazgos, salida } = verificar(raiz);
      assert.equal(/ERROR|Error:/.test(salida), false, `el guion no debe reventar:\n${salida}`);
      assert.deepEqual(hallazgos, []);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});
