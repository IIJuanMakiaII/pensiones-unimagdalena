/**
 * La frontera servidor→cliente de las rutas públicas (tarea #93, reforzada en la #95).
 *
 * EL PROBLEMA QUE ESTO VIGILA, Y POR QUÉ NO SE VE MIRANDO EL HTML
 * ---------------------------------------------------------------
 * Un componente de cliente recibe sus datos serializados dentro del HTML, en el
 * payload RSC (`<script>self.__next_f.push(...)</script>`). Ese payload no se
 * dibuja, así que ninguna revisión a ojo del texto visible lo encuentra — y sin
 * embargo viaja al navegador de cualquiera que abra la página.
 *
 * Hasta la tarea #93 viajaban ahí dos datos que la interfaz pública no usa:
 * `codigo_visible` (el `NID-0001` de administración) y `anfitrion_id` (el
 * identificador interno de la cuenta que publicó). El primero ya era legible por
 * la API REST con la clave anónima y eso se aceptó a conciencia; el segundo no se
 * había decidido publicar nunca. La causa no era la consulta —`COLUMNAS_PENSION`
 * es una proyección única y compartida, y separarla reintroduce la trampa del
 * `42501` que este proyecto ya sufrió— sino la frontera: el objeto entero cruzaba
 * del servidor al cliente.
 *
 * LAS DOS PUERTAS QUE SE MIRAN (tarea #95)
 * ---------------------------------------
 * 1. **El HTML servido**, con su payload dentro de `<script>`. Es la carga inicial.
 * 2. **Los payloads `.rsc`**, que Next sirve aparte en las navegaciones de cliente.
 *    Se quedaron fuera de la primera versión de esta prueba: el día que se
 *    escribió estaban limpios, pero nada lo exigía, así que el defecto podía volver
 *    por ahí sin que la suite se enterara. Un cero que nadie comprueba no es una
 *    garantía, es una coincidencia.
 *
 * POR QUÉ LA PRUEBA MIRA LA COMPILACIÓN Y NO SOLO EL CÓDIGO
 * -------------------------------------------------------
 * Una prueba que solo leyera el código fuente podría pasar mientras el payload
 * sigue llevando los datos: lo que hay que medir es **lo que se sirve**. Por eso
 * este archivo recorre los artefactos de `.next` y busca las dos cadenas en el
 * contenido completo, `<script>` incluidos, que es exactamente donde se escondían.
 *
 * La segunda suite comprueba además la **frontera en el código**: que las rutas
 * públicas no pasen el objeto crudo al componente de cliente. No duplica la
 * primera; la primera dice que hoy no se filtra, la segunda que no se filtrará en
 * la próxima compilación. Si solo existiera la primera, un cambio descuidado en una
 * página pasaría inadvertido hasta el siguiente build; esta lo caza al instante.
 *
 * Y cubre **las tres** rutas que entregan objetos a un componente de cliente, no
 * solo dos: las páginas de barrio fueron la tercera puerta, y fueron justo la que
 * ninguna ficha preveía.
 *
 * Si todavía no hay compilación, la comprobación **no se salta en silencio**: se
 * declara como no medida, porque un verde que no midió nada es peor que un rojo
 * honesto.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Quita los comentarios antes de afirmar cosas sobre un archivo (mismo ayudante que en `panel-maestro.prueba.ts`). */
function sinComentarios(codigoFuente: string): string {
  let salida = "";
  let i = 0;
  let comilla: string | null = null;

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

    if (caracter === "'" || caracter === '"' || caracter === "`") {
      comilla = caracter;
      salida += caracter;
      i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "/") {
      while (i < codigoFuente.length && codigoFuente[i] !== "\n") i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "*") {
      i += 2;
      while (i < codigoFuente.length && !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }

    salida += caracter;
    i += 1;
  }

  return salida;
}

function fuente(relativa: string): string {
  return sinComentarios(readFileSync(join(RAIZ, ...relativa.split("/")), "utf8"));
}

/** Los artefactos de la compilación que se sirven al navegador con esa extensión. */
function compilado(extension: string): string[] {
  const base = join(RAIZ, ".next", "server", "app");
  if (!existsSync(base)) return [];

  const encontrados: string[] = [];
  const recorrer = (carpeta: string) => {
    for (const entrada of readdirSync(carpeta)) {
      const camino = join(carpeta, entrada);
      if (statSync(camino).isDirectory()) recorrer(camino);
      else if (entrada.endsWith(extension)) encontrados.push(camino);
    }
  };
  recorrer(base);
  return encontrados;
}

/** Las páginas prerenderizadas: la carga inicial. */
const PAGINAS = compilado(".html");

/**
 * Los payloads de navegación de cliente. Es la puerta que la primera versión de
 * esta prueba no barría (hallazgo O-1 de la revisión de la tarea #94).
 */
const PAYLOADS = compilado(".rsc");

/** Todo lo que Next sirve al navegador desde la compilación, junto. */
const SERVIDO = [...PAGINAS, ...PAYLOADS];

/**
 * Busca una cadena en todos los artefactos servidos y devuelve los culpables.
 *
 * Se lee como texto y no con un parser a propósito: el payload RSC viaja escapado
 * dentro de una cadena de JavaScript (`\"anfitrion_id\"`), así que buscar el nombre
 * del campo tal cual es más estricto que interpretarlo — si aparece de cualquier
 * forma, aparece.
 */
function artefactosCon(cadena: string): string[] {
  return SERVIDO.filter((artefacto) => readFileSync(artefacto, "utf8").includes(cadena))
    .map((artefacto) => relative(RAIZ, artefacto))
    .sort();
}

/* -------------------------------------------------------------------------- */
/* Lo que se sirve                                                             */
/* -------------------------------------------------------------------------- */

describe("lo que se sirve al navegador no lleva datos que la interfaz no usa", () => {
  it("hay compilación que medir: páginas y payloads (si no, esto no puede dar verde)", () => {
    assert.ok(
      PAGINAS.length > 0,
      "no se encontró ninguna página prerenderizada en `.next/server/app`: compila antes de correr esta prueba. " +
        "Un verde sin compilación no mediría nada."
    );
    assert.ok(
      PAYLOADS.length > 0,
      "no se encontró ningún payload `.rsc` en `.next/server/app`: sin ellos la prueba no estaría mirando la puerta " +
        "de las navegaciones de cliente, y diría que vigila algo que no vigila."
    );
  });

  it("ningún artefacto servido contiene `NID-`, ni dentro de `<script>` ni en un payload RSC", () => {
    const culpables = artefactosCon("NID-");

    assert.deepEqual(
      culpables,
      [],
      `el código visible viaja al navegador en estos artefactos servidos: ${culpables.join(", ")}`
    );
  });

  it("ningún artefacto servido contiene `anfitrion_id`", () => {
    const culpables = artefactosCon("anfitrion_id");

    assert.deepEqual(
      culpables,
      [],
      `el identificador del anfitrión viaja al navegador en: ${culpables.join(", ")}`
    );
  });
});

/* -------------------------------------------------------------------------- */
/* La frontera, en el código                                                   */
/* -------------------------------------------------------------------------- */

describe("las rutas públicas recortan el objeto antes de dárselo al cliente", () => {
  it("la portada no entrega la lista cruda al catálogo interactivo", () => {
    const portada = fuente("app/page.tsx");

    assert.equal(
      portada.includes("pensiones={pensiones}"),
      false,
      "la lista del catálogo cruza al cliente sin recortar: el payload arrastra los datos internos"
    );
  });

  it("la ficha no entrega el anuncio crudo al detalle", () => {
    const ficha = fuente("app/pensiones/[id]/page.tsx");

    assert.equal(
      ficha.includes("pension={pension}"),
      false,
      "el anuncio cruza al cliente sin recortar"
    );
  });

  /**
   * La tercera puerta (hallazgo O-2). Las páginas de barrio pintan la tarjeta
   * directamente desde el servidor, sin pasar por el catálogo, y fue justo la ruta
   * que ninguna ficha preveía: la encontró la medición, con el dominio delante.
   * La aserción de HTML ya la cubría; esta la cubre también en el código, que es
   * lo que impide que vuelva en la próxima compilación.
   */
  it("la página de barrio no entrega el anuncio crudo a la tarjeta", () => {
    const barrio = fuente("app/barrios/[barrio]/page.tsx");

    assert.equal(
      barrio.includes("pension={pension}"),
      false,
      "el anuncio cruza al cliente sin recortar desde la página de barrio: es la tercera puerta, la que la medición destapó"
    );
  });
});
