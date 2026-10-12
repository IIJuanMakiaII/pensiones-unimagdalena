/**
 * Las páginas públicas que pueden quedarse sin nada que mostrar cortan en la
 * metadata, no en el cuerpo (tarea #71).
 *
 * ## El defecto que esto vigila
 *
 * `/barrios` y `/barrios/<cualquier cosa>` respondían **200** con
 * `robots: index, follow, max-image-preview:large, max-snippet:-1` y sin
 * contenido cuando no había ninguna publicación activa —medido contra el
 * dominio—, mientras que la ficha de pensión y una ruta inventada respondían 404
 * con `noindex`. No era una ruta de más: era un número no acotado de direcciones
 * del dominio diciéndole a Google «indéxame» sin tener nada que indexar.
 *
 * La causa no estaba en la decisión —`resumenesDeBarrio()` ya devolvía la lista
 * vacía—, sino en **dónde** se tomaba, y el sitio donde se toma **no** es el que
 * parecía. Copiar la guarda de la ficha a `generateMetadata` fue lo primero que se
 * intentó y **no cambió el código de estado**: medido en la misma compilación, con
 * el catálogo sembrado, `/barrios/otro` seguía respondiendo 200 con
 * `index, follow` —sin `<main>` en el cuerpo y con el HTML de «no encontrada»
 * dentro del vuelo RSC— mientras `/pensiones/<uuid inexistente>` respondía 404 en
 * ese mismo build. La diferencia no estaba en la guarda, estaba en la ruta.
 *
 * La razón ya estaba escrita en `middleware.ts`: la ruta es ISR con `dynamicParams`
 * abierto, así que Next genera las rutas desconocidas bajo demanda y **materializa
 * el HTML del estado "no encontrada" con código 200**. El 404 de la ficha no lo
 * produce su metadata: lo produce el **middleware**, que responde antes de que la
 * página se renderice —y una respuesta del middleware sobrevive a que Next
 * reescriba el cuerpo—. Así que el arreglo vive en `middleware.ts`, y esta prueba
 * lo fija **ahí** además de aquí.
 *
 * ## Qué vigila cada mitad
 *
 * · `middleware.ts` es el **mecanismo**: decide el código de estado y la directiva
 *   `robots`. Es lo que impide que la página se sirva vacía con un 200 indexable, y
 *   es la mitad que de verdad cierra el defecto.
 * · Las `generateMetadata` de las dos páginas son **defensa en profundidad**: no
 *   fijan el estado —medido—, pero evitan que el cuerpo dibuje una lista vacía si
 *   alguien moviera la guarda del middleware. Se conservan a propósito y se vigilan
 *   a propósito.
 *
 * ## Por qué una prueba de la fuente y no solo de la respuesta
 *
 * Porque lo que puede volver a degradarse es la fuente, y el síntoma no rompe
 * nada visible: un 200 con `index, follow` «se ve» casi igual que un 404 cuando el
 * catálogo está vacío. Eso lo hace invisible en una revisión y en un despliegue, y
 * es exactamente la clase de fallo que este proyecto vigila con una prueba en
 * lugar de confiar en que alguien lo note. La medición de la respuesta —código de
 * estado y directiva `robots`, que es lo que decide— se hace contra el servidor y
 * complementa a esto; no lo sustituye.
 *
 * Los comentarios se quitan antes de mirar, y no es cosmético: el porqué de esta
 * guarda está escrito dentro de las propias funciones y **menciona** `notFound()`,
 * así que buscarlo en el texto crudo encontraría el comentario en vez del código y
 * la prueba pasaría sin que existiera la guarda.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Las páginas que existen para mostrar el catálogo público y que, por tanto,
 * pueden quedarse sin nada que mostrar. La portada no está aquí a propósito: es
 * la única que debe seguir existiendo cuando no hay inventario, y resuelve el
 * vacío con la lista de espera en lugar de con un 404 (tarea #68).
 */
const PAGINAS = ["app/barrios/page.tsx", "app/barrios/[barrio]/page.tsx", "app/pensiones/[id]/page.tsx"];

/** Quita comentarios de bloque y de línea: el código, sin el porqué escrito al lado. */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * El cuerpo de una función, contando llaves.
 *
 * Un `/\{([\s\S]*?)\}/` no sirve: corta en la primera llave de cierre, que en
 * estas funciones es la del objeto que devuelven, y dejaría fuera justo lo que hay
 * después del primer `return`.
 *
 * Tampoco sirve buscar la primera llave que aparece tras el nombre: en
 * `generateMetadata({ params }: Props)` esa llave es la del **parámetro
 * desestructurado**, que se abre y se cierra en el acto. El contador volvería a
 * cero de inmediato y el «cuerpo» saldría siendo ` params ` —vacío de guards—,
 * con lo que la prueba fallaría sobre código correcto. Por eso se salta primero la
 * lista de parámetros, emparejando su paréntesis, y solo entonces se busca la
 * llave del cuerpo.
 */
function cuerpoDeFuncion(fuente: string, firma: RegExp): string | null {
  const inicio = fuente.search(firma);
  if (inicio === -1) return null;

  const parentesis = fuente.indexOf("(", inicio);
  if (parentesis === -1) return null;

  let nivelParentesis = 0;
  let finParametros = -1;
  for (let i = parentesis; i < fuente.length; i += 1) {
    if (fuente[i] === "(") nivelParentesis += 1;
    else if (fuente[i] === ")") {
      nivelParentesis -= 1;
      if (nivelParentesis === 0) {
        finParametros = i;
        break;
      }
    }
  }
  if (finParametros === -1) return null;

  const llave = fuente.indexOf("{", finParametros);
  if (llave === -1) return null;

  let nivelLlaves = 0;
  for (let i = llave; i < fuente.length; i += 1) {
    if (fuente[i] === "{") nivelLlaves += 1;
    else if (fuente[i] === "}") {
      nivelLlaves -= 1;
      if (nivelLlaves === 0) return sinComentarios(fuente.slice(llave + 1, i));
    }
  }
  return null;
}

function fuenteDe(archivo: string): string {
  return readFileSync(join(RAIZ, ...archivo.split("/")), "utf8");
}

/** Posición de un patrón, o -1. `search` con `\b` evita confundir `return` con un nombre. */
const posicion = (texto: string, patron: RegExp): number => texto.search(patron);

describe("las páginas que pueden quedarse vacías cortan antes de la cabecera", () => {
  for (const archivo of PAGINAS) {
    it(`${archivo} decide su existencia en generateMetadata, antes de cualquier return`, () => {
      const cuerpo = cuerpoDeFuncion(fuenteDe(archivo), /export async function generateMetadata/);

      assert.ok(
        cuerpo !== null,
        `${archivo} no declara generateMetadata: sin él la guarda no puede fijar el código de estado`
      );

      const guarda = posicion(cuerpo, /notFound\(\)/);
      assert.ok(guarda !== -1, `${archivo}: generateMetadata no llama a notFound(), así que la página vacía responde 200`);

      const primerReturn = posicion(cuerpo, /\breturn\b/);
      assert.ok(
        primerReturn === -1 || guarda < primerReturn,
        `${archivo}: la guarda está después del primer return, así que se puede saltar`
      );
    });

    it(`${archivo} no devuelve metadata vacía en lugar de cortar`, () => {
      const cuerpo = cuerpoDeFuncion(fuenteDe(archivo), /export async function generateMetadata/) ?? "";

      // Ésta es literalmente la forma que tenía el defecto en `[barrio]`: `if (!resumen) return {}`.
      // Devolver metadata vacía no cambia el código de estado: la página sigue siendo un 200.
      assert.doesNotMatch(cuerpo, /return\s*\{\s*\}/, `${archivo} vuelve a devolver metadata vacía en vez de cortar`);
      assert.doesNotMatch(cuerpo, /return\s+null\b/, `${archivo} devuelve null en vez de cortar`);
    });

    it(`${archivo} conserva la guarda en el cuerpo como segunda defensa`, () => {
      const cuerpo = cuerpoDeFuncion(fuenteDe(archivo), /export default async function \w+/);

      assert.ok(cuerpo !== null, `${archivo}: no se encontró el componente de página`);
      assert.ok(
        posicion(cuerpo, /notFound\(\)/) !== -1,
        `${archivo}: el cuerpo ya no corta, así que dibujaría la página sin nada dentro si la metadata se moviera`
      );
    });
  }
});

/**
 * La otra mitad, y la que de verdad decide el código de estado: el middleware.
 *
 * Se probó primero lo que parecía obvio —copiar la guarda de la ficha a
 * `generateMetadata`— y **no cambió el código de estado**. Lo que lo cambia es
 * esto: el middleware responde antes de que la página se renderice, y su
 * respuesta sobrevive a que Next reescriba el cuerpo. Por eso esta prueba mira
 * `middleware.ts`, y no solo las páginas.
 */
describe("el middleware fija el 404 y el noindex de los barrios", () => {
  const fuente = sinComentarios(fuenteDe("middleware.ts"));

  it("atiende el índice y cualquier dirección por debajo, en el matcher", () => {
    assert.ok(fuente.includes("matcher"), "middleware.ts ya no declara matcher: ninguna ruta pasa por él");
    assert.ok(
      fuente.includes('"/barrios"'),
      "middleware.ts no atiende /barrios, así que el índice volvería a responder 200 indexable"
    );
    assert.ok(
      fuente.includes('"/barrios/:path*"'),
      "middleware.ts no atiende /barrios/:path*, así que las páginas de barrio volverían a responder 200 indexable"
    );
  });

  it("normaliza con la misma función que usa la página para agrupar", () => {
    assert.match(
      fuente,
      /import\s*\{[^}]*slugDeBarrio[^}]*\}\s*from\s*"@\/lib\/barrios"/,
      "middleware.ts dejó de importar slugDeBarrio: compararía direcciones sin normalizar contra slugs normalizados"
    );
  });

  it("no deja la comprobación detrás del camino de sesión", () => {
    const barrios = fuente.indexOf("/^\\/barrios");
    const sesion = fuente.indexOf("actualizarSesion(peticion)");

    assert.ok(barrios !== -1, "middleware.ts ya no reconoce la ruta de barrios");
    assert.ok(sesion !== -1, "middleware.ts ya no actualiza la sesión");
    assert.ok(
      barrios < sesion,
      "la comprobación de barrios quedó después del camino de sesión, así que puede no llegar a ejecutarse"
    );
  });

  it("responde 404 ante una dirección sin publicaciones, no un pase", () => {
    const cuerpo = cuerpoDeFuncion(fuente, /async function comprobarBarrioPublico/);
    assert.ok(cuerpo !== null, "middleware.ts ya no declara comprobarBarrioPublico");

    assert.match(cuerpo, /slugs\.size\s*===\s*0/, "el índice ya no se decide por si hay algún barrio publicado");
    assert.match(cuerpo, /respuestaBarrioNoPublicado\(true\)/, "el índice vacío ya no responde 404");
    assert.match(cuerpo, /slugs\.has\(slug\)/, "una dirección desconocida ya no responde 404");
    assert.match(
      cuerpo,
      /respuestaBarrioNoPublicado\(false\)/,
      "una dirección sin publicaciones ya no responde 404"
    );
  });

  it("compara el segmento tal cual, sin volver a normalizarlo", () => {
    const cuerpo = cuerpoDeFuncion(fuente, /async function comprobarBarrioPublico/) ?? "";

    // Normalizar aquí una dirección que la página no reconocería abriría un hueco:
    // /barrios/EL-PANDO pasaría este filtro y respondería 200 con nada dentro.
    assert.doesNotMatch(
      cuerpo,
      /slugDeBarrio/,
      "comprobarBarrioPublico volvió a normalizar el segmento, y /barrios/EL-PANDO pasaría el filtro"
    );
  });

  it("ante la duda de infraestructura deja pasar la página, no la convierte en 404", () => {
    const cuerpo = cuerpoDeFuncion(fuente, /async function comprobarBarrioPublico/) ?? "";

    assert.match(
      cuerpo,
      /estado\s*===\s*"error"\s*\)\s*return\s+null/,
      "un fallo al leer los barrios públicos ya no deja pasar: una caída de la base volvería 404 páginas legítimas"
    );
  });

  it("el 404 viaja con noindex en el cuerpo y en la cabecera", () => {
    const cuerpo = cuerpoDeFuncion(fuente, /function respuestaBarrioNoPublicado/);
    assert.ok(cuerpo !== null, "middleware.ts ya no declara respuestaBarrioNoPublicado");

    assert.match(cuerpo, /status:\s*404/, "la respuesta de barrio sin publicaciones ya no es un 404");
    assert.match(cuerpo, /"x-robots-tag":\s*"noindex"/, "la cabecera x-robots-tag dejó de llevar noindex");
    assert.match(cuerpo, /name="robots"\s+content="noindex"/, "el HTML del 404 dejó de declararse noindex");
    assert.match(cuerpo, /"cache-control":\s*"no-store"/, "el 404 dejó de viajar sin caché");
  });
});
