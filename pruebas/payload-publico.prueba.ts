/**
 * La frontera servidor→cliente de las rutas públicas (tarea #93).
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
 * POR QUÉ LA PRUEBA MIRA EL HTML COMPILADO
 * ---------------------------------------
 * Una prueba que solo leyera el código fuente podría pasar mientras el payload
 * sigue llevando los datos: lo que hay que medir es **lo que se sirve**. Por eso
 * este archivo recorre las páginas prerenderizadas de `.next` y busca las dos
 * cadenas en el HTML completo, `<script>` incluidos, que es exactamente donde se
 * escondían.
 *
 * Si todavía no hay compilación, la comprobación del HTML **no se salta en
 * silencio**: se declara como no medida, porque un verde que no midió nada es peor
 * que un rojo honesto.
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

/** Todas las páginas HTML prerenderizadas de la compilación. */
function htmlCompilado(): string[] {
  const base = join(RAIZ, ".next", "server", "app");
  if (!existsSync(base)) return [];

  const encontrados: string[] = [];
  const recorrer = (carpeta: string) => {
    for (const entrada of readdirSync(carpeta)) {
      const camino = join(carpeta, entrada);
      if (statSync(camino).isDirectory()) recorrer(camino);
      else if (entrada.endsWith(".html")) encontrados.push(camino);
    }
  };
  recorrer(base);
  return encontrados;
}

const PAGINAS = htmlCompilado();

/* -------------------------------------------------------------------------- */
/* Lo que se sirve                                                             */
/* -------------------------------------------------------------------------- */

describe("el HTML público no lleva al navegador datos que no usa", () => {
  it("hay compilación que medir (si no, esto no puede dar verde)", () => {
    assert.ok(
      PAGINAS.length > 0,
      "no se encontró ninguna página prerenderizada en `.next/server/app`: compila antes de correr esta prueba. " +
        "Un verde sin compilación no mediría nada."
    );
  });

  it("ninguna página servida contiene `NID-`, ni dentro de `<script>`", () => {
    const culpables = PAGINAS.filter((pagina) =>
      readFileSync(pagina, "utf8").includes("NID-")
    ).map((pagina) => relative(RAIZ, pagina));

    assert.deepEqual(
      culpables,
      [],
      `el código visible viaja al navegador en estas páginas: ${culpables.join(", ")}`
    );
  });

  it("ninguna página servida contiene `anfitrion_id`", () => {
    const culpables = PAGINAS.filter((pagina) =>
      readFileSync(pagina, "utf8").includes("anfitrion_id")
    ).map((pagina) => relative(RAIZ, pagina));

    assert.deepEqual(
      culpables,
      [],
      `el identificador del anfitrión viaja al navegador en: ${culpables.join(", ")}`
    );
  });
});

/* -------------------------------------------------------------------------- */
/* La frontera                                                                 */
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
});
