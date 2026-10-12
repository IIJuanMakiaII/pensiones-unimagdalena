/**
 * El botón del sello en el panel maestro.
 *
 * Se prueba en tres frentes, y el tercero es el que de verdad importa:
 *
 *   1. **La manija.** Que el panel ofrezca el control y que refleje el estado
 *      —concedido, sin conceder, y con qué fecha— en vez de dejar al maestro a
 *      ciegas sobre qué anuncios llevan la insignia pública.
 *   2. **El camino.** Que la acción llame a la función de la base y **no** haga un
 *      `update` sobre la tabla. No es estilo: `verificado` no está entre las
 *      columnas que `authenticated` puede escribir, así que un `update` fallaría
 *      con `42501` y el botón parecería roto sin serlo.
 *   3. **El contenido de la escritura.** Que solo viaje el booleano. La función
 *      admite cuatro claves y la fecha no es una de ellas: si algún día alguien
 *      añadiera `verificado_en` aquí, la base respondería `22023` —y si algún día
 *      dejara de responderlo, sería porque alguien abrió la llave que la oleada-13
 *      dejó cerrada a propósito—.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * --------------------------------------------------
 * Que un anfitrión no pueda concederse el sello. Eso no se defiende en la
 * interfaz sino en la base, y ya está probado por comportamiento real en
 * `supabase/pruebas/oleada-9.sql` (paso 7c: el maestro lo cambia; pasos 8a y 8b3:
 * el anfitrión y el estudiante reciben `42501`). Aquí solo se vigila que la
 * interfaz no abra una puerta paralela ni prometa una capacidad que la base no
 * tenga. Tampoco demuestra que el sello se vea en el catálogo al pulsar: eso lo
 * miden `pruebas/sello.prueba.ts` para el dibujo y la verificación de estados
 * contra el despliegue para el efecto real.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Quita los comentarios antes de afirmar nada. Ver la nota en `pruebas/sello.prueba.ts`. */
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

const PANEL = "components/PanelMaestro.tsx";
const ACCIONES = "app/actions/maestro.ts";

describe("el panel · el control existe y dice la verdad", () => {
  const panel = leer(PANEL);

  it("monta el control del sello", () => {
    assert.match(panel, /<ControlSello pension=\{pension\} \/>/);
    assert.match(panel, /function ControlSello\(/);
  });

  it("lo importa de la acción de servidor, no lo decide él", () => {
    assert.match(panel, /sellarVerificacionMaestro/);
  });

  it("muestra el estado del sello junto a «Publicada / Retirada»", () => {
    assert.match(panel, /pension\.verificado \? "Verificado" : "Sin verificar"/);
  });

  it("no dibuja la insignia por su cuenta: la gobierna el dato del anuncio", () => {
    // El sello público vive en `EtiquetaVerificado`, y su única fuente es
    // `pension.verificado`. El panel muestra texto, no la insignia: dos dibujos
    // distintos del mismo sello serían dos sitios donde puede desincronizarse.
    assert.doesNotMatch(panel, /<EtiquetaVerificado/);
    assert.doesNotMatch(panel, /<SelloVerificado/);
  });

  it("la fecha sale del formateador compartido, no de un `toLocaleDateString` suelto", () => {
    assert.match(panel, /formatearFechaVerificacion\(pension\.verificado_en\)/);
    assert.doesNotMatch(panel, /toLocaleDateString/);
  });

  it("no dice «visita» donde la base sella el momento del registro", () => {
    // La tentación era escribir «la visita se registró el …», y no es lo que el
    // dato dice: el disparador marca el instante en que se concede el sello. La
    // distinción importa porque en Colombia «verificado» es una afirmación de
    // protección al consumidor.
    const bloque = panel.slice(panel.indexOf("function ControlSello("));
    const cuerpo = bloque.slice(0, bloque.indexOf("\n}\n"));
    assert.doesNotMatch(cuerpo, /visita/i);
  });
});

describe("la acción · por dónde escribe", () => {
  const acciones = leer(ACCIONES);
  const inicio = acciones.indexOf("export async function sellarVerificacionMaestro");
  assert.ok(inicio > -1, "no se encontró la acción sellarVerificacionMaestro");
  const accion = acciones.slice(inicio, acciones.indexOf("\nexport async function", inicio + 1));

  it("llama a la función de la base que existe para esto", () => {
    assert.match(accion, /\.rpc\(\s*"maestro_actualizar_campos_pension"/);
  });

  it("no escribe `verificado` con un `update` sobre la tabla", () => {
    // La RLS por columna lo rechazaría con 42501: el botón parecería roto.
    assert.doesNotMatch(accion, /update\(\s*\{[^}]*verificado/);
    assert.doesNotMatch(accion, /from\("pensiones"\)/);
  });

  it("exige el perfil maestro antes de tocar nada", () => {
    const guardia = accion.indexOf("exigirMaestro()");
    const escritura = accion.indexOf("maestro_actualizar_campos_pension");
    assert.ok(guardia > -1, "la acción no comprueba el perfil maestro");
    assert.ok(guardia < escritura, "la comprobación del perfil tendría que ir antes de la escritura");
  });

  it("manda solo el booleano: la fecha no viaja, no puede viajar", () => {
    assert.match(accion, /p_cambios:\s*\{\s*verificado\s*\}/);
    assert.match(accion, /p_pension_id:\s*pensionId/);
    assert.doesNotMatch(accion, /verificado_en/);
  });

  it("traduce la falta de permiso a un mensaje, no a un error crudo", () => {
    assert.match(accion, /42501/);
    assert.match(accion, /NO_ES_MAESTRO/);
  });

  it("no canta un éxito sin haber comprobado que algo cambió", () => {
    assert.match(accion, /if \(!data\)/);
  });

  it("refresca el catálogo y el panel, que es donde se ve el efecto", () => {
    assert.match(accion, /revalidarCatalogo\(\)/);
    assert.match(accion, /revalidarPanelMaestro\(\)/);
  });
});

describe("el camino del sello · contra las otras escrituras del panel", () => {
  it("la acción no toca el precio ni la identidad del anunciante", () => {
    const acciones = leer(ACCIONES);
    const inicio = acciones.indexOf("export async function sellarVerificacionMaestro");
    const accion = acciones.slice(inicio, acciones.indexOf("\nexport async function", inicio + 1));
    assert.doesNotMatch(accion, /precio_mensual/);
    assert.doesNotMatch(accion, /anfitrion_id/);
    assert.doesNotMatch(accion, /habitaciones/);
  });

  it("el rol no se lee nunca de los metadatos del usuario", () => {
    // `user_metadata` lo escribe el propio usuario: leer el rol de ahí sería un
    // agujero de escalada. La pregunta se le hace a la base, que es quien sabe.
    assert.doesNotMatch(leer(ACCIONES), /user_metadata/);
    assert.doesNotMatch(leer(PANEL), /user_metadata/);
  });
});
