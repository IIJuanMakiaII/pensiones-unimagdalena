/**
 * Sello «Verificado por Nido ✓» (tarea #51).
 *
 * Se prueba en tres frentes, porque cada uno protege algo distinto:
 *
 *   1. **El caso negativo.** Que un anuncio sin verificar no muestre nada es la
 *      mitad importante del sello: una insignia de confianza que se cuela sola
 *      es peor que no tener insignia. Se comprueba además contra valores que
 *      «parecen» un sí (`"true"`, `1`, un objeto), que es por donde se abriría
 *      una puerta sin querer.
 *   2. **El texto exacto**, que es lo que se lee en pantalla y lo que se oye.
 *   3. **La estructura que lo dibuja**: que la tarjeta lo gobierne con
 *      `pension.verificado` y que la etiqueta no tenga forma de decidir por su
 *      cuenta ni de repetir el texto con un `aria-label`.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * --------------------------------------------------
 * Que nadie pueda concederse el sello. Eso no se defiende en la interfaz sino en
 * la base: `verificado` no está entre las columnas que `authenticated` puede
 * escribir, y la concesión pasa por `maestro_actualizar_campos_pension` con
 * `es_maestro()` como guarda. Lo prueba por comportamiento real
 * `supabase/pruebas/oleada-9.sql` (paso 7c: el maestro lo cambia; pasos 8a y 8b3:
 * el anfitrión y el estudiante reciben `42501`). Esta prueba solo vigila que la
 * interfaz no abra una puerta paralela, y no pretende ser esa otra prueba.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TEXTO_SELLO, mostrarSello } from "@/lib/sello";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo.
 *
 * No es cosmética: dos de estas comprobaciones son del tipo «esto **no**
 * aparece», y los propios archivos explican en sus comentarios exactamente lo
 * que no hacen —`EtiquetaVerificado.tsx` dice «no lleva `aria-label`», y
 * `CardPension.tsx` cuenta que dejó de usar el círculo—. Sin quitarlos, la
 * afirmación mediría la prosa en vez del código, y el comentario que documenta
 * una ausencia haría fallar la prueba que la vigila.
 *
 * Respeta las cadenas ('…', "…", `…`) para no confundir una barra dentro de un
 * texto con el comienzo de un comentario. Es el mismo criterio que usa
 * `pruebas/panel-maestro.prueba.ts`; se repite aquí para no tener que editar el
 * archivo de otra tarea mientras su dueño lo está tocando.
 */
function sinComentarios(codigoFuente: string): string {
  let salida = "";
  let comilla: string | null = null;
  let i = 0;

  while (i < codigoFuente.length) {
    const caracter = codigoFuente[i];
    const siguiente = codigoFuente[i + 1];

    if (comilla) {
      salida += caracter;
      if (caracter === "\\") {
        salida += siguiente ?? "";
        i += 2;
        continue;
      }
      if (caracter === comilla) comilla = null;
      i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "/") {
      while (i < codigoFuente.length && codigoFuente[i] !== "\n") i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "*") {
      i += 2;
      while (i < codigoFuente.length && !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    if (caracter === '"' || caracter === "'" || caracter === "`") comilla = caracter;
    salida += caracter;
    i += 1;
  }

  return salida;
}

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), "utf8"));

describe("mostrarSello · la decisión de mostrar el sello", () => {
  it("con un anuncio verificado, se muestra", () => {
    assert.equal(mostrarSello(true), true);
  });

  it("con un anuncio sin verificar, no se muestra nada", () => {
    assert.equal(mostrarSello(false), false);
  });

  it("falla cerrado ante cualquier cosa que no sea el booleano `true`", () => {
    // El sello lo concede la base. Si alguna vez el mapeo devolviera otra cosa,
    // la insignia no puede aparecer por accidente.
    const noEsUnSi = ["true", "false", "1", "si", 1, 0, [], {}, null, undefined, NaN];
    for (const valor of noEsUnSi) {
      assert.equal(
        mostrarSello(valor),
        false,
        `«${String(valor)}» no debería mostrar el sello`
      );
    }
  });
});

describe("TEXTO_SELLO · lo que se lee y lo que se oye", () => {
  it("dice exactamente «Verificado por Nido ✓»", () => {
    assert.equal(TEXTO_SELLO, "Verificado por Nido ✓");
  });

  it("lleva la marca una sola vez", () => {
    assert.equal((TEXTO_SELLO.match(/✓/g) ?? []).length, 1);
  });
});

describe("la tarjeta · quién gobierna el sello", () => {
  const tarjeta = leer("components/CardPension.tsx");

  it("lo dibuja con la etiqueta de texto, no con el círculo mudo", () => {
    assert.match(tarjeta, /<EtiquetaVerificado/);
    assert.doesNotMatch(tarjeta, /<SelloVerificado/);
  });

  it("la guarda es `pension.verificado`, leído del anuncio", () => {
    assert.match(tarjeta, /mostrarSello\(pension\.verificado\)/);
  });

  it("vive sobre la foto, en el mismo anclaje que tenía el círculo", () => {
    assert.match(tarjeta, /<EtiquetaVerificado className="absolute right-3 top-3"/);
  });
});

describe("la etiqueta · lo que no puede hacer", () => {
  const etiqueta = leer("components/EtiquetaVerificado.tsx");

  it("no decide por su cuenta: no recibe el estado de verificación", () => {
    // Sin una prop `verificado` no hay forma de encenderla desde fuera, ni de
    // que un llamador se invente el permiso.
    assert.doesNotMatch(etiqueta, /verificado\s*[?:]/i);
  });

  it("no repite el texto visible con un aria-label", () => {
    assert.doesNotMatch(etiqueta, /aria-label/);
  });

  it("solo escribe el texto del sello, sin adornos que un lector deba saltar", () => {
    assert.match(etiqueta, /\{TEXTO_SELLO\}/);
    assert.doesNotMatch(etiqueta, /<svg/);
  });

  it("pinta el texto sobre el par declarado con contraste suficiente para texto", () => {
    // `primary-600` está en la lista verificada de `scripts/verificar-contraste.mjs`
    // con mínimo 4,5:1. No vale `confianza-success` (#FF385C, 3,52:1): sirve para
    // un gráfico, no para texto.
    assert.match(etiqueta, /bg-primary-600/);
    assert.match(etiqueta, /text-white/);
    assert.doesNotMatch(etiqueta, /bg-confianza-success/);
  });
});
